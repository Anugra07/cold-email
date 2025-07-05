const Joi = require('joi');
require('dotenv').config();

// Define validation schema for environment variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  
  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  
  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().default(100),
  
  // CORS
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  
  // OpenAI
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number().default(1000),
  
  // Hugging Face
  HUGGINGFACE_API_KEY: Joi.string().allow('').default(''),
  HUGGINGFACE_MODEL: Joi.string().default('microsoft/DialoGPT-medium'),
  
  // Email SMTP Primary
  SMTP_PRIMARY_HOST: Joi.string().required(),
  SMTP_PRIMARY_PORT: Joi.number().default(587),
  SMTP_PRIMARY_SECURE: Joi.boolean().default(false),
  SMTP_PRIMARY_USER: Joi.string().required(),
  SMTP_PRIMARY_PASS: Joi.string().required(),
  
  // Email SMTP Secondary
  SMTP_SECONDARY_HOST: Joi.string().allow('').default(''),
  SMTP_SECONDARY_PORT: Joi.number().default(587),
  SMTP_SECONDARY_SECURE: Joi.boolean().default(false),
  SMTP_SECONDARY_USER: Joi.string().allow('').default(''),
  SMTP_SECONDARY_PASS: Joi.string().allow('').default(''),
  
  // Email SMTP Tertiary
  SMTP_TERTIARY_HOST: Joi.string().allow('').default(''),
  SMTP_TERTIARY_PORT: Joi.number().default(587),
  SMTP_TERTIARY_SECURE: Joi.boolean().default(false),
  SMTP_TERTIARY_USER: Joi.string().allow('').default(''),
  SMTP_TERTIARY_PASS: Joi.string().allow('').default(''),
  
  // AWS S3
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET: Joi.string().allow('').default(''),
  
  // Scraping
  SCRAPING_MAX_CONCURRENT: Joi.number().default(5),
  SCRAPING_DELAY_MS: Joi.number().default(1000),
  SCRAPING_TIMEOUT_MS: Joi.number().default(30000),
  SCRAPING_USER_AGENT: Joi.string().default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
  
  // Puppeteer
  PUPPETEER_EXECUTABLE_PATH: Joi.string().allow('').default(''),
  PUPPETEER_HEADLESS: Joi.boolean().default(true),
  PUPPETEER_ARGS: Joi.string().default('--no-sandbox,--disable-setuid-sandbox'),
  
  // Background Jobs
  BULL_REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JOB_CONCURRENCY: Joi.number().default(5),
  JOB_MAX_RETRIES: Joi.number().default(3),
  JOB_BACKOFF_DELAY: Joi.number().default(5000),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PATH: Joi.string().default('/metrics'),
  
  // File Upload
  UPLOAD_MAX_SIZE: Joi.number().default(10485760), // 10MB
  UPLOAD_ALLOWED_TYPES: Joi.string().default('image/jpeg,image/png,application/pdf,text/plain'),
  
  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  SESSION_SECRET: Joi.string().required(),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  LOG_MAX_FILES: Joi.string().default('14d'),
  
  // API
  API_VERSION: Joi.string().default('v1'),
  API_PREFIX: Joi.string().default('/api'),
  
  // Health Check
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000),
  
  // Development/Testing
  TEST_DATABASE_URL: Joi.string().allow('').default(''),
  DISABLE_AUTH: Joi.boolean().default(false),
}).unknown();

const { error, value: envVars } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  server: {
    port: envVars.PORT,
    bodyLimit: '50mb',
  },
  database: {
    url: envVars.DATABASE_URL,
    testUrl: envVars.TEST_DATABASE_URL,
  },
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX,
  },
  cors: {
    allowedOrigins: envVars.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  },
  ai: {
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
      model: envVars.OPENAI_MODEL,
      maxTokens: envVars.OPENAI_MAX_TOKENS,
    },
    huggingface: {
      apiKey: envVars.HUGGINGFACE_API_KEY,
      model: envVars.HUGGINGFACE_MODEL,
    },
  },
  email: {
    providers: [
      {
        name: 'primary',
        host: envVars.SMTP_PRIMARY_HOST,
        port: envVars.SMTP_PRIMARY_PORT,
        secure: envVars.SMTP_PRIMARY_SECURE,
        auth: {
          user: envVars.SMTP_PRIMARY_USER,
          pass: envVars.SMTP_PRIMARY_PASS,
        },
      },
      ...(envVars.SMTP_SECONDARY_HOST ? [{
        name: 'secondary',
        host: envVars.SMTP_SECONDARY_HOST,
        port: envVars.SMTP_SECONDARY_PORT,
        secure: envVars.SMTP_SECONDARY_SECURE,
        auth: {
          user: envVars.SMTP_SECONDARY_USER,
          pass: envVars.SMTP_SECONDARY_PASS,
        },
      }] : []),
      ...(envVars.SMTP_TERTIARY_HOST ? [{
        name: 'tertiary',
        host: envVars.SMTP_TERTIARY_HOST,
        port: envVars.SMTP_TERTIARY_PORT,
        secure: envVars.SMTP_TERTIARY_SECURE,
        auth: {
          user: envVars.SMTP_TERTIARY_USER,
          pass: envVars.SMTP_TERTIARY_PASS,
        },
      }] : []),
    ],
  },
  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3Bucket: envVars.AWS_S3_BUCKET,
  },
  scraping: {
    maxConcurrent: envVars.SCRAPING_MAX_CONCURRENT,
    delayMs: envVars.SCRAPING_DELAY_MS,
    timeoutMs: envVars.SCRAPING_TIMEOUT_MS,
    userAgent: envVars.SCRAPING_USER_AGENT,
  },
  puppeteer: {
    executablePath: envVars.PUPPETEER_EXECUTABLE_PATH,
    headless: envVars.PUPPETEER_HEADLESS,
    args: envVars.PUPPETEER_ARGS.split(',').map(arg => arg.trim()),
  },
  jobs: {
    redisUrl: envVars.BULL_REDIS_URL,
    concurrency: envVars.JOB_CONCURRENCY,
    maxRetries: envVars.JOB_MAX_RETRIES,
    backoffDelay: envVars.JOB_BACKOFF_DELAY,
  },
  monitoring: {
    enableMetrics: envVars.ENABLE_METRICS,
    metricsPath: envVars.METRICS_PATH,
  },
  upload: {
    maxSize: envVars.UPLOAD_MAX_SIZE,
    allowedTypes: envVars.UPLOAD_ALLOWED_TYPES.split(',').map(type => type.trim()),
  },
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
  },
  logging: {
    level: envVars.LOG_LEVEL,
    maxSize: envVars.LOG_MAX_SIZE,
    maxFiles: envVars.LOG_MAX_FILES,
  },
  api: {
    version: envVars.API_VERSION,
    prefix: envVars.API_PREFIX,
  },
  healthCheck: {
    timeout: envVars.HEALTH_CHECK_TIMEOUT,
  },
  development: {
    disableAuth: envVars.DISABLE_AUTH,
  },
};

module.exports = config;