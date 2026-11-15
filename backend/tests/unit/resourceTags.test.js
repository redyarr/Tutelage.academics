const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TAG_TYPES, parseTagNames } = require('../../utils/resourceTags');

test('every content table has its own tag key (shared keys mixed up tags across tables)', () => {
  const keys = Object.values(TAG_TYPES);
  assert.equal(new Set(keys).size, keys.length);
  assert.notEqual(TAG_TYPES.Blog, TAG_TYPES.Reading);
  assert.notEqual(TAG_TYPES.EslAudio, TAG_TYPES.Audio);
  assert.notEqual(TAG_TYPES.EslVideo, TAG_TYPES.Video);
});

test('parseTagNames: comma string, array or JSON array; trimmed, deduped ignoring case', () => {
  assert.deepEqual(parseTagNames(' Grammar, grammar ,Vocabulary,,'), ['Grammar', 'Vocabulary']);
  assert.deepEqual(parseTagNames(['a', ' A', 'b']), ['a', 'b']);
  assert.deepEqual(parseTagNames('["x","y"]'), ['x', 'y']);
  assert.equal(parseTagNames('x'.repeat(200))[0].length, 120);
});

test('parseTagNames: "not sent" keeps tags, "" clears them', () => {
  assert.equal(parseTagNames(undefined), undefined);
  assert.equal(parseTagNames(null), undefined);
  assert.deepEqual(parseTagNames(''), []);
  assert.deepEqual(parseTagNames([]), []);
});

const { tagsError, MAX_TAGS } = require('../../middlewares/validateTags');

test('tagsError accepts normal tags in any script, and "" or nothing', () => {
  assert.equal(tagsError('Grammar, Past tense, B1+'), null);
  assert.equal(tagsError(['ڕێزمان', 'قواعد', "Rock 'n' roll"]), null);
  assert.equal(tagsError(''), null);
  assert.equal(tagsError(undefined), null);
});

test('tagsError rejects too long, too many, odd characters and wrong types', () => {
  assert.match(tagsError('x'.repeat(51)), /too long/);
  assert.match(tagsError(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`)), /at most 20/);
  assert.match(tagsError('<script>'), /aren't allowed/);
  assert.match(tagsError({ a: 1 }), /list of names/);
  assert.equal(tagsError('a, A, a'), null); // duplicates collapse to one, not an error
});
