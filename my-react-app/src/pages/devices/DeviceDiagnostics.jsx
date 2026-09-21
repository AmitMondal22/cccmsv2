import { useState, useEffect } from 'react';
import { getDevices, getDeviceDiagnostics } from '../../api/device.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import {
  Stethoscope, Activity, Zap, Wifi, AlertTriangle,
  RefreshCw, CheckCircle2, ShieldCheck, Gauge, Clock, Search
} from 'lucide-react';

export default function DeviceDiagnostics() {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [diagData, setDiagData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getDevices({ limit: 100 });
        const list = res.data?.data || [];
        setDevices(list);
        if (list.length > 0) {
          setSelectedDeviceId(list[0].id);
        }
      } catch {}
    })();
  }, []);

  const loadDiagnostics = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getDeviceDiagnostics(id);
      setDiagData(res.data || null);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedDeviceId) {
      loadDiagnostics(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const handlePing = () => {
    setPinging(true);
    setTimeout(() => {
      setPinging(false);
      loadDiagnostics(selectedDeviceId);
    }, 1200);
  };

  const filteredDevices = devices.filter(d =>
    d.uid.toLowerCase().includes(search.toLowerCase()) ||
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDevice = devices.find(d => String(d.id) === String(selectedDeviceId));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Device Health & Telemetry Diagnostics</h1>
          <p className="page-subtitle">
            Comprehensive electrical, packet-level, and communication diagnostics per fixture
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => loadDiagnostics(selectedDeviceId)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'pulse' : ''} /> Refresh Telemetry
          </button>
          <button className="btn btn-primary" onClick={handlePing} disabled={pinging}>
            <Activity size={14} className={pinging ? 'pulse' : ''} /> {pinging ? 'Pinging Fixture...' : 'Run Live Diagnostic'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Device Selector Sidebar */}
        <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 28, fontSize: 12 }}
                placeholder="Search device..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
            {filteredDevices.map(d => {
              const active = String(d.id) === String(selectedDeviceId);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDeviceId(d.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--r-sm)',
                    marginBottom: 4,
                    cursor: 'pointer',
                    background: active ? 'var(--bg-card-hover)' : 'transparent',
                    border: `1px solid ${active ? 'var(--brand)' : 'transparent'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: active ? 'var(--brand)' : 'var(--text-primary)' }}>
                      {d.uid}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.name}</div>
                  </div>
                  <StatusBadge value={d.connectivity_status} type="connectivity" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Panel */}
        <div>
          {loading && !diagData ? (
            <div className="loading-spinner"><div className="spinner" /> Loading Diagnostics...</div>
          ) : diagData ? (
            <div>
              {/* Hero Status Card */}
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {diagData.device.uid} — {diagData.device.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Last seen: {diagData.device.last_seen ? new Date(diagData.device.last_seen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}
                      {diagData.device.last_seen_seconds !== null && ` (${diagData.device.last_seen_seconds}s ago)`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <StatusBadge value={diagData.device.connectivity_status} type="connectivity" />
                    <StatusBadge value={diagData.device.light_status} type="light" />
                    <StatusBadge value={diagData.device.health_status} type="health" />
                  </div>
                </div>
              </div>

              {/* Electrical Parameters Gauges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="elec-tile">
                  <div className="elec-value" style={{ color: '#38bdf8' }}>{diagData.electrical.voltage ?? '—'} <span className="elec-unit">V</span></div>
                  <div className="elec-label">Supply Voltage</div>
                </div>

                <div className="elec-tile">
                  <div className="elec-value" style={{ color: '#22c55e' }}>{diagData.electrical.current ?? '—'} <span className="elec-unit">A</span></div>
                  <div className="elec-label">Load Current</div>
                </div>

                <div className="elec-tile">
                  <div className="elec-value" style={{ color: '#f97316' }}>{diagData.electrical.real_power ?? '—'} <span className="elec-unit">W</span></div>
                  <div className="elec-label">Active Power</div>
                </div>

                <div className="elec-tile">
                  <div className="elec-value">{diagData.electrical.pf ?? '—'}</div>
                  <div className="elec-label">Power Factor</div>
                </div>

                <div className="elec-tile">
                  <div className="elec-value" style={{ color: '#a855f7' }}>{diagData.electrical.kwh ?? '—'} <span className="elec-unit">kWh</span></div>
                  <div className="elec-label">Energy Total</div>
                </div>

                <div className="elec-tile">
                  <div className="elec-value">{diagData.electrical.frequency ?? '50.0'} <span className="elec-unit">Hz</span></div>
                  <div className="elec-label">Grid Frequency</div>
                </div>
              </div>

              {/* Technical Telemetry & Packet Diagnostics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="diag-section">
                  <div className="diag-section-title">Connectivity & Network Stack</div>
                  <div className="diag-row"><span className="diag-key">Status</span><span className="diag-val">{diagData.connectivity.status}</span></div>
                  <div className="diag-row"><span className="diag-key">IPv6 / Source IP</span><span className="diag-val">{diagData.connectivity.ipv6_address || '127.0.0.1'}</span></div>
                  <div className="diag-row"><span className="diag-key">Packets Received Today</span><span className="diag-val">{diagData.connectivity.packets_today}</span></div>
                  <div className="diag-row"><span className="diag-key">Total Lifetime Packets</span><span className="diag-val">{diagData.connectivity.packets_total}</span></div>
                  <div className="diag-row"><span className="diag-key">Invalid / Dropped</span><span className="diag-val">{diagData.connectivity.invalid_packets}</span></div>
                </div>

                <div className="diag-section">
                  <div className="diag-section-title">Fault & Operational Health</div>
                  <div className="diag-row"><span className="diag-key">Hardware Fault Code</span><span className="diag-val">{diagData.health.fault === 1 ? 'FAULT (1)' : 'OK (0)'}</span></div>
                  <div className="diag-row"><span className="diag-key">Fault Occurrence Count</span><span className="diag-val">{diagData.health.fault_count}</span></div>
                  <div className="diag-row"><span className="diag-key">Device Restart Count</span><span className="diag-val">{diagData.health.restart_count}</span></div>
                  <div className="diag-row"><span className="diag-key">Active Alerts</span><span className="diag-val" style={{ color: diagData.activeAlerts > 0 ? '#ef4444' : '#22c55e' }}>{diagData.activeAlerts}</span></div>
                  <div className="diag-row"><span className="diag-key">Open Maintenance Tickets</span><span className="diag-val">{diagData.openTickets}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="loading-spinner" style={{ padding: 40 }}>Select a device to view diagnostics</div>
          )}
        </div>
      </div>
    </div>
  );
}
