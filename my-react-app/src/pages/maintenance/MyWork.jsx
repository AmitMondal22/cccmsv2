import { useState, useEffect } from 'react';
import { getTickets, resolveTicket, updateTicket } from '../../api/maintenance.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { ClipboardList, CheckCircle2, Clock, Wrench } from 'lucide-react';

export default function MyWork() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const res = await getTickets({ limit: 100 });
      // In production or demo, show tickets assigned to current user or active jobs
      setTickets(res.data?.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleResolve = async (id) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;
    await resolveTicket(id, notes);
    fetchTickets();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Technician Dispatch & My Work</h1>
          <p className="page-subtitle">Assigned maintenance jobs, field diagnostics, and resolution log</p>
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
                <th>Problem</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No open work orders assigned</td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{t.ticket_number}</td>
                    <td><StatusBadge value={t.priority} type="priority" /></td>
                    <td>{t.device?.uid} - {t.device?.name}</td>
                    <td>{t.title}</td>
                    <td><StatusBadge value={t.status} type="ticketStatus" /></td>
                    <td>{new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td>
                      {t.status !== 'resolved' && t.status !== 'closed' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleResolve(t.id)}>
                          <CheckCircle2 size={12} /> Mark Resolved
                        </button>
                      )}
                    </td>
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
