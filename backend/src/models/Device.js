import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Device = sequelize.define('Device', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uid: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  serial_number: { type: DataTypes.STRING(100) },
  street_id: { type: DataTypes.INTEGER },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(10, 6) },
  installation_date: { type: DataTypes.DATEONLY },
  device_model: { type: DataTypes.STRING(100) },
  firmware_version: { type: DataTypes.STRING(50) },
  rated_voltage: { type: DataTypes.DECIMAL(8, 2) },
  rated_power: { type: DataTypes.DECIMAL(8, 2) },
  // Independent status fields
  status: { type: DataTypes.ENUM('active', 'maintenance', 'decommissioned'), defaultValue: 'active' },
  connectivity_status: { type: DataTypes.ENUM('online', 'offline', 'warning'), defaultValue: 'offline' },
  light_status: { type: DataTypes.ENUM('on', 'off', 'unknown'), defaultValue: 'unknown' },
  health_status: { type: DataTypes.ENUM('normal', 'warning', 'fault', 'maintenance'), defaultValue: 'normal' },
  last_seen: { type: DataTypes.DATE },
  // Configurable thresholds for offline detection
  offline_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 5 },
  warning_threshold_minutes: { type: DataTypes.INTEGER, defaultValue: 2 },
  // Per-device LED fault detection thresholds (JSON)
  fault_config: {
    type: DataTypes.JSONB,
    defaultValue: {
      supply_voltage_min: 80,        // V — below this = no supply (FC-07)
      open_circuit_current: 0.05,   // A — below this with lamp ON = FC-01
      overcurrent_ratio: 1.30,      // × baseline — above this = FC-03
      led_fault_lower_ratio: 0.30,  // × baseline — below this = FC-02
      underpowered_upper_ratio: 0.80, // × baseline — FC-05 range upper bound
      low_pf_threshold: 0.70,       // PF — below this = FC-04
      baseline_learning_packets: 20, // samples before baseline is ready
      baseline_pf_min: 0.75,        // min PF for a sample to be used in baseline
      baseline_current_min: 0.10,   // A — min current for a sample to be used
      debounce_count: 3,            // consecutive hits before alert is raised
      cycling_spike_count: 3,       // spikes in window before FC-06
      cycling_window_ms: 60000,     // ms — startup cycling detection window
    },
  },

}, { tableName: 'devices' });

export default Device;
