// ============================================================================
// ============================================================================
// BLOG ROUTES
// ============================================================================
// This file defines all routes for blog CRUD operations with proper
// authentication and authorization middleware.
// ============================================================================

const express = require('express');
const { validateTags } = require('../middlewares/validateTags');
const router = express.Router();
const {
  createBlog,
  getAllBlogs,
  getPaginatedBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  getBlogsByCategory,
} = require('../controllers/blogController');
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const { pdfUpload } = require('../middlewares/pdfUpload');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * GET /api/blogs
 * Get all blog posts with infinite scroll pagination and filtering
 * Query params: cursor, limit, category, search, sortBy, sortOrder
 */
router.get('/', getAllBlogs);

/**
 * GET /api/blogs/paginated
 * Get all blog posts with page-based pagination (for React frontend)
 * Query params: page, limit, category, search, sortBy, sortOrder
 */
router.get('/paginated', (req, res, next) => {
  console.log('🎯 Paginated route hit!', req.query);
  next();
}, getPaginatedBlogs);

/**
 * GET /api/blogs/:id
 * Get a specific blog post by ID
 */
router.get('/:id', getBlogById);

/**
 * GET /api/blogs/category/:category
 * Get blog posts by category with pagination
 */
router.get('/category/:category', getBlogsByCategory);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/blogs
 * Create a new blog post
 * Requires authentication
 */
router.post('/', isAuthenticated, pdfUpload, validateTags, createBlog);

/**
 * PUT /api/blogs/:id
 * Update a blog post
 * Requires authentication (author or admin only)
 */
router.put('/:id', isAuthenticated, pdfUpload, validateTags, updateBlog);

/**
 * DELETE /api/blogs/:id
 * Delete a blog post
 * Requires authentication (author or admin only)
 */
router.delete('/:id', isAuthenticated, deleteBlog);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * POST /api/blogs/admin
 * Create a new blog post (admin only)
 * Requires admin authentication
 */
router.post('/admin', isAuthenticated, adminAuth, pdfUpload, validateTags, createBlog);

/**
 * PUT /api/blogs/admin/:id
 * Update any blog post (admin only)
 * Requires admin authentication
 */
router.put('/admin/:id', isAuthenticated, adminAuth, pdfUpload, validateTags, updateBlog);

/**
 * DELETE /api/blogs/admin/:id
 * Delete any blog post (admin only)
 * Requires admin authentication
 */
router.delete('/admin/:id', isAuthenticated, adminAuth, deleteBlog);

module.exports = router;