import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Telemetry = sequelize.define('Telemetry', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false },
  uid: { type: DataTypes.STRING(50), allowNull: false },
  // Timestamps
  packet_timestamp: { type: DataTypes.DATE },
  server_timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  // Electrical
  voltage: { type: DataTypes.DECIMAL(8, 2) },
  current: { type: DataTypes.DECIMAL(8, 4) },
  real_power: { type: DataTypes.DECIMAL(10, 4) },
  pf: { type: DataTypes.DECIMAL(6, 4) },
  kwh: { type: DataTypes.DECIMAL(12, 4) },
  run_hours: { type: DataTypes.DECIMAL(10, 2) },
  frequency: { type: DataTypes.DECIMAL(6, 2) },
  // Status
  light_status: { type: DataTypes.SMALLINT, defaultValue: 0 },
  relay_status: { type: DataTypes.SMALLINT, defaultValue: 0 },
  fault: { type: DataTypes.SMALLINT, defaultValue: 0 },
  datalog: { type: DataTypes.SMALLINT },
  // Source
  source_ip: { type: DataTypes.STRING(50) },
  raw_payload: { type: DataTypes.TEXT },
}, {
  tableName: 'telemetry',
  timestamps: false,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['uid'] },
    { fields: ['server_timestamp'] },
    { fields: ['device_id', 'server_timestamp'] },
  ],
});

export default Telemetry;
