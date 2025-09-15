const Debt = require("../models/Debt");
const User = require("../models/User");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

class DebtController {
    // Create new debt
    static createDebt = asyncHandler(async (req, res) => {
        const { debtorId, amount, description } = req.body;
        const creditorId = req.user.id;

        // Verify debtor exists
        const debtor = await User.findById(debtorId);
        if (!debtor) {
            throw new AppError("Debtor not found", 404);
        }

        // Create debt
        const debt = await Debt.create({
            creditorId,
            debtorId,
            amount,
            description,
        });

        // Get debt with user information
        const debtWithDetails = await Debt.findById(debt.id);

        res.status(201).json({
            success: true,
            message: "Debt created successfully",
            data: debtWithDetails,
        });
    });

    // Get all debts for current user
    static getUserDebts = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const filters = {
            status: req.query.status,
            type: req.query.type,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
        };

        // Get debts
        const debts = await Debt.findByUserId(userId, filters);

        // Get total count for pagination
        const totalQuery = await require("../config/database").query(
            `
      SELECT COUNT(*) as total
      FROM debts d
      WHERE (d.creditor_id = $1 OR d.debtor_id = $1)
      ${filters.status === "paid" ? "AND d.is_paid = true" : ""}
      ${filters.status === "pending" ? "AND d.is_paid = false" : ""}
      ${filters.type === "owed_to_me" ? "AND d.creditor_id = $1" : ""}
      ${filters.type === "i_owe" ? "AND d.debtor_id = $1" : ""}
    `,
            [userId]
        );

        const total = parseInt(totalQuery.rows[0].total);

        res.json({
            success: true,
            message: "Debts retrieved successfully",
            data: {
                debts,
                pagination: {
                    total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + filters.limit < total,
                },
            },
        });
    });

    // Get single debt by ID
    static getDebtById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const userId = req.user.id;

        const debt = await Debt.findById(id);
        if (!debt) {
            throw new AppError("Debt not found", 404);
        }

        // Check if user has access to this debt
        if (debt.creditorId !== userId && debt.debtorId !== userId) {
            throw new AppError("Access denied - you are not involved in this debt", 403);
        }

        res.json({
            success: true,
            message: "Debt retrieved successfully",
            data: debt,
        });
    });

    // Update debt
    static updateDebt = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { amount, description } = req.body;
        const userId = req.user.id;

        // Update debt (includes permission and validation checks)
        const updatedDebt = await Debt.update(id, { amount, description }, userId);

        // Get updated debt with user details
        const debtWithDetails = await Debt.findById(updatedDebt.id);

        res.json({
            success: true,
            message: "Debt updated successfully",
            data: debtWithDetails,
        });
    });

    // Mark debt as paid
    static markDebtAsPaid = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const userId = req.user.id;

        // Mark as paid (includes permission checks)
        const paidDebt = await Debt.markAsPaid(id, userId);

        // Get updated debt with user details
        const debtWithDetails = await Debt.findById(paidDebt.id);

        res.json({
            success: true,
            message: "Debt marked as paid successfully",
            data: debtWithDetails,
        });
    });

    // Delete debt
    static deleteDebt = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const userId = req.user.id;

        // Delete debt (includes permission checks)
        const deleted = await Debt.delete(id, userId);

        if (!deleted) {
            throw new AppError("Failed to delete debt", 500);
        }

        res.json({
            success: true,
            message: "Debt deleted successfully",
        });
    });

    // Get debt aggregations/statistics
    static getDebtAggregations = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const aggregations = await Debt.getAggregations(userId);

        res.json({
            success: true,
            message: "Debt aggregations retrieved successfully",
            data: aggregations,
        });
    });

    // Export debts
    static exportDebts = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const format = req.query.format || "json";

        const exportData = await Debt.exportDebts(userId, format);

        if (format === "json") {
            res.json({
                success: true,
                message: "Debts exported successfully",
                data: exportData,
            });
        } else if (format === "csv") {
            // Convert to CSV format
            const fields = [
                "id",
                "type",
                "amount",
                "description",
                "otherPerson",
                "isPaid",
                "createdAt",
                "paidAt",
            ];
            const csv = [
                fields.join(","),
                ...exportData.map((debt) =>
                    fields
                        .map((field) => {
                            let value = debt[field];
                            if (value === null || value === undefined) value = "";
                            if (typeof value === "string" && value.includes(",")) {
                                value = `"${value.replace(/"/g, '""')}"`;
                            }
                            return value;
                        })
                        .join(",")
                ),
            ].join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="debts-${new Date().toISOString().split("T")[0]}.csv"`
            );
            res.send(csv);
        }
    });

    // Get recent debts activity
    static getRecentActivity = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;

        const recentDebts = await Debt.findByUserId(userId, { limit, offset: 0 });

        // Transform data for activity feed
        const activities = recentDebts.map((debt) => {
            const isCreditor = debt.creditorId === userId;
            const otherPerson = isCreditor ? debt.debtor : debt.creditor;

            return {
                id: debt.id,
                type: debt.isPaid ? "debt_paid" : "debt_created",
                amount: debt.amount,
                description: debt.description,
                otherPerson: otherPerson,
                isCreditor,
                isPaid: debt.isPaid,
                createdAt: debt.createdAt,
                paidAt: debt.paidAt,
            };
        });

        res.json({
            success: true,
            message: "Recent activity retrieved successfully",
            data: activities,
        });
    });

    // Get debts summary for dashboard
    static getDebtsSummary = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Get aggregations
        const aggregations = await Debt.getAggregations(userId);

        // Get recent activity
        const recentDebts = await Debt.findByUserId(userId, { limit: 5 });

        // Get pending debts count
        const pendingOwedToMe = await Debt.findByUserId(userId, {
            type: "owed_to_me",
            status: "pending",
            limit: 5,
        });

        const pendingIOwe = await Debt.findByUserId(userId, {
            type: "i_owe",
            status: "pending",
            limit: 5,
        });

        res.json({
            success: true,
            message: "Debts summary retrieved successfully",
            data: {
                summary: aggregations.summary,
                counts: aggregations.counts,
                recentActivity: recentDebts.slice(0, 5),
                pendingOwedToMe: pendingOwedToMe,
                pendingIOwe: pendingIOwe,
            },
        });
    });
}

module.exports = DebtController;
