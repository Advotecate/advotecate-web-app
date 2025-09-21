import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
}

interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

class RateLimiter {
  private redis: RedisClientType;

  constructor() {
    this.redis = createClient({ url: config.redis.url });
    this.redis.on('error', (err) => console.error('Rate Limiter Redis Error:', err));
    this.redis.connect();
  }

  create(rateLimitConfig: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = rateLimitConfig.keyGenerator ?
          rateLimitConfig.keyGenerator(req) :
          this.defaultKeyGenerator(req);

        const result = await this.checkRateLimit(key, rateLimitConfig);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Window': rateLimitConfig.windowMs.toString()
        });

        if (!result.allowed) {
          res.status(rateLimitConfig.statusCode || 429).json({
            error: rateLimitConfig.message || 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue processing if rate limiter fails
        next();
      }
    };
  }

  private async checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const windowKey = `rate_limit:${identifier}:${windowStart}`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.multi();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();
    const currentCount = results?.[0] as number || 0;

    return {
      allowed: currentCount <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetTime: windowStart + config.windowMs,
      totalRequests: currentCount
    };
  }

  private defaultKeyGenerator(req: Request): string {
    // Use user ID if authenticated, otherwise IP address
    const userId = req.user?.userId;
    if (userId) {
      return `user:${userId}`;
    }

    const ip = this.getClientIP(req);
    return `ip:${ip}`;
  }

  private getClientIP(req: Request): string {
    const xForwardedFor = req.get('X-Forwarded-For');
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0]?.trim() || '';
    }
    return req.get('X-Real-IP') || req.ip || 'unknown';
  }
}

const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Global API rate limiting
  global: rateLimiter.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Too many requests from this IP or user'
  }),

  // Authentication endpoints (stricter)
  auth: rateLimiter.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => `auth:${rateLimiter['getClientIP'](req)}`,
    message: 'Too many authentication attempts'
  }),

  // Password reset (very strict)
  passwordReset: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyGenerator: (req) => `password_reset:${req.body?.email || rateLimiter['getClientIP'](req)}`,
    message: 'Too many password reset attempts'
  }),

  // Donation endpoints (moderate)
  donations: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => `donations:${req.user?.userId || rateLimiter['getClientIP'](req)}`,
    message: 'Too many donation attempts'
  }),

  // Admin operations (less strict for authenticated users)
  admin: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 500,
    keyGenerator: (req) => `admin:${req.user?.userId}`,
    message: 'Too many admin operations'
  }),

  // API key or service accounts (higher limits)
  service: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10000,
    keyGenerator: (req) => `service:${req.get('X-API-Key') || req.user?.userId}`,
    message: 'Service rate limit exceeded'
  }),

  // File uploads
  upload: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    keyGenerator: (req) => `upload:${req.user?.userId || rateLimiter['getClientIP'](req)}`,
    message: 'Too many file uploads'
  }),

  // Webhook endpoints (external services)
  webhook: rateLimiter.create({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => `webhook:${req.get('X-Webhook-Source') || rateLimiter['getClientIP'](req)}`,
    message: 'Webhook rate limit exceeded'
  })
};

// Dynamic rate limiting based on user role
export function createDynamicRateLimit(baseConfig: RateLimitConfig) {
  return rateLimiter.create({
    ...baseConfig,
    keyGenerator: (req) => {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        return `anon:${rateLimiter['getClientIP'](req)}`;
      }

      // Different limits based on role
      const rolePrefix = userRole === 'super_admin' ? 'super' :
                        userRole === 'org_admin' ? 'admin' :
                        userRole === 'compliance_officer' ? 'compliance' :
                        'user';

      return `${rolePrefix}:${userId}`;
    },
    maxRequests: (req: Request): number => {
      const userRole = req.user?.role;

      // Adjust limits based on role
      switch (userRole) {
        case 'super_admin':
          return baseConfig.maxRequests * 10;
        case 'compliance_officer':
          return baseConfig.maxRequests * 5;
        case 'org_admin':
        case 'org_treasurer':
          return baseConfig.maxRequests * 3;
        case 'org_staff':
        case 'org_viewer':
          return baseConfig.maxRequests * 2;
        default:
          return baseConfig.maxRequests;
      }
    }
  } as RateLimitConfig);
}

// Bypass rate limiting for certain conditions
export function createConditionalRateLimit(
  rateLimitConfig: RateLimitConfig,
  bypassCondition: (req: Request) => boolean
) {
  const limiter = rateLimiter.create(rateLimitConfig);

  return (req: Request, res: Response, next: NextFunction) => {
    if (bypassCondition(req)) {
      return next();
    }
    return limiter(req, res, next);
  };
}

// Helper to create custom rate limiters
export { rateLimiter as RateLimiter };