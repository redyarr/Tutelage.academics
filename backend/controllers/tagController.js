// ============================================================================
// TAG CONTROLLER
// ============================================================================
// Provides endpoints to list and seed predefined tags across resource types.

const { Tag } = require('../models');
const { Op } = require('sequelize');

exports.getAllTags = async (req, res) => {
  try {
    const { search, namespace } = req.query;
    const where = {};
    if (search) where.name = { [Op.iLike]: `%${search}%` }; // tags match ignoring case everywhere
    if (namespace) where.namespace = namespace;
    const tags = await Tag.findAll({ where, order: [['name', 'ASC']] });
    res.status(200).json({ success: true, data: tags });
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getByNamespace = async (req, res) => {
  try {
    const { namespace } = req.params;
    const tags = await Tag.findAll({ where: { namespace }, order: [['name', 'ASC']] });
    res.status(200).json({ success: true, data: tags });
  } catch (err) {
    console.error('Error fetching tags by namespace:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.seedDefaultTags = async (req, res) => {
  try {
    const defaults = [
      // Video categories
      { name: 'music videos', namespace: 'video' },
      { name: 'history', namespace: 'video' },
      { name: 'teen content', namespace: 'video' },
      { name: 'school materials', namespace: 'video' },
      // Audio categories
      { name: 'pronunciation', namespace: 'audio' },
      { name: 'dialogues', namespace: 'audio' },
      { name: 'songs', namespace: 'audio' },
      // Story categories
      { name: 'fiction', namespace: 'story' },
      { name: 'non-fiction', namespace: 'story' },
      { name: 'fantasy', namespace: 'story' },
      { name: 'adventure', namespace: 'story' },
      { name: 'mystery', namespace: 'story' },
      // Common difficulty levels (as tags for filtering, optional)
      { name: 'A1 Beginner', namespace: 'common' },
      { name: 'A2 Pre-intermediate', namespace: 'common' },
      { name: 'B1 Intermediate', namespace: 'common' },
      { name: 'B2 Upper-Intermediate', namespace: 'common' },
      { name: 'C1 Advanced', namespace: 'common' },
      { name: 'C2 Proficient', namespace: 'common' }
    ];
    // Upsert-like behavior: insert missing only
    const existing = await Tag.findAll({ where: { name: { [Op.in]: defaults.map(d => d.name) } } });
    const existingNames = new Set(existing.map(t => t.name));
    const toCreate = defaults.filter(d => !existingNames.has(d.name));
    if (toCreate.length) await Tag.bulkCreate(toCreate);
    const allTags = await Tag.findAll({ order: [['name', 'ASC']] });
    res.status(200).json({ success: true, message: 'Default tags seeded', data: allTags });
  } catch (err) {
    console.error('Error seeding tags:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};