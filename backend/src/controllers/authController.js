const User = require("../models/User");
const { generateToken } = require("../middleware/auth");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

class AuthController {
    // Register new user
    static register = asyncHandler(async (req, res) => {
        const { email, password, name } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw new AppError("User with this email already exists", 400);
        }

        // Create new user
        const user = await User.create({ email, password, name });

        // Generate JWT token
        const token = generateToken(user.id);

        // Send response (exclude password)
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user: user.toJSON(),
                token,
                expiresIn: process.env.JWT_EXPIRES_IN || "7d",
            },
        });
    });

    // Login user
    static login = asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            throw new AppError("Invalid email or password", 401);
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new AppError("Invalid email or password", 401);
        }

        // Generate JWT token
        const token = generateToken(user.id);

        // Send response
        res.json({
            success: true,
            message: "Login successful",
            data: {
                user: user.toJSON(),
                token,
                expiresIn: process.env.JWT_EXPIRES_IN || "7d",
            },
        });
    });

    // Get current user profile
    static getCurrentUser = asyncHandler(async (req, res) => {
        const user = req.user;

        // Get user statistics
        const stats = await User.getUserStats(user.id);

        res.json({
            success: true,
            message: "User profile retrieved successfully",
            data: {
                user: user.toJSON(),
                statistics: {
                    totalDebtsOwedToMe: parseInt(stats.debts_owed_to_me),
                    totalMyDebts: parseInt(stats.my_debts),
                    totalPaidDebtsToMe: parseInt(stats.paid_debts_to_me),
                    totalMyPaidDebts: parseInt(stats.my_paid_debts),
                    totalAmountOwedToMe: parseFloat(stats.total_owed_to_me),
                    totalAmountIOwe: parseFloat(stats.total_i_owe),
                },
            },
        });
    });

    // Refresh token (validate current token and issue new one)
    static refreshToken = asyncHandler(async (req, res) => {
        const user = req.user;

        // Generate new token
        const newToken = generateToken(user.id);

        res.json({
            success: true,
            message: "Token refreshed successfully",
            data: {
                token: newToken,
                expiresIn: process.env.JWT_EXPIRES_IN || "7d",
            },
        });
    });

    // Logout
    static logout = asyncHandler(async (req, res) => {
        res.json({
            success: true,
            message: "Logout successful",
        });
    });

    // Change password
    static changePassword = asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Get user with password
        const user = await User.findByEmail(req.user.email);
        if (!user) {
            throw new AppError("User not found", 404);
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            throw new AppError("Current password is incorrect", 400);
        }

        // Hash new password
        const bcrypt = require("bcryptjs");
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in database
        const { query } = require("../config/database");
        await query(
            "UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [hashedNewPassword, userId]
        );

        res.json({
            success: true,
            message: "Password changed successfully",
        });
    });

    // Validate token (for client-side token validation)
    static validateToken = asyncHandler(async (req, res) => {
        res.json({
            success: true,
            message: "Token is valid",
            data: {
                user: req.user.toJSON(),
                tokenValid: true,
            },
        });
    });
}

module.exports = AuthController;
