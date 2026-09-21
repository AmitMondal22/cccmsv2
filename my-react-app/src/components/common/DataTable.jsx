import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  onRowClick,
  loading,
  emptyText = 'No data found',
  total,
  page,
  pages,
  onPageChange,
  limit = 50,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...(data || [])].sort((a, b) => {
    if (!sortKey) return 0;
    const va = String(a[sortKey] ?? '').toLowerCase();
    const vb = String(b[sortKey] ?? '').toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  if (loading) {
    return (
      <div className="data-table-wrap">
        <div className="loading-spinner">
          <div className="spinner" /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key || col.label}
                onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                style={{ cursor: col.sortable === false ? 'default' : 'pointer' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            sorted.map((row, ri) => (
              <tr key={ri} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map(col => (
                  <td key={col.key || col.label} className={col.dim ? 'dim' : ''}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {pages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </div>
          <button className="page-btn" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
          <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            let p;
            if (pages <= 5) p = i + 1;
            else if (page <= 3) p = i + 1;
            else if (page >= pages - 2) p = pages - 4 + i;
            else p = page - 2 + i;
            return (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
            );
          })}
          <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page === pages}>›</button>
          <button className="page-btn" onClick={() => onPageChange(pages)} disabled={page === pages}>»</button>
        </div>
      )}
    </div>
  );
}
