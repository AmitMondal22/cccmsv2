import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDevices } from '../../api/device.api.js';
import { getCities, getZones, getWards, getStreets } from '../../api/organization.api.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useNavigate } from 'react-router-dom';
import {
  Eye, Wrench, Layers, MapPin, Globe, Building2, Route,
  Crosshair, Zap, Compass, RefreshCw
} from 'lucide-react';

const FILTER_OPTIONS = ['All', 'Online', 'Offline', 'Light ON', 'Light OFF', 'Fault'];

const TILE_PROVIDERS = [
  {
    id: 'satellite',
    name: "Satellite Eye's View",
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  {
    id: 'osm',
    name: 'Street View',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    id: 'dark',
    name: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  {
    id: 'light',
    name: 'Positron Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
];

function getMarkerColor(device) {
  if (device.health_status === 'fault') return '#ef4444';
  if (device.connectivity_status === 'offline') return '#ef4444';
  if (device.connectivity_status === 'warning') return '#f59e0b';
  if (device.light_status === 'on') return '#22c55e';
  return '#64748b';
}

// Generate stylized pin icon for normal map mode
function createPinIcon(device, isSelected) {
  const color = getMarkerColor(device);
  const isFault = device.health_status === 'fault' || device.connectivity_status === 'offline';
  const iconSymbol = device.light_status === 'on' ? '💡' : (isFault ? '⚠️' : '⚡');
  const selectedClass = isSelected ? 'selected' : '';

  const html = `
    <div class="normal-map-pin-wrap ${selectedClass}">
      <div class="normal-map-pin" style="background: ${color}; border-color: ${isSelected ? '#ffffff' : color};">
        <span>${iconSymbol}</span>
      </div>
      <div class="normal-map-pin-point" style="border-top-color: ${color};"></div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-custom-pin',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

// Helper component to programmatically pan/zoom map on selection
function MapController({ targetCenter, targetZoom, bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: true });
    } else if (targetCenter) {
      map.flyTo(targetCenter, targetZoom || 15, { duration: 1.2 });
    }
  }, [targetCenter, targetZoom, bounds, map]);

  return null;
}

export default function GISMonitoring() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [tileLayer, setTileLayer] = useState('satellite'); // Default to Satellite Eye's View mode
  const [markerStyle, setMarkerStyle] = useState('pins'); // 'pins' or 'dots'

  // Hierarchy State
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [streets, setStreets] = useState([]);

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedStreet, setSelectedStreet] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Map Navigation State
  const [mapTarget, setMapTarget] = useState(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [mapBounds, setMapBounds] = useState(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  // Initial Load & Silent Periodic Refresh
  const fetchHierarchy = async () => {
    try {
      const [cityRes, zoneRes, wardRes, streetRes] = await Promise.all([
        getCities(),
        getZones(),
        getWards(),
        getStreets(),
      ]);
      setCities(cityRes.data || []);
      setZones(zoneRes.data || []);
      setWards(wardRes.data || []);
      setStreets(streetRes.data || []);
    } catch (e) {
      console.error('Failed to load hierarchy data', e);
    }
  };

  const fetchDevices = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsSyncing(true);
    try {
      const res = await getDevices({ limit: 500 });
      const devList = res.data.data || [];
      setDevices(devList);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to fetch devices', e);
    }
    if (!silent) setLoading(false);
    setTimeout(() => setIsSyncing(false), 500);
  };

  useEffect(() => {
    fetchHierarchy();
    fetchDevices(false);

    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchDevices(true);
        fetchHierarchy();
      }, 5000); // Live poll every 5s for auto-reflection of seed/database changes
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Filter Zones by selected City
  const filteredZones = useMemo(() => {
    if (!selectedCity) return zones;
    return zones.filter(z => String(z.city_id) === String(selectedCity));
  }, [zones, selectedCity]);

  // Filter Wards by selected Zone
  const filteredWards = useMemo(() => {
    if (!selectedZone) return wards;
    return wards.filter(w => String(w.zone_id) === String(selectedZone));
  }, [wards, selectedZone]);

  // Filter Streets by selected Ward
  const filteredStreets = useMemo(() => {
    if (!selectedWard) return streets;
    return streets.filter(s => String(s.ward_id) === String(selectedWard));
  }, [streets, selectedWard]);

  // Handle City Change
  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setSelectedCity(cityId);
    setSelectedZone('');
    setSelectedWard('');
    setSelectedStreet('');
    setSelectedDeviceId('');

    if (!cityId) {
      resetViewToBounds(devices);
      return;
    }

    const matched = devices.filter(d => String(d.street?.ward?.zone?.city_id) === String(cityId));
    recalculateBounds(matched);
  };

  // Handle Zone Change
  const handleZoneChange = (e) => {
    const zoneId = e.target.value;
    setSelectedZone(zoneId);
    setSelectedWard('');
    setSelectedStreet('');
    setSelectedDeviceId('');

    if (!zoneId) {
      if (selectedCity) {
        const matched = devices.filter(d => String(d.street?.ward?.zone?.city_id) === String(selectedCity));
        recalculateBounds(matched);
      } else {
        resetViewToBounds(devices);
      }
      return;
    }

    const matched = devices.filter(d => String(d.street?.ward?.zone_id) === String(zoneId));
    recalculateBounds(matched);
  };

  // Handle Ward Change
  const handleWardChange = (e) => {
    const wardId = e.target.value;
    setSelectedWard(wardId);
    setSelectedStreet('');
    setSelectedDeviceId('');

    if (!wardId) {
      if (selectedZone) {
        const matched = devices.filter(d => String(d.street?.ward?.zone_id) === String(selectedZone));
        recalculateBounds(matched);
      }
      return;
    }

    const matched = devices.filter(d => String(d.street?.ward_id) === String(wardId));
    recalculateBounds(matched);
  };

  // Handle Street Change
  const handleStreetChange = (e) => {
    const streetId = e.target.value;
    setSelectedStreet(streetId);
    setSelectedDeviceId('');

    if (!streetId) {
      if (selectedWard) {
        const matched = devices.filter(d => String(d.street?.ward_id) === String(selectedWard));
        recalculateBounds(matched);
      }
      return;
    }

    const matched = devices.filter(d => String(d.street_id) === String(streetId));
    recalculateBounds(matched);
  };

  // Handle Single Device Select
  const handleDeviceSelect = (e) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    if (!devId) return;

    const dev = devices.find(d => String(d.id) === String(devId));
    if (dev && dev.latitude && dev.longitude) {
      setMapBounds(null);
      setMapTarget([parseFloat(dev.latitude), parseFloat(dev.longitude)]);
      setMapZoom(18);
    }
  };

  // Recalculate bounds from matched devices
  const recalculateBounds = (devList) => {
    const valid = devList.filter(d => d.latitude && d.longitude);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      setMapBounds(null);
      setMapTarget([parseFloat(valid[0].latitude), parseFloat(valid[0].longitude)]);
      setMapZoom(17);
      return;
    }

    const latLngs = valid.map(d => [parseFloat(d.latitude), parseFloat(d.longitude)]);
    setMapTarget(null);
    setMapBounds(latLngs);
  };

  const resetViewToBounds = (devList) => {
    const valid = devList.filter(d => d.latitude && d.longitude);
    if (valid.length > 0) {
      recalculateBounds(valid);
    } else {
      setMapTarget([22.5726, 88.3639]);
      setMapZoom(14);
    }
  };

  // Filtered devices based on all dropdowns + status pills
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (selectedCity && String(d.street?.ward?.zone?.city_id) !== String(selectedCity)) return false;
      if (selectedZone && String(d.street?.ward?.zone_id) !== String(selectedZone)) return false;
      if (selectedWard && String(d.street?.ward_id) !== String(selectedWard)) return false;
      if (selectedStreet && String(d.street_id) !== String(selectedStreet)) return false;
      if (selectedDeviceId && String(d.id) !== String(selectedDeviceId)) return false;

      if (statusFilter === 'All') return true;
      if (statusFilter === 'Online') return d.connectivity_status === 'online';
      if (statusFilter === 'Offline') return d.connectivity_status === 'offline';
      if (statusFilter === 'Light ON') return d.light_status === 'on';
      if (statusFilter === 'Light OFF') return d.light_status === 'off';
      if (statusFilter === 'Fault') return d.health_status === 'fault';
      return true;
    }).filter(d => d.latitude && d.longitude);
  }, [devices, selectedCity, selectedZone, selectedWard, selectedStreet, selectedDeviceId, statusFilter]);

  // Hierarchy statistics for currently filtered view
  const stats = useMemo(() => {
    const total = filteredDevices.length;
    const online = filteredDevices.filter(d => d.connectivity_status === 'online').length;
    const on = filteredDevices.filter(d => d.light_status === 'on').length;
    const fault = filteredDevices.filter(d => d.health_status === 'fault' || d.connectivity_status === 'offline').length;
    const totalPowerKw = filteredDevices
      .filter(d => d.light_status === 'on')
      .reduce((sum, d) => sum + parseFloat(d.latestState?.real_power || 0), 0) / 1000;

    return { total, online, on, fault, totalPowerKw: totalPowerKw.toFixed(2) };
  }, [filteredDevices]);

  const activeTileConfig = TILE_PROVIDERS.find(t => t.id === tileLayer) || TILE_PROVIDERS[0];
  const initialCenter = [22.5535, 88.3518];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">GIS Monitoring & Eye's View</h1>
          <p className="page-subtitle">
            Interactive satellite and geospatial monitoring with City / Zone / Ward hierarchy
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="map-toolbar">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>
            <Layers size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Map Mode:
          </span>
          {TILE_PROVIDERS.map(t => (
            <button
              key={t.id}
              className={`map-mode-pill ${tileLayer === t.id ? 'active' : ''}`}
              onClick={() => setTileLayer(t.id)}
            >
              {t.name}
            </button>
          ))}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setMarkerStyle(markerStyle === 'pins' ? 'dots' : 'pins')}
            title="Toggle Marker Style"
            style={{ marginLeft: 6 }}
          >
            <MapPin size={13} /> {markerStyle === 'pins' ? 'Pin Markers' : 'Dot Markers'}
          </button>

          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Toggle Real-Time Auto-Refresh (every 5s)"
          >
            <span style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: autoRefresh ? '#22c55e' : '#64748b',
              boxShadow: autoRefresh ? '0 0 6px #22c55e' : 'none',
              marginRight: 2
            }} />
            {autoRefresh ? 'Live Sync ON' : 'Live Sync OFF'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchDevices(false);
              fetchHierarchy();
            }}
            title="Force refresh data now"
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} /> Refresh
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => resetViewToBounds(filteredDevices)}
            title="Fit view to all matching devices"
          >
            <Compass size={13} /> Reset View
          </button>
        </div>
      </div>

      {/* ── Hierarchy Filter Cascade ── */}
      <div className="hierarchy-filter-bar">
        {/* City Filter */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Globe size={12} color="var(--brand)" /> City
          </label>
          <select className="form-select" value={selectedCity} onChange={handleCityChange}>
            <option value="">All Cities</option>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Zone Filter */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={12} color="#a855f7" /> Zone
          </label>
          <select className="form-select" value={selectedZone} onChange={handleZoneChange}>
            <option value="">All Zones</option>
            {filteredZones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        {/* Ward Filter */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={12} color="#f59e0b" /> Ward
          </label>
          <select className="form-select" value={selectedWard} onChange={handleWardChange}>
            <option value="">All Wards</option>
            {filteredWards.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Street Filter */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Route size={12} color="#10b981" /> Street
          </label>
          <select className="form-select" value={selectedStreet} onChange={handleStreetChange}>
            <option value="">All Streets</option>
            {filteredStreets.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Direct Device Select */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Crosshair size={12} color="var(--critical)" /> Device Fly-To
          </label>
          <select className="form-select" value={selectedDeviceId} onChange={handleDeviceSelect}>
            <option value="">Fly to Device...</option>
            {filteredDevices.map(d => (
              <option key={d.id} value={d.id}>{d.uid} - {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Chips & Status Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => (
            <button
              key={f}
              className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Live Hierarchy Metrics */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge badge-online">
            <strong>{stats.online}</strong> / {stats.total} Online
          </span>
          <span className="badge badge-on">
            <strong>{stats.on}</strong> Lights ON
          </span>
          {stats.fault > 0 && (
            <span className="badge badge-fault">
              <strong>{stats.fault}</strong> Fault / Offline
            </span>
          )}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            <Zap size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#f59e0b' }} /> {stats.totalPowerKw} kW Active
          </span>
        </div>
      </div>

      {/* ── Normal Interactive Leaflet Map Container ── */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /> Loading Map Telemetry...</div>
      ) : (
        <div className="map-container" style={{ height: 'calc(100vh - 280px)', minHeight: 520, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
          <MapContainer
            center={initialCenter}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            {/* Tile Layer */}
            <TileLayer
              key={activeTileConfig.id}
              attribution={activeTileConfig.attribution}
              url={activeTileConfig.url}
              maxZoom={19}
            />

            {/* Dynamic View Controller */}
            <MapController targetCenter={mapTarget} targetZoom={mapZoom} bounds={mapBounds} />

            {/* Markers */}
            {filteredDevices.map(device => {
              const markerColor = getMarkerColor(device);
              const isSelected = String(device.id) === String(selectedDeviceId);
              const state = device.latestState;
              const latLng = [parseFloat(device.latitude), parseFloat(device.longitude)];

              if (markerStyle === 'pins') {
                const pinIcon = createPinIcon(device, isSelected);
                return (
                  <Marker
                    key={device.id}
                    position={latLng}
                    icon={pinIcon}
                  >
                    <Popup>
                      <div style={{ minWidth: 230, padding: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{device.uid}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{device.name}</div>
                          </div>
                          <StatusBadge value={device.light_status} type="light" />
                        </div>

                        {/* Location breadcrumb */}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: 4 }}>
                          {device.street?.ward?.zone?.city?.name || 'City'} &rsaquo; {device.street?.ward?.zone?.name || 'Zone'} &rsaquo; {device.street?.ward?.name || 'Ward'}
                        </div>

                        {/* Electrical Readout Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginBottom: 10 }}>
                          <div>Voltage: <strong style={{ color: '#38bdf8' }}>{state?.voltage ?? '—'} V</strong></div>
                          <div>Current: <strong style={{ color: '#22c55e' }}>{state?.current ?? '—'} A</strong></div>
                          <div>Power: <strong style={{ color: '#f97316' }}>{state?.real_power ?? '—'} W</strong></div>
                          <div>PF: <strong style={{ color: 'var(--text-primary)' }}>{state?.pf ?? '—'}</strong></div>
                          <div>Energy: <strong style={{ color: '#a855f7' }}>{state?.kwh ?? '—'} kWh</strong></div>
                          <div>Status: <strong style={{ color: device.connectivity_status === 'online' ? '#22c55e' : '#ef4444' }}>{device.connectivity_status}</strong></div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/devices/${device.id}`)}
                            style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                          >
                            <Eye size={12} /> Diagnostics
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate('/maintenance')}
                            style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                          >
                            <Wrench size={12} /> Ticket
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              }

              return (
                <CircleMarker
                  key={device.id}
                  center={latLng}
                  radius={isSelected ? 11 : 7}
                  pathOptions={{
                    fillColor: markerColor,
                    color: isSelected ? '#ffffff' : markerColor,
                    fillOpacity: 0.95,
                    weight: isSelected ? 3 : 2,
                    opacity: 1,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 230, padding: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{device.uid}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{device.name}</div>
                        </div>
                        <StatusBadge value={device.light_status} type="light" />
                      </div>

                      {/* Location breadcrumb */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: 4 }}>
                        {device.street?.ward?.zone?.city?.name || 'City'} &rsaquo; {device.street?.ward?.zone?.name || 'Zone'} &rsaquo; {device.street?.ward?.name || 'Ward'}
                      </div>

                      {/* Electrical Readout Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginBottom: 10 }}>
                        <div>Voltage: <strong style={{ color: '#38bdf8' }}>{state?.voltage ?? '—'} V</strong></div>
                        <div>Current: <strong style={{ color: '#22c55e' }}>{state?.current ?? '—'} A</strong></div>
                        <div>Power: <strong style={{ color: '#f97316' }}>{state?.real_power ?? '—'} W</strong></div>
                        <div>PF: <strong style={{ color: 'var(--text-primary)' }}>{state?.pf ?? '—'}</strong></div>
                        <div>Energy: <strong style={{ color: '#a855f7' }}>{state?.kwh ?? '—'} kWh</strong></div>
                        <div>Status: <strong style={{ color: device.connectivity_status === 'online' ? '#22c55e' : '#ef4444' }}>{device.connectivity_status}</strong></div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/devices/${device.id}`)}
                          style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                        >
                          <Eye size={12} /> Diagnostics
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate('/maintenance')}
                          style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                        >
                          <Wrench size={12} /> Ticket
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
