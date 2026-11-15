// ============================================================================
// SPEAKING ROUTES
// ============================================================================
// Defines all routes for speaking CRUD operations with authentication/authorization.
// ============================================================================

const express = require('express');
const { validateTags } = require('../middlewares/validateTags');
const router = express.Router();
const {
  createSpeaking,
  getAllSpeakings,
  getPaginatedSpeakings,
  getSpeakingById,
  updateSpeaking,
  deleteSpeaking,
  searchSpeaking
} = require('../controllers/speakingController');
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const { pdfUpload } = require('../middlewares/pdfUpload');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * GET /api/speakings
 * Infinite scroll listing and filtering
 */
router.get('/', getAllSpeakings);

/**
 * GET /api/speakings/paginated
 * Page-based listing and filtering
 */
router.get('/paginated', getPaginatedSpeakings);

/**
 * GET /api/speakings/:id
 * Fetch a single speaking item
 */
/**
 * GET /api/speakings/search
 * Generic search across title/description/transcript
 */
router.get('/search', searchSpeaking);

/**
 * GET /api/speakings/:id
 * Fetch a single speaking item
 */
router.get('/:id', getSpeakingById);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/speakings
 * Create a new speaking item
 */
router.post('/', isAuthenticated, pdfUpload, validateTags, createSpeaking);

/**
 * PUT /api/speakings/:id
 * Update speaking item (author/admin)
 */
router.put('/:id', isAuthenticated, pdfUpload, validateTags, updateSpeaking);

/**
 * DELETE /api/speakings/:id
 * Delete speaking item (author/admin)
 */
router.delete('/:id', isAuthenticated, deleteSpeaking);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * POST /api/speakings/admin
 * Admin-only creation
 */
router.post('/admin', isAuthenticated, adminAuth, pdfUpload, validateTags, createSpeaking);

/**
 * PUT /api/speakings/admin/:id
 * Admin-only update
 */
router.put('/admin/:id', isAuthenticated, adminAuth, pdfUpload, validateTags, updateSpeaking);

/**
 * DELETE /api/speakings/admin/:id
 * Admin-only deletion
 */
router.delete('/admin/:id', isAuthenticated, adminAuth, deleteSpeaking);

module.exports = router;