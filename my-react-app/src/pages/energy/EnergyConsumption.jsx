import { useState, useEffect, useMemo } from 'react';
import {
  Zap, Gauge, Clock, DollarSign,
  Calendar, Building2, MapPin, Globe, Search, RefreshCw, BarChart2, Download, CheckCircle2, Layers
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import { getEnergySummary, getEnergyTrend, getZoneEnergyBreakdown, getDeviceWiseEnergy } from '../../api/energy.api.js';
import { getCities, getZones, getWards } from '../../api/organization.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function EnergyConsumption() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState({ dailyData: [], hourlyProfile: [] });
  const [zoneBreakdown, setZoneBreakdown] = useState([]);
  const [deviceRows, setDeviceRows] = useState([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Hierarchy Filters
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedWard, setSelectedWard] = useState('');

  const fetchHierarchy = async () => {
    try {
      const [c, z, w] = await Promise.all([getCities(), getZones(), getWards()]);
      setCities(c.data || []);
      setZones(z.data || []);
      setWards(w.data || []);
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (selectedCity) filterParams.city_id = selectedCity;
      if (selectedZone) filterParams.zone_id = selectedZone;
      if (selectedWard) filterParams.ward_id = selectedWard;

      const [sumRes, trendRes, zoneRes, devRes] = await Promise.all([
        getEnergySummary(filterParams),
        getEnergyTrend({ days: 7 }),
        getZoneEnergyBreakdown(),
        getDeviceWiseEnergy({ ...filterParams, search, page, limit: 50 }),
      ]);

      setSummary(sumRes.data || null);
      setTrend(trendRes.data || { dailyData: [], hourlyProfile: [] });
      setZoneBreakdown(zoneRes.data || []);
      setDeviceRows(devRes.data?.data || []);
      setDeviceTotal(devRes.data?.total || 0);
    } catch (e) {
      console.error('Failed to load energy data', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedCity, selectedZone, selectedWard, page, search]);

  const filteredZones = useMemo(() => {
    if (!selectedCity) return zones;
    return zones.filter(z => String(z.city_id) === String(selectedCity));
  }, [zones, selectedCity]);

  const filteredWards = useMemo(() => {
    if (!selectedZone) return wards;
    return wards.filter(w => String(w.zone_id) === String(selectedZone));
  }, [wards, selectedZone]);

  // Export CSV of Device Energy Records
  const exportCSV = () => {
    if (!deviceRows.length) {
      alert('No device energy data available to export');
      return;
    }
    const headers = ['UID', 'Device Name', 'Zone', 'Ward', 'Status', 'Light', 'Power (W)', 'Demand (kW)', 'PF', 'Total kWh', 'Cost INR', 'Burn Hrs'];
    const rows = deviceRows.map(d => [
      d.uid,
      `"${d.name}"`,
      `"${d.zone}"`,
      `"${d.ward}"`,
      d.connectivity_status,
      d.light_status,
      d.real_power,
      d.demandKw,
      d.pf,
      d.kwh,
      d.costInr,
      d.run_hours,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Energy Consumption & Demand Analytics</h1>
          <p className="page-subtitle">
            Real-time kW peak demand, active load profiling, and cumulative kWh consumption measurements (IST)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Analytics
          </button>
        </div>
      </div>

      {/* ── Hierarchy Filter Bar ── */}
      <div className="hierarchy-filter-bar" style={{ marginBottom: 20 }}>
        <div>
          <label className="form-label">City</label>
          <select
            className="form-select"
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setSelectedZone(''); setSelectedWard(''); setPage(1); }}
          >
            <option value="">All Cities</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Zone</label>
          <select
            className="form-select"
            value={selectedZone}
            onChange={e => { setSelectedZone(e.target.value); setSelectedWard(''); setPage(1); }}
          >
            <option value="">All Zones</option>
            {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Ward</label>
          <select
            className="form-select"
            value={selectedWard}
            onChange={e => { setSelectedWard(e.target.value); setPage(1); }}
          >
            <option value="">All Wards</option>
            {filteredWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Demand & Consumption KPI Summary Cards ── */}
      <div className="kpi-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {/* Active Energy (kWh) */}
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
            <Zap size={18} />
          </div>
          <div className="kpi-card-value">{summary?.totalKwh ?? '0.00'} <span style={{ fontSize: 13 }}>kWh</span></div>
          <div className="kpi-card-label">Active Cumulative Energy</div>
          <div className="kpi-card-sub" style={{ color: 'var(--text-muted)' }}>
            Measured total consumption
          </div>
        </div>

        {/* Peak Demand (kW) */}
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
            <Gauge size={18} />
          </div>
          <div className="kpi-card-value">{summary?.peakDemandKw ?? '0.000'} <span style={{ fontSize: 13 }}>kW</span></div>
          <div className="kpi-card-label">Connected Peak Capacity</div>
          <div className="kpi-card-sub" style={{ color: '#22c55e' }}>
            Active Load: {summary?.currentActiveDemandKw ?? '0.000'} kW
          </div>
        </div>

        {/* Total Cost in INR */}
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
            <DollarSign size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: '#a855f7' }}>
            ₹{summary?.totalCostInr ?? '0.00'}
          </div>
          <div className="kpi-card-label">Estimated Electricity Cost</div>
          <div className="kpi-card-sub" style={{ color: 'var(--text-secondary)' }}>
            Tariff @ ₹7.50 / kWh
          </div>
        </div>

        {/* Avg Power Factor */}
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <Zap size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: '#22c55e' }}>
            {summary?.avgPowerFactor ?? '0.98'}
          </div>
          <div className="kpi-card-label">Avg Power Factor</div>
          <div className="kpi-card-sub">
            Grid efficiency ratio
          </div>
        </div>

        {/* Avg Burn Hours */}
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
            <Clock size={18} />
          </div>
          <div className="kpi-card-value">{summary?.avgBurnHours ?? '0.0'} <span style={{ fontSize: 13 }}>hrs</span></div>
          <div className="kpi-card-label">Avg Operating Hours</div>
          <div className="kpi-card-sub">
            Luminaire active run time
          </div>
        </div>
      </div>

      {/* ── Charts Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* 24-Hour Peak Load & Demand Curve */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">24-Hour Load & Demand Profile (kW)</div>
              <div className="card-subtitle">Active demand profile vs adaptive dimming schedule</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.hourlyProfile} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [`${value} kW`, 'Peak Demand']}
                />
                <Area type="monotone" dataKey="demandKw" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#demandGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Energy Consumption Profile (kWh) */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Daily Energy Consumption (kWh)</div>
              <div className="card-subtitle">Measured daily active energy consumption trend</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${value} kWh`, 'Energy Consumed']}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Bar dataKey="consumptionKwh" name="Energy Consumed (kWh)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Zone Energy Breakdown Chart (if zones exist) ── */}
      {zoneBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Zone-Wise Energy Distribution (kWh)</div>
              <div className="card-subtitle">Aggregated energy consumption per operational zone</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Bar dataKey="totalKwh" name="Total Consumption (kWh)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Individual Device-Wise Energy Consumption Table ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Individual Device-Wise Energy & Demand Calculation</div>
            <div className="card-subtitle">{deviceTotal} street lights measured and calculated</div>
          </div>
          <div style={{ width: 240, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Search UID or Name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Device Name</th>
                <th>Zone / Ward</th>
                <th>Status</th>
                <th>Light</th>
                <th>Active Power (W)</th>
                <th>Demand (kW)</th>
                <th>PF</th>
                <th>Total kWh</th>
                <th>Energy Cost (₹)</th>
                <th>Burn Hrs</th>
              </tr>
            </thead>
            <tbody>
              {deviceRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No device energy records found.
                  </td>
                </tr>
              ) : (
                deviceRows.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{d.uid}</td>
                    <td>{d.name}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{d.zone}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.ward}</div>
                    </td>
                    <td><StatusBadge value={d.connectivity_status} type="connectivity" /></td>
                    <td><StatusBadge value={d.light_status} type="light" /></td>
                    <td style={{ fontWeight: 600, color: '#f97316' }}>{d.real_power} W</td>
                    <td style={{ fontWeight: 600 }}>{d.demandKw} kW</td>
                    <td className="dim">{d.pf}</td>
                    <td style={{ fontWeight: 700, color: '#a855f7' }}>{d.kwh}</td>
                    <td className="dim">₹{d.costInr}</td>
                    <td className="dim">{d.run_hours} h</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

