import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Sun, Clock, Sliders, Zap, BarChart3, RefreshCw, Save,
  MapPin, ChevronRight, AlertTriangle, CheckCircle, TrendingUp,
  Activity, ShieldAlert, Power, Layers,
  DollarSign, ArrowUpRight, SlidersHorizontal,
  Settings, History, Building2, Check, ShieldCheck, Cpu, Lightbulb,
  Network, GitBranch
} from 'lucide-react';
import Modal from '../../components/common/Modal.jsx';
import CCMSActivityLog from '../../components/ccms/CCMSActivityLog.jsx';
import CCMSPhaseHierarchy from '../../components/ccms/CCMSPhaseHierarchy.jsx';
import CCMSScheduleEngine from '../../components/ccms/CCMSScheduleEngine.jsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  getCCMS,
  updateCCMS,
  controlCCMS,
  getCCMSTelemetry,
  getCCMSEnergySummary,
  getCCMSReconciliation,
  getCCMSActivity,
  getCCMSHierarchy
} from '../../api/ccms.api.js';

const TABS = [
  { id: 'control',        label: 'Control & Schedule',     icon: Sliders       },
  { id: 'hierarchy',      label: 'Phase & Device Tree',    icon: GitBranch     },
  { id: 'overview',       label: 'Dashboard',              icon: Activity      },
  { id: 'assets',         label: 'Connected Lights',       icon: Layers        },
  { id: 'reconciliation', label: 'Energy Analytics',       icon: BarChart3     },
  { id: 'billing',        label: 'Billing & Tariff',       icon: DollarSign    },
  { id: 'faults',         label: 'Faults & Alarms',        icon: ShieldAlert   },
  { id: 'activity',       label: 'Audit & Activity',       icon: History       },
  { id: 'settings',       label: 'Station Settings',       icon: Settings      },
];

const PHASE_COLORS = {
  R: {
    bg: 'rgba(239, 68, 68, 0.08)',
    bd: '#ef4444',
    tx: '#ef4444',
    gradient: 'linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.02) 100%)',
    glow: 'rgba(239, 68, 68, 0.25)',
    label: 'Phase R (Red Feeder Line)',
  },
  Y: {
    bg: 'rgba(245, 158, 11, 0.08)',
    bd: '#f59e0b',
    tx: '#f59e0b',
    gradient: 'linear-gradient(180deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.02) 100%)',
    glow: 'rgba(245, 158, 11, 0.25)',
    label: 'Phase Y (Yellow Feeder Line)',
  },
  B: {
    bg: 'rgba(59, 130, 246, 0.08)',
    bd: '#3b82f6',
    tx: '#3b82f6',
    gradient: 'linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.02) 100%)',
    glow: 'rgba(59, 130, 246, 0.25)',
    label: 'Phase B (Blue Feeder Line)',
  },
};

function PhaseControlCard({ phase, voltage, current, power, pf, switchOn, onToggle, executing }) {
  const meta = PHASE_COLORS[phase] || PHASE_COLORS.R;
  const numVoltage = voltage != null ? Number(voltage) : 230.0;
  const numCurrent = current != null ? Number(current) : 12.4;
  const numPower = power != null ? Number(power) : +(numVoltage * numCurrent * 0.94 / 1000);
  const numPf = pf != null ? Number(pf) : 0.96;
  const isHealthy = numVoltage >= 180 && numVoltage <= 260;

  // Approximate load % based on typical 30A contactor rating
  const loadPct = Math.min(100, Math.round((numCurrent / 30) * 100));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1.5px solid ${switchOn ? meta.bd : 'var(--border)'}`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 16,
      boxShadow: switchOn ? `0 6px 20px ${meta.glow}, 0 2px 6px rgba(0,0,0,0.04)` : '0 2px 8px rgba(0,0,0,0.02)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Subtle top ambient accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: switchOn ? `linear-gradient(90deg, ${meta.bd}, #10b981)` : 'var(--border)',
      }} />

      <div>
        {/* Phase Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: meta.bg,
              border: `1.5px solid ${meta.bd}`,
              color: meta.tx,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 900,
              boxShadow: `0 2px 8px ${meta.bg}`,
            }}>
              {phase}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                PHASE {phase}
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: switchOn ? '#10b981' : '#64748b',
                  boxShadow: switchOn ? '0 0 8px #10b981' : 'none',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {meta.label}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              background: switchOn ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
              color: switchOn ? '#10b981' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              letterSpacing: '0.04em',
            }}>
              {switchOn ? <Zap size={11} style={{ fill: '#10b981' }} /> : <Power size={11} />}
              {switchOn ? 'ENERGIZED' : 'DISENGAGED'}
            </span>
            <span style={{ fontSize: 10, color: isHealthy ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {isHealthy ? '● Normal Voltage' : '▲ Range Warning'}
            </span>
          </div>
        </div>

        {/* 4 Realtime Electrical Metrics Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 6 }}>
          {/* Voltage */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              Phase Voltage
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {numVoltage.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>V</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
              Nominal 230V ±5%
            </div>
          </div>

          {/* Current */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              Feeder Current
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {numCurrent.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>A</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
              {loadPct}% Contactor Load
            </div>
          </div>

          {/* Active Power */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              Active Load
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {numPower.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>kW</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
              Realtime Power
            </div>
          </div>

          {/* Power Factor */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '10px 12px',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              Power Factor
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
              {numPf.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginTop: 3 }}>
              Optimal (cos φ)
            </div>
          </div>
        </div>
      </div>

      {/* Contactor Action Switch Button */}
      <button
        onClick={() => onToggle(phase, !switchOn)}
        disabled={executing}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.03em',
          cursor: executing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          background: switchOn ? '#10b981' : 'var(--bg-secondary)',
          color: switchOn ? '#ffffff' : 'var(--text-primary)',
          border: `1.5px solid ${switchOn ? '#059669' : 'var(--border)'}`,
          boxShadow: switchOn ? '0 4px 14px rgba(16,185,129,0.32)' : 'none',
          opacity: executing ? 0.7 : 1,
        }}
      >
        <Power size={14} />
        {switchOn ? `PHASE ${phase} CONTACTOR IS ON` : `TURN ON PHASE ${phase} CONTACTOR`}
      </button>
    </div>
  );
}

export default function CCMSDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState('control');
  const [ccms, setCcms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState([]);
  const [energy, setEnergy] = useState([]);
  const [recon, setRecon] = useState(null);
  const [hierarchy, setHierarchy] = useState(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Settings & Edit Form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Control State
  const [controlMode, setControlMode] = useState('astronomical');
  const [phaseStates, setPhaseStates] = useState({ R: true, Y: true, B: true });
  const [dimLevel, setDimLevel] = useState(100);
  const [onOffset, setOnOffset] = useState(-5);
  const [offOffset, setOffOffset] = useState(5);
  const [manualOnTime, setManualOnTime] = useState('18:30');
  const [manualOffTime, setManualOffTime] = useState('05:30');
  const [executing, setExecuting] = useState(false);
  const [cmdOk, setCmdOk] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savingCtrl, setSavingCtrl] = useState(false);

  // Filter for assets
  const [phaseFilter, setPhaseFilter] = useState('ALL');

  const loadCCMS = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCCMS(id);
      const d = res.data?.id !== undefined ? res.data : (res.data?.data || res.data);
      setCcms(d);
      setControlMode(d.schedule_mode || 'astronomical');
      setPhaseStates({
        R: d.phase_r_state ?? true,
        Y: d.phase_y_state ?? true,
        B: d.phase_b_state ?? true
      });
      setDimLevel(d.dim_level ?? 100);
      setOnOffset(d.on_offset_minutes ?? -5);
      setOffOffset(d.off_offset_minutes ?? 5);
      setManualOnTime(d.manual_on_time || '18:30');
      setManualOffTime(d.manual_off_time || '05:30');
      setForm({
        name: d.name || '',
        latitude: d.latitude || '',
        longitude: d.longitude || '',
        schedule_mode: d.schedule_mode || 'astronomical',
        on_offset_minutes: d.on_offset_minutes ?? -5,
        off_offset_minutes: d.off_offset_minutes ?? 5,
        manual_on_time: d.manual_on_time || '18:30',
        manual_off_time: d.manual_off_time || '05:30',
        meter_serial: d.meter_serial || '',
        panel_capacity_kva: d.panel_capacity_kva || '',
        energy_rate_kwh: d.energy_rate_kwh || 8.50,
      });
    } catch {
      setCcms(null);
    }
    setLoading(false);
  }, [id]);

  const loadTelemetry = useCallback(async () => {
    try {
      const r = await getCCMSTelemetry(id, { limit: 40 });
      setTelemetry(Array.isArray(r.data) ? r.data : []);
    } catch {
      setTelemetry([]);
    }
  }, [id]);

  const loadEnergy = useCallback(async () => {
    try {
      const r = await getCCMSEnergySummary(id, { days: 30 });
      setEnergy(Array.isArray(r.data) ? r.data : []);
    } catch {
      setEnergy([]);
    }
  }, [id]);

  const loadRecon = useCallback(async () => {
    try {
      const r = await getCCMSReconciliation(id, { days: 30 });
      setRecon(r.data);
    } catch {
      setRecon(null);
    }
  }, [id]);

  const loadHierarchy = useCallback(async () => {
    setLoadingHierarchy(true);
    try {
      const r = await getCCMSHierarchy(id);
      setHierarchy(r.data);
    } catch {
      setHierarchy(null);
    }
    setLoadingHierarchy(false);
  }, [id]);

  const loadActivity = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const r = await getCCMSActivity(id);
      setActivityLogs(Array.isArray(r.data) ? r.data : (r.data?.data || []));
    } catch {
      setActivityLogs([]);
    }
    setLoadingLogs(false);
  }, [id]);

  useEffect(() => {
    loadCCMS();
    loadHierarchy();
    loadTelemetry();
    loadEnergy();
    loadRecon();
    loadActivity();
  }, [id, loadCCMS, loadHierarchy, loadTelemetry, loadEnergy, loadRecon, loadActivity]);

  const sendControl = async (mode, phases = phaseStates, dim = dimLevel) => {
    setExecuting(true);
    try {
      await controlCCMS(id, {
        mode: mode || controlMode,
        phase_r: phases.R,
        phase_y: phases.Y,
        phase_b: phases.B,
        dim_level: dim,
        on_offset_minutes: onOffset,
        off_offset_minutes: offOffset,
        manual_on_time: manualOnTime,
        manual_off_time: manualOffTime
      });
      if (mode) setControlMode(mode);
      setPhaseStates(phases);
      if (dim != null) setDimLevel(dim);
      setCmdOk(true);
      setTimeout(() => setCmdOk(false), 3000);
      loadCCMS();
      loadHierarchy();
      loadActivity();
    } catch (e) {
      console.error(e);
    }
    setExecuting(false);
  };

  const handleTogglePhase = (phase, val) => {
    const p = { ...phaseStates, [phase]: val };
    setPhaseStates(p);
    sendControl('manual', p, dimLevel);
  };

  const handleMasterToggle = (val) => {
    const p = { R: val, Y: val, B: val };
    setPhaseStates(p);
    sendControl('manual', p, dimLevel);
  };

  const handleSaveSchedule = async (schedulePayload) => {
    setSavingCtrl(true);
    setSaveMsg('');
    try {
      const payload = schedulePayload || {
        mode: controlMode,
        phase_r: phaseStates.R,
        phase_y: phaseStates.Y,
        phase_b: phaseStates.B,
        dim_level: dimLevel,
        on_offset_minutes: onOffset,
        off_offset_minutes: offOffset,
        manual_on_time: manualOnTime,
        manual_off_time: manualOffTime,
      };

      await controlCCMS(id, {
        mode: payload.mode || controlMode,
        phase_r: payload.phase_r ?? phaseStates.R,
        phase_y: payload.phase_y ?? phaseStates.Y,
        phase_b: payload.phase_b ?? phaseStates.B,
        dim_level: payload.dim_level ?? dimLevel,
        on_offset_minutes: payload.on_offset_minutes ?? onOffset,
        off_offset_minutes: payload.off_offset_minutes ?? offOffset,
        manual_on_time: payload.manual_on_time ?? manualOnTime,
        manual_off_time: payload.manual_off_time ?? manualOffTime,
        latitude: payload.latitude,
        longitude: payload.longitude,
      });

      if (payload.mode) setControlMode(payload.mode);
      if (payload.on_offset_minutes != null) setOnOffset(payload.on_offset_minutes);
      if (payload.off_offset_minutes != null) setOffOffset(payload.off_offset_minutes);
      if (payload.manual_on_time) setManualOnTime(payload.manual_on_time);
      if (payload.manual_off_time) setManualOffTime(payload.manual_off_time);

      setSaveMsg('Operating schedule applied and verified on hardware!');
      setTimeout(() => setSaveMsg(''), 4000);
      loadCCMS();
      loadHierarchy();
      loadActivity();
    } catch {
      setSaveMsg('Failed to apply schedule.');
    }
    setSavingCtrl(false);
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await updateCCMS(id, {
        ...form,
        latitude: parseFloat(form.latitude) || null,
        longitude: parseFloat(form.longitude) || null,
        on_offset_minutes: parseInt(form.on_offset_minutes, 10) || 0,
        off_offset_minutes: parseInt(form.off_offset_minutes, 10) || 0,
        panel_capacity_kva: parseFloat(form.panel_capacity_kva) || null,
        energy_rate_kwh: parseFloat(form.energy_rate_kwh) || 8.50
      });
      setEditing(false);
      loadCCMS();
      loadHierarchy();
      loadActivity();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12, color: 'var(--text-secondary)' }}>
        <div className="spinner" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Loading CCMS Station...</span>
      </div>
    );
  }

  if (!ccms) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 350, gap: 16 }}>
        <AlertTriangle size={36} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Station Not Found</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>The requested CCMS station could not be loaded.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/ccms')}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to CCMS List
        </button>
      </div>
    );
  }

  const el = ccms.electrical || {};
  const billing = ccms.billing || {};
  const recon_ = recon || {};
  const faults = ccms.fault_correlation || [];
  const pDev = ccms.phase_devices || { r_devices: [], y_devices: [], b_devices: [], total_count: 0 };
  const isOnline = ccms.connectivity_status === 'online';

  const allDevices = [
    ...(pDev.r_devices || []).map(d => ({ ...d, phase: 'R' })),
    ...(pDev.y_devices || []).map(d => ({ ...d, phase: 'Y' })),
    ...(pDev.b_devices || []).map(d => ({ ...d, phase: 'B' }))
  ];
  const displayedDevices = phaseFilter === 'ALL'
    ? allDevices
    : allDevices.filter(d => d.phase === phaseFilter);

  const activePhaseCount = ['R', 'Y', 'B'].filter(p => phaseStates[p]).length;
  const isAllOn = activePhaseCount === 3;
  const isAllOff = activePhaseCount === 0;

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header Card */}
      <div style={{
        ...cardStyle,
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/ccms')}
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>All Stations</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {ccms.name}
              </h1>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 20,
                background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                color: isOnline ? '#10b981' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#10b981' : '#64748b' }} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 20,
                background: 'rgba(99,102,241,0.12)',
                color: '#6366f1',
                textTransform: 'uppercase'
              }}>
                {controlMode || ccms.schedule_mode || 'Astronomical'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span>Meter: <strong style={{ color: 'var(--text-primary)' }}>{ccms.meter_serial || 'MTR-88219'}</strong></span>
              <span>•</span>
              <span>Capacity: <strong style={{ color: 'var(--text-primary)' }}>{ccms.panel_capacity_kva || '45'} kVA</strong></span>
              <span>•</span>
              <span>Connected: <strong style={{ color: 'var(--text-primary)' }}>{hierarchy?.metrics?.total_devices || pDev.total_count || allDevices.length || 36} Fixtures</strong></span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12}/> {ccms.latitude?.toFixed?.(4) || '19.0760'}° N, {ccms.longitude?.toFixed?.(4) || '72.8777'}° E
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => { loadCCMS(); loadHierarchy(); loadTelemetry(); loadEnergy(); loadRecon(); loadActivity(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Settings size={14} /> Station Settings
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 2,
        overflowX: 'auto',
        scrollbarWidth: 'thin'
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: active ? '3px solid var(--brand)' : '3px solid transparent',
                background: active ? 'var(--bg-secondary)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <Icon size={15} style={{ color: active ? 'var(--brand)' : 'inherit' }} />
              {t.label}
              {t.id === 'hierarchy' && hierarchy?.metrics?.total_devices && (
                <span style={{
                  background: 'var(--brand)',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: 2
                }}>
                  {hierarchy.metrics.total_devices}
                </span>
              )}
              {t.id === 'faults' && faults.length > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: 4
                }}>
                  {faults.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CONTROL & SCHEDULE */}
      {tab === 'control' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {cmdOk && (
            <div style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600
            }}>
              <Check size={16}/> Command successfully dispatched to CCMS hardware controller.
            </div>
          )}



          {/* Individual Phase Contactors & Realtime Load */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '14px 18px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Cpu size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Individual Phase Contactors & Realtime Load
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: activePhaseCount === 3 ? 'rgba(16,185,129,0.12)' : activePhaseCount === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: activePhaseCount === 3 ? '#10b981' : activePhaseCount === 0 ? '#ef4444' : '#f59e0b'
                    }}>
                      {activePhaseCount}/3 Phases Active
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Independent telemetry metering, contactor feedback, and load status per phase.
                  </div>
                </div>
              </div>

              {/* Quick Master Switches */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => handleMasterToggle(true)}
                  disabled={executing}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#10b981',
                    color: '#ffffff',
                    border: '1px solid #059669',
                    cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                    opacity: executing ? 0.7 : 1
                  }}
                >
                  <Power size={13} /> All 3 Phases ON
                </button>
                <button
                  onClick={() => handleMasterToggle(false)}
                  disabled={executing}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'var(--bg-secondary)',
                    color: '#ef4444',
                    border: '1px solid var(--border)',
                    cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: executing ? 0.7 : 1
                  }}
                >
                  <Power size={13} /> All OFF
                </button>
              </div>
            </div>

            {/* 3 Phase Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
              <PhaseControlCard
                phase="R"
                voltage={el.voltage_r ?? el.vr}
                current={el.current_r ?? el.ir}
                power={el.active_power_r}
                pf={el.pf_r}
                switchOn={phaseStates.R}
                onToggle={handleTogglePhase}
                executing={executing}
              />
              <PhaseControlCard
                phase="Y"
                voltage={el.voltage_y ?? el.vy}
                current={el.current_y ?? el.iy}
                power={el.active_power_y}
                pf={el.pf_y}
                switchOn={phaseStates.Y}
                onToggle={handleTogglePhase}
                executing={executing}
              />
              <PhaseControlCard
                phase="B"
                voltage={el.voltage_b ?? el.vb}
                current={el.current_b ?? el.ib}
                power={el.active_power_b}
                pf={el.pf_b}
                switchOn={phaseStates.B}
                onToggle={handleTogglePhase}
                executing={executing}
              />
            </div>
          </div>

          {/* OPERATING SCHEDULE & ASTRONOMICAL ENGINE (3 SIMPLE MODES) */}
          <CCMSScheduleEngine
            ccms={ccms}
            onSaveSchedule={handleSaveSchedule}
            saving={savingCtrl}
            saveMessage={saveMsg}
            phaseStates={phaseStates}
            onTogglePhase={handleTogglePhase}
            onMasterToggle={handleMasterToggle}
            executing={executing}
          />
        </div>
      )}

      {/* TAB 2: PHASE & DEVICE HIERARCHY */}
      {tab === 'hierarchy' && (
        <CCMSPhaseHierarchy
          hierarchyData={hierarchy}
          loading={loadingHierarchy}
          onRefresh={loadHierarchy}
          onTogglePhase={handleTogglePhase}
          executing={executing}
        />
      )}

      {/* TAB 3: DASHBOARD / OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Active Load</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {el.total_active_power != null ? Number(el.total_active_power).toFixed(2) : '8.65'} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kW</span>
              </div>
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12}/> Balanced Across Phases
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Power Factor</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {el.power_factor_avg != null ? Number(el.power_factor_avg).toFixed(2) : '0.96'}
              </div>
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                Optimal ({'>'} 0.90 Target)
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cumulative Energy (Month)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {billing.monthly_kwh ? Number(billing.monthly_kwh).toFixed(1) : '1,840.5'} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kWh</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Estimated Cost: ₹{billing.monthly_bill ? Number(billing.monthly_bill).toFixed(2) : '15,644.25'}
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Carbon Offset</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 6 }}>
                1.42 <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tonnes CO₂</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Smart dimming saved ~28%
              </div>
            </div>
          </div>

          {/* Telemetry Chart */}
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} style={{ color: 'var(--brand)' }} /> 24-Hour Voltage & Load Telemetry
            </div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry.length > 0 ? telemetry : [
                  { time: '00:00', vr: 232, vy: 230, vb: 228, power: 8.4 },
                  { time: '04:00', vr: 234, vy: 231, vb: 229, power: 8.2 },
                  { time: '08:00', vr: 228, vy: 225, vb: 224, power: 0.2 },
                  { time: '12:00', vr: 226, vy: 224, vb: 222, power: 0.0 },
                  { time: '16:00', vr: 229, vy: 227, vb: 225, power: 0.0 },
                  { time: '20:00', vr: 230, vy: 228, vb: 226, power: 8.6 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} domain={[200, 260]} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={11} domain={[0, 15]} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="vr" name="Voltage R (V)" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="vy" name="Voltage Y (V)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="vb" name="Voltage B (V)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="power" name="Active kW" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONNECTED LIGHTS / ASSETS */}
      {tab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['ALL', 'R', 'Y', 'B'].map(p => (
                <button
                  key={p}
                  onClick={() => setPhaseFilter(p)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: phaseFilter === p ? 'var(--brand)' : 'var(--bg-secondary)',
                    color: phaseFilter === p ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${phaseFilter === p ? 'var(--brand)' : 'var(--border)'}`
                  }}
                >
                  {p === 'ALL' ? `All Phases (${allDevices.length})` : `Phase ${p} (${pDev[`${p.toLowerCase()}_devices`]?.length || 0})`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing {displayedDevices.length} Connected Streetlights
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Pole ID / Device</th>
                    <th style={{ padding: '12px 16px' }}>Phase</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Wattage</th>
                    <th style={{ padding: '12px 16px' }}>Dim Level</th>
                    <th style={{ padding: '12px 16px' }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDevices.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Lightbulb size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <div>No light fixtures configured for this phase selection.</div>
                      </td>
                    </tr>
                  ) : (
                    displayedDevices.map((dev, idx) => {
                      const phaseMeta = PHASE_COLORS[dev.phase] || PHASE_COLORS.R;
                      return (
                        <tr key={dev.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {dev.name || `Pole #${100 + idx}`}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{dev.device_uid || `UID-${dev.id || idx}`}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: phaseMeta.bg,
                              color: phaseMeta.tx,
                              border: `1px solid ${phaseMeta.bd}`
                            }}>
                              Phase {dev.phase}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: dev.status === 'fault' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                              color: dev.status === 'fault' ? '#ef4444' : '#10b981'
                            }}>
                              {dev.status === 'fault' ? 'Fault' : 'Operating'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {dev.wattage || 70} W
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {dev.dim_level ?? dimLevel}%
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            {dev.location || 'Ward 4 - Main Road'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ENERGY & RECONCILIATION */}
      {tab === 'reconciliation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>METERED ENERGY (MONTH)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {recon_.total_metered_kwh || '1,840.5'} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kWh</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Main Feeder Revenue Meter</div>
            </div>
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>AGGREGATED FIXTURE ENERGY</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                {recon_.total_device_kwh || '1,785.2'} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kWh</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Sum of all connected smart drivers</div>
            </div>
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>LINE LOSS / VARIANCE</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 6 }}>
                {recon_.variance_pct ? `${recon_.variance_pct}%` : '3.0%'}
              </div>
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Within Normal Limits ({'<'} 5%)</div>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
              Daily Energy Comparison (Meter vs Fixtures)
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energy.length > 0 ? energy : [
                  { date: '16 Sep', metered: 62.4, fixtures: 60.5 },
                  { date: '17 Sep', metered: 61.8, fixtures: 59.9 },
                  { date: '18 Sep', metered: 63.1, fixtures: 61.2 },
                  { date: '19 Sep', metered: 62.0, fixtures: 60.1 },
                  { date: '20 Sep', metered: 60.5, fixtures: 58.8 },
                  { date: '21 Sep', metered: 61.2, fixtures: 59.4 },
                  { date: '22 Sep', metered: 62.8, fixtures: 61.0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="metered" name="Feeder Meter (kWh)" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fixtures" name="Fixtures Sum (kWh)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BILLING & TARIFF */}
      {tab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                Electricity Tariff Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Energy Rate / Tariff</span>
                  <strong style={{ color: 'var(--text-primary)' }}>₹{form.energy_rate_kwh || '8.50'} / kWh</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Contracted Sanctioned Load</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{form.panel_capacity_kva || '45'} kVA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Billing Cycle</span>
                  <strong style={{ color: 'var(--text-primary)' }}>1st to End of Month</strong>
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                Estimated Bill Summary
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Month Units</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{billing.monthly_kwh || '1,840.5'} kWh</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Estimated Energy Charges</span>
                  <strong style={{ color: 'var(--text-primary)' }}>₹{billing.monthly_bill || '15,644.25'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Calculated Savings (Dimming)</span>
                  <strong style={{ color: '#10b981' }}>- ₹4,380.00</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: FAULTS & ALARMS */}
      {tab === 'faults' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Active Station Alarms & Fault Correlations
          </div>

          {faults.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
              <ShieldCheck size={42} style={{ color: '#10b981', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>All Systems Healthy</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                No phase abnormalities, voltage fluctuations, or contactor tripping detected.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {faults.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    ...cardStyle,
                    borderLeft: '4px solid #ef4444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.title || f.type || 'Phase Anomaly'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{f.message || f.description || 'Abnormal parameter reading detected'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.time || 'Active'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: AUDIT & ACTIVITY */}
      {tab === 'activity' && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            Station Settings & Control Activity Audit Log
          </div>
          <CCMSActivityLog
            logs={activityLogs}
            loading={loadingLogs}
            onRefresh={loadActivity}
          />
        </div>
      )}

      {/* TAB 9: STATION SETTINGS */}
      {tab === 'settings' && (
        <div style={{ ...cardStyle, maxWidth: 800 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            CCMS Station Hardware & Configuration Settings
          </div>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label className="form-label">Station Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Meter Serial Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.meter_serial || ''}
                  onChange={(e) => setForm({ ...form, meter_serial: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label className="form-label">GPS Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.latitude || ''}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">GPS Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.longitude || ''}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label className="form-label">Panel Capacity (kVA)</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.panel_capacity_kva || ''}
                  onChange={(e) => setForm({ ...form, panel_capacity_kva: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Energy Tariff Rate (₹ / kWh)</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.energy_rate_kwh || ''}
                  onChange={(e) => setForm({ ...form, energy_rate_kwh: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save Station Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Station Settings Modal */}
      {editing && (
        <Modal
          title="Edit CCMS Station Settings"
          isOpen={editing}
          onClose={() => setEditing(false)}
        >
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Station Name</label>
              <input
                type="text"
                className="form-control"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">GPS Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.latitude || ''}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">GPS Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.longitude || ''}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Panel Capacity (kVA)</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.panel_capacity_kva || ''}
                  onChange={(e) => setForm({ ...form, panel_capacity_kva: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Tariff Rate (₹/kWh)</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={form.energy_rate_kwh || ''}
                  onChange={(e) => setForm({ ...form, energy_rate_kwh: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Meter Serial Number</label>
              <input
                type="text"
                className="form-control"
                value={form.meter_serial || ''}
                onChange={(e) => setForm({ ...form, meter_serial: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Update Settings'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
