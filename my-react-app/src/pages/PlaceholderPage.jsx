// Placeholder page for features to be expanded
export default function PlaceholderPage({ title, description }) {
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</p>
            <p>This module is available — data loads from the connected PostgreSQL database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
