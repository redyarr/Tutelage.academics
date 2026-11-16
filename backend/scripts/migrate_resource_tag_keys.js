// ============================================================================
// MIGRATION: one resource_tags key per content table (+ repair story tags)
// ============================================================================
// Before: Blog shared 'reading', ESL audio shared 'audio' (listening), ESL video shared 'video', so
// items with the same id in two tables overwrote each other's tags. Stories kept their tags only in
// stories.tags, which the pages don't read. This script:
//   1. adds 'blog', 'esl_video', 'esl_audio' to the resourceType enum;
//   2. moves rows that can only belong to the other table (its id exists there and not in the
//      owner table) to their own key; ids existing in both stay with the original owner
//      (readings/audios/videos), because those rows match the owners' own tags;
//   3. copies tags from stories.tags / esl_videos.tags into resource_tags where an item has none.
// Dry run by default; pass --apply to write. Safe to run twice.
// Usage: node scripts/migrate_resource_tag_keys.js [--apply]

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../models');
const { TAG_TYPES, setResourceTags } = require('../utils/resourceTags');

const APPLY = process.argv.includes('--apply');
const q = async (sql) => (await sequelize.query(sql))[0];

// [old shared key, owner table, other table, other table's own key]
const SHARED = [
  ['reading', 'readings', 'blogs', TAG_TYPES.Blog],
  ['audio', 'audios', 'esl_audios', TAG_TYPES.EslAudio],
  ['video', 'videos', 'esl_videos', TAG_TYPES.EslVideo],
];
// [table with a tags array column, its key]
const COLUMN_TAGS = [
  ['stories', TAG_TYPES.Story],
  ['esl_videos', TAG_TYPES.EslVideo],
];

async function main() {
  console.log(APPLY ? '✍️  APPLY mode' : '🔍 DRY RUN (pass --apply to write)');

  const labels = (await q(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'enum_resource_tags_resourceType'`)).map((r) => r.enumlabel);
  for (const key of [TAG_TYPES.Blog, TAG_TYPES.EslAudio, TAG_TYPES.EslVideo]) {
    if (labels.includes(key)) continue;
    console.log(`• enum: add '${key}'`);
    // ADD VALUE can't be used in the transaction that adds it, so it runs on its own
    if (APPLY) await q(`ALTER TYPE "enum_resource_tags_resourceType" ADD VALUE IF NOT EXISTS '${key}'`);
  }

  for (const [oldKey, owner, other, newKey] of SHARED) {
    const rows = await q(`
      SELECT rt.id, rt."resourceId" FROM resource_tags rt
      WHERE rt."resourceType" = '${oldKey}'
        AND EXISTS (SELECT 1 FROM ${other} o WHERE o.id = rt."resourceId")
        AND NOT EXISTS (SELECT 1 FROM ${owner} w WHERE w.id = rt."resourceId")`);
    console.log(`• ${oldKey}: ${rows.length} row(s) belong only to ${other} → '${newKey}'`);
    if (APPLY && rows.length) {
      await q(`UPDATE resource_tags SET "resourceType" = '${newKey}' WHERE id IN (${rows.map((r) => r.id).join(',')})`);
    }
  }

  // Ids in BOTH readings and blogs: readings keep their real tags in readings.tags, so a shared
  // 'reading' row whose tag is not in that column was written by the blog with the same id.
  const mixed = await q(`
    SELECT rt.id, rt."resourceId", t.name FROM resource_tags rt
    JOIN tags t ON t.id = rt."tagId"
    JOIN readings r ON r.id = rt."resourceId"
    WHERE rt."resourceType" = 'reading'
      AND EXISTS (SELECT 1 FROM blogs b WHERE b.id = rt."resourceId")
      AND NOT (lower(t.name) = ANY (SELECT lower(x) FROM unnest(coalesce(r.tags, '{}')) x))`);
  console.log(`• reading: ${mixed.length} row(s) on ids shared with blogs are not in readings.tags → '${TAG_TYPES.Blog}'` +
    (mixed.length ? ` (${mixed.map((m) => `#${m.resourceId} "${m.name}"`).join(', ')})` : ''));
  if (APPLY && mixed.length) {
    await q(`UPDATE resource_tags SET "resourceType" = '${TAG_TYPES.Blog}' WHERE id IN (${mixed.map((m) => m.id).join(',')})`);
  }

  for (const [table, key] of COLUMN_TAGS) {
    const rows = await q(`
      SELECT x.id, x.tags FROM ${table} x
      WHERE x.tags IS NOT NULL AND array_length(x.tags, 1) > 0
        AND NOT EXISTS (SELECT 1 FROM resource_tags rt WHERE rt."resourceType"::text = '${key}' AND rt."resourceId" = x.id)`);
    console.log(`• ${table}: ${rows.length} item(s) have tags only in ${table}.tags → copy to '${key}'`);
    if (APPLY) for (const row of rows) await setResourceTags(key, row.id, row.tags);
  }

  console.log(APPLY ? '✅ Done' : '✅ Dry run finished, nothing written');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
