import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DCU = sequelize.define('DCU', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uid: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  ccms_id: { type: DataTypes.INTEGER, allowNull: false },

  // Communication
  communication_protocol: {
    type: DataTypes.ENUM('DALI', '0-10V', 'Wireless', 'RS485', 'PLC'),
    defaultValue: 'DALI',
  },
  max_devices: { type: DataTypes.INTEGER, defaultValue: 50 },

  // Hardware info
  serial_number: { type: DataTypes.STRING(100) },
  firmware_version: { type: DataTypes.STRING(50) },
  installation_date: { type: DataTypes.DATEONLY },

  // Operational status
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'fault'),
    defaultValue: 'active',
  },
  connectivity_status: {
    type: DataTypes.ENUM('online', 'offline'),
    defaultValue: 'offline',
  },
  last_seen: { type: DataTypes.DATE },

  notes: { type: DataTypes.TEXT },
}, { tableName: 'dcus' });

export default DCU;
