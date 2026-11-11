// ============================================================================
// TEST CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for test content including
// creation, retrieval with pagination, updating, and deletion.
// ============================================================================

const { Test, User, TestQuestion, TestResult } = require('../models');
const { Op } = require('sequelize');

// ============================================================================
// CREATE TEST
// ============================================================================
/**
 * Create a new test
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createTest = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Create test with authenticated user as author
    const test = await Test.create({
      title,
      description,
      createdBy: req.user.id
    });

    // Fetch the created test with author information
    const testWithAuthor = await Test.findByPk(test.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: testWithAuthor
    });
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL TESTS WITH INFINITE SCROLL PAGINATION
// ============================================================================
/**
 * Get all tests with infinite scroll pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllTests = async (req, res) => {
  try {
    const {
      cursor, // For cursor-based pagination (ID of last item)
      limit = 10,
      search = '',
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

    const tests = await Test.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'email']
        },
        {
          model: TestQuestion,
          as: 'questions',
          attributes: ['id', 'questionText']
        }
      ],
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      limit: fetchLimit,
      distinct: true
    });

    // Check if there are more items
    const hasMore = tests.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? tests.slice(0, parseInt(limit)) : tests;
    
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
    console.error('Error fetching tests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET TEST BY ID
// ============================================================================
/**
 * Get a specific test by ID with questions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTestById = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'email']
        },
        {
          model: TestQuestion,
          as: 'questions',
          attributes: ['id', 'questionText']
        },
        {
          model: TestResult,
          as: 'results',
          attributes: ['id', 'score', 'totalQuestions', 'createdAt'],
          include: [{
            model: User,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// UPDATE TEST
// ============================================================================
/**
 * Update a test
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const test = await Test.findByPk(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user is the author or admin
    if (test.createdBy !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tests'
      });
    }

    // Update test
    await test.update({
      title: title || test.title,
      description: description || test.description
    });

    // Fetch updated test with author information
    const updatedTest = await Test.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(200).json({
      success: true,
      message: 'Test updated successfully',
      data: updatedTest
    });
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// DELETE TEST
// ============================================================================
/**
 * Delete a test
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByPk(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if user is the author or admin
    if (test.createdBy !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own tests'
      });
    }

    await test.destroy();

    res.status(200).json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// SEARCH TESTS BY TITLE
// ============================================================================
/**
 * Search tests by title with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchTestsByTitle = async (req, res) => {
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

    const { count, rows } = await Test.findAndCountAll({
      where: {
        title: { [Op.iLike]: `%${query}%` }
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'email']
        },
        {
          model: TestQuestion,
          as: 'questions',
          attributes: ['id', 'questionText']
        }
      ],
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
    console.error('Error searching tests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET TESTS BY AUTHOR
// ============================================================================
/**
 * Get tests by author with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTestsByAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Test.findAndCountAll({
      where: {
        createdBy: authorId
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'email']
        },
        {
          model: TestQuestion,
          as: 'questions',
          attributes: ['id', 'questionText']
        }
      ],
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
    console.error('Error fetching tests by author:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};