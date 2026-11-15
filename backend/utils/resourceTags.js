// ============================================================================
// RESOURCE TAGS: the one place that reads and writes resource_tags
// ============================================================================
// resource_tags is keyed by (resourceType, resourceId), and ids overlap across content tables
// (blog 5 and reading 5 both exist). So every table needs its OWN key here; when Blog shared
// 'reading' and ESL audio/video shared 'audio'/'video', saving one item rewrote another's tags.

const { Op } = require('sequelize');

const TAG_TYPES = {
  Blog: 'blog',
  Reading: 'reading',
  Writing: 'writing',
  Speaking: 'speaking',
  Story: 'story',
  Video: 'video',
  Audio: 'audio', // listening items
  EslVideo: 'esl_video',
  EslAudio: 'esl_audio',
};
const KNOWN = new Set(Object.values(TAG_TYPES));

/**
 * Tag names from a request value: an array, a comma-separated string, or a JSON array string.
 * Trimmed, empty ones dropped, max 120 chars, duplicates removed ignoring case (first spelling
 * wins). Returns undefined when nothing was sent, so "not sent" (keep tags) differs from "" (clear).
 */
function parseTagNames(input) {
  if (input === undefined || input === null) return undefined;
  let raw = input;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { raw = JSON.parse(raw); } catch { /* not JSON: treat as comma list */ }
  }
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set();
  const names = [];
  for (const item of list) {
    const name = String(item ?? '').trim().slice(0, 120);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

const models = () => require('../models'); // lazy: models/index loads controllers' models first

function assertType(type) {
  if (!KNOWN.has(type)) throw new Error(`Unknown tag resource type "${type}"`);
}

/**
 * The Tag rows for `names`, matched ignoring case; missing ones are created under `namespace`
 * (the type that first used them, for /api/tags/namespace/:ns). Safe if two saves race.
 */
async function findOrCreateTags(names, namespace, transaction) {
  if (!names.length) return [];
  const { Tag, sequelize } = models();
  const lower = names.map((n) => n.toLowerCase());
  const find = () =>
    Tag.findAll({ where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), { [Op.in]: lower }), transaction });
  let tags = await find();
  const have = new Set(tags.map((t) => t.name.toLowerCase()));
  const missing = names.filter((n) => !have.has(n.toLowerCase()));
  if (missing.length) {
    await Tag.bulkCreate(missing.map((name) => ({ name, namespace })), { ignoreDuplicates: true, transaction });
    tags = await find();
  }
  return tags;
}

/**
 * Replaces a resource's tags with `names` (any form parseTagNames accepts). An empty list clears
 * them; undefined (not sent) leaves them alone. Runs in `transaction` when given, else its own.
 */
async function setResourceTags(type, resourceId, names, { transaction } = {}) {
  assertType(type);
  const list = parseTagNames(names);
  if (list === undefined) return;
  const { ResourceTag, sequelize } = models();
  const run = async (t) => {
    const tags = await findOrCreateTags(list, type, t);
    const byName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag.id]));
    const tagIds = [...new Set(list.map((n) => byName.get(n.toLowerCase())).filter(Boolean))];
    await ResourceTag.destroy({ where: { resourceType: type, resourceId }, transaction: t });
    if (tagIds.length) {
      await ResourceTag.bulkCreate(tagIds.map((tagId) => ({ resourceType: type, resourceId, tagId })), { transaction: t });
    }
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

/** Tag names of one resource, in the order they were given. */
async function getResourceTags(type, resourceId) {
  assertType(type);
  const { ResourceTag, Tag } = models();
  const rows = await ResourceTag.findAll({
    where: { resourceType: type, resourceId },
    include: [{ model: Tag, as: 'tag', attributes: ['name'] }],
    order: [['id', 'ASC']],
  });
  return rows.map((r) => r.tag?.name).filter(Boolean);
}

/** Ids of this type's resources having ANY of the tags in `query`; null when no tag filter was asked. */
async function resourceIdsWithTags(type, query) {
  assertType(type);
  const names = parseTagNames(query);
  if (!names || !names.length) return null;
  const { Tag, ResourceTag, sequelize } = models(); // reading never creates tags
  const found = await Tag.findAll({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), { [Op.in]: names.map((n) => n.toLowerCase()) }),
    attributes: ['id'],
  });
  if (!found.length) return [];
  const rows = await ResourceTag.findAll({
    where: { resourceType: type, tagId: { [Op.in]: found.map((t) => t.id) } },
    attributes: ['resourceId'],
  });
  return [...new Set(rows.map((r) => r.resourceId))];
}

module.exports = { TAG_TYPES, parseTagNames, setResourceTags, getResourceTags, resourceIdsWithTags };
