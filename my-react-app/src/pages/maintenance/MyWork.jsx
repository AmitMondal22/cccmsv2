import { useState, useEffect } from 'react';
import { getTickets, resolveTicket, updateTicket } from '../../api/maintenance.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import { ClipboardList, CheckCircle2, Clock, Wrench, AlertTriangle, RefreshCw, UserCheck } from 'lucide-react';
import { formatISTDateTime, formatISTDate } from '../../utils/date.js';

export default function MyWork() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await getTickets({ limit: 100 });
      setTickets(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load tickets', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openResolveModal = (ticket) => {
    setSelectedTicket(ticket);
    setResolveNotes('');
    setResolveModalOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      await resolveTicket(selectedTicket.id, {
        repair_notes: resolveNotes.trim() || 'Work order resolved and verified by technician',
        status: 'resolved',
      });
      setResolveModalOpen(false);
      setSelectedTicket(null);
      await fetchTickets();
    } catch (err) {
      alert('Failed to resolve ticket: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Technician Dispatch & My Work</h1>
          <p className="page-subtitle">Assigned maintenance jobs, field diagnostics, and resolution log</p>
        </div>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--brand)' }}>{tickets.length}</div>
          <div className="kpi-card-label">Total Assigned Orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--warning)' }}>{openCount}</div>
          <div className="kpi-card-label">Pending / Open</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: '#38bdf8' }}>{inProgressCount}</div>
          <div className="kpi-card-label">In Progress</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--online)' }}>{resolvedCount}</div>
          <div className="kpi-card-label">Resolved & Closed</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Assigned Field Work Orders</div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Priority</th>
                <th>Device</th>
                <th>Problem / Title</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Created (IST)</th>
                <th>Due Date (IST)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Loading assigned tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    No open work orders assigned
                  </td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{t.ticket_number}</td>
                    <td><StatusBadge value={t.priority} type="priority" /></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.device?.uid || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.device?.name || ''}</div>
                    </td>
                    <td>
                      <div>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.description}</div>}
                    </td>
                    <td>
                      {t.assignedTechnician ? (
                        <span style={{ fontSize: 12 }}>{t.assignedTechnician.name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td><StatusBadge value={t.status} type="ticketStatus" /></td>
                    <td style={{ fontSize: 12 }}>{formatISTDateTime(t.created_at)}</td>
                    <td style={{ fontSize: 12 }}>
                      {t.due_date ? formatISTDate(t.due_date) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {t.status !== 'resolved' && t.status !== 'closed' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => openResolveModal(t)}>
                          <CheckCircle2 size={12} /> Mark Resolved
                        </button>
                      ) : (
                        <span style={{ color: 'var(--online)', fontSize: 12, fontWeight: 600 }}>
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Ticket Modal */}
      <Modal
        title={`Resolve Work Order: ${selectedTicket?.ticket_number || ''}`}
        open={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setResolveModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResolve} disabled={submitting}>
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Provide technician resolution notes and observations for <strong>{selectedTicket?.device?.uid || 'the luminaire'}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label">Repair Notes / Action Taken *</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="e.g. Replaced faulty LED driver module, inspected wiring harness, verified 230V AC load."
              value={resolveNotes}
              onChange={e => setResolveNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
