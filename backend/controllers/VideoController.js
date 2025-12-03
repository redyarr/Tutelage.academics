// ============================================================================
// VIDEO CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for video content with pagination
// support for infinite scrolling functionality.
// ============================================================================

const { Video, User, Tag, ResourceTag, ApprovalRequest } = require('../models');
const { sendApprovalRequestNotification } = require('../config/email');
const { Op } = require('sequelize');


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

// Tag helpers for skills videos (using ResourceTag join table)
async function attachTags(resourceId, tagNames = []) {
  if (!Array.isArray(tagNames) || !tagNames.length) return;
  const trimmed = tagNames.map(t => String(t).trim()).filter(Boolean);
  const existing = await Tag.findAll({ where: { name: { [Op.in]: trimmed } } });
  const existingMap = new Map(existing.map(t => [t.name, t.id]));
  const toCreate = trimmed.filter(n => !existingMap.has(n)).map(n => ({ name: n, namespace: 'video' }));
  if (toCreate.length) {
    const created = await Tag.bulkCreate(toCreate, { returning: true });
    created.forEach(t => existingMap.set(t.name, t.id));
  }
  const tagIds = trimmed.map(n => existingMap.get(n)).filter(Boolean);
  await ResourceTag.destroy({ where: { resourceType: 'video', resourceId } });
  if (tagIds.length) {
    await ResourceTag.bulkCreate(tagIds.map(tagId => ({ resourceType: 'video', resourceId, tagId })));
  }
}

async function includeTagsFor(resourceId) {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'video', resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
}

async function getTagFilterIds(tagQuery) {
  if (!tagQuery) return null;
  const names = Array.isArray(tagQuery) ? tagQuery : String(tagQuery).split(',').map(s => s.trim()).filter(Boolean);
  if (!names.length) return null;
  const tags = await Tag.findAll({ where: { name: { [Op.in]: names } } });
  if (!tags.length) return [];
  const tagIds = tags.map(t => t.id);
  const mappings = await ResourceTag.findAll({ where: { resourceType: 'video', tagId: { [Op.in]: tagIds } } });
  return [...new Set(mappings.map(m => m.resourceId))];
}

// Lightweight YouTube thumbnail derivation (no persistence, response-only)
function getYouTubeThumbnail(url) {
  try {
    if (!url) return null;
    const patterns = [
      /v=([A-Za-z0-9_-]{6,})/,      // watch?v=ID
      /youtu\.be\/(\w|-){6,}/,    // youtu.be/ID (capture later)
      /\/embed\/([A-Za-z0-9_-]{6,})/ // /embed/ID
    ];
    for (const p of patterns) {
      const m = String(url).match(p);
      // For youtu.be, grab the last path segment if needed
      let id = null;
      if (m && m[1]) {
        id = m[1];
      } else if (p.source.includes('youtu') && url.includes('youtu.be/')) {
        id = String(url).split('youtu.be/')[1]?.split(/[?&#]/)[0];
      }
      if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Create a new video content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createVideo = async (req, res) => {
  try {
    const { title, videoRef, description, level, tags } = req.body;
    const createdBy = req.user.id;
    const role = req.user.role;

    if (!title || !videoRef) {
      return res.status(400).json({
        success: false,
        message: 'Title and video reference are required'
      });
    }

    const normalizedLevels = normalizeLevels(level);

    // Handle PDF URLs provided by pdfUpload middleware (or fallback to multer paths)
    const pdf = (req.body?.pdf ?? null) || (req.files?.pdf?.[0]?.path ?? null);

    // MAIN_MANAGER users queue creation for admin approval
    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        videoRef,
        description: description ?? null,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        level: normalizedLevels,
        tags: tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Video',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Video',
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
        message: 'Video creation queued for admin approval'
      });
    }

    const video = await Video.create({
      title,
      videoRef,
      description,
      pdf,
      level: normalizedLevels,
      createdBy
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'video', resourceId: video.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }

    const videoWithAuthor = await Video.findByPk(video.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    const tagNames = tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [];
    if (tagNames.length) await attachTags(video.id, tagNames);
    const tagList = await includeTagsFor(video.id);

    res.status(201).json({
      success: true,
      message: 'Video content created successfully',
      data: { ...videoWithAuthor.toJSON(), thumbnailUrl: getYouTubeThumbnail(videoWithAuthor.videoRef), tags: tagList }
    });
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all video content with infinite scroll pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllVideos = async (req, res) => {
  try {
    const { 
      cursor, // For cursor-based pagination (ID of last item)
      limit = 10, 
      search,
      level,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Optional level filter: supports comma-separated or repeated query params
    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    // Optional tag filtering via join table
    let idFilter = null;
    if (tags) {
      idFilter = await getTagFilterIds(tags);
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

    let videos = await Video.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      limit: fetchLimit,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      distinct: true
    });


    // Check if there are more items
    const hasMore = videos.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? videos.slice(0, parseInt(limit)) : videos;
    
    // Get the cursor for the next request (ID of the last item)
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    const enriched = await Promise.all(items.map(async (v) => {
      const tagList = await includeTagsFor(v.id);
      return { ...v.toJSON(), thumbnailUrl: getYouTubeThumbnail(v.videoRef), tags: tagList };
    }));

    res.status(200).json({
      success: true,
      data: {
        videos: enriched,
        pagination: {
          nextCursor,
          hasMore,
          itemsPerPage: parseInt(limit),
          totalItemsReturned: items.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all video content with pagination (for React frontend)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaginatedVideos = async (req, res) => {
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
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    // Optional tag filter
    let idFilter = null;
    if (tags) {
      idFilter = await getTagFilterIds(tags);
      if (Array.isArray(idFilter)) {
        whereClause.id = { [Op.in]: idFilter };
      }
    }

    let { count, rows } = await Video.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });


    const totalPages = Math.ceil(count / limit);

    const enriched = await Promise.all(rows.map(async (v) => {
      const tagList = await includeTagsFor(v.id);
      return { ...v.toJSON(), thumbnailUrl: getYouTubeThumbnail(v.videoRef), tags: tagList };
    }));

    res.status(200).json({
      success: true,
      data: {
        videos: enriched,
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
    console.error('Error fetching paginated videos:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get a single video content by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video content not found'
      });
    }

    const tagList = await includeTagsFor(video.id);
    res.status(200).json({
      success: true,
      data: { ...video.toJSON(), thumbnailUrl: getYouTubeThumbnail(video.videoRef), tags: tagList }
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update a video content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoRef, description, level, tags } = req.body;

    const video = await Video.findByPk(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video content not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const normalizedLevel = level !== undefined ? normalizeLevels(level) : video.level;
      const pdf = (req.body?.pdf !== undefined)
        ? req.body.pdf
        : (req.files?.pdf?.[0]?.path ?? video.pdf);

      const payload = {
        title: title ?? video.title,
        videoRef: videoRef ?? video.videoRef,
        description: description ?? video.description,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : undefined,
        level: normalizedLevel ?? video.level,
        tags: (tags !== undefined)
          ? String(tags).split(',').map(t => t.trim()).filter(Boolean)
          : undefined
      };

      const approval = await ApprovalRequest.create({
        resourceType: 'Video',
        resourceId: video.id,
        action: 'UPDATE',
        payload,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        const changedKeys = Object.keys(payload).filter(k => payload[k] !== undefined);
        await sendApprovalRequestNotification({
          resourceType: 'Video',
          resourceId: video.id,
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
        message: 'You can only update your own video content'
      });
    }

    const normalizedLevel = level !== undefined ? normalizeLevels(level) : video.level;
    
    // Handle PDF URLs injected by pdfUpload middleware; if not provided, keep existing.
    const pdf = (req.body?.pdf !== undefined)
      ? req.body.pdf
      : (req.files?.pdf?.[0]?.path ?? video.pdf);

    await video.update({
      title: title ?? video.title,
      videoRef: videoRef ?? video.videoRef,
      description: description ?? video.description,
      pdf,
      level: normalizedLevel ?? video.level
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'video', resourceId: video.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }

    if (tags !== undefined) {
      const tagNames = String(tags).split(',').map(t => t.trim()).filter(Boolean);
      await attachTags(video.id, tagNames);
    }

    const updatedVideo = await Video.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });
    const tagList = await includeTagsFor(video.id);

    res.status(200).json({
      success: true,
      message: 'Video content updated successfully',
      data: { ...updatedVideo.toJSON(), thumbnailUrl: getYouTubeThumbnail(updatedVideo.videoRef), tags: tagList }
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete a video content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findByPk(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video content not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Video',
        resourceId: video.id,
        action: 'DELETE',
        payload: null,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Video',
          resourceId: video.id,
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
        message: 'You can only delete your own video content'
      });
    }

    await ResourceTag.destroy({ where: { resourceType: 'video', resourceId: id } });
    await video.destroy();

    res.status(200).json({
      success: true,
      message: 'Video content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get videos by title search with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchVideosByTitle = async (req, res) => {
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

    const { count, rows } = await Video.findAndCountAll({
      where: {
        title: { [Op.like]: `%${query}%` }
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
        videos: rows,
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
    console.error('Error searching videos by title:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Legacy function for backward compatibility
const get = (req, res) => {
   return res.status(200).json({
      success: true,
      message: 'Videos fetched successfully',
      data: [
         {
            id: 1,
            title: 'Introduction to Mathematics',
            description: 'Learn the basics of mathematics',
            url: 'https://www.youtube.com/embed/Kp2bYWRQylk',
            thumbnail: 'https://img.youtube.com/vi/Kp2bYWRQylk/hqdefault.jpg',
            category: 'Mathematics'
         },
         {
            id: 2,
            title: 'Advanced Physics Concepts',
            description: 'Explore advanced physics theories',
            url: 'https://www.youtube.com/embed/0NbBjNiw4tk',
            thumbnail: 'https://img.youtube.com/vi/0NbBjNiw4tk/hqdefault.jpg',
            category: 'Physics'
         },
         {
            id: 3,
            title: 'Chemistry Fundamentals',
            description: 'Understanding basic chemistry principles',
            url: 'https://www.youtube.com/embed/FSyAehMdpyI',
            thumbnail: 'https://img.youtube.com/vi/FSyAehMdpyI/hqdefault.jpg',
            category: 'Chemistry'
         }
      ]
    }); 
};

module.exports = {
  createVideo,
  getAllVideos,
  getPaginatedVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  searchVideosByTitle,
  get // Legacy export
};
