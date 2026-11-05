import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import {
  sequelize, Project, City, Zone, Ward, Street,
  Device, User, DeviceLatestState, Telemetry, AlertRule, Alert,
  MaintenanceTicket, Notification, AuditLog,
  CCMS, DCU, CcmsTelemetry,
} from '../models/index.js';

async function seed() {
  try {
    await sequelize.authenticate();
    // Add columns if not already present
    await sequelize.query(`
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS phase VARCHAR(10);
      ALTER TABLE ccms ADD COLUMN IF NOT EXISTS phase_r_state BOOLEAN DEFAULT true;
      ALTER TABLE ccms ADD COLUMN IF NOT EXISTS phase_y_state BOOLEAN DEFAULT true;
      ALTER TABLE ccms ADD COLUMN IF NOT EXISTS phase_b_state BOOLEAN DEFAULT true;
      ALTER TABLE ccms ADD COLUMN IF NOT EXISTS energy_rate_kwh NUMERIC(8,2) DEFAULT 8.50;
      ALTER TABLE ccms ADD COLUMN IF NOT EXISTS billing_start_day INTEGER DEFAULT 1;
    `);
    await sequelize.sync({ alter: false });
    console.log('✅ DB connected and verified');

    // ── Clean up existing old test data
    console.log('🧹 Cleaning old test data & telemetry...');
    await CcmsTelemetry.destroy({ where: {} });
    await Telemetry.destroy({ where: {} });
    await MaintenanceTicket.destroy({ where: {} });
    await Alert.destroy({ where: {} });
    await DeviceLatestState.destroy({ where: {} });
    await Device.destroy({ where: {} });
    await DCU.destroy({ where: {} });
    await CCMS.destroy({ where: {} });
    await Street.destroy({ where: {} });
    await Ward.destroy({ where: {} });
    await Zone.destroy({ where: {} });
    await City.destroy({ where: {} });
    await Project.destroy({ where: {} });

    // ── Project (Kolkata Municipal Corporation)
    const project = await Project.create({
      name: 'Kolkata Smart Street Light Project',
      code: 'KOL-001',
      client: 'Kolkata Municipal Corporation (KMC)',
      status: 'active',
    });

    // ── City (Kolkata)
    const city = await City.create({
      name: 'Kolkata',
      state: 'West Bengal',
      timezone: 'Asia/Kolkata',
      latitude: 22.5726,
      longitude: 88.3639,
      project_id: project.id,
    });

    // ── Zones
    const centralZone = await Zone.create({
      name: 'Central Kolkata',
      code: 'Z-CENTRAL',
      city_id: city.id,
    });

    const southZone = await Zone.create({
      name: 'South Kolkata',
      code: 'Z-SOUTH',
      city_id: city.id,
    });

    const eastZone = await Zone.create({
      name: 'Salt Lake / East',
      code: 'Z-EAST',
      city_id: city.id,
    });

    const northZone = await Zone.create({
      name: 'North Kolkata',
      code: 'Z-NORTH',
      city_id: city.id,
    });

    // ── Wards
    const ward63 = await Ward.create({
      name: 'Ward 63 (Park Street)',
      number: '63',
      zone_id: centralZone.id,
    });

    const ward70 = await Ward.create({
      name: 'Ward 70 (Bhowanipore)',
      number: '70',
      zone_id: southZone.id,
    });

    const ward31 = await Ward.create({
      name: 'Ward 31 (Salt Lake Sector V)',
      number: '31',
      zone_id: eastZone.id,
    });

    const ward05 = await Ward.create({
      name: 'Ward 05 (Shyambazar)',
      number: '05',
      zone_id: northZone.id,
    });

    // ── Streets
    const parkStreet = await Street.create({
      name: 'Park Street (Mother Teresa Sarani)',
      ward_id: ward63.id,
    });

    const camacStreet = await Street.create({
      name: 'Camac Street (Abanindranath Tagore Sarani)',
      ward_id: ward63.id,
    });

    const chowringheeRoad = await Street.create({
      name: 'Chowringhee Road (Jawaharlal Nehru Road)',
      ward_id: ward63.id,
    });

    const sectorVStreet = await Street.create({
      name: 'Sector V Ring Road',
      ward_id: ward31.id,
    });

    const shyambazarStreet = await Street.create({
      name: 'Bhupen Bose Avenue',
      ward_id: ward05.id,
    });

    // ═════════════════════════════════════════════════════════════════
    // HIERARCHY A: NORMAL MONITORING DEVICES (City -> Zone -> Ward -> Street -> Device)
    // ═════════════════════════════════════════════════════════════════
    console.log('💡  Creating Hierarchy A: Normal Street Devices (Without CCMS/DCU)...');

    const dev1 = await Device.create({
      uid: 'TS00000001',
      name: 'SL-KOL-NORMAL-001',
      serial_number: 'SN-TS00000001',
      street_id: parkStreet.id,
      dcu_id: null,
      phase: null,
      latitude: 22.5535,
      longitude: 88.3518,
      installation_date: '2025-01-15',
      device_model: 'TLX-3000-KOL',
      firmware_version: '2.1.0',
      rated_voltage: 230,
      rated_power: 60,
      status: 'active',
      connectivity_status: 'online',
      light_status: 'on',
      health_status: 'normal',
      last_seen: new Date(),
    });

    await DeviceLatestState.create({
      device_id: dev1.id,
      voltage: 231.2, current: 0.26, real_power: 58.5, pf: 0.96, kwh: 78.4,
      run_hours: 620, frequency: 50.00, light_status: 1, relay_status: 1,
      fault: 0, packets_today: 95, packets_total: 6200,
    });

    const dev2 = await Device.create({
      uid: 'TS00000002',
      name: 'SL-KOL-NORMAL-002',
      serial_number: 'SN-TS00000002',
      street_id: camacStreet.id,
      dcu_id: null,
      phase: null,
      latitude: 22.5510,
      longitude: 88.3530,
      installation_date: '2025-01-15',
      device_model: 'TLX-3000-KOL',
      firmware_version: '2.1.0',
      rated_voltage: 230,
      rated_power: 60,
      status: 'active',
      connectivity_status: 'offline',
      light_status: 'off',
      health_status: 'warning',
      last_seen: new Date(Date.now() - 3600 * 1000 * 4),
    });

    await DeviceLatestState.create({
      device_id: dev2.id,
      voltage: 0, current: 0, real_power: 0, pf: 0, kwh: 45.1,
      run_hours: 380, frequency: 50.00, light_status: 0, relay_status: 0,
      fault: 0, packets_today: 10, packets_total: 3800,
    });

    // ═════════════════════════════════════════════════════════════════
    // HIERARCHY B: CCMS CONTROLLED NETWORK (City -> Zone -> Ward -> CCMS -> DCU -> Devices 01..50 with Phase R/Y/B)
    // ═════════════════════════════════════════════════════════════════
    console.log('🏗️  Creating Hierarchy B: CCMS Stations...');

    const ccms1 = await CCMS.create({
      uid: 'CCMS-W101-001',
      name: 'Park Street CCMS Panel',
      ward_id: ward63.id,
      latitude: 22.5535,
      longitude: 88.3518,
      panel_capacity_kva: 25.0,
      meter_serial: 'MTR-KOL-20240001',
      installation_date: '2025-01-10',
      schedule_mode: 'astronomical',
      on_offset_minutes: -5,
      off_offset_minutes: 5,
      manual_on_time: '18:30',
      manual_off_time: '05:30',
      dim_level: 100,
      phase_r_state: true,
      phase_y_state: true,
      phase_b_state: true,
      energy_rate_kwh: 8.50,
      billing_start_day: 1,
      status: 'active',
      connectivity_status: 'online',
      last_seen: new Date(),
      notes: 'Three-phase electrical monitoring + astronomical feeder control panel for Park Street',
    });

    console.log('📡  Creating DCU Units under CCMS...');
    const dcu1 = await DCU.create({
      uid: 'DCU-001',
      name: 'Park Street DCU - Block A (North)',
      ccms_id: ccms1.id,
      communication_protocol: 'DALI',
      max_devices: 50,
      serial_number: 'SN-DCU-001-A',
      firmware_version: '3.2.0',
      installation_date: '2025-01-12',
      status: 'active',
      connectivity_status: 'online',
      last_seen: new Date(),
      notes: 'DALI concentrator for Park Street North segment',
    });

    const dcu2 = await DCU.create({
      uid: 'DCU-002',
      name: 'Park Street DCU - Block B (South)',
      ccms_id: ccms1.id,
      communication_protocol: 'DALI',
      max_devices: 50,
      serial_number: 'SN-DCU-002-B',
      firmware_version: '3.2.0',
      installation_date: '2025-01-14',
      status: 'active',
      connectivity_status: 'online',
      last_seen: new Date(),
      notes: 'DALI concentrator for Park Street South segment',
    });

    // ── Downstream Devices under DCU-001 & DCU-002 with Phase R / Y / B Mapping
    console.log('💡  Creating Downstream Devices with Phase Mapping (R, Y, B)...');

    const dcuDevicesConfig = [
      // DCU-001 Devices
      { uid: 'TS00000003', name: 'Device 01', phase: 'R', dcu: dcu1, p: 98, v: 232.1, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000004', name: 'Device 02', phase: 'R', dcu: dcu1, p: 97, v: 231.8, i: 0.43, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000005', name: 'Device 03', phase: 'Y', dcu: dcu1, p: 99, v: 232.0, i: 0.44, pf: 0.94, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000006', name: 'Device 04', phase: 'B', dcu: dcu1, p: 96, v: 233.1, i: 0.43, pf: 0.96, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000007', name: 'Device 05', phase: 'R', dcu: dcu1, p: 98, v: 232.2, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000008', name: 'Device 06', phase: 'Y', dcu: dcu1, p: 97, v: 231.5, i: 0.43, pf: 0.94, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000009', name: 'Device 07', phase: 'B', dcu: dcu1, p: 95, v: 233.0, i: 0.42, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000010', name: 'Device 08', phase: 'B', dcu: dcu1, p: 98, v: 233.4, i: 0.43, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000011', name: 'Device 09', phase: 'R', dcu: dcu1, p: 99, v: 232.0, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000012', name: 'Device 10', phase: 'Y', dcu: dcu1, p: 96, v: 231.9, i: 0.43, pf: 0.94, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000013', name: 'Device 11', phase: 'B', dcu: dcu1, p: 97, v: 232.8, i: 0.43, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000014', name: 'Device 12', phase: 'R', dcu: dcu1, p: 98, v: 232.4, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },

      // DCU-002 Devices
      { uid: 'TS00000015', name: 'Device 13', phase: 'R', dcu: dcu2, p: 99, v: 231.9, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000016', name: 'Device 14', phase: 'Y', dcu: dcu2, p: 97, v: 232.1, i: 0.43, pf: 0.94, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000017', name: 'Device 15', phase: 'B', dcu: dcu2, p: 96, v: 233.0, i: 0.43, pf: 0.96, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000018', name: 'Device 16', phase: 'R', dcu: dcu2, p: 98, v: 232.3, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000019', name: 'Device 17', phase: 'Y', dcu: dcu2, p: 96, v: 231.7, i: 0.43, pf: 0.94, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000020', name: 'Device 18', phase: 'B', dcu: dcu2, p: 97, v: 232.9, i: 0.43, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000021', name: 'Device 19', phase: 'R', dcu: dcu2, p: 99, v: 232.1, i: 0.44, pf: 0.95, light: 'on', status: 'online', fault: 0 },
      { uid: 'TS00000022', name: 'Device 20', phase: 'Y', dcu: dcu2, p: 95, v: 231.8, i: 0.42, pf: 0.94, light: 'on', status: 'online', fault: 0 },
    ];

    const seededDevices = [];
    for (const cfg of dcuDevicesConfig) {
      const dev = await Device.create({
        uid: cfg.uid,
        name: cfg.name,
        serial_number: `SN-${cfg.uid}`,
        street_id: parkStreet.id,
        dcu_id: cfg.dcu.id,
        phase: cfg.phase,
        latitude: 22.5535 + (Math.random() - 0.5) * 0.005,
        longitude: 88.3518 + (Math.random() - 0.5) * 0.005,
        installation_date: '2025-01-20',
        device_model: 'TLX-5000-DALI',
        firmware_version: '3.2.0',
        rated_voltage: 230,
        rated_power: 100,
        status: 'active',
        connectivity_status: cfg.status,
        light_status: cfg.light,
        health_status: cfg.fault ? 'fault' : 'normal',
        last_seen: new Date(),
      });

      await DeviceLatestState.create({
        device_id: dev.id,
        voltage: cfg.v,
        current: cfg.i,
        real_power: cfg.p,
        pf: cfg.pf,
        kwh: +(55.0 + Math.random() * 10).toFixed(2),
        run_hours: 550,
        frequency: 50.00,
        light_status: cfg.light === 'on' ? 1 : 0,
        relay_status: cfg.light === 'on' ? 1 : 0,
        fault: cfg.fault,
        packets_today: 120,
        packets_total: 14500,
      });

      // Seed recent device telemetry
      await Telemetry.create({
        device_id: dev.id,
        uid: dev.uid,
        voltage: cfg.v,
        current: cfg.i,
        real_power: cfg.p,
        pf: cfg.pf,
        frequency: 50.00,
        kwh: 58.5,
        active_energy: 59.0,
        run_hours: 550,
        light_status: cfg.light === 'on' ? 1 : 0,
        relay_status: cfg.light === 'on' ? 1 : 0,
        fault: cfg.fault,
        server_timestamp: new Date(),
        packet_timestamp: new Date(),
      });

      seededDevices.push(dev);
    }

    // ── Seed CCMS 3-Phase Telemetry History (Last 30 days daily + high-frequency today)
    console.log('⚡  Seeding CCMS 3-Phase Telemetry...');
    const now = new Date();

    // 30 days daily records for historical charts & reconciliation
    for (let d = 30; d >= 1; d--) {
      const dayDate = new Date(now.getTime() - d * 24 * 3600 * 1000);
      dayDate.setHours(20, 0, 0, 0);
      const baseKwh = 1250.50 - d * 38;
      await CcmsTelemetry.create({
        ccms_id: ccms1.id,
        timestamp: dayDate,
        voltage_r: +(232.1 + (Math.random() - 0.5) * 1.5).toFixed(1),
        voltage_y: +(231.8 + (Math.random() - 0.5) * 1.5).toFixed(1),
        voltage_b: +(233.2 + (Math.random() - 0.5) * 1.5).toFixed(1),
        current_r: +(12.4 + (Math.random() - 0.5) * 0.4).toFixed(2),
        current_y: +(11.9 + (Math.random() - 0.5) * 0.4).toFixed(2),
        current_b: +(12.1 + (Math.random() - 0.5) * 0.4).toFixed(2),
        active_power_kw: +(8.21 + (Math.random() - 0.5) * 0.2).toFixed(3),
        reactive_power_kvar: +(1.22 + (Math.random() - 0.5) * 0.1).toFixed(3),
        apparent_power_kva: +(8.35 + (Math.random() - 0.5) * 0.2).toFixed(3),
        power_factor: 0.94,
        frequency_hz: 50.00,
        energy_kwh: +(baseKwh).toFixed(2),
        current_neutral: 0.18,
        source: 'modbus',
      });
    }

    // High frequency (every 15 min for today)
    for (let i = 16; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 15 * 60 * 1000);
      await CcmsTelemetry.create({
        ccms_id: ccms1.id,
        timestamp: ts,
        voltage_r: +(232.1 + (Math.random() - 0.5) * 1.2).toFixed(1),
        voltage_y: +(231.8 + (Math.random() - 0.5) * 1.2).toFixed(1),
        voltage_b: +(233.2 + (Math.random() - 0.5) * 1.2).toFixed(1),
        current_r: +(12.4 + (Math.random() - 0.5) * 0.3).toFixed(2),
        current_y: +(11.9 + (Math.random() - 0.5) * 0.3).toFixed(2),
        current_b: +(12.1 + (Math.random() - 0.5) * 0.3).toFixed(2),
        active_power_kw: 8.24,
        reactive_power_kvar: 1.21,
        apparent_power_kva: 8.32,
        power_factor: 0.94,
        frequency_hz: 50.00,
        energy_kwh: +(1250.50 - (i * 0.6)).toFixed(3),
        current_neutral: 0.16,
        source: 'modbus',
      });
    }

    // ── Super Admin User & Technician
    const hash = await bcrypt.hash('Admin@123', 10);
    const [adminUser] = await User.findOrCreate({
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

    const techHash = await bcrypt.hash('Tech@123', 10);
    const [techUser] = await User.findOrCreate({
      where: { email: 'tech@techavo.com' },
      defaults: {
        name: 'Subhashish Ghosh',
        email: 'tech@techavo.com',
        password_hash: techHash,
        role: 'maintenance_user',
        scope_type: 'ward',
        scope_id: ward63.id,
        is_active: true,
      },
    });

    // ── Alert Rules
    const rules = [
      { name: 'Device Offline',         condition_field: 'OFFLINE',  condition_op: '=',  condition_value: 1,    severity: 'critical', alert_type: 'device_offline' },
      { name: 'Over Voltage',           condition_field: 'VOLTAGE',  condition_op: '>',  condition_value: 260,  severity: 'major',    alert_type: 'over_voltage' },
      { name: 'Under Voltage',          condition_field: 'VOLTAGE',  condition_op: '<',  condition_value: 190,  severity: 'major',    alert_type: 'under_voltage' },
      { name: 'Zero Current (Light ON)',condition_field: 'CURRENT',  condition_op: '<',  condition_value: 0.05, severity: 'major',    alert_type: 'zero_current' },
      { name: 'Over Current',           condition_field: 'CURRENT',  condition_op: '>',  condition_value: 2,    severity: 'critical', alert_type: 'over_current' },
      { name: 'Low Power Factor',       condition_field: 'PF',       condition_op: '<',  condition_value: 0.7,  severity: 'warning',  alert_type: 'low_pf' },
      { name: 'Frequency Abnormal',     condition_field: 'FREQ',     condition_op: '<',  condition_value: 48,   severity: 'warning',  alert_type: 'freq_abnormal' },
      { name: 'Device Fault Flag',      condition_field: 'FAULT',    condition_op: '=',  condition_value: 1,    severity: 'major',    alert_type: 'device_fault' },
    ];

    for (const r of rules) {
      await AlertRule.findOrCreate({
        where: { name: r.name },
        defaults: { ...r, project_id: project.id, scope_type: 'global', action_create_alert: true, is_active: true },
      });
    }

    // ── Create a sample Alert and Maintenance Ticket for CCMS / Device
    const sampleAlert = await Alert.create({
      device_id: seededDevices[3]?.id || dev1.id,
      rule_id: 3,
      alert_type: 'under_voltage',
      severity: 'major',
      message: 'Phase B Under Voltage detected (182.5 V < 190 V threshold)',
      status: 'open',
      voltage_at_alert: 182.5,
      current_at_alert: 0.41,
      power_at_alert: 74.2,
    });

    await MaintenanceTicket.create({
      ticket_number: 'MT-00125',
      alert_id: sampleAlert.id,
      device_id: seededDevices[3]?.id || dev1.id,
      title: 'B Phase Low Voltage Investigation — CCMS-W101-001',
      description: 'CCMS B Phase voltage dropped to 182.5V impacting downstream devices on DCU-001 and DCU-002.',
      priority: 'critical',
      status: 'in_progress',
      assigned_to: techUser.id,
      created_by: adminUser.id,
    });

    console.log('');
    console.log('✅ Two Asset Hierarchies Successfully Seeded!');
    console.log('====================================================');
    console.log('🏛️  Hierarchy A (Normal Monitoring):');
    console.log('    • TS00000001 (Park St) - Independent street device');
    console.log('    • TS00000002 (Camac St) - Independent street device');
    console.log('');
    console.log('🏗️  Hierarchy B (CCMS Controlled Network):');
    console.log('    • CCMS-W101-001: Park Street CCMS Panel (Ward 63)');
    console.log('      ├── DCU-001: Park Street DCU - Block A (North)');
    console.log('      │    ├── Device 01..12 (Mapped to Phase R, Y, B)');
    console.log('      └── DCU-002: Park Street DCU - Block B (South)');
    console.log('           └── Device 13..20 (Mapped to Phase R, Y, B)');
    console.log('');
    console.log('⚡  CCMS Electrical & Telemetry:');
    console.log('    • R Phase: 232.1 V | 12.4 A | 82.1 kW | PF 0.94');
    console.log('    • Y Phase: 231.8 V | 11.9 A | 79.8 kW | PF 0.93');
    console.log('    • B Phase: 233.2 V | 12.1 A | 81.4 kW | PF 0.95');
    console.log('    • Energy Meter: 1,250.50 kWh | Mapped Devices Sum: 1,180.20 kWh');
    console.log('    • Difference: 70.30 kWh (5.62% Reconciliation)');
    console.log('    • Billing Rate: ₹8.50 / kWh | Est. Cost: ₹109,226.70');
    console.log('====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
