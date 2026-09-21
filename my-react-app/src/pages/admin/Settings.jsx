import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Settings as SettingsIcon, Sun, Moon, Zap, Shield, Save, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { theme, setTheme } = useTheme() || { theme: 'dark', setTheme: () => {} };
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    overvoltage: 255,
    undervoltage: 190,
    overcurrent: 2.0,
    minPf: 0.85,
    offlineTimeoutMin: 5,
    energyTariffInr: 7.50,
    carbonFactor: 0.82,
    autoTicketOnCritical: true,
  });

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings & Thresholds</h1>
          <p className="page-subtitle">Configure CCMS platform parameters, theme preferences, and global thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} /> Save Configuration
        </button>
      </div>

      {saved && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '12px 16px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Settings saved successfully!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Appearance & Theme Settings */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Theme & Appearance</div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label className="form-label">UI Theme Preference</label>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <button
                  type="button"
                  className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTheme('dark')}
                  style={{ flex: 1, padding: 12, justifyContent: 'center' }}
                >
                  <Moon size={16} /> Dark Mode (Default)
                </button>
                <button
                  type="button"
                  className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTheme('light')}
                  style={{ flex: 1, padding: 12, justifyContent: 'center' }}
                >
                  <Sun size={16} style={{ color: '#f59e0b' }} /> Light Mode
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Electrical Thresholds */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Default Electrical Fault Thresholds</div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Overvoltage Threshold (V)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.overvoltage}
                  onChange={e => setSettings(p => ({ ...p, overvoltage: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Undervoltage Threshold (V)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.undervoltage}
                  onChange={e => setSettings(p => ({ ...p, undervoltage: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Overcurrent Limit (A)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={settings.overcurrent}
                  onChange={e => setSettings(p => ({ ...p, overcurrent: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Min Power Factor (PF)</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-input"
                  value={settings.minPf}
                  onChange={e => setSettings(p => ({ ...p, minPf: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Energy & Tariff Calculation Parameters */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Energy Tariff & Environmental Factors</div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Commercial Tariff (₹ / kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={settings.energyTariffInr}
                  onChange={e => setSettings(p => ({ ...p, energyTariffInr: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Grid CO2 Factor (kg CO2 / kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={settings.carbonFactor}
                  onChange={e => setSettings(p => ({ ...p, carbonFactor: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.autoTicketOnCritical}
                  onChange={e => setSettings(p => ({ ...p, autoTicketOnCritical: e.target.checked }))}
                />
                Automatically dispatch maintenance tickets on critical threshold breaches
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
