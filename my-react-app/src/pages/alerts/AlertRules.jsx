import { useState, useEffect, useMemo } from 'react';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from '../../api/alert.api.js';
import { getCities, getZones, getWards } from '../../api/organization.api.js';
import { getDevices } from '../../api/device.api.js';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { Plus, Edit2, Trash2, Shield, Filter, Globe, Building2, MapPin, Cpu } from 'lucide-react';

const FIELDS = ['VOLTAGE', 'CURRENT', 'REALPOWER', 'PF', 'FREQ', 'KWH', 'FAULT', 'LIGHT_STATUS', 'OFFLINE'];
const OPS = ['<', '>', '<=', '>=', '=', '!='];
const SEVERITIES = ['critical', 'major', 'warning', 'info'];
const SCOPES = [
  { id: 'global', label: 'Global (All Devices)' },
  { id: 'city', label: 'City Scoped' },
  { id: 'zone', label: 'Zone Scoped' },
  { id: 'ward', label: 'Ward Scoped' },
  { id: 'device', label: 'Individual Device Scoped' },
];

const defaultForm = {
  name: '',
  scope_type: 'global',
  scope_id: '',
  condition_field: 'VOLTAGE',
  condition_op: '<',
  condition_value: '',
  severity: 'major',
  alert_type: '',
  duration_minutes: 0,
  action_create_alert: true,
  action_create_ticket: false,
  action_send_email: false,
  email_recipients: '',
  is_active: true,
  description: '',
};

export default function AlertRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Hierarchy Data for Scope Selection
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [devicesList, setDevicesList] = useState([]);

  // Top Filter
  const [scopeFilter, setScopeFilter] = useState('all');

  const fetchHierarchy = async () => {
    try {
      const [c, z, w, d] = await Promise.all([
        getCities(),
        getZones(),
        getWards(),
        getDevices({ limit: 300 }),
      ]);
      setCities(c.data || []);
      setZones(z.data || []);
      setWards(w.data || []);
      setDevicesList(d.data?.data || []);
    } catch {}
  };

  const fetch = async () => {
    try {
      const res = await getAlertRules();
      setRules(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHierarchy();
    fetch();
  }, []);

  const openCreate = () => {
    setForm(defaultForm);
    setEditing(null);
    setModal(true);
  };

  const openEdit = (rule) => {
    setForm({
      ...defaultForm,
      ...rule,
      scope_id: rule.scope_id || '',
    });
    setEditing(rule.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || form.condition_value === '') {
      alert('Please fill in Rule Name and Condition Value');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        scope_id: form.scope_type === 'global' ? null : parseInt(form.scope_id) || null,
        condition_value: parseFloat(form.condition_value),
      };

      if (editing) await updateAlertRule(editing, payload);
      else await createAlertRule(payload);

      setModal(false);
      fetch();
    } catch (e) {
      console.error('Failed to save alert rule', e);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this rule?')) return;
    await deleteAlertRule(id);
    fetch();
  };

  const filteredRules = useMemo(() => {
    if (scopeFilter === 'all') return rules;
    return rules.filter(r => r.scope_type === scopeFilter);
  }, [rules, scopeFilter]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Rules (City / Zone / Ward & Device Scoped)</h1>
          <p className="page-subtitle">{rules.length} total active & configured rules</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="form-select"
            style={{ width: 180 }}
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value)}
          >
            <option value="all">All Scopes</option>
            <option value="global">Global Rules</option>
            <option value="city">City Rules</option>
            <option value="zone">Zone Rules</option>
            <option value="ward">Ward Rules</option>
            <option value="device">Device Rules</option>
          </select>

          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Create Rule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /> Loading rules...</div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Scope & Location</th>
                <th>Condition</th>
                <th>Severity</th>
                <th>Alert Type</th>
                <th>Actions Triggered</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No alert rules found for selected scope.
                  </td>
                </tr>
              )}
              {filteredRules.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: r.scope_type === 'global' ? 'rgba(79,142,247,0.1)' : 'rgba(168,85,247,0.1)',
                        color: r.scope_type === 'global' ? 'var(--brand)' : 'var(--maintenance)',
                      }}
                    >
                      {r.scope_type === 'city' && <Globe size={11} />}
                      {r.scope_type === 'zone' && <Building2 size={11} />}
                      {r.scope_type === 'ward' && <MapPin size={11} />}
                      {r.scope_type === 'device' && <Cpu size={11} />}
                      {r.scope_name || r.scope_type?.toUpperCase() || 'Global'}
                    </span>
                  </td>
                  <td>
                    <code style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 12, border: '1px solid var(--border)' }}>
                      {r.condition_field} {r.condition_op} {r.condition_value}
                    </code>
                  </td>
                  <td><StatusBadge value={r.severity} type="severity" /></td>
                  <td className="dim">{r.alert_type?.replace(/_/g, ' ') || '—'}</td>
                  <td style={{ fontSize: 11 }}>
                    {r.action_create_alert && <span style={{ marginRight: 6, color: 'var(--brand)', fontWeight: 600 }}>Alert</span>}
                    {r.action_create_ticket && <span style={{ marginRight: 6, color: 'var(--warning)', fontWeight: 600 }}>Ticket</span>}
                    {r.action_send_email && <span style={{ color: 'var(--info-sev)', fontWeight: 600 }}>Email</span>}
                  </td>
                  <td>
                    <span className={`badge ${r.is_active ? 'badge-online' : 'badge-off'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(r)} title="Edit">
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(r.id)} title="Deactivate">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={editing ? 'Edit Alert Rule' : 'Create Alert Rule'}
        open={modal}
        onClose={() => setModal(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Rule' : 'Create Rule'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Rule Name *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. South Zone Voltage Surge Warning"
          />
        </div>

        {/* ── Rule Scope Configuration ── */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Scope Type</label>
            <select
              className="form-select"
              value={form.scope_type}
              onChange={e => setForm(p => ({ ...p, scope_type: e.target.value, scope_id: '' }))}
            >
              {SCOPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {form.scope_type === 'city' && (
            <div className="form-group">
              <label className="form-label">Target City *</label>
              <select
                className="form-select"
                value={form.scope_id}
                onChange={e => setForm(p => ({ ...p, scope_id: e.target.value }))}
              >
                <option value="">Select City...</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {form.scope_type === 'zone' && (
            <div className="form-group">
              <label className="form-label">Target Zone *</label>
              <select
                className="form-select"
                value={form.scope_id}
                onChange={e => setForm(p => ({ ...p, scope_id: e.target.value }))}
              >
                <option value="">Select Zone...</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name} ({z.city?.name || 'City'})</option>)}
              </select>
            </div>
          )}

          {form.scope_type === 'ward' && (
            <div className="form-group">
              <label className="form-label">Target Ward *</label>
              <select
                className="form-select"
                value={form.scope_id}
                onChange={e => setForm(p => ({ ...p, scope_id: e.target.value }))}
              >
                <option value="">Select Ward...</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}

          {form.scope_type === 'device' && (
            <div className="form-group">
              <label className="form-label">Target Device *</label>
              <select
                className="form-select"
                value={form.scope_id}
                onChange={e => setForm(p => ({ ...p, scope_id: e.target.value }))}
              >
                <option value="">Select Device...</option>
                {devicesList.map(d => <option key={d.id} value={d.id}>{d.uid} - {d.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ── Condition Configuration ── */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Field</label>
            <select
              className="form-select"
              value={form.condition_field}
              onChange={e => setForm(p => ({ ...p, condition_field: e.target.value }))}
            >
              {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Operator</label>
            <select
              className="form-select"
              value={form.condition_op}
              onChange={e => setForm(p => ({ ...p, condition_op: e.target.value }))}
            >
              {OPS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Threshold Value *</label>
            <input
              type="number"
              className="form-input"
              value={form.condition_value}
              onChange={e => setForm(p => ({ ...p, condition_value: e.target.value }))}
              placeholder="e.g. 190"
            />
          </div>
        </div>

        {/* ── Severity & Alert Type ── */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select
              className="form-select"
              value={form.severity}
              onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
            >
              {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Alert Type Code</label>
            <input
              className="form-input"
              value={form.alert_type}
              onChange={e => setForm(p => ({ ...p, alert_type: e.target.value }))}
              placeholder="e.g. under_voltage"
            />
          </div>
        </div>

        {/* ── Automated Actions ── */}
        <div className="form-group">
          <label className="form-label">Automated Actions</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              ['action_create_alert', 'Create Alert'],
              ['action_create_ticket', 'Auto-Create Maintenance Ticket'],
              ['action_send_email', 'Send Email Notification'],
            ].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.checked }))}
                />
                {l}
              </label>
            ))}
          </div>
        </div>

        {form.action_send_email && (
          <div className="form-group">
            <label className="form-label">Email Recipients (comma-separated)</label>
            <input
              className="form-input"
              value={form.email_recipients}
              onChange={e => setForm(p => ({ ...p, email_recipients: e.target.value }))}
              placeholder="eng@example.com, maint@example.com"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Rule Status</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            />
            Rule is active and will evaluate incoming telemetry
          </label>
        </div>
      </Modal>
    </div>
  );
}
