import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDevices } from '../../api/device.api.js';
import DataTable from '../../components/common/DataTable.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { Search, RefreshCw, Plus } from 'lucide-react';

function timeSince(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const columns = [
  { key: 'uid',     label: 'UID',    render: (v) => <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{v}</span> },
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
    render: (_, r) => r.latestState?.voltage ? `${r.latestState.voltage} V` : '—', sortable: false,
  },
  {
    key: '_current', label: 'Current',
    render: (_, r) => r.latestState?.current ? `${r.latestState.current} A` : '—', sortable: false,
  },
  {
    key: '_power', label: 'Power',
    render: (_, r) => r.latestState?.real_power ? `${r.latestState.real_power} W` : '—', sortable: false,
  },
  {
    key: 'last_seen', label: 'Last Seen',
    render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{timeSince(v)}</span>,
  },
  {
    key: 'health_status', label: 'Health',
    render: (v) => <StatusBadge value={v} type="health" />,
  },
];

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
    const t = setTimeout(() => fetchDevices(1), 300);
    return () => clearTimeout(t);
  }, [search, filters]);

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
          <button className="btn btn-primary" onClick={() => navigate('/devices/new')}><Plus size={14} /> Add Device</button>
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
    </div>
  );
}
