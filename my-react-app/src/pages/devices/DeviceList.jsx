import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDevices, createDevice } from '../../api/device.api.js';
import { getCities, getZones, getWards, getStreets } from '../../api/organization.api.js';
import DataTable from '../../components/common/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Search, RefreshCw, Plus, Globe, Building2, MapPin, Route, CheckCircle2, AlertTriangle } from 'lucide-react';
import { timeAgo } from '../../utils/date.js';

const columns = [
  { key: 'uid',     label: 'UID',    render: (v) => <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{v}</span> },
  { key: 'name',    label: 'Device Name' },
  { key: '_city',   label: 'City',   render: (_, r) => r.street?.ward?.zone?.city?.name || '—', sortable: false },
  { key: '_zone',   label: 'Zone',   render: (_, r) => r.street?.ward?.zone?.name || '—', sortable: false },
  { key: '_ward',   label: 'Ward',   render: (_, r) => r.street?.ward?.name || '—', sortable: false },
  { key: '_street', label: 'Street', render: (_, r) => r.street?.name || '—', sortable: false },
  {
    key: 'connectivity_status', label: 'Conn.',
    render: (v) => <StatusBadge value={v} type="connectivity" />,
  },
  {
    key: 'light_status', label: 'Light',
    render: (v) => <StatusBadge value={v} type="light" />,
  },
  {
    key: '_voltage', label: 'Voltage',
    render: (_, r) => r.latestState?.voltage ? `${Number(r.latestState.voltage).toFixed(1)} V` : '0 V', sortable: false,
  },
  {
    key: '_current', label: 'Current',
    render: (_, r) => r.latestState?.current ? `${Number(r.latestState.current).toFixed(3)} A` : '0 A', sortable: false,
  },
  {
    key: '_power', label: 'Power',
    render: (_, r) => r.latestState?.real_power ? `${Number(r.latestState.real_power).toFixed(1)} W` : '0 W', sortable: false,
  },
  {
    key: 'last_seen', label: 'Last Seen',
    render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v ? timeAgo(v) : 'Never'}</span>,
  },
  {
    key: 'health_status', label: 'Health',
    render: (v) => <StatusBadge value={v} type="health" />,
  },
];

const initialDeviceForm = {
  uid: '',
  name: '',
  serial_number: '',
  city_id: '',
  zone_id: '',
  ward_id: '',
  street_id: '',
  latitude: '22.5535',
  longitude: '88.3518',
  device_model: 'TLX-3000-KOL',
  rated_voltage: 230,
  rated_power: 60,
};

export default function DeviceList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    connectivity_status: '',
    light_status: '',
    health_status: '',
  });

  // Add Device Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialDeviceForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Organization Lookups
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [streets, setStreets] = useState([]);

  const fetchHierarchy = async () => {
    try {
      const [c, z, w, s] = await Promise.all([
        getCities(), getZones(), getWards(), getStreets()
      ]);
      setCities(c.data || []);
      setZones(z.data || []);
      setWards(w.data || []);
      setStreets(s.data || []);
    } catch (e) {
      console.error('Failed to load hierarchy', e);
    }
  };

  const fetchDevices = async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 50, ...(search && { search }) };
      Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
      const res = await getDevices(params);
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchDevices(1), 300);
    return () => clearTimeout(t);
  }, [search, filters]);

  // Filtered dropdowns for modal
  const modalZones = useMemo(() => {
    if (!form.city_id) return zones;
    return zones.filter(z => String(z.city_id) === String(form.city_id));
  }, [zones, form.city_id]);

  const modalWards = useMemo(() => {
    if (!form.zone_id) return wards;
    return wards.filter(w => String(w.zone_id) === String(form.zone_id));
  }, [wards, form.zone_id]);

  const modalStreets = useMemo(() => {
    if (!form.ward_id) return streets;
    return streets.filter(s => String(s.ward_id) === String(form.ward_id));
  }, [streets, form.ward_id]);

  const handleOpenModal = () => {
    setFormError('');
    setFormSuccess('');
    setForm({
      ...initialDeviceForm,
      city_id: cities[0]?.id || '',
    });
    setModalOpen(true);
  };

  const handleSaveDevice = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.uid || !form.uid.trim()) {
      setFormError('Device UID is required (e.g. TS00000003)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        uid: form.uid.trim().toUpperCase(),
        name: form.name?.trim() || `StreetLight-${form.uid.trim().toUpperCase()}`,
        serial_number: form.serial_number?.trim() || `SN-${form.uid.trim().toUpperCase()}`,
        street_id: form.street_id ? parseInt(form.street_id) : (modalStreets[0]?.id || null),
        latitude: parseFloat(form.latitude) || 22.5535,
        longitude: parseFloat(form.longitude) || 88.3518,
        device_model: form.device_model || 'TLX-3000',
        rated_voltage: parseFloat(form.rated_voltage) || 230,
        rated_power: parseFloat(form.rated_power) || 60,
      };

      await createDevice(payload);
      setFormSuccess(`Device ${payload.uid} added successfully!`);
      setTimeout(() => {
        setModalOpen(false);
        fetchDevices(1);
      }, 700);
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Failed to add device');
    } finally {
      setSaving(false);
    }
  };

  const handlePage = (p) => { setPage(p); fetchDevices(p); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Devices</h1>
          <p className="page-subtitle">{total.toLocaleString()} devices registered</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => fetchDevices()}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={handleOpenModal}><Plus size={14} /> Add Device</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <Search size={14} />
          <input
            className="search-input"
            placeholder="Search by UID, name, serial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 130 }} value={filters.connectivity_status} onChange={e => setFilters(p => ({ ...p, connectivity_status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="warning">Warning</option>
        </select>
        <select className="form-select" style={{ width: 120 }} value={filters.light_status} onChange={e => setFilters(p => ({ ...p, light_status: e.target.value }))}>
          <option value="">All Lights</option>
          <option value="on">ON</option>
          <option value="off">OFF</option>
        </select>
        <select className="form-select" style={{ width: 120 }} value={filters.health_status} onChange={e => setFilters(p => ({ ...p, health_status: e.target.value }))}>
          <option value="">All Health</option>
          <option value="normal">Normal</option>
          <option value="fault">Fault</option>
          <option value="warning">Warning</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        total={total}
        page={page}
        pages={pages}
        limit={50}
        onPageChange={handlePage}
        onRowClick={(row) => navigate(`/devices/${row.id}`)}
        emptyText="No devices match your filters"
      />

      {/* ── Add Device Modal ── */}
      <Modal
        title="Register New Street Light Device"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveDevice} disabled={saving}>
              {saving ? 'Registering...' : 'Register Device'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveDevice}>
          {formError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> {formError}
            </div>
          )}

          {formSuccess && (
            <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> {formSuccess}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Device UID *</label>
              <input
                className="form-input"
                placeholder="e.g. TS00000003"
                value={form.uid}
                onChange={e => setForm(p => ({ ...p, uid: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Device Name</label>
              <input
                className="form-input"
                placeholder="e.g. SL-KOL-00003"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input
                className="form-input"
                placeholder="e.g. SN-TS00000003"
                value={form.serial_number}
                onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hardware Model</label>
              <input
                className="form-input"
                placeholder="TLX-3000-KOL"
                value={form.device_model}
                onChange={e => setForm(p => ({ ...p, device_model: e.target.value }))}
              />
            </div>
          </div>

          {/* Location Hierarchy Cascade */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Installation Hierarchy & Location
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={12} color="var(--brand)" /> City
                </label>
                <select
                  className="form-select"
                  value={form.city_id}
                  onChange={e => setForm(p => ({ ...p, city_id: e.target.value, zone_id: '', ward_id: '', street_id: '' }))}
                >
                  <option value="">Select City</option>
                  {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={12} color="#a855f7" /> Zone
                </label>
                <select
                  className="form-select"
                  value={form.zone_id}
                  onChange={e => setForm(p => ({ ...p, zone_id: e.target.value, ward_id: '', street_id: '' }))}
                >
                  <option value="">Select Zone</option>
                  {modalZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} color="#f59e0b" /> Ward
                </label>
                <select
                  className="form-select"
                  value={form.ward_id}
                  onChange={e => setForm(p => ({ ...p, ward_id: e.target.value, street_id: '' }))}
                >
                  <option value="">Select Ward</option>
                  {modalWards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Route size={12} color="#10b981" /> Street
                </label>
                <select
                  className="form-select"
                  value={form.street_id}
                  onChange={e => setForm(p => ({ ...p, street_id: e.target.value }))}
                >
                  <option value="">Select Street</option>
                  {modalStreets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">GPS Latitude</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.0001"
                  value={form.latitude}
                  onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GPS Longitude</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.0001"
                  value={form.longitude}
                  onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Rated Power (W)</label>
              <input
                className="form-input"
                type="number"
                value={form.rated_power}
                onChange={e => setForm(p => ({ ...p, rated_power: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rated Voltage (V)</label>
              <input
                className="form-input"
                type="number"
                value={form.rated_voltage}
                onChange={e => setForm(p => ({ ...p, rated_voltage: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
