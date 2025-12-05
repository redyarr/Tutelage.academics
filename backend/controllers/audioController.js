// ============================================================================
// AUDIO CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for audio content with pagination
// support for infinite scrolling functionality.
// ============================================================================

const { Audio, User, Tag, ResourceTag, ResourceAnalytics, ApprovalRequest, TaskPdf } = require('../models');
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

async function attachTags(resourceId, tagNames = []) {
  if (!tagNames?.length) return;
  const existing = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const existingNames = new Set(existing.map(t => t.name));
  const toCreate = tagNames.filter(n => !existingNames.has(n)).map(name => ({ name, namespace: 'audio' }));
  if (toCreate.length) await Tag.bulkCreate(toCreate);
  const allTags = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const mappings = allTags.map(tag => ({ resourceType: 'audio', resourceId, tagId: tag.id }));
  for (const m of mappings) {
    const exists = await ResourceTag.findOne({ where: m });
    if (!exists) await ResourceTag.create(m);
  }
}

async function getTagFilterIds(tagQuery) {
  if (!tagQuery) return null;
  const names = Array.isArray(tagQuery) ? tagQuery : String(tagQuery).split(',').map(s => s.trim()).filter(Boolean);
  if (!names.length) return null;
  const tags = await Tag.findAll({ where: { name: { [Op.in]: names } } });
  if (!tags.length) return [];
  const tagIds = tags.map(t => t.id);
  const mappings = await ResourceTag.findAll({ where: { resourceType: 'audio', tagId: { [Op.in]: tagIds } } });
  return [...new Set(mappings.map(m => m.resourceId))];
}

async function ensureAnalytics(resourceId) {
  const [row] = await ResourceAnalytics.findOrCreate({
    where: { resourceType: 'audio', resourceId },
    defaults: { views: 0, plays: 0, downloads: 0 }
  });
  return row;
}

async function includeTagsFor(resourceId) {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'audio', resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
}

/**
 * Create a new audio content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createAudio = async (req, res) => {
  try {
    const { title, description, discription, transcript, audioRef, pdf, pdfRef, level, imageUrl, imageurl, tags } = req.body;
    const createdBy = req.user.id; // From auth middleware
    const role = req.user.role;

    // Validate required fields
    if (!title || !audioRef) {
      return res.status(400).json({
        success: false,
        message: 'Title and audio reference are required'
      });
    }

    // Normalize level(s) to an array
    const normalizedLevels = normalizeLevels(level);

    // MAIN_MANAGER users queue creation for admin approval
    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        description: (description ?? discription ?? null),
        transcript,
        audioRef,
        pdf: (pdf ?? pdfRef ?? null),
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        imageUrl: (imageUrl ?? imageurl ?? null),
        level: normalizedLevels,
        tags: Array.isArray(tags)
          ? tags
          : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [])
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Audio',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Audio',
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
        message: 'Audio creation queued for admin approval'
      });
    }

    const audio = await Audio.create({
      title,
      description: (description ?? discription ?? null),
      transcript,
      audioRef,
      pdf: (pdf ?? pdfRef ?? null),
      imageUrl: (imageUrl ?? imageurl ?? null),
      level: normalizedLevels,
      createdBy
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'task PDFs for audio creation...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'audio', 
          resourceId: audio.id, 
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

    // Fetch the created audio with author information
    const audioWithAuthor = await Audio.findByPk(audio.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    const tagNames = Array.isArray(tags)
      ? tags
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    if (tagNames.length) await attachTags(audio.id, tagNames);
    const tagList = await includeTagsFor(audio.id);

    res.status(201).json({
      success: true,
      message: 'Audio content created successfully',
      data: { ...audioWithAuthor.toJSON(), tags: tagList }
    });
  } catch (error) {
    console.error('Error creating audio:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all audio content with infinite scroll pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllAudios = async (req, res) => {
  try {
    const { cursor, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { transcript: { [Op.like]: `%${search}%` } }
      ];
    }

    // Optional level filter supports comma-separated or repeated query params
    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    // Optional tag filtering via join table
    if (tags) {
      const idFilter = await getTagFilterIds(tags);
      if (Array.isArray(idFilter)) {
        whereClause.id = { ...(whereClause.id || {}), [Op.in]: idFilter };
      }
    }

    // Add cursor condition for infinite scroll
    if (cursor) {
      if (sortOrder.toUpperCase() === 'DESC') {
        whereClause.id = { [Op.lt]: parseInt(cursor) };
      } else {
        whereClause.id = { [Op.gt]: parseInt(cursor) };
      }
    }

    // Fetch one extra item to check if there are more items
    const fetchLimit = parseInt(limit) + 1;

    let audios = await Audio.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
      ],
      limit: fetchLimit,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      distinct: true
    });

    // Skills endpoint minimal: no popularity sorting

    // Check if there are more items
    const hasMore = audios.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? audios.slice(0, parseInt(limit)) : audios;
    
    // Get the cursor for the next request (ID of the last item)
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    const enriched = await Promise.all(items.map(async (a) => {
      const tagList = await includeTagsFor(a.id);
      return { ...a.toJSON(), tags: tagList };
    }));

    res.status(200).json({
      success: true,
      message: 'Audios fetched successfully',
      data: {
        audios: enriched,
        pagination: {
          nextCursor,
          hasMore,
          itemsPerPage: parseInt(limit),
          totalItemsReturned: enriched.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching audios:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all audio content with pagination (for React frontend)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaginatedAudios = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      level,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build where clause for filtering
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

    // Optional tag filter
    if (tags) {
      const idFilter = await getTagFilterIds(tags);
      if (Array.isArray(idFilter)) {
        whereClause.id = { [Op.in]: idFilter };
      }
    }

    let { count, rows } = await Audio.findAndCountAll({
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

    const enriched = await Promise.all(rows.map(async (a) => {
      const tagList = await includeTagsFor(a.id);
      return { ...a.toJSON(), tags: tagList };
    }));

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      message: 'Audios fetched successfully',
      data: {
        audios: enriched,
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
    console.error('Error fetching paginated audios:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get a single audio content by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAudioById = async (req, res) => {
  try {
    const { id } = req.params;

    const audio = await Audio.findByPk(id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'email'] },
        { model: TaskPdf, as: 'taskPdfs' } // Added TaskPdf include
      ]
    });

    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio content not found'
      });
    }

    // Include tag names in detail response
    const tagList = await includeTagsFor(audio.id);
    const tasks = await getTasks(audio.id);
    
    res.status(200).json({
      success: true,
      message: 'Audio content fetched successfully',
      data: { ...audio.toJSON(), tags: tagList, tasks }
    });
  } catch (error) {
    console.error('Error fetching audio:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update an audio content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, discription, transcript, audioRef, pdf, pdfRef, level, imageUrl, imageurl, tags, deletedTaskPdfIds } = req.body;

    const audio = await Audio.findByPk(id);

    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio content not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const normalizedLevel = level !== undefined ? normalizeLevels(level) : audio.level;
      const payload = {
        title: title ?? audio.title,
        description: (description ?? discription ?? audio.description),
        transcript: transcript ?? audio.transcript,
        audioRef: audioRef ?? audio.audioRef,
        pdf: (pdf ?? pdfRef ?? audio.pdf),
        imageUrl: (imageUrl ?? imageurl ?? audio.imageUrl),
        level: normalizedLevel ?? audio.level,
        tags: (tags !== undefined)
          ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
          : undefined
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Audio',
        resourceId: audio.id,
        action: 'UPDATE',
        payload,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      // Fire-and-forget admin notification
      try {
        const changedKeys = Object.keys(payload).filter(k => payload[k] !== undefined);
        await sendApprovalRequestNotification({
          resourceType: 'Audio',
          resourceId: audio.id,
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
      return res.status(403).json({
        success: false,
        message: 'You can only update your own audio content'
      });
    }

    const normalizedLevel = level !== undefined
      ? normalizeLevels(level)
      : audio.level;

    // Handle deletion of existing task PDFs
    if (deletedTaskPdfIds) {
      try {
        const idsToDelete = JSON.parse(deletedTaskPdfIds);
        if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
          await TaskPdf.destroy({
            where: {
              id: { [Op.in]: idsToDelete },
              resourceType: 'audio',
              resourceId: audio.id
            }
          });
          console.log(`✅ Deleted ${idsToDelete.length} task PDFs`);
        }
      } catch (parseErr) {
        console.error('❌ Error parsing deletedTaskPdfIds:', parseErr);
      }
    }

    await audio.update({
      title: title ?? audio.title,
      description: (description ?? discription ?? audio.description),
      transcript: transcript ?? audio.transcript,
      audioRef: audioRef ?? audio.audioRef,
      pdf: (pdf ?? pdfRef ?? audio.pdf),
      imageUrl: (imageUrl ?? imageurl ?? audio.imageUrl),
      level: normalizedLevel ?? audio.level
    });

    // Handle multiple task PDFs
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'new task PDFs...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'audio', 
          resourceId: audio.id, 
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

    if (tags !== undefined) {
      const tagNames = Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean);
      await ResourceTag.destroy({ where: { resourceType: 'audio', resourceId: audio.id } });
      if (tagNames.length) await attachTags(audio.id, tagNames);
    }

    // Fetch updated audio with author information
    const updatedAudio = await Audio.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(200).json({
      success: true,
      message: 'Audio content updated successfully',
      data: { ...updatedAudio.toJSON(), tags: await includeTagsFor(audio.id) }
    });
  } catch (error) {
    console.error('Error updating audio:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete an audio content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAudio = async (req, res) => {
  try {
    const { id } = req.params;

    const audio = await Audio.findByPk(id);

    if (!audio) {
      return res.status(404).json({
        success: false,
        message: 'Audio content not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Audio',
        resourceId: audio.id,
        action: 'DELETE',
        payload: null,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Audio',
          resourceId: audio.id,
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
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own audio content'
      });
    }

    await ResourceTag.destroy({ where: { resourceType: 'audio', resourceId: id } });
    await ResourceAnalytics.destroy({ where: { resourceType: 'audio', resourceId: id } });
    await audio.destroy();

    res.status(200).json({
      success: true,
      message: 'Audio content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting audio:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Search audio content by transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchAudioByTranscript = async (req, res) => {
  try {
    const { query } = req.query;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const { count, rows } = await Audio.findAndCountAll({
      where: {
        transcript: { [Op.like]: `%${query}%` }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        audios: rows,
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
    console.error('Error searching audio by transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createAudio,
  getAllAudios,
  getPaginatedAudios,
  getAudioById,
  updateAudio,
  deleteAudio,
  searchAudioByTranscript
};
