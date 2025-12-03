// ============================================================================
// ESL AUDIO CONTROLLER
// ============================================================================
// CRUD, search, filter, sort, tag assignment, transcript search, analytics.

const { EslAudio, Tag, ResourceTag, ResourceAnalytics, ApprovalRequest } = require('../models');
const { Op } = require('sequelize');
const { sendApprovalRequestNotification } = require('../config/email');

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
  await ResourceTag.destroy({ where: { resourceType: 'audio', resourceId } });
  await ResourceTag.bulkCreate(tagIds.map(tagId => ({ resourceType: 'audio', resourceId, tagId })));
};

const includeTagsFor = async (resourceId) => {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'audio', resourceId } });
  if (!rts.length) return [];
  const tagIds = rts.map(rt => rt.tagId);
  const tags = await Tag.findAll({ where: { id: { [Op.in]: tagIds } } });
  return tags.map(t => t.name);
};

const bumpAnalytics = async (resourceId, field = 'plays', amount = 1) => {
  const [row] = await ResourceAnalytics.findOrCreate({
    where: { resourceType: 'audio', resourceId },
    defaults: { resourceType: 'audio', resourceId, views: 0, plays: 0, downloads: 0 }
  });
  row[field] = (row[field] || 0) + amount;
  await row.save();
  return row;
};

exports.createEslAudio = async (req, res) => {
  try {
    const { title, imageUrl, description, transcript, audioRef, pdf, level, tags } = req.body;
    const createdBy = req.user?.id || 1;
    const role = req.user?.role;
    
    // Parse tags from request body (can be array or comma-separated string)
    const tagNames = Array.isArray(tags) 
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    
    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        imageUrl,
        description,
        transcript,
        audioRef,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        level: normalizeLevels(level),
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'EslAudio',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslAudio',
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
        message: 'ESL audio creation queued for admin approval'
      });
    }

    // Create audio WITHOUT tags array column first
    const audio = await EslAudio.create({ 
      title, 
      imageUrl, 
      description, 
      transcript, 
      audioRef, 
      pdf, 
      level: normalizeLevels(level), 
      createdBy 
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'esl_audio', resourceId: audio.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }
    
    // Attach tags to join table
    if (tagNames.length > 0) {
      await attachTags(audio.id, tagNames);
    }
    
    // Fetch tags from join table for response
    const tagList = await includeTagsFor(audio.id);
    res.status(201).json({ success: true,message: "Esl Audio Created Successfully", data: { ...audio.toJSON(), tags: tagList } });
  } catch (err) {
    console.error('Error creating ESL audio:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getAllEslAudios = async (req, res) => {
  try {
    const { cursor, page, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC', limit = 9 } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { transcript: { [Op.like]: `%${search}%` } }
      ];
    }
    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) where.level = { [Op.overlap]: levelsFilter };

    // Tag filtering
    let idFilter = null;
    if (tags) {
      const tagNames = String(tags).split(',').map(t => t.trim()).filter(Boolean);
      const tagRows = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
      const tagIds = tagRows.map(t => t.id);
      if (tagIds.length) {
        const rtRows = await ResourceTag.findAll({ where: { resourceType: 'audio', tagId: { [Op.in]: tagIds } } });
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

      const totalItems = await EslAudio.count({ where, distinct: true });
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      const rows = await EslAudio.findAll({
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
        const tagList = await includeTagsFor(row.id);
        const metrics = await ResourceAnalytics.findOne({ where: { resourceType: 'audio', resourceId: row.id } });
        return { ...row.toJSON(), tags: tagList, metrics };
      }));

      return res.status(200).json({ 
        success: true, 
        message: 'ESL Audios fetched successfully',
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
    
    let rows = await EslAudio.findAll({
      where,
      order,
      limit: fetchLimit,
      distinct: true
    });

    const hasMore = rows.length > parseInt(limit);
    const items = hasMore ? rows.slice(0, parseInt(limit)) : rows;

    // Attach tags and analytics
    const enriched = await Promise.all(items.map(async (row) => {
      const tagList = await includeTagsFor(row.id);
      const metrics = await ResourceAnalytics.findOne({ where: { resourceType: 'audio', resourceId: row.id } });
      return { ...row.toJSON(), tags: tagList, metrics };
    }));

    const nextCursor = enriched.length > 0 ? enriched[enriched.length - 1].id : null;

    res.status(200).json({ 
      success: true, 
      message: 'ESL Audios fetched successfully',
      data: enriched,
      pagination: {
        nextCursor,
        hasMore,
        itemsPerPage: parseInt(limit),
        totalItemsReturned: enriched.length
      }
    });
  } catch (err) {
    console.error('Error fetching ESL audios:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getEslAudioById = async (req, res) => {
  try {
    const { id } = req.params;
    const audio = await EslAudio.findByPk(id);
    if (!audio) return res.status(404).json({ success: false, message: 'Audio not found' });
    const tags = await includeTagsFor(audio.id);
    const metrics = await bumpAnalytics(audio.id, 'views', 1); // count a detail view
    res.status(200).json({ success: true, data: { ...audio.toJSON(), tags, metrics } });
  } catch (err) {
    console.error('Error fetching ESL audio:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.updateEslAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, imageUrl, description, transcript, audioRef, pdf, level, tags } = req.body;
    const audio = await EslAudio.findByPk(id);
    if (!audio) return res.status(404).json({ success: false, message: 'Audio not found' });
    const role = req.user?.role;
    
    // Parse tags from request body (can be array or comma-separated string)
    const tagNames = tags !== undefined
      ? (Array.isArray(tags) 
          ? tags.map(t => String(t).trim()).filter(Boolean)
          : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : null;

    if (role === 'MAIN_MANAGER') {
      const payload = {};
      if (title !== undefined) payload.title = title;
      if (imageUrl !== undefined) payload.imageUrl = imageUrl;
      if (description !== undefined) payload.description = description;
      if (transcript !== undefined) payload.transcript = transcript;
      if (audioRef !== undefined) payload.audioRef = audioRef;
      if (pdf !== undefined) payload.pdf = pdf;
      if (Array.isArray(req.body?.taskPdfs)) payload.taskPdfs = req.body.taskPdfs;
      if (level !== undefined) payload.level = normalizeLevels(level);
      if (tagNames !== null) payload.tags = tagNames;
      const approval = await ApprovalRequest.create({
        resourceType: 'EslAudio',
        resourceId: audio.id,
        action: 'UPDATE',
        payload,
        status: 'PENDING',
        requestedBy: req.user?.id || 1
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslAudio',
          resourceId: audio.id,
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
        message: 'ESL audio update queued for admin approval'
      });
    }
    
    await audio.update({ 
      title, 
      imageUrl, 
      description, 
      transcript, 
      audioRef, 
      pdf, 
      level: normalizeLevels(level) 
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'esl_audio', resourceId: audio.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }
    
    // Update tags if provided
    if (tagNames !== null) {
      // Clear existing tags first
      await ResourceTag.destroy({ where: { resourceType: 'audio', resourceId: id } });
      // Add new tags
      if (tagNames.length > 0) {
        await attachTags(audio.id, tagNames);
      }
    }
    
    // Fetch updated tags from join table
    const tagList = await includeTagsFor(audio.id);
    res.status(200).json({ success: true,message : 'Esl Audio Updated Successfully', data: { ...audio.toJSON(), tags: tagList } });
  } catch (err) {
    console.error('Error updating ESL audio:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.deleteEslAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const audio = await EslAudio.findByPk(id);
    if (!audio) return res.status(404).json({ success: false, message: 'Audio not found' });
    const role = req.user?.role;
    if (role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'EslAudio',
        resourceId: audio.id,
        action: 'DELETE',
        payload: {},
        status: 'PENDING',
        requestedBy: req.user?.id || 1
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'EslAudio',
          resourceId: audio.id,
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
        message: 'ESL audio deletion queued for admin approval'
      });
    }
    await ResourceTag.destroy({ where: { resourceType: 'audio', resourceId: id } });
    await ResourceAnalytics.destroy({ where: { resourceType: 'audio', resourceId: id } });
    await audio.destroy();
    res.status(200).json({ success: true, message: 'Esl Audio deleted Successfully' });
  } catch (err) {
    console.error('Error deleting ESL audio:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

// Optional: Search by transcript only
exports.searchEslAudioByTranscript = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Missing query' });
    const rows = await EslAudio.findAll({ where: { transcript: { [Op.like]: `%${query}%` } }, limit: 50 });
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Error searching ESL audio transcript:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};
