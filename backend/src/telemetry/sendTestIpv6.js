/**
 * Test script to send a sample UDP telemetry packet over IPv6 to the CCMS UDP Server.
 * Run with: node src/telemetry/sendTestIpv6.js
 */
import dgram from 'dgram';
import dotenv from 'dotenv';
dotenv.config();

const UDP_PORT = parseInt(process.env.UDP_PORT) || 9001;
const TARGET_HOST = process.argv[2] || '::1'; // IPv6 loopback by default

const samplePayload = {
  UID: 'TS00000001',
  VOLTAGE: 231.5,
  CURRENT: 0.26,
  REALPOWER: 58.2,
  PF: 0.97,
  KWH: 124.85,
  RUNHR: 312.4,
  FREQ: 50.02,
  LIGHT_STATUS: 1,
  RELAY_STATUS: 1,
  FAULT: 0,
  DATALOG: 1042,
  TIMESTAMP: new Date().toISOString(),
};

const messageBuffer = Buffer.from(JSON.stringify(samplePayload));
const client = dgram.createSocket('udp6');

console.log(`\n🚀 [IPv6 TEST SENDER]`);
console.log(`Target      : [${TARGET_HOST}]:${UDP_PORT}`);
console.log(`Payload Size: ${messageBuffer.length} bytes`);
console.log(`Content     : ${JSON.stringify(samplePayload, null, 2)}\n`);

client.send(messageBuffer, 0, messageBuffer.length, UDP_PORT, TARGET_HOST, (err) => {
  if (err) {
    console.error(`❌ Failed to send IPv6 UDP packet: ${err.message}`);
  } else {
    console.log(`✅ IPv6 packet successfully dispatched to [${TARGET_HOST}]:${UDP_PORT}! Check your CCMS server terminal logs.`);
  }
  client.close();
  process.exit(0);
});

