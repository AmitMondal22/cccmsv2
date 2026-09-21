import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Cpu, Zap, PowerOff, Wifi, WifiOff, AlertTriangle,
  Wrench, Battery, Clock, RefreshCw, TrendingUp, Shield,
} from 'lucide-react';
import { getKPIs, getZoneSummary } from '../../api/dashboard.api.js';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

function timeAgo(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// Build stable chart data seeded from a value (not random every render)
function buildHourlyData(baseVal = 0, totalKwh = 0) {
  // Street-light profile: ON 18:00–06:00, OFF 07:00–17:00
  const profile = [0.65, 0.65, 0.65, 0.65, 0.70, 1.0, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35, 1.0, 1.0, 1.0, 0.80, 0.65, 0.65];
  return profile.map((factor, i) => ({
    h: `${i.toString().padStart(2, '0')}:00`,
    online: Math.round(baseVal * (factor > 0 ? (0.85 + factor * 0.15) : 0.5)),
    energy: parseFloat(((totalKwh / 24) * (factor > 0 ? factor * 2 : 0.01)).toFixed(2)),
    factor,
  }));
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
      setZones(Array.isArray(zRes.data) ? zRes.data : []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Stable chart data derived from real KPIs
  const chartData = useMemo(
    () => buildHourlyData(kpis?.online || 0, kpis?.energyToday || 0),
    [kpis?.online, kpis?.energyToday]
  );

  const totalDevices = kpis?.totalDevices || 0;
  const online = kpis?.online || 0;
  const warning = kpis?.warning || 0;
  const offline = kpis?.offline || 0;
  const lightsOn = kpis?.lightsOn || 0;
  const activeFaults = kpis?.activeFaults || 0;
  // Availability = online + warning (partial connectivity) out of total
  const connectedDevices = online + warning;
  const availabilityPct = totalDevices > 0 ? ((connectedDevices / totalDevices) * 100).toFixed(1) : '0.0';

  // Fleet health donut
  const healthData = useMemo(() => {
    const d = [];
    if (online > 0) d.push({ name: 'Online', value: online, fill: '#22c55e' });
    if (offline > 0) d.push({ name: 'Offline', value: offline, fill: '#ef4444' });
    if (activeFaults > 0) d.push({ name: 'Faults', value: activeFaults, fill: '#f97316' });
    if (d.length === 0) d.push({ name: 'No Devices', value: 1, fill: 'var(--border)' });
    return d;
  }, [online, offline, activeFaults]);

  const kpiCards = kpis ? [
    {
      icon: Cpu,
      label: 'Total Devices',
      value: totalDevices.toLocaleString(),
      unit: '',
      sub: `${totalDevices} registered luminaires`,
      iconBg: 'rgba(79, 142, 247, 0.12)',
      iconColor: '#4f8ef7',
      accent: '#4f8ef7',
      tag: 'Fleet',
      tagBg: 'rgba(79, 142, 247, 0.1)',
      tagColor: '#4f8ef7',
    },
    {
      icon: Zap,
      label: 'Lights ON',
      value: lightsOn.toLocaleString(),
      unit: '',
      sub: `${totalDevices > 0 ? ((lightsOn / totalDevices) * 100).toFixed(0) : 0}% of fleet burning`,
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#f59e0b',
      accent: '#f59e0b',
      tag: lightsOn > 0 ? 'Active' : 'Standby',
      tagBg: lightsOn > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.1)',
      tagColor: lightsOn > 0 ? '#f59e0b' : 'var(--text-muted)',
    },
    {
      icon: PowerOff,
      label: 'Lights OFF',
      value: (kpis.lightsOff ?? (totalDevices - lightsOn)).toLocaleString(),
      unit: '',
      sub: 'Inactive luminaires',
      iconBg: 'rgba(148, 163, 184, 0.12)',
      iconColor: '#94a3b8',
      accent: '#64748b',
      tag: 'Off',
      tagBg: 'rgba(148, 163, 184, 0.1)',
      tagColor: '#94a3b8',
    },
    {
      icon: Wifi,
      label: 'Online',
      value: online.toLocaleString(),
      unit: '',
      sub: 'Connected to gateway',
      iconBg: 'rgba(34, 197, 94, 0.12)',
      iconColor: '#22c55e',
      accent: '#22c55e',
      tag: online > 0 ? 'Healthy' : 'Zero',
      tagBg: online > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.1)',
      tagColor: online > 0 ? '#22c55e' : 'var(--text-muted)',
    },
    {
      icon: WifiOff,
      label: 'Offline',
      value: offline.toLocaleString(),
      unit: '',
      sub: offline > 0 ? 'Requires attention' : 'All devices linked',
      iconBg: offline > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.12)',
      iconColor: offline > 0 ? '#ef4444' : '#64748b',
      accent: offline > 0 ? '#ef4444' : '#64748b',
      tag: offline > 0 ? 'Attention' : 'None',
      tagBg: offline > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.1)',
      tagColor: offline > 0 ? '#ef4444' : '#22c55e',
    },
    {
      icon: AlertTriangle,
      label: 'Active Faults',
      value: activeFaults.toLocaleString(),
      unit: '',
      sub: activeFaults > 0 ? 'Unresolved alarms' : 'All systems normal',
      iconBg: activeFaults > 0 ? 'rgba(249, 115, 22, 0.12)' : 'rgba(34, 197, 94, 0.12)',
      iconColor: activeFaults > 0 ? '#f97316' : '#22c55e',
      accent: activeFaults > 0 ? '#f97316' : '#22c55e',
      tag: activeFaults > 0 ? 'Alert' : 'Good',
      tagBg: activeFaults > 0 ? 'rgba(249, 115, 22, 0.12)' : 'rgba(34, 197, 94, 0.1)',
      tagColor: activeFaults > 0 ? '#f97316' : '#22c55e',
    },
    {
      icon: Battery,
      label: 'Energy Today',
      value: Number(kpis.energyToday || 0).toFixed(2),
      unit: 'kWh',
      sub: `≈ ₹${(parseFloat(kpis.energyToday || 0) * 7.5).toFixed(0)} @ ₹7.50/kWh`,
      iconBg: 'rgba(56, 189, 248, 0.12)',
      iconColor: '#38bdf8',
      accent: '#38bdf8',
      tag: 'Today',
      tagBg: 'rgba(56, 189, 248, 0.1)',
      tagColor: '#38bdf8',
    },
    {
      icon: Clock,
      label: 'Running Hours',
      value: Number(kpis.runningHours || 0).toLocaleString(),
      unit: 'h',
      sub: 'Cumulative operational burn',
      iconBg: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#a855f7',
      accent: '#a855f7',
      tag: 'Total',
      tagBg: 'rgba(168, 85, 247, 0.1)',
      tagColor: '#a855f7',
    },
    {
      icon: Wrench,
      label: 'Open Maintenance',
      value: (kpis.openMaintenance ?? 0).toLocaleString(),
      unit: '',
      sub: kpis.openMaintenance > 0 ? 'Pending service tasks' : 'All tickets resolved',
      iconBg: kpis.openMaintenance > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 197, 94, 0.12)',
      iconColor: kpis.openMaintenance > 0 ? '#f59e0b' : '#22c55e',
      accent: kpis.openMaintenance > 0 ? '#f59e0b' : '#22c55e',
      tag: kpis.openMaintenance > 0 ? 'Open' : 'Clear',
      tagBg: kpis.openMaintenance > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 197, 94, 0.1)',
      tagColor: kpis.openMaintenance > 0 ? '#f59e0b' : '#22c55e',
    },
  ] : [];

  return (
    <div>
      {/* ── Page Header (unchanged) ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">Real-time street light monitoring dashboard</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Active Faults Pill — only shown when there are faults */}
          {activeFaults > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 20, padding: '4px 12px',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#f97316',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#f97316' }}>
                {activeFaults} ACTIVE FAULTS
              </span>
            </div>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Updated {timeAgo(lastRefresh)}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loading && !kpis ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ display: 'inline-block', marginBottom: 12 }} />
          <div>Loading live telemetry data...</div>
        </div>
      ) : (
        <>
          {/* 3x3 KPI Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            {kpiCards.map((card, i) => (
              <div
                key={i}
                className="kpi-card"
                style={{
                  // '--grad': `linear-gradient(90deg, ${card.accent}, ${card.accent}88)`,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--r-lg)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div
                      className="kpi-card-icon"
                      style={{
                        background: card.iconBg,
                        color: card.iconColor,
                        border: `1px solid ${card.iconColor}25`,
                        margin: 0,
                      }}
                    >
                      <card.icon size={18} />
                    </div>
                    {card.tag && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: card.tagBg,
                          color: card.tagColor,
                          border: `1px solid ${card.tagColor}30`,
                        }}
                      >
                        {card.tag}
                      </span>
                    )}
                  </div>
                  <div className="kpi-card-value" style={{ display: 'flex', alignItems: 'baseline', marginTop: 4 }}>
                    <span style={{ color: card.accent }}>{card.value ?? '—'}</span>
                    {card.unit && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 5 }}>
                        {card.unit}
                      </span>
                    )}
                  </div>
                  <div className="kpi-card-label" style={{ marginTop: 4 }}>{card.label}</div>
                </div>
                {/* {card.sub && (
                  <div className="kpi-card-sub" style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    {card.sub}
                  </div>
                )} */}
              </div>
            ))}
          </div>

          {/* ── Analytics Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 16, marginBottom: 20 }}>
            {/* Chart 1: Device Connectivity 24h */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                      display: 'inline-block', animation: 'pulse 1.5s infinite',
                    }} />
                    Device Connectivity — 24h Trend
                  </div>
                  <div className="card-subtitle">Online device count by hour (IST street light schedule)</div>
                </div>
              </div>
              <div style={{ padding: '8px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="h" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                      formatter={v => [v, 'Online Devices']}
                    />
                    <Area type="monotone" dataKey="online" stroke="#22c55e" fill="url(#onlineGrad)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Energy kWh 24h */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#38bdf8',
                      display: 'inline-block', animation: 'pulse 1.5s infinite',
                    }} />
                    Energy Consumption — 24h Profile
                  </div>
                  <div className="card-subtitle">Estimated kWh per hour (based on today's total)</div>
                </div>
              </div>
              <div style={{ padding: '8px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="h" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                      formatter={v => [`${v} kWh`, 'Energy']}
                    />
                    <Area type="monotone" dataKey="energy" stroke="#38bdf8" fill="url(#energyGrad)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Fleet Health Donut */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Fleet Health</div>
                  <div className="card-subtitle">Device status breakdown</div>
                </div>
              </div>
              <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%" cy="50%"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {healthData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                  {[
                    { label: 'Online', value: online, color: '#22c55e' },
                    { label: 'Offline', value: offline, color: '#ef4444' },
                    { label: 'Faults', value: activeFaults, color: '#f97316' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Zone Performance Table ── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Zone Performance Matrix</div>
                <div className="card-subtitle">Real-time device status breakdown by operational zone</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone Name</th>
                    <th>Code</th>
                    <th>Total</th>
                    <th>Online</th>
                    <th>Offline</th>
                    <th>Lights ON</th>
                    <th>Lights OFF</th>
                    <th>Faults</th>
                    <th>Availability</th>
                    <th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No zone data available
                      </td>
                    </tr>
                  )}
                  {zones.map(z => {
                    const avail = z.totalDevices > 0 ? ((z.online / z.totalDevices) * 100) : 0;
                    const health = avail >= 95 ? 'excellent' : avail >= 80 ? 'good' : avail >= 60 ? 'degraded' : 'critical';
                    const hColor = { excellent: '#22c55e', good: '#38bdf8', degraded: '#f59e0b', critical: '#ef4444' }[health];
                    const hLabel = { excellent: 'Excellent', good: 'Good', degraded: 'Degraded', critical: 'Critical' }[health];
                    return (
                      <tr key={z.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: hColor, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{z.name}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, padding: '2px 8px',
                            background: 'rgba(79,142,247,0.1)',
                            border: '1px solid rgba(79,142,247,0.2)',
                            borderRadius: 4, color: '#4f8ef7', fontWeight: 600,
                          }}>
                            {z.code || '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{z.totalDevices}</td>
                        <td style={{ color: '#22c55e', fontWeight: 700 }}>{z.online}</td>
                        <td style={{ color: z.offline > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: z.offline > 0 ? 700 : 400 }}>{z.offline}</td>
                        <td style={{ color: '#f59e0b', fontWeight: 600 }}>{z.lightsOn}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{z.lightsOff}</td>
                        <td>
                          {z.faults > 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>
                              ⚠ {z.faults}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                width: `${avail}%`, height: '100%', background: hColor,
                                borderRadius: 4, transition: 'width 0.8s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: hColor, minWidth: 38 }}>
                              {avail.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px',
                            fontSize: 11, fontWeight: 600, borderRadius: 20,
                            background: `${hColor}18`, color: hColor, border: `1px solid ${hColor}35`,
                          }}>
                            {hLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
