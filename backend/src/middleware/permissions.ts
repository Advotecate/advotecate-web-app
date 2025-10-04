/**
 * Permission Middleware
 * Provides Express middleware for checking user permissions
 */

import { Request, Response, NextFunction } from 'express';
import { checkUserPermission, PERMISSIONS } from '../services/permissionService.js';

/**
 * Extend Express Request to include user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

/**
 * Middleware factory to check if user has required permission
 *
 * @param permissionName - The permission to check (e.g., 'fundraiser.create')
 * @param options - Optional configuration
 * @returns Express middleware function
 *
 * @example
 * router.post('/fundraisers', requirePermission(PERMISSIONS.FUNDRAISER_CREATE), createFundraiser);
 */
export function requirePermission(
  permissionName: string,
  options: {
    /**
     * Extract organization ID from request
     * Default: checks req.params.organizationId and req.body.organizationId
     */
    getOrgId?: (req: Request) => string | undefined;

    /**
     * Custom error message
     */
    errorMessage?: string;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to perform this action',
        });
      }

      // Get organization ID if applicable
      let organizationId: string | undefined;
      if (options.getOrgId) {
        organizationId = options.getOrgId(req);
      } else {
        // Default: check params and body
        organizationId = req.params.organizationId || req.body.organizationId;
      }

      // Check permission
      const hasPermission = await checkUserPermission(
        req.user.id,
        permissionName,
        organizationId
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: options.errorMessage || `You don't have permission to perform this action`,
          requiredPermission: permissionName,
        });
      }

      // User has permission, continue
      next();
    } catch (error) {
      console.error('Error in requirePermission middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while checking permissions',
      });
    }
  };
}

/**
 * Middleware to check if user has ANY of the specified permissions
 *
 * @example
 * router.get('/data', requireAnyPermission([
 *   PERMISSIONS.ANALYTICS_VIEW,
 *   PERMISSIONS.ORG_VIEW
 * ]), getData);
 */
export function requireAnyPermission(
  permissions: string[],
  options: {
    getOrgId?: (req: Request) => string | undefined;
    errorMessage?: string;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to perform this action',
        });
      }

      const organizationId = options.getOrgId
        ? options.getOrgId(req)
        : req.params.organizationId || req.body.organizationId;

      // Check if user has at least one of the permissions
      const permissionChecks = await Promise.all(
        permissions.map(perm => checkUserPermission(req.user!.id, perm, organizationId))
      );

      const hasAnyPermission = permissionChecks.some(result => result === true);

      if (!hasAnyPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: options.errorMessage || `You don't have permission to perform this action`,
          requiredPermissions: permissions,
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireAnyPermission middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while checking permissions',
      });
    }
  };
}

/**
 * Middleware to check if user has ALL of the specified permissions
 *
 * @example
 * router.post('/sensitive', requireAllPermissions([
 *   PERMISSIONS.DONATION_VIEW_DETAILS,
 *   PERMISSIONS.DONATION_EXPORT
 * ]), exportSensitiveData);
 */
export function requireAllPermissions(
  permissions: string[],
  options: {
    getOrgId?: (req: Request) => string | undefined;
    errorMessage?: string;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'You must be logged in to perform this action',
        });
      }

      const organizationId = options.getOrgId
        ? options.getOrgId(req)
        : req.params.organizationId || req.body.organizationId;

      // Check if user has all permissions
      const permissionChecks = await Promise.all(
        permissions.map(perm => checkUserPermission(req.user!.id, perm, organizationId))
      );

      const hasAllPermissions = permissionChecks.every(result => result === true);

      if (!hasAllPermissions) {
        return res.status(403).json({
          error: 'Forbidden',
          message: options.errorMessage || `You don't have all required permissions for this action`,
          requiredPermissions: permissions,
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireAllPermissions middleware:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while checking permissions',
      });
    }
  };
}

/**
 * Middleware to check if user has a specific role (platform-level)
 *
 * @example
 * router.get('/admin', requireRole('super_admin'), adminDashboard);
 */
export function requireRole(role: string | string[]) {
  const roles = Array.isArray(role) ? role : [role];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to perform this action',
      });
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        requiredRoles: roles,
      });
    }

    next();
  };
}

/**
 * Attach user permissions to request object for later use
 * Useful for conditional UI rendering or complex authorization logic
 *
 * @example
 * router.get('/dashboard', attachPermissions(), getDashboard);
 * // In controller: req.permissions will contain all user permissions
 */
export function attachPermissions(
  options: {
    getOrgId?: (req: Request) => string | undefined;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return next();
      }

      const organizationId = options.getOrgId
        ? options.getOrgId(req)
        : req.params.organizationId || req.body.organizationId;

      const { getUserPermissions } = await import('../services/permissionService.js');
      const permissions = await getUserPermissions(req.user.id, organizationId);

      // Attach to request for use in controllers
      (req as any).permissions = permissions;

      next();
    } catch (error) {
      console.error('Error in attachPermissions middleware:', error);
      // Don't block the request, just log the error
      next();
    }
  };
}

/**
 * Helper to check permission within a controller
 * Use when you need conditional logic based on permissions
 *
 * @example
 * async function getOrgData(req: Request, res: Response) {
 *   const canViewSensitive = await checkPermissionInController(
 *     req,
 *     PERMISSIONS.DONATION_VIEW_DETAILS
 *   );
 *
 *   return res.json({
 *     data: filterDataBasedOnPermission(canViewSensitive)
 *   });
 * }
 */
export async function checkPermissionInController(
  req: Request,
  permissionName: string,
  organizationId?: string
): Promise<boolean> {
  if (!req.user?.id) {
    return false;
  }

  const orgId = organizationId || req.params.organizationId || req.body.organizationId;
  return checkUserPermission(req.user.id, permissionName, orgId);
}

// Export permission constants for easy access
export { PERMISSIONS } from '../services/permissionService.js';
