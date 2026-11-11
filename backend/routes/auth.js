// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================
// This file defines all authentication-related routes including user
// registration, login, logout, token refresh, and current user retrieval.
// ============================================================================

// ============================================================================
// DEPENDENCIES
// ============================================================================
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// ============================================================================
// CONTROLLERS
// ============================================================================
const AuthController = require('../controllers/authController');

// ============================================================================
// PUBLIC AUTHENTICATION ROUTES
// ============================================================================
// These routes do not require authentication

/**
 * POST /api/auth/register
 * Create a user account. ADMIN only: the body may set `role` (default ADMIN),
 * so leaving this public let anyone mint an admin account.
 */
router.post('/register', isAuthenticated, adminAuth, AuthController.register);

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', AuthController.login);

/**
 * POST /api/auth/refresh-token
 * Refresh expired access token using refresh token
 */
router.post('/refresh-token', AuthController.refreshToken);

/**
 * POST /api/auth/logout
 * End user session and clear tokens
 */
router.post('/logout', AuthController.logout);

// ============================================================================
// PROTECTED AUTHENTICATION ROUTES
// ============================================================================
// These routes require user authentication

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
router.get('/me', isAuthenticated, AuthController.getCurrentUser);

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = router;