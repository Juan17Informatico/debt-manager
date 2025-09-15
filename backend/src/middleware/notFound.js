const { AppError } = require("./errorHandler");

// 404 Not Found middleware
const notFound = (req, res, next) => {
    const error = new AppError(`Route not found - ${req.method} ${req.originalUrl}`, 404);
    next(error);
};

module.exports = notFound;
