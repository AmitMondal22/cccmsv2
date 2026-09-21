export default function StatusBadge({ value, type }) {
  // type: 'connectivity' | 'light' | 'health' | 'alert_status' | 'severity' | 'ticket_status' | 'priority'
  const resolve = () => {
    const v = String(value || '').toLowerCase().replace(' ', '_');

    if (type === 'connectivity' || type === 'light' || type === 'health') {
      return { cls: `badge badge-${v}`, label: v.toUpperCase() };
    }
    if (type === 'severity') {
      const map = { critical: 'critical', major: 'major', warning: 'warning', info: 'info' };
      return { cls: `badge badge-${map[v] || 'info'}`, label: v.toUpperCase() };
    }
    if (type === 'alert_status' || type === 'ticket_status') {
      const labelMap = {
        open: 'Open', acknowledged: 'Acknowledged', assigned: 'Assigned',
        in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
        auto_recovered: 'Auto Recovered', pending: 'Pending',
      };
      return { cls: `badge badge-${v}`, label: labelMap[v] || v };
    }
    if (type === 'priority') {
      const map = { low: 'info', medium: 'warning', high: 'major', critical: 'critical' };
      return { cls: `badge badge-${map[v] || 'info'}`, label: v.toUpperCase() };
    }
    return { cls: 'badge badge-info', label: v };
  };

  const { cls, label } = resolve();
  return <span className={cls}>{label}</span>;
}
