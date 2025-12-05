require('dotenv').config();
const { sequelize } = require('../models');

const tables = [
  { name: 'videos', type: 'video' },
  { name: 'audios', type: 'audio' },
  { name: 'speakings', type: 'speaking' },
  { name: 'writings', type: 'writing' },
  { name: 'readings', type: 'reading' },
  { name: 'stories', type: 'story' },
  { name: 'blogs', type: 'blog' },
  { name: 'esl_videos', type: 'esl_video' },
  { name: 'esl_audios', type: 'esl_audio' },
];

async function transferFrom(table, resourceType) {
  console.log(`[transfer] ${table} -> task_pdfs (${resourceType})`);
  await sequelize.query(`
    INSERT INTO "task_pdfs" ("resourceType", "resourceId", "filePath", "fileName", "uploadDate")
    SELECT '${resourceType}', "id", "taskPdf", COALESCE(split_part("taskPdf", '/', array_length(string_to_array("taskPdf", '/'),1)), "taskPdf"), NOW()
    FROM "${table}"
    WHERE "taskPdf" IS NOT NULL AND "taskPdf" <> ''
  `);
}

async function run() {
  try {
    await sequelize.authenticate();
    for (const t of tables) {
      await transferFrom(t.name, t.type);
    }
    console.log('✅ transfer complete');
  } catch (e) {
    console.error('❌ transfer failed', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
