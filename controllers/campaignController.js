const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

const prisma = new PrismaClient();

/**
 * Get all campaigns with pagination, filtering, and search
 * GET /api/v1/campaigns
 */
const getAllCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build orderBy clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    // Get campaigns with include for stats
    const [campaigns, totalCount] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: {
              prospects: true,
              emails: true
            }
          }
        }
      }),
      prisma.campaign.count({ where })
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    logger.info('Campaigns retrieved', {
      count: campaigns.length,
      totalCount,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: campaigns,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: take
      }
    });

  } catch (error) {
    logger.error('Error retrieving campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaigns',
      message: error.message
    });
  }
};

/**
 * Get campaign by ID
 * GET /api/v1/campaigns/:id
 */
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prospects: true,
            emails: true
          }
        },
        prospects: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            company: true,
            status: true,
            createdAt: true
          }
        },
        emails: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            subject: true,
            status: true,
            sentAt: true,
            openedAt: true,
            clickedAt: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    logger.info('Campaign retrieved', { campaignId: id });

    res.status(200).json({
      success: true,
      data: campaign
    });

  } catch (error) {
    logger.error('Error retrieving campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign',
      message: error.message
    });
  }
};

/**
 * Create new campaign
 * POST /api/v1/campaigns
 */
const createCampaign = async (req, res) => {
  try {
    const campaignData = req.body;

    // Validate required fields
    if (!campaignData.name) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required'
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        ...campaignData,
        status: 'DRAFT'
      }
    });

    // Update metrics
    metrics.setCampaignCount('DRAFT', await prisma.campaign.count({ where: { status: 'DRAFT' } }));

    logger.info('Campaign created', { 
      campaignId: campaign.id, 
      name: campaign.name 
    });

    res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });

  } catch (error) {
    logger.error('Error creating campaign:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Campaign with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      message: error.message
    });
  }
};

/**
 * Update campaign
 * PUT /api/v1/campaigns/:id
 */
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Don't allow updating certain fields if campaign is active
    if (existingCampaign.status === 'ACTIVE') {
      const restrictedFields = ['targetKeywords', 'targetJobTitles', 'targetCompanies', 'targetLocations'];
      const hasRestrictedUpdates = restrictedFields.some(field => field in updateData);
      
      if (hasRestrictedUpdates) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update targeting criteria while campaign is active'
        });
      }
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: updateData
    });

    // Update metrics if status changed
    if (updateData.status && updateData.status !== existingCampaign.status) {
      const oldStatusCount = await prisma.campaign.count({ where: { status: existingCampaign.status } });
      const newStatusCount = await prisma.campaign.count({ where: { status: updateData.status } });
      
      metrics.setCampaignCount(existingCampaign.status, oldStatusCount);
      metrics.setCampaignCount(updateData.status, newStatusCount);
    }

    logger.info('Campaign updated', { 
      campaignId: id,
      changes: Object.keys(updateData)
    });

    res.status(200).json({
      success: true,
      data: updatedCampaign,
      message: 'Campaign updated successfully'
    });

  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      message: error.message
    });
  }
};

/**
 * Delete campaign
 * DELETE /api/v1/campaigns/:id
 */
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prospects: true,
            emails: true
          }
        }
      }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Prevent deletion of active campaigns
    if (existingCampaign.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active campaign. Please pause it first.'
      });
    }

    // Delete campaign (cascading deletes will handle related records)
    await prisma.campaign.delete({
      where: { id }
    });

    // Update metrics
    const statusCount = await prisma.campaign.count({ where: { status: existingCampaign.status } });
    metrics.setCampaignCount(existingCampaign.status, statusCount);

    logger.info('Campaign deleted', { 
      campaignId: id,
      prospectsCount: existingCampaign._count.prospects,
      emailsCount: existingCampaign._count.emails
    });

    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
      data: {
        deletedProspects: existingCampaign._count.prospects,
        deletedEmails: existingCampaign._count.emails
      }
    });

  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      message: error.message
    });
  }
};

/**
 * Start campaign
 * POST /api/v1/campaigns/:id/start
 */
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { prospects: true }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already active'
      });
    }

    if (campaign._count.prospects === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot start campaign without prospects'
      });
    }

    if (!campaign.emailTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Cannot start campaign without email template'
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });

    // Update metrics
    const draftCount = await prisma.campaign.count({ where: { status: 'DRAFT' } });
    const activeCount = await prisma.campaign.count({ where: { status: 'ACTIVE' } });
    
    metrics.setCampaignCount('DRAFT', draftCount);
    metrics.setCampaignCount('ACTIVE', activeCount);

    logger.info('Campaign started', { 
      campaignId: id,
      prospectsCount: campaign._count.prospects
    });

    res.status(200).json({
      success: true,
      data: updatedCampaign,
      message: 'Campaign started successfully'
    });

  } catch (error) {
    logger.error('Error starting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start campaign',
      message: error.message
    });
  }
};

/**
 * Pause campaign
 * POST /api/v1/campaigns/:id/pause
 */
const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Only active campaigns can be paused'
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    // Update metrics
    const activeCount = await prisma.campaign.count({ where: { status: 'ACTIVE' } });
    const pausedCount = await prisma.campaign.count({ where: { status: 'PAUSED' } });
    
    metrics.setCampaignCount('ACTIVE', activeCount);
    metrics.setCampaignCount('PAUSED', pausedCount);

    logger.info('Campaign paused', { campaignId: id });

    res.status(200).json({
      success: true,
      data: updatedCampaign,
      message: 'Campaign paused successfully'
    });

  } catch (error) {
    logger.error('Error pausing campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause campaign',
      message: error.message
    });
  }
};

/**
 * Get campaign analytics
 * GET /api/v1/campaigns/:id/analytics
 */
const getCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get basic stats
    const [
      totalProspects,
      totalEmails,
      sentEmails,
      openedEmails,
      clickedEmails,
      repliedEmails,
      bouncedEmails
    ] = await Promise.all([
      prisma.prospect.count({ where: { campaignId: id } }),
      prisma.email.count({ where: { campaignId: id } }),
      prisma.email.count({ 
        where: { 
          campaignId: id, 
          status: 'SENT',
          sentAt: { gte: startDate }
        } 
      }),
      prisma.email.count({ 
        where: { 
          campaignId: id, 
          openedAt: { not: null, gte: startDate }
        } 
      }),
      prisma.email.count({ 
        where: { 
          campaignId: id, 
          clickedAt: { not: null, gte: startDate }
        } 
      }),
      prisma.email.count({ 
        where: { 
          campaignId: id, 
          repliedAt: { not: null, gte: startDate }
        } 
      }),
      prisma.email.count({ 
        where: { 
          campaignId: id, 
          status: 'BOUNCED',
          bouncedAt: { gte: startDate }
        } 
      })
    ]);

    // Calculate rates
    const openRate = sentEmails > 0 ? (openedEmails / sentEmails * 100).toFixed(2) : 0;
    const clickRate = sentEmails > 0 ? (clickedEmails / sentEmails * 100).toFixed(2) : 0;
    const replyRate = sentEmails > 0 ? (repliedEmails / sentEmails * 100).toFixed(2) : 0;
    const bounceRate = sentEmails > 0 ? (bouncedEmails / sentEmails * 100).toFixed(2) : 0;

    // Get daily stats for the period
    const dailyStats = await prisma.email.groupBy({
      by: ['sentAt'],
      where: {
        campaignId: id,
        sentAt: { gte: startDate, not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        sentAt: 'asc'
      }
    });

    // Get prospect status distribution
    const prospectStatusDistribution = await prisma.prospect.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: {
        id: true
      }
    });

    const analytics = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      overview: {
        totalProspects,
        totalEmails,
        sentEmails,
        openedEmails,
        clickedEmails,
        repliedEmails,
        bouncedEmails
      },
      rates: {
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        replyRate: parseFloat(replyRate),
        bounceRate: parseFloat(bounceRate)
      },
      dailyStats: dailyStats.map(stat => ({
        date: stat.sentAt.toISOString().split('T')[0],
        emailsSent: stat._count.id
      })),
      prospectStatusDistribution: prospectStatusDistribution.map(stat => ({
        status: stat.status,
        count: stat._count.id
      }))
    };

    logger.info('Campaign analytics retrieved', { 
      campaignId: id, 
      period,
      sentEmails,
      openRate
    });

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error retrieving campaign analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign analytics',
      message: error.message
    });
  }
};

/**
 * Get campaign prospects
 * GET /api/v1/campaigns/:id/prospects
 */
const getCampaignProspects = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Build where clause
    const where = { campaignId: id };
    if (status) {
      where.status = status;
    }

    const [prospects, totalCount] = await Promise.all([
      prisma.prospect.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { emails: true }
          }
        }
      }),
      prisma.prospect.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: prospects,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: take
      }
    });

  } catch (error) {
    logger.error('Error retrieving campaign prospects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign prospects',
      message: error.message
    });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  getCampaignAnalytics,
  getCampaignProspects
};