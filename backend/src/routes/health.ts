import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { createClient } from 'redis';
import { config } from '../config/index.js';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'advotecate-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.node_env
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check with dependencies
router.get('/detailed', async (req: Request, res: Response) => {
  const checks = {
    database: { status: 'unknown', responseTime: 0 },
    redis: { status: 'unknown', responseTime: 0 },
    memory: { status: 'unknown', usage: 0, percentage: 0 },
    disk: { status: 'unknown' }
  };

  let overallStatus = 'healthy';

  // Database check
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    checks.database.status = 'unhealthy';
    overallStatus = 'unhealthy';
  }

  // Redis check
  try {
    const redis = createClient({ url: config.redis.url });
    await redis.connect();

    const start = Date.now();
    await redis.ping();
    checks.redis = {
      status: 'healthy',
      responseTime: Date.now() - start
    };

    await redis.disconnect();
  } catch (error) {
    checks.redis.status = 'unhealthy';
    overallStatus = 'degraded';
  }

  // Memory check
  try {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memPercentage = (usedMem / totalMem) * 100;

    checks.memory = {
      status: memPercentage < 90 ? 'healthy' : 'warning',
      usage: Math.round(usedMem / 1024 / 1024), // MB
      percentage: Math.round(memPercentage)
    };

    if (memPercentage >= 95) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  } catch (error) {
    checks.memory.status = 'unhealthy';
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'advotecate-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.node_env,
    uptime: process.uptime(),
    checks
  };

  const statusCode = overallStatus === 'healthy' ? 200 :
                     overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(response);
});

// Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if the service is ready to accept traffic
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

export default router;