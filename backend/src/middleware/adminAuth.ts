import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth.js';

/**
 * Admin authentication middleware
 * Ensures the user is authenticated and has admin or super_admin role
 */
export const adminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // First authenticate the user
  await authenticate()(req, res, async () => {
    // Check if user exists and has admin role
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Check if user has admin or super_admin role
    const adminRoles = ['admin', 'super_admin'];
    if (!adminRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Admin access required',
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action'
      });
      return;
    }

    // User is authenticated and is an admin
    next();
  });
};
