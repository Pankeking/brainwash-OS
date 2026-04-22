import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBodyMetricProgressStats } from '../src/server/bodyMetrics.stats.js';
test('buildBodyMetricProgressStats groups weekly and monthly buckets relative to the selected day', () => {
    const stats = buildBodyMetricProgressStats('2026-04-22', [
        { dayKey: '2026-04-21', value: 82.4, loggedAt: '2026-04-21T08:00:00.000Z' },
        { dayKey: '2026-04-20', value: 82.1, loggedAt: '2026-04-20T08:00:00.000Z' },
        { dayKey: '2026-04-14', value: 81.8, loggedAt: '2026-04-14T08:00:00.000Z' },
        { dayKey: '2026-03-15', value: 80.5, loggedAt: '2026-03-15T08:00:00.000Z' },
    ]);
    assert.deepEqual(stats.weekly, [
        { label: 'Week 1', low: 82.1, avg: 82.25, high: 82.4 },
        { label: 'Week 2', low: 81.8, avg: 81.8, high: 81.8 },
        { label: 'Week 7', low: 80.5, avg: 80.5, high: 80.5 },
    ]);
    assert.deepEqual(stats.monthly, [
        { label: 'Month 1', low: 81.8, avg: 82.1, high: 82.4 },
        { label: 'Month 2', low: 80.5, avg: 80.5, high: 80.5 },
    ]);
});
test('buildBodyMetricProgressStats returns extrema and first/last recorded points with dates', () => {
    const stats = buildBodyMetricProgressStats('2026-04-22', [
        { dayKey: '2026-04-22', value: 34.5, loggedAt: '2026-04-22T18:00:00.000Z' },
        { dayKey: '2026-04-20', value: 35.1, loggedAt: '2026-04-20T08:00:00.000Z' },
        { dayKey: '2026-04-18', value: 33.9, loggedAt: '2026-04-18T07:00:00.000Z' },
    ]);
    assert.deepEqual(stats.overallHigh, {
        value: 35.1,
        loggedAt: '2026-04-20T08:00:00.000Z',
    });
    assert.deepEqual(stats.overallLow, {
        value: 33.9,
        loggedAt: '2026-04-18T07:00:00.000Z',
    });
    assert.deepEqual(stats.firstRecorded, {
        value: 33.9,
        loggedAt: '2026-04-18T07:00:00.000Z',
    });
    assert.deepEqual(stats.lastRecorded, {
        value: 34.5,
        loggedAt: '2026-04-22T18:00:00.000Z',
    });
});
