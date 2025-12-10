// ============================================================================
// READING CONTROLLER
// ============================================================================
// Handles CRUD operations for Reading content with pagination and filtering.
// Mirrors Writing/Speaking patterns and syncs tags via ResourceTag.
// ============================================================================

const { Reading, User, Tag, ResourceTag, ApprovalRequest, TaskPdf } = require('../models');
const { sendApprovalRequestNotification } = require('../config/email');
const { Op } = require('sequelize');
const { getTasks } = require('../scripts/fetchTasks');

// Convert incoming level(s) to CEFR labels as an array
function normalizeLevels(input) {
  if (input === undefined || input === null) return null;
  const map = {
    'a1': 'A1 Beginner',
    'a2': 'A2 Pre-intermediate',
    'b1': 'B1 Intermediate',
    'b2': 'B2 Upper-Intermediate',
    'c1': 'C1 Advanced',
    'c2': 'C2 Proficient'
  };
  const values = Array.isArray(input) ? input : String(input).split(',');
  const normalized = values
    .map(v => String(v).trim())
    .filter(Boolean)
    .map(v => map[v.toLowerCase()] || v);
  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : null;
}

function normalizeTags(input) {
  if (input === undefined || input === null) return null;
  const values = Array.isArray(input) ? input : String(input).split(',');
  const normalized = values
    .map(v => String(v).trim())
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : null;
}

// Join-table tag helpers for Reading resources
async function attachTags(resourceId, tagNames = []) {
  if (!Array.isArray(tagNames) || !tagNames.length) return;
  const trimmed = tagNames.map(t => String(t).trim()).filter(Boolean);
  const existing = await Tag.findAll({ where: { name: { [Op.in]: trimmed } } });
  const existingMap = new Map(existing.map(t => [t.name, t.id]));
  const toCreate = trimmed.filter(n => !existingMap.has(n)).map(n => ({ name: n, namespace: 'reading' }));
  if (toCreate.length) {
    const created = await Tag.bulkCreate(toCreate, { returning: true });
    created.forEach(t => existingMap.set(t.name, t.id));
  }
  const tagIds = trimmed.map(n => existingMap.get(n)).filter(Boolean);
  await ResourceTag.destroy({ where: { resourceType: 'reading', resourceId } });
  if (tagIds.length) {
    await ResourceTag.bulkCreate(tagIds.map(tagId => ({ resourceType: 'reading', resourceId, tagId })));
  }
}

async function includeTagsFor(resourceId) {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'reading', resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
}

/**
 * Create a new reading content
 */
const createReading = async (req, res) => {
  try {
    const { title, content, description, discription, pdf, level, imageUrl, imageurl, tags } = req.body;
    const createdBy = req.user.id; // From auth middleware
    const role = req.user.role;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const normalizedLevels = normalizeLevels(level);
    
    // Parse tags from comma-separated string to array
    const tagNames = tags 
      ? (Array.isArray(tags) 
          ? tags.map(t => String(t).trim()).filter(Boolean)
          : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : [];

    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        content,
        description: (description ?? discription ?? null),
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        imageUrl: (imageUrl ?? imageurl ?? null),
        level: normalizedLevels,
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Reading',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Reading',
          resourceId: null,
          action: 'CREATE',
          requestedByEmail: req.user?.email,
          changesSummary: Object.keys(payload)
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send create approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Reading creation queued for admin approval'
      });
    }

    const reading = await Reading.create({
      title,
      content,
      description: (description ?? discription ?? null),
      pdf,
      imageUrl: (imageUrl ?? imageurl ?? null),
      level: normalizedLevels,
      tags: tagNames.length ? tagNames : null, // Store parsed array in DB
      createdBy
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'reading', 
          resourceId: reading.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      if (rows.length) {
        await TaskPdf.bulkCreate(rows);
      }
    }

    // Sync tags to join table
    if (tagNames.length) await attachTags(reading.id, tagNames);

    const readingWithAuthor = await Reading.findByPk(reading.id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Reading content created successfully',
      data: { ...readingWithAuthor.toJSON(), tags: await includeTagsFor(reading.id) }
    });
  } catch (error) {
    console.error('Error creating reading:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all reading content with infinite scroll pagination
 */
const getAllReadings = async (req, res) => {
  try {
    const { cursor, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    const tagsFilter = normalizeTags(tags);
    if (tagsFilter) {
      whereClause.tags = { [Op.overlap]: tagsFilter };
    }

    if (cursor) {
      if (sortOrder.toUpperCase() === 'DESC') {
        whereClause.id = { [Op.lt]: parseInt(cursor) };
      } else {
        whereClause.id = { [Op.gt]: parseInt(cursor) };
      }
    }

    const fetchLimit = parseInt(limit) + 1;
    const readings = await Reading.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' }
      ],
      limit: fetchLimit,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()]
      ],
      distinct: true
    });

    const hasMore = readings.length > parseInt(limit);
    const items = hasMore ? readings.slice(0, parseInt(limit)) : readings;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    res.status(200).json({
      success: true,
      message: 'Readings fetched successfully',
      data: {
        readings: items,
        pagination: {
          nextCursor,
          hasMore,
          itemsPerPage: parseInt(limit),
          totalItemsReturned: items.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all reading content with page-based pagination
 */
const getPaginatedReadings = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    const tagsFilter = normalizeTags(tags);
    if (tagsFilter) {
      whereClause.tags = { [Op.overlap]: tagsFilter };
    }

    const { count, rows } = await Reading.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);
    res.status(200).json({
      success: true,
      message: 'Readings fetched successfully',
      data: {
        readings: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching paginated readings:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get a single reading content by ID
 */
const getReadingById = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await Reading.findByPk(id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' }
      ]
    });
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading content not found' });
    }
    const tasks = await getTasks(reading.id, "reading");
    
    const tagNames = await includeTagsFor(reading.id);
    res.status(200).json({ success: true, message: 'Reading content fetched successfully', data: { ...reading.toJSON(), tags: tagNames, tasks } });
  } catch (error) {
    console.error('Error fetching reading:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Update a reading content (Admin only)
 */
const updateReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, description, discription, pdf, level, imageUrl, imageurl, tags, deletedTaskPdfIds } = req.body;

    const reading = await Reading.findByPk(id);
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading content not found' });
    }

    // Parse tags from comma-separated string to array
    const tagNames = tags !== undefined
      ? (Array.isArray(tags) 
          ? tags.map(t => String(t).trim()).filter(Boolean)
          : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : null;

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const normalizedLevelUpdate = level !== undefined ? normalizeLevels(level) : reading.level;
      const payload = {
        title: title ?? reading.title,
        content: content ?? reading.content,
        description: (description ?? discription ?? reading.description),
        pdf: pdf ?? reading.pdf,
        imageUrl: (imageUrl ?? imageurl ?? reading.imageUrl),
        level: normalizedLevelUpdate ?? reading.level,
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Reading',
        resourceId: reading.id,
        action: 'UPDATE',
        payload,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        const changedKeys = Object.keys(payload).filter(k => payload[k] !== undefined);
        await sendApprovalRequestNotification({
          resourceType: 'Reading',
          resourceId: reading.id,
          action: 'UPDATE',
          requestedByName: req.user?.name,
          requestedByEmail: req.user?.email,
          changesSummary: changedKeys.length ? `Fields changed: ${changedKeys.join(', ')}` : null
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send approval request email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        message: 'Update queued for admin approval',
        queuedForApproval: true,
        approvalRequestId: approval.id
      });
    }
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only update your own reading content' });
    }

    const normalizedLevelUpdate = level !== undefined ? normalizeLevels(level) : reading.level;

    // Handle deletion of existing task PDFs
    if (deletedTaskPdfIds) {
      try {
        const idsToDelete = JSON.parse(deletedTaskPdfIds);
        if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
          await TaskPdf.destroy({
            where: {
              id: { [Op.in]: idsToDelete },
              resourceType: 'reading',
              resourceId: reading.id
            }
          });
        }
      } catch (parseErr) {
        console.error('Error parsing deletedTaskPdfIds:', parseErr);
      }
    }

    await reading.update({
      title: title ?? reading.title,
      content: content ?? reading.content,
      description: (description ?? discription ?? reading.description),
      pdf: pdf ?? reading.pdf,
      imageUrl: (imageUrl ?? imageurl ?? reading.imageUrl),
      level: normalizedLevelUpdate ?? reading.level,
      tags: tagNames !== null ? (tagNames.length ? tagNames : null) : reading.tags // Store parsed array
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'reading', 
          resourceId: reading.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      if (rows.length) {
        await TaskPdf.bulkCreate(rows);
      }
    }

    // Sync join-table tags
    if (tagNames !== null) {
      await ResourceTag.destroy({ where: { resourceType: 'reading', resourceId: id } });
      if (tagNames.length) await attachTags(reading.id, tagNames);
    }

    const updatedReading = await Reading.findByPk(id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' }
      ]
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Reading content updated successfully', 
      data: { ...updatedReading.toJSON(), tags: await includeTagsFor(reading.id) } 
    });
  } catch (error) {
    console.error('Error updating reading:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Delete a reading content (Admin only)
 */
const deleteReading = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await Reading.findByPk(id);
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading content not found' });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Reading',
        resourceId: reading.id,
        action: 'DELETE',
        payload: null,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Reading',
          resourceId: reading.id,
          action: 'DELETE',
          requestedByName: req.user?.name,
          requestedByEmail: req.user?.email
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send approval request email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        message: 'Delete queued for admin approval',
        queuedForApproval: true,
        approvalRequestId: approval.id
      });
    }
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only delete your own reading content' });
    }

    // Clean up join-table tag mappings
    await ResourceTag.destroy({ where: { resourceType: 'reading', resourceId: id } });
    await reading.destroy();
    res.status(200).json({ success: true, message: 'Reading content deleted successfully' });
  } catch (error) {
    console.error('Error deleting reading:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Search readings
 */
const searchReadings = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !String(q).trim()) {
      return res.status(400).json({ success: false, message: 'Query parameter q is required' });
    }
    const query = String(q).trim();
    const results = await Reading.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { content: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching readings:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  createReading,
  getAllReadings,
  getPaginatedReadings,
  getReadingById,
  updateReading,
  deleteReading,
  searchReadings
};
