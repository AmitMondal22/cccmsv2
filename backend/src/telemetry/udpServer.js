import dgram from 'dgram';
import dotenv from 'dotenv';
dotenv.config();
import { Device, DeviceLatestState, Telemetry } from '../models/index.js';
import { evaluateAlertRules } from '../services/alert.service.js';

const UDP_PORT = parseInt(process.env.UDP_PORT) || 9000;

// Map to track last connectivity check per device
const deviceCache = new Map();

export function startUDPServer() {
  // Create dual-stack UDP4 server (use udp6 for pure IPv6)
  const server = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  server.on('error', (err) => {
    console.error('[UDP] Server error:', err.message);
  });

  server.on('message', async (msg, rinfo) => {
    let raw;
    try {
      raw = msg.toString('utf8');
      const payload = JSON.parse(raw);
      await processTelemetry(payload, rinfo, raw);
    } catch (err) {
      console.error('[UDP] Processing error:', err.message, '| Raw:', raw?.substring(0, 100));
    }
  });

  server.on('listening', () => {
    const addr = server.address();
    console.log(`✅ UDP Telemetry server listening on ${addr.address}:${addr.port}`);
  });

  server.bind(UDP_PORT, '0.0.0.0');
  return server;
}

async function processTelemetry(payload, rinfo, raw) {
  // 1. Validate required fields
  if (!payload.UID) {
    console.warn('[UDP] Missing UID in payload');
    return;
  }

  // 2. Find device
  let device = deviceCache.get(payload.UID);
  if (!device) {
    device = await Device.findOne({ where: { uid: payload.UID } });
    if (!device) {
      console.warn(`[UDP] Unknown device UID: ${payload.UID}`);
      return;
    }
    deviceCache.set(payload.UID, device);
  }

  const now = new Date();
  const packetTs = payload.TIMESTAMP ? new Date(payload.TIMESTAMP) : now;

  // 3. Determine light status
  let lightStatus = 0;
  if (payload.LIGHT_STATUS !== undefined) {
    lightStatus = parseInt(payload.LIGHT_STATUS);
  } else {
    // Infer from current — configurable, mark as inferred
    lightStatus = (parseFloat(payload.CURRENT) || 0) > 0.05 ? 1 : 0;
  }

  // 4. Determine connectivity status from device thresholds
  const connectivityStatus = 'online'; // just received telemetry = online

  // 5. Update Device.last_seen + statuses
  await Device.update({
    last_seen: now,
    connectivity_status: connectivityStatus,
    light_status: lightStatus === 1 ? 'on' : 'off',
    health_status: payload.FAULT === 1 ? 'fault' : 'normal',
  }, { where: { id: device.id } });

  // 6. Upsert DeviceLatestState
  const [state, created] = await DeviceLatestState.findOrCreate({
    where: { device_id: device.id },
    defaults: { device_id: device.id },
  });

  const prevPacketsToday = state.packets_today || 0;
  const prevPacketsTotal = state.packets_total || 0;

  await state.update({
    voltage: parseFloat(payload.VOLTAGE) || 0,
    current: parseFloat(payload.CURRENT) || 0,
    real_power: parseFloat(payload.REALPOWER) || 0,
    pf: parseFloat(payload.PF) || 0,
    kwh: parseFloat(payload.KWH) || 0,
    run_hours: parseFloat(payload.RUNHR) || 0,
    frequency: parseFloat(payload.FREQ) || 50,
    light_status: lightStatus,
    relay_status: parseInt(payload.RELAY_STATUS) || lightStatus,
    fault: parseInt(payload.FAULT) || 0,
    packet_timestamp: packetTs,
    server_timestamp: now,
    ipv6_address: rinfo.address,
    packets_today: prevPacketsToday + 1,
    packets_total: prevPacketsTotal + 1,
    fault_count: (parseInt(payload.FAULT) || 0) === 1 ? (state.fault_count || 0) + 1 : (state.fault_count || 0),
    last_fault_at: (parseInt(payload.FAULT) || 0) === 1 ? now : state.last_fault_at,
  });

  // 7. Store Telemetry record
  const telemetryRecord = await Telemetry.create({
    device_id: device.id,
    uid: payload.UID,
    packet_timestamp: packetTs,
    server_timestamp: now,
    voltage: parseFloat(payload.VOLTAGE) || 0,
    current: parseFloat(payload.CURRENT) || 0,
    real_power: parseFloat(payload.REALPOWER) || 0,
    pf: parseFloat(payload.PF) || 0,
    kwh: parseFloat(payload.KWH) || 0,
    run_hours: parseFloat(payload.RUNHR) || 0,
    frequency: parseFloat(payload.FREQ) || 50,
    light_status: lightStatus,
    relay_status: parseInt(payload.RELAY_STATUS) || lightStatus,
    fault: parseInt(payload.FAULT) || 0,
    datalog: parseInt(payload.DATALOG) || 0,
    source_ip: rinfo.address,
    raw_payload: raw,
  });

  // 8. Evaluate alert rules
  try {
    // Reload device with fresh data
    const freshDevice = await Device.findByPk(device.id);
    await evaluateAlertRules(freshDevice, telemetryRecord);
  } catch (ruleErr) {
    console.error('[UDP] Alert rule evaluation error:', ruleErr.message);
  }

  console.log(`[UDP] ✅ ${payload.UID} | V:${payload.VOLTAGE} I:${payload.CURRENT} P:${payload.REALPOWER} L:${lightStatus}`);
}

/**
 * Background job: mark devices as offline based on last_seen threshold.
 * Run every 60 seconds.
 */
export function startOfflineDetector() {
  setInterval(async () => {
    try {
      const now = new Date();
      const devices = await Device.findAll({ where: { status: 'active' } });

      for (const device of devices) {
        if (!device.last_seen) {
          await device.update({ connectivity_status: 'offline' });
          continue;
        }

        const diffMs = now - new Date(device.last_seen);
        const diffMin = diffMs / 60000;
        const offlineThreshold = device.offline_threshold_minutes || 5;
        const warningThreshold = device.warning_threshold_minutes || 2;

        let newStatus = 'online';
        if (diffMin > offlineThreshold) newStatus = 'offline';
        else if (diffMin > warningThreshold) newStatus = 'warning';

        if (newStatus !== device.connectivity_status) {
          await device.update({ connectivity_status: newStatus });
          // Clear cache so next telemetry re-fetches fresh device
          deviceCache.delete(device.uid);

          if (newStatus === 'offline') {
            console.log(`[Offline Detector] ${device.uid} is now OFFLINE (last seen: ${diffMin.toFixed(1)} min ago)`);
          }
        }
      }
    } catch (err) {
      console.error('[Offline Detector] Error:', err.message);
    }
  }, 60 * 1000);
}
