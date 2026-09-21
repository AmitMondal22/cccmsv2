import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Alert = sequelize.define('Alert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false },
  rule_id: { type: DataTypes.INTEGER },
  alert_type: { type: DataTypes.STRING(100) },
  severity: { type: DataTypes.ENUM('critical', 'major', 'warning', 'info'), defaultValue: 'major' },
  status: {
    type: DataTypes.ENUM('open', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'closed', 'auto_recovered'),
    defaultValue: 'open',
  },
  message: { type: DataTypes.TEXT },
  // Electrical values at time of alert
  voltage_at_alert: { type: DataTypes.DECIMAL(8, 2) },
  current_at_alert: { type: DataTypes.DECIMAL(8, 4) },
  power_at_alert: { type: DataTypes.DECIMAL(10, 4) },
  // Lifecycle timestamps
  detected_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  acknowledged_at: { type: DataTypes.DATE },
  assigned_at: { type: DataTypes.DATE },
  resolved_at: { type: DataTypes.DATE },
  closed_at: { type: DataTypes.DATE },
  // Assignment
  assigned_to: { type: DataTypes.INTEGER },
  assigned_by: { type: DataTypes.INTEGER },
  resolution_notes: { type: DataTypes.TEXT },
  auto_recovered: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'alerts' });

export default Alert;
