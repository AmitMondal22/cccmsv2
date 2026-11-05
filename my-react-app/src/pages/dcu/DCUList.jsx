import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Plus, Search, RefreshCw, Wifi, WifiOff,
  ChevronRight, Building2, MapPin, Cpu, AlertTriangle
} from 'lucide-react';

import { getDCUList, createDCU } from '../../api/dcu.api.js';
import { getCCMSList } from '../../api/ccms.api.js';

const STATUS_COLOR = {
  active:   '#10b981',
  inactive: '#6b7280',
  fault:    '#ef4444',
};

const PROTOCOL_COLOR = {
  DALI:     '#6366f1',
  '0-10V':  '#f59e0b',
  Wireless: '#10b981',
  RS485:    '#8b5cf6',
  PLC:      '#3b82f6',
};

function StatCard({ label, value, color, icon }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-card-icon" style={{ color }}>{icon}</div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

export default function DCUList() {
  const navigate = useNavigate();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    uid: '', name: '', ccms_id: '',
    communication_protocol: 'DALI', max_devices: 50,
    serial_number: '', firmware_version: '',
  });
  const [ccmsList, setCcmsList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDCUList();
      setData(Array.isArray(res.data) ? res.data : []);
    } catch { setData([]); }
    setLoading(false);
  }, []);

  const loadCCMS = useCallback(async () => {
    try {
      const res = await getCCMSList();
      setCcmsList(Array.isArray(res.data) ? res.data : []);
    } catch { setCcmsList([]); }
  }, []);

  useEffect(() => { load(); loadCCMS(); }, []);

  const filtered = data.filter(d => {
    const matchSearch = !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.uid?.toLowerCase().includes(search.toLowerCase()) ||
      d.ccms?.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || d.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total:    data.length,
    online:   data.filter(d => d.connectivity_status === 'online').length,
    fault:    data.filter(d => d.status === 'fault').length,
    devices:  data.reduce((s, d) => s + (d.dcuDevices?.length || 0), 0),
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await createDCU({
        ...form,
        ccms_id: parseInt(form.ccms_id),
        max_devices: parseInt(form.max_devices) || 50,
      });
      setShowForm(false);
      setForm({ uid: '', name: '', ccms_id: '', communication_protocol: 'DALI', max_devices: 50, serial_number: '', firmware_version: '' });
      load();
    } catch (e3) { setError(e3.response?.data?.error || e3.message); }
    setSaving(false);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Server size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: '#8b5cf6' }} />
            DCU Units
          </h1>
          <p className="page-subtitle">Data Concentrator Unit management</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add DCU
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <StatCard label="Total DCUs"   value={stats.total}   color="#8b5cf6" icon={<Server size={16} />} />
        <StatCard label="Online"       value={stats.online}  color="#10b981" icon={<Wifi size={16} />} />
        <StatCard label="Fault"        value={stats.fault}   color="#ef4444" icon={<AlertTriangle size={16} />} />
        <StatCard label="Total Devices" value={stats.devices} color="#3b82f6" icon={<Cpu size={16} />} />
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} />
          <input
            placeholder="Search DCU by name, UID, CCMS…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {['all', 'active', 'inactive', 'fault'].map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading DCU units…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Server size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>No DCU units found</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Create your first DCU linked to a CCMS station
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / UID</th>
                <th>CCMS Station</th>
                <th>Protocol</th>
                <th>Devices</th>
                <th>Connectivity</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const deviceCount = d.dcuDevices?.length || 0;
                const capacityPct = Math.round((deviceCount / (d.max_devices || 50)) * 100);
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dcu/${d.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{d.uid}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Building2 size={12} style={{ color: '#6366f1' }} />
                        <span>{d.ccms?.name || '—'}</span>
                      </div>
                      {d.ccms?.ward?.name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <MapPin size={10} style={{ marginRight: 2 }} />
                          {d.ccms.ward.name}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: (PROTOCOL_COLOR[d.communication_protocol] || '#6b7280') + '20',
                        color: PROTOCOL_COLOR[d.communication_protocol] || '#6b7280'
                      }}>
                        {d.communication_protocol}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{deviceCount} / {d.max_devices}</div>
                      <div style={{
                        height: 4, borderRadius: 2, background: 'var(--bg-tertiary)',
                        marginTop: 4, width: 60, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${capacityPct}%`,
                          background: capacityPct > 80 ? '#ef4444' : '#10b981',
                        }} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {d.connectivity_status === 'online'
                          ? <Wifi size={13} color="#10b981" />
                          : <WifiOff size={13} color="#6b7280" />}
                        <span style={{ textTransform: 'capitalize' }}>{d.connectivity_status}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: STATUS_COLOR[d.status] + '20',
                        color: STATUS_COLOR[d.status],
                      }}>
                        {d.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/dcu/${d.id}`)}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create DCU Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Server size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Add DCU Unit</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>DCU UID *</label>
                  <input required placeholder="e.g. DCU-001" value={form.uid}
                    onChange={e => setForm(f => ({ ...f, uid: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input required placeholder="DCU name" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>CCMS Station *</label>
                  <select required value={form.ccms_id}
                    onChange={e => setForm(f => ({ ...f, ccms_id: e.target.value }))}>
                    <option value="">Select CCMS…</option>
                    {ccmsList.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ward?.name})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Protocol</label>
                  <select value={form.communication_protocol}
                    onChange={e => setForm(f => ({ ...f, communication_protocol: e.target.value }))}>
                    {['DALI', '0-10V', 'Wireless', 'RS485', 'PLC'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Max Devices</label>
                  <input type="number" min="1" max="50" value={form.max_devices}
                    onChange={e => setForm(f => ({ ...f, max_devices: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Serial Number</label>
                  <input placeholder="Hardware serial" value={form.serial_number}
                    onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Firmware Version</label>
                  <input placeholder="e.g. v1.2.0" value={form.firmware_version}
                    onChange={e => setForm(f => ({ ...f, firmware_version: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Create DCU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
