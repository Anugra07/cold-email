const logger = require('../utils/logger');
const config = require('../config');

/**
 * Production-ready error handler middleware
 * Handles all types of errors including validation, authentication, and system errors
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  const logContext = {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
  };

  // Mongoose/Prisma validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => error.message).join(', ');
    error = {
      name: 'ValidationError',
      message,
      statusCode: 400
    };
    logger.warn('Validation Error', { ...logContext, validationErrors: err.errors });
  }

  // Mongoose/Prisma duplicate key error
  if (err.code === 11000 || err.code === 'P2002') {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value for ${field}`;
    error = {
      name: 'DuplicateError',
      message,
      statusCode: 400
    };
    logger.warn('Duplicate Key Error', { ...logContext, field });
  }

  // Mongoose/Prisma cast error
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      name: 'NotFoundError',
      message,
      statusCode: 404
    };
    logger.warn('Cast Error', { ...logContext, value: err.value });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      name: 'AuthenticationError',
      message,
      statusCode: 401
    };
    logger.warn('JWT Error', logContext);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      name: 'AuthenticationError',
      message,
      statusCode: 401
    };
    logger.warn('Token Expired', logContext);
  }

  // Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = {
      name: 'UploadError',
      message,
      statusCode: 413
    };
    logger.warn('File Upload Error', { ...logContext, fileSize: err.field });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = {
      name: 'UploadError',
      message,
      statusCode: 400
    };
    logger.warn('Unexpected File Field', { ...logContext, field: err.field });
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = {
      name: 'RateLimitError',
      message,
      statusCode: 429
    };
    logger.warn('Rate Limit Exceeded', logContext);
  }

  // Celebrate/Joi validation errors
  if (err.joi || err.isJoi) {
    const message = err.details?.map(detail => detail.message).join(', ') || 'Validation failed';
    error = {
      name: 'ValidationError',
      message,
      statusCode: 400
    };
    logger.warn('Joi Validation Error', { ...logContext, details: err.details });
  }

  // Axios/HTTP errors
  if (err.isAxiosError) {
    const message = err.response?.data?.message || err.message || 'External service error';
    error = {
      name: 'ExternalServiceError',
      message,
      statusCode: err.response?.status || 502
    };
    logger.error('External Service Error', {
      ...logContext,
      service: err.config?.baseURL,
      responseData: err.response?.data
    });
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server Error', logContext);
  } else if (statusCode >= 400) {
    logger.warn('Client Error', logContext);
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Include stack trace in development
  if (config.env === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  // Add retry information for recoverable errors
  if (['ExternalServiceError', 'DatabaseError'].includes(error.name)) {
    errorResponse.retryable = true;
    errorResponse.retryAfter = 5000; // 5 seconds
  }

  // CORS headers for error responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;