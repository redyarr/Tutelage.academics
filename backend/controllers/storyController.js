// ============================================================================
// STORY CONTROLLER
// ============================================================================
// Handles CRUD operations, search/filter/sort for stories.

const { Story, User, ResourceTag, Tag, ResourceAnalytics, Sequelize, ApprovalRequest } = require('../models');
const { sendApprovalRequestNotification } = require('../config/email');
const { Op } = require('sequelize');

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
  // Ensure tags exist
  const existing = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const existingNames = new Set(existing.map(t => t.name));
  const toCreate = tagNames.filter(n => !existingNames.has(n)).map(name => ({ name, namespace: 'story' }));
  if (toCreate.length) {
    await Tag.bulkCreate(toCreate);
  }
  const allTags = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const mappings = allTags.map(tag => ({ resourceType: 'story', resourceId, tagId: tag.id }));
  // Upsert-like: insert missing, ignore duplicates
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
  const mappings = await ResourceTag.findAll({ where: { resourceType: 'story', tagId: { [Op.in]: tagIds } } });
  return [...new Set(mappings.map(m => m.resourceId))];
}

async function ensureAnalytics(resourceId) {
  const [row] = await ResourceAnalytics.findOrCreate({
    where: { resourceType: 'story', resourceId },
    defaults: { views: 0, plays: 0, downloads: 0 }
  });
  return row;
}

exports.createStory = async (req, res) => {
  try {
    const { title, imageUrl, description, contentText, audioRef, pdf, wordCount, level, tags } = req.body;
    const createdBy = req.user.id;
    const role = req.user.role;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const normalizedLevel = normalizeLevels(level);
    
    // Properly handle wordCount - ensure it's either a valid integer or null
    let wc;
    if (wordCount !== undefined) {
      const parsed = parseInt(wordCount);
      wc = (!isNaN(parsed) && parsed > 0) ? parsed : null;
    } else if (contentText) {
      wc = String(contentText).split(/\s+/).filter(Boolean).length;
    } else {
      wc = null;
    }

    // Parse tags properly - handle both array and comma-separated string
    const tagNames = Array.isArray(tags) 
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);

    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        imageUrl,
        description,
        contentText,
        audioRef,
        pdf,
        taskPdfs: Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [],
        wordCount: wc,
        level: normalizedLevel,
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Story',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Story',
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
        message: 'Story creation queued for admin approval'
      });
    }

    const story = await Story.create({
      title, imageUrl, description, contentText, audioRef, pdf, wordCount: wc, level: normalizedLevel, createdBy
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'story', resourceId: story.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }

    // Attach tags only if we have valid tag names
    if (tagNames.length > 0) {
      await attachTags(story.id, tagNames);
    }

    const storyWithAuthor = await Story.findByPk(story.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }]
    });
    res.status(201).json({ success: true, message: 'Story created Successfully', data: storyWithAuthor });
  } catch (err) {
    console.error('Error creating story:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getAllStories = async (req, res) => {
  try {
    const { cursor, page, limit = 10, search, level, tags, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { contentText: { [Op.like]: `%${search}%` } }
      ];
    }
    const levelsFilter = normalizeLevels(level);
    if (levelsFilter) where.level = { [Op.overlap]: levelsFilter };

    let idFilter = null;
    if (tags) idFilter = await getTagFilterIds(tags);
    if (Array.isArray(idFilter)) where.id = { [Op.in]: idFilter };

    // PAGE-BASED PAGINATION
    if (page !== undefined) {
      const currentPage = parseInt(page);
      const itemsPerPage = parseInt(limit);
      const offset = (currentPage - 1) * itemsPerPage;

      const { count, rows } = await Story.findAndCountAll({
        where,
        include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
        limit: itemsPerPage,
        offset: offset,
        order: [[sortBy, (sortOrder || 'DESC').toUpperCase()], ['id', (sortOrder || 'DESC').toUpperCase()]],
        distinct: true
      });

      if (sortBy === 'popularity') {
        const ids = rows.map(s => s.id);
        const metrics = await ResourceAnalytics.findAll({ where: { resourceType: 'story', resourceId: { [Op.in]: ids } } });
        const map = new Map(metrics.map(m => [m.resourceId, m.views]));
        rows.sort((a,b) => (map.get(b.id) || 0) - (map.get(a.id) || 0));
      }

      const totalPages = Math.ceil(count / itemsPerPage);
      return res.status(200).json({ 
        success: true, 
        message: 'Stories fetched successfully',
        data: { 
          stories: rows, 
          pagination: { 
            currentPage, 
            totalPages, 
            totalItems: count, 
            itemsPerPage, 
            hasNextPage: currentPage < totalPages, 
            hasPrevPage: currentPage > 1 
          } 
        } 
      });
    }

    // CURSOR-BASED PAGINATION (for infinity scroll)
    if (cursor) {
      if ((sortOrder || 'DESC').toUpperCase() === 'DESC') where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor) };
      else where.id = { ...(where.id || {}), [Op.gt]: parseInt(cursor) };
    }

    const fetchLimit = parseInt(limit) + 1;
    let stories = await Story.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
      limit: fetchLimit,
      order: [[sortBy, (sortOrder || 'DESC').toUpperCase()], ['id', (sortOrder || 'DESC').toUpperCase()]],
      distinct: true
    });

    if (sortBy === 'popularity') {
      const ids = stories.map(s => s.id);
      const metrics = await ResourceAnalytics.findAll({ where: { resourceType: 'story', resourceId: { [Op.in]: ids } } });
      const map = new Map(metrics.map(m => [m.resourceId, m.views]));
      stories.sort((a,b) => (map.get(b.id) || 0) - (map.get(a.id) || 0));
    }

    const hasMore = stories.length > parseInt(limit);
    const items = hasMore ? stories.slice(0, parseInt(limit)) : stories;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;
    res.status(200).json({ success: true, data: { stories: items, pagination: { nextCursor, hasMore, itemsPerPage: parseInt(limit), totalItemsReturned: items.length } } });
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.getStoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findByPk(id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }] });
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });
    const analytics = await ensureAnalytics(story.id);
    await analytics.update({ views: analytics.views + 1 });
    // Attach tag names
    const mappings = await ResourceTag.findAll({ where: { resourceType: 'story', resourceId: story.id }, include: [{ model: Tag, as: 'tag' }] });
    const tagNames = mappings.map(m => m.tag?.name).filter(Boolean);
    res.status(200).json({ success: true, message: "Story Fetched Successfully" , data: { story, tags: tagNames } });
  } catch (err) {
    console.error('Error fetching story:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.updateStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, imageUrl, description, contentText, audioRef, pdf, wordCount, level, tags } = req.body;
    const story = await Story.findByPk(id);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });
    const role = req.user.role;
    if (role === 'MAIN_MANAGER') {
      const normalizedLevel = level !== undefined ? normalizeLevels(level) : story.level;
      let wc;
      if (wordCount !== undefined) {
        const parsed = parseInt(wordCount);
        wc = (!isNaN(parsed) && parsed > 0) ? parsed : null;
      } else if (contentText !== undefined && contentText) {
        wc = String(contentText).split(/\s+/).filter(Boolean).length;
      } else {
        wc = story.wordCount;
      }
      const tagNames = Array.isArray(tags)
        ? tags.map(t => String(t).trim()).filter(Boolean)
        : (tags !== undefined ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : undefined);
      const payload = {
        title,
        imageUrl,
        description,
        contentText,
        audioRef,
        pdf,
        wordCount: wc,
        level: normalizedLevel,
        tags: tagNames
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Story',
        resourceId: story.id,
        action: 'UPDATE',
        payload,
        status: 'PENDING',
        requestedBy: req.user.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Story',
          resourceId: story.id,
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
        message: 'Story update queued for admin approval'
      });
    }
    if (role !== 'ADMIN') return res.status(403).json({ success: false, message: 'You can only update your own stories' });
    
    const normalizedLevel = level !== undefined ? normalizeLevels(level) : story.level;
    
    // Properly handle wordCount - ensure it's either a valid integer or null
    let wc;
    if (wordCount !== undefined) {
      // If wordCount is provided but empty/invalid, set to null
      const parsed = parseInt(wordCount);
      wc = (!isNaN(parsed) && parsed > 0) ? parsed : null;
    } else if (contentText !== undefined && contentText) {
      // Auto-calculate from contentText if provided
      wc = String(contentText).split(/\s+/).filter(Boolean).length;
    } else {
      // Keep existing wordCount
      wc = story.wordCount;
    }
    
    await story.update({
      title: title ?? story.title,
      imageUrl: imageUrl ?? story.imageUrl,
      description: description ?? story.description,
      contentText: contentText ?? story.contentText,
      audioRef: audioRef ?? story.audioRef,
      pdf: pdf ?? story.pdf,
      wordCount: wc,
      level: normalizedLevel
    });

    if (Array.isArray(req.body?.taskPdfs) && req.body.taskPdfs.length) {
      const rows = req.body.taskPdfs
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ resourceType: 'story', resourceId: story.id, filePath: p.filePath, fileName: p.fileName, fileSize: p.fileSize || null, uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() }));
      if (rows.length) {
        const { TaskPdf } = require('../models');
        await TaskPdf.bulkCreate(rows);
      }
    }
    
    if (tags) {
      // Reset tags then attach
      await ResourceTag.destroy({ where: { resourceType: 'story', resourceId: story.id } });
      await attachTags(story.id, Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean));
    }
    const updated = await Story.findByPk(id, { include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }] });
    res.status(200).json({ success: true, message: 'Story updated successfully', data: updated });
  } catch (err) {
    console.error('Error updating story:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findByPk(id);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });
    const role = req.user.role;
    if (role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Story',
        resourceId: story.id,
        action: 'DELETE',
        payload: {},
        status: 'PENDING',
        requestedBy: req.user.id
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Story',
          resourceId: story.id,
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
        message: 'Story deletion queued for admin approval'
      });
    }
    if (role !== 'ADMIN') return res.status(403).json({ success: false, message: 'You can only delete your own stories' });
    await ResourceTag.destroy({ where: { resourceType: 'story', resourceId: id } });
    await ResourceAnalytics.destroy({ where: { resourceType: 'story', resourceId: id } });
    await story.destroy();
    res.status(200).json({ success: true, message: 'Story deleted successfully' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

exports.searchStories = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    if (!query) return res.status(400).json({ success: false, message: 'Search query is required' });
    const { count, rows } = await Story.findAndCountAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
          { contentText: { [Op.like]: `%${query}%` } }
        ]
      },
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      distinct: true
    });
    const totalPages = Math.ceil(count / limit);
    res.status(200).json({ success: true, data: { stories: rows, pagination: { currentPage: parseInt(page), totalPages, totalItems: count, itemsPerPage: parseInt(limit), hasNextPage: page < totalPages, hasPrevPage: page > 1 } } });
  } catch (err) {
    console.error('Error searching stories:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};
