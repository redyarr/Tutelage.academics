// ============================================================================
// MIGRATION SCRIPT: Add category column to esl_videos table
// ============================================================================
// Run this script to add the category column to existing esl_videos table
// Usage: node scripts/add_category_column.js

const { sequelize } = require('../models');

async function addCategoryColumn() {
  try {
    console.log('🔄 Starting migration: Adding category column to esl_videos...');
    
    await sequelize.query(`
      ALTER TABLE esl_videos 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100);
    `);
    
    console.log('✅ Successfully added category column to esl_videos table');
    console.log('📝 You can now assign categories to your ESL videos');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding category column:', error);
    process.exit(1);
  }
}

addCategoryColumn();
