const express = require("express");
const router = express.Router();

// Controllers
const DebtController = require("../controllers/debtController");

// Middleware
const {
    validateDebtCreation,
    validateDebtUpdate,
    validateDebtFilters,
    validateExportFormat,
    validateIdParam,
    validateDebtOwnership,
    sanitizeInput,
} = require("../middleware/validation");
const { authenticateToken } = require("../middleware/auth");

// All debt routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/debts
 * @desc    Get all debts for current user with filters
 * @access  Private
 * @query   status: paid|pending, type: owed_to_me|i_owe, limit: number, offset: number
 */
router.get("/", validateDebtFilters, DebtController.getUserDebts);

/**
 * @route   POST /api/debts
 * @desc    Create a new debt
 * @access  Private
 * @body    { debtorId: number, amount: number, description: string }
 */
router.post(
    "/",
    sanitizeInput,
    validateDebtCreation,
    validateDebtOwnership,
    DebtController.createDebt
);

/**
 * @route   GET /api/debts/aggregations
 * @desc    Get debt aggregations/statistics
 * @access  Private
 */
router.get("/aggregations", DebtController.getDebtAggregations);

/**
 * @route   GET /api/debts/export
 * @desc    Export debts in JSON or CSV format
 * @access  Private
 * @query   format: json|csv
 */
router.get("/export", validateExportFormat, DebtController.exportDebts);

/**
 * @route   GET /api/debts/recent
 * @desc    Get recent debt activity
 * @access  Private
 * @query   limit: number
 */
router.get("/recent", DebtController.getRecentActivity);

/**
 * @route   GET /api/debts/summary
 * @desc    Get debts summary for dashboard
 * @access  Private
 */
router.get("/summary", DebtController.getDebtsSummary);

/**
 * @route   GET /api/debts/:id
 * @desc    Get single debt by ID
 * @access  Private
 */
router.get("/:id", validateIdParam, DebtController.getDebtById);

/**
 * @route   PUT /api/debts/:id
 * @desc    Update debt
 * @access  Private
 * @body    { amount?: number, description?: string }
 */
router.put("/:id", validateIdParam, sanitizeInput, validateDebtUpdate, DebtController.updateDebt);

/**
 * @route   PATCH /api/debts/:id/pay
 * @desc    Mark debt as paid
 * @access  Private
 */
router.patch("/:id/pay", validateIdParam, DebtController.markDebtAsPaid);

/**
 * @route   DELETE /api/debts/:id
 * @desc    Delete debt
 * @access  Private
 */
router.delete("/:id", validateIdParam, DebtController.deleteDebt);

module.exports = router;
