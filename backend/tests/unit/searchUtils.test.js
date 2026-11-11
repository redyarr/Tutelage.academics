const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { tokenizeQuery, buildAnyWordWhere } = require('../../utils/searchUtils');

test('tokenizeQuery lowercases, strips symbols, drops short tokens and dedupes', () => {
  assert.deepEqual(
    tokenizeQuery('English for Adults!! grammar & writing a english'),
    ['english', 'for', 'adults', 'grammar', 'writing'],
  );
});

test('tokenizeQuery handles empty input and caps at 10 tokens', () => {
  assert.deepEqual(tokenizeQuery(''), []);
  assert.deepEqual(tokenizeQuery(null), []);
  const many = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
  assert.equal(tokenizeQuery(many).length, 10);
});

test('buildAnyWordWhere ORs every word against every field', () => {
  const where = buildAnyWordWhere(['english', 'grammar'], ['title', 'description']);
  assert.equal(where[Op.or].length, 4);
  assert.deepEqual(where[Op.or][0], { title: { [Op.iLike]: '%english%' } });
});

test('buildAnyWordWhere with no words matches everything', () => {
  assert.deepEqual(buildAnyWordWhere([], ['title']), { [Op.and]: [] });
});
