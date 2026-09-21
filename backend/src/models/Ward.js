import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Ward = sequelize.define('Ward', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  zone_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  number: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, { tableName: 'wards' });

export default Ward;
