import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CcmsTelemetry = sequelize.define('CcmsTelemetry', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  ccms_id: { type: DataTypes.INTEGER, allowNull: false },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

  // Three-phase voltages (V)
  voltage_r: { type: DataTypes.DECIMAL(8, 2) },
  voltage_y: { type: DataTypes.DECIMAL(8, 2) },
  voltage_b: { type: DataTypes.DECIMAL(8, 2) },

  // Three-phase currents (A)
  current_r: { type: DataTypes.DECIMAL(8, 3) },
  current_y: { type: DataTypes.DECIMAL(8, 3) },
  current_b: { type: DataTypes.DECIMAL(8, 3) },

  // Power measurements
  active_power_kw: { type: DataTypes.DECIMAL(10, 3) },
  reactive_power_kvar: { type: DataTypes.DECIMAL(10, 3) },
  apparent_power_kva: { type: DataTypes.DECIMAL(10, 3) },
  power_factor: { type: DataTypes.DECIMAL(5, 3) },

  // Frequency
  frequency_hz: { type: DataTypes.DECIMAL(5, 2) },

  // Cumulative energy (kWh) — meter reading at this timestamp
  energy_kwh: { type: DataTypes.DECIMAL(12, 3) },

  // Neutral current (A)
  current_neutral: { type: DataTypes.DECIMAL(8, 3) },

  // Raw CCMS source (e.g. 'udp', 'modbus', 'manual')
  source: { type: DataTypes.STRING(20), defaultValue: 'udp' },
}, {
  tableName: 'ccms_telemetry',
  indexes: [
    { fields: ['ccms_id', 'timestamp'] },
  ],
});

export default CcmsTelemetry;
