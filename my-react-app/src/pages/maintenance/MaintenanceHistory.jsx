import { useState, useEffect } from 'react';
import { getTickets } from '../../api/maintenance.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { History, Search, RefreshCw } from 'lucide-react';

export default function MaintenanceHistory() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTickets = async () => {
    try {
      const res = await getTickets({ limit: 200 });
      setTickets(res.data?.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filtered = tickets.filter(t =>
    t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.device?.uid && t.device.uid.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance History & Resolved Work Orders</h1>
          <p className="page-subtitle">Archive of all resolved, closed, and in-progress maintenance tickets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={fetchTickets}>
            <RefreshCw size={14} /> Refresh History
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All Service History Logs</div>
          <div style={{ width: 220 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search history..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Device</th>
                <th>Priority</th>
                <th>Title</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Resolution Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{t.ticket_number}</td>
                  <td>{t.device?.uid} ({t.device?.name})</td>
                  <td><StatusBadge value={t.priority} type="priority" /></td>
                  <td>{t.title}</td>
                  <td><StatusBadge value={t.status} type="ticketStatus" /></td>
                  <td>{new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  <td className="dim">{t.resolution_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
