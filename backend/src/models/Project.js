import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  code: { type: DataTypes.STRING(50), unique: true },
  client: { type: DataTypes.STRING(200) },
  start_date: { type: DataTypes.DATEONLY },
  end_date: { type: DataTypes.DATEONLY },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive', 'completed'), defaultValue: 'active' },
}, { tableName: 'projects' });

export default Project;
