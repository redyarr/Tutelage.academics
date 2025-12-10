// ============================================================================
// BLOG CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for blog posts with pagination
// support for infinite scrolling functionality.
// ============================================================================

const { Blog, User, Tag, ResourceTag, ApprovalRequest, TaskPdf } = require('../models');
const { sendApprovalRequestNotification } = require('../config/email');
const { Op } = require('sequelize');
const { getTasks } = require('../scripts/fetchTasks');
const taskPdf = require('../models/taskPdf');

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

// Helper functions for tags - change 'blog' to 'reading' to match existing enum
async function attachTags(resourceId, tagNames = []) {
  if (!tagNames?.length) return;
  const existing = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const existingNames = new Set(existing.map(t => t.name));
  const toCreate = tagNames.filter(n => !existingNames.has(n)).map(name => ({ name, namespace: 'reading' }));
  if (toCreate.length) await Tag.bulkCreate(toCreate);
  const allTags = await Tag.findAll({ where: { name: { [Op.in]: tagNames } } });
  const mappings = allTags.map(tag => ({ resourceType: 'reading', resourceId, tagId: tag.id }));
  for (const m of mappings) {
    const exists = await ResourceTag.findOne({ where: m });
    if (!exists) await ResourceTag.create(m);
  }
}

async function includeTagsFor(resourceId) {
  const rts = await ResourceTag.findAll({ where: { resourceType: 'reading', resourceId } });
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
  const mappings = await ResourceTag.findAll({ where: { resourceType: 'reading', tagId: { [Op.in]: tagIds } } });
  return [...new Set(mappings.map(m => m.resourceId))];
}

/**
 * Create a new blog post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createBlog = async (req, res) => {
  try {
    console.log('🎯 createBlog called');
    console.log('👤 User:', { id: req.user.id, role: req.user.role });
    console.log('📥 req.body keys:', Object.keys(req.body));
    console.log('📥 req.body.taskPdfs:', req.body.taskPdfs);
    console.log('📥 req.files:', req.files);
    
    const { title, content, imageRef, imageUrl, imageurl, category, tag, tags, description, discription, desccription, level } = req.body;
    const createdBy = req.user.id;
    const role = req.user.role;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Normalize level(s) to an array of CEFR labels
    const normalizedLevels = normalizeLevels(level);

    // Get PDF URLs from middleware (pdfUpload already processed them into req.body)
    const { pdf } = req.body;
    
    // Handle multiple taskPdfs - already processed by middleware
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    console.log('📎 taskPdfsArray from middleware:', taskPdfsArray.length, 'files');

    // MAIN_MANAGER users queue creation for approval
    if (role === 'MAIN_MANAGER') {
      const payload = {
        title,
        content,
        imageRef: imageRef ?? imageUrl ?? imageurl ?? null,
        category: category ?? tag ?? null,
        description: description ?? discription ?? desccription ?? null,
        level: normalizedLevels,
        pdf: pdf || null,
        taskPdfs: taskPdfsArray,
        tags: Array.isArray(tags)
          ? tags
          : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [])
      };
      const approval = await ApprovalRequest.create({
        resourceType: 'Blog',
        resourceId: null,
        action: 'CREATE',
        payload,
        status: 'PENDING',
        requestedBy: createdBy
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Blog',
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
        message: 'Blog creation queued for admin approval'
      });
    }

    const blog = await Blog.create({
      title,
      content,
      imageRef: imageRef ?? imageUrl ?? imageurl ?? null,
      category: category ?? tag ?? null,
      description: description ?? discription ?? desccription ?? null,
      level: normalizedLevels,
      pdf: pdf || null,
      createdBy
    });

    // Handle multiple task PDFs
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'task PDFs for blog creation...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'blog', 
          resourceId: blog.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      console.log('📎 Rows to insert:', rows.length);
      if (rows.length) {
        const created = await TaskPdf.bulkCreate(rows);
        console.log('✅', created.length, 'task PDFs created successfully');
      }
    } else {
      console.log('ℹ️ No task PDFs to create');
    }

    // Handle tags
    const tagNames = Array.isArray(tags)
      ? tags
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    if (tagNames.length) await attachTags(blog.id, tagNames);

    // Fetch the created blog with author information
    const blogWithAuthor = await Blog.findByPk(blog.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    const tagList = await includeTagsFor(blog.id);

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: { ...blogWithAuthor.toJSON(), tags: tagList }
    });
  } catch (error) {
    console.error('❌ Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all blog posts with infinite scroll pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllBlogs = async (req, res) => {
  try {
    const {
      cursor,
      limit = 9,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    // Optional level filter: supports comma-separated string or repeated query params
    const levelParam = req.query.level;
    const levelsFilter = normalizeLevels(levelParam);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    // Tag filtering
    const tagParam = req.query.tags;
    if (tagParam) {
      const idFilter = await getTagFilterIds(tagParam);
      if (Array.isArray(idFilter)) {
        whereClause.id = { ...(whereClause.id || {}), [Op.in]: idFilter };
      }
    }

    // Add cursor condition for infinite scroll
    if (cursor) {
      if (sortOrder.toUpperCase() === 'DESC') {
        whereClause.id = { ...whereClause.id, [Op.lt]: parseInt(cursor) };
      } else {
        whereClause.id = { ...whereClause.id, [Op.gt]: parseInt(cursor) };
      }
    }
    // Fetch one extra item to check if there are more items
    const fetchLimit = parseInt(limit) + 1;
    const blogs = await Blog.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      },
      { model: TaskPdf, as: 'taskPdfs' }
    ],
      limit: fetchLimit,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()]
      ],
      distinct: true
    });
    // Check if there are more items
    const hasMore = blogs.length > parseInt(limit);
    // Remove the extra item if it exists
    const items = hasMore ? blogs.slice(0, parseInt(limit)) : blogs;
    // Get the cursor for the next request (ID of the last item)
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    // Enrich with tags
    const enriched = await Promise.all(items.map(async (b) => {
      const tagList = await includeTagsFor(b.id);
      return { ...b.toJSON(), tags: tagList };
    }));

    res.status(200).json({
      success: true,
      blogs: enriched,
      hasMore,
      nextCursor
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get a single blog post by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      },
    {
      model: TaskPdf, as: 'taskPdfs'
    }]
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    const tagList = await includeTagsFor(blog.id);
    const tasks = await getTasks(blog.id, "blog");

    res.status(200).json({
      success: true,
      data: { ...blog.toJSON(), tags: tagList, tasks }
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update a blog post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBlog = async (req, res) => {
  try {
    console.log('🎯 updateBlog called for blog ID:', req.params.id);
    console.log('👤 User:', { id: req.user.id, role: req.user.role });
    console.log('📥 req.body keys:', Object.keys(req.body));
    console.log('📥 req.body.taskPdfs:', req.body.taskPdfs);
    console.log('📥 req.body.deletedTaskPdfIds:', req.body.deletedTaskPdfIds);
    console.log('📥 req.files:', req.files);
    
    const { id } = req.params;
    const { title, content, imageRef, imageUrl, imageurl, category, tag, tags, description, discription, desccription, level, deletedTaskPdfIds } = req.body;

    const blog = await Blog.findByPk(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const normalizedLevelUpdate = level !== undefined ? normalizeLevels(level) : blog.level;
      const pdfUrl = req.body.pdf || blog.pdf;
      const taskPdfsPayload = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : undefined;

      const payload = {
        title: title ?? blog.title,
        content: content ?? blog.content,
        imageRef: (imageRef ?? imageUrl ?? imageurl ?? blog.imageRef),
        category: (category ?? tag ?? blog.category),
        description: (description ?? discription ?? desccription ?? blog.description),
        level: normalizedLevelUpdate,
        pdf: pdfUrl,
        taskPdfs: taskPdfsPayload,
        deletedTaskPdfIds: deletedTaskPdfIds ? JSON.parse(deletedTaskPdfIds) : [],
        tags: (tags !== undefined)
          ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
          : undefined
      };

      const approval = await ApprovalRequest.create({
        resourceType: 'Blog',
        resourceId: blog.id,
        action: 'UPDATE',
        payload,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        const changedKeys = Object.keys(payload).filter(k => payload[k] !== undefined);
        await sendApprovalRequestNotification({
          resourceType: 'Blog',
          resourceId: blog.id,
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
        message: 'You can only update your own blog posts'
      });
    }

    // Normalize level(s) if provided
    const normalizedLevelUpdate = level !== undefined
      ? normalizeLevels(level)
      : blog.level;

    // Get PDF URLs from middleware
    const pdfUrl = req.body.pdf || blog.pdf;
    const taskPdfsArray = Array.isArray(req.body?.taskPdfs) ? req.body.taskPdfs : [];
    console.log('📎 taskPdfsArray from middleware:', taskPdfsArray.length, 'files');

    // Handle deletion of existing task PDFs
    if (deletedTaskPdfIds) {
      console.log('🗑️ Processing deletedTaskPdfIds...');
      try {
        const idsToDelete = JSON.parse(deletedTaskPdfIds);
        console.log('🗑️ Parsed IDs to delete:', idsToDelete);
        if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
          const deleteResult = await TaskPdf.destroy({
            where: {
              id: { [Op.in]: idsToDelete },
              resourceType: 'blog',
              resourceId: blog.id
            }
          });
          console.log(`✅ Deleted ${deleteResult} task PDFs (requested: ${idsToDelete.length})`);
        } else {
          console.log('⚠️ No valid IDs to delete');
        }
      } catch (parseErr) {
        console.error('❌ Error parsing deletedTaskPdfIds:', parseErr);
      }
    } else {
      console.log('ℹ️ No deletedTaskPdfIds provided');
    }

    await blog.update({
      title: title || blog.title,
      content: content || blog.content,
      imageRef: (imageRef ?? imageUrl ?? imageurl ?? blog.imageRef),
      category: (category ?? tag ?? blog.category),
      description: (description ?? discription ?? desccription ?? blog.description),
      level: normalizedLevelUpdate,
      pdf: pdfUrl
    });

    // Handle multiple task PDFs - append to existing ones
    if (taskPdfsArray.length) {
      console.log('📎 Processing', taskPdfsArray.length, 'new task PDFs...');
      const rows = taskPdfsArray
        .filter(p => p && p.filePath && p.fileName)
        .map(p => ({ 
          resourceType: 'blog', 
          resourceId: blog.id, 
          filePath: p.filePath, 
          fileName: p.fileName, 
          fileSize: p.fileSize || null, 
          uploadDate: p.uploadDate ? new Date(p.uploadDate) : new Date() 
        }));
      console.log('📎 Filtered rows:', rows.length);
      if (rows.length) {
        const createResult = await TaskPdf.bulkCreate(rows);
        console.log(`✅ Added ${createResult.length} new task PDFs`);
      } else {
        console.log('⚠️ No valid rows to insert');
      }
    } else {
      console.log('ℹ️ No new task PDFs to add');
    }

    // Update tags
    if (tags !== undefined) {
      const tagNames = Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean);
      await ResourceTag.destroy({ where: { resourceType: 'reading', resourceId: blog.id } });
      if (tagNames.length) await attachTags(blog.id, tagNames);
    }

    // Fetch updated blog with author information and task PDFs
    const updatedBlog = await Blog.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      },
      { model: TaskPdf, as: 'taskPdfs' }]
    });

    const tagList = await includeTagsFor(blog.id);

    res.status(200).json({
      success: true,
      message: 'Blog post updated successfully',
      data: { ...updatedBlog.toJSON(), tags: tagList }
    });
  } catch (error) {
    console.error('❌ Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete a blog post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Role handling: MAIN_MANAGER queues approval, ADMIN applies immediately
    if (req.user.role === 'MAIN_MANAGER') {
      const approval = await ApprovalRequest.create({
        resourceType: 'Blog',
        resourceId: blog.id,
        action: 'DELETE',
        payload: null,
        requestedBy: req.user.id,
        status: 'PENDING'
      });
      try {
        await sendApprovalRequestNotification({
          resourceType: 'Blog',
          resourceId: blog.id,
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
        message: 'You can only delete your own blog posts'
      });
    }

    await blog.destroy();

    res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete ALL blog posts (USE WITH CAUTION - DEVELOPMENT ONLY)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAllBlogs = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete all blogs'
      });
    }

    const deletedCount = await Blog.destroy({
      where: {},
      truncate: false
    });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} blog posts`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting all blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get blogs by category with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
/**
 * Get all blog posts with pagination (for React frontend)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaginatedBlogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    // Optional level filter: supports comma-separated string or repeated query params
    const levelParam = req.query.level;
    const levelsFilter = normalizeLevels(levelParam);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    console.log('🔍 Starting getPaginatedBlogs query...');
    console.log('📊 Query parameters:', { page, limit, offset });
    console.log('🔎 Where clause:', whereClause);
    
    const { count, rows } = await Blog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });
    
    console.log('📈 Query results:', { count, rowsLength: rows.length });
    console.log('📝 First blog (if any):', rows[0] ? rows[0].toJSON() : 'No blogs found');
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        blogs: rows,
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
    console.error('Error fetching paginated blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getBlogsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const whereClause = { category };
    const levelParam = req.query.level;
    const levelsFilter = normalizeLevels(levelParam);
    if (levelsFilter) {
      whereClause.level = { [Op.overlap]: levelsFilter };
    }

    const { count, rows } = await Blog.findAndCountAll({
      where: whereClause,
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
        blogs: rows,
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
    console.error('Error fetching blogs by category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getPaginatedBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  deleteAllBlogs,
  getBlogsByCategory
};
