import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { config } from '../config/index.js';
import crypto from 'crypto';

// Create Winston logger
const logger = winston.createLogger({
  level: config.node_env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'advotecate-api',
    environment: config.node_env
  },
  transports: [
    // Console transport for development
    ...(config.node_env === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : []),

    // File transports for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  ]
});

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Add request ID to request object
  (req as any).requestId = requestId;

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log response
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode,
      duration,
      contentLength: res.get('Content-Length'),
      userId: req.user?.userId,
      ...(statusCode >= 400 && { responseBody: body }),
      timestamp: new Date().toISOString()
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
        userId: req.user?.userId
      });
    }

    return originalJson.call(this, body);
  };

  // Handle response finish for non-JSON responses
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    if (!res.headersSent) {
      logger.info('Request finished', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode,
        duration,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
}

// Error logging middleware
export function errorLogger(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId;

  logger.error('Request error', {
    requestId,
    method: req.method,
    url: req.url,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    body: req.body,
    query: req.query,
    params: req.params,
    headers: sanitizeHeaders(req.headers),
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  next(error);
}

// Security event logger
export function logSecurityEvent(event: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  req?: Request;
}): void {
  logger.warn('Security event', {
    type: event.type,
    severity: event.severity,
    message: event.message,
    details: event.details,
    ...(event.req && {
      requestId: (event.req as any).requestId,
      method: event.req.method,
      url: event.req.url,
      ip: getClientIP(event.req),
      userAgent: event.req.get('User-Agent'),
      userId: event.req.user?.userId
    }),
    timestamp: new Date().toISOString()
  });
}

// Authentication event logger
export function logAuthEvent(event: {
  type: 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'mfa_setup' | 'mfa_success' | 'mfa_failure';
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  details?: Record<string, any>;
}): void {
  logger.info('Authentication event', {
    type: event.type,
    userId: event.userId,
    email: event.email ? maskEmail(event.email) : undefined,
    ip: event.ip,
    userAgent: event.userAgent,
    details: event.details,
    timestamp: new Date().toISOString()
  });
}

// Business event logger
export function logBusinessEvent(event: {
  type: 'donation_created' | 'donation_completed' | 'donation_failed' | 'fundraiser_created' | 'organization_verified';
  userId?: string;
  organizationId?: string;
  fundraiserId?: string;
  donationId?: string;
  amount?: number;
  details: Record<string, any>;
}): void {
  logger.info('Business event', {
    type: event.type,
    userId: event.userId,
    organizationId: event.organizationId,
    fundraiserId: event.fundraiserId,
    donationId: event.donationId,
    amount: event.amount,
    details: event.details,
    timestamp: new Date().toISOString()
  });
}

// Performance logging
export function logPerformance(event: {
  operation: string;
  duration: number;
  details?: Record<string, any>;
}): void {
  const level = event.duration > 5000 ? 'warn' : 'info';

  logger.log(level, 'Performance metric', {
    operation: event.operation,
    duration: event.duration,
    details: event.details,
    timestamp: new Date().toISOString()
  });
}

// Database operation logger
export function logDatabaseOperation(event: {
  operation: 'query' | 'insert' | 'update' | 'delete';
  table?: string;
  duration: number;
  rowCount?: number;
  query?: string;
  error?: Error;
}): void {
  const level = event.error ? 'error' : event.duration > 1000 ? 'warn' : 'debug';

  logger.log(level, 'Database operation', {
    operation: event.operation,
    table: event.table,
    duration: event.duration,
    rowCount: event.rowCount,
    query: event.query ? sanitizeQuery(event.query) : undefined,
    error: event.error ? {
      message: event.error.message,
      code: (event.error as any).code
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

// FluidPay operation logger
export function logFluidPayOperation(event: {
  operation: string;
  endpoint: string;
  duration: number;
  statusCode?: number;
  transactionId?: string;
  customerId?: string;
  amount?: number;
  error?: Error;
}): void {
  const level = event.error ? 'error' : event.statusCode && event.statusCode >= 400 ? 'warn' : 'info';

  logger.log(level, 'FluidPay operation', {
    operation: event.operation,
    endpoint: event.endpoint,
    duration: event.duration,
    statusCode: event.statusCode,
    transactionId: event.transactionId,
    customerId: event.customerId,
    amount: event.amount,
    error: event.error ? {
      message: event.error.message,
      code: (event.error as any).code
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

// Utility functions
function getClientIP(req: Request): string {
  const xForwardedFor = req.get('X-Forwarded-For');
  const xRealIP = req.get('X-Real-IP');

  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim() || '';
  }

  if (xRealIP) {
    return xRealIP;
  }

  return req.connection.remoteAddress || req.ip || 'unknown';
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };

  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];

  return sanitized;
}

function maskEmail(email: string): string {
  const [username, domain] = email.split('@');
  if (!username || !domain) return '***@***.***';

  const maskedUsername = username.length > 2 ?
    username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] :
    '*'.repeat(username.length);

  return `${maskedUsername}@${domain}`;
}

function sanitizeQuery(query: string): string {
  // Remove potential sensitive data from SQL queries
  return query
    .replace(/password\s*=\s*'[^']*'/gi, "password = '***'")
    .replace(/token\s*=\s*'[^']*'/gi, "token = '***'")
    .replace(/secret\s*=\s*'[^']*'/gi, "secret = '***'");
}

// Export logger for direct use
export { logger };