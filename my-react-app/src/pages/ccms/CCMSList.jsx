import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, RefreshCw, Wifi, WifiOff,
  Sun, Clock, Sliders, ChevronRight, MapPin, Server,
  AlertTriangle, CheckCircle, Cpu, Zap, Activity, ArrowRight,
  Filter, X, Check, ShieldAlert, Sparkles, Compass, Settings,
  History
} from 'lucide-react';

import { getCCMSList, createCCMS, updateCCMS, getCCMSActivity } from '../../api/ccms.api.js';
import { getWards } from '../../api/organization.api.js';
import Modal from '../../components/common/Modal.jsx';
import CCMSActivityLog from '../../components/ccms/CCMSActivityLog.jsx';

const STATUS_COLOR = {
  active:   '#10b981',
  inactive: '#6b7280',
  fault:    '#ef4444',
};

const CONN_ICON = {
  online:  <Wifi size={13} color="#10b981" />,
  offline: <WifiOff size={13} color="#6b7280" />,
};

const SCHEDULE_ICON = {
  astronomical: <Sun size={13} color="#f59e0b" />,
  manual:       <Clock size={13} color="#6366f1" />,
  auto:         <Sliders size={13} color="#10b981" />,
};

function StatCard({ label, value, color, icon, subtext }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}`, flex: 1, minWidth: 200 }}>
      <div className="stat-card-icon" style={{ color }}>{icon}</div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {subtext && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtext}</div>}
      </div>
    </div>
  );
}

const defaultFormData = {
  uid: '',
  name: '',
  ward_id: '',
  latitude: '22.5726',
  longitude: '88.3639',
  panel_capacity_kva: '25.0',
  meter_serial: '',
  schedule_mode: 'astronomical',
  on_offset_minutes: -5,
  off_offset_minutes: 5,
  manual_on_time: '18:30',
  manual_off_time: '05:30',
  dim_level: 100,
  energy_rate_kwh: 8.50,
  notes: '',
};

export default function CCMSList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');

  // Add Station Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(defaultFormData);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState('');

  // Station Settings & Activity Modal State (DIFFERENT from Add Station)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsStation, setSettingsStation] = useState(null);
  const [settingsForm, setSettingsForm] = useState(defaultFormData);
  const [settingsTab, setSettingsTab] = useState('settings'); // 'settings' | 'activity'
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [wards, setWards] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCCMSList();
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []));
    } catch {
      setData([]);
    }
    setLoading(false);
  }, []);

  const loadWards = useCallback(async () => {
    try {
      const res = await getWards();
      setWards(Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []));
    } catch {
      setWards([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadWards();
  }, [load, loadWards]);

  const filtered = data.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.uid?.toLowerCase().includes(search.toLowerCase()) ||
      c.ward?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.ward?.zone?.city?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchMode = modeFilter === 'all' || c.schedule_mode === modeFilter;
    return matchSearch && matchStatus && matchMode;
  });

  const totalDevices = data.reduce((s, c) => s + (c.device_count || 0), 0);
  const totalDcus = data.reduce((s, c) => s + (c.dcus?.length || 0), 0);
  const totalFaults = data.reduce((s, c) => s + (c.active_faults || 0), 0);

  const stats = {
    total: data.length,
    online: data.filter((c) => c.connectivity_status === 'online').length,
    fault: totalFaults,
    dcus: totalDcus,
    devices: totalDevices,
  };

  // ── Open Add Station Modal (Provisioning only) ────────────────────────
  const openCreateModal = () => {
    const nextNum = String(data.length + 1).padStart(3, '0');
    setAddForm({
      ...defaultFormData,
      uid: `CCMS-W${nextNum}`,
      name: `CCMS Feeder Station ${nextNum}`,
      ward_id: wards[0]?.id || '',
    });
    setAddError('');
    setShowAddModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSavingAdd(true);
    setAddError('');
    try {
      await createCCMS({
        ...addForm,
        ward_id: parseInt(addForm.ward_id, 10),
        latitude: parseFloat(addForm.latitude) || null,
        longitude: parseFloat(addForm.longitude) || null,
        panel_capacity_kva: parseFloat(addForm.panel_capacity_kva) || null,
        on_offset_minutes: parseInt(addForm.on_offset_minutes, 10) || 0,
        off_offset_minutes: parseInt(addForm.off_offset_minutes, 10) || 0,
        energy_rate_kwh: parseFloat(addForm.energy_rate_kwh) || 8.50,
        dim_level: parseInt(addForm.dim_level, 10) || 100,
      });
      setShowAddModal(false);
      load();
    } catch (err) {
      setAddError(err.response?.data?.error || err.message || 'Failed to create CCMS station');
    }
    setSavingAdd(false);
  };

  // ── Open Settings & Activity Modal (Configuring existing station) ─────
  const openSettingsModal = async (station) => {
    setSettingsStation(station);
    setSettingsTab('settings');
    setSettingsError('');
    setSettingsForm({
      name: station.name || '',
      latitude: station.latitude != null ? String(station.latitude) : '22.5726',
      longitude: station.longitude != null ? String(station.longitude) : '88.3639',
      panel_capacity_kva: station.panel_capacity_kva != null ? String(station.panel_capacity_kva) : '25.0',
      meter_serial: station.meter_serial || '',
      schedule_mode: station.schedule_mode || 'astronomical',
      on_offset_minutes: station.on_offset_minutes ?? -5,
      off_offset_minutes: station.off_offset_minutes ?? 5,
      manual_on_time: station.manual_on_time || '18:30',
      manual_off_time: station.manual_off_time || '05:30',
      dim_level: station.dim_level ?? 100,
      energy_rate_kwh: station.energy_rate_kwh ?? 8.50,
      notes: station.notes || '',
    });
    setShowSettingsModal(true);

    // Fetch change log
    fetchStationActivity(station.id);
  };

  const fetchStationActivity = async (stationId) => {
    setLoadingActivity(true);
    try {
      const res = await getCCMSActivity(stationId);
      setActivityLogs(res.data?.data || []);
    } catch {
      setActivityLogs([]);
    }
    setLoadingActivity(false);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsStation) return;
    setSavingSettings(true);
    setSettingsError('');
    try {
      await updateCCMS(settingsStation.id, {
        ...settingsForm,
        latitude: parseFloat(settingsForm.latitude) || null,
        longitude: parseFloat(settingsForm.longitude) || null,
        panel_capacity_kva: parseFloat(settingsForm.panel_capacity_kva) || null,
        on_offset_minutes: parseInt(settingsForm.on_offset_minutes, 10) || 0,
        off_offset_minutes: parseInt(settingsForm.off_offset_minutes, 10) || 0,
        energy_rate_kwh: parseFloat(settingsForm.energy_rate_kwh) || 8.50,
        dim_level: parseInt(settingsForm.dim_level, 10) || 100,
      });
      // Refresh list & activity log
      load();
      await fetchStationActivity(settingsStation.id);
      setSettingsTab('activity'); // Switch to activity log to see the recorded change!
    } catch (err) {
      setSettingsError(err.response?.data?.error || err.message || 'Failed to update settings');
    }
    setSavingSettings(false);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--brand)' }} />
            CCMS Stations
          </h1>
          <p className="page-subtitle">
            Central Control &amp; Monitoring Station — Three-phase energy monitoring, astronomical control &amp; device aggregation layer
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} title="Refresh data">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={14} /> Add CCMS Station
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row" style={{ marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <StatCard label="Total CCMS" value={stats.total} color="#6366f1" icon={<Building2 size={18} />} subtext="Feeder panels" />
        <StatCard label="Online CCMS" value={stats.online} color="#10b981" icon={<Wifi size={18} />} subtext={`${stats.total - stats.online} offline`} />
        <StatCard label="Total DCUs" value={stats.dcus} color="#f59e0b" icon={<Server size={18} />} subtext="Downstream concentrators" />
        <StatCard label="Mapped Devices" value={stats.devices} color="#3b82f6" icon={<Cpu size={18} />} subtext="Under CCMS network" />
        <StatCard label="Active Faults" value={stats.fault} color="#ef4444" icon={<AlertTriangle size={18} />} subtext="Phase &amp; node alerts" />
      </div>

      {/* Filters Bar */}
      <div className="filters-bar" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 260 }}>
          <Search size={14} />
          <input
            placeholder="Search CCMS by name, UID, city, ward…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'active', 'fault', 'inactive'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Schedule Mode filter */}
        <select
          className="form-select"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140, height: 34, padding: '4px 10px' }}
        >
          <option value="all">All Modes</option>
          <option value="astronomical">Astronomical</option>
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading CCMS stations…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontWeight: 600, fontSize: 16 }}>No CCMS stations found</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {search ? 'Try clearing your search query' : 'Create your first CCMS station to begin monitoring'}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreateModal}>
            <Plus size={14} /> Add CCMS Station
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>CCMS Name &amp; UID</th>
                <th>City &amp; Zone</th>
                <th>Ward</th>
                <th>Status</th>
                <th>Mode</th>
                <th>DCUs</th>
                <th>Devices</th>
                <th>kWh Today</th>
                <th>Active Faults</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                  onClick={() => navigate(`/ccms/${c.id}`)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: c.connectivity_status === 'online' ? '#10b981' : '#6b7280',
                          boxShadow: c.connectivity_status === 'online' ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.uid}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.ward?.zone?.city?.name || 'Kolkata'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.ward?.zone?.name || 'Central'}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{c.ward?.name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {CONN_ICON[c.connectivity_status]}
                      <span
                        className="badge"
                        style={{
                          background: (STATUS_COLOR[c.status] || '#10b981') + '20',
                          color: STATUS_COLOR[c.status] || '#10b981',
                          textTransform: 'capitalize',
                        }}
                      >
                        {c.connectivity_status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {SCHEDULE_ICON[c.schedule_mode] || <Sun size={13} />}
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                        {c.schedule_mode === 'astronomical' ? 'Astro' : c.schedule_mode}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ fontWeight: 600 }}>
                      {c.dcus?.length || 0} DCUs
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.device_count ?? 0}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                      ({c.online_device_count ?? 0} on)
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#10b981' }}>
                      {c.kwh_today ? Number(c.kwh_today).toLocaleString() : '1,250'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>kWh</span>
                  </td>
                  <td>
                    {c.active_faults > 0 ? (
                      <span className="badge badge-critical" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} /> {c.active_faults} Fault{c.active_faults > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={11} /> Healthy
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openSettingsModal(c)}
                        title="Station Settings & Change Log"
                      >
                        <Settings size={13} style={{ marginRight: 4 }} /> Settings
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/ccms/${c.id}`)}
                        title="Open CCMS Dashboard"
                      >
                        Dashboard <ChevronRight size={13} style={{ marginLeft: 3 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          1. ADD CCMS STATION MODAL (Provisioning new station)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--r-sm)',
              background: 'var(--grad-brand)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <Plus size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Add New CCMS Station</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                Provision new three-phase feeder panel into city grid
              </div>
            </div>
          </div>
        }
        size="lg"
      >
        {addError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--r-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{addError}</span>
          </div>
        )}

        <form onSubmit={handleCreate}>
          {/* Station Identity */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-title">
                <Building2 size={15} color="var(--brand)" /> 1. Station Identity &amp; Location
              </div>
              <span className="form-section-subtitle">Core registry details</span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Station Name *</label>
                <input
                  required
                  className="form-input"
                  placeholder="e.g. CCMS Feeder Station W101"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Station UID *</label>
                <input
                  required
                  className="form-input"
                  placeholder="e.g. CCMS-W101-001"
                  value={addForm.uid}
                  onChange={(e) => setAddForm((f) => ({ ...f, uid: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ward Jurisdiction *</label>
                <select
                  required
                  className="form-select"
                  value={addForm.ward_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, ward_id: e.target.value }))}
                >
                  <option value="">Select Ward Jurisdiction…</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.zone?.city?.name ? `(${w.zone.city.name} - ${w.zone.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Energy Meter Serial</label>
                <input
                  className="form-input"
                  placeholder="e.g. MTR-KOL-20240001"
                  value={addForm.meter_serial}
                  onChange={(e) => setAddForm((f) => ({ ...f, meter_serial: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-title">
                <Compass size={15} color="#10b981" /> 2. Astronomical Coordinates
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddForm((f) => ({ ...f, latitude: '22.5726', longitude: '88.3639' }))}
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                <Sparkles size={12} style={{ marginRight: 4 }} /> Set Kolkata Defaults
              </button>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Latitude (°N) *</label>
                <input
                  required
                  type="number"
                  step="0.000001"
                  className="form-input"
                  placeholder="e.g. 22.572646"
                  value={addForm.latitude}
                  onChange={(e) => setAddForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude (°E) *</label>
                <input
                  required
                  type="number"
                  step="0.000001"
                  className="form-input"
                  placeholder="e.g. 88.363895"
                  value={addForm.longitude}
                  onChange={(e) => setAddForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Electrical Specs */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-title">
                <Zap size={15} color="#f59e0b" /> 3. Electrical Specifications
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Panel Capacity (kVA)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  placeholder="e.g. 25.0"
                  value={addForm.panel_capacity_kva}
                  onChange={(e) => setAddForm((f) => ({ ...f, panel_capacity_kva: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tariff Rate (₹/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={addForm.energy_rate_kwh}
                  onChange={(e) => setAddForm((f) => ({ ...f, energy_rate_kwh: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddModal(false)}
              disabled={savingAdd}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingAdd}>
              {savingAdd ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Adding…
                </>
              ) : (
                <>
                  <Check size={14} /> Provision CCMS Station
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          2. STATION SETTINGS & CHANGE LOG MODAL (Different from Add)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--r-sm)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <Settings size={18} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {settingsStation?.name} — Station Settings
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                UID: {settingsStation?.uid} • Ward: {settingsStation?.ward?.name || '—'}
              </div>
            </div>
          </div>
        }
        size="lg"
      >
        {/* Tab Switcher between Settings & Activity Change Log */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          <button
            className={`tab-btn ${settingsTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSettingsTab('settings')}
          >
            <Sliders size={14} style={{ marginRight: 6 }} /> Operational Settings
          </button>
          <button
            className={`tab-btn ${settingsTab === 'activity' ? 'active' : ''}`}
            onClick={() => {
              setSettingsTab('activity');
              if (settingsStation) fetchStationActivity(settingsStation.id);
            }}
          >
            <History size={14} style={{ marginRight: 6 }} />
            Settings Change Log &amp; Activity
            {activityLogs.length > 0 && (
              <span className="tab-badge">{activityLogs.length}</span>
            )}
          </button>
        </div>

        {settingsError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--r-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{settingsError}</span>
          </div>
        )}

        {/* Tab 1: Settings Form */}
        {settingsTab === 'settings' && (
          <form onSubmit={handleSaveSettings}>
            {/* Operating Schedule Mode */}
            <div className="form-section">
              <div className="form-section-header">
                <div className="form-section-title">
                  <Sliders size={15} color="#8b5cf6" /> 1. Operating Schedule Mode
                </div>
                <span className="form-section-subtitle">Automated switching strategy</span>
              </div>

              <div className="form-mode-grid">
                <div
                  className={`form-mode-card ${settingsForm.schedule_mode === 'astronomical' ? 'active' : ''}`}
                  onClick={() => setSettingsForm((f) => ({ ...f, schedule_mode: 'astronomical' }))}
                >
                  <div className="form-mode-card-icon"><Sun size={18} /></div>
                  <div className="form-mode-card-title">Astronomical</div>
                  <div className="form-mode-card-desc">Sunset ON &amp; Sunrise OFF daily</div>
                </div>

                <div
                  className={`form-mode-card ${settingsForm.schedule_mode === 'manual' ? 'active' : ''}`}
                  onClick={() => setSettingsForm((f) => ({ ...f, schedule_mode: 'manual' }))}
                >
                  <div className="form-mode-card-icon"><Clock size={18} /></div>
                  <div className="form-mode-card-title">Manual Schedule</div>
                  <div className="form-mode-card-desc">Fixed daily clock ON/OFF timings</div>
                </div>

                <div
                  className={`form-mode-card ${settingsForm.schedule_mode === 'auto' ? 'active' : ''}`}
                  onClick={() => setSettingsForm((f) => ({ ...f, schedule_mode: 'auto' }))}
                >
                  <div className="form-mode-card-icon"><Sliders size={18} /></div>
                  <div className="form-mode-card-title">Auto / Photocell</div>
                  <div className="form-mode-card-desc">Central commands &amp; sensors</div>
                </div>
              </div>

              {settingsForm.schedule_mode === 'astronomical' && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Sunset ON Offset (minutes)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={settingsForm.on_offset_minutes}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, on_offset_minutes: e.target.value }))}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Negative (e.g. -5) turns ON 5 min before sunset
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sunrise OFF Offset (minutes)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={settingsForm.off_offset_minutes}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, off_offset_minutes: e.target.value }))}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Positive (e.g. +5) keeps ON 5 min past sunrise
                    </span>
                  </div>
                </div>
              )}

              {settingsForm.schedule_mode === 'manual' && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Scheduled Daily ON Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={settingsForm.manual_on_time}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, manual_on_time: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Scheduled Daily OFF Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={settingsForm.manual_off_time}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, manual_off_time: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Geographical Coordinates */}
            <div className="form-section">
              <div className="form-section-header">
                <div className="form-section-title">
                  <Compass size={15} color="#10b981" /> 2. Astronomical Position Anchor
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    value={settingsForm.latitude}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, latitude: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    value={settingsForm.longitude}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, longitude: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Electrical & Tariff */}
            <div className="form-section">
              <div className="form-section-header">
                <div className="form-section-title">
                  <Zap size={15} color="#f59e0b" /> 3. Feeder Capacity &amp; Tariff
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Station Name</label>
                  <input
                    required
                    className="form-input"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meter Serial</label>
                  <input
                    className="form-input"
                    value={settingsForm.meter_serial}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, meter_serial: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Panel Capacity (kVA)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={settingsForm.panel_capacity_kva}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, panel_capacity_kva: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Electricity Tariff Rate (₹ / kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={settingsForm.energy_rate_kwh}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, energy_rate_kwh: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSettingsModal(false)}
                disabled={savingSettings}
              >
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…
                  </>
                ) : (
                  <>
                    <Check size={14} /> Save Settings &amp; Log Change
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Change Log & Activity */}
        {settingsTab === 'activity' && (
          <div style={{ padding: '4px 0' }}>
            <CCMSActivityLog
              logs={activityLogs}
              loading={loadingActivity}
              onRefresh={() => settingsStation && fetchStationActivity(settingsStation.id)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
