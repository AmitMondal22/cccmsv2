import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FirmwareRelease = sequelize.define('FirmwareRelease', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  version: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  device_model: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Techavo SmartLum-60W-V2' },
  release_title: { type: DataTypes.STRING(200), allowNull: false },
  release_notes: { type: DataTypes.TEXT },
  checksum_sha256: { type: DataTypes.STRING(64) },
  binary_size_bytes: { type: DataTypes.INTEGER, defaultValue: 148560 },
  binary_url: { type: DataTypes.STRING(500) },
  min_supported_version: { type: DataTypes.STRING(50), defaultValue: 'v2.0.0' },
  is_critical: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('draft', 'testing', 'active', 'deprecated'), defaultValue: 'active' },
  release_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  created_by: { type: DataTypes.INTEGER },
}, { tableName: 'firmware_releases' });

export default FirmwareRelease;
