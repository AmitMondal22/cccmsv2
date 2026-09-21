import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import {
  sequelize, Project, City, Zone, Ward, Street,
  Device, User, DeviceLatestState, Telemetry, AlertRule, Alert,
  MaintenanceTicket, Notification, AuditLog,
} from '../models/index.js';

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ DB connected and synced');

    // ── Clean up existing old test data
    console.log('🧹 Cleaning old test data & telemetry...');
    await Telemetry.destroy({ where: {} });
    await Alert.destroy({ where: {} });
    await MaintenanceTicket.destroy({ where: {} });
    await DeviceLatestState.destroy({ where: {} });
    await Device.destroy({ where: {} });
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

    // ── Devices: Registered TS00000001 & TS00000002 without dummy historical telemetry
    const deviceDefs = [
      {
        uid: 'TS00000001',
        name: 'SL-KOL-00001',
        serial_number: 'SN-TS00000001',
        street_id: parkStreet.id,
        latitude: 22.5535,
        longitude: 88.3518,
        installation_date: '2025-01-15',
        device_model: 'TLX-3000-KOL',
        firmware_version: '2.1.0',
        rated_voltage: 230,
        rated_power: 60,
        status: 'active',
        connectivity_status: 'offline',
        light_status: 'off',
        health_status: 'normal',
      },
      {
        uid: 'TS00000002',
        name: 'SL-KOL-00002',
        serial_number: 'SN-TS00000002',
        street_id: camacStreet.id,
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
        health_status: 'normal',
      },
    ];

    const devices = [];
    for (const d of deviceDefs) {
      const device = await Device.create({
        uid: d.uid,
        name: d.name,
        serial_number: d.serial_number,
        street_id: d.street_id,
        latitude: d.latitude,
        longitude: d.longitude,
        installation_date: d.installation_date,
        device_model: d.device_model,
        firmware_version: d.firmware_version,
        rated_voltage: d.rated_voltage,
        rated_power: d.rated_power,
        status: d.status,
        connectivity_status: d.connectivity_status,
        light_status: d.light_status,
        health_status: d.health_status,
        last_seen: null,
      });

      // Initialize clean latest state with 0 values (awaits real live UDP telemetry from device)
      await DeviceLatestState.create({
        device_id: device.id,
        voltage: 0,
        current: 0,
        real_power: 0,
        pf: 0,
        kwh: 0,
        run_hours: 0,
        frequency: 50.00,
        light_status: 0,
        relay_status: 0,
        fault: 0,
        packets_today: 0,
        packets_total: 0,
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
        name: 'Subhashish Ghosh',
        email: 'tech@techavo.com',
        password_hash: techHash,
        role: 'maintenance_user',
        scope_type: 'ward',
        scope_id: ward63.id,
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

    console.log('✅ Clean Seed complete! (NO dummy telemetry data)');
    console.log('');
    console.log('🏛️ City:        Kolkata (West Bengal, India)');
    console.log('📍 Location:    Park Street / Camac Street (Ward 63)');
    console.log('📦 Seeded UIDs: TS00000001, TS00000002 (Waiting for live UDP packets)');
    console.log('📧 Super Admin: admin@techavo.com  /  Admin@123');
    console.log('🔧 Technician:  tech@techavo.com   /  Tech@123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
