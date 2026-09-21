import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { FilterProvider } from './context/FilterContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Layout from './components/layout/Layout.jsx';
import Login from './pages/auth/Login.jsx';
import CommandCenter from './pages/dashboard/CommandCenter.jsx';
import GISMonitoring from './pages/gis/GISMonitoring.jsx';
import DeviceList from './pages/devices/DeviceList.jsx';
import DeviceDetail from './pages/devices/DeviceDetail.jsx';
import LiveMonitoring from './pages/devices/LiveMonitoring.jsx';
import DeviceDiagnostics from './pages/devices/DeviceDiagnostics.jsx';
import FotaManagement from './pages/fota/FotaManagement.jsx';
import ActiveAlerts from './pages/alerts/ActiveAlerts.jsx';
import AlertRules from './pages/alerts/AlertRules.jsx';
import EnergyConsumption from './pages/energy/EnergyConsumption.jsx';
import RunningHours from './pages/energy/RunningHours.jsx';
import Tickets from './pages/maintenance/Tickets.jsx';
import MyWork from './pages/maintenance/MyWork.jsx';
import MaintenanceHistory from './pages/maintenance/MaintenanceHistory.jsx';
import Reports from './pages/reports/Reports.jsx';
import Users from './pages/admin/Users.jsx';
import AuditLogs from './pages/admin/AuditLogs.jsx';
import Settings from './pages/admin/Settings.jsx';
import Projects from './pages/organization/Projects.jsx';
import Cities from './pages/organization/Cities.jsx';
import Zones from './pages/organization/Zones.jsx';
import Wards from './pages/organization/Wards.jsx';
import Streets from './pages/organization/Streets.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading Techavo CCMS...</div>
        </div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <FilterProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />

              {/* Protected */}
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                {/* Dashboard */}
                <Route index element={<CommandCenter />} />

                {/* GIS */}
                <Route path="gis" element={<GISMonitoring />} />

                {/* Organization */}
                <Route path="org/projects" element={<Projects />} />
                <Route path="org/cities"   element={<Cities />} />
                <Route path="org/zones"    element={<Zones />} />
                <Route path="org/wards"    element={<Wards />} />
                <Route path="org/streets"  element={<Streets />} />

                {/* Devices */}
                <Route path="devices" element={<DeviceList />} />
                <Route path="devices/live" element={<LiveMonitoring />} />
                <Route path="devices/diag" element={<DeviceDiagnostics />} />
                <Route path="devices/:id" element={<DeviceDetail />} />
                <Route path="fota" element={<FotaManagement />} />
                <Route path="devices/fota" element={<FotaManagement />} />

                {/* Alerts */}
                <Route path="alerts" element={<ActiveAlerts />} />
                <Route path="alert-rules" element={<AlertRules />} />

                {/* Energy */}
                <Route path="energy" element={<EnergyConsumption />} />
                <Route path="run-hours" element={<RunningHours />} />

                {/* Maintenance */}
                <Route path="maintenance" element={<Tickets />} />
                <Route path="maintenance/my-work" element={<MyWork />} />
                <Route path="maintenance/history" element={<MaintenanceHistory />} />

                {/* Reports */}
                <Route path="reports"        element={<Reports defaultType="telemetry" />} />
                <Route path="reports/city"   element={<Reports defaultType="city" />} />
                <Route path="reports/zone"   element={<Reports defaultType="zone" />} />
                <Route path="reports/ward"   element={<Reports defaultType="ward" />} />
                <Route path="reports/device" element={<Reports defaultType="device_summary" />} />
                <Route path="reports/fault"  element={<Reports defaultType="fault" />} />

                {/* Administration */}
                <Route path="admin/users"    element={<Users />} />
                <Route path="admin/audit"    element={<AuditLogs />} />
                <Route path="admin/settings" element={<Settings />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
