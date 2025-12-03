require('dotenv').config();
const { sequelize } = require('../models');

const tables = ['videos','audios','speakings','writings','readings','stories','blogs','esl_videos','esl_audios'];

async function dropColumn(table) {
  const qi = sequelize.getQueryInterface();
  const desc = await qi.describeTable(table).catch(() => ({}));
  if (!desc.taskPdf) {
    console.log(`[skip] ${table}.taskPdf missing`);
    return;
  }
  console.log(`[drop] ${table}.taskPdf`);
  await qi.removeColumn(table, 'taskPdf');
}

async function run() {
  try {
    await sequelize.authenticate();
    for (const t of tables) {
      await dropColumn(t);
    }
    console.log('✅ taskPdf columns dropped');
  } catch (e) {
    console.error('❌ drop failed', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

