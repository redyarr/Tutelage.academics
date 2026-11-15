// ============================================================================
// VALIDATE TAGS (content create/update routes, after the upload middleware)
// ============================================================================
// Checks `req.body.tags` before the controller saves anything, so a bad tag list is a 400 and
// never a half-saved item. Valid input is normalized to a clean array (trimmed, deduped).

const { parseTagNames } = require('../utils/resourceTags');

const MAX_TAGS = 20;
const MAX_LENGTH = 50;
// letters and digits in any script (English, Kurdish, Arabic, ...), spaces and - _ & ' . + #
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} \-_&'.+#]*$/u;

/** Error message for a tag list, or null when it is fine. Exported for tests. */
function tagsError(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string' && !Array.isArray(input)) return 'Tags must be a list of names.';
  const raw = Array.isArray(input) ? input.map((t) => String(t ?? '').trim()) : String(input).split(',').map((t) => t.trim());
  const tooLong = raw.find((t) => t.length > MAX_LENGTH);
  if (tooLong) return `Tag "${tooLong.slice(0, 20)}…" is too long (max ${MAX_LENGTH} characters).`;
  const bad = raw.find((t) => t && !ALLOWED.test(t));
  if (bad) return `Tag "${bad}" has characters that aren't allowed. Use letters, numbers, spaces and - _ & ' . + #`;
  const names = parseTagNames(input);
  if (names.length > MAX_TAGS) return `Use at most ${MAX_TAGS} tags (got ${names.length}).`;
  return null;
}

function validateTags(req, res, next) {
  const error = tagsError(req.body?.tags);
  if (error) return res.status(400).json({ success: false, message: error });
  if (req.body?.tags !== undefined && req.body.tags !== null) req.body.tags = parseTagNames(req.body.tags);
  next();
}

module.exports = { validateTags, tagsError, MAX_TAGS, MAX_LENGTH };
