// ============================================================================
// SPEAKING CONTROLLER
// ============================================================================
// Handles CRUD operations for Speaking content with pagination and filtering.
// ============================================================================

const { Speaking, User, Tag, ResourceTag, ApprovalRequest, TaskPdf } = require('../models');
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

// Join-table tag helpers for Speaking resources
async function attachTags(resourceId, tagNames = []) {
  if (!Array.isArray(tagNames) || !tagNames.length) return;
  const trimmed = tagNames.map(t => String(t).trim()).filter(Boolean);
  const existing = await Tag.findAll({ where: { name: { [Op.in]: trimmed } } });
  const existingMap = new Map(existing.map(t => [t.name, t.id]));
  const toCreate = trimmed.filter(n => !existingMap.has(n)).map(n => ({ name: n, namespace: 'speaking' }));
  if (toCreate.length) {
    const created = await Tag.bulkCreate(toCreate, { returning: true });
    created.forEach(t => existingMap.set(t.name, t.id));
  }
  const tagIds = trimmed.map(n => existingMap.get(n)).filter(Boolean);
  await ResourceTag.destroy({ where: { resourceType: 'speaking', resourceId } });
  if (tagIds.length) {
    await ResourceTag.bulkCreate(tagIds.map(tagId => ({ resourceType: 'speaking', resourceId, tagId })));
  }
}

async function includeTagsFor(resourceId) {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'speaking', resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
}

/**
 * Create a new speaking content
 */
const createSpeaking = async (req, res) => {
  try {
    const { title, description, discription, content, transcript, videoRef, pdf, level, imageUrl, imageurl, tags } = req.body;
    const createdBy = req.user.id; // From auth middleware
    const role = req.user.role;

    if (!title || !videoRef) {
      return res.status(400).json({
        success: false,
        message: 'Title and video reference are required'
      });
    }

    // Normalize level(s)
    const normalizedLevels = normalizeLevels(level);

    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        description: (description ?? discription ?? null),
        content,
        transcript,
        videoRef,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        imageUrl: (imageUrl ?? imageurl ?? null),
        level: normalizedLevels,
        tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [])
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Speaking',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Speaking',
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
        message: 'Speaking creation queued for admin approval'
      });
    }

    const speaking = await Speaking.create({
      title,
      description: (description ?? discription ?? null),
      content,
      transcript,
      videoRef,
      pdf,
      imageUrl: (imageUrl ?? imageurl ?? null),
      level: normalizedLevels,
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : undefined),
      createdBy
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'task PDFs for speaking creation...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'speaking', 
          resourceId: speaking.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      if (rows.length) {
        const created = await TaskPdf.bulkCreate(rows);
        console.log('✅', created.length, 'task PDFs created successfully');
      }
    }

    // Sync tags to join table while preserving array column for compatibility
    const tagNames = Array.isArray(tags)
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    if (tagNames.length) await attachTags(speaking.id, tagNames);

    const speakingWithAuthor = await Speaking.findByPk(speaking.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({
      success: true,
      message: 'Speaking content created successfully',
      data: { ...speakingWithAuthor.toJSON(), tags: await includeTagsFor(speaking.id) }
    });
  } catch (error) {
    console.error('Error creating speaking:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all speaking content with infinite scroll pagination
 */
const getAllSpeakings = async (req, res) => {
  try {
    const { cursor, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { transcript: { [Op.like]: `%${search}%` } }
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

    // Fetch one extra item to check if there are more items
    const fetchLimit = parseInt(limit) + 1;

    let speakings;
    try {
      // Try the standard query (works when level column is a string)
      speakings = await Speaking.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
          { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
        ],
        limit: fetchLimit,
        order: [
          [sortBy, sortOrder.toUpperCase()],
          ['id', sortOrder.toUpperCase()]
        ],
        distinct: true
      });
    } catch (err) {
      // If the DB column is an array type, LIKE will fail with operator not found (Postgres 42883).
      // Detect that and retry using an array-ANY check which works for varchar[] / text[].
      if (err?.parent?.code === '42883' || /operator does not exist/i.test(String(err))) {
        const levelParam = level;
        const levelMap = {
          'A1': 'A1 Beginner',
          'A2': 'A2 Pre-intermediate',
          'B1': 'B1 Intermediate',
          'B2': 'B2 Upper-Intermediate',
          'C1': 'C1 Advanced',
          'C2': 'C2 Proficient'
        };
        const normLevel = levelMap[levelParam?.toUpperCase?.()] || levelParam;

        // Remove any existing level condition from whereClause and build an ANY() literal
        const baseWhere = { ...whereClause };
        delete baseWhere.level;

        // Use model's sequelize to safely escape and create a literal " '<normLevel>' = ANY(level) "
        const sequelizeInstance = Speaking.sequelize;
        const escapedVal = sequelizeInstance.escape(normLevel);
        const anyLiteral = sequelizeInstance.literal(`${escapedVal} = ANY("level")`);

        // Combine baseWhere and literal using Op.and
        const combinedWhere = {
          [Op.and]: [
            baseWhere,
            anyLiteral
          ]
        };

        speakings = await Speaking.findAll({
          where: combinedWhere,
          include: [
            { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
            { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
          ],
          limit: fetchLimit,
          order: [
            [sortBy, sortOrder.toUpperCase()],
            ['id', sortOrder.toUpperCase()]
          ],
          distinct: true
        });
      } else {
        throw err;
      }
    }

    const hasMore = speakings.length > parseInt(limit);
    const items = hasMore ? speakings.slice(0, parseInt(limit)) : speakings;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    res.status(200).json({
      success: true,
      message: 'Speakings fetched successfully',
      data: {
        speakings: items,
        pagination: {
          nextCursor,
          hasMore,
          itemsPerPage: parseInt(limit),
          totalItemsReturned: items.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching speakings:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all speaking content with page-based pagination
 */
const getPaginatedSpeakings = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { transcript: { [Op.like]: `%${search}%` } }
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

    const { count, rows } = await Speaking.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);
    res.status(200).json({
      success: true,
      message: 'Speakings fetched successfully',
      data: {
        speakings: rows,
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
    console.error('Error fetching paginated speakings:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get a single speaking content by ID
 */
const getSpeakingById = async (req, res) => {
  try {
    const { id } = req.params;

    const speaking = await Speaking.findByPk(id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
      ]
    });

    if (!speaking) {
      return res.status(404).json({ success: false, message: 'Speaking content not found' });
    }

    const tagNames = await includeTagsFor(speaking.id);
    const tasks = await getTasks(speaking.id);
    
    res.status(200).json({ success: true, message: 'Speaking content fetched successfully', data: { ...speaking.toJSON(), tags: tagNames, tasks } });
  } catch (error) {
    console.error('Error fetching speaking:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Update a speaking content (Admin or queued for MAIN_MANAGER)
*/
const updateSpeaking = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, discription, content, transcript, videoRef, pdf, level, imageUrl, imageurl, tags, deletedTaskPdfIds } = req.body;

    const speaking = await Speaking.findByPk(id);
    if (!speaking) {
      return res.status(404).json({ success: false, message: 'Speaking content not found' });
    }
    const role = req.user.role;
    if (role === 'MAIN_MANAGER') {
      const normalizedLevelUpdate = level !== undefined ? normalizeLevels(level) : speaking.level;
      const payload = {
        title,
        description: (description ?? discription),
        content,
        transcript,
        videoRef,
        pdf,
        imageUrl: (imageUrl ?? imageurl),
        level: normalizedLevelUpdate,
        tags: Array.isArray(tags)
          ? tags
          : (tags !== undefined ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : undefined)
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Speaking',
        resourceId: speaking.id,
        action: 'UPDATE',
        payload,
        status: 'PENDING',
        requestedBy: req.user.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Speaking',
          resourceId: speaking.id,
          action: 'UPDATE',
          requestedByEmail: req.user?.email,
          changesSummary: Object.keys(payload).filter(k => payload[k] !== undefined)
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send update approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Speaking update queued for admin approval'
      });
    }

    if (role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only update your own speaking content' });
    }

    const normalizedLevelUpdate = level !== undefined
      ? normalizeLevels(level)
      : speaking.level;

    // Handle deletion of existing task PDFs
    if (deletedTaskPdfIds) {
      try {
        const idsToDelete = JSON.parse(deletedTaskPdfIds);
        if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
          await TaskPdf.destroy({
            where: {
              id: { [Op.in]: idsToDelete },
              resourceType: 'speaking',
              resourceId: speaking.id
            }
          });
          console.log(`✅ Deleted ${idsToDelete.length} task PDFs`);
        }
      } catch (parseErr) {
        console.error('❌ Error parsing deletedTaskPdfIds:', parseErr);
      }
    }

    await speaking.update({
      title: title ?? speaking.title,
      description: (description ?? discription ?? speaking.description),
      content: content ?? speaking.content,
      transcript: transcript ?? speaking.transcript,
      videoRef: videoRef ?? speaking.videoRef,
      pdf: pdf ?? speaking.pdf,
      imageUrl: (imageUrl ?? imageurl ?? speaking.imageUrl),
      level: normalizedLevelUpdate ?? speaking.level,
      tags: Array.isArray(tags)
        ? tags
        : (tags !== undefined ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : speaking.tags)
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'new task PDFs...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'speaking', 
          resourceId: speaking.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      if (rows.length) {
        const created = await TaskPdf.bulkCreate(rows);
        console.log(`✅ Added ${created.length} new task PDFs`);
      }
    }

    // Sync join-table tags
    const tagNames = Array.isArray(tags)
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : (tags !== undefined ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    if (tagNames.length) await attachTags(speaking.id, tagNames);

    const updatedSpeaking = await Speaking.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ success: true, message: 'Speaking content updated successfully', data: { ...updatedSpeaking.toJSON(), tags: await includeTagsFor(speaking.id) } });
  } catch (error) {
    console.error('Error updating speaking:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Delete a speaking content (Admin or queued for MAIN_MANAGER)
*/
const deleteSpeaking = async (req, res) => {
  try {
    const { id } = req.params;
    const speaking = await Speaking.findByPk(id);

    if (!speaking) {
      return res.status(404).json({ success: false, message: 'Speaking content not found' });
    }

    const role = req.user.role;
    if (role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Speaking',
        resourceId: speaking.id,
        action: 'DELETE',
        payload: {},
        status: 'PENDING',
        requestedBy: req.user.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Speaking',
          resourceId: speaking.id,
          action: 'DELETE',
          requestedByEmail: req.user?.email,
          changesSummary: ['DELETE']
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send delete approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'Speaking deletion queued for admin approval'
      });
    }

    if (role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only delete your own speaking content' });
    }

    // Clean up join-table tag mappings
    await ResourceTag.destroy({ where: { resourceType: 'speaking', resourceId: id } });
    await speaking.destroy();
    res.status(200).json({ success: true, message: 'Speaking content deleted successfully' });
  } catch (error) {
    console.error('Error deleting speaking:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Search speaking content by transcript or title
 */
const searchSpeaking = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const { count, rows } = await Speaking.findAndCountAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { transcript: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } }
        ]
      },
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);
    res.status(200).json({
      success: true,
      data: {
        speakings: rows,
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
    console.error('Error searching speaking:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  createSpeaking,
  getAllSpeakings,
  getPaginatedSpeakings,
  getSpeakingById,
  updateSpeaking,
  deleteSpeaking,
  searchSpeaking
};
