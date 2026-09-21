import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, FolderKanban, Building2, Globe,
  MapPin, Route, Cpu, Activity, Stethoscope, Bell, Zap,
  Clock, Wrench, ClipboardList, History, BarChart3,
  FileText, Users, Shield, ScrollText, Settings, ChevronRight,
  LogOut, Radio,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const nav = [
  {
    items: [
      { to: '/',                  icon: LayoutDashboard, label: 'Command Center' },
      { to: '/gis',               icon: Map,             label: 'GIS Monitoring' },
    ],
  },
  {
    title: 'ORGANIZATION',
    items: [
      { to: '/org/projects', icon: FolderKanban, label: 'Projects' },
      { to: '/org/cities',   icon: Globe,        label: 'Cities' },
      { to: '/org/zones',    icon: Building2,    label: 'Zones' },
      { to: '/org/wards',    icon: MapPin,       label: 'Wards' },
      { to: '/org/streets',  icon: Route,        label: 'Streets' },
    ],
  },
  {
    title: 'DEVICES',
    items: [
      { to: '/devices',            icon: Cpu,          label: 'All Devices' },
      { to: '/devices/live',       icon: Activity,     label: 'Live Monitoring' },
      { to: '/devices/diag',       icon: Stethoscope,  label: 'Diagnostics' },
      { to: '/fota',               icon: Radio,        label: 'FOTA & Firmware' },
    ],
  },
  {
    title: 'MONITORING',
    items: [
      { to: '/alerts',       icon: Bell,     label: 'Alerts',       badgeKey: 'alerts' },
      { to: '/alert-rules',  icon: Shield,   label: 'Alert Rules' },
      { to: '/energy',       icon: Zap,      label: 'Energy' },
      { to: '/run-hours',    icon: Clock,    label: 'Running Hours' },
    ],
  },
  {
    title: 'MAINTENANCE',
    items: [
      { to: '/maintenance',         icon: Wrench,        label: 'Tickets' },
      { to: '/maintenance/my-work', icon: ClipboardList, label: 'My Work' },
      { to: '/maintenance/history', icon: History,       label: 'History' },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { to: '/reports/city',   icon: BarChart3, label: 'City Reports' },
      { to: '/reports/zone',   icon: BarChart3, label: 'Zone Reports' },
      { to: '/reports/ward',   icon: BarChart3, label: 'Ward Reports' },
      { to: '/reports/device', icon: FileText,  label: 'Device Reports' },
      { to: '/reports/fault',  icon: FileText,  label: 'Fault Reports' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { to: '/admin/users',  icon: Users,      label: 'Users' },
      { to: '/admin/audit',  icon: ScrollText, label: 'Audit Logs' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({ collapsed, alertCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <NavLink to="/" className="sidebar-logo">
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">TECHAVO</div>
          <div className="sidebar-logo-sub">Street Light CCMS</div>
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {nav.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className="sidebar-section-title">{section.title}</div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              const badge = item.badgeKey === 'alerts' && alertCount > 0 ? alertCount : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`nav-item ${active ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                  {badge && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user-avatar" title={user?.name || 'User'}>
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name || 'User'}</div>
          <div className="sidebar-user-role">{user?.role?.replace(/_/g, ' ') || 'Role'}</div>
        </div>
        <button
          className="sidebar-logout-btn"
          onClick={logout}
          title="Sign out / Logout"
          aria-label="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
