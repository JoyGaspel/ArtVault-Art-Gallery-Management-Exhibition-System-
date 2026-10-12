// Existing exhibits store a date without a time. Treat those dates as full
// Philippine calendar days without changing their stored records.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function validDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDateKey(value) {
  const date = validDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function manilaDateKey(value) {
  const date = validDate(value);
  return date ? new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10) : null;
}

function legacyWindow(eventDate) {
  const day = eventDateKey(eventDate);
  if (!day) return null;
  return {
    starts_at: new Date(`${day}T00:00:00+08:00`),
    ends_at: new Date(`${day}T23:59:59.999+08:00`),
  };
}

function exhibitWindow(exhibit) {
  const start = validDate(exhibit?.starts_at);
  const end = validDate(exhibit?.ends_at);
  if (start && end && end > start) return { starts_at: start, ends_at: end };
  return legacyWindow(exhibit?.event_date);
}

function exhibitPhase(exhibit, now = new Date()) {
  const window = exhibitWindow(exhibit);
  if (!window) return null;
  const current = validDate(now);
  if (!current) return null;
  if (current < window.starts_at) return 'upcoming';
  if (current >= window.ends_at) return 'past';
  return 'current';
}

function withExhibitWindow(exhibit) {
  const window = exhibitWindow(exhibit);
  return window ? { ...exhibit, ...window, is_all_day: !(validDate(exhibit.starts_at) && validDate(exhibit.ends_at)) } : exhibit;
}

function parseExhibitTimes({ event_date, starts_at, ends_at }) {
  if (starts_at === undefined && ends_at === undefined) return { starts_at: undefined, ends_at: undefined };
  if (starts_at === null && ends_at === null) return { starts_at: null, ends_at: null };
  if (typeof starts_at !== 'string' || typeof ends_at !== 'string'
    || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(starts_at)
    || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(ends_at)) {
    return { error: 'Enter both start and end times with a timezone.' };
  }
  const start = validDate(starts_at);
  const end = validDate(ends_at);
  if (!start || !end || end <= start) return { error: 'The exhibit end time must be after its start time.' };
  const day = eventDateKey(event_date);
  if (manilaDateKey(start) !== day || manilaDateKey(end) !== day) {
    return { error: 'Start and end times must be on the exhibit date in Philippine time.' };
  }
  return { starts_at: start, ends_at: end };
}

module.exports = { eventDateKey, exhibitWindow, exhibitPhase, withExhibitWindow, parseExhibitTimes };
