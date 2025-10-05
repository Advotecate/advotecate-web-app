// Vercel serverless entry point - ULTRA MINIMAL VERSION
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';

// Import middleware
import { securityHeaders, corsConfig, securityScanner, sanitizeInput } from './dist/middleware/security.js';
import { requestLogger, errorLogger } from './dist/middleware/logging.js';
import { rateLimitConfigs } from './dist/middleware/rateLimiting.js';

// Import only working routes
import healthRoutes from './dist/routes/health.js';

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

// Temporary message for all other endpoints
app.use('*', (req, res) => {
  if (req.method === 'POST' && req.path === '/organizations') {
    return res.status(503).json({
      error: 'Organizations API temporarily unavailable',
      code: 'UNDER_MAINTENANCE',
      message: 'Backend controllers need to be rebuilt - repositories missing',
      technical: 'dist/services/database/repositories files are missing'
    });
  }

  res.status(404).json({
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    note: 'API is partially operational - most endpoints temporarily disabled due to missing compiled files'
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
