import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FotaDeviceJob = sequelize.define('FotaDeviceJob', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campaign_id: { type: DataTypes.INTEGER, allowNull: false },
  device_id: { type: DataTypes.INTEGER, allowNull: false },
  device_uid: { type: DataTypes.STRING(50) },
  target_ipv6: { type: DataTypes.STRING(64) },
  current_version: { type: DataTypes.STRING(50) },
  target_version: { type: DataTypes.STRING(50) },
  progress_percent: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('queued', 'negotiating_ipv6', 'transferring', 'flashing', 'verified', 'failed'),
    defaultValue: 'queued',
  },
  error_message: { type: DataTypes.STRING(300) },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  transfer_speed_kbps: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0.0 },
  latency_ms: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_activity_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'fota_device_jobs' });

export default FotaDeviceJob;
