import { Router } from 'express';
import { authenticate, requireAdmin, requireSuperAdmin, requirePermission } from '../middleware/auth.js';
import {
  validateUpdateProfile,
  validatePaginationQuery,
  validateUuidParam
} from '../middleware/validation.js';
import { UserController } from '../controllers/users.js';

const router = Router();
const userController = new UserController();

// User profile management
router.get('/me', authenticate(), userController.getCurrentUser);
router.put('/me', authenticate(), validateUpdateProfile, userController.updateProfile);
router.delete('/me', authenticate(), userController.deleteAccount);

// User KYC and verification
router.post('/me/verify', authenticate(), userController.requestKYCVerification);
router.get('/me/verification-status', authenticate(), userController.getVerificationStatus);

// User donation history
router.get('/me/donations', authenticate(), validatePaginationQuery, userController.getUserDonations);
router.get('/me/donations/summary', authenticate(), userController.getDonationSummary);

// User organizations
router.get('/me/organizations', authenticate(), userController.getUserOrganizations);

// Admin user management (requires elevated permissions)
router.get('/',
  authenticate(),
  requirePermission('user', 'read'),
  validatePaginationQuery,
  userController.getUsers
);

router.get('/search',
  authenticate(),
  requireAdmin,
  userController.searchUsers
);

router.get('/:id',
  authenticate(),
  requirePermission('user', 'read'),
  validateUuidParam,
  userController.getUserById
);

router.put('/:id',
  authenticate(),
  requirePermission('user', 'update'),
  validateUuidParam,
  validateUpdateProfile,
  userController.updateUser
);

router.post('/:id/verify',
  authenticate(),
  requirePermission('user', 'verify'),
  validateUuidParam,
  userController.verifyUser
);

router.post('/:id/suspend',
  authenticate(),
  requireAdmin,
  validateUuidParam,
  userController.suspendUser
);

router.post('/:id/unsuspend',
  authenticate(),
  requireAdmin,
  validateUuidParam,
  userController.unsuspendUser
);

router.delete('/:id',
  authenticate(),
  requireSuperAdmin,
  validateUuidParam,
  userController.deleteUser
);

// User analytics (admin only)
router.get('/analytics/overview',
  authenticate(),
  requireAdmin,
  userController.getUserAnalytics
);

router.get('/analytics/growth',
  authenticate(),
  requireAdmin,
  userController.getUserGrowthAnalytics
);

export default router;