import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const City = sequelize.define('City', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  state: { type: DataTypes.STRING(100) },
  country: { type: DataTypes.STRING(100), defaultValue: 'India' },
  timezone: { type: DataTypes.STRING(50), defaultValue: 'Asia/Kolkata' },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(10, 6) },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, { tableName: 'cities' });

export default City;
