#!/usr/bin/env node

import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { startupApplication, shutdownApplication, setupProcessHandlers } from './startup/index.js';

// Import middleware
import { securityHeaders, corsConfig, securityScanner, sanitizeInput } from './middleware/security.js';
import { requestLogger, errorLogger, logger } from './middleware/logging.js';
import { rateLimitConfigs } from './middleware/rateLimiting.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import organizationRoutes from './routes/organizations.js';
import fundraiserRoutes from './routes/fundraisers.js';
import eventRoutes from './routes/events.js';
import donationRoutes from './routes/donations.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import healthRoutes from './routes/health.js';
import interestRoutes from './routes/interests.js';

class AdvotecateServer {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Trust proxy for accurate IP addresses in load balancer environments
    this.app.set('trust proxy', true);

    // Security middleware (apply first)
    this.app.use(securityHeaders);
    this.app.use(corsConfig);
    this.app.use(securityScanner);

    // Basic middleware
    this.app.use(compression());
    this.app.use(cookieParser());

    // Request logging (after security, before parsing)
    this.app.use(requestLogger);

    // Body parsing with size limits
    this.app.use(express.json({
      limit: '10mb',
      verify: (req, res, buffer) => {
        // Store raw body for webhook signature verification
        (req as any).rawBody = buffer;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Input sanitization
    this.app.use(sanitizeInput);

    // Global rate limiting
    this.app.use(rateLimitConfigs.global);
  }

  private setupRoutes(): void {
    // Health check (no rate limiting)
    this.app.use('/health', healthRoutes);

    // API routes with versioning
    const apiV1 = express.Router();

    // Authentication routes (with strict rate limiting)
    apiV1.use('/auth', rateLimitConfigs.auth, authRoutes);

    // Webhook routes (separate rate limiting)
    apiV1.use('/webhooks', rateLimitConfigs.webhook, webhookRoutes);

    // Main API routes
    apiV1.use('/users', userRoutes);
    apiV1.use('/organizations', organizationRoutes);
    apiV1.use('/fundraisers', fundraiserRoutes);
    apiV1.use('/events', eventRoutes);
    apiV1.use('/donations', rateLimitConfigs.donations, donationRoutes);
    apiV1.use('/interests', interestRoutes);

    // Admin routes (protected)
    apiV1.use('/admin', adminRoutes);

    // Mount API under /api/v1
    this.app.use('/api/v1', apiV1);

    // API documentation route
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: 'Advotecate API',
        version: '1.0.0',
        description: 'Political donation platform API',
        endpoints: {
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          organizations: '/api/v1/organizations',
          fundraisers: '/api/v1/fundraisers',
          events: '/api/v1/events',
          donations: '/api/v1/donations',
          interests: '/api/v1/interests',
          admin: '/api/v1/admin',
          webhooks: '/api/v1/webhooks',
          health: '/health'
        },
        documentation: 'https://docs.advotecate.com/api'
      });
    });

    // Catch-all route for undefined endpoints
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  private setupErrorHandling(): void {
    // Error logging middleware
    this.app.use(errorLogger);

    // Global error handler
    this.app.use((
      error: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const status = (error as any).status || (error as any).statusCode || 500;
      const message = error.message || 'Internal server error';

      // Don't expose internal errors in production
      const response = {
        error: config.node_env === 'production' && status === 500 ?
          'Internal server error' : message,
        code: (error as any).code || 'INTERNAL_ERROR',
        ...(config.node_env === 'development' && { stack: error.stack })
      };

      res.status(status).json(response);
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize all application services
      logger.info('🚀 Starting Advotecate Backend Application');
      await startupApplication();

      // Start HTTP server
      this.app.listen(this.port, () => {
        logger.info(`✅ Advotecate API server running on port ${this.port}`, {
          port: this.port,
          environment: config.node_env,
          node_version: process.version,
          timestamp: new Date().toISOString()
        });
      });

    } catch (error) {
      logger.error('❌ Failed to start server', { error });
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new AdvotecateServer();
  server.start();

  // Setup graceful shutdown and error handling
  setupProcessHandlers();
}

export default AdvotecateServer;