/**
 * Indian Standard Time (IST - Asia/Kolkata, UTC+5:30) Date & Time Utilities
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date & time in Indian Standard Time (e.g. "21/09/2026, 12:26:18 PM")
 */
export function formatISTDateTime(date, includeSeconds = true) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

/**
 * Format date only in Indian Standard Time (e.g. "21/09/2026")
 */
export function formatISTDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format time only in Indian Standard Time (e.g. "12:26:18 PM IST")
 */
export function formatISTTime(date, withSuffix = true) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return withSuffix ? `${timeStr} IST` : timeStr;
}

/**
 * Relative time ago
 */
export function timeAgo(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return formatISTDate(date);
}
