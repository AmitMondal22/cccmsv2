/**
 * LED Streetlight Intelligent Fault Detection Engine
 *
 * Implements the 8-fault classification matrix (FC-00 to FC-07) based on the
 * CCMS Technical Note: "LED Streetlight Driver & Lamp Failure Detection".
 *
 * Decision logic uses: V (voltage) + I (current) + P (real power) + PF (power factor)
 * combined with the light ON/OFF command state.
 *
 * Fault Codes:
 *   FC-00  Normal Operation
 *   FC-01  Supply / Open Circuit Fault        (ON + V ok + I≈0 + P≈0)
 *   FC-02  LED Load / Partial Fault           (ON + V ok + I < 30% baseline)
 *   FC-03  Driver Overcurrent                 (ON + V ok + I > 130% baseline)
 *   FC-04  Low Power Factor / Degraded Driver (ON + V ok + I near-nominal + PF < 0.7)
 *   FC-05  Under-power / Unexpected Dim       (ON + V ok + I 30-80% baseline)
 *   FC-06  Driver/LED Startup Cycling         (ON + repeated I spikes within 60 s window)
 *   FC-07  Supply Absent / No Voltage         (ON + V ≈ 0)
 *
 * All thresholds are DYNAMIC and per-device, loaded from Device.fault_config (JSONB).
 * System-level defaults are used as fallback if a device has no custom config.
 */

// ─── System-Level Defaults (used when device has no custom fault_config) ──────

const SYSTEM_DEFAULTS = {
  supply_voltage_min:        80,      // V  — below this = FC-07 (no supply)
  open_circuit_current:      0.05,   // A  — I below this with lamp ON = FC-01
  overcurrent_ratio:         1.30,   // ×  — I > baseline × this = FC-03
  led_fault_lower_ratio:     0.30,   // ×  — I < baseline × this = FC-02
  underpowered_upper_ratio:  0.80,   // ×  — I 30–80% of baseline = FC-05
  low_pf_threshold:          0.70,   // PF — below this = FC-04
  baseline_learning_packets: 20,     // n  — packets to establish baseline
  baseline_pf_min:           0.75,   // PF — min PF for a baseline sample
  baseline_current_min:      0.10,   // A  — min I for a baseline sample
  debounce_count:            3,      // n  — consecutive hits before alert fires
  cycling_spike_count:       3,      // n  — spikes in window → FC-06
  cycling_window_ms:         60_000, // ms — startup cycling detection window
};

/**
 * Merge device-level fault_config with system defaults.
 * Device values take priority; any missing key falls back to SYSTEM_DEFAULTS.
 *
 * @param {Object|null|undefined} deviceCfg - Device.fault_config JSONB value
 * @returns {typeof SYSTEM_DEFAULTS}
 */
function resolveConfig(deviceCfg) {
  if (!deviceCfg || typeof deviceCfg !== 'object') return SYSTEM_DEFAULTS;
  return { ...SYSTEM_DEFAULTS, ...deviceCfg };
}

// ─── Per-device In-Memory State ───────────────────────────────────────────────

/**
 * @typedef {Object} DeviceFaultState
 * @property {number}      baselineCurrent    - Learned nominal operating current (A)
 * @property {number}      baselineSamples    - Samples collected for baseline
 * @property {boolean}     baselineReady      - True once baseline is established
 * @property {Object}      debounce           - { 'FC-01': 2, ... } consecutive hit counters
 * @property {number[]}    spikeTimestamps    - Timestamps (ms) of recent startup spikes
 * @property {string|null} activeFaultCode    - Currently active (debounced) fault code
 * @property {number}      clearCount         - Consecutive normal samples (recovery debounce)
 */

/** @type {Map<string, DeviceFaultState>} */
const deviceStateMap = new Map();

/**
 * Return (or initialize) the per-device fault state object.
 * @param {string} uid
 * @returns {DeviceFaultState}
 */
function getDeviceState(uid) {
  if (!deviceStateMap.has(uid)) {
    deviceStateMap.set(uid, {
      baselineCurrent:  0,
      baselineSamples:  0,
      baselineReady:    false,
      debounce:         {},
      spikeTimestamps:  [],
      activeFaultCode:  null,
      clearCount:       0,
    });
  }
  return deviceStateMap.get(uid);
}

// ─── Baseline Learning ────────────────────────────────────────────────────────

/**
 * Update the running EMA baseline for a device using a stable ON-state sample.
 * Uses per-device config for PF minimum and current noise floor.
 *
 * @param {DeviceFaultState} state
 * @param {number} current
 * @param {number} pf
 * @param {typeof SYSTEM_DEFAULTS} cfg  - resolved device config
 */
function learnBaseline(state, current, pf, cfg) {
  if (state.baselineReady) return;
  if (pf < cfg.baseline_pf_min) return;
  if (current < cfg.baseline_current_min) return;

  if (state.baselineSamples === 0) {
    state.baselineCurrent = current;
  } else {
    // Exponential Moving Average  α = 1 / n  (converges to mean)
    const alpha = 1 / (state.baselineSamples + 1);
    state.baselineCurrent = alpha * current + (1 - alpha) * state.baselineCurrent;
  }

  state.baselineSamples++;

  if (state.baselineSamples >= cfg.baseline_learning_packets) {
    state.baselineReady = true;
    console.log(
      `[LED FAULT ENGINE] ✅ Baseline established — ` +
      `Nominal I = ${state.baselineCurrent.toFixed(4)} A ` +
      `(from ${state.baselineSamples} samples, ` +
      `threshold: ${cfg.baseline_learning_packets})`
    );
  }
}

// ─── Startup Cycling Detection ────────────────────────────────────────────────

/**
 * Track current spikes to detect driver/LED restart cycling (FC-06).
 *
 * @param {DeviceFaultState} state
 * @param {number} current
 * @param {number} baseline
 * @param {typeof SYSTEM_DEFAULTS} cfg
 * @returns {boolean}
 */
function detectStartupCycling(state, current, baseline, cfg) {
  const now = Date.now();
  const spikeThreshold = baseline > 0
    ? baseline * cfg.led_fault_lower_ratio
    : cfg.baseline_current_min;

  // A spike = device trying to start (current above noise floor but below normal)
  const isSpiking = current >= spikeThreshold && current < baseline * 0.9;
  if (isSpiking) {
    state.spikeTimestamps.push(now);
  }

  // Prune timestamps outside the rolling window
  state.spikeTimestamps = state.spikeTimestamps.filter(
    (ts) => now - ts <= cfg.cycling_window_ms
  );

  return state.spikeTimestamps.length >= cfg.cycling_spike_count;
}

// ─── Fault Classification ─────────────────────────────────────────────────────

/**
 * Core fault classification — evaluates ONE telemetry sample.
 * All thresholds come from `cfg` (per-device resolved config).
 *
 * @param {DeviceFaultState} state
 * @param {number} lightStatus  - 1 = ON, 0 = OFF
 * @param {number} voltage      - V
 * @param {number} current      - A
 * @param {number} realPower    - W
 * @param {number} pf           - power factor
 * @param {typeof SYSTEM_DEFAULTS} cfg
 * @returns {{ faultCode, faultName, severity, detail } | null}
 */
function classifyFault(state, lightStatus, voltage, current, realPower, pf, cfg) {
  // OFF command → no classification needed
  if (lightStatus !== 1) return null;

  // ── FC-07: Supply Absent / No Voltage ──────────────────────────────────────
  if (voltage < cfg.supply_voltage_min) {
    return {
      faultCode: 'FC-07',
      faultName: 'Supply Absent / No Voltage',
      severity: 'critical',
      detail: `V = ${voltage.toFixed(1)} V (min threshold: ${cfg.supply_voltage_min} V)`,
    };
  }

  // Supply is present — evaluate current/PF

  // ── FC-01: Open Circuit Fault (I ≈ 0) ──────────────────────────────────────
  if (current < cfg.open_circuit_current) {
    return {
      faultCode: 'FC-01',
      faultName: 'Supply / Open Circuit Fault',
      severity: 'critical',
      detail: `Lamp ON but I = ${current.toFixed(4)} A ≈ 0 (driver / fuse / wiring open-circuit)`,
    };
  }

  // ── Baseline-relative checks ────────────────────────────────────────────────
  if (state.baselineReady && state.baselineCurrent > 0) {
    const baseline = state.baselineCurrent;
    const ratio = current / baseline;

    // FC-06: Startup Cycling (check before overcurrent to prioritize it)
    if (detectStartupCycling(state, current, baseline, cfg)) {
      return {
        faultCode: 'FC-06',
        faultName: 'Driver/LED Startup Cycling',
        severity: 'major',
        detail:
          `${state.spikeTimestamps.length} restart spikes detected within ` +
          `${cfg.cycling_window_ms / 1000} s window ` +
          `(threshold: ${cfg.cycling_spike_count} spikes)`,
      };
    }

    // FC-03: Driver Overcurrent
    if (ratio > cfg.overcurrent_ratio) {
      return {
        faultCode: 'FC-03',
        faultName: 'Driver Overcurrent',
        severity: 'critical',
        detail:
          `I = ${current.toFixed(4)} A = ${(ratio * 100).toFixed(0)}% of baseline ` +
          `${baseline.toFixed(4)} A (threshold: ${(cfg.overcurrent_ratio * 100).toFixed(0)}%)`,
      };
    }

    // FC-02: LED Load / Partial Fault (I < lower_ratio × baseline)
    if (ratio < cfg.led_fault_lower_ratio) {
      return {
        faultCode: 'FC-02',
        faultName: 'LED Load / Partial Fault',
        severity: 'major',
        detail:
          `I = ${current.toFixed(4)} A = ${(ratio * 100).toFixed(0)}% of baseline ` +
          `(threshold: >${(cfg.led_fault_lower_ratio * 100).toFixed(0)}%) — LED module or driver standby fault`,
      };
    }

    // FC-05: Under-power / Unexpected Dimming (30–80% of baseline)
    if (ratio >= cfg.led_fault_lower_ratio && ratio < cfg.underpowered_upper_ratio) {
      return {
        faultCode: 'FC-05',
        faultName: 'Under-power / Unexpected Dimming',
        severity: 'warning',
        detail:
          `I = ${current.toFixed(4)} A = ${(ratio * 100).toFixed(0)}% of baseline ` +
          `(expected: ≥${(cfg.underpowered_upper_ratio * 100).toFixed(0)}%)`,
      };
    }

    // FC-04: Low Power Factor / Degraded Driver (I near-nominal but PF degraded)
    if (ratio >= cfg.underpowered_upper_ratio && pf < cfg.low_pf_threshold) {
      return {
        faultCode: 'FC-04',
        faultName: 'Low Power Factor / Degraded Driver',
        severity: 'warning',
        detail:
          `PF = ${pf.toFixed(2)} below threshold ${cfg.low_pf_threshold} ` +
          `— capacitor aging or LED degradation`,
      };
    }

  } else {
    // Baseline not yet ready — only raise hard faults with a fixed threshold
    // FC-03 hard threshold: > 5 A before baseline is known
    if (current > 5.0) {
      return {
        faultCode: 'FC-03',
        faultName: 'Driver Overcurrent (pre-baseline)',
        severity: 'critical',
        detail: `I = ${current.toFixed(4)} A > 5 A hard threshold (baseline not yet established)`,
      };
    }
  }

  // FC-00: Normal operation
  return null;
}

// ─── Public API: Debounced Fault Evaluation ───────────────────────────────────

/**
 * Main entry point — called per telemetry packet from alert.service.js.
 *
 * Runs:
 *  1. Per-device config resolution (from Device.fault_config JSONB)
 *  2. Baseline learning
 *  3. Fault classification
 *  4. Debounce (N consecutive hits before surfacing fault)
 *  5. Recovery debounce (N clean samples before clearing active fault)
 *
 * @param {import('../models/Device.js').default} device - Sequelize Device instance
 * @param {import('../models/Telemetry.js').default} telemetry - Sequelize Telemetry instance
 * @returns {{ faultCode, faultName, severity, detail, isRecovery } | null}
 */
export function evaluateLEDFaults(device, telemetry) {
  const uid = device.uid;
  const state = getDeviceState(uid);

  // ── Resolve per-device config ─────────────────────────────────────────────
  const cfg = resolveConfig(device.fault_config);

  const lightStatus = parseInt(telemetry.light_status) || 0;
  const voltage     = parseFloat(telemetry.voltage)    || 0;
  const current     = parseFloat(telemetry.current)    || 0;
  const realPower   = parseFloat(telemetry.real_power) || 0;
  const pf          = parseFloat(telemetry.pf)         || 0;

  // ── Baseline learning: only while lamp is ON ───────────────────────────────
  if (lightStatus === 1) {
    learnBaseline(state, current, pf, cfg);
  }

  // ── Classify this single sample ────────────────────────────────────────────
  const fault = classifyFault(state, lightStatus, voltage, current, realPower, pf, cfg);

  // ── Debounce logic ─────────────────────────────────────────────────────────
  if (fault) {
    const code = fault.faultCode;

    // Reset counters for all other codes (different fault → restart their count)
    for (const key of Object.keys(state.debounce)) {
      if (key !== code) state.debounce[key] = 0;
    }
    state.debounce[code] = (state.debounce[code] || 0) + 1;
    state.clearCount = 0;

    if (state.debounce[code] >= cfg.debounce_count) {
      if (state.activeFaultCode !== code) {
        state.activeFaultCode = code;
        console.log(
          `[LED FAULT ENGINE] 🔴 FAULT DETECTED: ${code} — ${fault.faultName} ` +
          `on device ${uid} | ${fault.detail}`
        );
        return { ...fault, isRecovery: false };
      }
      // Same fault already active — suppress re-raise
      return null;
    }

    // Still accumulating debounce hits
    console.log(
      `[LED FAULT ENGINE] ⚠️  Fault candidate ${code} ` +
      `(${state.debounce[code]}/${cfg.debounce_count}) on device ${uid}: ${fault.detail}`
    );
    return null;

  } else {
    // ── Normal / OFF sample ───────────────────────────────────────────────────
    const wasActive = state.activeFaultCode;
    state.debounce  = {};
    state.clearCount = (state.clearCount || 0) + 1;

    if (wasActive && state.clearCount >= cfg.debounce_count) {
      state.activeFaultCode = null;
      state.clearCount      = 0;
      state.spikeTimestamps = [];
      console.log(
        `[LED FAULT ENGINE] ✅ FAULT CLEARED: ${wasActive} on device ${uid} — normal operation restored`
      );
      return {
        faultCode: wasActive,
        faultName: 'Fault Cleared',
        severity: 'info',
        detail: 'Normal operating parameters restored',
        isRecovery: true,
      };
    }

    return null;
  }
}

/**
 * Return current in-memory state for a device (for diagnostics/API).
 * @param {string} uid
 */
export function getDeviceFaultState(uid) {
  return deviceStateMap.get(uid) || null;
}

/**
 * Clear and reset the in-memory state for a device.
 * Called after recommission or manual baseline reset.
 * @param {string} uid
 */
export function resetDeviceFaultState(uid) {
  deviceStateMap.delete(uid);
  console.log(`[LED FAULT ENGINE] 🔄 State reset for device ${uid}`);
}

/**
 * Return the resolved config for a device (system defaults merged with device overrides).
 * Useful for exposing via API so the UI can show current effective thresholds.
 * @param {Object|null} deviceFaultConfig - Device.fault_config value from DB
 * @returns {typeof SYSTEM_DEFAULTS}
 */
export function getResolvedConfig(deviceFaultConfig) {
  return resolveConfig(deviceFaultConfig);
}

/**
 * Return the system-level default thresholds.
 * Used by the UI to populate the "Restore Defaults" action.
 * @returns {typeof SYSTEM_DEFAULTS}
 */
export function getSystemDefaults() {
  return { ...SYSTEM_DEFAULTS };
}
