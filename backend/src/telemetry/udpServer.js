import dgram from 'dgram';
import dotenv from 'dotenv';
dotenv.config();
import { Device, DeviceLatestState, Telemetry } from '../models/index.js';
import { evaluateAlertRules } from '../services/alert.service.js';

// ─── ANSI colour helpers ──────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
  bgCyan:  '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
};

function istNow() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' IST';
}

/** Normalize an IPv6-mapped IPv4 address to plain IPv4 for display */
function normalizeAddr(addr) {
  if (addr && addr.startsWith('::ffff:')) return addr.slice(7);
  return addr || 'unknown';
}

/** Print a coloured banner header for each received packet. */
function printPacketHeader(rinfo, packetNo) {
  const sender = `${normalizeAddr(rinfo.address)}:${rinfo.port}`;
  const time   = istNow();
  console.log(`\n${C.cyan}${'─'.repeat(62)}${C.reset}`);
  console.log(
    `${C.bold}${C.cyan} 📡 UDP PACKET #${packetNo}${C.reset}` +
    `  ${C.dim}${time}${C.reset}` +
    `  ${C.yellow}from ${sender}${C.reset}`
  );
  console.log(`${C.cyan}${'─'.repeat(62)}${C.reset}`);
}

/** Print the raw bytes received (hex + UTF-8 preview). */
function printRaw(buf) {
  const utf8 = buf.toString('utf8').trim();
  console.log(`${C.dim} RAW (${buf.length} bytes):${C.reset}`);
  console.log(`  ${C.white}${utf8}${C.reset}`);
}

/** Print a pretty aligned telemetry table. */
function printTelemetryTable(t) {
  const rows = [
    ['UID',       t.UID,                              'device identifier'],
    ['VOLTAGE',   `${Number(t.VOLTAGE).toFixed(2)} V`, 'line voltage'],
    ['CURRENT',   `${Number(t.CURRENT).toFixed(4)} A`, 'line current'],
    ['REALPOWER', `${Number(t.REALPOWER).toFixed(2)} W`,'real power'],
    ['PF',        Number(t.PF || 0).toFixed(2),        'power factor'],
    ['KWH',       `${Number(t.KWH || 0).toFixed(4)} kWh`, 'cumulative energy'],
    ['RUNHR',     `${Number(t.RUNHR || 0).toFixed(2)} hr`, 'running hours'],
    ['FREQ',      `${Number(t.FREQ || 50).toFixed(2)} Hz`, 'grid frequency'],
    ['LIGHT',     t.LIGHT_STATUS === 1 ? 'ON 🟢' : 'OFF ⚪', 'luminaire status'],
    ['FAULT',     t.FAULT === 1 ? 'FAULT 🔴' : 'NORMAL 🟢', 'device diagnostic'],
    ['DATALOG',   `#${t.DATALOG || 0}`,               'packet sequence'],
  ];

  console.log(`${C.bold}${C.green} ┌──────────────────────────────────────────┐${C.reset}`);
  console.log(`${C.bold}${C.green} │  TELEMETRY DATA                          │${C.reset}`);
  console.log(`${C.bold}${C.green} ├────────────┬──────────────┬──────────────┤${C.reset}`);
  console.log(`${C.bold}${C.green} │ Field      │ Value        │ Description  │${C.reset}`);
  console.log(`${C.bold}${C.green} ├────────────┼──────────────┼──────────────┤${C.reset}`);

  for (const [field, value, desc] of rows) {
    const f = String(field).padEnd(10);
    const v = String(value).padEnd(12);
    const d = String(desc).padEnd(12);
    const colour = field === 'UID' ? C.bold + C.cyan : C.white;
    console.log(
      `${C.green} │${C.reset} ${colour}${f}${C.reset} ${C.green}│${C.reset} ${C.yellow}${v}${C.reset} ${C.green}│${C.reset} ${C.dim}${d}${C.reset} ${C.green}│${C.reset}`
    );
  }
  console.log(`${C.bold}${C.green} └────────────┴──────────────┴──────────────┘${C.reset}`);
}

/** Print validation result. */
function printValidation(ok, details = []) {
  if (ok) {
    console.log(` ${C.bgGreen}${C.bold} ✓ VALIDATION PASSED ${C.reset}  packet accepted`);
  } else {
    console.log(` ${C.bgRed}${C.bold} ✗ VALIDATION FAILED ${C.reset}  packet dropped`);
    details.forEach((d) => console.log(`   ${C.red}• ${d}${C.reset}`));
  }
}

/** Print storage results. */
function printStorageStatus(telemetryOk, pgOk, isNew) {
  const teleMark = telemetryOk ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const pgMark   = pgOk        ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const regLabel = isNew       ? `${C.magenta}[NEW DEVICE REGISTERED]${C.reset}` : '';
  console.log(` ${C.bold}STORED:${C.reset}  Telemetry Table ${teleMark}  PostgreSQL State ${pgMark}  ${regLabel}`);
}

/**
 * Parse and sanitize raw UDP packet strings from IoT hardware devices.
 * Handles hardware firmware glitches:
 *  - Trailing stray quotes on numeric values (e.g. "DATALOG":1"} -> "DATALOG":1})
 *  - Stray trailing commas before closing braces (, } -> })
 *  - Null bytes, non-printable control chars, UTF-8 BOM
 *  - Framing prefixes/suffixes around JSON braces
 */
function parseAndSanitizePacket(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    // Continue to sanitization
  }

  // 1. Remove null bytes and UTF-8 BOM
  let clean = raw.replace(/\0/g, '').replace(/^\uFEFF/, '').trim();

  // 2. Extract content between outermost '{' and '}'
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  // 3. Fix stray quote on numeric values (e.g. "DATALOG":1"} or "DATALOG": 1",)
  clean = clean.replace(/:\s*(-?\d+(?:\.\d+)?)"\s*([,}])/g, ': $1$2');

  // 4. Fix stray trailing comma before closing brace or bracket
  clean = clean.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(clean);
}

/**
 * Uppercase all payload keys to tolerate firmware variations (e.g. uid -> UID).
 */
function normalizeTelemetryKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.toUpperCase()] = v;
  }
  return out;
}

/**
 * Validate incoming normalized telemetry payload.
 */
function validateTelemetry(p) {
  const errors = [];
  if (!p.UID || typeof p.UID !== 'string' || p.UID.trim().length === 0) {
    errors.push('UID is required and must be a non-empty string');
  }

  const v = parseFloat(p.VOLTAGE);
  if (p.VOLTAGE !== undefined && (isNaN(v) || v < 0 || v > 600)) {
    errors.push('VOLTAGE must be a valid number between 0 and 600V');
  }

  const i = parseFloat(p.CURRENT);
  if (p.CURRENT !== undefined && (isNaN(i) || i < 0 || i > 500)) {
    errors.push('CURRENT must be a valid number between 0 and 500A');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      UID: String(p.UID).trim(),
      VOLTAGE: !isNaN(v) ? v : 0,
      CURRENT: !isNaN(i) ? i : 0,
      REALPOWER: !isNaN(parseFloat(p.REALPOWER)) ? parseFloat(p.REALPOWER) : ((!isNaN(v) ? v : 0) * (!isNaN(i) ? i : 0)),
      PF: !isNaN(parseFloat(p.PF)) ? parseFloat(p.PF) : 0,
      KWH: !isNaN(parseFloat(p.KWH)) ? parseFloat(p.KWH) : 0,
      RUNHR: !isNaN(parseFloat(p.RUNHR)) ? parseFloat(p.RUNHR) : 0,
      FREQ: !isNaN(parseFloat(p.FREQ)) ? parseFloat(p.FREQ) : 50.0,
      LIGHT_STATUS: p.LIGHT_STATUS !== undefined ? parseInt(p.LIGHT_STATUS) : ((!isNaN(i) ? i : 0) > 0.05 ? 1 : 0),
      RELAY_STATUS: p.RELAY_STATUS !== undefined ? parseInt(p.RELAY_STATUS) : (p.LIGHT_STATUS !== undefined ? parseInt(p.LIGHT_STATUS) : 0),
      FAULT: parseInt(p.FAULT) || 0,
      DATALOG: parseInt(p.DATALOG) || 0,
      TIMESTAMP: p.TIMESTAMP || null,
    },
  };
}

// ─── State ────────────────────────────────────────────────────────────────────
let udpSocket = null;
let packetNo  = 0;
const deviceCache = new Map();

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Start the IPv6 dual-stack UDP server (listens on :: so it accepts both IPv4 and IPv6).
 */
export function startUDPServer(fastifyInstance = null) {
  const UDP_PORT = parseInt(process.env.UDP_PORT) || 9001;

  // Dual-stack IPv6 socket (ipv6Only: false accepts IPv4 via ::ffff:x.x.x.x)
  udpSocket = dgram.createSocket({ type: 'udp6', ipv6Only: false });

  udpSocket.on('error', (err) => {
    console.error(`\n${C.red}[UDP ERROR]${C.reset} ${err.message}`);
    if (fastifyInstance) fastifyInstance.log.error({ err }, 'UDP socket error');
  });

  udpSocket.on('message', async (msg, rinfo) => {
    packetNo++;
    const raw = msg.toString('utf8').trim();

    // ── Print header + raw ────────────────────────────────────────────────
    printPacketHeader(rinfo, packetNo);
    printRaw(msg);

    // ── 1. Parse & Sanitize JSON ──────────────────────────────────────────
    let packet;
    try {
      packet = parseAndSanitizePacket(raw);
    } catch {
      console.log(` ${C.bgRed}${C.bold} ✗ INVALID JSON ${C.reset}  packet dropped\n`);
      return;
    }

    const normalizedPacket = normalizeTelemetryKeys(packet);

    // ── 2. Validation ─────────────────────────────────────────────────────
    const validation = validateTelemetry(normalizedPacket);
    if (!validation.isValid) {
      printValidation(false, validation.errors);
      console.log();
      return;
    }

    const telemetry = validation.data;
    printTelemetryTable(telemetry);
    printValidation(true, []);

    // ── 3. Find / Upsert Device & PostgreSQL State ────────────────────────
    let pgOk = false;
    let telemetryOk = false;
    let isNew = false;
    let device = deviceCache.get(telemetry.UID);

    try {
      const now = new Date();
      const packetTs = telemetry.TIMESTAMP ? new Date(telemetry.TIMESTAMP) : now;

      if (!device) {
        device = await Device.findOne({ where: { uid: telemetry.UID } });
        if (!device) {
          // Auto-register newly discovered device on the network
          device = await Device.create({
            uid: telemetry.UID,
            name: `StreetLight-${telemetry.UID}`,
            serial_number: `SN-${telemetry.UID}`,
            device_model: 'TLX-3000',
            firmware_version: '2.1.0',
            rated_voltage: 230,
            rated_power: 60,
            status: 'active',
            connectivity_status: 'online',
            light_status: telemetry.LIGHT_STATUS === 1 ? 'on' : 'off',
            health_status: telemetry.FAULT === 1 ? 'fault' : 'normal',
            last_seen: now,
          });
          isNew = true;
        }
        deviceCache.set(telemetry.UID, device);
      }

      // Update Device status & last_seen
      await device.update({
        last_seen: now,
        connectivity_status: 'online',
        light_status: telemetry.LIGHT_STATUS === 1 ? 'on' : 'off',
        health_status: telemetry.FAULT === 1 ? 'fault' : 'normal',
      });

      // Upsert DeviceLatestState
      const [state] = await DeviceLatestState.findOrCreate({
        where: { device_id: device.id },
        defaults: { device_id: device.id },
      });

      const prevPacketsToday = state.packets_today || 0;
      const prevPacketsTotal = state.packets_total || 0;

      await state.update({
        voltage: telemetry.VOLTAGE,
        current: telemetry.CURRENT,
        real_power: telemetry.REALPOWER,
        pf: telemetry.PF,
        kwh: telemetry.KWH,
        run_hours: telemetry.RUNHR,
        frequency: telemetry.FREQ,
        light_status: telemetry.LIGHT_STATUS,
        relay_status: telemetry.RELAY_STATUS,
        fault: telemetry.FAULT,
        packet_timestamp: packetTs,
        server_timestamp: now,
        ipv6_address: normalizeAddr(rinfo.address),
        packets_today: prevPacketsToday + 1,
        packets_total: prevPacketsTotal + 1,
        fault_count: telemetry.FAULT === 1 ? (state.fault_count || 0) + 1 : (state.fault_count || 0),
        last_fault_at: telemetry.FAULT === 1 ? now : state.last_fault_at,
      });

      pgOk = true;

      // ── 4. Store in Telemetry Table ─────────────────────────────────────
      const telemetryRecord = await Telemetry.create({
        device_id: device.id,
        uid: telemetry.UID,
        packet_timestamp: packetTs,
        server_timestamp: now,
        voltage: telemetry.VOLTAGE,
        current: telemetry.CURRENT,
        real_power: telemetry.REALPOWER,
        pf: telemetry.PF,
        kwh: telemetry.KWH,
        run_hours: telemetry.RUNHR,
        frequency: telemetry.FREQ,
        light_status: telemetry.LIGHT_STATUS,
        relay_status: telemetry.RELAY_STATUS,
        fault: telemetry.FAULT,
        datalog: telemetry.DATALOG,
        source_ip: normalizeAddr(rinfo.address),
        raw_payload: raw,
      });

      telemetryOk = true;

      // ── 5. Evaluate Alert Rules ─────────────────────────────────────────
      try {
        const freshDevice = await Device.findByPk(device.id);
        await evaluateAlertRules(freshDevice, telemetryRecord);
      } catch (alertErr) {
        console.error(`⚠️ [ALERT EVALUATION ERROR]: ${alertErr.message}`);
      }

    } catch (err) {
      console.error(`❌ [POSTGRESQL STORAGE ERROR]: ${err.message}`);
    }

    printStorageStatus(telemetryOk, pgOk, isNew);
    console.log(); // Blank line between packets
  });

  // ── Listening Banner ──────────────────────────────────────────────────────
  udpSocket.on('listening', () => {
    const addr = udpSocket.address();
    console.log(`\n${C.bold}${C.cyan}${'═'.repeat(62)}${C.reset}`);
    console.log(`${C.bold}${C.cyan}  📡  CCMS UDP TELEMETRY SERVER STARTED${C.reset}`);
    console.log(`${C.bold}${C.cyan}${'═'.repeat(62)}${C.reset}`);
    console.log(`  ${C.bold}Bind Address :${C.reset} ${C.yellow}${addr.address}${C.reset}`);
    console.log(`  ${C.bold}Port         :${C.reset} ${C.yellow}${addr.port}${C.reset}`);
    console.log(`  ${C.bold}Socket Type  :${C.reset} ${C.yellow}udp6 (dual-stack IPv4+IPv6)${C.reset}`);
    console.log(`  ${C.bold}IPv6 Only    :${C.reset} ${C.yellow}false (accepts ::ffff: mapped IPv4)${C.reset}`);
    console.log(`  ${C.bold}ACK Sending  :${C.reset} ${C.yellow}Disabled (stopped per configuration)${C.reset}`);
    console.log(`  ${C.bold}Timezone     :${C.reset} ${C.dim}Asia/Kolkata (IST)${C.reset}`);
    console.log(`${C.bold}${C.cyan}${'═'.repeat(62)}${C.reset}\n`);
  });

  // Bind to :: (all IPv6 interfaces with ipv6Only:false accepts both IPv4 and IPv6)
  udpSocket.bind({
    port: UDP_PORT,
    address: '::',
  });

  return udpSocket;
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

/**
 * Gracefully close the UDP socket.
 */
export async function stopUDPServer() {
  return new Promise((resolve) => {
    if (!udpSocket) return resolve();
    udpSocket.close(() => {
      console.log(`${C.yellow}[UDP] Socket closed${C.reset}`);
      resolve();
    });
  });
}
