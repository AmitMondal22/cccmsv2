import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DeviceLatestState = sequelize.define('DeviceLatestState', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  // Electrical
  voltage: { type: DataTypes.DECIMAL(8, 2) },
  current: { type: DataTypes.DECIMAL(8, 4) },
  real_power: { type: DataTypes.DECIMAL(10, 4) },
  pf: { type: DataTypes.DECIMAL(6, 4) },
  kwh: { type: DataTypes.DECIMAL(12, 4) },
  run_hours: { type: DataTypes.DECIMAL(10, 2) },
  frequency: { type: DataTypes.DECIMAL(6, 2) },
  // Status
  light_status: { type: DataTypes.SMALLINT, defaultValue: 0 },   // 1=ON 0=OFF
  relay_status: { type: DataTypes.SMALLINT, defaultValue: 0 },
  fault: { type: DataTypes.SMALLINT, defaultValue: 0 },           // 0=Normal 1=Fault
  // Telemetry meta
  packet_timestamp: { type: DataTypes.DATE },
  server_timestamp: { type: DataTypes.DATE },
  ipv6_address: { type: DataTypes.STRING(50) },
  // Diagnostics counters
  packets_today: { type: DataTypes.INTEGER, defaultValue: 0 },
  packets_total: { type: DataTypes.INTEGER, defaultValue: 0 },
  invalid_packets: { type: DataTypes.INTEGER, defaultValue: 0 },
  missing_packets: { type: DataTypes.INTEGER, defaultValue: 0 },
  fault_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  restart_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_fault_at: { type: DataTypes.DATE },
}, { tableName: 'device_latest_states' });

export default DeviceLatestState;
