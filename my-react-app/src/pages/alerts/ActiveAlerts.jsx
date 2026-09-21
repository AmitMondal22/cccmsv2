import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAlerts, getActiveStats, acknowledgeAlert, resolveAlert, closeAlert } from '../../api/alert.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

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

  const handleResolve = async (id, e) => {
    e.stopPropagation();
    await resolveAlert(id, { notes: 'Resolved via dashboard' });
    fetch(page);
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
            <button className="btn btn-success btn-sm" onClick={(e) => handleResolve(r.id, e)} title="Resolve">
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
    </div>
  );
}
