const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

class RedisStore {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    try {
      // Parse Redis URL or use individual config
      const redisConfig = {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        showFriendlyErrorStack: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      if (config.redis.url) {
        this.client = new Redis(config.redis.url, redisConfig);
      } else {
        this.client = new Redis({
          ...redisConfig,
          host: 'localhost',
          port: 6379,
          db: config.redis.db,
          password: config.redis.password || undefined,
        });
      }

      this.setupEventHandlers();
    } catch (error) {
      logger.error('Redis initialization error:', error);
      this.client = null;
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis connection established');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  // Rate limiting store implementation for express-rate-limit
  async incr(key) {
    if (!this.isConnected || !this.client) {
      return { totalHits: 1, resetTime: new Date() };
    }

    try {
      const results = await this.client
        .multi()
        .incr(key)
        .ttl(key)
        .exec();

      const [[, totalHits], [, ttl]] = results;
      
      let resetTime;
      if (ttl === -1) {
        // Key exists but no TTL set, set it
        await this.client.expire(key, Math.ceil(config.rateLimit.windowMs / 1000));
        resetTime = new Date(Date.now() + config.rateLimit.windowMs);
      } else {
        resetTime = new Date(Date.now() + (ttl * 1000));
      }

      return {
        totalHits,
        resetTime
      };
    } catch (error) {
      logger.error('Redis incr error:', error);
      return { totalHits: 1, resetTime: new Date() };
    }
  }

  async decrement(key) {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.decr(key);
    } catch (error) {
      logger.error('Redis decr error:', error);
    }
  }

  async resetKey(key) {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
    }
  }

  // Cache methods
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis del error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }

  // Session store methods
  async setSession(sessionId, sessionData, maxAge) {
    const key = `session:${sessionId}`;
    const ttl = Math.ceil(maxAge / 1000);
    return this.set(key, sessionData, ttl);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return this.del(key);
  }

  // Health check
  async ping() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping error:', error);
      return false;
    }
  }

  // Graceful shutdown
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis connection closed gracefully');
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Create singleton instance
const redisStore = new RedisStore();

// Export both the store instance and the class
module.exports = redisStore;