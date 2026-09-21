import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Radio, RefreshCw, CheckCircle2, AlertTriangle, ArrowUpCircle,
  Cpu, Plus, Search, Filter, Zap, Rocket, Layers, Activity,
  UploadCloud, FileCode, Download, Check, X
} from 'lucide-react';
import {
  getFirmwareReleases, createFirmwareRelease, uploadFirmwareBinary,
  checkFotaUpdates, getFotaCampaigns, createFotaCampaign, triggerSingleDeviceFota
} from '../../api/fota.api.js';
import { getProjects, getCities, getZones, getWards } from '../../api/organization.api.js';
import Modal from '../../components/common/Modal.jsx';

export default function FotaManagement() {
  const [activeTab, setActiveTab] = useState('devices'); // 'devices' | 'releases' | 'history'
  const [loading, setLoading] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // Hierarchy filter state
  const [projects, setProjects] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'update_available' | 'up_to_date'

  // Data state
  const [updateData, setUpdateData] = useState({ summary: {}, devices: [] });
  const [releases, setReleases] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  // Modals & Action States
  const [releaseModal, setReleaseModal] = useState(false);
  const [uploadingBinary, setUploadingBinary] = useState(false);
  const [uploadedFileMeta, setUploadedFileMeta] = useState(null);
  const fileInputRef = useRef(null);

  const [newRelease, setNewRelease] = useState({
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
  const [submittingRelease, setSubmittingRelease] = useState(false);

  // Action feedback states
  const [updatingDeviceId, setUpdatingDeviceId] = useState(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Organization Hierarchy
  const loadHierarchy = async () => {
    try {
      const [pRes, cRes, zRes, wRes] = await Promise.all([
        getProjects(),
        getCities(),
        getZones(),
        getWards(),
      ]);
      setProjects(pRes.data || []);
      setCities(cRes.data || []);
      setZones(zRes.data || []);
      setWards(wRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReleases = async () => {
    try {
      const res = await getFirmwareReleases();
      setReleases(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const params = {};
      if (selectedProject) params.project_id = selectedProject;
      if (selectedCity) params.city_id = selectedCity;
      if (selectedZone) params.zone_id = selectedZone;
      if (selectedWard) params.ward_id = selectedWard;
      const res = await checkFotaUpdates(params);
      setUpdateData(res.data || { summary: {}, devices: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await getFotaCampaigns();
      setCampaigns(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadHierarchy(),
      fetchReleases(),
      fetchCheckUpdates(),
      fetchCampaigns(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Cascading dropdown filters
  const filteredCities = useMemo(() => {
    if (!selectedProject) return cities;
    return cities.filter(c => c.project_id === parseInt(selectedProject));
  }, [cities, selectedProject]);

  const filteredZones = useMemo(() => {
    if (!selectedCity) return zones;
    return zones.filter(z => z.city_id === parseInt(selectedCity));
  }, [zones, selectedCity]);

  const filteredWards = useMemo(() => {
    if (!selectedZone) return wards;
    return wards.filter(w => w.zone_id === parseInt(selectedZone));
  }, [wards, selectedZone]);

  // Polling for live progress
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCampaigns();
      if (activeTab === 'devices') {
        fetchCheckUpdates();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, selectedProject, selectedCity, selectedZone, selectedWard]);

  // Filtered devices list
  const displayedDevices = useMemo(() => {
    let list = updateData.devices || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.uid.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.ipv6_address.toLowerCase().includes(q) ||
        d.location.street.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'update_available') {
      list = list.filter(d => d.update_available);
    } else if (statusFilter === 'up_to_date') {
      list = list.filter(d => !d.update_available);
    }
    return list;
  }, [updateData.devices, searchQuery, statusFilter]);

  // Handle Binary File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBinary(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadFirmwareBinary(formData);
      const data = res.data;

      // Extract plausible version name from filename (e.g. "SmartLum_v2.4.3-prod.bin" -> "v2.4.3-prod")
      const matchedVer = file.name.match(/v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?/i);
      const extractedVer = matchedVer ? (matchedVer[0].startsWith('v') ? matchedVer[0] : `v${matchedVer[0]}`) : '';

      setUploadedFileMeta({
        name: file.name,
        size: file.size,
        hash: data.checksum_sha256,
        url: data.binary_url,
      });

      setNewRelease(prev => ({
        ...prev,
        version: prev.version || extractedVer || file.name.replace(/\.[^/.]+$/, ''),
        release_title: prev.release_title || `Firmware ${extractedVer || file.name.replace(/\.[^/.]+$/, '')} Release`,
        checksum_sha256: data.checksum_sha256,
        binary_size_bytes: data.binary_size_bytes,
        binary_url: data.binary_url,
      }));

      showToast(`✅ Firmware binary uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to upload firmware binary', true);
    } finally {
      setUploadingBinary(false);
    }
  };

  // Single Device FOTA Update via IPv6
  const handleSingleUpdate = async (device) => {
    setUpdatingDeviceId(device.id);
    try {
      const res = await triggerSingleDeviceFota({
        device_id: device.id,
        firmware_version: updateData.summary?.latest_firmware_version || 'v2.4.2-prod',
      });
      showToast(`⚡ ${device.uid}: Updated to ${res.data.new_version} via IPv6 socket`);
      await fetchCheckUpdates();
      await fetchCampaigns();
    } catch (err) {
      showToast(err.response?.data?.error || `Update failed for ${device.uid}`, true);
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  // Batch Scope Rollout
  const handleBatchUpdate = async () => {
    if (!releases.length) {
      showToast('No firmware release available to deploy', true);
      return;
    }
    setBatchUpdating(true);
    try {
      let scope = 'all';
      let targetId = null;
      let scopeName = 'Entire Fleet';

      if (selectedWard) {
        scope = 'ward';
        targetId = selectedWard;
        scopeName = `Ward ${wards.find(w => w.id === parseInt(selectedWard))?.name || ''}`;
      } else if (selectedZone) {
        scope = 'zone';
        targetId = selectedZone;
        scopeName = `Zone ${zones.find(z => z.id === parseInt(selectedZone))?.name || ''}`;
      } else if (selectedCity) {
        scope = 'city';
        targetId = selectedCity;
        scopeName = `City ${cities.find(c => c.id === parseInt(selectedCity))?.name || ''}`;
      } else if (selectedProject) {
        scope = 'project';
        targetId = selectedProject;
        scopeName = `Project ${projects.find(p => p.id === parseInt(selectedProject))?.name || ''}`;
      }

      const latestFw = releases[0];
      const res = await createFotaCampaign({
        name: `FOTA Update ${latestFw.version} (${scopeName})`,
        firmware_id: latestFw.id,
        target_scope: scope,
        target_id: targetId,
      });

      showToast(`🚀 IPv6 FOTA rollout started for ${res.data?.campaign?.total_devices || 0} fixtures!`);
      await fetchCampaigns();
      await fetchCheckUpdates();
      setActiveTab('history');
    } catch (err) {
      showToast(err.response?.data?.error || 'Rollout failed to start', true);
    } finally {
      setBatchUpdating(false);
    }
  };

  // Create Firmware Release
  const handleCreateRelease = async (e) => {
    e.preventDefault();
    if (!newRelease.version || !newRelease.release_title) {
      showToast('Please fill in version and title', true);
      return;
    }
    setSubmittingRelease(true);
    try {
      await createFirmwareRelease(newRelease);
      showToast(`Firmware release ${newRelease.version} published!`);
      setReleaseModal(false);
      setUploadedFileMeta(null);
      setNewRelease({
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
      await fetchReleases();
      await fetchCheckUpdates();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to publish release', true);
    } finally {
      setSubmittingRelease(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <div>Loading FOTA Manager...</div>
      </div>
    );
  }

  const s = updateData.summary || {};
  const outdatedCount = s.update_available_count || 0;

  return (
    <div>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.isError ? '#ef4444' : '#10b981',
          color: '#ffffff', padding: '10px 18px', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex',
          alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
        }}>
          {toast.isError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={22} color="#4f8ef7" /> FOTA & Firmware Updates
          </h1>
          <p className="page-subtitle">
            Check luminaire firmware versions, upload binaries, and deploy OTA updates over IPv6
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchCheckUpdates}
            disabled={checkingUpdates}
          >
            <RefreshCw size={13} className={checkingUpdates ? 'spin' : ''} />
            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setUploadedFileMeta(null);
              setReleaseModal(true);
            }}
          >
            <Plus size={13} /> Add / Upload Firmware
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(79,142,247,0.12)', color: '#4f8ef7' }}>
            <Cpu size={18} />
          </div>
          <div className="kpi-card-value">{s.total_devices || 0}</div>
          <div className="kpi-card-label">Total Luminaires</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: '#22c55e' }}>{s.up_to_date_count || 0}</div>
          <div className="kpi-card-label">Up to Date</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <ArrowUpCircle size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: '#f59e0b' }}>{outdatedCount}</div>
          <div className="kpi-card-label">Updates Available</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-icon" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
            <Layers size={18} />
          </div>
          <div className="kpi-card-value" style={{ color: '#a855f7', fontSize: 20 }}>
            {s.latest_firmware_version || 'v2.4.2-prod'}
          </div>
          <div className="kpi-card-label">Latest Firmware Release</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <Cpu size={14} style={{ marginRight: 6 }} />
          Luminaires & Update Control ({displayedDevices.length})
        </button>

        <button
          className={`tab ${activeTab === 'releases' ? 'active' : ''}`}
          onClick={() => setActiveTab('releases')}
        >
          <Layers size={14} style={{ marginRight: 6 }} />
          Firmware Versions & Binaries ({releases.length})
        </button>

        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Activity size={14} style={{ marginRight: 6 }} />
          Rollout History ({campaigns.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: LUMINAIRES & DIRECT UPDATE CONTROL
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'devices' && (
        <div>
          {/* Filter Bar & Scope Rollout Banner */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                <Filter size={13} color="var(--brand)" /> Scope:
              </div>

              {/* Project */}
              <select
                className="form-select"
                style={{ width: 140, height: 32, fontSize: 12 }}
                value={selectedProject}
                onChange={e => {
                  setSelectedProject(e.target.value);
                  setSelectedCity('');
                  setSelectedZone('');
                  setSelectedWard('');
                }}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* City */}
              <select
                className="form-select"
                style={{ width: 130, height: 32, fontSize: 12 }}
                value={selectedCity}
                onChange={e => {
                  setSelectedCity(e.target.value);
                  setSelectedZone('');
                  setSelectedWard('');
                }}
              >
                <option value="">All Cities</option>
                {filteredCities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Zone */}
              <select
                className="form-select"
                style={{ width: 130, height: 32, fontSize: 12 }}
                value={selectedZone}
                onChange={e => {
                  setSelectedZone(e.target.value);
                  setSelectedWard('');
                }}
              >
                <option value="">All Zones</option>
                {filteredZones.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>

              {/* Ward */}
              <select
                className="form-select"
                style={{ width: 130, height: 32, fontSize: 12 }}
                value={selectedWard}
                onChange={e => setSelectedWard(e.target.value)}
              >
                <option value="">All Wards</option>
                {filteredWards.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              {/* Status */}
              <select
                className="form-select"
                style={{ width: 150, height: 32, fontSize: 12 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Devices</option>
                <option value="update_available">Update Available ({outdatedCount})</option>
                <option value="up_to_date">Up to Date ({s.up_to_date_count || 0})</option>
              </select>

              {/* Search */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: 26, height: 32, fontSize: 12, width: 170 }}
                    placeholder="Search UID, IPv6..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Batch Rollout Button */}
                {outdatedCount > 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ height: 32, whiteSpace: 'nowrap' }}
                    onClick={handleBatchUpdate}
                    disabled={batchUpdating}
                  >
                    {batchUpdating ? (
                      <><span className="spinner" style={{ width: 12, height: 12 }} /> Updating...</>
                    ) : (
                      <><Rocket size={12} /> Update Outdated ({outdatedCount})</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Simple Devices Table */}
          <div className="card">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>UID / Name</th>
                    <th>Location</th>
                    <th>IPv6 Socket Address</th>
                    <th>Current Version</th>
                    <th>Latest Available</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDevices.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{d.uid}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.name}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{d.location.city} ❯ {d.location.zone}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.location.ward} · {d.location.street}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontFamily: 'monospace', color: '#38bdf8',
                          background: 'rgba(56,189,248,0.08)', padding: '2px 6px', borderRadius: 4
                        }}>
                          {d.ipv6_address}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                          {d.current_version}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#4f8ef7' }}>
                          {d.target_version}
                        </span>
                      </td>
                      <td>
                        {d.update_available ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <ArrowUpCircle size={11} /> UPDATE AVAILABLE
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <CheckCircle2 size={11} /> UP TO DATE
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn ${d.update_available ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handleSingleUpdate(d)}
                          disabled={updatingDeviceId === d.id}
                        >
                          {updatingDeviceId === d.id ? (
                            <><span className="spinner" style={{ width: 10, height: 10 }} /> Sending...</>
                          ) : (
                            <><Zap size={11} /> {d.update_available ? 'Update (IPv6)' : 'Re-verify'}</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayedDevices.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                        No luminaires match the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: FIRMWARE VERSIONS & BINARY FILES
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'releases' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Registered Firmware Releases & Binaries</div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setUploadedFileMeta(null);
                setReleaseModal(true);
              }}
            >
              <Plus size={13} /> Add / Upload Version
            </button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Release Title</th>
                  <th>Hardware Model</th>
                  <th>Size</th>
                  <th>SHA-256 Checksum</th>
                  <th>Status</th>
                  <th>Release Date</th>
                  <th>Binary File</th>
                </tr>
              </thead>
              <tbody>
                {releases.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontFamily: 'monospace' }}>
                        {r.version}
                      </span>
                      {r.is_critical && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          CRITICAL
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.release_title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.release_notes?.slice(0, 70)}...</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.device_model}</td>
                    <td style={{ fontSize: 12 }}>{(r.binary_size_bytes / 1024).toFixed(1)} KB</td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {r.checksum_sha256?.slice(0, 16)}...
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: r.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                        color: r.status === 'active' ? '#22c55e' : '#94a3b8', textTransform: 'uppercase'
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(r.release_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td>
                      {r.binary_url ? (
                        <a
                          href={r.binary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          title="Download Binary File"
                        >
                          <Download size={11} /> Download .bin
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: ROLLOUT HISTORY & LOGS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">FOTA Rollout Deployments</div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Target Scope</th>
                  <th>Progress</th>
                  <th>Updated</th>
                  <th>In Progress</th>
                  <th>Status</th>
                  <th>Started At</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const pct = c.total_devices > 0 ? Math.round((c.updated_devices / c.total_devices) * 100) : 0;
                  const isDone = c.status === 'completed';
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          {c.target_scope}
                        </span>
                      </td>
                      <td style={{ width: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: isDone ? '#22c55e' : '#4f8ef7', transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{c.updated_devices} / {c.total_devices}</td>
                      <td style={{ color: '#38bdf8' }}>{c.in_progress_devices}</td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                          color: isDone ? '#22c55e' : '#f59e0b', textTransform: 'uppercase'
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {c.started_at ? new Date(c.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No FOTA deployment history yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Upload New Firmware Release ── */}
      {releaseModal && (
        <Modal title="Add & Upload Firmware Version Release" onClose={() => setReleaseModal(false)}>
          <form onSubmit={handleCreateRelease}>
            {/* File Upload Box */}
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: '16px 20px',
              textAlign: 'center',
              background: uploadedFileMeta ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)',
              borderColor: uploadedFileMeta ? '#22c55e' : 'var(--border)',
              marginBottom: 16,
            }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".bin,.hex,.zip,.tar,.gz,.elf"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              {uploadedFileMeta ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#22c55e', fontWeight: 700, fontSize: 13 }}>
                    <CheckCircle2 size={18} /> File Uploaded & Verified
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {uploadedFileMeta.name} ({(uploadedFileMeta.size / 1024).toFixed(1)} KB)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                    SHA-256: {uploadedFileMeta.hash?.slice(0, 32)}...
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8, fontSize: 11 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div>
                  <UploadCloud size={32} color="#4f8ef7" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadingBinary ? 'Uploading & Calculating SHA-256 Hash...' : 'Upload Firmware Binary File (.bin, .hex, .zip)'}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 10 }}>
                    Automatically extracts version name, calculates SHA-256 checksum, and computes exact byte size
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={uploadingBinary}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingBinary ? (
                      <><span className="spinner" style={{ width: 12, height: 12 }} /> Uploading File...</>
                    ) : (
                      <><UploadCloud size={13} /> Select Firmware File</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Firmware Version String *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. v2.4.3-prod"
                  value={newRelease.version}
                  onChange={e => setNewRelease(p => ({ ...p, version: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Hardware Luminaire Model *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newRelease.device_model}
                  onChange={e => setNewRelease(p => ({ ...p, device_model: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Release Title *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Dynamic Dimming & Power Factor Tuning"
                value={newRelease.release_title}
                onChange={e => setNewRelease(p => ({ ...p, release_title: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Changelog & Release Notes</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="- Patch description...\n- Bug fixes...\n- IPv6 protocol updates..."
                value={newRelease.release_notes}
                onChange={e => setNewRelease(p => ({ ...p, release_notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">SHA-256 Checksum</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Computed automatically on upload"
                  value={newRelease.checksum_sha256}
                  onChange={e => setNewRelease(p => ({ ...p, checksum_sha256: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Binary Size (Bytes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newRelease.binary_size_bytes}
                  onChange={e => setNewRelease(p => ({ ...p, binary_size_bytes: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Binary Download URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="/uploads/firmware/v2.4.3-prod.bin or https://..."
                value={newRelease.binary_url}
                onChange={e => setNewRelease(p => ({ ...p, binary_url: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                id="is-critical-release"
                checked={newRelease.is_critical}
                onChange={e => setNewRelease(p => ({ ...p, is_critical: e.target.checked }))}
              />
              <label htmlFor="is-critical-release" style={{ fontSize: 13, cursor: 'pointer' }}>
                Mark as Critical Security / Firmware Patch
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReleaseModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingRelease}>
                {submittingRelease ? 'Publishing...' : 'Publish Release'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
