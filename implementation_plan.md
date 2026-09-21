# Techavo Smart Street Light Monitoring & Maintenance System

A full-stack street light monitoring and maintenance platform built with React (Vite) + Fastify + Sequelize ORM + PostgreSQL. The UI references the dark sidebar + KPI card + live map design from the provided screenshot.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Vanilla CSS |
| Backend API | Fastify + Node.js |
| ORM | Sequelize (no Prisma) |
| DB | PostgreSQL |
| UDP Telemetry | Node.js `dgram` IPv6 UDP server on port 9000 |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet |
| Auth | JWT (fastify-jwt) + bcrypt |
| Routing | react-router-dom v6 |
| State | React Context + useState/useEffect |

> [!IMPORTANT]
> No Redis, No Kafka, No Prisma, No MQTT. All real-time updates via polling (WebSocket upgrade can come later).

---

## Open Questions

> [!NOTE]
> I will proceed with sensible defaults for the following. Let me know if you want to change anything:
> - **PostgreSQL connection**: `localhost:5432`, db name `techavo_ccms`, user `postgres`
> - **JWT secret**: randomly generated at startup (you'll configure via `.env`)
> - **UDP telemetry port**: 9000 (IPv4 + IPv6 dual-stack)
> - **Frontend port**: 5173 (Vite default)
> - **Backend port**: 3000

---

## Proposed Changes

### Backend — `d:\ccms2\backend\`

#### [NEW] `package.json`
Fastify, Sequelize, pg, fastify-jwt, bcrypt, nodemailer, dotenv, cors

#### [NEW] `src/index.js`
Fastify app entry point — registers plugins, routes, starts HTTP + UDP servers

#### [NEW] `src/config/database.js`
Sequelize PostgreSQL connection config (from `.env`)

#### [NEW] `src/models/` — Sequelize models

| Model | Key Fields |
|---|---|
| `Project` | id, name, code, client, status |
| `City` | id, project_id, name, state, timezone |
| `Zone` | id, city_id, name, code |
| `Ward` | id, zone_id, name, number |
| `Street` | id, ward_id, name |
| `Device` | id, uid, name, serial, street_id, lat, lng, status, connectivity_status, light_status, health_status |
| `User` | id, name, email, password_hash, role, scope_type, scope_id |
| `Role` | id, name, permissions (JSONB) |
| `DeviceLatestState` | device_id, voltage, current, power, pf, kwh, run_hours, freq, light_status, fault, last_seen |
| `Telemetry` | id, device_id, timestamp, voltage, current, real_power, pf, kwh, run_hours, freq, light_status, relay_status, fault |
| `Alert` | id, device_id, rule_id, severity, status, type, message, detected_at, resolved_at |
| `AlertRule` | id, name, project_id, condition_field, condition_op, condition_value, severity, action_create_ticket, action_email |
| `MaintenanceTicket` | id, device_id, alert_id, status, priority, description, assigned_to, created_at, resolved_at |
| `AuditLog` | id, user_id, action, module, object_id, old_value, new_value, ip, timestamp |
| `Notification` | id, user_id, type, title, message, read, created_at |

#### [NEW] `src/telemetry/udpServer.js`
IPv6 UDP server on port 9000 — validates payload, finds device, updates `DeviceLatestState`, inserts into `Telemetry`, evaluates alert rules, creates alerts/tickets

#### [NEW] `src/routes/` — Fastify route files

| Route File | Endpoints |
|---|---|
| `auth.routes.js` | POST `/auth/login`, POST `/auth/logout`, GET `/auth/me` |
| `dashboard.routes.js` | GET `/dashboard/kpis`, GET `/dashboard/zone-summary` |
| `project.routes.js` | CRUD `/projects` |
| `city.routes.js` | CRUD `/cities` |
| `zone.routes.js` | CRUD `/zones` |
| `ward.routes.js` | CRUD `/wards` |
| `street.routes.js` | CRUD `/streets` |
| `device.routes.js` | CRUD `/devices`, GET `/devices/:id/telemetry`, GET `/devices/:id/diagnostics`, GET `/devices/:id/history` |
| `alert.routes.js` | CRUD alerts + rules |
| `maintenance.routes.js` | CRUD tickets, assign, resolve |
| `energy.routes.js` | GET energy consumption by city/zone/ward/device |
| `report.routes.js` | GET city/zone/ward/device/fault/energy reports |
| `user.routes.js` | CRUD users |
| `audit.routes.js` | GET audit logs |
| `notification.routes.js` | GET/mark-read notifications |

#### [NEW] `src/services/` — Business logic services
`alert.service.js`, `device.service.js`, `maintenance.service.js`, `report.service.js`, `email.service.js`

#### [NEW] `src/middleware/auth.js`
JWT verification + RBAC middleware

#### [NEW] `src/db/migrate.js`
Auto-sync Sequelize models to PostgreSQL (`sequelize.sync()`)

#### [NEW] `src/db/seed.js`
Seed demo data: 1 project, 1 city, 2 zones, 4 wards, 10 streets, 25 devices, 1 super admin user

#### [NEW] `.env.example`
DB connection, JWT secret, email config template

---

### Frontend — `d:\ccms2\my-react-app\`

Complete replacement of the boilerplate with the full application.

#### [NEW/MODIFY] `src/index.css`
Full design system: dark theme, CSS variables (colors, spacing, typography), sidebar layout, card styles, table styles, status badge styles, animation keyframes

#### [NEW/MODIFY] `src/main.jsx`
Add Router wrapper

#### [NEW/MODIFY] `src/App.jsx`
Main router with protected routes, auth check, layout wrapper

#### [NEW] `src/api/` — API client
`client.js` — Axios instance with auth headers + interceptors
`auth.api.js`, `dashboard.api.js`, `device.api.js`, `alert.api.js`, `maintenance.api.js`, `organization.api.js`, `report.api.js`, `user.api.js`

#### [NEW] `src/context/`
`AuthContext.jsx` — user session, login/logout
`FilterContext.jsx` — global filter (project/city/zone/ward/date range)
`NotificationContext.jsx` — notification bell state

#### [NEW] `src/components/layout/`
`Sidebar.jsx` — collapsible dark sidebar with full nav as per spec
`Header.jsx` — top bar with global filter, notifications bell, user menu
`Layout.jsx` — sidebar + header + content area

#### [NEW] `src/components/common/`
`KpiCard.jsx` — animated stat card with icon + trend
`StatusBadge.jsx` — colored pill (Online/Offline/On/Off/Fault/Warning)
`DataTable.jsx` — sortable, filterable table with pagination
`Chart.jsx` — Recharts wrapper (line/bar/area)
`Modal.jsx` — dialog wrapper
`FilterBar.jsx` — hierarchical dropdown filter (Project→City→Zone→Ward)
`DateRangePicker.jsx`
`SearchBar.jsx`
`Pagination.jsx`

#### [NEW] `src/pages/auth/`
`Login.jsx` — dark glassmorphism login page

#### [NEW] `src/pages/dashboard/`
`CommandCenter.jsx` — 9 KPI cards + zone summary table + mini charts

#### [NEW] `src/pages/gis/`
`GISMonitoring.jsx` — Leaflet map with color-coded device markers + popup

#### [NEW] `src/pages/organization/`
`Projects.jsx`, `Cities.jsx`, `Zones.jsx`, `Wards.jsx`, `Streets.jsx`

#### [NEW] `src/pages/devices/`
`DeviceList.jsx` — powerful searchable/filterable device table
`DeviceDetail.jsx` — tabbed detail: Overview, Live Data, History, Alerts, Diagnostics, Maintenance
`LiveMonitoring.jsx` — real-time polling table (auto-refresh every 30s)
`Diagnostics.jsx` — connectivity, electrical, communication, health, telemetry quality panels

#### [NEW] `src/pages/alerts/`
`ActiveAlerts.jsx` — severity-bucketed alert dashboard
`AlertHistory.jsx`
`AlertRules.jsx` — rule builder UI
`AlertConfig.jsx`

#### [NEW] `src/pages/maintenance/`
`Tickets.jsx` — ticket list with status columns (Kanban or table view)
`CreateTicket.jsx`
`MyWork.jsx` — technician view with diagnosis checklist
`MaintenanceHistory.jsx`

#### [NEW] `src/pages/energy/`
`EnergyConsumption.jsx` — daily/weekly/monthly charts
`RunningHours.jsx`

#### [NEW] `src/pages/reports/`
`CityReport.jsx`, `ZoneReport.jsx`, `WardReport.jsx`, `DeviceReport.jsx`, `FaultReport.jsx`, `EnergyReport.jsx`
Each with PDF/Excel/CSV export buttons

#### [NEW] `src/pages/admin/`
`Users.jsx`, `Roles.jsx`, `AuditLogs.jsx`, `SystemSettings.jsx`

#### [NEW] `src/hooks/`
`usePolling.js` — generic polling hook (interval-based data refresh)
`useDeviceStatus.js` — derives online/offline/warning from last_seen
`useAuth.js` — auth context consumer
`useFilters.js` — global filter context consumer

---

## Implementation Order

1. **Backend foundation** — package.json, Fastify app, DB config, Sequelize models, migrate + seed
2. **Auth** — JWT login/logout endpoint, middleware
3. **Telemetry UDP server** — receive + process + store
4. **API routes** — dashboard KPIs, devices, alerts, maintenance, org hierarchy, reports
5. **Frontend design system** — index.css with full dark theme
6. **Frontend layout** — Sidebar, Header, Layout, Auth context
7. **Login page**
8. **Command Center dashboard**
9. **GIS map page**
10. **Device list + Device detail**
11. **Live monitoring**
12. **Alerts + Alert rules**
13. **Maintenance module**
14. **Energy + Reports**
15. **Administration (Users, Audit)**
16. **Polish + connect backend**

---

## Verification Plan

### Automated
- `node src/db/migrate.js` — verifies DB schema creation
- `node src/db/seed.js` — verifies seed data
- Backend: `node src/index.js` — verifies all routes load
- Frontend: `npm run dev` — verifies app starts and renders

### Manual
- Login with seeded super admin credentials
- Navigate all major pages via sidebar
- View Command Center KPIs (populated from seed)
- Open Device Detail for a seeded device
- Check GIS map renders markers
- Create a maintenance ticket
- View alert rules list
