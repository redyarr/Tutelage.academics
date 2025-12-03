// ============================================================================
// VIDEO ROUTES
// ============================================================================
// This file defines all routes for video CRUD operations with proper
// authentication and authorization middleware.
// ============================================================================

const express = require('express');
const router = express.Router();
// PDF upload via RestPDF middleware
const { pdfUpload } = require('../middlewares/pdfUpload');
const {
  createVideo,
  getAllVideos,
  getPaginatedVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  searchVideosByTitle,
  get // Legacy function
} = require('../controllers/VideoController');
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// Using `pdfUpload` which accepts multipart fields `pdfFile` and `taskPdfFile`,
// uploads them to RestPDF, and injects hosted URLs into `req.body.pdf` and
// `req.body.taskPdf` for the controller to consume.

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * GET /api/videos
 * Get all video content with infinite scroll pagination and filtering
 * Query params: cursor, limit, search, sortBy, sortOrder
 */
router.get('/', getAllVideos);

/**
 * GET /api/videos/paginated
 * Get all video content with page-based pagination (for React frontend)
 * Query params: page, limit, search, sortBy, sortOrder
 */
router.get('/paginated', getPaginatedVideos);

/**
 * GET /api/videos/legacy
 * Legacy route for backward compatibility
 */
router.get('/legacy', get);

/**
 * GET /api/videos/:id
 * Get a specific video content by ID
 */
router.get('/:id', getVideoById);

/**
 * GET /api/videos/search/title
 * Search video content by title
 * Query params: query, page, limit
 */
router.get('/search/title', searchVideosByTitle);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/videos
 * Create a new video content with optional PDF uploads (via RestPDF)
 */
router.post('/', isAuthenticated, pdfUpload, createVideo);

/**
 * PUT /api/videos/:id
 * Update a video content with optional PDF uploads (via RestPDF)
 */
router.put('/:id', isAuthenticated, pdfUpload, updateVideo);

/**
 * DELETE /api/videos/:id
 * Delete a video content
 * Requires authentication (author or admin only)
 */
router.delete('/:id', isAuthenticated, deleteVideo);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * POST /api/videos/admin
 * Admin-only video creation (with optional PDF uploads via RestPDF)
 */
router.post('/admin', isAuthenticated, adminAuth, pdfUpload, createVideo);

/**
 * PUT /api/videos/admin/:id
 * Admin-only video update (with optional PDF uploads via RestPDF)
 */
router.put('/admin/:id', isAuthenticated, adminAuth, pdfUpload, updateVideo);

/**
 * DELETE /api/videos/admin/:id
 * Admin-only video deletion (can delete any video)
 */
router.delete('/admin/:id', isAuthenticated, adminAuth, deleteVideo);

module.exports = router;