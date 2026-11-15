// ============================================================================
// WRITING ROUTES
// ============================================================================
// Defines all routes for writing CRUD operations with authentication/authorization.
// ============================================================================

const express = require('express');
const { validateTags } = require('../middlewares/validateTags');
const router = express.Router();
const {
  createWriting,
  getAllWritings,
  getPaginatedWritings,
  getWritingById,
  updateWriting,
  deleteWriting,
  searchWritings
} = require('../controllers/writingController');
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const { pdfUpload } = require('../middlewares/pdfUpload');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * GET /api/writings
 * Infinite scroll listing and filtering
 */
router.get('/', getAllWritings);

/**
 * GET /api/writings/paginated
 * Page-based listing and filtering
 */
router.get('/paginated', getPaginatedWritings);

/**
 * GET /api/writings/:id
 * Fetch a single writing item
 */
/**
 * GET /api/writings/search
 * Search across title/prompt/content/sampleAnswer
 */
router.get('/search', searchWritings);

/**
 * GET /api/writings/:id
 * Fetch a single writing item
 */
router.get('/:id', getWritingById);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/writings
 * Create a new writing item
 */
router.post('/', isAuthenticated, pdfUpload, validateTags, createWriting);

/**
 * PUT /api/writings/:id
 * Update writing item (author/admin)
 */
router.put('/:id', isAuthenticated, pdfUpload, validateTags, updateWriting);

/**
 * DELETE /api/writings/:id
 * Delete writing item (author/admin)
 */
router.delete('/:id', isAuthenticated, deleteWriting);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * POST /api/writings/admin
 * Admin-only creation
 */
router.post('/admin', isAuthenticated, adminAuth, pdfUpload, validateTags, createWriting);

/**
 * PUT /api/writings/admin/:id
 * Admin-only update
 */
router.put('/admin/:id', isAuthenticated, adminAuth, pdfUpload, validateTags, updateWriting);

/**
 * DELETE /api/writings/admin/:id
 * Admin-only deletion
 */
router.delete('/admin/:id', isAuthenticated, adminAuth, deleteWriting);

module.exports = router;