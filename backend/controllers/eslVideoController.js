// ============================================================================
// ESL VIDEO CONTROLLER
// ============================================================================
// CRUD, search, filter, sort, tag assignment, and analytics for ESL videos.

const { EslVideo, Tag, ResourceTag, ResourceAnalytics, ApprovalRequest } = require('../models');
const { Op } = require('sequelize');
const { sendApprovalRequestNotification } = require('../config/email');

// Helpers
const normalizeLevels = (input) => {
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
};

const getYouTubeThumbnail = (url) => {
  if (!url) return null;
  try {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    if (match && match[1]) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  } catch (_) {}
  return null;
};

// Use a DB-safe resource type that matches the enum in resource_tags/resource_analytics
const DB_RESOURCE_TYPE = 'video'; // maps ESL videos to the generic 'video' enum in the DB
const RESOURCE_KEY = 'esl_video'; // logical name used within this controller (optional)

const attachTags = async (resourceId, tagNames = []) => {
  if (!Array.isArray(tagNames) || !tagNames.length) return;
  const trimmed = tagNames.map(t => String(t).trim()).filter(Boolean);
  const existing = await Tag.findAll({ where: { name: { [Op.in]: trimmed } } });
  const existingMap = new Map(existing.map(t => [t.name, t.id]));
  const toCreate = trimmed.filter(n => !existingMap.has(n)).map(n => ({ name: n }));  
  if (toCreate.length) {
    const created = await Tag.bulkCreate(toCreate, { returning: true });
    created.forEach(t => existingMap.set(t.name, t.id));
  }
  const tagIds = trimmed.map(n => existingMap.get(n)).filter(Boolean);
  await ResourceTag.destroy({ where: { resourceType: DB_RESOURCE_TYPE, resourceId } });
  await ResourceTag.bulkCreate(tagIds.map(tagId => ({ resourceType: DB_RESOURCE_TYPE, resourceId, tagId })));
};

const includeTagsFor = async (resourceId) => {
  // use DB_RESOURCE_TYPE (enum-compliant)
  const rts = await ResourceTag.findAll({ where: { resourceType: DB_RESOURCE_TYPE, resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
};

const bumpAnalytics = async (resourceId, field = 'views', amount = 1) => {
  const [row, created] = await ResourceAnalytics.findOrCreate({
    where: { resourceType: DB_RESOURCE_TYPE, resourceId },
    defaults: { resourceType: DB_RESOURCE_TYPE, resourceId, views: 0, plays: 0, downloads: 0 }
  });
  row[field] = (row[field] || 0) + amount;
  await row.save();
  return row;
};

exports.createEslVideo = async (req, res) => {
  try {
    const { title, videoRef, description, pdf, level, tags } = req.body;
    const normalizedLevel = normalizeLevels(level);
    const thumbnailUrl = getYouTubeThumbnail(videoRef);
    const createdBy = req.user?.id || 1;
    const role = req.user?.role;
    
    // Parse tags from request body (can be array or comma-separated string)
    const tagNames = Array.isArray(tags) 
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    
    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        videoRef,
        description,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        level: normalizedLevel,
        thumbnailUrl,
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'EslVideo',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslVideo',
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
        message: 'ESL video creation queued for admin approval'
      });
    }

    // Create video with tags array column
    const video = await EslVideo.create({ 
      title, 
      videoRef, 
      description, 
      pdf, 
      level: normalizedLevel, 
      thumbnailUrl, 
      tags: tagNames.length ? tagNames : null, 
      createdBy 
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'esl_video', resourceId: video.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }
    
    // Also sync to join table for relational queries
    if (tagNames.length) await attachTags(video.id, tagNames);
    
    const tagList = await includeTagsFor(video.id);
    res.status(201).json({ success: true, message: 'Esl Video Created Successfully', data: { ...video.toJSON(), tags: tagList } });
  } catch (err) {
    console.error('Error creating ESL video:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getAllEslVideos = async (req, res) => {
  try {
    const { cursor, page, limit = 9, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const where = {};
    
    if (search) where.title = { [Op.like]: `%${search}%` };
    
    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) where.level = { [Op.overlap]: levelsFilter };

    // Tag filtering
    let idFilter = null;
    if (tags) {
      const tagNames = String(tags).split(',').map(t => t.trim()).filter(Boolean);
      const tagRows = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
      const tagIds = tagRows.map(t => t.id);
      if (tagIds.length) {
        const rtRows = await ResourceTag.findAll({ where: { resourceType: DB_RESOURCE_TYPE, tagId: { [Op.in]: tagIds } } });
        const matchedIds = [...new Set(rtRows.map(r => r.resourceId))];
        idFilter = matchedIds.length ? matchedIds : [-1];
      }
    }
    if (Array.isArray(idFilter)) where.id = { [Op.in]: idFilter };

    // PAGE-BASED PAGINATION
    if (page !== undefined) {
      const currentPage = parseInt(page);
      const itemsPerPage = parseInt(limit);
      const offset = (currentPage - 1) * itemsPerPage;
      const order = [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]];

      const totalItems = await EslVideo.count({ where, distinct: true });
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      const rows = await EslVideo.findAll({
        where,
        order,
        limit: itemsPerPage,
        offset,
        distinct: true
      });

      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      // Attach tags and analytics
      const enriched = await Promise.all(rows.map(async (row) => {
        const tags = await includeTagsFor(row.id);
        const metrics = await ResourceAnalytics.findOne({ where: { resourceType: DB_RESOURCE_TYPE, resourceId: row.id } });
        return { ...row.toJSON(), tags, metrics };
      }));

      return res.status(200).json({ 
        success: true, 
        message: 'Esl Videos fetched successfully',
        data: enriched,
        pagination: {
          totalPages,
          hasNextPage,
          hasPrevPage,
          currentPage,
          totalItems
        }
      });
    }

    // CURSOR-BASED PAGINATION (for infinity scroll)
    if (cursor) {
      if ((sortOrder || 'DESC').toUpperCase() === 'DESC') where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor) };
      else where.id = { ...(where.id || {}), [Op.gt]: parseInt(cursor) };
    }

    const fetchLimit = parseInt(limit) + 1;
    const order = [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]];
    
    let rows = await EslVideo.findAll({
      where,
      order,
      limit: fetchLimit,
      distinct: true
    });

    const hasMore = rows.length > parseInt(limit);
    const items = hasMore ? rows.slice(0, parseInt(limit)) : rows;

    // Attach tags and analytics
    const enriched = await Promise.all(items.map(async (row) => {
      const tags = await includeTagsFor(row.id);
      const metrics = await ResourceAnalytics.findOne({ where: { resourceType: DB_RESOURCE_TYPE, resourceId: row.id } });
      return { ...row.toJSON(), tags, metrics };
    }));

    const nextCursor = enriched.length > 0 ? enriched[enriched.length - 1].id : null;

    res.status(200).json({ 
      success: true, 
      message: 'Esl Videos fetched successfully',
      data: enriched,
      pagination: {
        nextCursor,
        hasMore,
        itemsPerPage: parseInt(limit),
        totalItemsReturned: enriched.length
      }
    });
  } catch (err) {
    console.error('Error fetching ESL videos:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getEslVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await EslVideo.findByPk(id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    const tags = await includeTagsFor(video.id);
    const metrics = await bumpAnalytics(video.id, 'views', 1);
    res.status(200).json({ success: true, message: 'Esl Video fetched successfully', data: { ...video.toJSON(), tags, metrics } });
  } catch (err) {
    console.error('Error fetching ESL video:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.updateEslVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoRef, description, pdf, level, tags } = req.body;
    const video = await EslVideo.findByPk(id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    const role = req.user?.role;
    
    // Parse tags
    const tagNames = tags !== undefined
      ? (Array.isArray(tags) 
          ? tags.map(t => String(t).trim()).filter(Boolean)
          : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : null;
    
    if (role === 'MAIN_MANAGER') {
      const payload = {};
      if (title !== undefined) payload.title = title;
      if (videoRef !== undefined) payload.videoRef = videoRef;
      if (description !== undefined) payload.description = description;
      if (pdf !== undefined) payload.pdf = pdf;
      if (Array.isArray(req.body?.taskPdfs)) payload.taskPdfs = req.body.taskPdfs;
      if (level !== undefined) payload.level = normalizeLevels(level);
      if (videoRef !== undefined) payload.thumbnailUrl = getYouTubeThumbnail(videoRef);
      if (tagNames !== null) payload.tags = tagNames;
      const approval = await ApprovalRequest.create({
        resourceType: 'EslVideo',
        resourceId: video.id,
        action: 'UPDATE',
        payload,
        status: 'PENDING',
        requestedBy: req.user?.id || 1
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslVideo',
          resourceId: video.id,
          action: 'UPDATE',
          requestedByEmail: req.user?.email,
          changesSummary: Object.keys(payload)
        });
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send update approval email:', notifyErr?.message || notifyErr);
      }
      return res.status(202).json({
        success: true,
        queuedForApproval: true,
        approvalRequestId: approval.id,
        message: 'ESL video update queued for admin approval'
      });
    }

    const payload = { 
      title, 
      videoRef, 
      description, 
      pdf, 
      level: normalizeLevels(level) 
    };
    if (videoRef) payload.thumbnailUrl = getYouTubeThumbnail(videoRef);
    
    // Update tags array column if tags were provided
    if (tagNames !== null) {
      payload.tags = tagNames.length ? tagNames : null;
    }
    
    await video.update(payload);

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'esl_video', resourceId: video.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }
    
    // Sync join table if tags were provided
    if (tagNames !== null) {
      await ResourceTag.destroy({ where: { resourceType: DB_RESOURCE_TYPE, resourceId: id } });
      if (tagNames.length) await attachTags(video.id, tagNames);
    }
    
    const tagList = await includeTagsFor(video.id);
    res.status(200).json({ success: true, message: 'Esl Video Updated Successfully', data: { ...video.toJSON(), tags: tagList } });
  } catch (err) {
    console.error('Error updating ESL video:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.deleteEslVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await EslVideo.findByPk(id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    const role = req.user?.role;
    if (role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'EslVideo',
        resourceId: video.id,
        action: 'DELETE',
        payload: {},
        status: 'PENDING',
        requestedBy: req.user?.id || 1
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslVideo',
          resourceId: video.id,
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
        message: 'ESL video deletion queued for admin approval'
      });
    }
    // use DB_RESOURCE_TYPE for cleanup
    await ResourceTag.destroy({ where: { resourceType: DB_RESOURCE_TYPE, resourceId: id } });
    await ResourceAnalytics.destroy({ where: { resourceType: DB_RESOURCE_TYPE, resourceId: id } });
    await video.destroy();
    res.status(200).json({ success: true, message: 'Esl Video deleted Successfully' });
  } catch (err) {
    console.error('Error deleting ESL video:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};
