import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAlerts, getActiveStats, acknowledgeAlert, resolveAlert, closeAlert } from '../../api/alert.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import Modal from '../../components/common/Modal.jsx';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, CheckCircle2, Languages } from 'lucide-react';

const SEVERITY_CONFIG = [
  { key: 'critical', label: 'Critical', color: '#ef4444', rgb: '239,68,68', icon: '🔴' },
  { key: 'major',    label: 'Major',    color: '#f97316', rgb: '249,115,22', icon: '🟠' },
  { key: 'warning',  label: 'Warning',  color: '#f59e0b', rgb: '245,158,11', icon: '🟡' },
  { key: 'info',     label: 'Info',     color: '#38bdf8', rgb: '56,189,248', icon: '🔵' },
];

function timeSince(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function ActiveAlerts() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ critical: 0, major: 0, warning: 0, info: 0 });
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSev, setSelectedSev] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Multilingual Resolve Modal State
  const [resolveModal, setResolveModal] = useState(false);
  const [selectedAlertToResolve, setSelectedAlertToResolve] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetch = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 50 };
      if (selectedSev) params.severity = selectedSev;
      if (selectedStatus) params.status = selectedStatus;
      const [sRes, aRes] = await Promise.all([getActiveStats(), getAlerts(params)]);
      setStats(sRes.data);
      setAlerts(aRes.data.data || []);
      setTotal(aRes.data.total || 0);
      setPages(aRes.data.pages || 1);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch(1); }, [selectedSev, selectedStatus]);

  const handleAck = async (id, e) => {
    e.stopPropagation();
    await acknowledgeAlert(id);
    fetch(page);
  };

  const handleOpenResolve = (alertObj, e) => {
    e.stopPropagation();
    setSelectedAlertToResolve(alertObj);
    setResolutionNotes('');
    setResolveModal(true);
  };

  const handleConfirmResolve = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAlertToResolve) return;
    setResolving(true);
    try {
      const notes = resolutionNotes.trim() || 'Resolved via dashboard';
      await resolveAlert(selectedAlertToResolve.id, { notes });
      setResolveModal(false);
      setSelectedAlertToResolve(null);
      setResolutionNotes('');
      fetch(page);
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
    setResolving(false);
  };

  const columns = [
    { key: 'detected_at', label: 'Time', render: (v) => <span style={{ fontSize: 11 }}>{new Date(v).toLocaleTimeString('en-IN', { hour12: false })}</span> },
    { key: '_device_uid', label: 'Device', render: (_, r) => <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{r.device?.uid || '—'}</span>, sortable: false },
    { key: '_zone', label: 'Zone', render: (_, r) => r.device?.street?.ward?.zone?.name || '—', sortable: false },
    { key: '_ward', label: 'Ward', render: (_, r) => r.device?.street?.ward?.name || '—', sortable: false },
    { key: 'alert_type', label: 'Fault', render: (v) => <span style={{ textTransform: 'capitalize' }}>{v?.replace(/_/g, ' ')}</span> },
    { key: 'severity', label: 'Severity', render: (v) => <StatusBadge value={v} type="severity" /> },
    { key: '_duration', label: 'Duration', render: (_, r) => timeSince(r.detected_at), sortable: false },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge value={v} type="alert_status" /> },
    {
      key: '_actions', label: 'Actions', sortable: false,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {r.status === 'open' && (
            <button className="btn btn-secondary btn-sm" onClick={(e) => handleAck(r.id, e)} title="Acknowledge">
              <CheckCircle size={12} />
            </button>
          )}
          {['open', 'acknowledged', 'assigned', 'in_progress'].includes(r.status) && (
            <button className="btn btn-success btn-sm" onClick={(e) => handleOpenResolve(r, e)} title="Resolve">
              <XCircle size={12} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">{stats.total} active · {total} total matching</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" style={{ width: 130 }} value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="auto_recovered">Auto Recovered</option>
          </select>
          <button className="btn btn-secondary" onClick={() => fetch(1)}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Severity Cards */}
      <div className="severity-cards">
        {SEVERITY_CONFIG.map(sv => (
          <div
            key={sv.key}
            className={`severity-card ${selectedSev === sv.key ? 'selected' : ''}`}
            style={{ '--sv-color': sv.color, '--sv-rgb': sv.rgb }}
            onClick={() => setSelectedSev(p => p === sv.key ? '' : sv.key)}
          >
            <div className="severity-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="severity-count">{stats[sv.key] ?? 0}</div>
              <div className="severity-label">{sv.label}</div>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={alerts}
        loading={loading}
        total={total}
        page={page}
        pages={pages}
        limit={50}
        onPageChange={(p) => { setPage(p); fetch(p); }}
        onRowClick={(row) => navigate(`/devices/${row.device_id}`)}
        emptyText="No alerts match your filters"
      />

      {/* ── Multilingual Alert Resolution Modal ── */}
      {resolveModal && selectedAlertToResolve && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#22c55e" />
              <span>Resolve Alert #{selectedAlertToResolve.id} ({selectedAlertToResolve.device?.uid || 'Device'})</span>
            </div>
          }
          onClose={() => { setResolveModal(false); setSelectedAlertToResolve(null); }}
        >
          <form onSubmit={handleConfirmResolve}>
            {/* Alert Context Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {selectedAlertToResolve.alert_type?.replace(/_/g, ' ')}
                </span>
                <StatusBadge value={selectedAlertToResolve.severity} type="severity" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {selectedAlertToResolve.message}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Detected: {new Date(selectedAlertToResolve.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>

            {/* Multilingual Support Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#93c5fd',
              marginBottom: 14
            }}>
              <Languages size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>All Languages Supported (UTF-8):</strong> हिन्दी, বাংলা, தமிழ், मराठी, ગુજરાતી, English, etc.
              </div>
            </div>

            {/* Quick Resolution Preset Chips */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: 11, marginBottom: 6, display: 'block' }}>
                Quick Resolution Presets (क्विक चयन):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '✅ Lamp Replaced', hi: 'बल्ब बदला गया', text: 'Lamp Replaced / नया बल्ब लगाया गया' },
                  { label: '⚡ Voltage Restored', hi: 'वोल्टेज सामान्य', text: 'Line Voltage Restored / बिजली बहाल की गई' },
                  { label: '🔧 Driver Fixed', hi: 'ड्राइवर मरम्मत', text: 'LED Driver / SMPS Repaired / ड्राइवर ठीक किया गया' },
                  { label: '🔌 Wiring Fixed', hi: 'तार कनेक्शन ठीक', text: 'Wiring / Cable Fault Restored / केबल ठीक की गई' },
                  { label: '👁️ Field Inspection', hi: 'जांच पूर्ण', text: 'Field Inspection Completed - Device Normal / निरीक्षण पूर्ण' },
                  { label: '🌧️ Weather Cleared', hi: 'मौसम सामान्य', text: 'Weather Condition Cleared / मौसम जनित समस्या समाप्त' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 14,
                      background: resolutionNotes === preset.text ? 'rgba(59, 130, 246, 0.25)' : undefined,
                      borderColor: resolutionNotes === preset.text ? '#3b82f6' : undefined,
                    }}
                    onClick={() => setResolutionNotes(preset.text)}
                  >
                    {preset.label} <span style={{ opacity: 0.65, fontSize: 10, marginLeft: 2 }}>({preset.hi})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multilingual Text Input */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                <span>Resolution Notes / समाधान विवरण *</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Any language / script</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                required
                placeholder="Enter resolution notes in any language (उदा. बल्ब बदल दिया गया है / Lamp replaced by technician)..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setResolveModal(false); setSelectedAlertToResolve(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={resolving || !resolutionNotes.trim()}
              >
                {resolving ? 'Resolving...' : 'Resolve Alert'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

