require('dotenv').config();
const { sequelize, User, Video, TaskPdf } = require('../models');

async function run() {
  try {
    await sequelize.authenticate();
    const user = await User.create({ name: 'Test User', email: `test_${Date.now()}@example.com`, passwordHash: 'x', role: 'ADMIN' });
    const video = await Video.create({ title: 'Test Video', videoRef: 'https://youtu.be/dQw4w9WgXcQ', description: 'd', pdf: null, level: ['B1 Intermediate'], createdBy: user.id });
    const created = await TaskPdf.bulkCreate([
      { resourceType: 'video', resourceId: video.id, filePath: 'https://example.com/a.pdf', fileName: 'a.pdf', fileSize: 1234 },
      { resourceType: 'video', resourceId: video.id, filePath: 'https://example.com/b.pdf', fileName: 'b.pdf', fileSize: 5678 },
    ], { returning: true });
    const list = await TaskPdf.findAll({ where: { resourceType: 'video', resourceId: video.id } });
    console.log('created', created.length, 'listed', list.length);
    if (list.length !== 2) throw new Error('unexpected count');
    await created[0].destroy();
    const after = await TaskPdf.findAll({ where: { resourceType: 'video', resourceId: video.id } });
    console.log('after delete', after.length);
    if (after.length !== 1) throw new Error('delete failed');
    await TaskPdf.destroy({ where: { resourceType: 'video', resourceId: video.id } });
    await video.destroy();
    await user.destroy();
    console.log('✅ model test passed');
  } catch (e) {
    console.error('❌ model test failed', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

