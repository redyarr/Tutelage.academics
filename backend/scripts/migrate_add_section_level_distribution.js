// ============================================================================
// MIGRATION SCRIPT: Add levelDistribution to quiz_sections
// ============================================================================
// Per-level question split of a section, e.g. {"A1":3,"A2":3,"B1":4}. Nullable: existing sections
// keep drawing any-level questions until an admin sets a split. Safe to run twice.
// Usage: node scripts/migrate_add_section_level_distribution.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../models');

async function migrate() {
  try {
    console.log('🔄 Adding levelDistribution to quiz_sections...');
    await sequelize.query(`
      ALTER TABLE quiz_sections
      ADD COLUMN IF NOT EXISTS "levelDistribution" JSONB DEFAULT NULL;
    `);
    console.log('✅ quiz_sections.levelDistribution is ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
