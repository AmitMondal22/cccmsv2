import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Street = sequelize.define('Street', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ward_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, { tableName: 'streets' });

export default Street;
