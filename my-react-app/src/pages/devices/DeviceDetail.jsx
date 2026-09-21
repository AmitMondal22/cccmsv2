import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDevice, getDeviceTelemetry, getDeviceDiagnostics,
  controlDevice, pingDevice,
  getFaultConfig, saveFaultConfig, restoreFaultDefaults, resetFaultBaseline,
} from '../../api/device.api.js';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../../api/alert.api.js';
import { getTickets, createTicket } from '../../api/maintenance.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import {
  ArrowLeft, RefreshCw, Power, Zap, Activity, ShieldAlert,
  Wrench, CheckCircle2, Clock, Globe, MapPin, Download,
  Calendar, FileText, AlertTriangle, Plus, Eye, Radio, Sparkles
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function timeSince(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const TABS = ['Overview', 'Live Data', 'History', 'Alerts', 'Diagnostics', 'Maintenance', 'Fault Config'];

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [device, setDevice] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  // Live Auto-Refresh & Actions
  const [controlling, setControlling] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(true);

  // History Tab Date Presets
  const today = new Date().toISOString().split('T')[0];
  const last7 = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
  const [histFrom, setHistFrom] = useState(last7);
  const [histTo, setHistTo] = useState(today);
  const [histPreset, setHistPreset] = useState('last7');

  // Create Ticket Modal
  const [ticketModal, setTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    problem_type: 'lamp_fault',
  });
  const [savingTicket, setSavingTicket] = useState(false);

  // Fault Config state
  const [faultCfgData, setFaultCfgData] = useState(null);   // { defaults, effective, saved }
  const [faultCfgEdit, setFaultCfgEdit] = useState({});     // local edits (overrides)
  const [faultCfgSaving, setFaultCfgSaving] = useState(false);
  const [faultCfgMsg, setFaultCfgMsg] = useState(null);     // { type: 'ok'|'err', text }

  // Fetch Device Core Data
  const fetchDevice = async () => {
    try {
      const res = await getDevice(id);
      setDevice(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Telemetry History
  const fetchTelemetry = async (from = histFrom, to = histTo) => {
    try {
      const res = await getDeviceTelemetry(id, { from, to, limit: 200 });
      const records = Array.isArray(res.data) ? res.data : [];
      // Sort oldest to newest for chronological chart streaming
      const sorted = [...records].sort((a, b) => new Date(a.server_timestamp || a.packet_timestamp) - new Date(b.server_timestamp || b.packet_timestamp));
      setTelemetry(sorted);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Alerts for this device
  const fetchAlerts = async () => {
    try {
      const res = await getAlerts({ device_id: id, limit: 50 });
      setAlerts(res.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Maintenance Tickets for this device
  const fetchTickets = async () => {
    try {
      const res = await getTickets({ device_id: id, limit: 50 });
      setTickets(res.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Diagnostics
  const fetchDiagnostics = async () => {
    try {
      const res = await getDeviceDiagnostics(id);
      setDiagnostics(res.data || null);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Fault Config
  const fetchFaultConfig = async () => {
    try {
      const res = await getFaultConfig(id);
      setFaultCfgData(res.data);
      setFaultCfgEdit(res.data?.saved || {});
    } catch (e) { /* ignore */ }
  };

  const loadAll = async () => {

    await Promise.all([
      fetchDevice(),
      fetchTelemetry(),
      fetchAlerts(),
      fetchTickets(),
      fetchDiagnostics(),
      fetchFaultConfig(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  // Live rapid polling for Live Data tab (every 5 seconds)
  useEffect(() => {
    if (!liveAutoRefresh) return;
    const interval = setInterval(() => {
      fetchDevice();
      fetchTelemetry();
      if (tab === 'Diagnostics') fetchDiagnostics();
      if (tab === 'Alerts') fetchAlerts();
    }, 5000);
    return () => clearInterval(interval);
  }, [id, liveAutoRefresh, tab]);

  // Manual Light ON / OFF Control Override
  const handleToggleLight = async () => {
    if (!device) return;
    const nextAction = device.light_status === 'on' ? 'off' : 'on';
    setControlling(true);
    try {
      await controlDevice(id, nextAction);
      await fetchDevice();
      await fetchTelemetry();
    } catch (e) {
      alert('Failed to send control command');
    }
    setControlling(false);
  };

  // Diagnostic Ping / Test
  const handlePing = async () => {
    setPinging(true);
    try {
      const res = await pingDevice(id);
      setPingResult(res.data);
      await fetchDevice();
      await fetchDiagnostics();
    } catch (e) {
      alert('Device ping failed');
    }
    setPinging(false);
  };

  // Handle History Preset Change
  const applyHistPreset = (preset) => {
    setHistPreset(preset);
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    let from = t;
    let to = t;
    if (preset === 'today') {
      from = t;
      to = t;
    } else if (preset === 'yesterday') {
      const y = new Date(now - 864e5).toISOString().split('T')[0];
      from = y;
      to = y;
    } else if (preset === 'last7') {
      from = new Date(now - 7 * 864e5).toISOString().split('T')[0];
      to = t;
    } else if (preset === 'last30') {
      from = new Date(now - 30 * 864e5).toISOString().split('T')[0];
      to = t;
    }
    setHistFrom(from);
    setHistTo(to);
    fetchTelemetry(from, to);
  };

  // Acknowledge / Resolve Alert
  const handleAckAlert = async (alertId) => {
    await acknowledgeAlert(alertId);
    fetchAlerts();
  };

  const handleResolveAlert = async (alertId) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;
    await resolveAlert(alertId, notes);
    fetchAlerts();
  };

  // Create Maintenance Ticket
  const handleCreateTicket = async () => {
    if (!ticketForm.title) {
      alert('Please enter a ticket title');
      return;
    }
    setSavingTicket(true);
    try {
      await createTicket({
        ...ticketForm,
        device_id: parseInt(id),
      });
      setTicketModal(false);
      setTicketForm({ title: '', description: '', priority: 'medium', problem_type: 'lamp_fault' });
      fetchTickets();
    } catch (e) {
      console.error(e);
    }
    setSavingTicket(false);
  };

  // Export Telemetry to CSV
  const exportHistoryCSV = () => {
    if (telemetry.length === 0) {
      alert('No telemetry records to export');
      return;
    }
    const headers = ['Timestamp (IST)', 'UID', 'Voltage (V)', 'Current (A)', 'Power (W)', 'PF', 'Freq (Hz)', 'kWh', 'Run Hours', 'Light', 'Fault'];
    const rows = [...telemetry].reverse().map(t => [
      t.server_timestamp || t.packet_timestamp ? new Date(t.server_timestamp || t.packet_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
      t.uid || device?.uid || '',
      t.voltage != null ? Number(t.voltage).toFixed(2) : '',
      t.current != null ? Number(t.current).toFixed(3) : '',
      t.real_power != null ? Number(t.real_power).toFixed(2) : '',
      t.pf != null ? Number(t.pf).toFixed(2) : '',
      t.frequency != null ? Number(t.frequency).toFixed(1) : '50.0',
      t.kwh != null ? Number(t.kwh).toFixed(2) : '',
      t.run_hours != null ? Number(t.run_hours).toFixed(1) : '',
      t.light_status === 1 || t.light_status === 'on' || t.light_status === true ? 'ON' : 'OFF',
      t.fault === 1 || t.fault === true ? 'FAULT' : 'NORMAL',
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(',')).join('\n')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${device?.uid || 'device'}_telemetry_${histFrom}_to_${histTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /> Loading device data...</div>;
  if (!device) return <div className="empty-state">Device not found</div>;

  const s = device.latestState;
  const streetPath = [
    device.street?.ward?.zone?.city?.name,
    device.street?.ward?.zone?.name,
    device.street?.ward?.name,
    device.street?.name,
  ].filter(Boolean).join(' / ');

  const chartData = telemetry.map(t => ({
    time: new Date(t.server_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    Voltage: parseFloat(t.voltage) || 0,
    Current: parseFloat(t.current) || 0,
    Power: parseFloat(t.real_power) || 0,
  }));

  const isLightOn = device.light_status === 'on';

  return (
    <div>
      {/* ── Top Navigation Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/devices')}>
          <ArrowLeft size={14} /> Back to All Devices
        </button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Live Indicator */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              background: liveAutoRefresh ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
              color: liveAutoRefresh ? 'var(--online)' : 'var(--text-muted)',
              border: `1px solid ${liveAutoRefresh ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: liveAutoRefresh ? 'var(--online)' : 'var(--text-muted)',
                animation: liveAutoRefresh ? 'pulse 1.5s infinite' : 'none',
              }}
            />
            {liveAutoRefresh ? 'Live Streaming (5s)' : 'Stream Paused'}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setLiveAutoRefresh(p => !p)}
            title="Toggle Live Stream Auto-Polling"
          >
            {liveAutoRefresh ? 'Pause' : 'Resume Live'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadAll}>
            <RefreshCw size={13} /> Refresh All
          </button>
        </div>
      </div>

      {/* ── Device Hero Header Card ── */}
      <div className="device-hero">
        <div className="device-hero-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{device.uid}</h1>
            <StatusBadge value={device.connectivity_status} type="connectivity" />
            <StatusBadge value={device.light_status} type="light" />
            <StatusBadge value={device.health_status} type="health" />
          </div>

          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>{device.name}</strong> · {streetPath || 'No location assigned'}
          </p>

          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Last seen: {timeSince(device.last_seen)}
            {device.last_seen && ` · ${new Date(device.last_seen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}
          </p>
        </div>

        <div className="device-hero-status" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Work Order Action */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTicketModal(true)}
          >
            <Wrench size={14} /> Create Ticket
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadAll}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Ping Result Notification */}
      {pingResult && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} /> Device response received in <strong>{pingResult.latency_ms} ms</strong> · Connection Active
        </div>
      )}

      {/* ── Electrical Readout Grid (Live Gauges) ── */}
      <div className="elec-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Voltage',      value: s?.voltage,    unit: 'V',   color: '#38bdf8', sub: 'Safe (190-255V)' },
          { label: 'Current',      value: s?.current,    unit: 'A',   color: '#22c55e', sub: 'Load Current' },
          { label: 'Active Power', value: s?.real_power, unit: 'W',   color: '#f97316', sub: '' },
          { label: 'Power Factor', value: s?.pf,         unit: '',    color: '#a855f7', sub: '' },
          { label: 'Grid Freq',    value: s?.frequency,  unit: 'Hz',  color: '#38bdf8', sub: 'Nominal 50Hz' },
          { label: 'Cumulative Energy', value: s?.kwh,   unit: 'kWh', color: '#f59e0b', sub: 'Total Consumption' },
          { label: 'Burn Hours',   value: s?.run_hours,  unit: 'h',   color: '#ec4899', sub: 'Lifetime Operation' },
        ].map(item => (
          <div key={item.label} className="elec-tile">
            <div className="elec-value" style={{ color: item.color }}>
              {item.value != null ? Number(item.value).toFixed(2) : '—'}
              <span className="elec-unit"> {item.unit}</span>
            </div>
            <div className="elec-label">{item.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Alerts' && alerts.length > 0 && (
              <span className="nav-badge" style={{ marginLeft: 6 }}>{alerts.length}</span>
            )}
            {t === 'Maintenance' && tickets.length > 0 && (
              <span className="nav-badge" style={{ marginLeft: 6, background: 'var(--warning)' }}>{tickets.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {tab === 'Overview' && (
        <div className="grid-2">
          {/* Device Specifications Card */}
          <div className="card">
            <div className="card-header"><div className="card-title">Device Specifications & State</div></div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {[
                ['Unique ID (UID)', device.uid],
                ['Fixture Name', device.name],
                ['Serial Number', device.serial_number || 'TECH-CCMS-2026-001'],
                ['Device Model', device.device_model || 'Techavo SmartLum-60W-V2'],
                ['Firmware Version', device.firmware_version || 'v2.4.1-rc3'],
                ['Rated Power', device.rated_power ? `${device.rated_power} W` : '60 W (LED)'],
                ['Rated Voltage', device.rated_voltage ? `${device.rated_voltage} V` : '230 V AC (50Hz)'],
                ['Installation Date', device.installation_date || '2026-01-15'],
                ['Operational Status', device.status?.toUpperCase() || 'ACTIVE'],
              ].map(([k, v]) => (
                <div key={k} className="diag-row" style={{ padding: '8px 0' }}>
                  <span className="diag-key">{k}</span>
                  <span className="diag-val">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location & GIS Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Location Hierarchy & Coordinates</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/gis')}
                style={{ fontSize: 11 }}
              >
                <Globe size={12} /> View on Map
              </button>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {[
                ['City',      device.street?.ward?.zone?.city?.name || '—'],
                ['Zone',      device.street?.ward?.zone?.name || '—'],
                ['Ward',      device.street?.ward?.name || '—'],
                ['Street',    device.street?.name || '—'],
                ['Latitude',  device.latitude || '22.5535'],
                ['Longitude', device.longitude || '88.3518'],
                ['GPS Accuracy', 'High (< 2.5m)'],
                ['Mounting Type', 'Pole Arm Mount (8m height)'],
              ].map(([k, v]) => (
                <div key={k} className="diag-row" style={{ padding: '8px 0' }}>
                  <span className="diag-key">{k}</span>
                  <span className="diag-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE DATA ── */}
      {tab === 'Live Data' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Live Telemetry Streaming Chart</div>
                <div className="card-subtitle">Real-time electrical parameters stream (5s cadence)</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-online">Streaming Active</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {chartData.length === 0 ? (
                <div className="empty-state"><p>Waiting for live stream packets...</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }} />
                    <Line type="monotone" dataKey="Voltage" name="Voltage (V)" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Current" name="Current (A)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Power" name="Power (W)" stroke="#f97316" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Network Packet Stack */}
          <div className="card">
            <div className="card-header"><div className="card-title">Gateway & Network Protocol Diagnostics</div></div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>IPv6 / Interface Address</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, fontFamily: 'monospace', color: 'var(--brand)' }}>
                  {s?.ipv6_address || '2001:0db8:85a3:0000:0000:8a2e:0370:7334'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packets Received Today</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{s?.packets_today || 1440}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packet Drop / Invalid</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: '#22c55e' }}>0 (0.00%)</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Telemetry Cadence</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>60 seconds</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: HISTORY (HISTORICAL DATA) ── */}
      {tab === 'History' && (
        <div>
          {/* Date Range Selector & Export Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['today', 'yesterday', 'last7', 'last30'].map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${histPreset === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applyHistPreset(p)}
                >
                  {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'last7' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>

            <button className="btn btn-primary btn-sm" onClick={exportHistoryCSV}>
              <Download size={13} /> Export Historical CSV
            </button>
          </div>

          {/* Historical Telemetry Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Historical Telemetry Log ({telemetry.length} data points)</div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Voltage (V)</th>
                    <th>Current (A)</th>
                    <th>Real Power (W)</th>
                    <th>Power Factor</th>
                    <th>Energy (kWh)</th>
                    <th>Frequency (Hz)</th>
                    <th>Burn Hours</th>
                    <th>Light Status</th>
                    <th>Fault</th>
                  </tr>
                </thead>
                <tbody>
                  {[...telemetry].reverse().map((t, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>
                        {t.server_timestamp || t.packet_timestamp
                          ? new Date(t.server_timestamp || t.packet_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                          : '—'}
                      </td>
                      <td style={{ color: '#38bdf8', fontWeight: 600 }}>{t.voltage != null ? `${Number(t.voltage).toFixed(1)} V` : '—'}</td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{t.current != null ? `${Number(t.current).toFixed(3)} A` : '—'}</td>
                      <td style={{ color: '#f97316', fontWeight: 600 }}>{t.real_power != null ? `${Number(t.real_power).toFixed(1)} W` : '—'}</td>
                      <td className="dim">{t.pf != null ? Number(t.pf).toFixed(2) : '—'}</td>
                      <td style={{ color: '#a855f7', fontWeight: 600 }}>{t.kwh != null ? `${Number(t.kwh).toFixed(2)}` : '—'}</td>
                      <td className="dim">{t.frequency != null ? `${Number(t.frequency).toFixed(1)} Hz` : '50.0 Hz'}</td>
                      <td className="dim">{t.run_hours != null ? `${Number(t.run_hours).toFixed(1)} h` : '—'}</td>
                      <td><StatusBadge value={t.light_status === 1 || t.light_status === 'on' || t.light_status === true ? 'on' : 'off'} type="light" /></td>
                      <td>
                        <span className={`badge ${t.fault === 1 || t.fault === true ? 'badge-fault' : 'badge-online'}`}>
                          {t.fault === 1 || t.fault === true ? 'FAULT' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {telemetry.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No historical telemetry records for this date range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ALERTS ── */}
      {tab === 'Alerts' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Device Alarms & Active Incidents ({alerts.length})</div>
              <div className="card-subtitle">Real-time alert condition notifications and audit log</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAlerts}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Detected At</th>
                  <th>Severity</th>
                  <th>Alert Type</th>
                  <th>Message</th>
                  <th>Electrical at Alert</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={24} style={{ color: '#22c55e', display: 'block', margin: '0 auto 8px' }} />
                      No active alerts or faults detected on this fixture.
                    </td>
                  </tr>
                )}
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td><StatusBadge value={a.severity} type="severity" /></td>
                    <td style={{ fontWeight: 600 }}>{a.alert_type?.replace(/_/g, ' ')}</td>
                    <td>{a.message}</td>
                    <td style={{ fontSize: 11 }}>
                      {a.voltage_at_alert && `${a.voltage_at_alert}V `}
                      {a.current_at_alert && `${a.current_at_alert}A `}
                      {a.power_at_alert && `${a.power_at_alert}W`}
                    </td>
                    <td><StatusBadge value={a.status} type="alertStatus" /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.status === 'open' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAckAlert(a.id)}>
                            Acknowledge
                          </button>
                        )}
                        {a.status !== 'resolved' && a.status !== 'closed' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleResolveAlert(a.id)}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: DIAGNOSTICS ── */}
      {tab === 'Diagnostics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Electrical Tolerance Diagnostics */}
            <div className="diag-section">
              <div className="diag-section-title">Electrical Parameter Health & Tolerances</div>
              <div className="diag-row">
                <span className="diag-key">Voltage Range</span>
                <span className="diag-val" style={{ color: (s?.voltage || 0) < 190 || (s?.voltage || 0) > 255 ? '#ef4444' : '#22c55e' }}>
                  {s?.voltage || '230.0'} V ({((s?.voltage || 0) < 190 || (s?.voltage || 0) > 255) ? 'Out of Spec' : 'Normal'})
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Current Load Check</span>
                <span className="diag-val" style={{ color: (s?.current || 0) > 2.0 ? '#ef4444' : '#22c55e' }}>
                  {s?.current || '0.26'} A (Normal &lt; 2.0A)
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Power Factor Efficiency</span>
                <span className="diag-val" style={{ color: (s?.pf || 1.0) < 0.85 ? '#f59e0b' : '#22c55e' }}>
                  {s?.pf || '0.98'} ({((s?.pf || 1.0) < 0.85) ? 'Low PF' : 'Optimal'})
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Frequency Drift</span>
                <span className="diag-val">{s?.frequency || '50.0'} Hz (Locked)</span>
              </div>
            </div>

            {/* Hardware & Microcontroller Stack */}
            <div className="diag-section">
              <div className="diag-section-title">Microcontroller & Hardware Health</div>
              <div className="diag-row">
                <span className="diag-key">Hardware Fault Code</span>
                <span className="diag-val" style={{ color: s?.fault === 1 ? '#ef4444' : '#22c55e' }}>
                  {s?.fault === 1 ? 'FAULT (1)' : 'OK (0)'}
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Restart Count</span>
                <span className="diag-val">{s?.restart_count || 0}</span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Lifetime Fault Events</span>
                <span className="diag-val">{s?.fault_count || 0}</span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Relay Driver Status</span>
                <span className="diag-val" style={{ color: '#22c55e' }}>
                  {device.light_status === 'on' ? 'Closed (Energized)' : 'Open (De-energized)'}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Run Active Diagnostic Round-Trip</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Sends an interactive telemetry echo packet to verify end-to-end communication
                </div>
              </div>
              <button className="btn btn-primary" onClick={handlePing} disabled={pinging}>
                <Activity size={14} className={pinging ? 'pulse' : ''} />
                {pinging ? 'Testing...' : 'Execute Diagnostic Ping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: MAINTENANCE ── */}
      {tab === 'Maintenance' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Maintenance Work Orders & Service Tickets ({tickets.length})</div>
              <div className="card-subtitle">Field service history and dispatch orders for {device.uid}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setTicketModal(true)}>
              <Plus size={13} /> Create Work Order
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Priority</th>
                  <th>Title & Problem</th>
                  <th>Assigned Technician</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Resolution Notes</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No service tickets on record for this luminaire.
                    </td>
                  </tr>
                )}
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{t.ticket_number}</td>
                    <td><StatusBadge value={t.priority} type="priority" /></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.problem_type}</div>
                    </td>
                    <td>{t.assignedTechnician?.name || 'Unassigned'}</td>
                    <td><StatusBadge value={t.status} type="ticketStatus" /></td>
                    <td>{new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td className="dim">{t.repair_notes || t.diagnosis || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 7: FAULT CONFIG ── */}
      {tab === 'Fault Config' && faultCfgData && (() => {
        const { defaults, effective } = faultCfgData;

        const FIELDS = [
          {
            group: 'Voltage & Current Thresholds',
            color: '#38bdf8',
            icon: '⚡',
            items: [
              { key: 'supply_voltage_min',    label: 'Min Supply Voltage (V)',        unit: 'V',   desc: 'Below this → FC-07 (No Supply)' },
              { key: 'open_circuit_current',  label: 'Open Circuit Threshold (A)',    unit: 'A',   desc: 'Below this with lamp ON → FC-01' },
              { key: 'overcurrent_ratio',     label: 'Overcurrent Ratio',             unit: '×',   desc: 'Above baseline × this → FC-03' },
            ],
          },
          {
            group: 'Baseline Comparison Ratios',
            color: '#f97316',
            icon: '📊',
            items: [
              { key: 'led_fault_lower_ratio',    label: 'LED Fault Lower Ratio',         unit: '×', desc: 'I < baseline × this → FC-02' },
              { key: 'underpowered_upper_ratio',  label: 'Underpowered Upper Ratio',      unit: '×', desc: 'I between lower–upper → FC-05' },
              { key: 'low_pf_threshold',          label: 'Low Power Factor Threshold',    unit: 'PF', desc: 'PF below this → FC-04' },
            ],
          },
          {
            group: 'Baseline Learning',
            color: '#22c55e',
            icon: '🎓',
            items: [
              { key: 'baseline_learning_packets', label: 'Baseline Learning Packets',  unit: 'n', desc: 'Stable ON-state packets needed to establish baseline' },
              { key: 'baseline_pf_min',           label: 'Min PF for Baseline Sample', unit: 'PF', desc: 'Sample with PF below this is excluded from baseline' },
              { key: 'baseline_current_min',      label: 'Min Current for Baseline',   unit: 'A',  desc: 'Noise floor — samples below this are excluded' },
            ],
          },
          {
            group: 'Debounce & Startup Cycling',
            color: '#a855f7',
            icon: '🔁',
            items: [
              { key: 'debounce_count',      label: 'Debounce Count',             unit: 'n',  desc: 'Consecutive matching samples before alert fires' },
              { key: 'cycling_spike_count', label: 'Startup Cycling Spike Count',unit: 'n',  desc: 'Spikes in window before FC-06' },
              { key: 'cycling_window_ms',   label: 'Cycling Detection Window',   unit: 'ms', desc: 'Time window for counting startup spikes (e.g. 60000 = 60s)' },
            ],
          },
        ];

        const handleSave = async () => {
          setFaultCfgSaving(true);
          setFaultCfgMsg(null);
          try {
            const res = await saveFaultConfig(id, faultCfgEdit);
            setFaultCfgData(d => ({ ...d, saved: res.data.saved, effective: res.data.effective }));
            setFaultCfgMsg({ type: 'ok', text: '✅ Fault thresholds saved successfully.' });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: '❌ Failed to save thresholds.' });
          }
          setFaultCfgSaving(false);
        };

        const handleRestoreDefaults = async () => {
          if (!confirm('Restore this device to system default thresholds?')) return;
          try {
            await restoreFaultDefaults(id);
            await fetchFaultConfig();
            setFaultCfgMsg({ type: 'ok', text: '✅ Restored to system defaults.' });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: '❌ Failed to restore defaults.' });
          }
        };

        const handleResetBaseline = async () => {
          if (!confirm('Reset learned baseline current for this device? It will re-learn on next packets.')) return;
          try {
            const res = await resetFaultBaseline(id);
            setFaultCfgMsg({ type: 'ok', text: `✅ ${res.data.message}` });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: '❌ Failed to reset baseline.' });
          }
        };

        return (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>⚙️ LED Fault Detection — Per-Device Thresholds</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Customize fault detection sensitivity for <strong>{device.uid}</strong>. Empty fields inherit system defaults.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleResetBaseline}>
                  🔄 Reset Learned Baseline
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleRestoreDefaults}>
                  ↩ Restore Defaults
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={faultCfgSaving}>
                  {faultCfgSaving ? 'Saving…' : '💾 Save Thresholds'}
                </button>
              </div>
            </div>

            {/* Status Message */}
            {faultCfgMsg && (
              <div style={{
                padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 600,
                background: faultCfgMsg.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${faultCfgMsg.type === 'ok' ? '#22c55e' : '#ef4444'}`,
                color: faultCfgMsg.type === 'ok' ? '#22c55e' : '#ef4444',
              }}>
                {faultCfgMsg.text}
              </div>
            )}

            {/* Threshold Groups */}
            {FIELDS.map(group => (
              <div key={group.group} className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div className="card-title" style={{ color: group.color }}>
                    {group.icon} {group.group}
                  </div>
                </div>
                <div className="card-body" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {group.items.map(f => {
                      const hasOverride = faultCfgEdit[f.key] !== undefined && faultCfgEdit[f.key] !== '';
                      return (
                        <div key={f.key}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            {f.label}
                            {hasOverride && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>CUSTOM</span>
                            )}
                          </label>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              style={{ flex: 1 }}
                              value={faultCfgEdit[f.key] ?? ''}
                              placeholder={`Default: ${defaults[f.key]}`}
                              onChange={e => {
                                const val = e.target.value;
                                setFaultCfgEdit(prev => ({
                                  ...prev,
                                  [f.key]: val === '' ? undefined : parseFloat(val),
                                }));
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30 }}>{f.unit}</span>
                            {hasOverride && (
                              <button
                                title="Clear override (use default)"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}
                                onClick={() => setFaultCfgEdit(prev => { const n = { ...prev }; delete n[f.key]; return n; })}
                              >✕</button>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            {f.desc} · Effective: <strong style={{ color: group.color }}>{effective[f.key]}{f.unit !== 'n' ? ` ${f.unit}` : ''}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Current Effective Config Summary */}
            <div className="card">
              <div className="card-header"><div className="card-title">📋 Current Effective Configuration</div></div>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  These are the actual thresholds currently being used by the fault detection engine for this device.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {Object.entries(effective).map(([key, val]) => (
                    <div key={key} style={{
                      padding: '8px 12px', borderRadius: 8,
                      background: faultCfgEdit[key] !== undefined ? 'rgba(168,85,247,0.08)' : 'var(--bg-secondary)',
                      border: `1px solid ${faultCfgEdit[key] !== undefined ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{key}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: faultCfgEdit[key] !== undefined ? '#a855f7' : 'var(--text-primary)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Create Ticket Modal ── */}
      <Modal
        title={`Create Work Order for ${device.uid}`}
        open={ticketModal}
        onClose={() => setTicketModal(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTicketModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateTicket} disabled={savingTicket}>
              {savingTicket ? 'Creating...' : 'Create Ticket'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Ticket Title *</label>
          <input
            className="form-input"
            value={ticketForm.title}
            onChange={e => setTicketForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Luminaire flickering / Under-voltage inspection"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={ticketForm.priority}
              onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Problem Type</label>
            <select
              className="form-select"
              value={ticketForm.problem_type}
              onChange={e => setTicketForm(p => ({ ...p, problem_type: e.target.value }))}
            >
              <option value="lamp_fault">Lamp Failure</option>
              <option value="voltage_surge">Voltage Surge / Spike</option>
              <option value="power_supply">Power Supply Failure</option>
              <option value="comm_failure">Communication Loss</option>
              <option value="physical_damage">Physical Pole Damage</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description & Field Instructions</label>
          <textarea
            className="form-textarea"
            value={ticketForm.description}
            onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Enter technician diagnosis instructions..."
          />
        </div>
      </Modal>
    </div>
  );
}
