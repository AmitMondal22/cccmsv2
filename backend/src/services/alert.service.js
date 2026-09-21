import { Alert, AlertRule, Device, MaintenanceTicket, Notification, Street, Ward, Zone, City } from '../models/index.js';
import { sendAlertEmail } from './email.service.js';
import { Op } from 'sequelize';
import { evaluateLEDFaults } from './faultDetection.service.js';

/**
 * Check if a rule applies to a specific device based on scope hierarchy
 */
async function isRuleApplicable(rule, device) {
  if (!rule.scope_type || rule.scope_type === 'global' || !rule.scope_id) {
    return true;
  }

  const scopeId = parseInt(rule.scope_id);

  if (rule.scope_type === 'device') {
    return device.id === scopeId;
  }

  if (rule.scope_type === 'street') {
    return device.street_id === scopeId;
  }

  // Load device hierarchy if not already populated
  const devWithHierarchy = await Device.findByPk(device.id, {
    include: [{
      model: Street, as: 'street',
      include: [{
        model: Ward, as: 'ward',
        include: [{
          model: Zone, as: 'zone',
          include: [{ model: City, as: 'city' }]
        }]
      }]
    }]
  });

  if (!devWithHierarchy || !devWithHierarchy.street) return false;

  if (rule.scope_type === 'ward') {
    return devWithHierarchy.street.ward_id === scopeId;
  }

  if (rule.scope_type === 'zone') {
    return devWithHierarchy.street.ward?.zone_id === scopeId;
  }

  if (rule.scope_type === 'city') {
    return devWithHierarchy.street.ward?.zone?.city_id === scopeId;
  }

  if (rule.scope_type === 'project') {
    return devWithHierarchy.street.ward?.zone?.city?.project_id === scopeId;
  }

  return true;
}

/**
 * Evaluate all active alert rules against a telemetry packet.
 * Creates/recovers alerts, sends emails, creates maintenance tickets.
 */
export async function evaluateAlertRules(device, telemetry) {
  const rules = await AlertRule.findAll({ where: { is_active: true } });

  for (const rule of rules) {
    // Check scope applicability
    const applicable = await isRuleApplicable(rule, device);
    if (!applicable) {
      continue;
    }

    const conditionMet = evaluateCondition(rule, telemetry, device);

    if (conditionMet) {
      // Check if open alert already exists for this device+rule
      const existing = await Alert.findOne({
        where: {
          device_id: device.id,
          rule_id: rule.id,
          status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] },
        },
      });

      if (!existing) {
        const alert = await Alert.create({
          device_id: device.id,
          rule_id: rule.id,
          alert_type: rule.alert_type || rule.name.toLowerCase().replace(/\s+/g, '_'),
          severity: rule.severity,
          status: 'open',
          message: `${rule.name} on device ${device.uid} (${device.name || ''})`,
          voltage_at_alert: telemetry.voltage,
          current_at_alert: telemetry.current,
          power_at_alert: telemetry.real_power,
          detected_at: new Date(),
        });

        // Notification
        await Notification.create({
          type: 'alert',
          title: rule.name,
          message: `${rule.name} detected on ${device.uid} - ${device.name || ''}`,
          severity: rule.severity,
          ref_type: 'alert',
          ref_id: alert.id,
        });

        // Email
        if (rule.action_send_email && rule.email_recipients) {
          const recipients = rule.email_recipients.split(',').map(e => e.trim());
          await sendAlertEmail({ device, alert, recipients });
        }

        // Auto-create ticket
        if (rule.action_create_ticket) {
          const ticketNum = `TKT-${Date.now()}`;
          await MaintenanceTicket.create({
            ticket_number: ticketNum,
            device_id: device.id,
            alert_id: alert.id,
            title: `Auto: ${rule.name} - ${device.uid}`,
            description: `Automatically created from alert rule: ${rule.name} (Scope: ${rule.scope_type || 'global'})`,
            problem_type: rule.alert_type || 'fault',
            priority: rule.severity === 'critical' ? 'critical' : rule.severity === 'major' ? 'high' : 'medium',
            status: 'open',
          });
        }

        console.log(`[Alert] Created: ${rule.name} for ${device.uid}`);
      }
    } else {
      // Condition NOT met — check for auto-recovery
      const existingOpen = await Alert.findOne({
        where: {
          device_id: device.id,
          rule_id: rule.id,
          status: { [Op.in]: ['open', 'acknowledged'] },
          auto_recovered: false,
        },
      });

      if (existingOpen) {
        await existingOpen.update({
          status: 'auto_recovered',
          auto_recovered: true,
          resolved_at: new Date(),
          resolution_notes: 'Auto-recovered: condition cleared by telemetry',
        });

        await Notification.create({
          type: 'recovery',
          title: `Fault Recovered: ${rule.name}`,
          message: `${rule.name} auto-recovered on ${device.uid}`,
          severity: 'info',
          ref_type: 'alert',
          ref_id: existingOpen.id,
        });

        console.log(`[Alert] Auto-recovered: ${rule.name} for ${device.uid}`);
      }
    }
  }

  // ── LED Intelligent Fault Detection (runs after rule-based evaluation) ──────
  try {
    const ledVerdict = evaluateLEDFaults(device, telemetry);

    if (ledVerdict) {
      if (ledVerdict.isRecovery) {
        // Auto-recover any open LED fault alert for this device with that code
        const openLedAlert = await Alert.findOne({
          where: {
            device_id: device.id,
            alert_type: `led_fault_${ledVerdict.faultCode}`,
            status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] },
          },
        });
        if (openLedAlert) {
          await openLedAlert.update({
            status: 'auto_recovered',
            auto_recovered: true,
            resolved_at: new Date(),
            resolution_notes: `LED fault auto-recovered: ${ledVerdict.detail}`,
          });
          await Notification.create({
            type: 'recovery',
            title: `LED Fault Recovered [${ledVerdict.faultCode}]`,
            message: `${ledVerdict.faultCode} auto-recovered on ${device.uid} — normal operation restored`,
            severity: 'info',
            ref_type: 'alert',
            ref_id: openLedAlert.id,
          });
          console.log(`[Alert] LED fault auto-recovered: ${ledVerdict.faultCode} for ${device.uid}`);
        }
      } else {
        // Raise a new LED fault alert (only if not already open)
        const existingLedAlert = await Alert.findOne({
          where: {
            device_id: device.id,
            alert_type: `led_fault_${ledVerdict.faultCode}`,
            status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] },
          },
        });

        if (!existingLedAlert) {
          const ledAlert = await Alert.create({
            device_id: device.id,
            rule_id: null,
            alert_type: `led_fault_${ledVerdict.faultCode}`,
            severity: ledVerdict.severity,
            status: 'open',
            message: `[${ledVerdict.faultCode}] ${ledVerdict.faultName} on ${device.uid} (${device.name || ''}) — ${ledVerdict.detail}`,
            voltage_at_alert: parseFloat(telemetry.voltage) || null,
            current_at_alert: parseFloat(telemetry.current) || null,
            power_at_alert: parseFloat(telemetry.real_power) || null,
            detected_at: new Date(),
          });

          await Notification.create({
            type: 'alert',
            title: `LED Fault: ${ledVerdict.faultName} [${ledVerdict.faultCode}]`,
            message: `${ledVerdict.faultCode} detected on ${device.uid} — ${ledVerdict.detail}`,
            severity: ledVerdict.severity,
            ref_type: 'alert',
            ref_id: ledAlert.id,
          });

          // Auto-create maintenance ticket for critical LED faults
          if (ledVerdict.severity === 'critical' || ledVerdict.severity === 'major') {
            await MaintenanceTicket.create({
              ticket_number: `TKT-LED-${Date.now()}`,
              device_id: device.id,
              alert_id: ledAlert.id,
              title: `Auto: ${ledVerdict.faultCode} — ${ledVerdict.faultName} on ${device.uid}`,
              description: `LED fault automatically detected.\nFault Code: ${ledVerdict.faultCode}\nCategory: ${ledVerdict.faultName}\nDetail: ${ledVerdict.detail}`,
              problem_type: 'fault',
              priority: ledVerdict.severity === 'critical' ? 'critical' : 'high',
              status: 'open',
            });
          }

          console.log(`[Alert] LED fault raised: ${ledVerdict.faultCode} (${ledVerdict.severity}) for ${device.uid}`);
        }
      }
    }
  } catch (ledErr) {
    console.error(`[LED FAULT ENGINE ERROR]: ${ledErr.message}`);
  }
}

function evaluateCondition(rule, telemetry, device) {
  const fieldMap = {
    VOLTAGE: parseFloat(telemetry.voltage) || 0,
    CURRENT: parseFloat(telemetry.current) || 0,
    REALPOWER: parseFloat(telemetry.real_power) || 0,
    PF: parseFloat(telemetry.pf) || 0,
    FREQ: parseFloat(telemetry.frequency) || 0,
    KWH: parseFloat(telemetry.kwh) || 0,
    FAULT: parseInt(telemetry.fault) || 0,
    LIGHT_STATUS: parseInt(telemetry.light_status) || 0,
    OFFLINE: device.connectivity_status === 'offline' ? 1 : 0,
  };

  const value = fieldMap[rule.condition_field];
  if (value === undefined) return false;

  const threshold = parseFloat(rule.condition_value);
  switch (rule.condition_op) {
    case '<': return value < threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '>=': return value >= threshold;
    case '=': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}

export async function getAlertStats() {
  const [critical, major, warning, info, open, acknowledged] = await Promise.all([
    Alert.count({ where: { severity: 'critical', status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
    Alert.count({ where: { severity: 'major', status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
    Alert.count({ where: { severity: 'warning', status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
    Alert.count({ where: { severity: 'info', status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
    Alert.count({ where: { status: 'open' } }),
    Alert.count({ where: { status: 'acknowledged' } }),
  ]);

  return { critical, major, warning, info, open, acknowledged, total: critical + major + warning + info };
}
