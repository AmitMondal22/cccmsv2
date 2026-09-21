import { useState, useEffect } from 'react';
import {
  Cpu, Zap, PowerOff, Wifi, WifiOff, AlertTriangle,
  Wrench, Battery, Clock, RefreshCw,
} from 'lucide-react';
import { getKPIs, getZoneSummary } from '../../api/dashboard.api.js';
import KpiCard from '../../components/common/KpiCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function timeAgo(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-IN');
}

export default function CommandCenter() {
  const [kpis, setKpis] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    try {
      const [kRes, zRes] = await Promise.all([getKPIs(), getZoneSummary()]);
      setKpis(kRes.data);
      setZones(zRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const kpiCards = kpis ? [
    { icon: Cpu,          label: 'Total Devices',   value: kpis.totalDevices?.toLocaleString(),  gradient: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', iconBg: 'rgba(79,142,247,0.15)', iconColor: '#4f8ef7' },
    { icon: Zap,          label: 'Lights ON',        value: kpis.lightsOn?.toLocaleString(),      gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', iconBg: 'rgba(34,197,94,0.15)',  iconColor: '#22c55e' },
    { icon: PowerOff,     label: 'Lights OFF',       value: kpis.lightsOff?.toLocaleString(),     gradient: 'linear-gradient(135deg,#6b7280,#4b5563)', iconBg: 'rgba(107,114,128,0.15)',iconColor: '#9ca3af' },
    { icon: Wifi,         label: 'Online',           value: kpis.online?.toLocaleString(),        gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', iconBg: 'rgba(34,197,94,0.15)',  iconColor: '#22c55e' },
    { icon: WifiOff,      label: 'Offline',          value: kpis.offline?.toLocaleString(),       gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', iconBg: 'rgba(239,68,68,0.15)',  iconColor: '#ef4444' },
    { icon: AlertTriangle,label: 'Active Faults',    value: kpis.activeFaults?.toLocaleString(),  gradient: 'linear-gradient(135deg,#f97316,#ea580c)', iconBg: 'rgba(249,115,22,0.15)', iconColor: '#f97316' },
    { icon: Battery,      label: 'Energy Today',     value: `${Number(kpis.energyToday).toLocaleString()} kWh`, gradient: 'linear-gradient(135deg,#38bdf8,#0891b2)', iconBg: 'rgba(56,189,248,0.15)', iconColor: '#38bdf8' },
    { icon: Clock,        label: 'Running Hours',    value: `${Number(kpis.runningHours).toLocaleString()} h`, gradient: 'linear-gradient(135deg,#a855f7,#7c3aed)', iconBg: 'rgba(168,85,247,0.15)',iconColor: '#a855f7' },
    { icon: Wrench,       label: 'Open Maintenance', value: kpis.openMaintenance?.toLocaleString(), gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', iconBg: 'rgba(245,158,11,0.15)', iconColor: '#f59e0b' },
  ] : [];

  // Mock mini chart data
  const miniChartData = Array.from({ length: 12 }, (_, i) => ({
    h: `${i * 2}:00`,
    online: Math.floor((kpis?.online || 20) * (0.9 + Math.random() * 0.1)),
    energy: Math.floor(Math.random() * 500 + 800),
  }));

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">Real-time street light monitoring dashboard</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Last updated: {timeAgo(lastRefresh)}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'pulse' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading && !kpis ? (
        <div className="loading-spinner"><div className="spinner" /> Loading dashboard...</div>
      ) : (
        <div className="kpi-grid">
          {kpiCards.map((card, i) => (
            <KpiCard key={i} {...card} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Device Connectivity — 24h Trend</div>
              <div className="card-subtitle">Online devices over time</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={miniChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="h" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="online" stroke="#22c55e" fill="url(#onlineGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Energy Consumption — 24h</div>
              <div className="card-subtitle">kWh per 2-hour interval</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={miniChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="h" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="energy" stroke="#38bdf8" fill="url(#energyGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Zone Summary Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Zone Performance Summary</div>
            <div className="card-subtitle">Device status breakdown by zone</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Code</th>
                <th>Total</th>
                <th>Online</th>
                <th>Offline</th>
                <th>Lights ON</th>
                <th>Lights OFF</th>
                <th>Faults</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {zones.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No zone data</td></tr>
              )}
              {zones.map(z => {
                const avail = z.totalDevices > 0 ? ((z.online / z.totalDevices) * 100).toFixed(1) : 0;
                return (
                  <tr key={z.id}>
                    <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{z.name}</td>
                    <td className="dim">{z.code || '—'}</td>
                    <td>{z.totalDevices}</td>
                    <td style={{ color: 'var(--online)' }}>{z.online}</td>
                    <td style={{ color: z.offline > 0 ? 'var(--offline)' : 'var(--text-muted)' }}>{z.offline}</td>
                    <td style={{ color: 'var(--on)' }}>{z.lightsOn}</td>
                    <td className="dim">{z.lightsOff}</td>
                    <td style={{ color: z.faults > 0 ? 'var(--fault)' : 'var(--text-muted)' }}>{z.faults}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${avail}%`, height: '100%', background: avail > 90 ? 'var(--online)' : avail > 70 ? 'var(--warning)' : 'var(--offline)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 36 }}>{avail}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
