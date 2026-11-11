// ============================================================================
// FAQ CONTROLLER
// ============================================================================
// This controller handles all CRUD operations for FAQ content including
// creation, retrieval with pagination, updating, and deletion.
// ============================================================================

const { Faq } = require('../models');
const { Op } = require('sequelize');

// ============================================================================
// CREATE FAQ
// ============================================================================
/**
 * Create a new FAQ
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createFaq = async (req, res) => {
  try {
    const { question, answer, orderNumber, category } = req.body;
    
    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question and answer are required'
      });
    }

    // Create FAQ
    const faq = await Faq.create({
      question,
      answer,
      orderNumber,
      category
    });

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL FAQS WITH PAGINATION
// ============================================================================
/**
 * Get all FAQs with infinite scroll pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllFaqs = async (req, res) => {
  try {
    const {
      cursor, // For cursor-based pagination (ID of last item)
      limit = 10,
      search = '',
      category = '',
      sortBy = 'orderNumber',
      sortOrder = 'ASC'
    } = req.query;

    // Build where clause for filtering
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { question: { [Op.iLike]: `%${search}%` } },
        { answer: { [Op.iLike]: `%${search}%` } }
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

    const faqs = await Faq.findAll({
      where: whereClause,
      order: [
        [sortBy, sortOrder.toUpperCase()],
        ['id', sortOrder.toUpperCase()] // Secondary sort by ID for consistent pagination
      ],
      limit: fetchLimit
    });

    // Check if there are more items
    const hasMore = faqs.length > parseInt(limit);
    
    // Remove the extra item if it exists
    const items = hasMore ? faqs.slice(0, parseInt(limit)) : faqs;
    
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
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET FAQ BY ID
// ============================================================================
/**
 * Get a specific FAQ by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFaqById = async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await Faq.findByPk(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// UPDATE FAQ
// ============================================================================
/**
 * Update a FAQ
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, orderNumber, category } = req.body;

    const faq = await Faq.findByPk(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    // Update FAQ
    await faq.update({
      question: question || faq.question,
      answer: answer || faq.answer,
      orderNumber: orderNumber !== undefined ? orderNumber : faq.orderNumber,
      category: category || faq.category
    });

    res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      data: faq
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// DELETE FAQ
// ============================================================================
/**
 * Delete a FAQ
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await Faq.findByPk(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.destroy();

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET FAQS BY CATEGORY
// ============================================================================
/**
 * Get FAQs by category with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFaqsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'orderNumber',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Faq.findAndCountAll({
      where: {
        category: { [Op.iLike]: `%${category}%` }
      },
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      limit: parseInt(limit),
      offset: offset
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
    console.error('Error fetching FAQs by category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// SEARCH FAQS BY QUESTION
// ============================================================================
/**
 * Search FAQs by question with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchFaqsByQuestion = async (req, res) => {
  try {
    const { query } = req.query;
    const {
      page = 1,
      limit = 10,
      sortBy = 'orderNumber',
      sortOrder = 'ASC'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Faq.findAndCountAll({
      where: {
        question: { [Op.iLike]: `%${query}%` }
      },
      order: [[sortBy, sortOrder.toUpperCase()], ['id', sortOrder.toUpperCase()]], // id breaks createdAt ties so pages never overlap
      limit: parseInt(limit),
      offset: offset
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
    console.error('Error searching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ============================================================================
// GET ALL CATEGORIES
// ============================================================================
/**
 * Get all unique FAQ categories
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFaqCategories = async (req, res) => {
  try {
    const categories = await Faq.findAll({
      attributes: ['category'],
      where: {
        category: {
          [Op.not]: null
        }
      },
      group: ['category'],
      order: [['category', 'ASC']]
    });

    const categoryList = categories.map(item => item.category).filter(Boolean);

    res.status(200).json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};