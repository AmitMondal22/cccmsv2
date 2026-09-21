import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDevices } from '../../api/device.api.js';
import { getCities, getZones, getWards, getStreets } from '../../api/organization.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import {
  RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2,
  Zap, Activity, ShieldAlert, Stethoscope, SlidersHorizontal
} from 'lucide-react';

function timeSince(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Categorize device diagnostic status
function getDiagnosticCategory(device) {
  const s = device.latestState;
  const isOffline = device.connectivity_status === 'offline';
  const v = parseFloat(s?.voltage || 0);
  const i = parseFloat(s?.current || 0);
  const pf = parseFloat(s?.pf || 1.0);
  const fault = parseInt(s?.fault || 0);

  if (isOffline) return 'comm_fail';
  if (fault === 1 || device.health_status === 'fault') return 'fault';
  if (v > 255) return 'over_voltage';
  if (v > 0 && v < 190) return 'under_voltage';
  if (i > 2.0) return 'over_current';
  if (device.light_status === 'on' && i < 0.03) return 'lamp_fail';
  if (pf > 0 && pf < 0.85) return 'low_pf';
  return 'healthy';
}

const DIAGNOSTIC_FILTERS = [
  { id: 'all', label: 'All Devices', icon: Activity, color: 'var(--brand)' },
  { id: 'healthy', label: 'Healthy / Normal', icon: CheckCircle2, color: 'var(--online)' },
  { id: 'over_voltage', label: 'Overvoltage (>255V)', icon: Zap, color: '#f97316' },
  { id: 'under_voltage', label: 'Undervoltage (<190V)', icon: AlertTriangle, color: '#eab308' },
  { id: 'over_current', label: 'Overcurrent (>2A)', icon: ShieldAlert, color: '#ef4444' },
  { id: 'lamp_fail', label: 'Lamp Fault / Load Drop', icon: AlertTriangle, color: '#dc2626' },
  { id: 'low_pf', label: 'Low PF (<0.85)', icon: SlidersHorizontal, color: '#a855f7' },
  { id: 'comm_fail', label: 'Offline / Comm Lost', icon: WifiOff, color: '#ef4444' },
];

export default function LiveMonitoring() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Hierarchy Filters
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [streets, setStreets] = useState([]);

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedStreet, setSelectedStreet] = useState('');
  const [diagFilter, setDiagFilter] = useState('all');

  const fetchHierarchy = async () => {
    try {
      const [c, z, w, s] = await Promise.all([
        getCities(), getZones(), getWards(), getStreets()
      ]);
      setCities(c.data || []);
      setZones(z.data || []);
      setWards(w.data || []);
      setStreets(s.data || []);
    } catch {}
  };

  const fetch = async () => {
    try {
      const params = { limit: 200 };
      if (selectedCity) params.city_id = selectedCity;
      if (selectedZone) params.zone_id = selectedZone;
      if (selectedWard) params.ward_id = selectedWard;
      if (selectedStreet) params.street_id = selectedStreet;

      const res = await getDevices(params);
      setDevices(res.data.data || []);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [selectedCity, selectedZone, selectedWard, selectedStreet]);

  // Filter Zones/Wards dynamically
  const filteredZones = useMemo(() => {
    if (!selectedCity) return zones;
    return zones.filter(z => String(z.city_id) === String(selectedCity));
  }, [zones, selectedCity]);

  const filteredWards = useMemo(() => {
    if (!selectedZone) return wards;
    return wards.filter(w => String(w.zone_id) === String(selectedZone));
  }, [wards, selectedZone]);

  const filteredStreets = useMemo(() => {
    if (!selectedWard) return streets;
    return streets.filter(s => String(s.ward_id) === String(selectedWard));
  }, [streets, selectedWard]);

  // Apply Diagnostic condition filter
  const categorizedDevices = useMemo(() => {
    return devices.map(d => ({
      ...d,
      diagCategory: getDiagnosticCategory(d),
    }));
  }, [devices]);

  // Counts per diagnostic category
  const diagnosticCounts = useMemo(() => {
    const counts = { all: categorizedDevices.length, healthy: 0, over_voltage: 0, under_voltage: 0, over_current: 0, lamp_fail: 0, low_pf: 0, comm_fail: 0 };
    categorizedDevices.forEach(d => {
      if (counts[d.diagCategory] !== undefined) {
        counts[d.diagCategory]++;
      }
    });
    return counts;
  }, [categorizedDevices]);

  const filteredDevices = useMemo(() => {
    if (diagFilter === 'all') return categorizedDevices;
    return categorizedDevices.filter(d => d.diagCategory === diagFilter);
  }, [categorizedDevices, diagFilter]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Monitoring & Alert-Wise Diagnostics</h1>
          <p className="page-subtitle">
            Continuous 15s streaming telemetry · Last: {lastUpdate.toLocaleTimeString('en-IN', { hour12: false })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={fetch} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'pulse' : ''} /> Refresh Now
          </button>
        </div>
      </div>

      {/* ── Hierarchy Filter Bar ── */}
      <div className="hierarchy-filter-bar">
        <div>
          <label className="form-label">City</label>
          <select className="form-select" value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedZone(''); setSelectedWard(''); setSelectedStreet(''); }}>
            <option value="">All Cities</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Zone</label>
          <select className="form-select" value={selectedZone} onChange={e => { setSelectedZone(e.target.value); setSelectedWard(''); setSelectedStreet(''); }}>
            <option value="">All Zones</option>
            {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Ward</label>
          <select className="form-select" value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedStreet(''); }}>
            <option value="">All Wards</option>
            {filteredWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Street</label>
          <select className="form-select" value={selectedStreet} onChange={e => setSelectedStreet(e.target.value)}>
            <option value="">All Streets</option>
            {filteredStreets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Diagnostic Category Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        {DIAGNOSTIC_FILTERS.map(df => {
          const count = diagnosticCounts[df.id] || 0;
          const isActive = diagFilter === df.id;
          const Icon = df.icon;
          return (
            <div
              key={df.id}
              onClick={() => setDiagFilter(df.id)}
              style={{
                background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${isActive ? df.color : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all var(--t-fast)',
                boxShadow: isActive ? `0 0 10px ${df.color}33` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Icon size={16} color={df.color} />
                <span style={{ fontSize: 18, fontWeight: 800, color: count > 0 && df.id !== 'healthy' && df.id !== 'all' ? df.color : 'var(--text-primary)' }}>
                  {count}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {df.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Live Telemetry Data Table ── */}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>UID & Name</th>
              <th>City / Zone / Ward</th>
              <th>Connectivity</th>
              <th>Light</th>
              <th>Diagnostics / Alert</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Power (W)</th>
              <th>PF</th>
              <th>Energy (kWh)</th>
              <th>Burn Hrs</th>
              <th>Last Seen</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} /> Loading Live Stream...
                </td>
              </tr>
            )}
            {!loading && filteredDevices.length === 0 && (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No devices found matching current filters
                </td>
              </tr>
            )}
            {filteredDevices.map(d => {
              const s = d.latestState;
              const isOffline = d.connectivity_status === 'offline';
              const v = parseFloat(s?.voltage || 0);
              const i = parseFloat(s?.current || 0);

              return (
                <tr
                  key={d.id}
                  style={{ opacity: isOffline ? 0.7 : 1 }}
                >
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--brand)' }}>{d.uid}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.name}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{d.street?.ward?.zone?.city?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {d.street?.ward?.zone?.name || '—'} &rsaquo; {d.street?.ward?.name || '—'}
                    </div>
                  </td>
                  <td><StatusBadge value={d.connectivity_status} type="connectivity" /></td>
                  <td><StatusBadge value={d.light_status} type="light" /></td>

                  {/* Diagnostic Badge */}
                  <td>
                    {d.diagCategory === 'healthy' && (
                      <span className="badge badge-online" style={{ fontSize: 11 }}>Normal</span>
                    )}
                    {d.diagCategory === 'over_voltage' && (
                      <span className="badge badge-major" style={{ fontSize: 11 }}>Overvoltage</span>
                    )}
                    {d.diagCategory === 'under_voltage' && (
                      <span className="badge badge-warning" style={{ fontSize: 11 }}>Undervoltage</span>
                    )}
                    {d.diagCategory === 'over_current' && (
                      <span className="badge badge-critical" style={{ fontSize: 11 }}>Overcurrent</span>
                    )}
                    {d.diagCategory === 'lamp_fail' && (
                      <span className="badge badge-critical" style={{ fontSize: 11 }}>Lamp Fault</span>
                    )}
                    {d.diagCategory === 'low_pf' && (
                      <span className="badge badge-warning" style={{ fontSize: 11 }}>Low PF</span>
                    )}
                    {d.diagCategory === 'comm_fail' && (
                      <span className="badge badge-offline" style={{ fontSize: 11 }}>Comm Fail</span>
                    )}
                  </td>

                  <td style={{ color: v > 255 ? '#ef4444' : v < 190 && v > 0 ? '#f59e0b' : '#38bdf8', fontWeight: 600 }}>
                    {s?.voltage ?? '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>V</span>
                  </td>
                  <td style={{ color: i > 2 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                    {s?.current ?? '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>A</span>
                  </td>
                  <td style={{ color: '#f97316', fontWeight: 600 }}>
                    {s?.real_power ?? '—'} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>W</span>
                  </td>
                  <td className="dim">{s?.pf ?? '—'}</td>
                  <td className="dim" style={{ color: '#a855f7' }}>{s?.kwh ?? '—'}</td>
                  <td className="dim">{s?.run_hours ?? '—'} h</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{timeSince(d.last_seen)}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/devices/${d.id}`)}
                      title="View Details & Run Diagnostics"
                    >
                      <Stethoscope size={12} /> Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
