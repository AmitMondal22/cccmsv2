import dgram from 'dgram';
import dotenv from 'dotenv';
dotenv.config();
import { Device, DeviceLatestState, Telemetry } from '../models/index.js';
import { evaluateAlertRules } from '../services/alert.service.js';

const UDP_PORT = parseInt(process.env.UDP_PORT) || 9001;

// Map to track last connectivity check per device
const deviceCache = new Map();

export function startUDPServer() {
  const server = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  server.on('error', (err) => {
    console.error(`\n🚨 [UDP SERVER ERROR] ${new Date().toISOString()}:`, err.message);
  });

  server.on('message', async (msg, rinfo) => {
    const raw = msg.toString('utf8');
    const timestamp = new Date().toISOString();

    console.log(`\n📡 ════════════════ [UDP PACKET RECEIVED] ════════════════`);
    console.log(`⏱️  Timestamp: ${timestamp}`);
    console.log(`🌐 From:      ${rinfo.address}:${rinfo.port} (${rinfo.size} bytes)`);
    console.log(`📄 Raw Data:  ${raw}`);

    try {
      const payload = JSON.parse(raw);
      console.log(`📦 Parsed Payload:`, JSON.stringify(payload, null, 2));

      await processTelemetry(payload, rinfo, raw);
    } catch (err) {
      console.error(`❌ [UDP PARSE/PROCESS ERROR]: ${err.message}`);
      console.error(`   Raw Content: ${raw}`);
    }
    console.log(`═══════════════════════════════════════════════════════════\n`);
  });

  server.on('listening', () => {
    const addr = server.address();
    console.log(`\n🚀 [UDP SERVER READY] Listening for telemetry on ${addr.address}:${addr.port}`);
    console.log(`💡 Expected JSON Format: {"UID":"TS00000001","VOLTAGE":238.5,"CURRENT":0.26,"REALPOWER":62.0,"PF":0.94,"KWH":14.85,"RUNHR":48.5,"FREQ":50.0,"LIGHT_STATUS":1,"FAULT":0}\n`);
  });

  server.bind(UDP_PORT, '0.0.0.0');
  return server;
}

async function processTelemetry(payload, rinfo, raw) {
  // 1. Validate required fields
  if (!payload.UID) {
    console.warn(`⚠️ [UDP REJECTED] Missing 'UID' field in telemetry payload`);
    return;
  }

  // 2. Find device
  let device = deviceCache.get(payload.UID);
  if (!device) {
    device = await Device.findOne({ where: { uid: payload.UID } });
    if (!device) {
      console.warn(`⚠️ [UDP UNKNOWN DEVICE] Device UID '${payload.UID}' not registered in database!`);
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
    lightStatus = (parseFloat(payload.CURRENT) || 0) > 0.05 ? 1 : 0;
  }

  const connectivityStatus = 'online';

  // 4. Update Device.last_seen + statuses
  await Device.update({
    last_seen: now,
    connectivity_status: connectivityStatus,
    light_status: lightStatus === 1 ? 'on' : 'off',
    health_status: parseInt(payload.FAULT) === 1 ? 'fault' : 'normal',
  }, { where: { id: device.id } });

  // 5. Upsert DeviceLatestState
  const [state] = await DeviceLatestState.findOrCreate({
    where: { device_id: device.id },
    defaults: { device_id: device.id },
  });

  const prevPacketsToday = state.packets_today || 0;
  const prevPacketsTotal = state.packets_total || 0;

  const voltage = parseFloat(payload.VOLTAGE) || 0;
  const current = parseFloat(payload.CURRENT) || 0;
  const realPower = parseFloat(payload.REALPOWER) || (voltage * current);
  const pf = parseFloat(payload.PF) || (lightStatus === 1 ? 0.92 : 0);
  const kwh = parseFloat(payload.KWH) || state.kwh || 0;
  const runHours = parseFloat(payload.RUNHR) || state.run_hours || 0;
  const frequency = parseFloat(payload.FREQ) || 50.0;
  const fault = parseInt(payload.FAULT) || 0;
  const relayStatus = payload.RELAY_STATUS !== undefined ? parseInt(payload.RELAY_STATUS) : lightStatus;

  await state.update({
    voltage,
    current,
    real_power: realPower,
    pf,
    kwh,
    run_hours: runHours,
    frequency,
    light_status: lightStatus,
    relay_status: relayStatus,
    fault,
    packet_timestamp: packetTs,
    server_timestamp: now,
    ipv6_address: rinfo.address,
    packets_today: prevPacketsToday + 1,
    packets_total: prevPacketsTotal + 1,
    fault_count: fault === 1 ? (state.fault_count || 0) + 1 : (state.fault_count || 0),
    last_fault_at: fault === 1 ? now : state.last_fault_at,
  });

  // 6. Store Telemetry record
  const telemetryRecord = await Telemetry.create({
    device_id: device.id,
    uid: payload.UID,
    packet_timestamp: packetTs,
    server_timestamp: now,
    voltage,
    current,
    real_power: realPower,
    pf,
    kwh,
    run_hours: runHours,
    frequency,
    light_status: lightStatus,
    relay_status: relayStatus,
    fault,
    datalog: parseInt(payload.DATALOG) || 0,
    source_ip: rinfo.address,
    raw_payload: raw,
  });

  // 7. Evaluate alert rules
  let triggeredAlerts = [];
  try {
    const freshDevice = await Device.findByPk(device.id);
    triggeredAlerts = (await evaluateAlertRules(freshDevice, telemetryRecord)) || [];
  } catch (ruleErr) {
    console.error(`⚠️ [UDP ALERT EVAL ERROR]:`, ruleErr.message);
  }

  // 8. Detailed console logging
  console.log(`✅ [UDP PROCESSED & SAVED IN DB]`);
  console.log(`   🏷️  Device UID:    ${payload.UID} (${device.name})`);
  console.log(`   ⚡ Voltage:       ${voltage.toFixed(2)} V`);
  console.log(`   🔌 Current:       ${current.toFixed(4)} A`);
  console.log(`   💡 Real Power:    ${realPower.toFixed(2)} W`);
  console.log(`   📐 Power Factor:  ${pf.toFixed(2)}`);
  console.log(`   🔋 Energy (kWh):  ${kwh.toFixed(4)} kWh`);
  console.log(`   ⏱️  Run Hours:     ${runHours.toFixed(2)} hrs`);
  console.log(`   💡 Light State:   ${lightStatus === 1 ? 'ON 🟢' : 'OFF ⚪'}`);
  console.log(`   🛡️ Health Status: ${fault === 1 ? 'FAULT 🔴' : 'NORMAL 🟢'}`);
  if (triggeredAlerts.length > 0) {
    console.log(`   🔔 Alerts Created: ${triggeredAlerts.length} alert(s) triggered!`);
  }
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
          deviceCache.delete(device.uid);

          if (newStatus === 'offline') {
            console.log(`⚠️ [OFFLINE DETECTOR] ${device.uid} (${device.name}) is now OFFLINE (last seen: ${diffMin.toFixed(1)} min ago)`);
          }
        }
      }
    } catch (err) {
      console.error('[OFFLINE DETECTOR ERROR]:', err.message);
    }
  }, 60 * 1000);
}
