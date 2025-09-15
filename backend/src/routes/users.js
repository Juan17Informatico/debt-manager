const express = require("express");
const router = express.Router();

// Controllers
const UserController = require("../controllers/userController");

// Middleware
const { validateUserUpdate, sanitizeInput } = require("../middleware/validation");
const { authenticateToken } = require("../middleware/auth");

// All user routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile with statistics
 * @access  Private
 */
router.get("/profile", UserController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { name: string }
 */
router.put("/profile", sanitizeInput, validateUserUpdate, UserController.updateProfile);

/**
 * @route   GET /api/users/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get("/dashboard", UserController.getDashboard);

/**
 * @route   GET /api/users/statistics
 * @desc    Get detailed user statistics
 * @access  Private
 */
router.get("/statistics", UserController.getUserStatistics);

/**
 * @route   GET /api/users/activity
 * @desc    Get user activity feed
 * @access  Private
 * @query   limit: number, offset: number
 */
router.get("/activity", UserController.getUserActivity);

/**
 * @route   GET /api/users/list
 * @desc    Get all users for debt creation (excluding current user)
 * @access  Private
 * @query   search: string, limit: number, offset: number
 */
router.get("/list", UserController.getAllUsers);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account
 * @access  Private
 * @body    { password: string }
 */
router.delete("/account", sanitizeInput, UserController.deleteAccount);

module.exports = router;
