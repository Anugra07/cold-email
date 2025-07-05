const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

class EmailService {
  constructor() {
    this.transporters = [];
    this.currentTransporterIndex = 0;
    this.isInitialized = false;
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Initialize email transporters for all configured providers
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.transporters = [];

      for (const provider of config.email.providers) {
        if (provider.host && provider.auth.user && provider.auth.pass) {
          const transporter = nodemailer.createTransporter({
            host: provider.host,
            port: provider.port,
            secure: provider.secure,
            auth: {
              user: provider.auth.user,
              pass: provider.auth.pass,
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000, // 1 second between emails
            rateLimit: 5, // Max 5 emails per second
            tls: {
              rejectUnauthorized: false,
            },
          });

          // Verify transporter
          try {
            await transporter.verify();
            this.transporters.push({
              transporter,
              name: provider.name,
              isHealthy: true,
              lastError: null,
              emailsSent: 0,
            });
            logger.info(`Email provider initialized: ${provider.name}`);
          } catch (verifyError) {
            logger.warn(`Email provider verification failed: ${provider.name}`, verifyError);
            this.transporters.push({
              transporter,
              name: provider.name,
              isHealthy: false,
              lastError: verifyError.message,
              emailsSent: 0,
            });
          }
        }
      }

      if (this.transporters.length === 0) {
        throw new Error('No email providers configured');
      }

      this.isInitialized = true;
      logger.info(`Email service initialized with ${this.transporters.length} providers`);

    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  /**
   * Send email with automatic provider failover
   */
  async sendEmail(emailData) {
    await this.initialize();

    const {
      to,
      subject,
      text,
      html,
      from,
      replyTo,
      attachments = [],
    } = emailData;

    // Validate email data
    this.validateEmailData(emailData);

    let lastError = null;
    const healthyTransporters = this.transporters.filter(t => t.isHealthy);

    if (healthyTransporters.length === 0) {
      throw new Error('No healthy email providers available');
    }

    // Try each healthy transporter
    for (const transporterInfo of healthyTransporters) {
      try {
        const result = await this.sendWithTransporter(transporterInfo, {
          to,
          subject,
          text,
          html,
          from,
          replyTo,
          attachments,
        });

        // Record success metrics
        metrics.recordEmailSent(transporterInfo.name, 'success');
        transporterInfo.emailsSent++;

        logger.info('Email sent successfully', {
          provider: transporterInfo.name,
          to: Array.isArray(to) ? to.join(', ') : to,
          subject,
          messageId: result.messageId,
        });

        return {
          success: true,
          messageId: result.messageId,
          provider: transporterInfo.name,
          response: result.response,
        };

      } catch (error) {
        lastError = error;
        logger.warn(`Email sending failed with provider ${transporterInfo.name}:`, error);
        
        // Mark provider as unhealthy if it's a persistent error
        if (this.isPersistentError(error)) {
          transporterInfo.isHealthy = false;
          transporterInfo.lastError = error.message;
          logger.warn(`Marking provider ${transporterInfo.name} as unhealthy`);
        }

        // Record failure metrics
        metrics.recordEmailSent(transporterInfo.name, 'failed');
        
        continue;
      }
    }

    // All providers failed
    throw new Error(`Failed to send email with all providers. Last error: ${lastError?.message}`);
  }

  /**
   * Send email with specific transporter
   */
  async sendWithTransporter(transporterInfo, emailData) {
    const mailOptions = {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      replyTo: emailData.replyTo,
      attachments: emailData.attachments,
      headers: {
        'X-Mailer': 'Cold Outreach Platform',
        'X-Priority': '3',
      },
    };

    return transporterInfo.transporter.sendMail(mailOptions);
  }

  /**
   * Send bulk emails with rate limiting and error handling
   */
  async sendBulkEmails(emails, options = {}) {
    const {
      batchSize = 10,
      delayBetweenBatches = 1000,
      continueOnError = true,
    } = options;

    const results = {
      sent: [],
      failed: [],
      total: emails.length,
    };

    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(async (email, index) => {
        try {
          const result = await this.sendEmail(email);
          results.sent.push({
            index: i + index,
            email: email.to,
            result,
          });
        } catch (error) {
          results.failed.push({
            index: i + index,
            email: email.to,
            error: error.message,
          });

          if (!continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(batchPromises);

      // Delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await this.delay(delayBetweenBatches);
      }

      logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}`);
    }

    logger.info(`Bulk email sending completed: ${results.sent.length} sent, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Send follow-up email
   */
  async sendFollowUp(originalEmail, followUpData) {
    const followUpEmail = {
      ...originalEmail,
      ...followUpData,
      subject: followUpData.subject || `Re: ${originalEmail.subject}`,
      headers: {
        'In-Reply-To': originalEmail.messageId,
        'References': originalEmail.messageId,
      },
    };

    return this.sendEmail(followUpEmail);
  }

  /**
   * Validate email data
   */
  validateEmailData(emailData) {
    if (!emailData.to) {
      throw new Error('Recipient email is required');
    }

    if (!emailData.subject) {
      throw new Error('Email subject is required');
    }

    if (!emailData.text && !emailData.html) {
      throw new Error('Email content (text or html) is required');
    }

    // Validate email addresses
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    recipients.forEach(email => {
      if (!this.isValidEmail(email)) {
        throw new Error(`Invalid recipient email: ${email}`);
      }
    });

    if (emailData.from && !this.isValidEmail(emailData.from)) {
      throw new Error(`Invalid sender email: ${emailData.from}`);
    }
  }

  /**
   * Check if error is persistent (should mark provider as unhealthy)
   */
  isPersistentError(error) {
    const persistentErrorCodes = [
      'EAUTH', // Authentication failed
      'EENVELOPE', // Invalid envelope
      'EMESSAGE', // Invalid message
    ];

    const persistentErrorMessages = [
      'Invalid login',
      'Authentication failed',
      'Username and Password not accepted',
      'Invalid credentials',
    ];

    return (
      persistentErrorCodes.includes(error.code) ||
      persistentErrorMessages.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      )
    );
  }

  /**
   * Health check for email providers
   */
  async healthCheck() {
    const healthStatus = [];

    for (const transporterInfo of this.transporters) {
      try {
        await transporterInfo.transporter.verify();
        transporterInfo.isHealthy = true;
        transporterInfo.lastError = null;
        healthStatus.push({
          name: transporterInfo.name,
          isHealthy: true,
          emailsSent: transporterInfo.emailsSent,
        });
      } catch (error) {
        transporterInfo.isHealthy = false;
        transporterInfo.lastError = error.message;
        healthStatus.push({
          name: transporterInfo.name,
          isHealthy: false,
          lastError: error.message,
          emailsSent: transporterInfo.emailsSent,
        });
      }
    }

    return {
      overall: healthStatus.some(status => status.isHealthy),
      providers: healthStatus,
    };
  }

  /**
   * Get email service statistics
   */
  getStats() {
    return {
      providers: this.transporters.map(t => ({
        name: t.name,
        isHealthy: t.isHealthy,
        emailsSent: t.emailsSent,
        lastError: t.lastError,
      })),
      totalProviders: this.transporters.length,
      healthyProviders: this.transporters.filter(t => t.isHealthy).length,
    };
  }

  /**
   * Create email template with personalization
   */
  createPersonalizedEmail(template, prospect, campaignData) {
    const variables = {
      firstName: prospect.firstName || 'there',
      lastName: prospect.lastName || '',
      fullName: prospect.fullName || prospect.firstName || 'there',
      company: prospect.company || 'your company',
      jobTitle: prospect.jobTitle || 'your role',
      location: prospect.location || '',
      campaignName: campaignData.name || '',
      senderName: campaignData.senderName || '',
      senderEmail: campaignData.senderEmail || '',
    };

    let personalizedSubject = template.subject;
    let personalizedContent = template.content;
    let personalizedHtml = template.htmlContent;

    // Replace variables in subject and content
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'gi');
      personalizedSubject = personalizedSubject.replace(placeholder, value);
      personalizedContent = personalizedContent.replace(placeholder, value);
      if (personalizedHtml) {
        personalizedHtml = personalizedHtml.replace(placeholder, value);
      }
    });

    return {
      subject: personalizedSubject,
      text: personalizedContent,
      html: personalizedHtml,
    };
  }

  /**
   * Utility methods
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    for (const transporterInfo of this.transporters) {
      try {
        transporterInfo.transporter.close();
      } catch (error) {
        logger.warn(`Error closing transporter ${transporterInfo.name}:`, error);
      }
    }
    logger.info('Email service cleanup completed');
  }
}

module.exports = new EmailService();