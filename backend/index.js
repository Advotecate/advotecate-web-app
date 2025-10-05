// Vercel serverless entry point for Express app
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './dist/config/index.js';

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

// Trust proxy for accurate IP addresses
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

// API routes
const apiV1 = express.Router();
apiV1.use('/auth', rateLimitConfigs.auth, authRoutes);
apiV1.use('/webhooks', rateLimitConfigs.webhook, webhookRoutes);
apiV1.use('/users', userRoutes);
apiV1.use('/organizations', organizationRoutes);
apiV1.use('/fundraisers', fundraiserRoutes);
apiV1.use('/events', eventRoutes);
apiV1.use('/donations', rateLimitConfigs.donations, donationRoutes);
apiV1.use('/interests', interestRoutes);
apiV1.use('/admin', adminRoutes);

app.use('/api/v1', apiV1);

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
