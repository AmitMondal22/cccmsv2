import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('super_admin', 'project_admin', 'city_user', 'zone_user', 'ward_user', 'maintenance_user'),
    defaultValue: 'maintenance_user',
  },
  // Scope for RBAC
  scope_type: { type: DataTypes.ENUM('global', 'project', 'city', 'zone', 'ward'), defaultValue: 'global' },
  scope_id: { type: DataTypes.INTEGER },
  phone: { type: DataTypes.STRING(20) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login: { type: DataTypes.DATE },
}, { tableName: 'users' });

export default User;
