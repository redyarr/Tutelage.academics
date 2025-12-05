require('dotenv').config();
const { sequelize, Sequelize } = require('../models');

async function ensureTable() {
  const qi = sequelize.getQueryInterface();
  const exists = await qi.describeTable('task_pdfs').catch(() => null);
  if (exists) {
    console.log('[skip] task_pdfs exists');
    return;
  }
  console.log('[create] task_pdfs');
  await qi.createTable('task_pdfs', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    resourceType: { type: Sequelize.STRING(50), allowNull: false },
    resourceId: { type: Sequelize.INTEGER, allowNull: false },
    filePath: { type: Sequelize.STRING(1000), allowNull: false },
    fileName: { type: Sequelize.STRING(500), allowNull: false },
    uploadDate: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    fileSize: { type: Sequelize.INTEGER, allowNull: true },
    createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });
  await qi.addIndex('task_pdfs', ['resourceType','resourceId']);
}

async function run() {
  try {
    await sequelize.authenticate();
    await ensureTable();
    console.log('✅ task_pdfs ready');
  } catch (e) {
    console.error('❌ migration failed', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

