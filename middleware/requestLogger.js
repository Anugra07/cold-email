const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Adds unique request IDs and logs request/response details
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.id = uuidv4();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  // Start timer
  const startTime = Date.now();
  
  // Log request details
  const requestLog = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    headers: filterSensitiveHeaders(req.headers),
  };

  // Add body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body) {
    requestLog.body = filterSensitiveData(req.body);
  }

  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    requestLog.query = req.query;
  }

  logger.info('Incoming Request', requestLog);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const responseTime = Date.now() - startTime;
    
    const responseLog = {
      requestId: req.id,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: Buffer.byteLength(JSON.stringify(body), 'utf8'),
    };

    // Log response based on status code
    if (res.statusCode >= 400) {
      responseLog.error = body.error || body.message;
      logger.warn('Request Error', responseLog);
    } else {
      logger.info('Request Completed', responseLog);
    }

    // Call original json method
    return originalJson.call(this, body);
  };

  // Override res.send for non-JSON responses
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    const responseLog = {
      requestId: req.id,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : 0,
    };

    if (res.statusCode >= 400) {
      logger.warn('Request Error', responseLog);
    } else {
      logger.info('Request Completed', responseLog);
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Filter out sensitive headers from logging
 */
function filterSensitiveHeaders(headers) {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'authorization',
  ];

  const filtered = { ...headers };
  
  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });

  return filtered;
}

/**
 * Filter out sensitive data from request body
 */
function filterSensitiveData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'smtp_pass',
    'api_key',
    'access_key',
    'private_key',
  ];

  const filtered = Array.isArray(data) ? [...data] : { ...data };

  const filterRecursive = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(item => filterRecursive(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result = {};
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => 
          lowerKey.includes(field)
        );
        
        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = filterRecursive(obj[key]);
        }
      });
      return result;
    }
    
    return obj;
  };

  return filterRecursive(filtered);
}

module.exports = requestLogger;