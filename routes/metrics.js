const express = require('express');
const router = express.Router();
const { getMetrics } = require('../middleware/metrics');
const config = require('../config');

/**
 * Prometheus metrics endpoint
 * GET /metrics
 */
router.get('/', async (req, res) => {
  if (!config.monitoring.enableMetrics) {
    return res.status(404).json({
      success: false,
      error: 'Metrics collection is disabled'
    });
  }

  try {
    const metrics = await getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

/**
 * JSON metrics endpoint for debugging
 * GET /metrics/json
 */
router.get('/json', async (req, res) => {
  if (!config.monitoring.enableMetrics) {
    return res.status(404).json({
      success: false,
      error: 'Metrics collection is disabled'
    });
  }

  try {
    const { register } = require('../middleware/metrics');
    const metrics = await register.getMetricsAsJSON();
    
    res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

module.exports = router;