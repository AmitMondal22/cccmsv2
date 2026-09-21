import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import {
  sequelize, Project, City, Zone, Ward, Street,
  Device, User, DeviceLatestState, AlertRule,
} from '../models/index.js';

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ DB connected and synced');

    // ── Project
    const [project] = await Project.findOrCreate({
      where: { code: 'MSL-001' },
      defaults: { name: 'Mumbai Smart Street Light Project', client: 'Mumbai Municipal Corporation', status: 'active' },
    });

    // ── City
    const [city] = await City.findOrCreate({
      where: { name: 'Mumbai', project_id: project.id },
      defaults: { state: 'Maharashtra', timezone: 'Asia/Kolkata', latitude: 19.0760, longitude: 72.8777 },
    });

    // ── Zones
    const zoneData = [
      { name: 'Zone 01', code: 'Z01' },
      { name: 'Zone 02', code: 'Z02' },
    ];
    const zones = [];
    for (const z of zoneData) {
      const [zone] = await Zone.findOrCreate({ where: { name: z.name, city_id: city.id }, defaults: { ...z, city_id: city.id } });
      zones.push(zone);
    }

    // ── Wards
    const wardData = [
      { name: 'Ward 101', number: '101', zone_id: zones[0].id },
      { name: 'Ward 102', number: '102', zone_id: zones[0].id },
      { name: 'Ward 201', number: '201', zone_id: zones[1].id },
      { name: 'Ward 202', number: '202', zone_id: zones[1].id },
    ];
    const wards = [];
    for (const w of wardData) {
      const [ward] = await Ward.findOrCreate({ where: { name: w.name, zone_id: w.zone_id }, defaults: w });
      wards.push(ward);
    }

    // ── Streets
    const streetData = [
      { name: 'MG Road', ward_id: wards[0].id },
      { name: 'Andheri East', ward_id: wards[0].id },
      { name: 'Marol', ward_id: wards[0].id },
      { name: 'Station Road', ward_id: wards[1].id },
      { name: 'Market Road', ward_id: wards[2].id },
      { name: 'Main Road', ward_id: wards[3].id },
    ];
    const streets = [];
    for (const s of streetData) {
      const [street] = await Street.findOrCreate({ where: { name: s.name, ward_id: s.ward_id }, defaults: s });
      streets.push(street);
    }

    // ── Devices (25 devices spread across streets)
    const deviceDefs = [
      { uid: 'TS00000001', name: 'SL-MUM-00001', street_id: streets[0].id, lat: 19.1197, lng: 72.8468, light: 'on', conn: 'online' },
      { uid: 'TS00000002', name: 'SL-MUM-00002', street_id: streets[0].id, lat: 19.1200, lng: 72.8470, light: 'on', conn: 'online' },
      { uid: 'TS00000003', name: 'SL-MUM-00003', street_id: streets[0].id, lat: 19.1203, lng: 72.8472, light: 'on', conn: 'online' },
      { uid: 'TS00000004', name: 'SL-MUM-00004', street_id: streets[0].id, lat: 19.1206, lng: 72.8474, light: 'off', conn: 'offline' },
      { uid: 'TS00000005', name: 'SL-MUM-00005', street_id: streets[1].id, lat: 19.1182, lng: 72.8459, light: 'on', conn: 'online' },
      { uid: 'TS00000006', name: 'SL-MUM-00006', street_id: streets[1].id, lat: 19.1185, lng: 72.8461, light: 'on', conn: 'online' },
      { uid: 'TS00000007', name: 'SL-MUM-00007', street_id: streets[1].id, lat: 19.1188, lng: 72.8463, light: 'on', conn: 'warning' },
      { uid: 'TS00000008', name: 'SL-MUM-00008', street_id: streets[2].id, lat: 19.1175, lng: 72.8450, light: 'on', conn: 'online' },
      { uid: 'TS00000009', name: 'SL-MUM-00009', street_id: streets[2].id, lat: 19.1178, lng: 72.8452, light: 'off', conn: 'offline' },
      { uid: 'TS00000010', name: 'SL-MUM-00010', street_id: streets[2].id, lat: 19.1181, lng: 72.8454, light: 'on', conn: 'online' },
      { uid: 'TS00000011', name: 'SL-MUM-00011', street_id: streets[3].id, lat: 19.1160, lng: 72.8440, light: 'on', conn: 'online' },
      { uid: 'TS00000012', name: 'SL-MUM-00012', street_id: streets[3].id, lat: 19.1163, lng: 72.8442, light: 'on', conn: 'online' },
      { uid: 'TS00000013', name: 'SL-MUM-00013', street_id: streets[3].id, lat: 19.1166, lng: 72.8444, light: 'on', conn: 'online' },
      { uid: 'TS00000014', name: 'SL-MUM-00014', street_id: streets[3].id, lat: 19.1169, lng: 72.8446, light: 'off', conn: 'offline' },
      { uid: 'TS00000015', name: 'SL-MUM-00015', street_id: streets[4].id, lat: 19.1145, lng: 72.8430, light: 'on', conn: 'online' },
      { uid: 'TS00000016', name: 'SL-MUM-00016', street_id: streets[4].id, lat: 19.1148, lng: 72.8432, light: 'on', conn: 'online' },
      { uid: 'TS00000017', name: 'SL-MUM-00017', street_id: streets[4].id, lat: 19.1151, lng: 72.8434, light: 'on', conn: 'online' },
      { uid: 'TS00000018', name: 'SL-MUM-00018', street_id: streets[4].id, lat: 19.1154, lng: 72.8436, light: 'on', conn: 'warning' },
      { uid: 'TS00000019', name: 'SL-MUM-00019', street_id: streets[5].id, lat: 19.1130, lng: 72.8420, light: 'on', conn: 'online' },
      { uid: 'TS00000020', name: 'SL-MUM-00020', street_id: streets[5].id, lat: 19.1133, lng: 72.8422, light: 'on', conn: 'online' },
      { uid: 'TS00000021', name: 'SL-MUM-00021', street_id: streets[5].id, lat: 19.1136, lng: 72.8424, light: 'off', conn: 'offline' },
      { uid: 'TS00000022', name: 'SL-MUM-00022', street_id: streets[0].id, lat: 19.1209, lng: 72.8476, light: 'on', conn: 'online' },
      { uid: 'TS00000023', name: 'SL-MUM-00023', street_id: streets[1].id, lat: 19.1191, lng: 72.8465, light: 'on', conn: 'online' },
      { uid: 'TS00000024', name: 'SL-MUM-00024', street_id: streets[2].id, lat: 19.1184, lng: 72.8456, light: 'on', conn: 'online' },
      { uid: 'TS00000025', name: 'SL-MUM-00025', street_id: streets[3].id, lat: 19.1172, lng: 72.8448, light: 'on', conn: 'online' },
    ];

    const devices = [];
    for (const d of deviceDefs) {
      const [device] = await Device.findOrCreate({
        where: { uid: d.uid },
        defaults: {
          name: d.name,
          serial_number: `SN-${d.uid}`,
          street_id: d.street_id,
          latitude: d.lat,
          longitude: d.lng,
          installation_date: '2025-01-15',
          device_model: 'TLX-3000',
          firmware_version: '1.2.5',
          rated_voltage: 230,
          rated_power: 40,
          status: 'active',
          connectivity_status: d.conn,
          light_status: d.light,
          health_status: d.conn === 'offline' ? 'fault' : 'normal',
          last_seen: d.conn === 'offline' ? new Date(Date.now() - 15 * 60000) : new Date(Date.now() - Math.random() * 60000),
        },
      });

      // Create latest state
      const voltage = d.conn === 'offline' ? 0 : (240 + Math.random() * 20 - 10);
      const current = d.light === 'on' ? (0.18 + Math.random() * 0.12) : 0;
      const power = current * voltage;

      await DeviceLatestState.findOrCreate({
        where: { device_id: device.id },
        defaults: {
          device_id: device.id,
          voltage: d.conn === 'offline' ? 0 : parseFloat(voltage.toFixed(2)),
          current: parseFloat(current.toFixed(4)),
          real_power: parseFloat(power.toFixed(4)),
          pf: d.light === 'on' ? 0.85 + Math.random() * 0.1 : 0,
          kwh: parseFloat((Math.random() * 5).toFixed(4)),
          run_hours: parseFloat((Math.random() * 12).toFixed(2)),
          frequency: 50.00,
          light_status: d.light === 'on' ? 1 : 0,
          relay_status: d.light === 'on' ? 1 : 0,
          fault: d.conn === 'offline' ? 1 : 0,
          packet_timestamp: new Date(),
          server_timestamp: new Date(),
          packets_today: Math.floor(Math.random() * 1440),
          packets_total: Math.floor(Math.random() * 50000),
        },
      });

      devices.push(device);
    }

    // ── Super Admin User
    const hash = await bcrypt.hash('Admin@123', 10);
    await User.findOrCreate({
      where: { email: 'admin@techavo.com' },
      defaults: {
        name: 'Super Administrator',
        email: 'admin@techavo.com',
        password_hash: hash,
        role: 'super_admin',
        scope_type: 'global',
        is_active: true,
      },
    });

    // ── Technician user
    const techHash = await bcrypt.hash('Tech@123', 10);
    await User.findOrCreate({
      where: { email: 'tech@techavo.com' },
      defaults: {
        name: 'Raj Kumar',
        email: 'tech@techavo.com',
        password_hash: techHash,
        role: 'maintenance_user',
        scope_type: 'ward',
        scope_id: wards[0].id,
        is_active: true,
      },
    });

    // ── Default Alert Rules
    const rules = [
      { name: 'Device Offline', condition_field: 'OFFLINE', condition_op: '=', condition_value: 1, severity: 'critical', alert_type: 'device_offline' },
      { name: 'Over Voltage', condition_field: 'VOLTAGE', condition_op: '>', condition_value: 260, severity: 'major', alert_type: 'over_voltage' },
      { name: 'Under Voltage', condition_field: 'VOLTAGE', condition_op: '<', condition_value: 190, severity: 'major', alert_type: 'under_voltage' },
      { name: 'Zero Current (Light ON)', condition_field: 'CURRENT', condition_op: '<', condition_value: 0.05, severity: 'major', alert_type: 'zero_current' },
      { name: 'Over Current', condition_field: 'CURRENT', condition_op: '>', condition_value: 2, severity: 'critical', alert_type: 'over_current' },
      { name: 'Low Power Factor', condition_field: 'PF', condition_op: '<', condition_value: 0.7, severity: 'warning', alert_type: 'low_pf' },
      { name: 'Frequency Abnormal', condition_field: 'FREQ', condition_op: '<', condition_value: 48, severity: 'warning', alert_type: 'freq_abnormal' },
      { name: 'Device Fault Flag', condition_field: 'FAULT', condition_op: '=', condition_value: 1, severity: 'major', alert_type: 'device_fault' },
    ];

    for (const r of rules) {
      await AlertRule.findOrCreate({
        where: { name: r.name },
        defaults: { ...r, project_id: project.id, scope_type: 'global', action_create_alert: true, is_active: true },
      });
    }

    console.log('✅ Seed complete!');
    console.log('');
    console.log('📧 Super Admin:  admin@techavo.com  /  Admin@123');
    console.log('🔧 Technician:   tech@techavo.com   /  Tech@123');
    console.log(`📦 Devices seeded: ${devices.length}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
