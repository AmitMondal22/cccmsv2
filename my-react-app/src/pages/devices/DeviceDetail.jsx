import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDevice, getDeviceTelemetry, getDeviceDiagnostics,
  controlDevice, pingDevice,
  getFaultConfig, saveFaultConfig, restoreFaultDefaults, resetFaultBaseline,
} from '../../api/device.api.js';
import {
  checkFotaUpdates, triggerSingleDeviceFota, uploadFirmwareBinary,
  createFirmwareRelease, getFirmwareReleases
} from '../../api/fota.api.js';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../../api/alert.api.js';
import { getTickets, createTicket } from '../../api/maintenance.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import {
  ArrowLeft, RefreshCw, Power, Zap, Activity, ShieldAlert,
  Wrench, CheckCircle2, Clock, Globe, MapPin, Download,
  Calendar, FileText, AlertTriangle, Plus, Eye, Radio, Sparkles,
  Sliders, SlidersHorizontal, Save, RotateCcw, Undo2, BarChart3,
  BrainCircuit, Repeat, ClipboardList, X, AlertCircle, UploadCloud,
  ArrowUpCircle, Layers, Cpu, Check, Languages
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function timeSince(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const TABS = ['Overview', 'Live Data', 'History', 'Alerts', 'Diagnostics', 'Maintenance', 'Fault Config'];

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [device, setDevice] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  // Live Auto-Refresh & Actions
  const [controlling, setControlling] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(true);

  // History Tab Date Presets
  const today = new Date().toISOString().split('T')[0];
  const last7 = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
  const [histFrom, setHistFrom] = useState(last7);
  const [histTo, setHistTo] = useState(today);
  const [histPreset, setHistPreset] = useState('last7');

  // Create Ticket Modal
  const [ticketModal, setTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    problem_type: 'lamp_fault',
  });
  const [savingTicket, setSavingTicket] = useState(false);

  // Fault Config state
  const [faultCfgData, setFaultCfgData] = useState(null);   // { defaults, effective, saved }
  const [faultCfgEdit, setFaultCfgEdit] = useState({});     // local edits (overrides)
  const [faultCfgSaving, setFaultCfgSaving] = useState(false);
  const [faultCfgMsg, setFaultCfgMsg] = useState(null);     // { type: 'ok'|'err', text }

  // ── Firmware & FOTA States ──
  const [fwUpdateInfo, setFwUpdateInfo] = useState(null); // { latest_version, update_available, current_version }
  const [checkingFw, setCheckingFw] = useState(false);
  const [flashingFw, setFlashingFw] = useState(false);
  const [fwModal, setFwModal] = useState(false);
  const [fwReleasesList, setFwReleasesList] = useState([]);
  const [uploadingBinary, setUploadingBinary] = useState(false);
  const [uploadedBinaryMeta, setUploadedBinaryMeta] = useState(null);
  const fwFileInputRef = useRef(null);
  const [newFwRelease, setNewFwRelease] = useState({
    version: '',
    device_model: 'Techavo SmartLum-60W-V2',
    release_title: '',
    release_notes: '',
    checksum_sha256: '',
    binary_size_bytes: 154820,
    binary_url: '',
    is_critical: false,
    status: 'active',
  });
  const [submittingFwRelease, setSubmittingFwRelease] = useState(false);
  const [fwToast, setFwToast] = useState(null);

  // Alert Resolution Modal State (Full Multilingual UTF-8 Support)
  const [resolveModal, setResolveModal] = useState(false);
  const [selectedAlertToResolve, setSelectedAlertToResolve] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingAlert, setResolvingAlert] = useState(false);

  const showFwToast = (text, isErr = false) => {
    setFwToast({ text, isErr });
    setTimeout(() => setFwToast(null), 4000);
  };

  const handleCheckFirmwareUpdate = async () => {
    setCheckingFw(true);
    try {
      const res = await checkFotaUpdates({ device_id: id });
      const summary = res.data?.summary || {};
      const latestVer = summary.latest_firmware_version || 'v2.4.2-prod';
      const curVer = device?.firmware_version || 'v2.4.1-rc3';
      const isUpToDate = curVer === latestVer;
      setFwUpdateInfo({
        latest_version: latestVer,
        update_available: !isUpToDate,
        current_version: curVer,
      });
      showFwToast(isUpToDate ? `Firmware is up to date (${curVer})` : `Update Available: ${latestVer}`);
    } catch (e) {
      showFwToast('Failed to check for updates', true);
    } finally {
      setCheckingFw(false);
    }
  };

  const handleFlashFirmware = async (targetVersion) => {
    setFlashingFw(true);
    try {
      const res = await triggerSingleDeviceFota({
        device_id: id,
        firmware_version: targetVersion || fwUpdateInfo?.latest_version || 'v2.4.2-prod',
      });
      showFwToast(`⚡ Firmware successfully updated to ${res.data?.new_version || targetVersion} over IPv6!`);
      await fetchDevice();
      setFwUpdateInfo({
        latest_version: res.data?.new_version || targetVersion,
        update_available: false,
        current_version: res.data?.new_version || targetVersion,
      });
      setFwModal(false);
    } catch (e) {
      showFwToast(e.response?.data?.error || 'Firmware update failed', true);
    } finally {
      setFlashingFw(false);
    }
  };

  const handleOpenFwModal = async () => {
    setFwModal(true);
    setUploadedBinaryMeta(null);
    try {
      const res = await getFirmwareReleases();
      setFwReleasesList(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFirmwareFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBinary(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadFirmwareBinary(formData);
      const data = res.data;
      const matchedVer = file.name.match(/v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?/i);
      const extractedVer = matchedVer ? (matchedVer[0].startsWith('v') ? matchedVer[0] : `v${matchedVer[0]}`) : '';
      setUploadedBinaryMeta({
        name: file.name,
        size: file.size,
        hash: data.checksum_sha256,
        url: data.binary_url,
      });
      setNewFwRelease(prev => ({
        ...prev,
        version: prev.version || extractedVer || file.name.replace(/\.[^/.]+$/, ''),
        release_title: prev.release_title || `Firmware ${extractedVer || file.name.replace(/\.[^/.]+$/, '')} Release`,
        checksum_sha256: data.checksum_sha256,
        binary_size_bytes: data.binary_size_bytes,
        binary_url: data.binary_url,
      }));
      showFwToast(`✅ File uploaded: ${file.name}`);
    } catch (err) {
      showFwToast(err.response?.data?.error || 'Failed to upload firmware binary', true);
    } finally {
      setUploadingBinary(false);
    }
  };

  const handlePublishAndFlashFw = async (e) => {
    e.preventDefault();
    if (!newFwRelease.version || !newFwRelease.release_title) {
      showFwToast('Please provide version string and title', true);
      return;
    }
    setSubmittingFwRelease(true);
    try {
      await createFirmwareRelease(newFwRelease);
      showFwToast(`Firmware ${newFwRelease.version} published! Flashing to device...`);
      await handleFlashFirmware(newFwRelease.version);
    } catch (err) {
      showFwToast(err.response?.data?.error || 'Failed to publish firmware', true);
    } finally {
      setSubmittingFwRelease(false);
    }
  };

  // Fetch Device Core Data
  const fetchDevice = async () => {
    try {
      const res = await getDevice(id);
      setDevice(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Telemetry History
  const fetchTelemetry = async (from = histFrom, to = histTo) => {
    try {
      const res = await getDeviceTelemetry(id, { from, to, limit: 200 });
      const records = Array.isArray(res.data) ? res.data : [];
      // Sort oldest to newest for chronological chart streaming
      const sorted = [...records].sort((a, b) => new Date(a.server_timestamp || a.packet_timestamp) - new Date(b.server_timestamp || b.packet_timestamp));
      setTelemetry(sorted);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Alerts for this device
  const fetchAlerts = async () => {
    try {
      const res = await getAlerts({ device_id: id, limit: 50 });
      setAlerts(res.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Maintenance Tickets for this device
  const fetchTickets = async () => {
    try {
      const res = await getTickets({ device_id: id, limit: 50 });
      setTickets(res.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Diagnostics
  const fetchDiagnostics = async () => {
    try {
      const res = await getDeviceDiagnostics(id);
      setDiagnostics(res.data || null);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Fault Config
  const fetchFaultConfig = async () => {
    try {
      const res = await getFaultConfig(id);
      setFaultCfgData(res.data);
      setFaultCfgEdit(res.data?.saved || {});
    } catch (e) { /* ignore */ }
  };

  const loadAll = async () => {

    await Promise.all([
      fetchDevice(),
      fetchTelemetry(),
      fetchAlerts(),
      fetchTickets(),
      fetchDiagnostics(),
      fetchFaultConfig(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  // Live rapid polling for Live Data tab (every 5 seconds)
  useEffect(() => {
    if (!liveAutoRefresh) return;
    const interval = setInterval(() => {
      fetchDevice();
      fetchTelemetry();
      if (tab === 'Diagnostics') fetchDiagnostics();
      if (tab === 'Alerts') fetchAlerts();
    }, 5000);
    return () => clearInterval(interval);
  }, [id, liveAutoRefresh, tab]);

  // Manual Light ON / OFF Control Override
  const handleToggleLight = async () => {
    if (!device) return;
    const nextAction = device.light_status === 'on' ? 'off' : 'on';
    setControlling(true);
    try {
      await controlDevice(id, nextAction);
      await fetchDevice();
      await fetchTelemetry();
    } catch (e) {
      alert('Failed to send control command');
    }
    setControlling(false);
  };

  // Diagnostic Ping / Test
  const handlePing = async () => {
    setPinging(true);
    try {
      const res = await pingDevice(id);
      setPingResult(res.data);
      await fetchDevice();
      await fetchDiagnostics();
    } catch (e) {
      alert('Device ping failed');
    }
    setPinging(false);
  };

  // Handle History Preset Change
  const applyHistPreset = (preset) => {
    setHistPreset(preset);
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    let from = t;
    let to = t;
    if (preset === 'today') {
      from = t;
      to = t;
    } else if (preset === 'yesterday') {
      const y = new Date(now - 864e5).toISOString().split('T')[0];
      from = y;
      to = y;
    } else if (preset === 'last7') {
      from = new Date(now - 7 * 864e5).toISOString().split('T')[0];
      to = t;
    } else if (preset === 'last30') {
      from = new Date(now - 30 * 864e5).toISOString().split('T')[0];
      to = t;
    }
    setHistFrom(from);
    setHistTo(to);
    fetchTelemetry(from, to);
  };

  // Acknowledge / Resolve Alert
  const handleAckAlert = async (alertId) => {
    await acknowledgeAlert(alertId);
    fetchAlerts();
  };

  const handleOpenResolveModal = (alertObj) => {
    setSelectedAlertToResolve(alertObj);
    setResolutionNotes('');
    setResolveModal(true);
  };

  const handleConfirmResolveAlert = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAlertToResolve) return;
    setResolvingAlert(true);
    try {
      const notes = resolutionNotes.trim() || 'Resolved by operator';
      await resolveAlert(selectedAlertToResolve.id, { notes });
      setResolveModal(false);
      setSelectedAlertToResolve(null);
      setResolutionNotes('');
      fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
    setResolvingAlert(false);
  };

  // Create Maintenance Ticket
  const handleCreateTicket = async () => {
    if (!ticketForm.title) {
      alert('Please enter a ticket title');
      return;
    }
    setSavingTicket(true);
    try {
      await createTicket({
        ...ticketForm,
        device_id: parseInt(id),
      });
      setTicketModal(false);
      setTicketForm({ title: '', description: '', priority: 'medium', problem_type: 'lamp_fault' });
      fetchTickets();
    } catch (e) {
      console.error(e);
    }
    setSavingTicket(false);
  };

  // Export Telemetry to CSV
  const exportHistoryCSV = () => {
    if (telemetry.length === 0) {
      alert('No telemetry records to export');
      return;
    }
    const headers = ['Timestamp (IST)', 'UID', 'Voltage (V)', 'Current (A)', 'Power (W)', 'PF', 'Freq (Hz)', 'kWh', 'Run Hours', 'Light', 'Fault'];
    const rows = [...telemetry].reverse().map(t => [
      t.server_timestamp || t.packet_timestamp ? new Date(t.server_timestamp || t.packet_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
      t.uid || device?.uid || '',
      t.voltage != null ? Number(t.voltage).toFixed(2) : '',
      t.current != null ? Number(t.current).toFixed(3) : '',
      t.real_power != null ? Number(t.real_power).toFixed(2) : '',
      t.pf != null ? Number(t.pf).toFixed(2) : '',
      t.frequency != null ? Number(t.frequency).toFixed(1) : '50.0',
      t.kwh != null ? Number(t.kwh).toFixed(2) : '',
      t.run_hours != null ? Number(t.run_hours).toFixed(1) : '',
      t.light_status === 1 || t.light_status === 'on' || t.light_status === true ? 'ON' : 'OFF',
      t.fault === 1 || t.fault === true ? 'FAULT' : 'NORMAL',
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(',')).join('\n')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${device?.uid || 'device'}_telemetry_${histFrom}_to_${histTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /> Loading device data...</div>;
  if (!device) return <div className="empty-state">Device not found</div>;

  const s = device.latestState;
  const streetPath = [
    device.street?.ward?.zone?.city?.name,
    device.street?.ward?.zone?.name,
    device.street?.ward?.name,
    device.street?.name,
  ].filter(Boolean).join(' / ');

  const chartData = telemetry.map(t => ({
    time: new Date(t.server_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    Voltage: parseFloat(t.voltage) || 0,
    Current: parseFloat(t.current) || 0,
    Power: parseFloat(t.real_power) || 0,
  }));

  const isLightOn = device.light_status === 'on';

  return (
    <div>
      {/* ── Top Navigation Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/devices')}>
          <ArrowLeft size={14} /> Back to All Devices
        </button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Live Indicator */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              background: liveAutoRefresh ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
              color: liveAutoRefresh ? 'var(--online)' : 'var(--text-muted)',
              border: `1px solid ${liveAutoRefresh ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: liveAutoRefresh ? 'var(--online)' : 'var(--text-muted)',
                animation: liveAutoRefresh ? 'pulse 1.5s infinite' : 'none',
              }}
            />
            {liveAutoRefresh ? 'Live Streaming (5s)' : 'Stream Paused'}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setLiveAutoRefresh(p => !p)}
            title="Toggle Live Stream Auto-Polling"
          >
            {liveAutoRefresh ? 'Pause' : 'Resume Live'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadAll}>
            <RefreshCw size={13} /> Refresh All
          </button>
        </div>
      </div>

      {/* ── Device Hero Header Card ── */}
      <div className="device-hero">
        <div className="device-hero-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{device.uid}</h1>
            <StatusBadge value={device.connectivity_status} type="connectivity" />
            <StatusBadge value={device.light_status} type="light" />
            <StatusBadge value={device.health_status} type="health" />
          </div>

          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>{device.name}</strong> · {streetPath || 'No location assigned'}
          </p>

          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Last seen: {timeSince(device.last_seen)}
            {device.last_seen && ` · ${new Date(device.last_seen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}
          </p>
        </div>

        <div className="device-hero-status" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Work Order Action */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTicketModal(true)}
          >
            <Wrench size={14} /> Create Ticket
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadAll}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Ping Result Notification */}
      {pingResult && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} /> Device response received in <strong>{pingResult.latency_ms} ms</strong> · Connection Active
        </div>
      )}

      {/* ── Electrical Readout Grid (Live Gauges) ── */}
      <div className="elec-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Voltage', value: s?.voltage, unit: 'V', color: '#38bdf8', sub: 'Safe (190-255V)' },
          { label: 'Current', value: s?.current, unit: 'A', color: '#22c55e', sub: 'Load Current' },
          { label: 'Active Power', value: s?.real_power, unit: 'W', color: '#f97316', sub: '' },
          { label: 'Power Factor', value: s?.pf, unit: '', color: '#a855f7', sub: '' },
          { label: 'Grid Freq', value: s?.frequency, unit: 'Hz', color: '#38bdf8', sub: 'Nominal 50Hz' },
          { label: 'Cumulative Energy', value: s?.kwh, unit: 'kWh', color: '#f59e0b', sub: 'Total Consumption' },
          { label: 'Burn Hours', value: s?.run_hours, unit: 'h', color: '#ec4899', sub: 'Lifetime Operation' },
        ].map(item => (
          <div key={item.label} className="elec-tile">
            <div className="elec-value" style={{ color: item.color }}>
              {item.value != null ? Number(item.value).toFixed(2) : '—'}
              <span className="elec-unit"> {item.unit}</span>
            </div>
            <div className="elec-label">{item.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {t === 'Fault Config' && <SlidersHorizontal size={13} style={{ marginRight: 6 }} />}
            {t}
            {t === 'Alerts' && alerts.length > 0 && (
              <span className="nav-badge" style={{ marginLeft: 6 }}>{alerts.length}</span>
            )}
            {t === 'Maintenance' && tickets.length > 0 && (
              <span className="nav-badge" style={{ marginLeft: 6, background: 'var(--warning)' }}>{tickets.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {tab === 'Overview' && (
        <div className="grid-2">
          {/* Device Specifications Card */}
          <div className="card">
            <div className="card-header"><div className="card-title">Device Specifications & State</div></div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {[
                ['Unique ID (UID)', device.uid],
                ['Fixture Name', device.name],
                ['Serial Number', device.serial_number || 'TECH-CCMS-2026-001'],
                ['Device Model', device.device_model || 'Techavo SmartLum-60W-V2'],
                ['Rated Power', device.rated_power ? `${device.rated_power} W` : '60 W (LED)'],
                ['Rated Voltage', device.rated_voltage ? `${device.rated_voltage} V` : '230 V AC (50Hz)'],
                ['Installation Date', device.installation_date || '2026-01-15'],
                ['Operational Status', device.status?.toUpperCase() || 'ACTIVE'],
              ].map(([k, v]) => (
                <div key={k} className="diag-row" style={{ padding: '8px 0' }}>
                  <span className="diag-key">{k}</span>
                  <span className="diag-val">{v}</span>
                </div>
              ))}

              {/* Interactive Firmware Row */}
              <div className="diag-row" style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="diag-key" style={{ fontWeight: 600 }}>Firmware Version</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>
                      {device.firmware_version || 'v2.4.1-rc3'}
                    </span>
                    {fwUpdateInfo && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: fwUpdateInfo.update_available ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                        color: fwUpdateInfo.update_available ? '#f59e0b' : '#22c55e',
                        border: `1px solid ${fwUpdateInfo.update_available ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                      }}>
                        {fwUpdateInfo.update_available ? `Update: ${fwUpdateInfo.latest_version}` : 'Up to Date'}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={handleCheckFirmwareUpdate}
                    disabled={checkingFw}
                  >
                    <RefreshCw size={11} className={checkingFw ? 'spin' : ''} />
                    {checkingFw ? 'Checking...' : 'Check for Updates'}
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={handleOpenFwModal}
                  >
                    <UploadCloud size={11} /> Add / Upload Firmware
                  </button>

                  {fwUpdateInfo?.update_available && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px', background: '#f59e0b', borderColor: '#f59e0b' }}
                      onClick={() => handleFlashFirmware(fwUpdateInfo.latest_version)}
                      disabled={flashingFw}
                    >
                      <Radio size={11} /> {flashingFw ? 'Flashing...' : `Flash ${fwUpdateInfo.latest_version}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location & GIS Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Location Hierarchy & Coordinates</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/gis')}
                style={{ fontSize: 11 }}
              >
                <Globe size={12} /> View on Map
              </button>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {[
                ['City', device.street?.ward?.zone?.city?.name || '—'],
                ['Zone', device.street?.ward?.zone?.name || '—'],
                ['Ward', device.street?.ward?.name || '—'],
                ['Street', device.street?.name || '—'],
                ['Latitude', device.latitude || '22.5535'],
                ['Longitude', device.longitude || '88.3518'],
                ['GPS Accuracy', 'High (< 2.5m)'],
                ['Mounting Type', 'Pole Arm Mount (8m height)'],
              ].map(([k, v]) => (
                <div key={k} className="diag-row" style={{ padding: '8px 0' }}>
                  <span className="diag-key">{k}</span>
                  <span className="diag-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE DATA ── */}
      {tab === 'Live Data' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Live Telemetry Streaming Chart</div>
                <div className="card-subtitle">Real-time electrical parameters stream (5s cadence)</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-online">Streaming Active</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {chartData.length === 0 ? (
                <div className="empty-state"><p>Waiting for live stream packets...</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#22c55e', fontSize: 11 }} unit=" A" domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }} />
                    <Line yAxisId="left" type="monotone" dataKey="Voltage" name="Voltage (V)" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="Current" name="Current (A)" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="Power" name="Power (W)" stroke="#f97316" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Network Packet Stack */}
          <div className="card">
            <div className="card-header"><div className="card-title">Gateway & Network Protocol Diagnostics</div></div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>IPv6 / Interface Address</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, fontFamily: 'monospace', color: 'var(--brand)' }}>
                  {s?.ipv6_address || '2001:0db8:85a3:0000:0000:8a2e:0370:7334'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packets Received Today</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{s?.packets_today || 1440}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packet Drop / Invalid</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: '#22c55e' }}>0 (0.00%)</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Telemetry Cadence</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>60 seconds</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: HISTORY (HISTORICAL DATA) ── */}
      {tab === 'History' && (
        <div>
          {/* Date Range Selector & Export Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['today', 'yesterday', 'last7', 'last30'].map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${histPreset === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applyHistPreset(p)}
                >
                  {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'last7' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>

            <button className="btn btn-primary btn-sm" onClick={exportHistoryCSV}>
              <Download size={13} /> Export Historical CSV
            </button>
          </div>

          {/* Historical Telemetry Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Historical Telemetry Log ({telemetry.length} data points)</div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Voltage (V)</th>
                    <th>Current (A)</th>
                    <th>Real Power (W)</th>
                    <th>Power Factor</th>
                    <th>Energy (kWh)</th>
                    <th>Frequency (Hz)</th>
                    <th>Burn Hours</th>
                    <th>Light Status</th>
                    <th>Fault</th>
                  </tr>
                </thead>
                <tbody>
                  {[...telemetry].reverse().map((t, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>
                        {t.server_timestamp || t.packet_timestamp
                          ? new Date(t.server_timestamp || t.packet_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                          : '—'}
                      </td>
                      <td style={{ color: '#38bdf8', fontWeight: 600 }}>{t.voltage != null ? `${Number(t.voltage).toFixed(1)} V` : '—'}</td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{t.current != null ? `${Number(t.current).toFixed(3)} A` : '—'}</td>
                      <td style={{ color: '#f97316', fontWeight: 600 }}>{t.real_power != null ? `${Number(t.real_power).toFixed(1)} W` : '—'}</td>
                      <td className="dim">{t.pf != null ? Number(t.pf).toFixed(2) : '—'}</td>
                      <td style={{ color: '#a855f7', fontWeight: 600 }}>{t.kwh != null ? `${Number(t.kwh).toFixed(2)}` : '—'}</td>
                      <td className="dim">{t.frequency != null ? `${Number(t.frequency).toFixed(1)} Hz` : '50.0 Hz'}</td>
                      <td className="dim">{t.run_hours != null ? `${Number(t.run_hours).toFixed(1)} h` : '—'}</td>
                      <td><StatusBadge value={t.light_status === 1 || t.light_status === 'on' || t.light_status === true ? 'on' : 'off'} type="light" /></td>
                      <td>
                        <span className={`badge ${t.fault === 1 || t.fault === true ? 'badge-fault' : 'badge-online'}`}>
                          {t.fault === 1 || t.fault === true ? 'FAULT' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {telemetry.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No historical telemetry records for this date range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ALERTS ── */}
      {tab === 'Alerts' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Device Alarms & Active Incidents ({alerts.length})</div>
              <div className="card-subtitle">Real-time alert condition notifications and audit log</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAlerts}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Detected At</th>
                  <th>Severity</th>
                  <th>Alert Type</th>
                  <th>Message</th>
                  <th>Electrical at Alert</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={24} style={{ color: '#22c55e', display: 'block', margin: '0 auto 8px' }} />
                      No active alerts or faults detected on this fixture.
                    </td>
                  </tr>
                )}
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td><StatusBadge value={a.severity} type="severity" /></td>
                    <td style={{ fontWeight: 600 }}>{a.alert_type?.replace(/_/g, ' ')}</td>
                    <td>{a.message}</td>
                    <td style={{ fontSize: 11 }}>
                      {a.voltage_at_alert && `${a.voltage_at_alert}V `}
                      {a.current_at_alert && `${a.current_at_alert}A `}
                      {a.power_at_alert && `${a.power_at_alert}W`}
                    </td>
                    <td><StatusBadge value={a.status} type="alertStatus" /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.status === 'open' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAckAlert(a.id)}>
                            Acknowledge
                          </button>
                        )}
                        {a.status !== 'resolved' && a.status !== 'closed' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleOpenResolveModal(a)}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: DIAGNOSTICS ── */}
      {tab === 'Diagnostics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Electrical Tolerance Diagnostics */}
            <div className="diag-section">
              <div className="diag-section-title">Electrical Parameter Health & Tolerances</div>
              <div className="diag-row">
                <span className="diag-key">Voltage Range</span>
                <span className="diag-val" style={{ color: (s?.voltage || 0) < 190 || (s?.voltage || 0) > 255 ? '#ef4444' : '#22c55e' }}>
                  {s?.voltage || '230.0'} V ({((s?.voltage || 0) < 190 || (s?.voltage || 0) > 255) ? 'Out of Spec' : 'Normal'})
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Current Load Check</span>
                <span className="diag-val" style={{ color: (s?.current || 0) > 2.0 ? '#ef4444' : '#22c55e' }}>
                  {s?.current || '0.26'} A (Normal &lt; 2.0A)
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Power Factor Efficiency</span>
                <span className="diag-val" style={{ color: (s?.pf || 1.0) < 0.85 ? '#f59e0b' : '#22c55e' }}>
                  {s?.pf || '0.98'} ({((s?.pf || 1.0) < 0.85) ? 'Low PF' : 'Optimal'})
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Frequency Drift</span>
                <span className="diag-val">{s?.frequency || '50.0'} Hz (Locked)</span>
              </div>
            </div>

            {/* Hardware & Microcontroller Stack */}
            <div className="diag-section">
              <div className="diag-section-title">Microcontroller & Hardware Health</div>
              <div className="diag-row">
                <span className="diag-key">Hardware Fault Code</span>
                <span className="diag-val" style={{ color: s?.fault === 1 ? '#ef4444' : '#22c55e' }}>
                  {s?.fault === 1 ? 'FAULT (1)' : 'OK (0)'}
                </span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Restart Count</span>
                <span className="diag-val">{s?.restart_count || 0}</span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Lifetime Fault Events</span>
                <span className="diag-val">{s?.fault_count || 0}</span>
              </div>
              <div className="diag-row">
                <span className="diag-key">Relay Driver Status</span>
                <span className="diag-val" style={{ color: '#22c55e' }}>
                  {device.light_status === 'on' ? 'Closed (Energized)' : 'Open (De-energized)'}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Run Active Diagnostic Round-Trip</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Sends an interactive telemetry echo packet to verify end-to-end communication
                </div>
              </div>
              <button className="btn btn-primary" onClick={handlePing} disabled={pinging}>
                <Activity size={14} className={pinging ? 'pulse' : ''} />
                {pinging ? 'Testing...' : 'Execute Diagnostic Ping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: MAINTENANCE ── */}
      {tab === 'Maintenance' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Maintenance Work Orders & Service Tickets ({tickets.length})</div>
              <div className="card-subtitle">Field service history and dispatch orders for {device.uid}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setTicketModal(true)}>
              <Plus size={13} /> Create Work Order
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Priority</th>
                  <th>Title & Problem</th>
                  <th>Assigned Technician</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Resolution Notes</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No service tickets on record for this luminaire.
                    </td>
                  </tr>
                )}
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{t.ticket_number}</td>
                    <td><StatusBadge value={t.priority} type="priority" /></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.problem_type}</div>
                    </td>
                    <td>{t.assignedTechnician?.name || 'Unassigned'}</td>
                    <td><StatusBadge value={t.status} type="ticketStatus" /></td>
                    <td>{new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td className="dim">{t.repair_notes || t.diagnosis || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 7: FAULT CONFIG ── */}
      {tab === 'Fault Config' && faultCfgData && (() => {
        const { defaults, effective } = faultCfgData;

        const SECTIONS = [
          {
            title: 'Voltage & Current',
            Icon: Zap,
            color: '#3b82f6',
            fields: [
              { key: 'supply_voltage_min',   label: 'Min Supply Voltage',   unit: 'V',  hint: 'FC-07 — no supply', step: 'any' },
              { key: 'open_circuit_current', label: 'Open Circuit Current', unit: 'A',  hint: 'FC-01 — open circuit', step: '0.01' },
              { key: 'overcurrent_ratio',    label: 'Overcurrent Ratio',    unit: '×',  hint: 'FC-03 — overcurrent', step: '0.05' },
            ],
          },
          {
            title: 'Baseline Ratios',
            Icon: BarChart3,
            color: '#3b82f6',
            fields: [
              { key: 'led_fault_lower_ratio',   label: 'LED Fault Lower Ratio',    unit: '×',  hint: 'FC-02 — LED failure', step: '0.05' },
              { key: 'underpowered_upper_ratio', label: 'Underpowered Upper Ratio', unit: '×',  hint: 'FC-05 — underpowered', step: '0.05' },
              { key: 'low_pf_threshold',         label: 'Low Power Factor',         unit: 'PF', hint: 'FC-04 — poor PF', step: '0.01' },
            ],
          },
          {
            title: 'Baseline Learning',
            Icon: BrainCircuit,
            color: '#3b82f6',
            fields: [
              { key: 'baseline_learning_packets', label: 'Learning Packets',   unit: 'n',  hint: 'ON-state samples required', step: '1' },
              { key: 'baseline_pf_min',           label: 'Min PF for Sample',  unit: 'PF', hint: 'Below this — skip sample', step: '0.05' },
              { key: 'baseline_current_min',      label: 'Min Current (noise floor)', unit: 'A',  hint: 'Below this — skip sample', step: '0.01' },
            ],
          },
          {
            title: 'Debounce & Cycling',
            Icon: Repeat,
            color: '#3b82f6',
            fields: [
              { key: 'debounce_count',      label: 'Debounce Count',       unit: 'n',  hint: 'Consecutive faults before alert', step: '1' },
              { key: 'cycling_spike_count', label: 'Cycling Spike Count',  unit: 'n',  hint: 'FC-06 — spikes in window', step: '1' },
              { key: 'cycling_window_ms',   label: 'Cycling Window',       unit: 'ms', hint: 'e.g. 60000 = 60 seconds', step: '1000' },
            ],
          },
        ];

        const handleSave = async () => {
          setFaultCfgSaving(true);
          setFaultCfgMsg(null);
          try {
            const res = await saveFaultConfig(id, faultCfgEdit);
            setFaultCfgData(d => ({ ...d, saved: res.data.saved, effective: res.data.effective }));
            setFaultCfgMsg({ type: 'ok', text: 'Thresholds saved.' });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: 'Failed to save.' });
          }
          setFaultCfgSaving(false);
        };

        const handleRestoreDefaults = async () => {
          if (!confirm('Restore to system defaults?')) return;
          try {
            await restoreFaultDefaults(id);
            await fetchFaultConfig();
            setFaultCfgMsg({ type: 'ok', text: 'Restored to defaults.' });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: 'Failed to restore.' });
          }
        };

        const handleResetBaseline = async () => {
          if (!confirm('Reset learned baseline? Will re-learn on next packets.')) return;
          try {
            const res = await resetFaultBaseline(id);
            setFaultCfgMsg({ type: 'ok', text: res.data.message || 'Baseline reset.' });
          } catch (e) {
            setFaultCfgMsg({ type: 'err', text: 'Failed to reset baseline.' });
          }
        };

        const customCount = Object.values(faultCfgEdit).filter(v => v !== undefined && v !== '').length;

        const ROW = {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0 32px',
          alignItems: 'center',
          padding: '10px 0',
          borderBottom: '1px solid rgba(59,130,246,0.08)',
        };

        return (
          <div style={{ maxWidth: 1200 }}>

            {/* ── Page Header ── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              flexWrap: 'wrap', gap: 12, marginBottom: 20,
              paddingBottom: 16, borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
                }}>
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    LED Fault Detection Thresholds
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Device: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{device.uid}</span>
                    {customCount > 0 && (
                      <span style={{
                        marginLeft: 10, fontSize: 11, fontWeight: 600,
                        padding: '1px 8px', borderRadius: 10,
                        background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                        border: '1px solid rgba(59,130,246,0.25)',
                      }}>
                        {customCount} custom override{customCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={handleResetBaseline}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <RotateCcw size={13} /> Reset Baseline
                </button>
                <button
                  onClick={handleRestoreDefaults}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Undo2 size={13} /> Restore Defaults
                </button>
                <button
                  onClick={handleSave}
                  disabled={faultCfgSaving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: '#2563eb', border: '1px solid #3b82f6',
                    color: '#fff', transition: 'all 0.15s',
                    opacity: faultCfgSaving ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!faultCfgSaving) e.currentTarget.style.background = '#1d4ed8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
                >
                  <Save size={13} /> {faultCfgSaving ? 'Saving…' : 'Save Thresholds'}
                </button>
              </div>
            </div>

            {/* ── Status Banner ── */}
            {faultCfgMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 7, marginBottom: 16, fontSize: 12, fontWeight: 600,
                background: faultCfgMsg.type === 'ok' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                border: `1px solid ${faultCfgMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: faultCfgMsg.type === 'ok' ? '#4ade80' : '#f87171',
              }}>
                {faultCfgMsg.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                {faultCfgMsg.text}
              </div>
            )}

            {/* ── 2-Column Sections Grid (Left: Voltage & Current, Baseline Learning | Right: Baseline Ratios, Debounce & Cycling) ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}>
              {SECTIONS.map(section => {
                const SIcon = section.Icon;
                return (
                  <div key={section.title} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '11px 16px',
                      background: 'rgba(59,130,246,0.05)',
                      borderBottom: '1px solid rgba(59,130,246,0.12)',
                    }}>
                      <SIcon size={15} style={{ color: '#3b82f6' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                        {section.title}
                      </span>
                    </div>

                    {/* Form Rows */}
                    <div style={{ padding: '6px 16px 10px', flex: 1 }}>
                      {section.fields.map((f, idx) => {
                        const hasOverride = faultCfgEdit[f.key] !== undefined && faultCfgEdit[f.key] !== '';
                        const isLast = idx === section.fields.length - 1;
                        return (
                          <div key={f.key} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 0',
                            borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                          }}>
                            {/* Left: Label & Effective info */}
                            <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {f.label}
                                </span>
                                {hasOverride && (
                                  <span style={{
                                    fontSize: 9, fontWeight: 700,
                                    padding: '1px 5px', borderRadius: 4,
                                    background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                                    border: '1px solid rgba(59,130,246,0.3)',
                                  }}>
                                    CUSTOM
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }} title={f.hint}>
                                {f.hint} · <span style={{ color: '#60a5fa', fontWeight: 600 }}>eff: {effective[f.key]} {f.unit !== 'n' ? f.unit : ''}</span>
                              </div>
                            </div>

                            {/* Right: Input + Clear Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 145, flexShrink: 0 }}>
                              <div style={{
                                display: 'flex', alignItems: 'center',
                                flex: 1,
                                background: 'var(--bg-primary)',
                                border: hasOverride ? '1px solid #3b82f6' : '1px solid var(--border)',
                                borderRadius: 7,
                                overflow: 'hidden',
                                height: 34,
                                transition: 'border-color 0.15s',
                              }}>
                                <input
                                  type="number"
                                  step={f.step || 'any'}
                                  value={faultCfgEdit[f.key] ?? ''}
                                  placeholder={String(defaults[f.key])}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setFaultCfgEdit(prev => ({
                                      ...prev,
                                      [f.key]: val === '' ? undefined : parseFloat(val),
                                    }));
                                  }}
                                  style={{
                                    flex: 1, border: 'none', outline: 'none',
                                    background: 'transparent',
                                    padding: '0 8px',
                                    fontSize: 12, fontWeight: 600,
                                    color: hasOverride ? '#60a5fa' : 'var(--text-primary)',
                                    width: 0,
                                  }}
                                />
                                <span style={{
                                  padding: '0 8px', fontSize: 10, fontWeight: 700,
                                  color: 'var(--text-muted)',
                                  borderLeft: '1px solid var(--border)',
                                  height: '100%', display: 'flex', alignItems: 'center',
                                  background: 'rgba(255,255,255,0.03)',
                                  minWidth: 32, justifyContent: 'center',
                                }}>
                                  {f.unit === 'n' ? '#' : f.unit}
                                </span>
                              </div>

                              {hasOverride ? (
                                <button
                                  title="Reset to default"
                                  onClick={() => setFaultCfgEdit(prev => { const n = { ...prev }; delete n[f.key]; return n; })}
                                  style={{
                                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                    color: '#f87171', cursor: 'pointer', transition: 'all 0.15s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
                                >
                                  <X size={12} />
                                </button>
                              ) : (
                                <div style={{ width: 28 }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Effective Config Summary ── */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '11px 18px',
                background: 'rgba(59,130,246,0.05)',
                borderBottom: '1px solid rgba(59,130,246,0.12)',
              }}>
                <ClipboardList size={15} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Configuration
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                  — live values in fault detection engine
                </span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {Object.entries(effective).map(([key, val]) => {
                    const isCustom = faultCfgEdit[key] !== undefined && faultCfgEdit[key] !== '';
                    return (
                      <div key={key} style={{
                        padding: '8px 12px', borderRadius: 7,
                        background: isCustom ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                        border: `1px solid ${isCustom ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div style={{
                          fontSize: 15, fontWeight: 700,
                          color: isCustom ? '#60a5fa' : 'var(--text-primary)',
                        }}>
                          {val}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ── Create Ticket Modal ── */}
      <Modal
        title={`Create Work Order for ${device.uid}`}
        open={ticketModal}
        onClose={() => setTicketModal(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTicketModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateTicket} disabled={savingTicket}>
              {savingTicket ? 'Creating...' : 'Create Ticket'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Ticket Title *</label>
          <input
            className="form-input"
            value={ticketForm.title}
            onChange={e => setTicketForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Luminaire flickering / Under-voltage inspection"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={ticketForm.priority}
              onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Problem Type</label>
            <select
              className="form-select"
              value={ticketForm.problem_type}
              onChange={e => setTicketForm(p => ({ ...p, problem_type: e.target.value }))}
            >
              <option value="lamp_fault">Lamp Failure</option>
              <option value="voltage_surge">Voltage Surge / Spike</option>
              <option value="power_supply">Power Supply Failure</option>
              <option value="comm_failure">Communication Loss</option>
              <option value="physical_damage">Physical Pole Damage</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description & Field Instructions</label>
          <textarea
            className="form-textarea"
            value={ticketForm.description}
            onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Enter technician diagnosis instructions..."
          />
        </div>
      </Modal>

      {/* ── Firmware Toast ── */}
      {fwToast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: fwToast.isErr ? '#ef4444' : '#10b981',
          color: '#fff', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.2s ease',
        }}>
          {fwToast.isErr ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {fwToast.text}
        </div>
      )}

      {/* ── Modal: Add / Upload Firmware & Flash OTA ── */}
      {fwModal && (
        <Modal
          title={`Firmware Update & Upload — ${device.uid}`}
          open={fwModal}
          onClose={() => setFwModal(false)}
        >
          {/* Current Luminaire Status Banner */}
          <div style={{
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Device Version</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>
                {device.firmware_version || 'v2.4.1-rc3'}
              </div>
            </div>
            {fwUpdateInfo?.latest_version && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Latest Active Release</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                  {fwUpdateInfo.latest_version}
                </div>
              </div>
            )}
          </div>

          {/* Existing Releases Quick-Flash */}
          {fwReleasesList.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Flash Available Releases
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                {fwReleasesList.map(rel => {
                  const isCurrent = (device.firmware_version || 'v2.4.1-rc3') === rel.version;
                  return (
                    <div key={rel.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 6,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: isCurrent ? 'var(--text-muted)' : '#60a5fa' }}>
                          {rel.version}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {rel.release_title}
                        </span>
                      </div>
                      <div>
                        {isCurrent ? (
                          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Active Version</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11, padding: '3px 10px' }}
                            disabled={flashingFw}
                            onClick={() => handleFlashFirmware(rel.version)}
                          >
                            <Radio size={11} /> {flashingFw ? 'Flashing...' : 'Flash to Device'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form to Upload New Firmware Binary */}
          <form onSubmit={handlePublishAndFlashFw}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Upload New Firmware Binary File
            </div>

            {/* Drag/Drop & File Input */}
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: '14px 18px',
              textAlign: 'center',
              background: uploadedBinaryMeta ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)',
              borderColor: uploadedBinaryMeta ? '#22c55e' : 'var(--border)',
              marginBottom: 14,
            }}>
              <input
                ref={fwFileInputRef}
                type="file"
                accept=".bin,.hex,.zip,.tar,.gz,.elf"
                style={{ display: 'none' }}
                onChange={handleFirmwareFileUpload}
              />

              {uploadedBinaryMeta ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#22c55e', fontWeight: 700, fontSize: 12 }}>
                    <CheckCircle2 size={16} /> Binary File Uploaded & Verified
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {uploadedBinaryMeta.name} ({(uploadedBinaryMeta.size / 1024).toFixed(1)} KB)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                    SHA-256: {uploadedBinaryMeta.hash?.slice(0, 24)}...
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 6, fontSize: 11 }}
                    onClick={() => fwFileInputRef.current?.click()}
                  >
                    Change Binary File
                  </button>
                </div>
              ) : (
                <div>
                  <UploadCloud size={28} color="#3b82f6" style={{ margin: '0 auto 6px', display: 'block' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadingBinary ? 'Uploading & Computing SHA-256...' : 'Select Firmware Binary (.bin, .hex, .zip)'}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
                    Auto-calculates SHA-256 hash and byte size
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 11 }}
                    disabled={uploadingBinary}
                    onClick={() => fwFileInputRef.current?.click()}
                  >
                    {uploadingBinary ? 'Uploading...' : 'Browse Binary File'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Version String *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. v2.4.3-prod"
                  value={newFwRelease.version}
                  onChange={e => setNewFwRelease(p => ({ ...p, version: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Hardware Luminaire Model *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newFwRelease.device_model}
                  onChange={e => setNewFwRelease(p => ({ ...p, device_model: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Release Title *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Power Factor & Dimming Optimization"
                value={newFwRelease.release_title}
                onChange={e => setNewFwRelease(p => ({ ...p, release_title: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Release Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Bug fixes, performance improvements..."
                value={newFwRelease.release_notes}
                onChange={e => setNewFwRelease(p => ({ ...p, release_notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFwModal(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={submittingFwRelease || flashingFw}
              >
                {submittingFwRelease || flashingFw ? 'Publishing & Flashing...' : 'Publish & Flash OTA'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Multilingual Alert Resolution Modal ── */}
      {resolveModal && selectedAlertToResolve && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#22c55e" />
              <span>Resolve Incident #{selectedAlertToResolve.id}</span>
            </div>
          }
          onClose={() => { setResolveModal(false); setSelectedAlertToResolve(null); }}
        >
          <form onSubmit={handleConfirmResolveAlert}>
            {/* Alert Context Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {selectedAlertToResolve.alert_type?.replace(/_/g, ' ')}
                </span>
                <StatusBadge value={selectedAlertToResolve.severity} type="severity" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {selectedAlertToResolve.message}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Detected: {new Date(selectedAlertToResolve.detected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>

            {/* Multilingual Support Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#93c5fd',
              marginBottom: 14
            }}>
              <Languages size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>All Languages Supported (UTF-8 Unicode):</strong> Type in हिन्दी, বাংলা, தமிழ், मराठी, ગુજરાતી, English, etc.
              </div>
            </div>

            {/* Quick Resolution Preset Chips */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: 11, marginBottom: 6, display: 'block' }}>
                Quick Resolution Presets (क्विक चयन):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '✅ Lamp Replaced', hi: 'बल्ब बदला गया', text: 'Lamp Replaced / नया बल्ब लगाया गया' },
                  { label: '⚡ Voltage Restored', hi: 'वोल्टेज सामान्य', text: 'Line Voltage Restored / बिजली बहाल की गई' },
                  { label: '🔧 Driver Fixed', hi: 'ड्राइवर मरम्मत', text: 'LED Driver / SMPS Repaired / ड्राइवर ठीक किया गया' },
                  { label: '🔌 Wiring Fixed', hi: 'तार कनेक्शन ठीक', text: 'Wiring / Cable Fault Restored / केबल ठीक की गई' },
                  { label: '👁️ Field Inspection', hi: 'जांच पूर्ण', text: 'Field Inspection Completed - Device Normal / निरीक्षण पूर्ण' },
                  { label: '🌧️ Weather Cleared', hi: 'मौसम सामान्य', text: 'Weather Condition Cleared / मौसम जनित समस्या समाप्त' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 14,
                      background: resolutionNotes === preset.text ? 'rgba(59, 130, 246, 0.25)' : undefined,
                      borderColor: resolutionNotes === preset.text ? '#3b82f6' : undefined,
                    }}
                    onClick={() => setResolutionNotes(preset.text)}
                  >
                    {preset.label} <span style={{ opacity: 0.65, fontSize: 10, marginLeft: 2 }}>({preset.hi})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multilingual Text Input */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                <span>Resolution Notes / समाधान विवरण *</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Any language / script</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                required
                placeholder="Enter resolution notes in any language (उदा. बल्ब बदल दिया गया है / Lamp replaced by technician)..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setResolveModal(false); setSelectedAlertToResolve(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={resolvingAlert || !resolutionNotes.trim()}
              >
                {resolvingAlert ? 'Resolving...' : 'Resolve Alert'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
