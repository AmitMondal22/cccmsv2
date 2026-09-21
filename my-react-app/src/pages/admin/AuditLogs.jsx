import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/user.api.js';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetch = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page: p, limit: 50 });
      setLogs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">{total} log entries</p></div>
      </div>
      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Object</th><th>Description</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</td>
                  <td style={{ fontWeight: 600 }}>{l.user_name || '—'}</td>
                  <td><code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{l.action}</code></td>
                  <td className="dim">{l.module}</td>
                  <td className="dim">{l.object_type} #{l.object_id}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{l.description}</td>
                  <td className="dim" style={{ fontSize: 11 }}>{l.ip_address || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No audit logs</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
