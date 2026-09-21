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
  Zap, Search, RefreshCw, Filter, Layers, CheckCircle2, TrendingUp, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie
} from 'recharts';
import { formatISTDateTime, formatISTDate } from '../../utils/date.js';

const REPORT_TABS = [
  { id: 'telemetry', label: 'Device Telemetry Data', icon: Zap },
  { id: 'device_summary', label: 'Device Operational Summary', icon: FileText },
  { id: 'city', label: 'City Report', icon: Globe },
  { id: 'zone', label: 'Zone Report', icon: Building2 },
  { id: 'ward', label: 'Ward Report', icon: MapPin },
  { id: 'fault', label: 'Fault & Outage Incidents', icon: AlertTriangle },
];

const CHART_COLORS = ['#38bdf8', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#eab308', '#06b6d4', '#f43f5e'];

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
  const [viewMode, setViewMode] = useState('both'); // 'both' | 'charts' | 'table'

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
      const headers = ['Timestamp (IST)', 'UID', 'Voltage (V)', 'Current (A)', 'Power (W)', 'PF', 'Freq (Hz)', 'kWh', 'Light', 'Fault'];
      const rows = telemetryRows.map(r => [
        formatISTDateTime(r.server_timestamp),
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
      const headers = ['Detected At (IST)', 'UID', 'Location', 'Alert Type', 'Severity', 'Status', 'Message'];
      const rows = faultRows.map(f => [
        formatISTDateTime(f.detected_at),
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

  // ── Telemetry Chart Series & Stats ──
  const { chartTelemetry, telemetryStats } = useMemo(() => {
    const raw = [...telemetryRows].reverse();
    const chartData = raw.slice(-40).map(t => ({
      time: new Date(t.server_timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
      voltage: parseFloat(t.voltage || 0),
      current: parseFloat(t.current || 0),
      power: parseFloat(t.real_power || 0),
      pf: parseFloat(t.pf || 0),
      frequency: parseFloat(t.frequency || 0),
      uid: t.uid,
    }));

    let avgV = 0, peakP = 0, peakI = 0, avgPf = 0;
    if (raw.length > 0) {
      const sumV = raw.reduce((acc, r) => acc + (parseFloat(r.voltage) || 0), 0);
      avgV = (sumV / raw.length).toFixed(1);
      peakP = Math.max(...raw.map(r => parseFloat(r.real_power) || 0)).toFixed(1);
      peakI = Math.max(...raw.map(r => parseFloat(r.current) || 0)).toFixed(2);
      const sumPf = raw.reduce((acc, r) => acc + (parseFloat(r.pf) || 0), 0);
      avgPf = (sumPf / raw.length).toFixed(2);
    }

    return {
      chartTelemetry: chartData,
      telemetryStats: { avgV, peakP, peakI, avgPf, count: raw.length }
    };
  }, [telemetryRows]);

  // ── Device Summary Chart Series (Top power & energy fixtures) ──
  const chartDeviceSummary = useMemo(() => {
    return [...deviceSummaryRows]
      .sort((a, b) => (parseFloat(b.kwh) || 0) - (parseFloat(a.kwh) || 0))
      .slice(0, 10)
      .map(d => ({
        name: d.uid || d.name,
        kwh: parseFloat(d.kwh || 0),
        power: parseFloat(d.real_power || 0),
        voltage: parseFloat(d.voltage || 0),
        status: d.connectivity_status,
      }));
  }, [deviceSummaryRows]);

  // ── Hierarchy Chart Series (Sub-divisions comparison) ──
  const chartHierarchy = useMemo(() => {
    if (!hierarchyReport) return [];
    const list = hierarchyReport.zones || hierarchyReport.wards || hierarchyReport.streets || [];
    return list.map(item => ({
      name: item.name,
      total: item.totalDevices || 0,
      online: item.online || 0,
      offline: item.offline || 0,
      lightsOn: item.lightsOn || 0,
      faults: item.faults || 0,
      energy: parseFloat(item.energyTotal || 0),
    }));
  }, [hierarchyReport]);

  // ── Fault Analysis Chart Series ──
  const { chartFaultTypes, chartFaultSeverity } = useMemo(() => {
    const typeMap = {};
    const sevMap = {};

    faultRows.forEach(f => {
      const type = (f.alert_type || 'unknown').replace(/_/g, ' ');
      typeMap[type] = (typeMap[type] || 0) + 1;

      const sev = f.severity || 'warning';
      sevMap[sev] = (sevMap[sev] || 0) + 1;
    });

    const types = Object.keys(typeMap).map((k, i) => ({
      name: k.toUpperCase(),
      count: typeMap[k],
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    const severities = [
      { name: 'Critical', count: sevMap['critical'] || 0, color: '#ef4444' },
      { name: 'Major', count: sevMap['major'] || 0, color: '#f97316' },
      { name: 'Warning', count: sevMap['warning'] || 0, color: '#eab308' },
      { name: 'Info', count: sevMap['info'] || 0, color: '#38bdf8' },
    ].filter(s => s.count > 0);

    return { chartFaultTypes: types, chartFaultSeverity: severities };
  }, [faultRows]);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Comprehensive Device Data & Analytics Reports</h1>
          <p className="page-subtitle">
            Export historical telemetry, device operations, electrical energy analytics, and hierarchical outage summaries (IST)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              className={`btn btn-sm ${viewMode === 'both' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('both')}
              style={{ borderRadius: 0, padding: '4px 10px', fontSize: 12 }}
            >
              <Activity size={13} /> All Views
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'charts' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('charts')}
              style={{ borderRadius: 0, padding: '4px 10px', fontSize: 12 }}
            >
              <BarChart3 size={13} /> Charts Only
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              style={{ borderRadius: 0, padding: '4px 10px', fontSize: 12 }}
            >
              <FileText size={13} /> Table Only
            </button>
          </div>

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
      <div className="hierarchy-filter-bar" style={{ marginBottom: 20 }}>
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
            <label className="form-label">Date Range (IST)</label>
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

        {/* Refresh button */}
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={generateReport} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════════════
          TAB 1: DEVICE TELEMETRY DATA & ANALYTICS
      ════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'telemetry' && (
        <div>
          {/* Summary KPIs */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: 'var(--brand)' }}>{telemetryStats.count}</div>
              <div className="kpi-card-label">Telemetry Packets</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#38bdf8' }}>{telemetryStats.avgV} <span style={{ fontSize: 14 }}>V</span></div>
              <div className="kpi-card-label">Avg Line Voltage</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#22c55e' }}>{telemetryStats.peakI} <span style={{ fontSize: 14 }}>A</span></div>
              <div className="kpi-card-label">Peak Current Load</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-value" style={{ color: '#f97316' }}>{telemetryStats.peakP} <span style={{ fontSize: 14 }}>W</span></div>
              <div className="kpi-card-label">Peak Active Power</div>
            </div>
          </div>

          {/* Interactive Chart Analytics Section */}
          {(viewMode === 'both' || viewMode === 'charts') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Chart 1: Voltage & Real Power Trends */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Voltage (V) & Real Power (W) Profile</div>
                    <div className="card-subtitle">Chronological trend across recent reporting intervals (IST)</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 280 }}>
                  {chartTelemetry.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--text-muted)' }}>No chart data points</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartTelemetry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="pwrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                        <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                        <Area type="monotone" dataKey="voltage" name="Voltage (V)" stroke="#38bdf8" fillOpacity={1} fill="url(#voltGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="power" name="Real Power (W)" stroke="#f97316" fillOpacity={1} fill="url(#pwrGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart 2: Current & Power Factor */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Current Load (A) & Power Factor</div>
                    <div className="card-subtitle">Dynamic electrical load and power factor efficiency curve</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 280 }}>
                  {chartTelemetry.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--text-muted)' }}>No chart data points</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartTelemetry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                        <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis yAxisId="left" stroke="#22c55e" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 1.1]} stroke="#a855f7" fontSize={11} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                        <Line yAxisId="left" type="monotone" dataKey="current" name="Current (A)" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="pf" name="Power Factor" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Telemetry Data Table */}
          {(viewMode === 'both' || viewMode === 'table') && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Telemetry Data Log ({telemetryRows.length} records)</div>
                  <div className="card-subtitle">Time-stamped electrical measurements recorded by CCMS gateway in Indian Standard Time (IST)</div>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp (IST)</th>
                      <th>Device UID</th>
                      <th>Voltage (V)</th>
                      <th>Current (A)</th>
                      <th>Real Power (W)</th>
                      <th>Power Factor</th>
                      <th>Frequency (Hz)</th>
                      <th>Energy (kWh)</th>
                      <th>Burn Hours</th>
                      <th>Light Status</th>
                      <th>Fault Status</th>
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
                        <td style={{ fontSize: 12 }}>{formatISTDateTime(t.server_timestamp)}</td>
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
                            {t.fault === 1 ? 'FAULT' : 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════════
          TAB 2: FULL DEVICE OPERATIONAL SUMMARY & CHARTS
      ════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'device_summary' && (
        <div>
          {/* Visual Analytics Chart for Device Summary */}
          {(viewMode === 'both' || viewMode === 'charts') && chartDeviceSummary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Cumulative Energy Consumption by Device (kWh)</div>
                    <div className="card-subtitle">Top energy consuming luminaires across the fleet</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDeviceSummary} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} angle={-25} textAnchor="end" />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                      <Bar dataKey="kwh" name="Energy (kWh)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Active Operating Power (W) per Luminaire</div>
                    <div className="card-subtitle">Real-time load distribution by device</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDeviceSummary} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} angle={-25} textAnchor="end" />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                      <Bar dataKey="power" name="Active Power (W)" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Device Table */}
          {(viewMode === 'both' || viewMode === 'table') && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Full Fleet Luminaire Inventory & Operational Health</div>
                  <div className="card-subtitle">{deviceSummaryRows.length} total fixtures registered</div>
                </div>
                <div style={{ width: 240 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search UID, name, or street..."
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
                      <th>Last Seen (IST)</th>
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
                          {d.last_seen ? formatISTDateTime(d.last_seen) : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════════
          TABS 3, 4, 5: HIERARCHY AGGREGATES & CHARTS (CITY, ZONE, WARD)
      ════════════════════════════════════════════════════════════════════════════════ */}
      {(activeTab === 'city' || activeTab === 'zone' || activeTab === 'ward') && hierarchyReport && (
        <div>
          {/* Summary KPIs */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
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

          {/* Sub-division Analytics Chart */}
          {(viewMode === 'both' || viewMode === 'charts') && chartHierarchy.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Sub-Division Operational Comparison</div>
                  <div className="card-subtitle">Fixture distribution, online fixtures, and active lamps by sub-area</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHierarchy} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                    <Bar dataKey="total" name="Total Fixtures" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="online" name="Online Fixtures" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lightsOn" name="Lights ON" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="faults" name="Faults" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Performance Matrix Table */}
          {(viewMode === 'both' || viewMode === 'table') && (
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
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════════
          TAB 6: FAULT & OUTAGE INCIDENTS & CHARTS
      ════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fault' && (
        <div>
          {/* Fault Summary Charts */}
          {(viewMode === 'both' || viewMode === 'charts') && faultRows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Fault by Type */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Fault Incident Distribution by Type</div>
                    <div className="card-subtitle">Frequency of electrical & hardware alarms</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartFaultTypes} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={10} width={110} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="Incidents" fill="#ef4444" radius={[0, 4, 4, 0]}>
                        {chartFaultTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Fault by Severity */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Incident Breakdown by Severity Level</div>
                    <div className="card-subtitle">Critical vs Major vs Warning alarms</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartFaultSeverity} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="Alarm Count" fill="#f97316" radius={[4, 4, 0, 0]}>
                        {chartFaultSeverity.map((entry, index) => (
                          <Cell key={`sev-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Fault Incident Log Table */}
          {(viewMode === 'both' || viewMode === 'table') && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Fault & Outage Alarm Incident Log</div>
                  <div className="card-subtitle">{faultRows.length} total incident records (IST)</div>
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
                      <th>Detected At (IST)</th>
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
                        <td>{formatISTDateTime(f.detected_at)}</td>
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
      )}
    </div>
  );
}
