// WRITE tests: they create and delete rows, so they run only against TEST_DATABASE_URL
// (a throwaway Neon branch or local Postgres) and never against the database in .env.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB; // must be set before models load

test('TaskPdf rows attach to and detach from a resource', { skip: !TEST_DB && 'set TEST_DATABASE_URL to run write tests' }, async () => {
  const { sequelize, User, Video, TaskPdf } = require('../../models');
  try {
    await sequelize.authenticate();
    const user = await User.create({ name: 'Test User', email: `test_${Date.now()}@example.com`, passwordHash: 'x', role: 'ADMIN' });
    const video = await Video.create({ title: 'Test Video', videoRef: 'https://youtu.be/dQw4w9WgXcQ', description: 'd', pdf: null, level: ['B1 Intermediate'], createdBy: user.id });
    const where = { resourceType: 'video', resourceId: video.id };
    try {
      const created = await TaskPdf.bulkCreate([
        { ...where, filePath: 'https://example.com/a.pdf', fileName: 'a.pdf', fileSize: 1234 },
        { ...where, filePath: 'https://example.com/b.pdf', fileName: 'b.pdf', fileSize: 5678 },
      ], { returning: true });
      assert.equal((await TaskPdf.findAll({ where })).length, 2);
      await created[0].destroy();
      assert.equal((await TaskPdf.findAll({ where })).length, 1);
    } finally {
      await TaskPdf.destroy({ where });
      await video.destroy();
      await user.destroy();
    }
  } finally {
    await sequelize.close();
  }
});
