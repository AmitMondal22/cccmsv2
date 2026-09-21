import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AlertRule = sequelize.define('AlertRule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  project_id: { type: DataTypes.INTEGER },
  scope_type: { type: DataTypes.ENUM('global', 'project', 'city', 'zone', 'ward', 'device'), defaultValue: 'global' },
  scope_id: { type: DataTypes.INTEGER },
  // Condition: field op value (e.g. VOLTAGE < 190)
  condition_field: { type: DataTypes.STRING(50), allowNull: false },
  condition_op: { type: DataTypes.ENUM('<', '>', '<=', '>=', '=', '!='), allowNull: false },
  condition_value: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
  // Optional duration: alert only if condition is true for X minutes
  duration_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  severity: { type: DataTypes.ENUM('critical', 'major', 'warning', 'info'), defaultValue: 'major' },
  alert_type: { type: DataTypes.STRING(100) },
  // Actions
  action_create_alert: { type: DataTypes.BOOLEAN, defaultValue: true },
  action_create_ticket: { type: DataTypes.BOOLEAN, defaultValue: false },
  action_send_email: { type: DataTypes.BOOLEAN, defaultValue: false },
  email_recipients: { type: DataTypes.TEXT }, // comma-separated emails
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  description: { type: DataTypes.TEXT },
}, { tableName: 'alert_rules' });

export default AlertRule;
