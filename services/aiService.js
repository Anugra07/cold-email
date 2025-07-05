const { OpenAI } = require('openai');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

class AIService {
  constructor() {
    this.openaiClient = null;
    this.isInitialized = false;
    this.providers = {
      openai: null,
      huggingface: null,
    };
    this.currentProvider = 'openai';
  }

  /**
   * Initialize AI providers
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize OpenAI
      if (config.ai.openai.apiKey) {
        this.openaiClient = new OpenAI({
          apiKey: config.ai.openai.apiKey,
        });
        this.providers.openai = { 
          available: true, 
          healthy: true,
          requestCount: 0,
        };
        logger.info('OpenAI client initialized');
      }

      // Initialize Hugging Face
      if (config.ai.huggingface.apiKey) {
        this.providers.huggingface = {
          available: true,
          healthy: true,
          requestCount: 0,
          apiKey: config.ai.huggingface.apiKey,
          model: config.ai.huggingface.model,
        };
        logger.info('Hugging Face client initialized');
      }

      if (!this.providers.openai?.available && !this.providers.huggingface?.available) {
        throw new Error('No AI providers configured');
      }

      this.isInitialized = true;
      logger.info('AI service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize AI service:', error);
      throw error;
    }
  }

  /**
   * Generate cold email content using AI
   */
  async generateColdEmail(prospect, campaignData, options = {}) {
    await this.initialize();

    const {
      emailType = 'initial',
      tone = 'professional',
      length = 'medium',
      includeCallToAction = true,
      customInstructions = '',
    } = options;

    const prompt = this.buildEmailPrompt(prospect, campaignData, {
      emailType,
      tone,
      length,
      includeCallToAction,
      customInstructions,
    });

    try {
      const response = await this.generateText(prompt, {
        maxTokens: config.ai.openai.maxTokens,
        temperature: 0.7,
      });

      // Parse the generated email
      const parsedEmail = this.parseGeneratedEmail(response.text);
      
      logger.info('AI email generated successfully', {
        provider: response.provider,
        prospect: prospect.email,
        emailType,
      });

      metrics.recordAIRequest(response.provider, response.model, 'success');

      return {
        ...parsedEmail,
        metadata: {
          provider: response.provider,
          model: response.model,
          prompt: prompt,
          generatedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      logger.error('Failed to generate email:', error);
      metrics.recordAIRequest(this.currentProvider, 'unknown', 'failed');
      throw error;
    }
  }

  /**
   * Generate follow-up email content
   */
  async generateFollowUpEmail(prospect, campaignData, previousEmails, options = {}) {
    const {
      followUpNumber = 1,
      daysSinceLastEmail = 3,
      tone = 'friendly',
      customInstructions = '',
    } = options;

    const prompt = this.buildFollowUpPrompt(prospect, campaignData, previousEmails, {
      followUpNumber,
      daysSinceLastEmail,
      tone,
      customInstructions,
    });

    try {
      const response = await this.generateText(prompt, {
        maxTokens: config.ai.openai.maxTokens,
        temperature: 0.8,
      });

      const parsedEmail = this.parseGeneratedEmail(response.text);

      logger.info('AI follow-up email generated', {
        provider: response.provider,
        prospect: prospect.email,
        followUpNumber,
      });

      metrics.recordAIRequest(response.provider, response.model, 'success');

      return {
        ...parsedEmail,
        metadata: {
          provider: response.provider,
          model: response.model,
          followUpNumber,
          generatedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      logger.error('Failed to generate follow-up email:', error);
      metrics.recordAIRequest(this.currentProvider, 'unknown', 'failed');
      throw error;
    }
  }

  /**
   * Generate text using available AI providers with fallback
   */
  async generateText(prompt, options = {}) {
    const { maxTokens = 1000, temperature = 0.7 } = options;

    // Try OpenAI first
    if (this.providers.openai?.healthy) {
      try {
        const response = await this.generateWithOpenAI(prompt, { maxTokens, temperature });
        this.providers.openai.requestCount++;
        return {
          text: response,
          provider: 'openai',
          model: config.ai.openai.model,
        };
      } catch (error) {
        logger.warn('OpenAI generation failed, trying fallback:', error);
        this.providers.openai.healthy = false;
      }
    }

    // Fallback to Hugging Face
    if (this.providers.huggingface?.healthy) {
      try {
        const response = await this.generateWithHuggingFace(prompt, { maxTokens, temperature });
        this.providers.huggingface.requestCount++;
        return {
          text: response,
          provider: 'huggingface',
          model: this.providers.huggingface.model,
        };
      } catch (error) {
        logger.warn('Hugging Face generation failed:', error);
        this.providers.huggingface.healthy = false;
      }
    }

    throw new Error('All AI providers failed or unavailable');
  }

  /**
   * Generate text using OpenAI
   */
  async generateWithOpenAI(prompt, options) {
    const completion = await this.openaiClient.chat.completions.create({
      model: config.ai.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert email copywriter specializing in professional cold outreach. Generate compelling, personalized emails that are concise, professional, and likely to get responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stop: ['---END---'],
    });

    return completion.choices[0].message.content.trim();
  }

  /**
   * Generate text using Hugging Face
   */
  async generateWithHuggingFace(prompt, options) {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${this.providers.huggingface.model}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: options.maxTokens,
          temperature: options.temperature,
          do_sample: true,
          top_p: 0.9,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.providers.huggingface.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data.error) {
      throw new Error(`Hugging Face API error: ${response.data.error}`);
    }

    return response.data[0]?.generated_text?.replace(prompt, '').trim() || '';
  }

  /**
   * Build email generation prompt
   */
  buildEmailPrompt(prospect, campaignData, options) {
    const {
      emailType,
      tone,
      length,
      includeCallToAction,
      customInstructions,
    } = options;

    const lengthGuides = {
      short: '50-80 words',
      medium: '80-120 words',
      long: '120-180 words',
    };

    const toneGuides = {
      professional: 'formal, respectful, business-appropriate',
      casual: 'friendly, approachable, conversational',
      friendly: 'warm, personable, helpful',
      direct: 'straight-to-the-point, clear, no-nonsense',
    };

    return `Write a ${tone} cold ${emailType} email for the following context:

PROSPECT INFORMATION:
- Name: ${prospect.firstName || prospect.fullName || 'the recipient'}
- Job Title: ${prospect.jobTitle || 'not specified'}
- Company: ${prospect.company || 'their company'}
- Location: ${prospect.location || 'not specified'}

CAMPAIGN CONTEXT:
- Campaign: ${campaignData.name || 'Professional Outreach'}
- Sender: ${campaignData.senderName || 'the sender'}
- Purpose: ${campaignData.description || 'professional networking and collaboration'}

REQUIREMENTS:
- Tone: ${toneGuides[tone]}
- Length: ${lengthGuides[length]}
- Personalize based on prospect's job title and company
- ${includeCallToAction ? 'Include a clear, specific call-to-action' : 'No call-to-action needed'}
- Make it feel genuine and not templated
- Focus on value proposition for the prospect

${customInstructions ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

Format the response as:
Subject: [email subject line]

[email body]

---END---`;
  }

  /**
   * Build follow-up email prompt
   */
  buildFollowUpPrompt(prospect, campaignData, previousEmails, options) {
    const {
      followUpNumber,
      daysSinceLastEmail,
      tone,
      customInstructions,
    } = options;

    const previousEmailsSummary = previousEmails
      .map(email => `- ${email.subject}: ${email.content.substring(0, 100)}...`)
      .join('\n');

    return `Write a ${tone} follow-up email (follow-up #${followUpNumber}) for this context:

PROSPECT INFORMATION:
- Name: ${prospect.firstName || prospect.fullName || 'the recipient'}
- Job Title: ${prospect.jobTitle || 'not specified'}
- Company: ${prospect.company || 'their company'}

PREVIOUS EMAILS SENT:
${previousEmailsSummary}

FOLLOW-UP CONTEXT:
- This is follow-up #${followUpNumber}
- ${daysSinceLastEmail} days since last email
- No response received yet

REQUIREMENTS:
- Keep it brief and respectful
- Reference the original message subtly
- Add new value or perspective
- Don't be pushy or aggressive
- Include a soft call-to-action
- Make it easy for them to respond or decline

${customInstructions ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

Format the response as:
Subject: [email subject line]

[email body]

---END---`;
  }

  /**
   * Parse generated email content
   */
  parseGeneratedEmail(generatedText) {
    const lines = generatedText.split('\n').filter(line => line.trim());
    
    let subject = '';
    let content = '';
    let isContent = false;

    for (const line of lines) {
      if (line.toLowerCase().startsWith('subject:')) {
        subject = line.replace(/^subject:\s*/i, '').trim();
      } else if (subject && !isContent) {
        // First line after subject starts the content
        isContent = true;
        content = line.trim();
      } else if (isContent && !line.includes('---END---')) {
        content += '\n' + line.trim();
      }
    }

    // Generate HTML version
    const htmlContent = this.convertToHtml(content);

    return {
      subject: subject || 'Professional Outreach',
      content: content.trim(),
      htmlContent,
    };
  }

  /**
   * Convert plain text email to basic HTML
   */
  convertToHtml(text) {
    return text
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  /**
   * Improve existing email content
   */
  async improveEmail(emailContent, improvements = []) {
    const improvementTypes = {
      tone: 'Make the tone more professional and engaging',
      length: 'Make it more concise while keeping the key message',
      personalization: 'Add more personalization and relevance',
      cta: 'Improve the call-to-action to be more compelling',
      value: 'Emphasize the value proposition better',
    };

    const improvementInstructions = improvements
      .map(type => improvementTypes[type])
      .join('. ');

    const prompt = `Improve the following email:

ORIGINAL EMAIL:
Subject: ${emailContent.subject}

${emailContent.content}

IMPROVEMENTS NEEDED:
${improvementInstructions}

Please rewrite the email maintaining the core message but implementing the requested improvements.

Format the response as:
Subject: [improved subject line]

[improved email body]

---END---`;

    try {
      const response = await this.generateText(prompt, {
        maxTokens: config.ai.openai.maxTokens,
        temperature: 0.6,
      });

      return this.parseGeneratedEmail(response.text);

    } catch (error) {
      logger.error('Failed to improve email:', error);
      throw error;
    }
  }

  /**
   * Health check for AI providers
   */
  async healthCheck() {
    const status = {
      openai: { available: false, healthy: false },
      huggingface: { available: false, healthy: false },
    };

    // Check OpenAI
    if (this.providers.openai?.available) {
      try {
        await this.openaiClient.models.list();
        status.openai = { available: true, healthy: true };
        this.providers.openai.healthy = true;
      } catch (error) {
        status.openai = { available: true, healthy: false, error: error.message };
        this.providers.openai.healthy = false;
      }
    }

    // Check Hugging Face
    if (this.providers.huggingface?.available) {
      try {
        const testResponse = await axios.post(
          `https://api-inference.huggingface.co/models/${this.providers.huggingface.model}`,
          { inputs: 'test' },
          {
            headers: {
              'Authorization': `Bearer ${this.providers.huggingface.apiKey}`,
            },
            timeout: 10000,
          }
        );
        status.huggingface = { available: true, healthy: true };
        this.providers.huggingface.healthy = true;
      } catch (error) {
        status.huggingface = { available: true, healthy: false, error: error.message };
        this.providers.huggingface.healthy = false;
      }
    }

    return status;
  }

  /**
   * Get AI service statistics
   */
  getStats() {
    return {
      providers: {
        openai: {
          available: this.providers.openai?.available || false,
          healthy: this.providers.openai?.healthy || false,
          requestCount: this.providers.openai?.requestCount || 0,
        },
        huggingface: {
          available: this.providers.huggingface?.available || false,
          healthy: this.providers.huggingface?.healthy || false,
          requestCount: this.providers.huggingface?.requestCount || 0,
        },
      },
      totalRequests: (this.providers.openai?.requestCount || 0) + (this.providers.huggingface?.requestCount || 0),
    };
  }
}

module.exports = new AIService();