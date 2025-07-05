const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const config = require('../config');
const logger = require('../utils/logger');
const redisStore = require('../utils/redisStore');
const emailService = require('../services/emailService');
const aiService = require('../services/aiService');
const scrapingService = require('../services/scrapingService');

const prisma = new PrismaClient();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      services: {},
      responseTime: 0,
    };

    // Quick health check - just verify basic connectivity
    const services = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkEmailService(),
      checkAIService(),
    ]);

    // Process service results
    healthStatus.services.database = services[0].status === 'fulfilled' ? services[0].value : { healthy: false, error: services[0].reason?.message };
    healthStatus.services.redis = services[1].status === 'fulfilled' ? services[1].value : { healthy: false, error: services[1].reason?.message };
    healthStatus.services.email = services[2].status === 'fulfilled' ? services[2].value : { healthy: false, error: services[2].reason?.message };
    healthStatus.services.ai = services[3].status === 'fulfilled' ? services[3].value : { healthy: false, error: services[3].reason?.message };

    // Determine overall health
    const allServicesHealthy = Object.values(healthStatus.services).every(service => service.healthy);
    healthStatus.status = allServicesHealthy ? 'healthy' : 'degraded';

    healthStatus.responseTime = Date.now() - startTime;

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check error:', error);
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime,
    };

    res.status(503).json(errorResponse);
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
      services: {},
      dependencies: {},
      responseTime: 0,
    };

    // Detailed service checks
    const serviceChecks = await Promise.allSettled([
      checkDatabaseDetailed(),
      checkRedisDetailed(),
      checkEmailServiceDetailed(),
      checkAIServiceDetailed(),
      checkExternalServices(),
    ]);

    healthStatus.services.database = serviceChecks[0].status === 'fulfilled' ? serviceChecks[0].value : { healthy: false, error: serviceChecks[0].reason?.message };
    healthStatus.services.redis = serviceChecks[1].status === 'fulfilled' ? serviceChecks[1].value : { healthy: false, error: serviceChecks[1].reason?.message };
    healthStatus.services.email = serviceChecks[2].status === 'fulfilled' ? serviceChecks[2].value : { healthy: false, error: serviceChecks[2].reason?.message };
    healthStatus.services.ai = serviceChecks[3].status === 'fulfilled' ? serviceChecks[3].value : { healthy: false, error: serviceChecks[3].reason?.message };
    healthStatus.dependencies = serviceChecks[4].status === 'fulfilled' ? serviceChecks[4].value : { error: serviceChecks[4].reason?.message };

    // Calculate overall health
    const criticalServices = ['database', 'redis'];
    const criticalServicesHealthy = criticalServices.every(service => healthStatus.services[service]?.healthy);
    const optionalServicesHealthy = Object.keys(healthStatus.services)
      .filter(service => !criticalServices.includes(service))
      .every(service => healthStatus.services[service]?.healthy);

    if (criticalServicesHealthy && optionalServicesHealthy) {
      healthStatus.status = 'healthy';
    } else if (criticalServicesHealthy) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }

    healthStatus.responseTime = Date.now() - startTime;

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Detailed health check error:', error);
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime,
    };

    res.status(503).json(errorResponse);
  }
});

/**
 * Readiness probe for Kubernetes
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if application is ready to serve traffic
    const readinessChecks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
    ]);

    const allReady = readinessChecks.every(check => check.status === 'fulfilled' && check.value.healthy);

    if (allReady) {
      res.status(200).json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'not ready',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({ 
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes
 * GET /health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Helper functions for service checks

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, responseTime: Date.now() };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

async function checkDatabaseDetailed() {
  const startTime = Date.now();
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Get some basic stats
    const campaignCount = await prisma.campaign.count();
    const prospectCount = await prisma.prospect.count();
    const emailCount = await prisma.email.count();

    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      stats: {
        campaigns: campaignCount,
        prospects: prospectCount,
        emails: emailCount,
      },
      connection: 'active',
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkRedis() {
  try {
    const isHealthy = await redisStore.ping();
    return { 
      healthy: isHealthy,
      responseTime: Date.now()
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

async function checkRedisDetailed() {
  const startTime = Date.now();
  try {
    const isHealthy = await redisStore.ping();
    
    // Try to set/get a test value
    const testKey = `health_check_${Date.now()}`;
    await redisStore.set(testKey, 'test', 10);
    const testValue = await redisStore.get(testKey);
    await redisStore.del(testKey);

    return {
      healthy: isHealthy && testValue === 'test',
      responseTime: Date.now() - startTime,
      connection: redisStore.isConnected ? 'connected' : 'disconnected',
      operations: {
        ping: isHealthy,
        set: true,
        get: testValue === 'test',
        delete: true,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkEmailService() {
  try {
    const healthCheck = await emailService.healthCheck();
    return {
      healthy: healthCheck.overall,
      providers: healthCheck.providers.length,
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

async function checkEmailServiceDetailed() {
  const startTime = Date.now();
  try {
    const healthCheck = await emailService.healthCheck();
    const stats = emailService.getStats();

    return {
      healthy: healthCheck.overall,
      responseTime: Date.now() - startTime,
      providers: healthCheck.providers,
      stats: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkAIService() {
  try {
    const stats = aiService.getStats();
    const hasHealthyProvider = Object.values(stats.providers).some(provider => provider.healthy);
    
    return {
      healthy: hasHealthyProvider,
      providers: Object.keys(stats.providers).length,
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

async function checkAIServiceDetailed() {
  const startTime = Date.now();
  try {
    const healthCheck = await aiService.healthCheck();
    const stats = aiService.getStats();

    return {
      healthy: Object.values(healthCheck).some(provider => provider.healthy),
      responseTime: Date.now() - startTime,
      providers: healthCheck,
      stats: stats,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkExternalServices() {
  const services = {};
  
  // Check internet connectivity
  try {
    const axios = require('axios');
    await axios.get('https://httpbin.org/status/200', { timeout: 5000 });
    services.internet = { healthy: true };
  } catch (error) {
    services.internet = { healthy: false, error: 'No internet connectivity' };
  }

  return services;
}

module.exports = router;