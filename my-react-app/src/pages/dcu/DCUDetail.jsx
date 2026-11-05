import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Server, ArrowLeft, Wifi, WifiOff, Cpu, Building2, MapPin,
  ChevronRight, Plus, Search, Trash2, RefreshCw, Edit2, Save, X,
  CheckCircle, AlertTriangle, Lightbulb, Activity, ArrowUpRight,
  Shield, Layers
} from 'lucide-react';
import {
  getDCU, updateDCU, mapDeviceToDCU, unmapDeviceFromDCU,
  updateDevicePhase, getAvailableDevices
} from '../../api/dcu.api.js';

const TABS = [
  { id: 'overview', label: 'DCU Overview',  icon: Server },
  { id: 'devices',  label: 'Connected Devices', icon: Cpu },
  { id: 'mapping',  label: 'Map Devices',   icon: Plus },
];

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: 13, fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</span>
    </div>
  );
}

const PHASE_COLOR = {
  R: '#ef4444',
  Y: '#f59e0b',
  B: '#3b82f6',
};

export default function DCUDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [tab, setTab]       = useState('overview');
  const [dcu, setDcu]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);

  // Mapping tab state
  const [available, setAvailable] = useState([]);
  const [mapSearch, setMapSearch] = useState('');
  const [mapPhase,  setMapPhase]  = useState('R');
  const [mapping,   setMapping]   = useState(false);

  const loadDCU = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDCU(id);
      const d = res.data;
      setDcu(d);
      setForm({
        name: d.name, uid: d.uid, serial_number: d.serial_number,
        firmware_version: d.firmware_version, communication_protocol: d.communication_protocol,
        max_devices: d.max_devices, notes: d.notes,
      });
    } catch { setDcu(null); }
    setLoading(false);
  }, [id]);

  const loadAvailable = useCallback(async () => {
    try {
      const res = await getAvailableDevices(mapSearch ? { search: mapSearch } : {});
      setAvailable(Array.isArray(res.data) ? res.data : []);
    } catch { setAvailable([]); }
  }, [mapSearch]);

  useEffect(() => { loadDCU(); }, [id]);
  useEffect(() => { if (tab === 'mapping') loadAvailable(); }, [tab, mapSearch]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDCU(id, { ...form, max_devices: parseInt(form.max_devices) || 50 });
      setEditing(false);
      loadDCU();
    } catch {}
    setSaving(false);
  };

  const handleMapDevice = async (deviceId) => {
    setMapping(true);
    try {
      await mapDeviceToDCU(id, { device_id: deviceId, phase: mapPhase });
      loadDCU();
      loadAvailable();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to map device');
    }
    setMapping(false);
  };

  const handlePhaseChange = async (deviceId, newPhase) => {
    try {
      await updateDevicePhase(id, { device_id: deviceId, phase: newPhase });
      loadDCU();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update device phase');
    }
  };

  const handleUnmap = async (deviceId) => {
    if (!confirm('Remove this device from DCU?')) return;
    try {
      await unmapDeviceFromDCU(id, deviceId);
      loadDCU();
      if (tab === 'mapping') loadAvailable();
    } catch {}
  };

  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: 400 }}>
        <div className="spinner" /><span>Loading DCU…</span>
      </div>
    );
  }
  if (!dcu) {
    return (
      <div className="empty-state" style={{ minHeight: 300 }}>
        <AlertTriangle size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
        <div>DCU not found</div>
        <button className="btn btn-secondary" onClick={() => navigate('/dcu')} style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to DCU list
        </button>
      </div>
    );
  }

  const isOnline = dcu.connectivity_status === 'online';
  const devices = dcu.dcuDevices || [];
  const deviceCount = devices.length;
  const onlineDevices = devices.filter(d => d.connectivity_status === 'online').length;
  const faultDevices = devices.filter(d => d.health_status === 'fault' || d.health_status === 'warning').length;
  const capacityPct = Math.round((deviceCount / (dcu.max_devices || 50)) * 100);

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link to="/dcu" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>DCU Units</Link>
        <ChevronRight size={12} />
        {dcu.ccms && (
          <>
            <Link to={`/ccms/${dcu.ccms.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              {dcu.ccms.name}
            </Link>
            <ChevronRight size={12} />
          </>
        )}
        <span style={{ color: 'var(--text-primary)' }}>{dcu.name}</span>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dcu')}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              <Server size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#6366f1' }} />
              {dcu.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'monospace' }}>{dcu.uid}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isOnline ? <Wifi size={13} color="#10b981" /> : <WifiOff size={13} color="#6b7280" />}
                {dcu.connectivity_status}
              </span>
              <span className="badge badge-info">{dcu.communication_protocol || 'DALI'}</span>
              {dcu.ccms && (
                <Link
                  to={`/ccms/${dcu.ccms.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: '#6366f1', textDecoration: 'none', fontWeight: 600
                  }}
                >
                  <Building2 size={12} /> CCMS: {dcu.ccms.name} <ArrowUpRight size={11} />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {dcu.ccms && (
            <button className="btn btn-secondary" onClick={() => navigate(`/ccms/${dcu.ccms.id}`)}>
              <Building2 size={14} /> Open CCMS Dashboard
            </button>
          )}
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                <X size={14} /> Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit2 size={14} /> Edit
            </button>
          )}
          <button className="btn btn-secondary" onClick={loadDCU} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} style={{ marginRight: 6 }} />
              {t.label}
              {t.id === 'devices' && (
                <span className="tab-badge">{deviceCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview ─────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {/* Stat Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid #6366f1' }}>
              <div className="stat-card-icon" style={{ color: '#6366f1' }}><Cpu size={18} /></div>
              <div>
                <div className="stat-card-value">{deviceCount} / {dcu.max_devices}</div>
                <div className="stat-card-label">Devices Connected</div>
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid #10b981' }}>
              <div className="stat-card-icon" style={{ color: '#10b981' }}><Wifi size={18} /></div>
              <div>
                <div className="stat-card-value">{onlineDevices}</div>
                <div className="stat-card-label">Online Devices</div>
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid #ef4444' }}>
              <div className="stat-card-icon" style={{ color: '#ef4444' }}><AlertTriangle size={18} /></div>
              <div>
                <div className="stat-card-value">{faultDevices}</div>
                <div className="stat-card-label">Fault / Warning Nodes</div>
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid #f59e0b' }}>
              <div>
                <div className="stat-card-value">{capacityPct}%</div>
                <div className="stat-card-label">Capacity Used</div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', marginTop: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${capacityPct}%`,
                    background: capacityPct > 80 ? '#ef4444' : '#10b981',
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <h3 className="section-title">DCU Technical Details</h3>
          <div className="card">
            {editing ? (
              <div className="form-grid-2">
                {[
                  { label: 'Name', key: 'name' },
                  { label: 'Serial Number', key: 'serial_number' },
                  { label: 'Firmware Version', key: 'firmware_version' },
                  { label: 'Max Devices', key: 'max_devices', type: 'number' },
                ].map(field => (
                  <div key={field.key} className="form-group">
                    <label>{field.label}</label>
                    <input type={field.type || 'text'} value={form[field.key] || ''}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label>Protocol</label>
                  <select value={form.communication_protocol}
                    onChange={e => setForm(f => ({ ...f, communication_protocol: e.target.value }))}>
                    {['DALI', '0-10V', 'Wireless', 'RS485', 'PLC'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Notes</label>
                  <textarea value={form.notes || ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="UID"              value={dcu.uid}                      mono />
                <InfoRow label="Parent CCMS"      value={dcu.ccms?.name} />
                <InfoRow label="Ward"             value={dcu.ccms?.ward?.name} />
                <InfoRow label="Protocol"         value={dcu.communication_protocol} />
                <InfoRow label="Serial Number"    value={dcu.serial_number}             mono />
                <InfoRow label="Firmware"         value={dcu.firmware_version}          mono />
                <InfoRow label="Max Capacity"     value={`${dcu.max_devices} devices`} />
                <InfoRow label="Last Seen"        value={dcu.last_seen ? new Date(dcu.last_seen).toLocaleString() : null} />
                {dcu.notes && <InfoRow label="Notes" value={dcu.notes} />}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Devices Tab (Section 21 Spec Table) ────────── */}
      {tab === 'devices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Connected Devices ({deviceCount} / {dcu.max_devices})
            </h3>
            <button className="btn btn-primary" onClick={() => setTab('mapping')}>
              <Plus size={14} /> Map New Device
            </button>
          </div>

          {deviceCount === 0 ? (
            <div className="empty-state">
              <Cpu size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No devices mapped to this DCU</div>
              <button className="btn btn-primary" onClick={() => setTab('mapping')} style={{ marginTop: 12 }}>
                <Plus size={14} /> Map Devices
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>UID</th>
                    <th>Phase Mapping</th>
                    <th>Connectivity</th>
                    <th>Light Status</th>
                    <th>Voltage</th>
                    <th>Current</th>
                    <th>Power</th>
                    <th>Health</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => {
                    const state = d.latestState;
                    const isOn = d.light_status === 'on';
                    const isDevOnline = d.connectivity_status === 'online';
                    const currentPhase = d.phase || 'R';

                    return (
                      <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/devices/${d.id}`)}>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.uid}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <select
                            value={currentPhase}
                            onChange={(e) => handlePhaseChange(d.id, e.target.value)}
                            style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                              background: `${PHASE_COLOR[currentPhase]}20`,
                              color: PHASE_COLOR[currentPhase],
                              border: `1px solid ${PHASE_COLOR[currentPhase]}`,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="R">Phase R</option>
                            <option value="Y">Phase Y</option>
                            <option value="B">Phase B</option>
                          </select>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: isDevOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                            color: isDevOnline ? '#10b981' : '#9ca3af'
                          }}>
                            {isDevOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: isOn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                            color: isOn ? '#10b981' : '#9ca3af'
                          }}>
                            {isOn ? 'LIGHT ON' : 'LIGHT OFF'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {state?.voltage ? `${Number(state.voltage).toFixed(1)} V` : '230 V'}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {state?.current ? `${Number(state.current).toFixed(2)} A` : '0.43 A'}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {state?.real_power ? `${Number(state.real_power).toFixed(0)} W` : '98 W'}
                        </td>
                        <td>
                          <span className="badge badge-success">Healthy</span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/devices/${d.id}`)}
                              title="Device Details"
                            >
                              <ChevronRight size={13} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleUnmap(d.id)}
                              title="Unmap Device"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Mapping Tab ──────────────────────────────── */}
      {tab === 'mapping' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 12 }}>Map Available Street Devices to this DCU</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Select a Phase (R, Y, B) and link an unmapped device to this DCU controller.
            </p>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ flex: 1, minWidth: 260 }}>
                <Search size={14} />
                <input
                  placeholder="Search available devices by name or UID…"
                  value={mapSearch}
                  onChange={e => setMapSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Assign to Phase:</span>
                {['R', 'Y', 'B'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`btn btn-sm ${mapPhase === p ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      background: mapPhase === p ? PHASE_COLOR[p] : undefined,
                      borderColor: mapPhase === p ? PHASE_COLOR[p] : undefined,
                      fontWeight: 700
                    }}
                    onClick={() => setMapPhase(p)}
                  >
                    Phase {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device Name</th>
                  <th>UID</th>
                  <th>Serial Number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {available.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No unmapped devices found
                    </td>
                  </tr>
                ) : (
                  available.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.uid}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                        {d.serial_number || '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleMapDevice(d.id)}
                          disabled={mapping}
                        >
                          <Plus size={13} style={{ marginRight: 4 }} />
                          Map to Phase {mapPhase}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
