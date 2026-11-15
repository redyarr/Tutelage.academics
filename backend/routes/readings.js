// ============================================================================
// READING ROUTES
// ============================================================================
// Defines all routes for reading CRUD operations with authentication/authorization.
// ============================================================================

const express = require('express');
const { validateTags } = require('../middlewares/validateTags');
const router = express.Router();
const {
  createReading,
  getAllReadings,
  getPaginatedReadings,
  getReadingById,
  updateReading,
  deleteReading,
  searchReadings
} = require('../controllers/readingController');
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const { pdfUpload } = require('../middlewares/pdfUpload');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * GET /api/readings
 * Infinite scroll listing and filtering
 */
router.get('/', getAllReadings);

/**
 * GET /api/readings/paginated
 * Page-based listing and filtering
 */
router.get('/paginated', getPaginatedReadings);

/**
 * GET /api/readings/search
 * Search across title/content/description
 */
router.get('/search', searchReadings);

/**
 * GET /api/readings/:id
 * Fetch a single reading item
 */
router.get('/:id', getReadingById);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/readings
 * Create a new reading item
 */
router.post('/', isAuthenticated, pdfUpload, validateTags, createReading);

/**
 * PUT /api/readings/:id
 * Update reading item (author/admin)
 */
router.put('/:id', isAuthenticated, pdfUpload, validateTags, updateReading);

/**
 * DELETE /api/readings/:id
 * Delete reading item (author/admin)
 */
router.delete('/:id', isAuthenticated, deleteReading);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * POST /api/readings/admin
 * Admin-only creation
 */
router.post('/admin', isAuthenticated, adminAuth, pdfUpload, validateTags, createReading);

/**
 * PUT /api/readings/admin/:id
 * Admin-only update
 */
router.put('/admin/:id', isAuthenticated, adminAuth, pdfUpload, validateTags, updateReading);

/**
 * DELETE /api/readings/admin/:id
 * Admin-only deletion
 */
router.delete('/admin/:id', isAuthenticated, adminAuth, deleteReading);

module.exports = router;