import { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, Zap, Lightbulb, Search, Filter,
  Power, CheckCircle, AlertTriangle, ShieldAlert, Cpu, Layers,
  Activity, ArrowRight, Eye, RefreshCw, SlidersHorizontal, Check,
  Radio, BarChart2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PHASE_THEMES = {
  R: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: '#ef4444',
    badge: 'rgba(239, 68, 68, 0.15)',
    name: 'Phase R (Red Line)'
  },
  Y: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: '#f59e0b',
    badge: 'rgba(245, 158, 11, 0.15)',
    name: 'Phase Y (Yellow Line)'
  },
  B: {
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.08)',
    border: '#3b82f6',
    badge: 'rgba(59, 130, 246, 0.15)',
    name: 'Phase B (Blue Line)'
  }
};

export default function CCMSPhaseHierarchy({
  hierarchyData,
  loading = false,
  onRefresh,
  onTogglePhase,
  executing = false
}) {
  const [expandedNodes, setExpandedNodes] = useState({
    root: true,
    'phase-R': true,
    'phase-Y': true,
    'phase-B': true,
    'ckt-R-1': true,
    'ckt-Y-1': true,
    'ckt-B-1': true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('ALL'); // ALL, R, Y, B
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, online, offline, fault
  const [viewMode, setViewMode] = useState('tree'); // tree | matrix

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const expandAll = () => {
    const all = { root: true };
    (hierarchyData?.phases || []).forEach(p => {
      all[`phase-${p.phase}`] = true;
      (p.circuits || []).forEach(c => {
        all[`ckt-${p.phase}-${c.name}`] = true;
      });
    });
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({ root: true });
  };

  const phases = hierarchyData?.phases || [];

  // Filtered devices helper
  const matchesSearch = (dev) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      dev.name?.toLowerCase().includes(q) ||
      dev.uid?.toLowerCase().includes(q) ||
      dev.pole_number?.toLowerCase().includes(q) ||
      dev.dcu_name?.toLowerCase().includes(q)
    );
  };

  const matchesStatus = (dev) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'online') return dev.connectivity_status === 'online';
    if (statusFilter === 'offline') return dev.connectivity_status === 'offline';
    if (statusFilter === 'fault') return dev.health_status === 'fault' || dev.health_status === 'warning';
    return true;
  };

  const filteredPhases = useMemo(() => {
    return phases
      .filter(p => phaseFilter === 'ALL' || p.phase === phaseFilter)
      .map(p => {
        const filteredCircuits = (p.circuits || []).map(c => {
          const filteredDevs = (c.devices || []).filter(d => matchesSearch(d) && matchesStatus(d));
          return {
            ...c,
            devices: filteredDevs,
            matchCount: filteredDevs.length
          };
        }).filter(c => c.devices.length > 0 || !searchQuery);

        const allPhaseDevs = (p.devices || []).filter(d => matchesSearch(d) && matchesStatus(d));

        return {
          ...p,
          circuits: filteredCircuits,
          filteredDevices: allPhaseDevs,
          matchCount: allPhaseDevs.length
        };
      });
  }, [phases, phaseFilter, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading Phase & Device Hierarchy Tree…</span>
      </div>
    );
  }

  const metrics = hierarchyData?.metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Controls & Filter Bar */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {/* Left: Search & Phase Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
          <div className="search-box" style={{ maxWidth: 260, flex: 1 }}>
            <Search size={14} />
            <input
              placeholder="Search pole, device UID, feeder…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'R', 'Y', 'B'].map(p => {
              const theme = p !== 'ALL' ? PHASE_THEMES[p] : null;
              const isSelected = phaseFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPhaseFilter(p)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: isSelected ? (theme ? theme.color : 'var(--brand)') : 'var(--bg-secondary)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? (theme ? theme.color : 'var(--brand)') : 'var(--border)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  {p !== 'ALL' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? '#fff' : theme.color }} />}
                  {p === 'ALL' ? 'All Phases' : `Phase ${p}`}
                </button>
              );
            })}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-control"
            style={{ padding: '6px 10px', fontSize: 12, width: 'auto', minWidth: 120 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
            <option value="fault">Fault / Warning</option>
          </select>
        </div>

        {/* Right: View Mode & Tree Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setViewMode('tree')}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'tree' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'tree' ? 'var(--brand)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: viewMode === 'tree' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Layers size={13} /> Tree View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'matrix' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'matrix' ? 'var(--brand)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: viewMode === 'matrix' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <BarChart2 size={13} /> Phase Matrix
            </button>
          </div>

          {viewMode === 'tree' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={expandAll} style={{ fontSize: 11 }}>
                Expand All
              </button>
              <button className="btn btn-secondary btn-sm" onClick={collapseAll} style={{ fontSize: 11 }}>
                Collapse
              </button>
            </>
          )}

          {onRefresh && (
            <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL NETWORK FIXTURES</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {metrics.total_devices || 36} <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>({metrics.online_devices || 34} Online)</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AGGREGATE LOAD</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {metrics.total_active_power_kw || '8.65'} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kW</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SUMMED PHASE CURRENT</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {metrics.total_current_a || '36.4'} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>A</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE ALARMS / FAULTS</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: metrics.fault_devices > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
            {metrics.fault_devices || 0} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fixtures</span>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE TREE VIEW */}
      {viewMode === 'tree' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          {/* LEVEL 0: ROOT CONTROLLER NODE */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--brand)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => toggleNode('root')}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {expandedNodes.root ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--brand)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={20} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {hierarchyData?.name || 'Main CCMS Controller Panel'}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: hierarchyData?.connectivity_status === 'online' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                      color: hierarchyData?.connectivity_status === 'online' ? '#10b981' : '#64748b'
                    }}>
                      {hierarchyData?.connectivity_status === 'online' ? 'Online Feeder' : 'Offline'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    UID: <strong>{hierarchyData?.uid || 'CCMS-01'}</strong> • Meter: <strong>{hierarchyData?.meter_serial || 'MTR-88219'}</strong> • Mode: <strong style={{ textTransform: 'capitalize' }}>{hierarchyData?.schedule_mode || 'Astronomical'}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Connected Branches</div>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>3 Phases (R, Y, B)</strong>
                </div>
                <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Capacity</div>
                  <strong style={{ fontSize: 14, color: 'var(--brand)' }}>{hierarchyData?.panel_capacity_kva || '45'} kVA</strong>
                </div>
              </div>
            </div>
          </div>

          {/* LEVEL 1: R, Y, B PHASES */}
          {expandedNodes.root && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 24, borderLeft: '2px dashed var(--border)', marginLeft: 16 }}>
              {filteredPhases.map((p) => {
                const theme = PHASE_THEMES[p.phase] || PHASE_THEMES.R;
                const isPhaseExpanded = Boolean(expandedNodes[`phase-${p.phase}`]);

                return (
                  <div
                    key={p.phase}
                    style={{
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: 12,
                      background: 'var(--bg-card)',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Phase Node Header */}
                    <div style={{
                      background: theme.bg,
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      borderBottom: isPhaseExpanded ? `1px solid ${theme.badge}` : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={() => toggleNode(`phase-${p.phase}`)}
                          style={{
                            background: 'var(--bg-card)',
                            border: `1px solid ${theme.border}`,
                            color: theme.color,
                            borderRadius: 6,
                            padding: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {isPhaseExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: theme.color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800
                          }}>
                            {p.phase}
                          </span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: theme.color }}>
                              {theme.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {p.device_count} Connected Streetlights • {p.circuits?.length || 1} Sub-feeders
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Phase Electrical & Contactor State */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                          <span style={{ background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <strong>{p.voltage?.toFixed?.(1) || p.voltage} V</strong>
                          </span>
                          <span style={{ background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <strong>{p.current?.toFixed?.(1) || p.current} A</strong>
                          </span>
                          <span style={{ background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <strong>{p.power_kw?.toFixed?.(2) || p.power_kw} kW</strong>
                          </span>
                          <span style={{ background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            PF: <strong>{p.pf?.toFixed?.(2) || p.pf}</strong>
                          </span>
                        </div>

                        {onTogglePhase && (
                          <button
                            onClick={() => onTogglePhase(p.phase, !p.switch_on)}
                            disabled={executing}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: executing ? 'not-allowed' : 'pointer',
                              background: p.switch_on ? '#10b981' : 'var(--bg-secondary)',
                              color: p.switch_on ? '#fff' : 'var(--text-secondary)',
                              border: `1px solid ${p.switch_on ? '#059669' : 'var(--border)'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <Power size={12} />
                            {p.switch_on ? 'CONTACTOR ON' : 'CONTACTOR OFF'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Phase Children (Circuits / Feeders & Individual Devices) */}
                    {isPhaseExpanded && (
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {p.circuits?.map((c, cIdx) => {
                          const circuitNodeId = `ckt-${p.phase}-${c.name}`;
                          const isCircuitExpanded = Boolean(expandedNodes[circuitNodeId]);

                          return (
                            <div
                              key={cIdx}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                background: 'var(--bg-secondary)',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Circuit Header */}
                              <div
                                onClick={() => toggleNode(circuitNodeId)}
                                style={{
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    {isCircuitExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </span>
                                  <Layers size={14} style={{ color: theme.color }} />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {c.name}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    ({c.devices?.length || 0} Fixtures • {c.total_watts || 0} W load)
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                  <span style={{
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    background: 'rgba(16,185,129,0.12)',
                                    color: '#10b981',
                                    fontWeight: 600
                                  }}>
                                    {c.online_devices} Online
                                  </span>
                                </div>
                              </div>

                              {/* Devices under this circuit */}
                              {isCircuitExpanded && (
                                <div style={{
                                  padding: '10px 14px 14px 14px',
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                  gap: 10,
                                  background: 'var(--bg-card)',
                                  borderTop: '1px solid var(--border)'
                                }}>
                                  {c.devices?.map((dev) => {
                                    const isOnline = dev.connectivity_status === 'online';
                                    const isFault = dev.health_status === 'fault' || dev.health_status === 'warning';
                                    const isLightOn = dev.light_status === 'on';

                                    return (
                                      <div
                                        key={dev.id}
                                        style={{
                                          border: `1px solid ${isFault ? '#ef4444' : 'var(--border)'}`,
                                          borderRadius: 10,
                                          padding: '10px 12px',
                                          background: 'var(--bg-secondary)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between',
                                          gap: 8,
                                          transition: 'transform 0.15s, box-shadow 0.15s'
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: 6,
                                              background: isLightOn ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.12)',
                                              color: isLightOn ? '#f59e0b' : 'var(--text-muted)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              <Lightbulb size={16} />
                                            </div>
                                            <div>
                                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {dev.name}
                                              </div>
                                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                {dev.uid} • Pole: {dev.pole_number}
                                              </div>
                                            </div>
                                          </div>

                                          <span style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            background: isFault ? 'rgba(239,68,68,0.15)' : isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                                            color: isFault ? '#ef4444' : isOnline ? '#10b981' : '#64748b'
                                          }}>
                                            {isFault ? 'Fault' : isOnline ? 'Online' : 'Offline'}
                                          </span>
                                        </div>

                                        {/* Telemetry Chips */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11, background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6 }}>
                                          <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Power</span>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dev.power_w} W</div>
                                          </div>
                                          <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Current</span>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dev.current} A</div>
                                          </div>
                                          <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Dimming</span>
                                            <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{dev.dim_level}%</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: PHASE MATRIX (SIDE BY SIDE R-Y-B BALANCING) */}
      {viewMode === 'matrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {filteredPhases.map((p) => {
            const theme = PHASE_THEMES[p.phase] || PHASE_THEMES.R;
            return (
              <div
                key={p.phase}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderTop: `4px solid ${theme.border}`,
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.color }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: theme.color }}>{theme.name}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: theme.badge, color: theme.color }}>
                    {p.filteredDevices?.length || 0} Fixtures
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, fontSize: 12 }}>
                  <div>Voltage: <strong>{p.voltage} V</strong></div>
                  <div>Current: <strong>{p.current} A</strong></div>
                  <div>Power: <strong>{p.power_kw} kW</strong></div>
                  <div>PF: <strong>{p.pf}</strong></div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  Downstream Fixtures
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                  {p.filteredDevices?.map(dev => (
                    <div
                      key={dev.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dev.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dev.uid} • {dev.dcu_name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: theme.color }}>{dev.power_w} W</div>
                        <div style={{ fontSize: 10, color: dev.connectivity_status === 'online' ? '#10b981' : '#ef4444' }}>
                          {dev.connectivity_status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
