const User = require("../models/User");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

class UserController {
    // Get current user profile
    static getProfile = asyncHandler(async (req, res) => {
        const user = req.user;

        // Get user statistics
        const stats = await User.getUserStats(user.id);

        res.json({
            success: true,
            message: "Profile retrieved successfully",
            data: {
                user: user.toJSON(),
                statistics: {
                    totalDebtsOwedToMe: parseInt(stats.debts_owed_to_me),
                    totalMyDebts: parseInt(stats.my_debts),
                    totalPaidDebtsToMe: parseInt(stats.paid_debts_to_me),
                    totalMyPaidDebts: parseInt(stats.my_paid_debts),
                    totalAmountOwedToMe: parseFloat(stats.total_owed_to_me),
                    totalAmountIOwe: parseFloat(stats.total_i_owe),
                    netBalance: parseFloat(stats.total_owed_to_me) - parseFloat(stats.total_i_owe),
                },
            },
        });
    });

    // Update user profile
    static updateProfile = asyncHandler(async (req, res) => {
        const { name } = req.body;
        const userId = req.user.id;

        // Update user
        const updatedUser = await User.update(userId, { name });

        if (!updatedUser) {
            throw new AppError("Failed to update profile", 500);
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser.toJSON(),
        });
    });

    // Get all users (excluding current user) - for debt creation
    static getAllUsers = asyncHandler(async (req, res) => {
        const currentUserId = req.user.id;
        const search = req.query.search?.trim();
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        let users;

        if (search) {
            // Search users by name or email
            const { query } = require("../config/database");
            const searchQuery = `
        SELECT id, email, name, created_at, updated_at
        FROM users
        WHERE id != $1 
        AND (LOWER(name) LIKE LOWER($2) OR LOWER(email) LIKE LOWER($2))
        ORDER BY name ASC
        LIMIT $3 OFFSET $4
      `;

            const result = await query(searchQuery, [currentUserId, `%${search}%`, limit, offset]);

            users = result.rows.map((row) => new User(row));
        } else {
            // Get all users excluding current user
            users = await User.findAll(currentUserId);

            // Apply pagination
            users = users.slice(offset, offset + limit);
        }

        res.json({
            success: true,
            message: "Users retrieved successfully",
            data: {
                users: users.map((user) => user.toJSON()),
                pagination: {
                    limit,
                    offset,
                    hasMore: users.length === limit,
                },
            },
        });
    });

    // Get user statistics
    static getUserStatistics = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const stats = await User.getUserStats(userId);

        // Additional statistics
        const { query } = require("../config/database");

        // Get monthly statistics (last 6 months)
        const monthlyStats = await query(
            `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(CASE WHEN creditor_id = $1 THEN 1 END) as debts_created,
        COUNT(CASE WHEN debtor_id = $1 THEN 1 END) as debts_received,
        COUNT(CASE WHEN debtor_id = $1 AND is_paid = true THEN 1 END) as debts_paid
      FROM debts
      WHERE (creditor_id = $1 OR debtor_id = $1)
      AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `,
            [userId]
        );

        // Get top debtors and creditors
        const topDebtors = await query(
            `
      SELECT 
        u.id, u.name, u.email,
        COUNT(*) as debt_count,
        SUM(d.amount) as total_amount,
        COUNT(CASE WHEN d.is_paid = false THEN 1 END) as pending_count,
        SUM(CASE WHEN d.is_paid = false THEN d.amount ELSE 0 END) as pending_amount
      FROM debts d
      JOIN users u ON d.debtor_id = u.id
      WHERE d.creditor_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY total_amount DESC
      LIMIT 5
    `,
            [userId]
        );

        const topCreditors = await query(
            `
      SELECT 
        u.id, u.name, u.email,
        COUNT(*) as debt_count,
        SUM(d.amount) as total_amount,
        COUNT(CASE WHEN d.is_paid = false THEN 1 END) as pending_count,
        SUM(CASE WHEN d.is_paid = false THEN d.amount ELSE 0 END) as pending_amount
      FROM debts d
      JOIN users u ON d.creditor_id = u.id
      WHERE d.debtor_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY total_amount DESC
      LIMIT 5
    `,
            [userId]
        );

        res.json({
            success: true,
            message: "User statistics retrieved successfully",
            data: {
                overview: {
                    totalDebtsOwedToMe: parseInt(stats.debts_owed_to_me),
                    totalMyDebts: parseInt(stats.my_debts),
                    totalPaidDebtsToMe: parseInt(stats.paid_debts_to_me),
                    totalMyPaidDebts: parseInt(stats.my_paid_debts),
                    totalAmountOwedToMe: parseFloat(stats.total_owed_to_me),
                    totalAmountIOwe: parseFloat(stats.total_i_owe),
                    netBalance: parseFloat(stats.total_owed_to_me) - parseFloat(stats.total_i_owe),
                },
                monthlyActivity: monthlyStats.rows.map((row) => ({
                    month: row.month,
                    debtsCreated: parseInt(row.debts_created),
                    debtsReceived: parseInt(row.debts_received),
                    debtsPaid: parseInt(row.debts_paid),
                })),
                topDebtors: topDebtors.rows.map((row) => ({
                    user: {
                        id: row.id,
                        name: row.name,
                        email: row.email,
                    },
                    debtCount: parseInt(row.debt_count),
                    totalAmount: parseFloat(row.total_amount),
                    pendingCount: parseInt(row.pending_count),
                    pendingAmount: parseFloat(row.pending_amount),
                })),
                topCreditors: topCreditors.rows.map((row) => ({
                    user: {
                        id: row.id,
                        name: row.name,
                        email: row.email,
                    },
                    debtCount: parseInt(row.debt_count),
                    totalAmount: parseFloat(row.total_amount),
                    pendingCount: parseInt(row.pending_count),
                    pendingAmount: parseFloat(row.pending_amount),
                })),
            },
        });
    });

    // Delete user account
    static deleteAccount = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { password } = req.body;

        // Verify password before deletion
        const user = await User.findByEmail(req.user.email);
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            throw new AppError("Invalid password", 400);
        }

        // Check for pending debts
        const { query } = require("../config/database");
        const pendingDebts = await query(
            `
      SELECT COUNT(*) as pending_count
      FROM debts
      WHERE (creditor_id = $1 OR debtor_id = $1) AND is_paid = false
    `,
            [userId]
        );

        if (parseInt(pendingDebts.rows[0].pending_count) > 0) {
            throw new AppError(
                "Cannot delete account with pending debts. Please settle all debts first.",
                400
            );
        }

        // Delete user (cascade will handle debts)
        const deleted = await User.delete(userId);

        if (!deleted) {
            throw new AppError("Failed to delete account", 500);
        }

        res.json({
            success: true,
            message: "Account deleted successfully",
        });
    });

    // Get user activity feed
    static getUserActivity = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Get recent debt activities
        const { query } = require("../config/database");
        const activities = await query(
            `
      SELECT 
        d.*,
        c.name as creditor_name, c.email as creditor_email,
        deb.name as debtor_name, deb.email as debtor_email,
        'debt' as activity_type
      FROM debts d
      JOIN users c ON d.creditor_id = c.id
      JOIN users deb ON d.debtor_id = deb.id
      WHERE d.creditor_id = $1 OR d.debtor_id = $1
      ORDER BY 
        CASE WHEN d.paid_at IS NOT NULL THEN d.paid_at ELSE d.created_at END DESC
      LIMIT $2 OFFSET $3
    `,
            [userId, limit, offset]
        );

        // Transform activities
        const formattedActivities = activities.rows.map((activity) => {
            const isCreditor = activity.creditor_id === userId;

            return {
                id: activity.id,
                type: activity.is_paid ? "debt_paid" : "debt_created",
                amount: parseFloat(activity.amount),
                description: activity.description,
                isCreditor,
                otherUser: isCreditor
                    ? {
                          id: activity.debtor_id,
                          name: activity.debtor_name,
                          email: activity.debtor_email,
                      }
                    : {
                          id: activity.creditor_id,
                          name: activity.creditor_name,
                          email: activity.creditor_email,
                      },
                createdAt: activity.created_at,
                paidAt: activity.paid_at,
                lastActivity: activity.paid_at || activity.updated_at || activity.created_at,
            };
        });

        res.json({
            success: true,
            message: "User activity retrieved successfully",
            data: {
                activities: formattedActivities,
                pagination: {
                    limit,
                    offset,
                    hasMore: formattedActivities.length === limit,
                },
            },
        });
    });

    // Get dashboard data
    static getDashboard = asyncHandler(async (req, res) => {
        // TODO: Implement dashboard data aggregation
    });
}

module.exports = UserController;
