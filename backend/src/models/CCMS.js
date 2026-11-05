import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CCMS = sequelize.define('CCMS', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uid: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  ward_id: { type: DataTypes.INTEGER, allowNull: false },

  // Geographic coordinates for astronomical scheduling
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(10, 6) },

  // Electrical panel
  panel_capacity_kva: { type: DataTypes.DECIMAL(10, 2) },
  meter_serial: { type: DataTypes.STRING(100) },
  installation_date: { type: DataTypes.DATEONLY },

  // Schedule configuration
  schedule_mode: {
    type: DataTypes.ENUM('astronomical', 'manual', 'auto'),
    defaultValue: 'astronomical',
  },
  // Offset from sunset (ON) and sunrise (OFF) in minutes (can be negative)
  on_offset_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  off_offset_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Used when schedule_mode = 'manual'
  manual_on_time: { type: DataTypes.STRING(5) },   // "HH:MM"
  manual_off_time: { type: DataTypes.STRING(5) },  // "HH:MM"

  // Dimming level (0–100)
  dim_level: { type: DataTypes.INTEGER, defaultValue: 100 },

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

  // Phase Switch / Contactor states
  phase_r_state: { type: DataTypes.BOOLEAN, defaultValue: true },
  phase_y_state: { type: DataTypes.BOOLEAN, defaultValue: true },
  phase_b_state: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Billing configuration
  energy_rate_kwh: { type: DataTypes.DECIMAL(8, 2), defaultValue: 8.50 },
  billing_start_day: { type: DataTypes.INTEGER, defaultValue: 1 },

  // Extra metadata (JSON)
  notes: { type: DataTypes.TEXT },
}, { tableName: 'ccms' });

export default CCMS;
