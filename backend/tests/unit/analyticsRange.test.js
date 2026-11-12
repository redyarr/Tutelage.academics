const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rangeFrom } = require('../../controllers/websiteAnalyticsController');

test('an explicit from/to range wins over ?days', () => {
  assert.deepEqual(rangeFrom({ from: '2026-01-01', to: '2026-01-31', days: '7' }, '7daysAgo'), {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
});

test('falls back to the days-based start when from/to are missing, malformed, impossible or reversed', () => {
  const fallback = { startDate: '30daysAgo', endDate: 'today' };
  for (const query of [
    {},
    { from: '2026-01-01' },
    { from: '01/01/2026', to: '2026-01-31' },
    { from: '2026-13-01', to: '2026-13-05' },
    { from: '2026-02-10', to: '2026-02-01' },
    { from: "2026-01-01' OR 1=1", to: '2026-01-31' },
  ]) {
    assert.deepEqual(rangeFrom(query, '30daysAgo'), fallback, JSON.stringify(query));
  }
});
