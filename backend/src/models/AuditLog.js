import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  user_name: { type: DataTypes.STRING(200) },
  action: { type: DataTypes.STRING(100) },
  module: { type: DataTypes.STRING(100) },
  object_type: { type: DataTypes.STRING(100) },
  object_id: { type: DataTypes.STRING(100) },
  old_value: { type: DataTypes.JSONB },
  new_value: { type: DataTypes.JSONB },
  ip_address: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.TEXT },
}, { tableName: 'audit_logs', timestamps: true, updatedAt: false });

export default AuditLog;
