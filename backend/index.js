// Vercel serverless entry point
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';

// Import middleware
import { securityHeaders, corsConfig, securityScanner, sanitizeInput } from './dist/middleware/security.js';
import { requestLogger, errorLogger } from './dist/middleware/logging.js';
import { rateLimitConfigs } from './dist/middleware/rateLimiting.js';

// Import routes
import authRoutes from './dist/routes/auth.js';
import userRoutes from './dist/routes/users.js';
import organizationRoutes from './dist/routes/organizations.js';
import fundraiserRoutes from './dist/routes/fundraisers.js';
import eventRoutes from './dist/routes/events.js';
import donationRoutes from './dist/routes/donations.js';
import adminRoutes from './dist/routes/admin.js';
import webhookRoutes from './dist/routes/webhooks.js';
import healthRoutes from './dist/routes/health.js';
import interestRoutes from './dist/routes/interests.js';

const app = express();

// Trust proxy
app.set('trust proxy', true);

// Security middleware
app.use(securityHeaders);
app.use(corsConfig);
app.use(securityScanner);

// Basic middleware
app.use(compression());
app.use(cookieParser());
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Global rate limiting
app.use(rateLimitConfigs.global);

// Health check
app.use('/health', healthRoutes);

// API routes (mounted at root for direct access)
app.use('/auth', rateLimitConfigs.auth, authRoutes);
app.use('/webhooks', rateLimitConfigs.webhook, webhookRoutes);
app.use('/users', userRoutes);
app.use('/organizations', organizationRoutes);
app.use('/fundraisers', fundraiserRoutes);
app.use('/events', eventRoutes);
app.use('/donations', rateLimitConfigs.donations, donationRoutes);
app.use('/interests', interestRoutes);
app.use('/admin', adminRoutes);

// Catch-all
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl
  });
});

// Error handler
app.use(errorLogger);
app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  res.status(status).json({
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR'
  });
});

export default app;
