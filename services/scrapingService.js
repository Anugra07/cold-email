const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const validator = require('validator');
const emailValidator = require('email-validator');

const config = require('../config');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

class ScrapingService {
  constructor() {
    this.browser = null;
    this.isInitialized = false;
    this.activeScrapingJobs = new Map();
  }

  /**
   * Initialize Puppeteer browser for dynamic content scraping
   */
  async initializeBrowser() {
    if (this.browser) {
      return this.browser;
    }

    try {
      const browserOptions = {
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: 30000,
        defaultViewport: {
          width: 1280,
          height: 720,
        },
      };

      if (config.puppeteer.executablePath) {
        browserOptions.executablePath = config.puppeteer.executablePath;
      }

      this.browser = await puppeteer.launch(browserOptions);
      this.isInitialized = true;
      
      logger.info('Puppeteer browser initialized successfully');
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize Puppeteer browser:', error);
      throw new Error('Browser initialization failed');
    }
  }

  /**
   * Scrape LinkedIn profiles using static content parsing
   */
  async scrapeLinkedInProfiles(searchUrl, options = {}) {
    const {
      maxResults = 50,
      jobTitles = [],
      keywords = [],
      locations = [],
    } = options;

    const jobId = `linkedin_${Date.now()}`;
    this.activeScrapingJobs.set(jobId, { status: 'running', progress: 0 });

    try {
      logger.info(`Starting LinkedIn scraping job: ${jobId}`, { searchUrl, maxResults });
      metrics.recordScrapingJob('started');

      const results = [];
      let page = 1;
      let totalProcessed = 0;

      while (results.length < maxResults && page <= 10) { // Limit to 10 pages
        try {
          const pageUrl = this.buildLinkedInSearchUrl(searchUrl, page, jobTitles, keywords, locations);
          const profiles = await this.scrapeLinkedInPage(pageUrl);
          
          if (profiles.length === 0) {
            logger.info(`No more profiles found on page ${page}, stopping scrape`);
            break;
          }

          // Filter and validate profiles
          const filteredProfiles = profiles
            .filter(profile => this.validateProfile(profile))
            .slice(0, maxResults - results.length);

          results.push(...filteredProfiles);
          totalProcessed += profiles.length;

          // Update progress
          const progress = Math.min((results.length / maxResults) * 100, 100);
          this.activeScrapingJobs.set(jobId, { status: 'running', progress });

          logger.info(`Scraped page ${page}: ${profiles.length} profiles, ${results.length} total valid`);

          // Rate limiting delay
          await this.delay(config.scraping.delayMs);
          page++;

        } catch (pageError) {
          logger.warn(`Error scraping page ${page}:`, pageError);
          page++;
          continue;
        }
      }

      this.activeScrapingJobs.set(jobId, { status: 'completed', progress: 100 });
      metrics.recordScrapingJob('completed');

      logger.info(`LinkedIn scraping completed: ${results.length} profiles extracted`);
      return {
        jobId,
        profiles: results,
        totalFound: results.length,
        totalProcessed,
        status: 'completed'
      };

    } catch (error) {
      this.activeScrapingJobs.set(jobId, { status: 'failed', progress: 0 });
      metrics.recordScrapingJob('failed');
      logger.error('LinkedIn scraping failed:', error);
      throw error;
    }
  }

  /**
   * Scrape a single LinkedIn search results page
   */
  async scrapeLinkedInPage(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': config.scraping.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: config.scraping.timeoutMs,
      });

      const $ = cheerio.load(response.data);
      const profiles = [];

      // LinkedIn search result selectors (these may need updating based on LinkedIn's structure)
      $('.search-result__info, .entity-result__content').each((index, element) => {
        try {
          const $element = $(element);
          
          const profile = {
            name: this.extractText($element, '.search-result__result-link, .entity-result__title-text a'),
            jobTitle: this.extractText($element, '.search-result__snippets, .entity-result__primary-subtitle'),
            company: this.extractText($element, '.search-result__snippets .search-result__snippet-text, .entity-result__secondary-subtitle'),
            location: this.extractText($element, '.search-result__geo, .entity-result__location'),
            linkedinUrl: this.extractHref($element, '.search-result__result-link, .entity-result__title-text a'),
            email: null, // Will be extracted separately
            confidence: 0.7, // Base confidence for LinkedIn scraping
          };

          // Try to extract email from visible text or additional processing
          profile.email = this.extractEmailFromText($element.text());
          
          if (profile.name && (profile.jobTitle || profile.company)) {
            profiles.push(profile);
          }

        } catch (elementError) {
          logger.warn('Error processing profile element:', elementError);
        }
      });

      return profiles;

    } catch (error) {
      // Fallback to Puppeteer for dynamic content
      if (error.response?.status === 403 || error.response?.status === 429) {
        logger.info('Static scraping blocked, falling back to Puppeteer');
        return this.scrapeWithPuppeteer(url);
      }
      throw error;
    }
  }

  /**
   * Scrape using Puppeteer for dynamic content
   */
  async scrapeWithPuppeteer(url) {
    await this.initializeBrowser();
    
    const page = await this.browser.newPage();
    
    try {
      // Set user agent and viewport
      await page.setUserAgent(config.scraping.userAgent);
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: config.scraping.timeoutMs 
      });

      // Wait for search results to load
      await page.waitForSelector('.search-result__info, .entity-result__content', { timeout: 10000 });

      // Extract profiles using page evaluation
      const profiles = await page.evaluate(() => {
        const results = [];
        const elements = document.querySelectorAll('.search-result__info, .entity-result__content');
        
        elements.forEach(element => {
          try {
            const nameElement = element.querySelector('.search-result__result-link, .entity-result__title-text a');
            const jobElement = element.querySelector('.search-result__snippets, .entity-result__primary-subtitle');
            const companyElement = element.querySelector('.search-result__snippets .search-result__snippet-text, .entity-result__secondary-subtitle');
            const locationElement = element.querySelector('.search-result__geo, .entity-result__location');
            
            const profile = {
              name: nameElement?.textContent?.trim() || null,
              jobTitle: jobElement?.textContent?.trim() || null,
              company: companyElement?.textContent?.trim() || null,
              location: locationElement?.textContent?.trim() || null,
              linkedinUrl: nameElement?.href || null,
              email: null,
              confidence: 0.8, // Higher confidence for Puppeteer scraping
            };

            if (profile.name && (profile.jobTitle || profile.company)) {
              results.push(profile);
            }
          } catch (error) {
            console.warn('Error processing element:', error);
          }
        });

        return results;
      });

      return profiles;

    } finally {
      await page.close();
    }
  }

  /**
   * Scrape company websites for contact information
   */
  async scrapeCompanyWebsite(url, options = {}) {
    const { extractEmails = true, extractContacts = true } = options;

    try {
      logger.info(`Scraping company website: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': config.scraping.userAgent,
        },
        timeout: config.scraping.timeoutMs,
      });

      const $ = cheerio.load(response.data);
      const results = {
        url,
        title: $('title').text().trim(),
        emails: [],
        contacts: [],
        socialLinks: {},
      };

      if (extractEmails) {
        // Extract emails from page content
        results.emails = this.extractEmailsFromPage($);
      }

      if (extractContacts) {
        // Extract contact information
        results.contacts = this.extractContactInfo($);
      }

      // Extract social media links
      results.socialLinks = this.extractSocialLinks($);

      logger.info(`Company website scraping completed: ${results.emails.length} emails found`);
      return results;

    } catch (error) {
      logger.error(`Error scraping company website ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract emails from page content using regex
   */
  extractEmailsFromPage($) {
    const emails = new Set();
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    // Search in text content
    const pageText = $('body').text();
    const matches = pageText.match(emailRegex) || [];
    
    matches.forEach(email => {
      if (emailValidator.validate(email) && !this.isCommonEmail(email)) {
        emails.add(email.toLowerCase());
      }
    });

    // Search in mailto links
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr('href');
      const email = href.replace('mailto:', '').split('?')[0];
      if (emailValidator.validate(email)) {
        emails.add(email.toLowerCase());
      }
    });

    return Array.from(emails);
  }

  /**
   * Extract contact information from page
   */
  extractContactInfo($) {
    const contacts = [];
    
    // Look for contact sections
    const contactSelectors = [
      '.contact',
      '.contact-info',
      '.contact-us',
      '.team',
      '.about-us',
      '.staff',
      '.leadership'
    ];

    contactSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $element = $(element);
        const text = $element.text();
        
        // Extract names (simple heuristic)
        const nameRegex = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
        const names = text.match(nameRegex) || [];
        
        names.forEach(name => {
          if (!this.isCommonWord(name)) {
            contacts.push({
              name: name.trim(),
              section: selector,
              context: text.substring(0, 200) + '...'
            });
          }
        });
      });
    });

    return contacts;
  }

  /**
   * Extract social media links
   */
  extractSocialLinks($) {
    const socialLinks = {};
    const socialPlatforms = {
      linkedin: /linkedin\.com/i,
      twitter: /twitter\.com|x\.com/i,
      facebook: /facebook\.com/i,
      instagram: /instagram\.com/i,
      youtube: /youtube\.com/i,
    };

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      
      Object.entries(socialPlatforms).forEach(([platform, regex]) => {
        if (regex.test(href)) {
          socialLinks[platform] = href;
        }
      });
    });

    return socialLinks;
  }

  /**
   * Build LinkedIn search URL with parameters
   */
  buildLinkedInSearchUrl(baseUrl, page, jobTitles, keywords, locations) {
    const url = new URL(baseUrl);
    
    if (page > 1) {
      url.searchParams.set('page', page);
    }
    
    return url.toString();
  }

  /**
   * Validate scraped profile data
   */
  validateProfile(profile) {
    if (!profile.name || profile.name.length < 2) {
      return false;
    }

    if (profile.email && !emailValidator.validate(profile.email)) {
      profile.email = null;
    }

    // Clean up data
    profile.name = this.cleanText(profile.name);
    profile.jobTitle = this.cleanText(profile.jobTitle);
    profile.company = this.cleanText(profile.company);
    profile.location = this.cleanText(profile.location);

    return true;
  }

  /**
   * Helper methods
   */
  extractText($element, selector) {
    const element = $element.find(selector).first();
    return element.length ? element.text().trim() : null;
  }

  extractHref($element, selector) {
    const element = $element.find(selector).first();
    return element.length ? element.attr('href') : null;
  }

  extractEmailFromText(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match && emailValidator.validate(match[0]) ? match[0].toLowerCase() : null;
  }

  cleanText(text) {
    if (!text) return null;
    return text.replace(/\s+/g, ' ').trim();
  }

  isCommonEmail(email) {
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = email.split('@')[1];
    return commonDomains.includes(domain);
  }

  isCommonWord(word) {
    const commonWords = ['Contact', 'About', 'Team', 'Staff', 'Our Team', 'Leadership'];
    return commonWords.includes(word);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scraping job status
   */
  getJobStatus(jobId) {
    return this.activeScrapingJobs.get(jobId) || { status: 'not_found', progress: 0 };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      logger.info('Puppeteer browser closed');
    }
  }
}

module.exports = new ScrapingService();