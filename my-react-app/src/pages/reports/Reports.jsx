import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getCityReport, getZoneReport, getWardReport,
  getFaultReport, getTelemetryDataReport, getDeviceSummaryReport
} from '../../api/report.api.js';
import { getCities, getZones, getWards, getStreets } from '../../api/organization.api.js';
import { getDevices } from '../../api/device.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import {
  FileText, Download, Printer, BarChart3,
  Calendar, Building2, MapPin, Globe, AlertTriangle,
  Zap, Search, RefreshCw, Filter, Layers, CheckCircle2, TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

const REPORT_TABS = [
  { id: 'telemetry', label: 'Device Telemetry Data', icon: Zap },
  { id: 'device_summary', label: 'Device Operational Summary', icon: FileText },
  { id: 'city', label: 'City Report', icon: Globe },
  { id: 'zone', label: 'Zone Report', icon: Building2 },
  { id: 'ward', label: 'Ward Report', icon: MapPin },
  { id: 'fault', label: 'Fault & Outage Incidents', icon: AlertTriangle },
];

export default function Reports({ defaultType }) {
  const location = useLocation();

  // Determine initial tab from route or prop
  const initialTab = useMemo(() => {
    if (defaultType) return defaultType;
    if (location.pathname.includes('/zone')) return 'zone';
    if (location.pathname.includes('/ward')) return 'ward';
    if (location.pathname.includes('/fault')) return 'fault';
    if (location.pathname.includes('/device')) return 'device_summary';
    if (location.pathname.includes('/city')) return 'city';
    return 'telemetry';
  }, [defaultType, location.pathname]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Hierarchy Data
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [streets, setStreets] = useState([]);
  const [deviceList, setDeviceList] = useState([]);

  // Filter Selections
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedStreet, setSelectedStreet] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Date Range
  const today = new Date().toISOString().split('T')[0];
  const last7 = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(last7);
  const [dateTo, setDateTo] = useState(today);
  const [datePreset, setDatePreset] = useState('last7');

  // Search & General Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Loaded Report Data
  const [telemetryRows, setTelemetryRows] = useState([]);
  const [deviceSummaryRows, setDeviceSummaryRows] = useState([]);
  const [hierarchyReport, setHierarchyReport] = useState(null);
  const [faultRows, setFaultRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load Hierarchy Lookups
  useEffect(() => {
    (async () => {
      try {
        const [c, z, w, s, d] = await Promise.all([
          getCities(), getZones(), getWards(), getStreets(), getDevices({ limit: 300 })
        ]);
        setCities(c.data || []);
        setZones(z.data || []);
        setWards(w.data || []);
        setStreets(s.data || []);
        const devList = d.data?.data || [];
        setDeviceList(devList);

        if (c.data?.length && (activeTab === 'city' || activeTab === 'zone' || activeTab === 'ward')) {
          setSelectedCity(c.data[0].id);
        }
      } catch {}
    })();
  }, []);

  // Update filtered hierarchy dropdowns
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

  // Handle Date Presets
  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setDateFrom(t);
      setDateTo(t);
    } else if (preset === 'yesterday') {
      const y = new Date(now - 864e5).toISOString().split('T')[0];
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === 'last7') {
      const f = new Date(now - 7 * 864e5).toISOString().split('T')[0];
      setDateFrom(f);
      setDateTo(t);
    } else if (preset === 'last30') {
      const f = new Date(now - 30 * 864e5).toISOString().split('T')[0];
      setDateFrom(f);
      setDateTo(t);
    }
  };

  // Fetch Report Data based on active tab and filters
  const generateReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'telemetry') {
        const params = {
          from: dateFrom,
          to: dateTo,
          limit: 300,
        };
        if (selectedDeviceId) params.device_id = selectedDeviceId;
        if (selectedCity) params.city_id = selectedCity;
        if (selectedZone) params.zone_id = selectedZone;
        if (selectedWard) params.ward_id = selectedWard;

        const res = await getTelemetryDataReport(params);
        setTelemetryRows(res.data || []);
      } else if (activeTab === 'device_summary') {
        const params = {
          city_id: selectedCity,
          zone_id: selectedZone,
          ward_id: selectedWard,
          street_id: selectedStreet,
          search,
        };
        const res = await getDeviceSummaryReport(params);
        setDeviceSummaryRows(res.data || []);
      } else if (activeTab === 'city' && selectedCity) {
        const res = await getCityReport(selectedCity);
        setHierarchyReport(res.data);
      } else if (activeTab === 'zone' && selectedZone) {
        const res = await getZoneReport(selectedZone);
        setHierarchyReport(res.data);
      } else if (activeTab === 'ward' && selectedWard) {
        const res = await getWardReport(selectedWard);
        setHierarchyReport(res.data);
      } else if (activeTab === 'fault') {
        const params = {
          from: dateFrom,
          to: dateTo,
          severity: severityFilter,
          zone_id: selectedZone,
          ward_id: selectedWard,
        };
        const res = await getFaultReport(params);
        setFaultRows(res.data || []);
      }
    } catch (e) {
      console.error('Failed to generate report', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    generateReport();
  }, [activeTab, selectedCity, selectedZone, selectedWard, selectedStreet, selectedDeviceId, dateFrom, dateTo, severityFilter]);

  // Export to CSV Function
  const exportToCSV = () => {
    let csvContent = '';
    let filename = `report_${activeTab}_${today}.csv`;

    if (activeTab === 'telemetry') {
      const headers = ['Timestamp', 'UID', 'Voltage (V)', 'Current (A)', 'Power (W)', 'PF', 'Freq (Hz)', 'kWh', 'Light', 'Fault'];
      const rows = telemetryRows.map(r => [
        new Date(r.server_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        r.uid,
        r.voltage,
        r.current,
        r.real_power,
        r.pf,
        r.frequency,
        r.kwh,
        r.light_status === 1 ? 'ON' : 'OFF',
        r.fault === 1 ? 'FAULT' : 'NORMAL',
      ]);
      csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    } else if (activeTab === 'device_summary') {
      const headers = ['UID', 'Device Name', 'City', 'Zone', 'Ward', 'Street', 'Status', 'Light', 'Voltage (V)', 'Current (A)', 'Power (W)', 'PF', 'kWh', 'Run Hours'];
      const rows = deviceSummaryRows.map(d => [
        d.uid,
        `"${d.name}"`,
        `"${d.city}"`,
        `"${d.zone}"`,
        `"${d.ward}"`,
        `"${d.street}"`,
        d.connectivity_status,
        d.light_status,
        d.voltage,
        d.current,
        d.real_power,
        d.pf,
        d.kwh,
        d.run_hours,
      ]);
      csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    } else if (activeTab === 'fault') {
      const headers = ['Detected At', 'UID', 'Location', 'Alert Type', 'Severity', 'Status', 'Message'];
      const rows = faultRows.map(f => [
        new Date(f.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        f.device?.uid || '',
        `"${f.device?.street?.name || ''}"`,
        f.alert_type,
        f.severity,
        f.status,
        `"${f.message?.replace(/"/g, '""') || ''}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    } else if (hierarchyReport) {
      const headers = ['Name', 'Total Luminaires', 'Online', 'Offline', 'Lights ON', 'Faults', 'Energy Total (kWh)'];
      const list = hierarchyReport.zones || hierarchyReport.wards || hierarchyReport.streets || [];
      const rows = list.map(l => [
        `"${l.name}"`,
        l.totalDevices,
        l.online,
        l.offline,
        l.lightsOn,
        l.faults,
        l.energyTotal || '—',
      ]);
      csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    }

    if (!csvContent) {
      alert('No data available to export');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Telemetry Chart Series (Sampling latest 30 points for graph)
  const chartTelemetry = useMemo(() => {
    return [...telemetryRows].reverse().slice(-30).map(t => ({
      time: new Date(t.server_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      voltage: parseFloat(t.voltage || 0),
      current: parseFloat(t.current || 0),
      power: parseFloat(t.real_power || 0),
    }));
  }, [telemetryRows]);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Comprehensive Device Data & Multi-Type Reports</h1>
          <p className="page-subtitle">
            Export historical telemetry, device operations, energy calculations, and hierarchical summaries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={exportToCSV}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {/* ── Tabbed Report Category Switcher ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 6 }}>
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Multi-Filter Bar ── */}
      <div className="hierarchy-filter-bar">
        {/* City */}
        <div>
          <label className="form-label">City</label>
          <select className="form-select" value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedZone(''); setSelectedWard(''); setSelectedStreet(''); }}>
            <option value="">All Cities</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Zone */}
        <div>
          <label className="form-label">Zone</label>
          <select className="form-select" value={selectedZone} onChange={e => { setSelectedZone(e.target.value); setSelectedWard(''); setSelectedStreet(''); }}>
            <option value="">All Zones</option>
            {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        {/* Ward */}
        <div>
          <label className="form-label">Ward</label>
          <select className="form-select" value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedStreet(''); }}>
            <option value="">All Wards</option>
            {filteredWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Street */}
        <div>
          <label className="form-label">Street</label>
          <select className="form-select" value={selectedStreet} onChange={e => setSelectedStreet(e.target.value)}>
            <option value="">All Streets</option>
            {filteredStreets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Device Picker for Telemetry */}
        {activeTab === 'telemetry' && (
          <div>
            <label className="form-label">Device UID</label>
            <select className="form-select" value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)}>
              <option value="">All Devices</option>
              {deviceList.map(d => <option key={d.id} value={d.id}>{d.uid} - {d.name}</option>)}
            </select>
          </div>
        )}

        {/* Date Presets */}
        {(activeTab === 'telemetry' || activeTab === 'fault') && (
          <div>
            <label className="form-label">Date Range</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {['today', 'yesterday', 'last7', 'last30'].map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${datePreset === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applyPreset(p)}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yest' : p === 'last7' ? '7D' : '30D'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tab 1: Historical Telemetry Data Report ── */}
      {activeTab === 'telemetry' && (
        <div>
          {/* Telemetry Visual Trend Graph */}
          {chartTelemetry.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title">Electrical Telemetry Profile Over Selected Period</div>
                <div className="card-subtitle">Live Voltage (V), Current (A), and Power (W) time-series</div>
              </div>
              <div style={{ padding: '16px 20px', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTelemetry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                    <Line type="monotone" dataKey="voltage" name="Voltage (V)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="power" name="Power (W)" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Telemetry Data Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Telemetry Data Log ({telemetryRows.length} records)</div>
                <div className="card-subtitle">Time-stamped electrical measurements recorded by CCMS gateway</div>
              </div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Device UID</th>
                    <th>Voltage (V)</th>
                    <th>Current (A)</th>
                    <th>Real Power (W)</th>
                    <th>Power Factor</th>
                    <th>Frequency (Hz)</th>
                    <th>Energy (kWh)</th>
                    <th>Burn Hours</th>
                    <th>Light Status</th>
                    <th>Fault</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} /> Loading Telemetry Data...
                      </td>
                    </tr>
                  )}
                  {!loading && telemetryRows.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No telemetry data found for the selected criteria.
                      </td>
                    </tr>
                  )}
                  {telemetryRows.map((t, idx) => (
                    <tr key={t.id || idx}>
                      <td style={{ fontSize: 12 }}>{new Date(t.server_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                      <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{t.uid}</td>
                      <td style={{ color: '#38bdf8', fontWeight: 600 }}>{t.voltage} V</td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{t.current} A</td>
                      <td style={{ color: '#f97316', fontWeight: 600 }}>{t.real_power} W</td>
                      <td className="dim">{t.pf}</td>
                      <td className="dim">{t.frequency} Hz</td>
                      <td style={{ color: '#a855f7', fontWeight: 600 }}>{t.kwh}</td>
                      <td className="dim">{t.run_hours} h</td>
                      <td><StatusBadge value={t.light_status === 1 ? 'on' : 'off'} type="light" /></td>
                      <td>
                        <span className={`badge ${t.fault === 1 ? 'badge-fault' : 'badge-online'}`}>
                          {t.fault === 1 ? 'FAULT' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Full Device Operational Summary ── */}
      {activeTab === 'device_summary' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Full Fleet Luminaire Inventory & Operational Health</div>
              <div className="card-subtitle">{deviceSummaryRows.length} total fixtures registered</div>
            </div>
            <div style={{ width: 220 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Filter UID or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Hierarchy Location</th>
                  <th>Connectivity</th>
                  <th>Light Status</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>Power (W)</th>
                  <th>PF</th>
                  <th>Energy (kWh)</th>
                  <th>Saved (kWh)</th>
                  <th>Burn Hours</th>
                  <th>Restarts</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {deviceSummaryRows.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{d.uid}</td>
                    <td>{d.name}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{d.city} &rsaquo; {d.zone}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.ward} &rsaquo; {d.street}</div>
                    </td>
                    <td><StatusBadge value={d.connectivity_status} type="connectivity" /></td>
                    <td><StatusBadge value={d.light_status} type="light" /></td>
                    <td style={{ color: '#38bdf8', fontWeight: 600 }}>{d.voltage} V</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>{d.current} A</td>
                    <td style={{ color: '#f97316', fontWeight: 600 }}>{d.real_power} W</td>
                    <td className="dim">{d.pf}</td>
                    <td style={{ color: '#a855f7', fontWeight: 700 }}>{d.kwh}</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>{d.savedKwh}</td>
                    <td className="dim">{d.run_hours} h</td>
                    <td className="dim">{d.restart_count}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {d.last_seen ? new Date(d.last_seen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabs 3, 4, 5: Hierarchy Aggregates (City, Zone, Ward) ── */}
      {(activeTab === 'city' || activeTab === 'zone' || activeTab === 'ward') && hierarchyReport && (
        <div>
          {/* Summary KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-value">{hierarchyReport.summary?.totalDevices ?? 0}</div>
              <div className="kpi-card-label">Total Luminaires</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#22c55e' }}>{hierarchyReport.summary?.online ?? 0}</div>
              <div className="kpi-card-label">Online Status</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#f59e0b' }}>{hierarchyReport.summary?.lightsOn ?? 0}</div>
              <div className="kpi-card-label">Lights ON</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#ef4444' }}>{hierarchyReport.summary?.faults ?? hierarchyReport.summary?.activeFaults ?? 0}</div>
              <div className="kpi-card-label">Faults / Offline</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#a855f7' }}>{hierarchyReport.summary?.energyTotal ?? '0'} <span style={{ fontSize: 14 }}>kWh</span></div>
              <div className="kpi-card-label">Total Energy</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Sub-Division Performance Matrix</div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sub-Area Name</th>
                    <th>Total Fixtures</th>
                    <th>Online</th>
                    <th>Offline</th>
                    <th>Lights ON</th>
                    <th>Faults</th>
                    <th>Energy (kWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {(hierarchyReport.zones || hierarchyReport.wards || hierarchyReport.streets || []).map((sub, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{sub.name}</td>
                      <td>{sub.totalDevices}</td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{sub.online}</td>
                      <td style={{ color: '#ef4444' }}>{sub.offline}</td>
                      <td style={{ color: '#f59e0b' }}>{sub.lightsOn}</td>
                      <td style={{ color: sub.faults > 0 ? '#ef4444' : 'var(--text-muted)' }}>{sub.faults}</td>
                      <td style={{ color: '#a855f7', fontWeight: 600 }}>{sub.energyTotal || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: Fault & Outage Reports ── */}
      {activeTab === 'fault' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Fault & Outage Alarm Incident Log</div>
              <div className="card-subtitle">{faultRows.length} total incident records</div>
            </div>
            <select
              className="form-select"
              style={{ width: 160 }}
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Detected At</th>
                  <th>Device UID</th>
                  <th>Location</th>
                  <th>Alert Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Alarm Message</th>
                </tr>
              </thead>
              <tbody>
                {faultRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No fault incidents found for the selected period.
                    </td>
                  </tr>
                )}
                {faultRows.map(f => (
                  <tr key={f.id}>
                    <td>{new Date(f.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{f.device?.uid || '—'}</td>
                    <td>{f.device?.street?.name || '—'}</td>
                    <td>{f.alert_type?.replace(/_/g, ' ') || '—'}</td>
                    <td><StatusBadge value={f.severity} type="severity" /></td>
                    <td><StatusBadge value={f.status} type="alertStatus" /></td>
                    <td>{f.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
