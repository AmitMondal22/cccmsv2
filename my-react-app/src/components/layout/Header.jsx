import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell, Sun, Moon } from 'lucide-react';
import { getNotifications, markAllRead } from '../../api/user.api.js';
import { useTheme } from '../../context/ThemeContext.jsx';

const routeLabels = {
  '/': 'Command Center',
  '/gis': 'GIS Monitoring',
  '/org/projects': 'Projects',
  '/org/cities': 'Cities',
  '/org/zones': 'Zones',
  '/org/wards': 'Wards',
  '/org/streets': 'Streets',
  '/devices': 'All Devices',
  '/devices/live': 'Live Monitoring',
  '/devices/diag': 'Diagnostics',
  '/fota': 'FOTA & Firmware Management',
  '/alerts': 'Alerts',
  '/alert-rules': 'Alert Rules',
  '/energy': 'Energy & Demand Analytics',
  '/run-hours': 'Running Hours',
  '/maintenance': 'Tickets',
  '/maintenance/my-work': 'My Work',
  '/maintenance/history': 'Maintenance History',
  '/reports/city': 'City Reports',
  '/reports/zone': 'Zone Reports',
  '/reports/ward': 'Ward Reports',
  '/reports/device': 'Device Reports',
  '/reports/fault': 'Fault Reports',
  '/admin/users': 'Users',
  '/admin/audit': 'Audit Logs',
  '/admin/settings': 'Settings',
};

export default function Header({ onToggleSidebar, onAlertCountChange }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme() || { theme: 'dark', toggleTheme: () => {} };
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  const label = routeLabels[location.pathname] || 'Dashboard';

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.data || []);
      setUnread(res.data.unread || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    await markAllRead();
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const severityColor = {
    critical: 'var(--critical)',
    major: 'var(--major)',
    warning: 'var(--warning)',
    info: 'var(--info-sev)',
  };

  return (
    <header className="app-header">
      <button className="header-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu size={16} />
      </button>

      <div className="header-breadcrumb">
        Techavo CCMS <span>/</span> {label}
      </div>

      <div className="header-actions">
        {/* Theme Toggle Button */}
        <button
          className="header-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
          style={{ position: 'relative' }}
        >
          {theme === 'dark' ? (
            <Sun size={16} style={{ color: '#f59e0b' }} />
          ) : (
            <Moon size={16} style={{ color: '#6366f1' }} />
          )}
        </button>

        {/* Notification bell */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="header-icon-btn"
            id="header-notif-btn"
            onClick={() => setShowNotif(p => !p)}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </button>

          {showNotif && (
            <div className="notif-panel">
              <div className="card-header">
                <div>
                  <div className="card-title">Notifications</div>
                  {unread > 0 && (
                    <div className="card-subtitle">{unread} unread</div>
                  )}
                </div>
                {unread > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="loading-spinner" style={{ padding: '24px' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 20).map(n => (
                    <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                      {!n.is_read && <span className="notif-dot" />}
                      <div style={{ flex: 1, marginLeft: n.is_read ? 17 : 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: severityColor[n.severity] || 'var(--text-primary)' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
