// ============================================================================
// MIGRATION SCRIPT: Add reading passages to the quiz
// ============================================================================
// quiz_passages: a text covering a range of a section's question numbers (startPosition-endPosition).
// quiz_questions.passageId: nullable, so every existing question stays a standalone question.
// Also upgrades the first draft of quiz_passages (it had a "level" column and no range).
// Safe to run twice.
// Usage: node scripts/migrate_add_quiz_passages.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, QuizPassage } = require('../models');

async function migrate() {
  try {
    console.log('🔄 Creating quiz_passages...');
    await QuizPassage.sync(); // CREATE TABLE IF NOT EXISTS

    console.log('🔄 Upgrading quiz_passages columns...');
    await sequelize.query(`
      ALTER TABLE quiz_passages DROP COLUMN IF EXISTS level;
      DROP TYPE IF EXISTS "enum_quiz_passages_level";
      ALTER TABLE quiz_passages ADD COLUMN IF NOT EXISTS "startPosition" INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE quiz_passages ADD COLUMN IF NOT EXISTS "endPosition" INTEGER NOT NULL DEFAULT 1;
    `);

    console.log('🔄 Adding passageId to quiz_questions...');
    await sequelize.query(`
      ALTER TABLE quiz_questions
      ADD COLUMN IF NOT EXISTS "passageId" INTEGER REFERENCES quiz_passages(id) ON DELETE SET NULL;
    `);
    console.log('✅ Quiz passages are ready');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
