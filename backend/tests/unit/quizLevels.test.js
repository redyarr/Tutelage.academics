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

const { arrangeSection, passageRangeError } = require('../../utils/quizLevels');
const q = (id, level, passageId = null, displayOrder = 0) => ({ id, level, passageId, displayOrder });

test('arrangeSection puts each passage on its own numbers and fills the rest at random', () => {
  const passages = [{ id: 7, startPosition: 1, endPosition: 3 }, { id: 8, startPosition: 6, endPosition: 7 }];
  const questions = [
    q(1, 'B1', 7, 2), q(2, 'B1', 7, 1), q(3, 'B1', 7, 3), q(4, 'A1', 8, 1), q(5, 'A1', 8, 2),
    q(10, 'A1'), q(11, 'A2'), q(12, 'B1'), q(13, 'B2'),
  ];
  for (let run = 0; run < 30; run++) {
    const ids = arrangeSection({ questionCount: 8, passages, questions }).map((x) => x.id);
    assert.equal(ids.length, 8);
    assert.deepEqual(ids.slice(0, 3), [2, 1, 3]); // questions 1-3, by displayOrder
    assert.deepEqual(ids.slice(5, 7), [4, 5]); // questions 6-7
    assert.equal(new Set(ids).size, 8);
  }
});

test('arrangeSection without passages is the old random pick', () => {
  const questions = [q(1, 'A1'), q(2, 'A1'), q(3, 'B1')];
  assert.equal(arrangeSection({ questionCount: 2, questions }).length, 2);
  assert.equal(arrangeSection({ questionCount: 5, questions }).length, 3); // short bank: fewer, never padded
});

test('arrangeSection counts passage questions toward the level split', () => {
  // split A1:2 B1:2; the passage already brings two B1, so the two random places are A1, easy → hard
  const passages = [{ id: 9, startPosition: 3, endPosition: 4 }];
  const questions = [q(1, 'B1', 9, 1), q(2, 'B1', 9, 2), q(3, 'A1'), q(4, 'A1'), q(5, 'B1')];
  const out = arrangeSection({ questionCount: 4, levelDistribution: { A1: 2, B1: 2 }, passages, questions });
  assert.deepEqual(out.map((x) => x.id).slice(2), [1, 2]);
  assert.deepEqual(out.map((x) => x.level), ['A1', 'A1', 'B1', 'B1']);
});

test('arrangeSection leaves out a passage that no longer fits the section', () => {
  const out = arrangeSection({ questionCount: 2, passages: [{ id: 9, startPosition: 2, endPosition: 3 }], questions: [q(1, 'A1', 9), q(2, 'A1')] });
  assert.deepEqual(out.map((x) => x.id), [2]);
});

test('passageRangeError checks bounds and overlaps in plain words', () => {
  const others = [{ title: 'Market day', startPosition: 1, endPosition: 4 }];
  assert.equal(passageRangeError(5, 8, 10, others), null);
  assert.match(passageRangeError(4, 6, 10, others), /1-4 already belong to "Market day"/);
  assert.match(passageRangeError(9, 11, 10, others), /only 10 questions/);
  assert.match(passageRangeError(3, 2, 10), /from question 1 to 4/);
});
