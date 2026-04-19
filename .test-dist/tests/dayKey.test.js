import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogTimestampForDayKey, dayKeyFromDateInTimeZone, formatDayKey, getUtcRangeForDayKey, parseDayKey, resolveSelectedDayKey, } from '../src/server/dayKey.js';
const TIME_ZONE = 'Europe/Berlin';
test('formatDayKey returns stable YYYY-MM-DD keys', () => {
    assert.equal(formatDayKey(2026, 3, 5), '2026-03-05');
});
test('parseDayKey accepts valid calendar dates and rejects invalid ones', () => {
    assert.deepEqual(parseDayKey('2026-04-19'), {
        year: 2026,
        month: 4,
        day: 19,
        key: '2026-04-19',
    });
    assert.throws(() => parseDayKey('2026-02-30'));
    assert.throws(() => parseDayKey('19-04-2026'));
    assert.throws(() => parseDayKey('2026-13-01'));
});
test('dayKeyFromDateInTimeZone maps UTC timestamps into local workout days', () => {
    const utcDate = new Date('2026-04-18T22:30:00.000Z');
    assert.equal(dayKeyFromDateInTimeZone(utcDate, TIME_ZONE), '2026-04-19');
});
test('dayKeyFromDateInTimeZone stays stable across DST boundaries', () => {
    assert.equal(dayKeyFromDateInTimeZone(new Date('2026-03-29T00:30:00.000Z'), TIME_ZONE), '2026-03-29');
    assert.equal(dayKeyFromDateInTimeZone(new Date('2026-10-25T22:30:00.000Z'), TIME_ZONE), '2026-10-25');
});
test('resolveSelectedDayKey preserves valid keys and falls back for invalid input', () => {
    assert.equal(resolveSelectedDayKey('2026-04-19', TIME_ZONE), '2026-04-19');
    assert.match(resolveSelectedDayKey('not-a-day', TIME_ZONE), /^\d{4}-\d{2}-\d{2}$/);
});
test('getUtcRangeForDayKey returns a range that contains same-day local timestamps', () => {
    const { start, end } = getUtcRangeForDayKey('2026-04-19', TIME_ZONE);
    const loggedAt = new Date('2026-04-19T08:15:00.000Z');
    assert.equal(loggedAt >= start, true);
    assert.equal(loggedAt <= end, true);
});
test('createLogTimestampForDayKey keeps the selected local day while copying time-of-day', () => {
    const now = new Date('2026-04-19T18:20:30.456Z');
    const loggedAt = createLogTimestampForDayKey('2026-03-25', TIME_ZONE, now);
    assert.equal(dayKeyFromDateInTimeZone(loggedAt, TIME_ZONE), '2026-03-25');
});
test('getUtcRangeForDayKey spans a full local day during DST changes', () => {
    const spring = getUtcRangeForDayKey('2026-03-29', TIME_ZONE);
    const fall = getUtcRangeForDayKey('2026-10-25', TIME_ZONE);
    assert.equal(dayKeyFromDateInTimeZone(spring.start, TIME_ZONE), '2026-03-29');
    assert.equal(dayKeyFromDateInTimeZone(spring.end, TIME_ZONE), '2026-03-29');
    assert.equal(dayKeyFromDateInTimeZone(fall.start, TIME_ZONE), '2026-10-25');
    assert.equal(dayKeyFromDateInTimeZone(fall.end, TIME_ZONE), '2026-10-25');
});
