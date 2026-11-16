// ============================================================================
// SCHEMA CHECK (read-only): what the code's models expect vs what the database has
// ============================================================================
// Reports missing tables, missing columns, enum values the code uses but the DB lacks, and
// column type mismatches. Writes nothing. Point it at any database with DATABASE_URL.
// Usage: node scripts/schema_check.js          (uses .env)
//        DATABASE_URL=... node scripts/schema_check.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const { sequelize, ...db } = require('../models');

// Sequelize type key -> information_schema data_type(s)
const PG_TYPES = {
  STRING: ['character varying'], CHAR: ['character'], TEXT: ['text'], INTEGER: ['integer'], BIGINT: ['bigint'],
  FLOAT: ['double precision', 'real'], DOUBLE: ['double precision'], DECIMAL: ['numeric'], BOOLEAN: ['boolean'],
  DATE: ['timestamp with time zone', 'timestamp without time zone'], DATEONLY: ['date'], JSON: ['json'], JSONB: ['jsonb'],
  ENUM: ['USER-DEFINED'], ARRAY: ['ARRAY'], UUID: ['uuid'], TIME: ['time without time zone'],
};

async function main() {
  const q = async (sql, replacements) => (await sequelize.query(sql, { replacements }))[0];
  const host = sequelize.config.host;
  console.log(`🔍 Read-only schema check on ${host}/${sequelize.config.database}\n`);

  const problems = [];
  const models = Object.values(db).filter((m) => m && m.rawAttributes && m.getTableName);
  for (const model of models) {
    const table = model.getTableName().toString();
    const cols = await q(
      `SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table`,
      { table },
    );
    if (!cols.length) {
      problems.push(`MISSING TABLE   ${table} (model ${model.name})`);
      continue;
    }
    const byName = new Map(cols.map((c) => [c.column_name, c]));
    for (const [attr, def] of Object.entries(model.rawAttributes)) {
      const field = def.field || attr;
      const col = byName.get(field);
      const key = def.type?.key;
      if (!col) {
        problems.push(`MISSING COLUMN  ${table}.${field} (${key}${def.allowNull === false ? ', NOT NULL' : ''}${def.defaultValue !== undefined ? ', has default' : ''})`);
        continue;
      }
      if (PG_TYPES[key] && !PG_TYPES[key].includes(col.data_type)) {
        problems.push(`TYPE MISMATCH   ${table}.${field}: code ${key}, database ${col.data_type}`);
      }
      if (key === 'ENUM' && col.data_type === 'USER-DEFINED') {
        const have = (await q(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = :typ`, { typ: col.udt_name })).map((r) => r.enumlabel);
        const missing = def.values.filter((v) => !have.includes(v));
        if (missing.length) problems.push(`ENUM VALUES     ${table}.${field} (${col.udt_name}) lacks: ${missing.join(', ')}`);
      }
    }
  }

  if (!problems.length) console.log('✅ The database matches the code.');
  else {
    console.log(`Found ${problems.length} difference(s):`);
    for (const p of problems.sort()) console.log('  ' + p);
  }
  for (const t of ['blogs', 'readings', 'writings', 'speakings', 'stories', 'audios', 'videos', 'esl_audios', 'esl_videos', 'quiz_questions', 'quiz_sections', 'users']) {
    try { console.log(`  rows ${t}: ${(await q(`SELECT count(*)::int n FROM ${t}`))[0].n}`); } catch { /* table missing: reported above */ }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  });
