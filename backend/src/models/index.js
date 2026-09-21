import sequelize from '../config/database.js';
import Project from './Project.js';
import City from './City.js';
import Zone from './Zone.js';
import Ward from './Ward.js';
import Street from './Street.js';
import Device from './Device.js';
import User from './User.js';
import DeviceLatestState from './DeviceLatestState.js';
import Telemetry from './Telemetry.js';
import AlertRule from './AlertRule.js';
import Alert from './Alert.js';
import MaintenanceTicket from './MaintenanceTicket.js';
import AuditLog from './AuditLog.js';
import Notification from './Notification.js';

// ─── Organization Hierarchy ────────────────────────────────────
Project.hasMany(City, { foreignKey: 'project_id', as: 'cities' });
City.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

City.hasMany(Zone, { foreignKey: 'city_id', as: 'zones' });
Zone.belongsTo(City, { foreignKey: 'city_id', as: 'city' });

Zone.hasMany(Ward, { foreignKey: 'zone_id', as: 'wards' });
Ward.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

Ward.hasMany(Street, { foreignKey: 'ward_id', as: 'streets' });
Street.belongsTo(Ward, { foreignKey: 'ward_id', as: 'ward' });

Street.hasMany(Device, { foreignKey: 'street_id', as: 'devices' });
Device.belongsTo(Street, { foreignKey: 'street_id', as: 'street' });

// ─── Device ↔ State & Telemetry ──────────────────────────────
Device.hasOne(DeviceLatestState, { foreignKey: 'device_id', as: 'latestState' });
DeviceLatestState.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Device.hasMany(Telemetry, { foreignKey: 'device_id', as: 'telemetry' });
Telemetry.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// ─── Alerts ───────────────────────────────────────────────────
Device.hasMany(Alert, { foreignKey: 'device_id', as: 'alerts' });
Alert.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

AlertRule.hasMany(Alert, { foreignKey: 'rule_id', as: 'alerts' });
Alert.belongsTo(AlertRule, { foreignKey: 'rule_id', as: 'rule' });

Alert.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

// ─── Maintenance ──────────────────────────────────────────────
Device.hasMany(MaintenanceTicket, { foreignKey: 'device_id', as: 'tickets' });
MaintenanceTicket.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Alert.hasMany(MaintenanceTicket, { foreignKey: 'alert_id', as: 'tickets' });
MaintenanceTicket.belongsTo(Alert, { foreignKey: 'alert_id', as: 'alert' });

MaintenanceTicket.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedTechnician' });
MaintenanceTicket.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ─── Users / Notifications ────────────────────────────────────
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export {
  sequelize,
  Project,
  City,
  Zone,
  Ward,
  Street,
  Device,
  User,
  DeviceLatestState,
  Telemetry,
  AlertRule,
  Alert,
  MaintenanceTicket,
  AuditLog,
  Notification,
};
