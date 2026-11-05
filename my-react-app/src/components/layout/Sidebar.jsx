import { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, FolderKanban, Building2, Globe,
  MapPin, Route, Cpu, Activity, Stethoscope, Bell, Zap,
  Clock, Wrench, ClipboardList, History, BarChart3,
  FileText, Users, Shield, ScrollText, Settings,
  ChevronDown, LogOut, Radio, Network, Server, Layers,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Direct top-level navigation items (no accordion submenu)
const topNavItems = [
  { to: '/',    icon: LayoutDashboard, label: 'Command Center' },
  { to: '/gis', icon: Map,             label: 'GIS Monitoring' },
];

// Collapsible accordion menu sections
const accordionGroups = [
  {
    id: 'org',
    title: 'Asset Hierarchy',
    icon: Building2,
    items: [
      { to: '/org/projects', icon: FolderKanban, label: 'Projects' },
      { to: '/org/cities',   icon: Globe,        label: 'Cities' },
      { to: '/org/zones',    icon: Building2,    label: 'Zones' },
      { to: '/org/wards',    icon: MapPin,       label: 'Wards' },
      { to: '/org/streets',  icon: Route,        label: 'Streets / Areas' },
    ],
  },
  {
    id: 'ccms',
    title: 'CCMS Network',
    icon: Network,
    items: [
      { to: '/ccms',                     icon: Network,   label: 'CCMS Stations' },
      { to: '/ccms?view=control',        icon: Activity,  label: 'Station Control' },
      { to: '/devices?hierarchy=ccms',   icon: Layers,    label: 'CCMS Devices' },
      { to: '/energy?type=ccms',         icon: Zap,       label: 'CCMS Energy' },
    ],
  },
  {
    id: 'dcu',
    title: 'DCU Concentrators',
    icon: Server,
    items: [
      { to: '/dcu',                  icon: Server,      label: 'DCU Units' },
      { to: '/dcu?view=devices',     icon: Cpu,         label: 'DCU Devices' },
      { to: '/dcu?view=diagnostics', icon: Stethoscope, label: 'DCU Diagnostics' },
    ],
  },
  {
    id: 'devices',
    title: 'Devices & Telemetry',
    icon: Cpu,
    items: [
      { to: '/devices',                  icon: Cpu,         label: 'All Devices' },
      { to: '/devices?hierarchy=normal', icon: Layers,      label: 'Normal Devices' },
      { to: '/devices/live',             icon: Activity,    label: 'Live Monitoring' },
      { to: '/devices/diag',             icon: Stethoscope, label: 'Device Diagnostics' },
      { to: '/fota',                     icon: Radio,       label: 'FOTA & Firmware' },
    ],
  },
  {
    id: 'alerts',
    title: 'Fault & Alerts',
    icon: Bell,
    badgeKey: 'alerts',
    items: [
      { to: '/alerts',             icon: AlertTriangle, label: 'Active Faults', badgeKey: 'alerts' },
      { to: '/alerts?tab=history', icon: History,       label: 'Alert History' },
      { to: '/alert-rules',        icon: Shield,        label: 'Alert Rules' },
    ],
  },
  {
    id: 'energy',
    title: 'Energy & Historical',
    icon: Zap,
    items: [
      { to: '/energy',    icon: Zap,   label: 'Energy Analytics' },
      { to: '/run-hours', icon: Clock, label: 'Running Hours' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Jobs',
    icon: Wrench,
    items: [
      { to: '/maintenance',         icon: Wrench,        label: 'Tickets' },
      { to: '/maintenance/my-work', icon: ClipboardList, label: 'Technician Jobs' },
      { to: '/maintenance/history', icon: History,       label: 'Maintenance History' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    items: [
      { to: '/reports/city',        icon: Globe,         label: 'City Reports' },
      { to: '/reports/zone',        icon: Building2,     label: 'Zone Reports' },
      { to: '/reports/ward',        icon: MapPin,        label: 'Ward Reports' },
      { to: '/reports/ccms',        icon: Network,       label: 'CCMS Reports' },
      { to: '/reports/dcu',         icon: Server,        label: 'DCU Reports' },
      { to: '/reports/device',      icon: FileText,      label: 'Device Reports' },
      { to: '/reports/energy',      icon: Zap,           label: 'Energy Reports' },
      { to: '/reports/billing',     icon: BarChart3,     label: 'Billing Reports' },
      { to: '/reports/fault',       icon: AlertTriangle, label: 'Fault Reports' },
      { to: '/reports/maintenance', icon: Wrench,        label: 'Maintenance Reports' },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    icon: Settings,
    items: [
      { to: '/admin/users',    icon: Users,      label: 'Users & Roles' },
      { to: '/admin/audit',    icon: ScrollText, label: 'Audit Logs' },
      { to: '/admin/settings', icon: Settings,   label: 'System Settings' },
    ],
  },
];

// Flatten all navigable items once for single active detection
const allNavItems = [
  ...topNavItems,
  ...accordionGroups.flatMap(g => g.items),
];

/**
 * Accurately determines the SINGLE active item matching current URL.
 * Guarantees that only ONE menu item is highlighted active at a time.
 */
function getActiveItemTo(allItems, currentPath, currentSearch) {
  const currentFull = currentPath + (currentSearch || '');

  // 1. Exact full URL match (path + query parameters)
  for (const item of allItems) {
    if (item.to === currentFull) return item.to;
  }

  // 2. Query search matching: if URL has query params, find matching parameterized item
  if (currentSearch) {
    for (const item of allItems) {
      const [path, query] = item.to.split('?');
      if (path === currentPath && query && currentSearch.includes(query)) {
        return item.to;
      }
    }
  }

  // 3. Exact pathname match without query parameters
  for (const item of allItems) {
    const [path, query] = item.to.split('?');
    if (!query && path === currentPath) {
      return item.to;
    }
  }

  // 4. Detail page fallback (e.g. /devices/:id matches /devices, /ccms/:id matches /ccms)
  let bestMatch = null;
  let bestLength = 0;
  for (const item of allItems) {
    const [path] = item.to.split('?');
    if (path !== '/' && currentPath.startsWith(path + '/')) {
      if (path.length > bestLength) {
        bestLength = path.length;
        bestMatch = item.to;
      }
    }
  }

  return bestMatch;
}

export default function Sidebar({ collapsed, onExpand, alertCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Find the single active item URL
  const activeTo = useMemo(() => {
    return getActiveItemTo(allNavItems, location.pathname, location.search);
  }, [location.pathname, location.search]);

  // Find which accordion section currently owns the active item
  const activeSectionId = useMemo(() => {
    for (const group of accordionGroups) {
      if (group.items.some(item => item.to === activeTo)) {
        return group.id;
      }
    }
    return null;
  }, [activeTo]);

  // Accordion mode: ONLY ONE section is open and active at a time
  const [openSection, setOpenSection] = useState(activeSectionId);

  // Auto-sync open accordion when route changes
  useEffect(() => {
    if (activeSectionId) {
      setOpenSection(activeSectionId);
    }
  }, [activeSectionId]);

  // Handle section header click:
  // - If collapsed, expand the sidebar
  // - Accordion behavior: clicking a section opens it and closes all other sections
  const handleToggleSection = (sectionId) => {
    if (collapsed && onExpand) {
      onExpand();
    }
    setOpenSection(prev => (prev === sectionId ? null : sectionId));
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand Logo */}
      <NavLink to="/" className="sidebar-logo" onClick={() => setOpenSection(null)}>
        <div className="sidebar-logo-icon">T</div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">TECHAVO</div>
          <div className="sidebar-logo-sub">Street Light CCMS</div>
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Top Direct Items */}
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.to === activeTo;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item ${active ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
              onClick={() => setOpenSection(null)}
            >
              <span className="nav-item-icon">
                <Icon size={16} />
              </span>
              <span className="nav-item-label">{item.label}</span>
            </NavLink>
          );
        })}

        <div className="sidebar-divider" />

        {/* Collapsible Accordion Groups */}
        {accordionGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openSection === group.id;
          const hasActiveItem = group.items.some(item => item.to === activeTo);
          const groupBadge = group.badgeKey === 'alerts' && alertCount > 0 ? alertCount : null;

          return (
            <div key={group.id} className="sidebar-group">
              {/* Accordion Section Header */}
              <button
                type="button"
                className={`sidebar-group-btn ${isOpen ? 'open' : ''} ${hasActiveItem ? 'has-active' : ''}`}
                onClick={() => handleToggleSection(group.id)}
                title={collapsed ? group.title : undefined}
              >
                <span className="sidebar-group-icon">
                  <GroupIcon size={16} />
                </span>
                <span className="sidebar-group-title">{group.title}</span>
                {groupBadge && (
                  <span className="nav-badge" style={{ marginRight: 6 }}>
                    {groupBadge > 99 ? '99+' : groupBadge}
                  </span>
                )}
                <span className={`sidebar-group-chevron ${isOpen ? 'expanded' : ''}`}>
                  <ChevronDown size={14} />
                </span>
              </button>

              {/* Submenu Items (Only expanded when this group is open) */}
              <div className={`sidebar-group-items ${isOpen ? 'expanded' : 'collapsed'}`}>
                {group.items.map((item) => {
                  const active = item.to === activeTo;
                  const badge = item.badgeKey === 'alerts' && alertCount > 0 ? alertCount : null;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`nav-sub-item ${active ? 'active' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-sub-dot" />
                      <span className="nav-item-label">{item.label}</span>
                      {badge && (
                        <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
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
