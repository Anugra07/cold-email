const promClient = require('prom-client');
const config = require('../config');

// Enable default metrics collection
promClient.register.clear();
promClient.collectDefaultMetrics({
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Application-specific metrics
const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

const emailsSentTotal = new promClient.Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['provider', 'status'],
});

const scrapingJobsTotal = new promClient.Counter({
  name: 'scraping_jobs_total',
  help: 'Total number of scraping jobs',
  labelNames: ['status'],
});

const campaignsTotal = new promClient.Gauge({
  name: 'campaigns_total',
  help: 'Total number of campaigns',
  labelNames: ['status'],
});

const prospectsTotal = new promClient.Gauge({
  name: 'prospects_total',
  help: 'Total number of prospects',
});

const aiRequestsTotal = new promClient.Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['provider', 'model', 'status'],
});

const databaseConnectionPool = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

const redisConnectionsActive = new promClient.Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
});

// Rate limiting metrics
const rateLimitHits = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['ip', 'endpoint'],
});

// Error metrics
const errorsTotal = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint'],
});

/**
 * Middleware to collect HTTP metrics
 */
const metricsMiddleware = (req, res, next) => {
  if (!config.monitoring.enableMetrics) {
    return next();
  }

  const startTime = Date.now();
  
  // Track request size
  const requestSize = parseInt(req.get('content-length')) || 0;
  if (requestSize > 0) {
    httpRequestSize
      .labels(req.method, req.route?.path || req.path)
      .observe(requestSize);
  }

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration
      .labels(req.method, route, statusCode)
      .observe(responseTime);

    httpRequestTotal
      .labels(req.method, route, statusCode)
      .inc();

    // Track response size
    if (chunk) {
      const responseSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      httpResponseSize
        .labels(req.method, route, statusCode)
        .observe(responseSize);
    }

    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      errorsTotal
        .labels(errorType, route)
        .inc();
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Get all metrics
 */
const getMetrics = async () => {
  return promClient.register.metrics();
};

/**
 * Custom metric functions for business logic
 */
const metrics = {
  // Email metrics
  recordEmailSent: (provider, status) => {
    emailsSentTotal.labels(provider, status).inc();
  },

  // Scraping metrics
  recordScrapingJob: (status) => {
    scrapingJobsTotal.labels(status).inc();
  },

  // Campaign metrics
  setCampaignCount: (status, count) => {
    campaignsTotal.labels(status).set(count);
  },

  // Prospect metrics
  setProspectCount: (count) => {
    prospectsTotal.set(count);
  },

  // AI metrics
  recordAIRequest: (provider, model, status) => {
    aiRequestsTotal.labels(provider, model, status).inc();
  },

  // Connection metrics
  setActiveConnections: (count) => {
    activeConnections.set(count);
  },

  setDatabaseConnections: (count) => {
    databaseConnectionPool.set(count);
  },

  setRedisConnections: (count) => {
    redisConnectionsActive.set(count);
  },

  // Rate limiting
  recordRateLimitHit: (ip, endpoint) => {
    rateLimitHits.labels(ip, endpoint).inc();
  },

  // Error tracking
  recordError: (type, endpoint) => {
    errorsTotal.labels(type, endpoint).inc();
  },
};

module.exports = {
  metricsMiddleware,
  getMetrics,
  metrics,
  register: promClient.register,
};