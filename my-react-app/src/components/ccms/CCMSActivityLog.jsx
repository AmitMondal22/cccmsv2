import { useState } from 'react';
import { Clock, Sliders, Zap, Check, RefreshCw, Search, Shield, User, FileText, ArrowRight } from 'lucide-react';

const PARAM_LABELS = {
  schedule_mode: 'Schedule Mode',
  on_offset_minutes: 'Sunset ON Offset',
  off_offset_minutes: 'Sunrise OFF Offset',
  manual_on_time: 'Manual ON Time',
  manual_off_time: 'Manual OFF Time',
  panel_capacity_kva: 'Panel Capacity',
  meter_serial: 'Meter Serial',
  energy_rate_kwh: 'Tariff Rate (₹)',
  dim_level: 'Dimming Level',
  latitude: 'Latitude',
  longitude: 'Longitude',
  name: 'Station Name',
  phase_r_state: 'Phase R Contactor',
  phase_y_state: 'Phase Y Contactor',
  phase_b_state: 'Phase B Contactor',
  phase_r: 'Phase R Switch',
  phase_y: 'Phase Y Switch',
  phase_b: 'Phase B Switch',
  status: 'Operational Status',
  connectivity_status: 'Connectivity',
};

function formatParamVal(val, key) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'ON' : 'OFF';
  if (key === 'dim_level') return `${val}%`;
  if (key?.includes('offset')) return `${Number(val) > 0 ? `+${val}` : val} min`;
  if (key === 'panel_capacity_kva') return `${val} kVA`;
  if (key === 'energy_rate_kwh') return `₹${Number(val).toFixed(2)}/kWh`;
  return String(val);
}

export function ActivityLogCard({ log }) {
  const isSettings = log.action === 'CCMS_SETTINGS_UPDATE';
  const isControl = log.action === 'CCMS_CONTROL_COMMAND';
  const isCreated = log.action === 'CCMS_STATION_CREATED';

  const actionClass = isSettings ? 'settings' : isControl ? 'control' : 'created';
  const actionLabel = isSettings ? 'Settings Changed' : isControl ? 'Control Executed' : 'Station Created';

  // Compute parameter differences
  const changes = [];
  if (log.new_value && typeof log.new_value === 'object') {
    Object.keys(log.new_value).forEach((k) => {
      // Ignore internal audit metadata
      if (['id', 'created_at', 'updated_at'].includes(k)) return;
      const oldV = log.old_value ? log.old_value[k] : undefined;
      const newV = log.new_value[k];
      if (oldV !== undefined && String(oldV) !== String(newV)) {
        changes.push({ key: k, oldVal: oldV, newVal: newV });
      } else if (isCreated && newV !== undefined && newV !== null && newV !== '') {
        changes.push({ key: k, oldVal: null, newVal: newV });
      }
    });
  }

  const rawTime = log.created_at || log.createdAt;
  const timeFormatted = rawTime
    ? new Date(rawTime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '—';

  return (
    <div className="activity-card">
      <div className="activity-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`activity-badge ${actionClass}`}>
            {isSettings && <Sliders size={12} />}
            {isControl && <Zap size={12} />}
            {isCreated && <Check size={12} />}
            {actionLabel}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {log.description || 'Settings modified'}
          </span>
        </div>
        <div className="activity-meta">
          <Clock size={12} />
          <span>{timeFormatted}</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
            <User size={11} /> {log.user_name || 'Administrator'}
          </span>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="activity-diff-grid">
          {changes.map((ch, idx) => (
            <div key={idx} className="activity-diff-chip">
              <span className="activity-diff-key">{PARAM_LABELS[ch.key] || ch.key.replace(/_/g, ' ')}:</span>
              {ch.oldVal !== null ? (
                <>
                  <span className="activity-diff-old">{formatParamVal(ch.oldVal, ch.key)}</span>
                  <span className="activity-diff-arrow">→</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Initial: </span>
              )}
              <span className="activity-diff-new">{formatParamVal(ch.newVal, ch.key)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CCMSActivityLog({ logs = [], loading = false, onRefresh }) {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredLogs = logs.filter((l) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      l.description?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.user_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search size={14} />
          <input
            placeholder="Filter changes by user, parameter…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        {onRefresh && (
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} style={{ marginRight: 4 }} />
            Refresh Log
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading activity history…</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 20px' }}>
          <FileText size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontWeight: 600 }}>No settings change records found</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Any modifications to operational parameters, contactor states, or schedules will appear here in the audit trail.
          </div>
        </div>
      ) : (
        <div>
          {filteredLogs.map((log) => (
            <ActivityLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
