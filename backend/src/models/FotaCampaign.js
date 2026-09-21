import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FotaCampaign = sequelize.define('FotaCampaign', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  firmware_id: { type: DataTypes.INTEGER, allowNull: false },
  target_scope: {
    type: DataTypes.ENUM('all', 'project', 'city', 'zone', 'ward', 'device'),
    allowNull: false,
    defaultValue: 'all',
  },
  target_id: { type: DataTypes.INTEGER, allowNull: true },
  total_devices: { type: DataTypes.INTEGER, defaultValue: 0 },
  updated_devices: { type: DataTypes.INTEGER, defaultValue: 0 },
  in_progress_devices: { type: DataTypes.INTEGER, defaultValue: 0 },
  failed_devices: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'failed'),
    defaultValue: 'pending',
  },
  ipv6_protocol: { type: DataTypes.STRING(100), defaultValue: 'Dual-Stack IPv6 / UDP CoAP Engine' },
  chunk_size_bytes: { type: DataTypes.INTEGER, defaultValue: 512 },
  auto_reboot: { type: DataTypes.BOOLEAN, defaultValue: true },
  started_at: { type: DataTypes.DATE },
  completed_at: { type: DataTypes.DATE },
  created_by: { type: DataTypes.INTEGER },
}, { tableName: 'fota_campaigns' });

export default FotaCampaign;
