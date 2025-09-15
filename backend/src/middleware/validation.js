const Joi = require("joi");

// Generic validation middleware
const validate = (schema, property = "body") => {
    return (req, res, next) => {
        const { error } = schema.validate(req[property], { abortEarly: false });

        if (error) {
            const errorDetails = error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
                value: detail.context.value,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: errorDetails,
            });
        }

        next();
    };
};

// User validation schemas
const userValidationSchemas = {
    register: Joi.object({
        email: Joi.string().email().required().messages({
            "string.email": "Please provide a valid email address",
            "any.required": "Email is required",
        }),
        password: Joi.string().min(6).max(100).required().messages({
            "string.min": "Password must be at least 6 characters long",
            "string.max": "Password cannot exceed 100 characters",
            "any.required": "Password is required",
        }),
        name: Joi.string().min(2).max(50).required().messages({
            "string.min": "Name must be at least 2 characters long",
            "string.max": "Name cannot exceed 50 characters",
            "any.required": "Name is required",
        }),
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            "string.email": "Please provide a valid email address",
            "any.required": "Email is required",
        }),
        password: Joi.string().required().messages({
            "any.required": "Password is required",
        }),
    }),

    updateProfile: Joi.object({
        name: Joi.string().min(2).max(50).required().messages({
            "string.min": "Name must be at least 2 characters long",
            "string.max": "Name cannot exceed 50 characters",
            "any.required": "Name is required",
        }),
    }),
};

// Debt validation schemas
const debtValidationSchemas = {
    create: Joi.object({
        debtorId: Joi.number().integer().positive().required().messages({
            "number.base": "Debtor ID must be a number",
            "number.positive": "Debtor ID must be positive",
            "any.required": "Debtor ID is required",
        }),
        amount: Joi.number().positive().precision(2).max(999999.99).required().messages({
            "number.base": "Amount must be a number",
            "number.positive": "Amount must be greater than 0",
            "number.max": "Amount cannot exceed 999,999.99",
            "any.required": "Amount is required",
        }),
        description: Joi.string().min(1).max(500).required().messages({
            "string.min": "Description is required",
            "string.max": "Description cannot exceed 500 characters",
            "any.required": "Description is required",
        }),
    }),

    update: Joi.object({
        amount: Joi.number().positive().precision(2).max(999999.99).optional().messages({
            "number.base": "Amount must be a number",
            "number.positive": "Amount must be greater than 0",
            "number.max": "Amount cannot exceed 999,999.99",
        }),
        description: Joi.string().min(1).max(500).optional().messages({
            "string.min": "Description cannot be empty",
            "string.max": "Description cannot exceed 500 characters",
        }),
    }),
};

// Parameter validation schemas
const paramValidationSchemas = {
    id: Joi.object({
        id: Joi.number().integer().positive().required().messages({
            "number.base": "ID must be a number",
            "number.positive": "ID must be positive",
            "any.required": "ID is required",
        }),
    }),
};

// Specific validation middleware functions
const validateUserRegistration = validate(userValidationSchemas.register);
const validateUserLogin = validate(userValidationSchemas.login);
const validateUserUpdate = validate(userValidationSchemas.updateProfile);

const validateDebtCreation = validate(debtValidationSchemas.create);
const validateDebtUpdate = validate(debtValidationSchemas.update);

const validateIdParam = validate(paramValidationSchemas.id, "params");

// Custom validation for debt creation (ensure debtor is not the same as creditor)
const validateDebtOwnership = async (req, res, next) => {
    const { debtorId } = req.body;
    const creditorId = req.user.id;

    if (parseInt(debtorId) === creditorId) {
        return res.status(400).json({
            success: false,
            message: "You cannot create a debt with yourself as the debtor",
        });
    }

    next();
};

// Sanitize input data
const sanitizeInput = (req, res, next) => {
    // Trim string values
    const sanitizeObject = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === "string") {
                obj[key] = obj[key].trim();
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
};

module.exports = {
    validate,
    validateUserRegistration,
    validateUserLogin,
    validateUserUpdate,
    validateDebtCreation,
    validateDebtUpdate,
    validateIdParam,
    validateDebtOwnership,
    sanitizeInput,
    userValidationSchemas,
    debtValidationSchemas,
    paramValidationSchemas,
};
