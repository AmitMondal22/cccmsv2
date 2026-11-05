# CCMS + DCU Hierarchical Architecture

Add the **CCMS (Central Control & Monitoring Station)** and **DCU (Data Concentrator Unit)** layers to the existing application as a **parallel asset hierarchy** under each Ward. All existing data and features remain completely untouched.

---

## Architecture Being Added

```
PROJECT → CITY → ZONE → WARD ─┬─ STREET → Normal Device (existing, unchanged)
                               └─ CCMS → DCU → Device 01 … Device 50 (NEW)
```

- **CCMS**: Three-phase electrical panel + astronomical/auto scheduler + energy meter
- **DCU**: Downstream communication concentrator, maps up to 50 LED devices
- **Device**: Same existing `Device` model — just given a `dcu_id` link (optional FK)

---

## User Review Required

> [!IMPORTANT]
> The existing `Device` model will receive one **optional** nullable column `dcu_id INTEGER REFERENCES dcus(id)`. Devices without this FK are unchanged "normal" devices. No existing device data is deleted or modified.

> [!NOTE]
> Sequelize's `alter: true` sync will add the column automatically on next backend start. No manual migration script needed.

---

## Open Questions

> [!IMPORTANT]
> **Astronomical Scheduler**: CCMS requires lat/lng for sunrise/sunset calculation. This will be stored on the CCMS record itself (separate from Ward coordinates). Is this correct?

> [!NOTE]
> **CCMS Telemetry**: For Phase 1, CCMS 3-phase readings (V_R, V_Y, V_B, I_R, I_Y, I_B, kWh, kW, PF) will be stored as a separate `CcmsTelemetry` table. The existing `Telemetry` table remains for device-level readings only.

---

## Proposed Changes

### Phase 1 — Backend Models

#### [NEW] [`CCMS.js`](file:///d:/ccms2/backend/src/models/CCMS.js)
Fields:
- `id`, `uid` (unique), `name`
- `ward_id` FK → Ward
- `latitude`, `longitude` (for astronomical scheduling)
- `panel_capacity_kva` (DECIMAL)
- `meter_serial` (STRING)
- `schedule_mode` ENUM(`astronomical`, `manual`, `auto`)
- `on_offset_minutes` (offset from sunset, default 0)
- `off_offset_minutes` (offset from sunrise, default 0)
- `manual_on_time` TIME, `manual_off_time` TIME
- `dim_level` (0–100%, default 100)
- `status` ENUM(`active`, `inactive`, `fault`)
- `connectivity_status` ENUM(`online`, `offline`)
- `last_seen` TIMESTAMP

#### [NEW] [`DCU.js`](file:///d:/ccms2/backend/src/models/DCU.js)
Fields:
- `id`, `uid` (unique), `name`
- `ccms_id` FK → CCMS
- `communication_protocol` ENUM(`DALI`, `0-10V`, `Wireless`, `RS485`)
- `max_devices` (INTEGER, default 50)
- `status` ENUM(`active`, `inactive`, `fault`)
- `connectivity_status` ENUM(`online`, `offline`)
- `last_seen` TIMESTAMP

#### [MODIFY] [`Device.js`](file:///d:/ccms2/backend/src/models/Device.js)
- Add optional nullable `dcu_id INTEGER` field (no `allowNull: false`)
- No other changes

#### [NEW] [`CcmsTelemetry.js`](file:///d:/ccms2/backend/src/models/CcmsTelemetry.js)
Stores 3-phase snapshots from the CCMS energy meter:
- `id`, `ccms_id` FK → CCMS
- `timestamp` TIMESTAMP
- `voltage_r`, `voltage_y`, `voltage_b` DECIMAL
- `current_r`, `current_y`, `current_b` DECIMAL
- `active_power_kw` DECIMAL
- `reactive_power_kvar` DECIMAL
- `power_factor` DECIMAL
- `energy_kwh` DECIMAL (cumulative meter reading)

#### [MODIFY] [`models/index.js`](file:///d:/ccms2/backend/src/models/index.js)
Add imports and associations:
```
Ward → hasMany → CCMS
CCMS → belongsTo → Ward
CCMS → hasMany → DCU
DCU → belongsTo → CCMS
DCU → hasMany → Device (via dcu_id)
Device → belongsTo → DCU (optional)
CCMS → hasMany → CcmsTelemetry
CcmsTelemetry → belongsTo → CCMS
```

---

### Phase 2 — Backend API Routes

#### [NEW] [`ccms.routes.js`](file:///d:/ccms2/backend/src/routes/ccms.routes.js)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ccms` | List all CCMS (filter by `ward_id`) |
| GET | `/api/ccms/:id` | CCMS detail with DCU list |
| POST | `/api/ccms` | Create CCMS |
| PUT | `/api/ccms/:id` | Update CCMS config/schedule |
| DELETE | `/api/ccms/:id` | Deactivate CCMS |
| GET | `/api/ccms/:id/telemetry` | 3-phase energy history |
| GET | `/api/ccms/:id/energy-summary` | Daily/monthly kWh aggregation |
| GET | `/api/ccms/:id/reconciliation` | CCMS meter kWh vs sum of DCU device kWh |

#### [NEW] [`dcu.routes.js`](file:///d:/ccms2/backend/src/routes/dcu.routes.js)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dcu` | List all DCUs (filter by `ccms_id`) |
| GET | `/api/dcu/:id` | DCU detail with mapped devices |
| POST | `/api/dcu` | Create DCU |
| PUT | `/api/dcu/:id` | Update DCU |
| POST | `/api/dcu/:id/map-device` | Assign a `device_id` to this DCU |
| DELETE | `/api/dcu/:id/unmap-device/:deviceId` | Remove device mapping |

#### [MODIFY] [`index.js`](file:///d:/ccms2/backend/src/index.js)
Register two new route prefixes:
```js
await fastify.register(ccmsRoutes, { prefix: '/api/ccms' });
await fastify.register(dcuRoutes,  { prefix: '/api/dcu' });
```

---

### Phase 3 — Frontend Pages

#### [NEW] `src/pages/ccms/CCMSList.jsx`
- Table of all CCMS units (filterable by Ward/Zone/City)
- Columns: Name, Ward, Schedule Mode, Status, Connectivity, DCU Count, Last Seen
- Quick-action buttons: View Detail, Edit Schedule

#### [NEW] `src/pages/ccms/CCMSDetail.jsx`
Tabbed layout:
1. **Overview** — CCMS info card + live 3-phase voltage/current gauges
2. **Schedule** — Astronomical (lat/lng → auto sunrise/sunset display) vs Manual time config
3. **Energy** — Daily kWh chart, monthly aggregation, tariff cost
4. **Reconciliation** — CCMS meter kWh vs Σ(Device kWh). Show variance % and flag discrepancies
5. **DCU List** — All DCUs under this CCMS with connectivity status

#### [NEW] `src/pages/dcu/DCUList.jsx`
- Table of all DCU units (filterable by CCMS)
- Columns: Name, CCMS, Protocol, Device Count / Capacity, Status, Last Seen

#### [NEW] `src/pages/dcu/DCUDetail.jsx`
Tabbed layout:
1. **Overview** — DCU info + communication stats
2. **Devices** — Grid/list of all devices mapped to this DCU with real-time state (online/offline, lamp on/off)
3. **Mapping** — Assign/unassign devices from this DCU (searchable device picker)

---

### Phase 4 — Frontend Navigation

#### [MODIFY] [`Sidebar.jsx`](file:///d:/ccms2/my-react-app/src/components/layout/Sidebar.jsx)
Add a new `CCMS NETWORK` section **after** ORGANIZATION:
```
CCMS NETWORK
  ├── CCMS Stations    → /ccms
  └── DCU Units        → /dcu
```
All existing nav sections remain unchanged.

#### [MODIFY] [`App.jsx`](file:///d:/ccms2/my-react-app/src/App.jsx)
Add routes:
```jsx
<Route path="ccms"           element={<CCMSList />} />
<Route path="ccms/:id"       element={<CCMSDetail />} />
<Route path="dcu"            element={<DCUList />} />
<Route path="dcu/:id"        element={<DCUDetail />} />
```

---

## File Summary

### Backend (New)
| File | Purpose |
|------|---------|
| `models/CCMS.js` | CCMS Sequelize model |
| `models/DCU.js` | DCU Sequelize model |
| `models/CcmsTelemetry.js` | 3-phase energy snapshot model |
| `routes/ccms.routes.js` | All CCMS REST endpoints |
| `routes/dcu.routes.js` | All DCU REST endpoints |

### Backend (Modified)
| File | Change |
|------|--------|
| `models/Device.js` | Add optional `dcu_id` FK |
| `models/index.js` | Import new models + add associations |
| `src/index.js` | Register new route files |

### Frontend (New)
| File | Purpose |
|------|---------|
| `pages/ccms/CCMSList.jsx` | CCMS management list |
| `pages/ccms/CCMSDetail.jsx` | CCMS detail — schedule, energy, reconciliation |
| `pages/dcu/DCUList.jsx` | DCU management list |
| `pages/dcu/DCUDetail.jsx` | DCU detail — devices, mapping |

### Frontend (Modified)
| File | Change |
|------|--------|
| `Sidebar.jsx` | Add CCMS NETWORK nav section |
| `App.jsx` | Add 4 new routes |

---

## Verification Plan

### Automated
- Backend starts cleanly: `node src/index.js` — check that `CCMS`, `DCU`, `ccms_telemetries` tables are auto-created
- API smoke test: `GET /api/ccms`, `GET /api/dcu` return empty arrays (no crash)

### Manual
1. Navigate to **CCMS Stations** in sidebar → see empty list
2. Create a CCMS unit linked to a Ward → verify in DB
3. Create a DCU under the CCMS → verify DCU appears in CCMS Detail tab
4. Map existing device to DCU → device appears in DCU Device grid
5. Verify existing **All Devices**, **Alerts**, **Energy** pages still work normally
