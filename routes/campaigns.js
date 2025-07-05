const express = require('express');
const router = express.Router();
const { celebrate, Joi, Segments } = require('celebrate');
const campaignController = require('../controllers/campaignController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Campaign:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED]
 *         emailSubject:
 *           type: string
 *         emailTemplate:
 *           type: string
 *         followUpTemplate:
 *           type: string
 *         maxFollowUps:
 *           type: integer
 *         followUpDelayHours:
 *           type: integer
 *         targetKeywords:
 *           type: array
 *           items:
 *             type: string
 *         targetJobTitles:
 *           type: array
 *           items:
 *             type: string
 *         targetCompanies:
 *           type: array
 *           items:
 *             type: string
 *         targetLocations:
 *           type: array
 *           items:
 *             type: string
 *         senderName:
 *           type: string
 *         senderEmail:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/campaigns:
 *   get:
 *     summary: Get all campaigns
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED]
 *         description: Filter by campaign status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in campaign name and description
 *     responses:
 *       200:
 *         description: List of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *                 pagination:
 *                   type: object
 */
router.get('/', 
  celebrate({
    [Segments.QUERY]: {
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'),
      search: Joi.string().max(255),
      sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'status').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    }
  }),
  campaignController.getAllCampaigns
);

/**
 * @swagger
 * /api/v1/campaigns/{id}:
 *   get:
 *     summary: Get campaign by ID
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found
 */
router.get('/:id',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    }
  }),
  campaignController.getCampaignById
);

/**
 * @swagger
 * /api/v1/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               emailSubject:
 *                 type: string
 *                 maxLength: 255
 *               emailTemplate:
 *                 type: string
 *               followUpTemplate:
 *                 type: string
 *               maxFollowUps:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *               followUpDelayHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *               targetKeywords:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetJobTitles:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetCompanies:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetLocations:
 *                 type: array
 *                 items:
 *                   type: string
 *               senderName:
 *                 type: string
 *                 maxLength: 255
 *               senderEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Validation error
 */
router.post('/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().min(1).max(255).required(),
      description: Joi.string().max(1000),
      emailSubject: Joi.string().max(255),
      emailTemplate: Joi.string(),
      followUpTemplate: Joi.string(),
      maxFollowUps: Joi.number().integer().min(0).max(10).default(3),
      followUpDelayHours: Joi.number().integer().min(1).max(168).default(72),
      targetKeywords: Joi.array().items(Joi.string().max(100)),
      targetJobTitles: Joi.array().items(Joi.string().max(100)),
      targetCompanies: Joi.array().items(Joi.string().max(100)),
      targetLocations: Joi.array().items(Joi.string().max(100)),
      senderName: Joi.string().max(255),
      senderEmail: Joi.string().email(),
    }
  }),
  campaignController.createCampaign
);

/**
 * @swagger
 * /api/v1/campaigns/{id}:
 *   put:
 *     summary: Update campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED]
 *               emailSubject:
 *                 type: string
 *                 maxLength: 255
 *               emailTemplate:
 *                 type: string
 *               followUpTemplate:
 *                 type: string
 *               maxFollowUps:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *               followUpDelayHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *               targetKeywords:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetJobTitles:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetCompanies:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetLocations:
 *                 type: array
 *                 items:
 *                   type: string
 *               senderName:
 *                 type: string
 *                 maxLength: 255
 *               senderEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *       404:
 *         description: Campaign not found
 */
router.put('/:id',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    },
    [Segments.BODY]: {
      name: Joi.string().min(1).max(255),
      description: Joi.string().max(1000),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'),
      emailSubject: Joi.string().max(255),
      emailTemplate: Joi.string(),
      followUpTemplate: Joi.string(),
      maxFollowUps: Joi.number().integer().min(0).max(10),
      followUpDelayHours: Joi.number().integer().min(1).max(168),
      targetKeywords: Joi.array().items(Joi.string().max(100)),
      targetJobTitles: Joi.array().items(Joi.string().max(100)),
      targetCompanies: Joi.array().items(Joi.string().max(100)),
      targetLocations: Joi.array().items(Joi.string().max(100)),
      senderName: Joi.string().max(255),
      senderEmail: Joi.string().email(),
    }
  }),
  campaignController.updateCampaign
);

/**
 * @swagger
 * /api/v1/campaigns/{id}:
 *   delete:
 *     summary: Delete campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
 *       404:
 *         description: Campaign not found
 */
router.delete('/:id',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    }
  }),
  campaignController.deleteCampaign
);

/**
 * @swagger
 * /api/v1/campaigns/{id}/start:
 *   post:
 *     summary: Start campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign started successfully
 *       400:
 *         description: Campaign cannot be started
 *       404:
 *         description: Campaign not found
 */
router.post('/:id/start',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    }
  }),
  campaignController.startCampaign
);

/**
 * @swagger
 * /api/v1/campaigns/{id}/pause:
 *   post:
 *     summary: Pause campaign
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign paused successfully
 *       400:
 *         description: Campaign cannot be paused
 *       404:
 *         description: Campaign not found
 */
router.post('/:id/pause',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    }
  }),
  campaignController.pauseCampaign
);

/**
 * @swagger
 * /api/v1/campaigns/{id}/analytics:
 *   get:
 *     summary: Get campaign analytics
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Analytics period
 *     responses:
 *       200:
 *         description: Campaign analytics
 *       404:
 *         description: Campaign not found
 */
router.get('/:id/analytics',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    },
    [Segments.QUERY]: {
      period: Joi.string().valid('7d', '30d', '90d').default('30d'),
    }
  }),
  campaignController.getCampaignAnalytics
);

/**
 * @swagger
 * /api/v1/campaigns/{id}/prospects:
 *   get:
 *     summary: Get campaign prospects
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by prospect status
 *     responses:
 *       200:
 *         description: Campaign prospects
 *       404:
 *         description: Campaign not found
 */
router.get('/:id/prospects',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().required()
    },
    [Segments.QUERY]: {
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string(),
    }
  }),
  campaignController.getCampaignProspects
);

module.exports = router;