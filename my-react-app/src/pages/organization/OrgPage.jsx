// Generic org list page factory
import { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal.jsx';
import { Plus, Edit2 } from 'lucide-react';

export function OrgPage({ title, fetchFn, createFn, updateFn, columns, formFields, defaultForm, parentLabel, parentFetchFn, parentKey }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState([]);

  const fetch = async () => {
    try { const res = await fetchFn(); setData(res.data || []); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    if (parentFetchFn) parentFetchFn().then(res => setParents(res.data || [])).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await updateFn(editing, form);
      else await createFn(form);
      setModal(false);
      fetch();
    } catch {}
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{data.length} records</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultForm); setEditing(null); setModal(true); }}>
          <Plus size={14} /> Add {title.replace('s', '')}
        </button>
      </div>
      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr>{columns.map(c => <th key={c.label}>{c.label}</th>)}<th>Edit</th></tr></thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {columns.map(c => (
                    <td key={c.label} className={c.dim ? 'dim' : ''}>
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                  <td>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setForm({ ...defaultForm, ...row }); setEditing(row.id); setModal(true); }}>
                      <Edit2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Modal title={editing ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`} open={modal} onClose={() => setModal(false)}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button></>}
      >
        {parentLabel && parentFetchFn && (
          <div className="form-group">
            <label className="form-label">{parentLabel} *</label>
            <select className="form-select" value={form[parentKey] || ''} onChange={e => setForm(p => ({ ...p, [parentKey]: e.target.value }))}>
              <option value="">Select {parentLabel}</option>
              {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        {formFields.map(f => (
          <div key={f.key} className="form-group">
            <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'select' ? (
              <select className="form-select" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type || 'text'} className="form-input" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
            )}
          </div>
        ))}
      </Modal>
    </div>
  );
}
