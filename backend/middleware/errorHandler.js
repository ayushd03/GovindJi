const fs = require('fs');
const path = require('path');

/**
 * Standardized Error Handling Middleware
 * Ensures all API errors are properly logged and formatted
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Enhanced error logger with different log levels
 */
const logger = {
    error: (message, error, context = {}) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: 'ERROR',
            message,
            error: {
                name: error?.name,
                message: error?.message,
                stack: error?.stack
            },
            context
        };
        
        console.error(`[${timestamp}] ERROR: ${message}`, error);
        
        // Write to error log file
        const logFilePath = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
    },
    
    warn: (message, context = {}) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: 'WARNING',
            message,
            context
        };
        
        console.warn(`[${timestamp}] WARNING: ${message}`);
        
        // Write to warning log file
        const logFilePath = path.join(logsDir, `warning-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
    },
    
    info: (message, context = {}) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`);
    }
};

/**
 * Async wrapper to catch errors in route handlers
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Standard error response formatter
 */
const formatErrorResponse = (error, req) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const response = {
        success: false,
        error: error.message || 'An error occurred',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    };
    
    // Add stack trace in development mode
    if (isDevelopment && error.stack) {
        response.stack = error.stack;
    }
    
    // Add request ID if available
    if (req.requestId) {
        response.requestId = req.requestId;
    }
    
    return response;
};

/**
 * Global error handling middleware
 * This should be the last middleware in your app
 */
const errorHandler = (error, req, res, next) => {
    let statusCode = error.statusCode || 500;
    
    // Log the error with context
    const context = {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
    };
    
    logger.error(`API Error: ${error.message}`, error, context);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
    } else if (error.name === 'CastError') {
        statusCode = 400;
        error.message = 'Invalid ID format';
    } else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        error.message = 'Invalid token';
    } else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        error.message = 'Token expired';
    } else if (error.code === 11000) {
        statusCode = 400;
        error.message = 'Duplicate field value';
    }
    
    // Format the error response
    const errorResponse = formatErrorResponse(error, req);
    
    // Send error response
    res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    const message = `Route ${req.originalUrl} not found`;
    logger.warn(message, {
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
    });
    
    res.status(404).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    });
};

/**
 * Request ID middleware to track requests
 */
const requestId = (req, res, next) => {
    req.requestId = require('crypto').randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
};

/**
 * Success response formatter
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

/**
 * Error response formatter for manual use
 */
const sendError = (res, message, statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    };
    
    if (details) {
        response.details = details;
    }
    
    res.status(statusCode).json(response);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    requestId,
    logger,
    sendSuccess,
    sendError,
    formatErrorResponse
};