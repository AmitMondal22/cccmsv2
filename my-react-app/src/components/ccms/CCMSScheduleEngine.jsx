import { useState, useMemo, useEffect } from 'react';
import {
  Sun, Clock, Power, Save, MapPin, CheckCircle, AlertTriangle,
  Calendar, Zap, ArrowRight, RefreshCw, Check, Info, Sliders
} from 'lucide-react';

// Accurate Solar calculation algorithm based on Latitude, Longitude, and Date
export function calculateSolarTimes(lat, lon, date = new Date(), onOffset = 0, offOffset = 0) {
  const latitude = parseFloat(lat) || 22.5726;
  const longitude = parseFloat(lon) || 88.3639;

  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Solar declination & equation of time
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma);

  const latRad = (latitude * Math.PI) / 180;
  const zenithRad = (90.833 * Math.PI) / 180; // Official solar zenith for sunrise/sunset

  const cosH = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));
  const clampedCosH = Math.max(-1, Math.min(1, cosH));
  const hourAngleDeg = (Math.acos(clampedCosH) * 180) / Math.PI;

  const solarNoonUtcMinutes = 720 - 4 * longitude - eqtime;
  const tzOffsetMinutes = -d.getTimezoneOffset(); // Local timezone offset

  const sunriseMin = solarNoonUtcMinutes - hourAngleDeg * 4 + tzOffsetMinutes;
  const sunsetMin = solarNoonUtcMinutes + hourAngleDeg * 4 + tzOffsetMinutes;

  const formatTime = (minutes) => {
    const totalMinutes = Math.round((minutes + 1440) % 1440);
    const hrs = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mins = String(totalMinutes % 60).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const sunriseStr = formatTime(sunriseMin);
  const sunsetStr = formatTime(sunsetMin);

  const effectiveOnMin = sunsetMin + parseInt(onOffset, 10);
  const effectiveOffMin = sunriseMin + parseInt(offOffset, 10);

  const effectiveOnStr = formatTime(effectiveOnMin);
  const effectiveOffStr = formatTime(effectiveOffMin);

  // Night duration calculation
  let durMin = (effectiveOffMin + 1440 - effectiveOnMin) % 1440;
  const durHours = Math.floor(durMin / 60);
  const durRemainingMin = durMin % 60;
  const durationStr = `${durHours}h ${String(durRemainingMin).padStart(2, '0')}m`;

  return {
    sunrise: sunriseStr,
    sunset: sunsetStr,
    effectiveOn: effectiveOnStr,
    effectiveOff: effectiveOffStr,
    duration: durationStr,
  };
}

export default function CCMSScheduleEngine({
  ccms,
  onSaveSchedule,
  saving = false,
  saveMessage = '',
  phaseStates = { R: true, Y: true, B: true },
  onTogglePhase,
  onMasterToggle,
  executing = false,
}) {
  const [mode, setMode] = useState(ccms?.schedule_mode || 'astronomical');

  // Mode 2: Scheduled Timer state
  const [manualOnTime, setManualOnTime] = useState(ccms?.manual_on_time || '18:30');
  const [manualOffTime, setManualOffTime] = useState(ccms?.manual_off_time || '05:30');

  // Mode 3: Automatic Astronomical state
  const [latitude, setLatitude] = useState(ccms?.latitude || 22.5726);
  const [longitude, setLongitude] = useState(ccms?.longitude || 88.3639);
  const [onOffset, setOnOffset] = useState(ccms?.on_offset_minutes ?? -5);
  const [offOffset, setOffOffset] = useState(ccms?.off_offset_minutes ?? 5);

  useEffect(() => {
    if (ccms) {
      setMode(ccms.schedule_mode || 'astronomical');
      setManualOnTime(ccms.manual_on_time || '18:30');
      setManualOffTime(ccms.manual_off_time || '05:30');
      if (ccms.latitude) setLatitude(ccms.latitude);
      if (ccms.longitude) setLongitude(ccms.longitude);
      setOnOffset(ccms.on_offset_minutes ?? -5);
      setOffOffset(ccms.off_offset_minutes ?? 5);
    }
  }, [ccms]);

  // Real-time Solar calculation for Today
  const todaySolar = useMemo(() => {
    return calculateSolarTimes(latitude, longitude, new Date(), onOffset, offOffset);
  }, [latitude, longitude, onOffset, offOffset]);

  // 7-Day calculated solar forecast timetable
  const weeklyForecast = useMemo(() => {
    const list = [];
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);

      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[targetDate.getDay()];
      const dateStr = `${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}`;

      const solar = calculateSolarTimes(latitude, longitude, targetDate, onOffset, offOffset);

      list.push({
        day: label,
        date: dateStr,
        sunrise: solar.sunrise,
        sunset: solar.sunset,
        effectiveOn: solar.effectiveOn,
        effectiveOff: solar.effectiveOff,
        duration: solar.duration,
      });
    }
    return list;
  }, [latitude, longitude, onOffset, offOffset]);

  // Scheduled Timer duration calculation
  const scheduledDuration = useMemo(() => {
    if (!manualOnTime || !manualOffTime) return '—';
    const [onH, onM] = manualOnTime.split(':').map(Number);
    const [offH, offM] = manualOffTime.split(':').map(Number);
    const onTotal = onH * 60 + onM;
    const offTotal = offH * 60 + offM;
    const diff = (offTotal + 1440 - onTotal) % 1440;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }, [manualOnTime, manualOffTime]);

  const handleApply = () => {
    if (onSaveSchedule) {
      onSaveSchedule({
        mode,
        manual_on_time: manualOnTime,
        manual_off_time: manualOffTime,
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        on_offset_minutes: parseInt(onOffset, 10) || 0,
        off_offset_minutes: parseInt(offOffset, 10) || 0,
      });
    }
  };

  const MODES_CONFIG = [
    {
      id: 'manual',
      title: '1. Manual Mode',
      badge: 'Direct Override',
      subtitle: 'Manual switch ON / OFF directly',
      icon: Power,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.08)',
    },
    {
      id: 'auto',
      title: '2. Scheduled Mode',
      badge: 'Fixed Daily Timers',
      subtitle: 'Daily fixed turn ON and OFF time',
      icon: Clock,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.08)',
    },
    {
      id: 'astronomical',
      title: '3. Automatic Mode',
      badge: 'GPS Solar Clock',
      subtitle: 'Auto turn ON & OFF by Lat / Long',
      icon: Sun,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.08)',
    },
  ];

  const activePhaseCount = ['R', 'Y', 'B'].filter((p) => phaseStates[p]).length;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} style={{ color: 'var(--brand)' }} /> Operating Schedule & Astronomical Engine
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Choose from 3 simple switching modes: Direct Manual, Scheduled Daily Timers, or GPS Automatic Astronomical Solar Clock.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveMessage && (
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 6,
              background: saveMessage.includes('Failed') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              color: saveMessage.includes('Failed') ? '#ef4444' : '#10b981',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Check size={13} /> {saveMessage}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={saving || executing}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontWeight: 700 }}
          >
            <Save size={15} /> {saving ? 'Applying...' : 'Apply & Save Schedule'}
          </button>
        </div>
      </div>

      {/* 3 Mode Selection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {MODES_CONFIG.map((m) => {
          const Icon = m.icon;
          const isSelected = mode === m.id;
          return (
            <div
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                border: `2px solid ${isSelected ? m.color : 'var(--border)'}`,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                background: isSelected ? m.bg : 'var(--bg-secondary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                boxShadow: isSelected ? `0 4px 14px ${m.color}20` : 'none',
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: isSelected ? m.color : 'var(--border)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={20} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isSelected ? m.color : 'var(--text-primary)' }}>
                    {m.title}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: m.color, color: '#fff' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {m.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODE 1: MANUAL DIRECT SWITCHING
      ────────────────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1.5px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Power size={16} /> Direct Manual Mode Active
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Automatic schedules and solar calculations are bypassed. Contactors will directly stay ON or OFF as set below.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {onMasterToggle && (
                <>
                  <button
                    onClick={() => onMasterToggle(true)}
                    disabled={executing}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Power size={13} /> Turn All ON
                  </button>
                  <button
                    onClick={() => onMasterToggle(false)}
                    disabled={executing}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: 'var(--bg-card)',
                      color: '#ef4444',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Power size={13} /> Turn All OFF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Phase Switch Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { phase: 'R', label: 'Phase R (Red)', color: '#ef4444', state: phaseStates.R },
              { phase: 'Y', label: 'Phase Y (Yellow)', color: '#f59e0b', state: phaseStates.Y },
              { phase: 'B', label: 'Phase B (Blue)', color: '#3b82f6', state: phaseStates.B },
            ].map((p) => (
              <div
                key={p.phase}
                style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${p.color}`,
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                    {p.label}
                  </div>
                  <div style={{ fontSize: 11, color: p.state ? '#10b981' : '#ef4444', fontWeight: 700, marginTop: 4 }}>
                    STATUS: {p.state ? 'ACTIVE (ON)' : 'DEACTIVATED (OFF)'}
                  </div>
                </div>

                {onTogglePhase && (
                  <button
                    onClick={() => onTogglePhase(p.phase, !p.state)}
                    disabled={executing}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: p.state ? '#10b981' : 'var(--bg-secondary)',
                      color: p.state ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${p.state ? '#059669' : 'var(--border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Power size={13} />
                    {p.state ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: SCHEDULED TIMER (DAILY FIXED ON & OFF TIME)
      ────────────────────────────────────────────────────────────── */}
      {mode === 'auto' && (
        <div style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1.5px solid rgba(139, 92, 246, 0.2)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <Clock size={16} /> Scheduled Daily Timer Settings
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Set simple daily turn ON and turn OFF times. The station will trigger automatic contactor switching at these exact hours every day.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Power size={14} style={{ color: '#10b981' }} /> Daily Turn ON Time (Evening)
              </label>
              <input
                type="time"
                className="form-control"
                value={manualOnTime}
                onChange={(e) => setManualOnTime(e.target.value)}
                style={{ fontSize: 16, fontWeight: 700, padding: '10px 14px' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Lamps automatically turn ON at this time every evening.
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Power size={14} style={{ color: '#ef4444' }} /> Daily Turn OFF Time (Morning)
              </label>
              <input
                type="time"
                className="form-control"
                value={manualOffTime}
                onChange={(e) => setManualOffTime(e.target.value)}
                style={{ fontSize: 16, fontWeight: 700, padding: '10px 14px' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Lamps automatically turn OFF at this time every morning.
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Active Operating Duration:
              </span>
              <strong style={{ fontSize: 14, color: '#8b5cf6' }}>
                {scheduledDuration} / Night
              </strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Applies across all 3 Phases (R, Y, B) daily
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 3: AUTOMATIC ASTRONOMICAL SOLAR CLOCK (BY LAT/LONG)
      ────────────────────────────────────────────────────────────── */}
      {mode === 'astronomical' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1.5px solid rgba(245, 158, 11, 0.25)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sun size={17} /> Automatic GPS Astronomical Solar Switching Engine
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Automatically computes exact dusk and dawn times daily based on the station's geographical coordinates (Lat/Long).
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(245,158,11,0.15)',
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}>
                <MapPin size={12} /> {latitude}° N, {longitude}° E
              </span>
            </div>
          </div>

          {/* Latitude & Longitude Coordinates Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                GPS Latitude (° N)
              </label>
              <input
                type="number"
                step="any"
                className="form-control"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 22.5726"
                style={{ fontWeight: 700 }}
              />
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                GPS Longitude (° E)
              </label>
              <input
                type="number"
                step="any"
                className="form-control"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 88.3639"
                style={{ fontWeight: 700 }}
              />
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Sunset Turn ON Offset (Mins)
              </label>
              <input
                type="number"
                className="form-control"
                value={onOffset}
                onChange={(e) => setOnOffset(e.target.value)}
                style={{ fontWeight: 700 }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                {onOffset < 0 ? `${Math.abs(onOffset)}m before sunset` : onOffset > 0 ? `+${onOffset}m after sunset` : 'At exact sunset'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Sunrise Turn OFF Offset (Mins)
              </label>
              <input
                type="number"
                className="form-control"
                value={offOffset}
                onChange={(e) => setOffOffset(e.target.value)}
                style={{ fontWeight: 700 }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                {offOffset > 0 ? `+${offOffset}m after sunrise` : offOffset < 0 ? `${Math.abs(offOffset)}m before sunrise` : 'At exact sunrise'}
              </div>
            </div>
          </div>

          {/* Today's Calculated Solar Status Banner */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S SUNSET</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 3 }}>
                {todaySolar.sunset}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CALCULATED TURN ON</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3 }}>
                {todaySolar.effectiveOn}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S SUNRISE</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6', marginTop: 3 }}>
                {todaySolar.sunrise}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CALCULATED TURN OFF</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 3 }}>
                {todaySolar.effectiveOff}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>OPERATING DURATION</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 3 }}>
                {todaySolar.duration}
              </div>
            </div>
          </div>

          {/* 7-Day Calculated Solar Switching Timetable */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
              Calculated 7-Day Solar Forecast & Switching Timetable
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Day & Date</th>
                    <th style={{ padding: '10px 14px' }}>Sunrise</th>
                    <th style={{ padding: '10px 14px' }}>Sunset</th>
                    <th style={{ padding: '10px 14px', color: '#f59e0b' }}>Effective Turn ON</th>
                    <th style={{ padding: '10px 14px', color: '#3b82f6' }}>Effective Turn OFF</th>
                    <th style={{ padding: '10px 14px' }}>Total Operating</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyForecast.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx === 0 ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', fontWeight: idx === 0 ? 800 : 500 }}>
                        {row.day} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({row.date})</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{row.sunrise}</td>
                      <td style={{ padding: '10px 14px' }}>{row.sunset}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#f59e0b' }}>{row.effectiveOn}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#3b82f6' }}>{row.effectiveOff}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
