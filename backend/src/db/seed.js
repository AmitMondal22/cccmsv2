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

    // ── Clean up existing old devices & telemetry to ensure only requested seed data exists
    console.log('🧹 Cleaning old test data...');
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

    // ── Devices: ONLY TS00000001 and TS00000002 in Kolkata
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
        connectivity_status: 'online',
        light_status: 'on',
        health_status: 'normal',
        last_seen: new Date(),
        voltage: 238.40,
        current: 0.2610,
        real_power: 62.22,
        pf: 0.94,
        kwh: 14.8520,
        run_hours: 48.5,
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
        connectivity_status: 'online',
        light_status: 'on',
        health_status: 'normal',
        last_seen: new Date(),
        voltage: 240.15,
        current: 0.2540,
        real_power: 61.00,
        pf: 0.93,
        kwh: 12.3140,
        run_hours: 42.0,
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
        last_seen: d.last_seen,
      });

      // Latest State
      await DeviceLatestState.create({
        device_id: device.id,
        voltage: d.voltage,
        current: d.current,
        real_power: d.real_power,
        pf: d.pf,
        kwh: d.kwh,
        run_hours: d.run_hours,
        frequency: 50.00,
        light_status: 1,
        relay_status: 1,
        fault: 0,
        packet_timestamp: new Date(),
        server_timestamp: new Date(),
        packets_today: 720,
        packets_total: 15420,
      });

      // Generate initial telemetry history points for reports & charts
      const now = Date.now();
      const telemetryEntries = [];
      for (let i = 24; i >= 0; i--) {
        const time = new Date(now - i * 3600 * 1000);
        const isNight = time.getHours() < 6 || time.getHours() >= 18;
        const v = 235 + Math.random() * 8;
        const c = isNight ? (0.24 + Math.random() * 0.03) : 0;
        const p = v * c;

        telemetryEntries.push({
          device_id: device.id,
          uid: d.uid,
          packet_timestamp: time,
          server_timestamp: time,
          voltage: parseFloat(v.toFixed(2)),
          current: parseFloat(c.toFixed(4)),
          real_power: parseFloat(p.toFixed(4)),
          pf: isNight ? 0.93 : 0,
          frequency: 50.00,
          kwh: parseFloat((d.kwh - (i * 0.05)).toFixed(4)),
          run_hours: parseFloat((d.run_hours - (i * 0.1)).toFixed(2)),
          light_status: isNight ? 1 : 0,
          relay_status: isNight ? 1 : 0,
          fault: 0,
        });
      }

      await Telemetry.bulkCreate(telemetryEntries);
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

    console.log('✅ Kolkata Seed complete!');
    console.log('');
    console.log('🏛️ City:        Kolkata (West Bengal, India)');
    console.log('📍 Location:    Park Street / Camac Street (Ward 63)');
    console.log('📦 Seeded UIDs: TS00000001, TS00000002');
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
