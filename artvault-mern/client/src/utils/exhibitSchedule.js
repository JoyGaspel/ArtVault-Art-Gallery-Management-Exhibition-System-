const OFFSET = 8 * 60 * 60 * 1000;

export function exhibitWindow(exhibit) {
  const start = new Date(exhibit?.starts_at);
  const end = new Date(exhibit?.ends_at);
  if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start) return { start, end };
  const day = String(exhibit?.event_date || '').slice(0, 10);
  return { start: new Date(`${day}T00:00:00+08:00`), end: new Date(`${day}T23:59:59.999+08:00`) };
}

export function exhibitPhase(exhibit, now = Date.now()) {
  const { start, end } = exhibitWindow(exhibit);
  if (now < start.getTime()) return 'upcoming';
  if (now >= end.getTime()) return 'past';
  return 'current';
}

export function manilaTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + OFFSET).toISOString().slice(11, 16) : '';
}

export function exhibitScheduleLabel(exhibit) {
  const { start, end } = exhibitWindow(exhibit);
  const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(start);
  if (exhibit?.is_all_day || !exhibit?.starts_at || !exhibit?.ends_at) return `${date} · All day (Philippine time)`;
  const time = (value) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(value);
  return `${date} · ${time(start)}–${time(end)} (Philippine time)`;
}
