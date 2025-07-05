// Global test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'mongodb://localhost:27017/cold-outreach-test';

// Global test timeout
jest.setTimeout(30000);

// Mock external services by default
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock Redis store
jest.mock('../utils/redisStore', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ping: jest.fn(() => Promise.resolve(true)),
  isConnected: true,
}));

// Mock metrics
jest.mock('../middleware/metrics', () => ({
  metrics: {
    recordEmailSent: jest.fn(),
    recordScrapingJob: jest.fn(),
    setCampaignCount: jest.fn(),
    setProspectCount: jest.fn(),
    recordAIRequest: jest.fn(),
    setActiveConnections: jest.fn(),
    setDatabaseConnections: jest.fn(),
    setRedisConnections: jest.fn(),
    recordRateLimitHit: jest.fn(),
    recordError: jest.fn(),
  },
  metricsMiddleware: jest.fn((req, res, next) => next()),
  getMetrics: jest.fn(() => Promise.resolve('# Mocked metrics')),
}));

// Global test helpers
global.createTestUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
});

global.createTestCampaign = (overrides = {}) => ({
  id: 'test-campaign-id',
  name: 'Test Campaign',
  description: 'Test campaign description',
  status: 'DRAFT',
  emailTemplate: 'Test email template with {{firstName}}',
  targetKeywords: ['test', 'keyword'],
  senderName: 'Test Sender',
  senderEmail: 'sender@test.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

global.createTestProspect = (overrides = {}) => ({
  id: 'test-prospect-id',
  email: 'prospect@test.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Test Company',
  jobTitle: 'Software Engineer',
  status: 'NEW',
  campaignId: 'test-campaign-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

global.createTestEmail = (overrides = {}) => ({
  id: 'test-email-id',
  subject: 'Test Email Subject',
  content: 'Test email content',
  htmlContent: '<p>Test email content</p>',
  type: 'INITIAL',
  status: 'PENDING',
  fromEmail: 'sender@test.com',
  toEmail: 'prospect@test.com',
  campaignId: 'test-campaign-id',
  prospectId: 'test-prospect-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});