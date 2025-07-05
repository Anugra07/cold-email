const emailService = require('../../../services/emailService');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    verify: jest.fn(() => Promise.resolve()),
    sendMail: jest.fn(() => Promise.resolve({
      messageId: 'test-message-id',
      response: 'Email sent successfully'
    })),
    close: jest.fn()
  }))
}));

// Mock config
jest.mock('../../../config', () => ({
  email: {
    providers: [
      {
        name: 'primary',
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'testpass'
        }
      }
    ]
  }
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully with valid data', async () => {
      const emailData = {
        to: 'recipient@test.com',
        subject: 'Test Subject',
        text: 'Test content',
        from: 'sender@test.com'
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.provider).toBe('primary');
    });

    it('should throw error for invalid email data', async () => {
      const invalidEmailData = {
        subject: 'Test Subject',
        text: 'Test content'
        // Missing required 'to' field
      };

      await expect(emailService.sendEmail(invalidEmailData))
        .rejects
        .toThrow('Recipient email is required');
    });

    it('should validate email addresses', async () => {
      const emailDataWithInvalidEmail = {
        to: 'invalid-email',
        subject: 'Test Subject',
        text: 'Test content'
      };

      await expect(emailService.sendEmail(emailDataWithInvalidEmail))
        .rejects
        .toThrow('Invalid recipient email');
    });
  });

  describe('healthCheck', () => {
    it('should return health status of email providers', async () => {
      const healthStatus = await emailService.healthCheck();

      expect(healthStatus).toHaveProperty('overall');
      expect(healthStatus).toHaveProperty('providers');
      expect(Array.isArray(healthStatus.providers)).toBe(true);
    });
  });

  describe('createPersonalizedEmail', () => {
    it('should replace template variables with prospect data', () => {
      const template = {
        subject: 'Hello {{firstName}}',
        content: 'Hi {{firstName}} from {{company}}',
        htmlContent: '<p>Hi {{firstName}} from {{company}}</p>'
      };

      const prospect = {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Corp'
      };

      const campaignData = {
        name: 'Test Campaign',
        senderName: 'Jane Smith'
      };

      const result = emailService.createPersonalizedEmail(template, prospect, campaignData);

      expect(result.subject).toBe('Hello John');
      expect(result.text).toBe('Hi John from Test Corp');
      expect(result.html).toBe('<p>Hi John from Test Corp</p>');
    });

    it('should handle missing prospect data gracefully', () => {
      const template = {
        subject: 'Hello {{firstName}}',
        content: 'Hi {{firstName}} from {{company}}'
      };

      const prospect = {}; // Empty prospect data
      const campaignData = {};

      const result = emailService.createPersonalizedEmail(template, prospect, campaignData);

      expect(result.subject).toBe('Hello there');
      expect(result.text).toBe('Hi there from your company');
    });
  });

  describe('getStats', () => {
    it('should return email service statistics', () => {
      const stats = emailService.getStats();

      expect(stats).toHaveProperty('providers');
      expect(stats).toHaveProperty('totalProviders');
      expect(stats).toHaveProperty('healthyProviders');
      expect(Array.isArray(stats.providers)).toBe(true);
    });
  });
});

// Helper function for creating test email data
function createTestEmailData(overrides = {}) {
  return {
    to: 'test@example.com',
    subject: 'Test Subject',
    text: 'Test content',
    from: 'sender@example.com',
    ...overrides
  };
}