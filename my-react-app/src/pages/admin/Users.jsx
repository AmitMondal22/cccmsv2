import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/user.api.js';
import Modal from '../../components/common/Modal.jsx';
import { Plus, Edit2, UserX } from 'lucide-react';

const ROLES = ['super_admin', 'project_admin', 'city_user', 'zone_user', 'ward_user', 'maintenance_user'];
const defaultForm = { name: '', email: '', password: '', role: 'maintenance_user', phone: '', is_active: true };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    try { const res = await getUsers(); setUsers(res.data || []); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setForm(defaultForm); setEditing(null); setModal(true); };
  const openEdit = (u) => { setForm({ ...defaultForm, ...u, password: '' }); setEditing(u.id); setModal(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await updateUser(editing, form);
      else await createUser(form);
      setModal(false);
      fetch();
    } catch {}
    setSaving(false);
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    await deleteUser(id);
    fetch();
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Users</h1><p className="page-subtitle">{users.length} users registered</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add User</button>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Last Login</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="dim">{u.email}</td>
                  <td><code style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{u.role}</code></td>
                  <td className="dim">{u.phone || '—'}</td>
                  <td className="dim" style={{ fontSize: 11 }}>{u.last_login ? new Date(u.last_login).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}</td>
                  <td><span className={`badge ${u.is_active ? 'badge-online' : 'badge-offline'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(u)}><Edit2 size={12} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeactivate(u.id)}><UserX size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title={editing ? 'Edit User' : 'Add User'}
        open={modal}
        onClose={() => setModal(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Password {editing && '(leave blank to keep)'}</label><input type="password" className="form-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
