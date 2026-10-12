const test = require('node:test');
const assert = require('node:assert/strict');
const Exhibit = require('../models/Exhibit');
const { updateExhibit } = require('../controllers/exhibitController');
const { exhibitWindow, exhibitPhase, withExhibitWindow, parseExhibitTimes } = require('../utils/exhibitSchedule');

test('older date-only exhibits remain full-day events in Philippine time', () => {
  const exhibit = { event_date: new Date('2026-10-20T00:00:00.000Z') };
  const result = withExhibitWindow(exhibit);
  assert.equal(result.starts_at.toISOString(), '2026-10-19T16:00:00.000Z');
  assert.equal(result.ends_at.toISOString(), '2026-10-20T15:59:59.999Z');
  assert.equal(result.is_all_day, true);
  assert.equal(exhibit.starts_at, undefined, 'legacy documents must not be changed in place');
  assert.equal(exhibit.ends_at, undefined);
});

test('an exhibit changes from upcoming to current to past at its explicit boundaries', () => {
  const exhibit = {
    event_date: '2026-10-20',
    starts_at: '2026-10-20T09:00:00+08:00',
    ends_at: '2026-10-20T17:00:00+08:00',
  };
  assert.equal(exhibitPhase(exhibit, '2026-10-20T00:59:59Z'), 'upcoming');
  assert.equal(exhibitPhase(exhibit, '2026-10-20T01:00:00Z'), 'current');
  assert.equal(exhibitPhase(exhibit, '2026-10-20T08:59:59Z'), 'current');
  assert.equal(exhibitPhase(exhibit, '2026-10-20T09:00:00Z'), 'past');
});

test('an all-day edit clears explicit times', () => {
  assert.deepEqual(parseExhibitTimes({ event_date: '2026-10-20', starts_at: null, ends_at: null }), { starts_at: null, ends_at: null });
});

test('explicit start and end times override the legacy full-day window', () => {
  const times = parseExhibitTimes({
    event_date: '2026-10-20',
    starts_at: '2026-10-20T09:00:00+08:00',
    ends_at: '2026-10-20T17:00:00+08:00',
  });
  assert.equal(times.error, undefined);
  assert.equal(exhibitWindow({ event_date: '2026-10-20', ...times }).starts_at.toISOString(), '2026-10-20T01:00:00.000Z');
  assert.equal(times.ends_at.toISOString(), '2026-10-20T09:00:00.000Z');
});

test('invalid or incomplete schedules are rejected', () => {
  const base = { event_date: '2026-10-20', starts_at: '2026-10-20T09:00:00+08:00' };
  assert.match(parseExhibitTimes(base).error, /both start and end/i);
  assert.match(parseExhibitTimes({ ...base, ends_at: '2026-10-20T08:00:00+08:00' }).error, /after its start/i);
  assert.match(parseExhibitTimes({ ...base, ends_at: '2026-10-21T10:00:00+08:00' }).error, /exhibit date/i);
  assert.match(parseExhibitTimes({ ...base, ends_at: '2026-10-20T17:00:00' }).error, /timezone/i);
});

test('a date-only edit clears custom times from the old date', async (t) => {
  const exhibit = new Exhibit({
    name: 'Autumn show',
    event_date: new Date('2026-10-20T00:00:00.000Z'),
    starts_at: new Date('2026-10-20T01:00:00.000Z'),
    ends_at: new Date('2026-10-20T09:00:00.000Z'),
  });
  t.mock.method(Exhibit, 'findById', async () => exhibit);
  exhibit.save = async () => exhibit;
  let response;
  await updateExhibit({ params: { id: String(exhibit._id) }, body: { event_date: '2026-10-21' } }, {
    json(data) { response = data; },
  }, (error) => { throw error; });
  assert.equal(exhibit.starts_at, undefined);
  assert.equal(exhibit.ends_at, undefined);
  assert.equal(response.exhibit.starts_at.toISOString(), '2026-10-20T16:00:00.000Z');
});
