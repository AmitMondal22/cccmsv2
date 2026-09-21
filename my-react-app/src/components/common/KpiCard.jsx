export default function KpiCard({ icon: Icon, label, value, sub, gradient, iconBg, iconColor }) {
  return (
    <div className="kpi-card" style={{ '--grad': gradient }}>
      <div className="kpi-card-icon" style={{ '--icon-bg': iconBg, '--icon-color': iconColor }}>
        {Icon && <Icon size={18} />}
      </div>
      <div className="kpi-card-value">{value ?? '—'}</div>
      <div className="kpi-card-label">{label}</div>
      {sub && <div className="kpi-card-sub">{sub}</div>}
    </div>
  );
}
