import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  type: { type: DataTypes.STRING(50) }, // 'alert', 'maintenance', 'device_offline', etc.
  title: { type: DataTypes.STRING(300) },
  message: { type: DataTypes.TEXT },
  severity: { type: DataTypes.ENUM('critical', 'major', 'warning', 'info'), defaultValue: 'info' },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  ref_type: { type: DataTypes.STRING(50) }, // 'alert', 'ticket', 'device'
  ref_id: { type: DataTypes.INTEGER },
}, { tableName: 'notifications' });

export default Notification;
