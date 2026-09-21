import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MaintenanceTicket = sequelize.define('MaintenanceTicket', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticket_number: { type: DataTypes.STRING(50), unique: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false },
  alert_id: { type: DataTypes.INTEGER },
  created_by: { type: DataTypes.INTEGER },
  title: { type: DataTypes.STRING(300) },
  description: { type: DataTypes.TEXT },
  problem_type: { type: DataTypes.STRING(100) },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), defaultValue: 'medium' },
  status: {
    type: DataTypes.ENUM('open', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'),
    defaultValue: 'open',
  },
  assigned_to: { type: DataTypes.INTEGER },
  assigned_team: { type: DataTypes.STRING(100) },
  due_date: { type: DataTypes.DATEONLY },
  // Resolution
  diagnosis: { type: DataTypes.JSONB },
  repair_notes: { type: DataTypes.TEXT },
  photo_urls: { type: DataTypes.ARRAY(DataTypes.TEXT) },
  resolved_at: { type: DataTypes.DATE },
  closed_at: { type: DataTypes.DATE },
}, { tableName: 'maintenance_tickets' });

export default MaintenanceTicket;
