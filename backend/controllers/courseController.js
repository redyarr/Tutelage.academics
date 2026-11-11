// ============================================================================
// COURSE CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for course content including
// creation, retrieval with pagination, updating, and deletion.
// ============================================================================

const { Course, User } = require('../models');
const { Op } = require('sequelize');

// ============================================================================
// CREATE COURSE
// ============================================================================
/**
 * Create a new course
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createCourse = async (req, res) => {
  try {
    const { category, title, description, introVideoRef } = req.body;
    
    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // Create course with authenticated user as author
    const course = await Course.create({
      category,
      title,
      description,
      introVideoRef,
      createdBy: req.user.id
    });

    // Fetch the created course with author information
    const courseWithAuthor = await Course.findByPk(course.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: courseWithAuthor
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL COURSES WITH INFINITE SCROLL PAGINATION
// ============================================================================
/**
 * Get all courses with infinite scroll pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllCourses = async (req, res) => {
  try {
    const {
      cursor, // For cursor-based pagination (ID of last item)
      limit = 10,
      search = '',
      category = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (category) {
      whereClause.category = { [Op.iLike]: `%${category}%` };
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

    const courses = await Course.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      limit: fetchLimit,
      distinct: true
    });

    // Check if there are more items
    const hasMore = courses.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? courses.slice(0, parseInt(limit)) : courses;
    
    // Get the cursor for the next request (ID of the last item)
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        nextCursor,
        hasMore,
        itemsPerPage: parseInt(limit),
        totalItemsReturned: items.length
      }
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL COURSES WITH PAGINATION (FOR REACT FRONTEND)
// ============================================================================
/**
 * Get all courses with pagination (for React frontend)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPaginatedCourses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      category,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (category) {
      whereClause.category = { [Op.iLike]: `%${category}%` };
    }

    const { count, rows } = await Course.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: {
        courses: rows,
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
    console.error('Error fetching paginated courses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET COURSE BY ID
// ============================================================================
/**
 * Get a specific course by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// UPDATE COURSE
// ============================================================================
/**
 * Update a course
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, description, introVideoRef } = req.body;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the author or admin
    if (course.createdBy !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own courses'
      });
    }

    // Update course
    await course.update({
      category: category || course.category,
      title: title || course.title,
      description: description || course.description,
      introVideoRef: introVideoRef || course.introVideoRef
    });

    // Fetch updated course with author information
    const updatedCourse = await Course.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: updatedCourse
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// DELETE COURSE
// ============================================================================
/**
 * Delete a course
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the author or admin
    if (course.createdBy !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own courses'
      });
    }

    await course.destroy();

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET COURSES BY CATEGORY
// ============================================================================
/**
 * Get courses by category with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCoursesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Course.findAndCountAll({
      where: {
        category: { [Op.iLike]: `%${category}%` }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching courses by category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// SEARCH COURSES BY TITLE
// ============================================================================
/**
 * Search courses by title with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchCoursesByTitle = async (req, res) => {
  try {
    const { query } = req.query;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Course.findAndCountAll({
      where: {
        title: { [Op.iLike]: `%${query}%` }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error searching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};