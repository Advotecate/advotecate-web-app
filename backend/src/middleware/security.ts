import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../config/index.js';

// Security headers configuration
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Needed for development - remove in production
        "https://js.fluidpay.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://storage.googleapis.com",
        "https://*.supabase.co"
      ],
      connectSrc: [
        "'self'",
        "https://api.fluidpay.com",
        "https://sandbox-api.fluidpay.com",
        "https://*.supabase.co",
        "wss://*.supabase.co"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.node_env === 'production' ? [] : null
    }
  },

  // Strict Transport Security (HTTPS only)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Prevent MIME type sniffing
  noSniff: true,

  // XSS Protection
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Permission Policy
  permittedCrossDomainPolicies: false
});

// CORS configuration
export function corsConfig(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('Origin');
  const allowedOrigins = [
    config.app.frontendUrl,
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3001',
    'http://localhost:3002',
    'https://localhost:3002',
    'http://localhost:3003',
    'https://localhost:3003',
    'http://localhost:3004',
    'https://localhost:3004',
    'http://localhost:3005',
    'https://localhost:3005'
  ];

  // Allow requests from allowed origins
  if (!origin || allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin || '*');
  }

  res.set({
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-Client-Version'
    ].join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin'
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

// Security event logging
interface SecurityEvent {
  type: 'suspicious_request' | 'blocked_request' | 'rate_limit_exceeded' | 'auth_failure';
  ip: string;
  userAgent: string;
  path: string;
  details: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

class SecurityMonitor {
  private suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\(/i, // Code injection
    /eval\(/i, // Eval injection
    /javascript:/i, // JavaScript protocol
    /vbscript:/i, // VBScript protocol
    /data:.*base64/i // Data URI with base64
  ];

  logSecurityEvent(event: SecurityEvent): void {
    console.warn('SECURITY EVENT:', {
      type: event.type,
      ip: event.ip,
      userAgent: event.userAgent,
      path: event.path,
      details: event.details,
      timestamp: event.timestamp.toISOString(),
      userId: event.userId
    });

    // In production, send to monitoring service
    // await monitoringService.sendAlert(event);
  }

  scanForSuspiciousContent(req: Request): boolean {
    const textToScan = [
      req.url,
      JSON.stringify(req.body || {}),
      JSON.stringify(req.query || {}),
      req.get('User-Agent') || '',
      req.get('Referer') || ''
    ].join(' ');

    return this.suspiciousPatterns.some(pattern => pattern.test(textToScan));
  }

  checkRequestSize(req: Request): boolean {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB

    return contentLength > maxSize;
  }

  analyzeUserAgent(userAgent: string): { isBot: boolean; isSuspicious: boolean } {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /node/i
    ];

    const suspiciousPatterns = [
      /sqlmap/i, /nmap/i, /nikto/i, /burp/i,
      /zaproxy/i, /masscan/i
    ];

    return {
      isBot: botPatterns.some(pattern => pattern.test(userAgent)),
      isSuspicious: suspiciousPatterns.some(pattern => pattern.test(userAgent))
    };
  }
}

const securityMonitor = new SecurityMonitor();

// Security scanning middleware
export function securityScanner(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';

  // Check request size
  if (securityMonitor.checkRequestSize(req)) {
    securityMonitor.logSecurityEvent({
      type: 'blocked_request',
      ip: clientIP,
      userAgent,
      path: req.path,
      details: { reason: 'request_too_large' },
      timestamp: new Date(),
      userId: req.user?.userId
    });

    res.status(413).json({
      error: 'Request entity too large',
      code: 'REQUEST_TOO_LARGE'
    });
    return;
  }

  // Analyze user agent
  const userAgentAnalysis = securityMonitor.analyzeUserAgent(userAgent);

  if (userAgentAnalysis.isSuspicious) {
    securityMonitor.logSecurityEvent({
      type: 'suspicious_request',
      ip: clientIP,
      userAgent,
      path: req.path,
      details: { reason: 'suspicious_user_agent' },
      timestamp: new Date(),
      userId: req.user?.userId
    });

    res.status(403).json({
      error: 'Suspicious request blocked',
      code: 'SUSPICIOUS_REQUEST'
    });
    return;
  }

  // Scan for suspicious patterns
  if (securityMonitor.scanForSuspiciousContent(req)) {
    securityMonitor.logSecurityEvent({
      type: 'blocked_request',
      ip: clientIP,
      userAgent,
      path: req.path,
      details: { reason: 'suspicious_content' },
      timestamp: new Date(),
      userId: req.user?.userId
    });

    res.status(400).json({
      error: 'Malicious request blocked',
      code: 'MALICIOUS_REQUEST'
    });
    return;
  }

  next();
}

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

// API key authentication for webhooks
export function validateAPIKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.get('X-API-Key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('INTERNAL_API_KEY not configured');
    res.status(500).json({
      error: 'Internal server error',
      code: 'CONFIG_ERROR'
    });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }

  next();
}

// Webhook signature validation (FluidPay)
export function validateWebhookSignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.get('X-Webhook-Signature') || req.get('Stripe-Signature');
    const payload = JSON.stringify(req.body);

    if (!signature) {
      res.status(401).json({
        error: 'Missing webhook signature',
        code: 'MISSING_SIGNATURE'
      });
      return;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace(/^sha256=/, '');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      securityMonitor.logSecurityEvent({
        type: 'blocked_request',
        ip: getClientIP(req),
        userAgent: req.get('User-Agent') || '',
        path: req.path,
        details: { reason: 'invalid_webhook_signature' },
        timestamp: new Date()
      });

      res.status(401).json({
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
      return;
    }

    next();
  };
}

// Utility function to get client IP
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

export { securityMonitor };