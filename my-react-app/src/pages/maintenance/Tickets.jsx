import { useState, useEffect } from 'react';
import { getTickets, getTicketStats, createTicket, updateTicket, resolveTicket } from '../../api/maintenance.api.js';
import { getDevices } from '../../api/device.api.js';
import { getUsers } from '../../api/user.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Plus, RefreshCw, Wrench, UserCheck } from 'lucide-react';
import { formatISTDate, formatISTDateTime } from '../../utils/date.js';

const STATUS_COLS = [
  { key: 'open',        label: 'Open',        color: '#ef4444' },
  { key: 'assigned',    label: 'Assigned',    color: '#4f8ef7' },
  { key: 'in_progress', label: 'In Progress', color: '#f97316' },
  { key: 'pending',     label: 'Pending',     color: '#f59e0b' },
  { key: 'resolved',    label: 'Resolved',    color: '#22c55e' },
];

const defaultForm = {
  device_id: '', title: '', description: '', problem_type: 'luminaire_outage',
  priority: 'medium', status: 'open', assigned_to: '', assigned_team: '', due_date: '',
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const [tRes, sRes] = await Promise.all([getTickets(params), getTicketStats()]);
      setTickets(tRes.data.data || []);
      setStats(sRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [statusFilter]);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, uRes] = await Promise.all([getDevices({ limit: 200 }), getUsers()]);
        setDevices(dRes.data.data || []);
        setUsers(uRes.data || []);
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    if (!form.device_id || !form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        device_id: parseInt(form.device_id),
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
        due_date: form.due_date ? form.due_date : null,
      };
      await createTicket(payload);
      setModal(false);
      setForm(defaultForm);
      fetch();
    } catch (e) {
      console.error('Failed to create ticket', e);
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      if (status === 'resolved') {
        await resolveTicket(id, { repair_notes: 'Resolved via dashboard' });
      } else {
        await updateTicket(id, { status });
      }
      fetch();
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Tickets</h1>
          <p className="page-subtitle">{stats.total || 0} active tickets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={fetch}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={14} /> New Ticket</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_COLS.map(col => (
          <div
            key={col.key}
            className="card"
            style={{ padding: '12px 20px', cursor: 'pointer', borderColor: statusFilter === col.key ? col.color : 'var(--border)', flex: '1', minWidth: 100, textAlign: 'center' }}
            onClick={() => setStatusFilter(p => p === col.key ? '' : col.key)}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: col.color }}>{stats[col.key === 'in_progress' ? 'inProgress' : col.key] ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.label}</div>
          </div>
        ))}
      </div>

      {/* Ticket Table */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /> Loading tickets...</div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Device</th>
                <th>Location</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No tickets found</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12 }}>{t.ticket_number}</td>
                  <td><span style={{ fontWeight: 600 }}>{t.device?.uid || '—'}</span><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.device?.name}</span></td>
                  <td style={{ fontSize: 11 }}>
                    {[t.device?.street?.ward?.zone?.name, t.device?.street?.ward?.name, t.device?.street?.name].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td>{t.title}</td>
                  <td><StatusBadge value={t.priority} type="priority" /></td>
                  <td><StatusBadge value={t.status} type="ticket_status" /></td>
                  <td className="dim">{t.assignedTechnician?.name || '—'}</td>
                  <td className="dim">{t.due_date ? formatISTDate(t.due_date) : '—'}</td>
                  <td>
                    <select
                      className="form-select"
                      style={{ width: 110, fontSize: 11, padding: '3px 8px' }}
                      value={t.status}
                      onChange={e => handleUpdateStatus(t.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="open">Open</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal
        title="Create Maintenance Ticket"
        open={modal}
        onClose={() => { setModal(false); setForm(defaultForm); }}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.device_id || !form.title.trim()}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Device *</label>
            <select className="form-select" value={form.device_id} onChange={e => setForm(p => ({ ...p, device_id: e.target.value }))}>
              <option value="">Select Device</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.uid} — {d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Luminaire Outage / Driver Replacement" />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Problem Type</label>
            <select className="form-select" value={form.problem_type} onChange={e => setForm(p => ({ ...p, problem_type: e.target.value }))}>
              <option value="luminaire_outage">Luminaire Outage / Load Drop</option>
              <option value="undervoltage_fault">Under-Voltage Trip</option>
              <option value="overvoltage_fault">Over-Voltage Trip</option>
              <option value="power_factor_degradation">Low Power Factor / Capacitor Wear</option>
              <option value="physical_damage">Physical / Pole Damage</option>
              <option value="general_maintenance">General Inspection</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assign Technician</label>
            <select className="form-select" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">Select Technician...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the physical observation or electrical readings..." />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Assigned Team</label>
            <input className="form-input" value={form.assigned_team} onChange={e => setForm(p => ({ ...p, assigned_team: e.target.value }))} placeholder="Field Operations Team A" />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

