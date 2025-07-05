const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cold Outreach Backend API',
      version: '1.0.0',
      description: 'Production-ready Express.js backend for automated cold-outreach platform',
      contact: {
        name: 'Cold Outreach Team',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.coldoutreach.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            message: {
              type: 'string',
              example: 'Detailed error description',
            },
            statusCode: {
              type: 'integer',
              example: 400,
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            path: {
              type: 'string',
              example: '/api/v1/campaigns',
            },
            method: {
              type: 'string',
              example: 'POST',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
            totalCount: {
              type: 'integer',
              example: 100,
            },
            hasNextPage: {
              type: 'boolean',
              example: true,
            },
            hasPrevPage: {
              type: 'boolean',
              example: false,
            },
            limit: {
              type: 'integer',
              example: 20,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'System health and monitoring endpoints',
      },
      {
        name: 'Campaigns',
        description: 'Campaign management operations',
      },
      {
        name: 'Prospects',
        description: 'Prospect management operations',
      },
      {
        name: 'Emails',
        description: 'Email management and sending operations',
      },
      {
        name: 'Scraping',
        description: 'Web scraping operations',
      },
      {
        name: 'AI',
        description: 'AI-powered content generation',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting',
      },
    ],
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './app.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;