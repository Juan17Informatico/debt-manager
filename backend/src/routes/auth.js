const express = require('express');
const router = express.Router();

// Controllers
const AuthController = require('../controllers/authController');

// Middleware
const {
  validateUserRegistration,
  validateUserLogin,
  sanitizeInput
} = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

// Validation for password change
const Joi = require('joi');
const { validate } = require('../middleware/validation');

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string().min(6).max(100).required().messages({
    'string.min': 'New password must be at least 6 characters long',
    'string.max': 'New password cannot exceed 100 characters',
    'any.required': 'New password is required'
  })
});

const validatePasswordChange = validate(changePasswordSchema);

// Routes

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  sanitizeInput,
  validateUserRegistration,
  AuthController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  sanitizeInput,
  validateUserLogin,
  AuthController.login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me',
  authenticateToken,
  AuthController.getCurrentUser
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh',
  authenticateToken,
  AuthController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
  authenticateToken,
  sanitizeInput,
  validatePasswordChange,
  AuthController.changePassword
);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token
 * @access  Private
 */
router.get('/validate',
  authenticateToken,
  AuthController.validateToken
);

module.exports = router;