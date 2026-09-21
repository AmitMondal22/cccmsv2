import { useState, useEffect } from 'react';
import { Clock, Sun, Moon, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getDeviceWiseEnergy } from '../../api/energy.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function RunningHours() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDeviceWiseEnergy({ limit: 100 });
      setDevices(res.data?.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalRunHours = devices.reduce((sum, d) => sum + parseFloat(d.run_hours || 0), 0);
  const avgRunHours = devices.length > 0 ? (totalRunHours / devices.length).toFixed(1) : 0;
  const abnormalBurners = devices.filter(d => parseFloat(d.run_hours || 0) > 15);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Running Hours & Lamp Burn Analytics</h1>
          <p className="page-subtitle">
            Expected vs actual running hours per street fixture · Daylight burning detection
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(79,142,247,0.15)', color: '#4f8ef7' }}>
            <Clock size={18} />
          </div>
          <div className="kpi-card-value">{totalRunHours.toFixed(0)} <span style={{ fontSize: 14 }}>hrs</span></div>
          <div className="kpi-card-label">Total Cumulative Burn Hours</div>
          <div className="kpi-card-sub">Across all connected fixtures</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <Sun size={18} />
          </div>
          <div className="kpi-card-value">{avgRunHours} <span style={{ fontSize: 14 }}>hrs</span></div>
          <div className="kpi-card-label">Average Daily Burn Hours</div>
          <div className="kpi-card-sub">Normal: 10.5 - 12.0 hours / night</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <AlertTriangle size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: abnormalBurners.length > 0 ? '#ef4444' : '#22c55e' }}>
            {abnormalBurners.length}
          </div>
          <div className="kpi-card-label">Abnormal / Daylight Burners</div>
          <div className="kpi-card-sub">Fixtures running excessive hours</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Fixture Running Hours Details</div>
            <div className="card-subtitle">Burn hours tracking and expected lifespan evaluation</div>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>Device Name</th>
                <th>Zone / Ward</th>
                <th>Status</th>
                <th>Light</th>
                <th>Total Burn Hours</th>
                <th>Expected Lifetime</th>
                <th>Remaining Life</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const hrs = parseFloat(d.run_hours || 0);
                const maxLife = 50000; // 50,000 hrs L70 LED rating
                const remaining = Math.max(0, maxLife - hrs);
                const percentLeft = ((remaining / maxLife) * 100).toFixed(1);

                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{d.uid}</td>
                    <td>{d.name}</td>
                    <td>{d.zone} &rsaquo; {d.ward}</td>
                    <td><StatusBadge value={d.connectivity_status} type="connectivity" /></td>
                    <td><StatusBadge value={d.light_status} type="light" /></td>
                    <td style={{ fontWeight: 600 }}>{hrs.toFixed(1)} hrs</td>
                    <td className="dim">50,000 hrs</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ width: `${percentLeft}%`, height: '100%', background: '#22c55e' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{percentLeft}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-online">Good</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
