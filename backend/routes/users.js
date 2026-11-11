// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================
// This file defines all user management routes including user CRUD operations.
// All routes require authentication, with admin-specific routes requiring
// additional admin authorization.
// ============================================================================

// ============================================================================
// DEPENDENCIES
// ============================================================================
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// ============================================================================
// CONTROLLERS
// ============================================================================
const AuthController = require('../controllers/authController');

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================
// Apply authentication middleware to all user routes


router.use(isAuthenticated);

// ============================================================================
// USER LISTING ROUTES
// ============================================================================
// Routes for retrieving user information

/**
 * GET /api/users
 * List users. Logged-in ADMIN or MAIN_MANAGER (the dashboard overview shows this table to both).
 */
router.get('/', isAdmin, AuthController.getAllUsers);



// ============================================================================
// ADMIN-ONLY USER MANAGEMENT ROUTES
// ============================================================================
// Apply strict admin authorization to all remaining routes
router.use(adminAuth);

/**
 * POST /api/users/create
 * Create a new user account (Admin only)
 */
router.post('/create', AuthController.createUser);

/**
 * GET /api/users/:id
 * Get specific user by ID (Admin only)
 */
router.get('/:id', AuthController.getUserById);

/**
 * PUT /api/users/:id
 * Update user information (Admin only)
 */
router.put('/:id', AuthController.updateUser);

/**
 * DELETE /api/users/:id
 * Delete user account (Admin only)
 */
router.delete('/:id', AuthController.deleteUser);

/**
 * PATCH /api/users/:id/deactivate
 * Deactivate user account (Admin only)
 */
router.post('/:id/deactivate', AuthController.deactivateUser);

/**
 * post /api/users/:id/activate
 * Activate user account (Admin only)
 */
router.post('/:id/activate', AuthController.activateUser);

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = router;