// ============================================================================
// ADMIN QUIZ ROUTES
// ============================================================================
// Admin-only routes for managing quiz configuration, sections, and questions

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const {
  getQuizConfig,
  updateQuizConfig,
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion
} = require('../controllers/adminQuizController');

// ============================================================================
// ALL ROUTES REQUIRE ADMIN AUTHENTICATION
// ============================================================================

// ============================================================================
// QUIZ CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/admin/quiz/config
 * Fetch the current quiz configuration (totalQuestions, timeLimitMinutes)
*/
router.get('/config', getQuizConfig);

router.use(isAuthenticated, adminAuth);

/**
 * PUT /api/admin/quiz/config
 * Update quiz configuration (validates constraints)
 */
router.put('/config', updateQuizConfig);

// ============================================================================
// SECTION ROUTES
// ============================================================================

/**
 * GET /api/admin/quiz/sections
 * Fetch all sections with their question counts
 */
router.get('/sections', getAllSections);

/**
 * GET /api/admin/quiz/sections/:id
 * Fetch a specific section with its questions
 */
router.get('/sections/:id', getSectionById);

/**
 * POST /api/admin/quiz/sections
 * Create a new section (validates total question allocation)
 */
router.post('/sections', createSection);

/**
 * PUT /api/admin/quiz/sections/:id
 * Update a section (validates question count constraints)
 */
router.put('/sections/:id', updateSection);

/**
 * DELETE /api/admin/quiz/sections/:id
 * Delete a section (blocks if it has questions)
 */
router.delete('/sections/:id', deleteSection);

// ============================================================================
// QUESTION ROUTES
// ============================================================================

/**
 * GET /api/admin/quiz/questions
 * Fetch all questions with filtering (by section, level)
 */
router.get('/questions', getAllQuestions);

/**
 * GET /api/admin/quiz/questions/:id
 * Fetch a specific question by ID
 */
router.get('/questions/:id', getQuestionById);

/**
 * POST /api/admin/quiz/questions
 * Create a new question (validates section limit and global limit)
 */
router.post('/questions', createQuestion);

/**
 * PUT /api/admin/quiz/questions/:id
 * Update a question
 */
router.put('/questions/:id', updateQuestion);

/**
 * DELETE /api/admin/quiz/questions/:id
 * Delete a question
 */
router.delete('/questions/:id', deleteQuestion);

module.exports = router;
