import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Device = sequelize.define('Device', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uid: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  serial_number: { type: DataTypes.STRING(100) },
  street_id: { type: DataTypes.INTEGER },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(10, 6) },
  installation_date: { type: DataTypes.DATEONLY },
  device_model: { type: DataTypes.STRING(100) },
  firmware_version: { type: DataTypes.STRING(50) },
  rated_voltage: { type: DataTypes.DECIMAL(8, 2) },
  rated_power: { type: DataTypes.DECIMAL(8, 2) },
  // Independent status fields
  status: { type: DataTypes.ENUM('active', 'maintenance', 'decommissioned'), defaultValue: 'active' },
  connectivity_status: { type: DataTypes.ENUM('online', 'offline', 'warning'), defaultValue: 'offline' },
  light_status: { type: DataTypes.ENUM('on', 'off', 'unknown'), defaultValue: 'unknown' },
  health_status: { type: DataTypes.ENUM('normal', 'warning', 'fault', 'maintenance'), defaultValue: 'normal' },
  last_seen: { type: DataTypes.DATE },
  // Configurable thresholds for offline detection
  offline_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 5 },
  warning_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 2 },
}, { tableName: 'devices' });

export default Device;
