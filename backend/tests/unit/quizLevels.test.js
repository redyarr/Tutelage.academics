const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDistribution, distributionError, levelPlan, distributionTotal } = require('../../utils/quizLevels');

test('normalizeDistribution keeps positive whole counts of known levels', () => {
  assert.deepEqual(normalizeDistribution({ A1: 3, A2: '3', B1: 4, C1: 0 }), { A1: 3, A2: 3, B1: 4 });
  assert.deepEqual(normalizeDistribution('{"B2":2}'), { B2: 2 }); // multipart/JSON string
});

test('an empty split means "no split" (any level)', () => {
  for (const input of [undefined, null, '', {}, { A1: 0 }]) assert.equal(normalizeDistribution(input), null);
});

test('bad splits are rejected', () => {
  for (const input of [{ A0: 1 }, { A1: -1 }, { A1: 1.5 }, { A1: 'x' }, [1, 2]]) {
    assert.throws(() => normalizeDistribution(input), undefined, JSON.stringify(input));
  }
});

test('the split must add up to the section total', () => {
  assert.equal(distributionError({ A1: 3, A2: 3, B1: 4 }, 10), null);
  assert.match(distributionError({ A1: 3, A2: 3 }, 10), /add up to 6 .* has 10/);
  assert.equal(distributionError(null, 10), null);
  assert.equal(distributionTotal({ A1: 3, B1: 4 }), 7);
});

test('levelPlan serves easy to hard regardless of key order', () => {
  assert.deepEqual(levelPlan({ B1: 4, A1: 3, A2: 3 }), [['A1', 3], ['A2', 3], ['B1', 4]]);
  assert.deepEqual(levelPlan(null), []);
});
