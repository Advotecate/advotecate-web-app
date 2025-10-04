import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../auth/jwt.js';
import { sessionManager } from '../auth/session.js';
import { rbacService } from '../auth/rbac.js';
import { UserPayload } from '../types/auth.js';
import { checkUserPermission } from '../services/permissionService.js';

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      sessionId?: string;
    }
  }
}

interface AuthOptions {
  requiredRole?: string;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  allowAnonymous?: boolean;
  requireMFA?: boolean;
}

export function authenticate(options: AuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header or cookies
      const token = extractToken(req);

      if (!token && !options.allowAnonymous) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      if (!token && options.allowAnonymous) {
        return next();
      }

      // Verify JWT token
      const userPayload = await jwtService.verifyAccessToken(token!);

      if (!userPayload) {
        res.status(401).json({
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID'
        });
        return;
      }

      // Validate session if session ID is present
      if (userPayload.sessionId) {
        const session = await sessionManager.getSession(userPayload.sessionId);

        if (!session) {
          res.status(401).json({
            error: 'Session expired',
            code: 'SESSION_EXPIRED'
          });
          return;
        }

        // Update session activity
        await sessionManager.updateSessionActivity(userPayload.sessionId, {
          ipAddress: getClientIP(req),
          userAgent: req.get('User-Agent') || ''
        });

        req.sessionId = userPayload.sessionId;
      }

      // Check if user role meets minimum requirement
      if (options.requiredRole && !hasRequiredRole(userPayload.role, options.requiredRole)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE'
        });
        return;
      }

      // Check specific permissions using NEW Supabase permissions system
      if (options.requiredPermission) {
        // Extract organization ID from request context
        const context = extractContextFromRequest(req);
        const organizationId = context.organizationId || req.body?.organization_id;

        // Format permission name: resource.action (e.g., "fundraiser.create")
        const permissionName = `${options.requiredPermission.resource}.${options.requiredPermission.action}`;

        // Check permission using Supabase database function
        const hasPermission = await checkUserPermission(
          userPayload.userId,
          permissionName,
          organizationId
        );

        if (!hasPermission) {
          res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredPermission: permissionName
          });
          return;
        }
      }

      // Check MFA requirement
      if (options.requireMFA) {
        const session = userPayload.sessionId ?
          await sessionManager.getSession(userPayload.sessionId) : null;

        if (!session?.mfaVerified) {
          res.status(403).json({
            error: 'MFA verification required',
            code: 'MFA_REQUIRED'
          });
          return;
        }
      }

      // Attach user to request
      req.user = userPayload;
      next();

    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

// Specific middleware functions for common auth scenarios
export const requireAuth = authenticate();

export const requireAdmin = authenticate({
  requiredRole: 'org_admin'
});

export const requireSuperAdmin = authenticate({
  requiredRole: 'super_admin'
});

export const requireMFA = authenticate({
  requireMFA: true
});

export const allowAnonymous = authenticate({
  allowAnonymous: true
});

// Permission-based middleware factory
export function requirePermission(resource: string, action: string) {
  return authenticate({
    requiredPermission: { resource, action }
  });
}

// Helper functions
function extractToken(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies as fallback
  return req.cookies?.access_token || null;
}

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = rbacService.getRoleHierarchy();
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

function extractContextFromRequest(req: Request): Record<string, any> {
  const context: Record<string, any> = {};

  // Extract common parameters from URL and body
  const { organizationId, userId, donationId, fundraiserId } = req.params;

  if (organizationId) context.organizationId = organizationId;
  if (userId) context.userId = userId;
  if (donationId) context.donationId = donationId;
  if (fundraiserId) context.fundraiserId = fundraiserId;

  // Add request type information
  context.method = req.method;
  context.path = req.path;

  // Add query parameters for additional context
  if (req.query.type) context.type = req.query.type;
  if (req.query.status) context.status = req.query.status;

  return context;
}

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