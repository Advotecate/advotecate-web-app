import { Router } from 'express';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import {
  validateCreateOrganization,
  validateUpdateOrganization,
  validatePaginationQuery,
  validateUuidParam
} from '../middleware/validation.js';
import { OrganizationController } from '../controllers/organizations.js';

const router = Router();
const organizationController = new OrganizationController();

// Public organization endpoints
router.get('/public',
  validatePaginationQuery,
  organizationController.getPublicOrganizations
);

router.get('/public/:id',
  validateUuidParam,
  organizationController.getPublicOrganization
);

// Organization management
router.post('/',
  authenticate(),
  validateCreateOrganization,
  organizationController.createOrganization
);

router.get('/',
  authenticate(),
  validatePaginationQuery,
  organizationController.getOrganizations
);

router.get('/:id',
  authenticate(),
  requirePermission('organization', 'read'),
  validateUuidParam,
  organizationController.getOrganization
);

router.put('/:id',
  authenticate(),
  requirePermission('organization', 'update'),
  validateUuidParam,
  validateUpdateOrganization,
  organizationController.updateOrganization
);

router.delete('/:id',
  authenticate(),
  requirePermission('organization', 'delete'),
  validateUuidParam,
  organizationController.deleteOrganization
);

// Organization verification (admin functions)
router.post('/:id/verify',
  authenticate(),
  requirePermission('organization', 'verify'),
  validateUuidParam,
  organizationController.verifyOrganization
);

router.post('/:id/reject',
  authenticate(),
  requirePermission('organization', 'verify'),
  validateUuidParam,
  organizationController.rejectOrganization
);

router.post('/:id/suspend',
  authenticate(),
  requireAdmin,
  validateUuidParam,
  organizationController.suspendOrganization
);

// Organization user management
router.get('/:id/users',
  authenticate(),
  requirePermission('organization_user', 'read'),
  validateUuidParam,
  organizationController.getOrganizationUsers
);

router.post('/:id/users/invite',
  authenticate(),
  requirePermission('organization_user', 'create'),
  validateUuidParam,
  organizationController.inviteUser
);

router.put('/:id/users/:userId',
  authenticate(),
  requirePermission('organization_user', 'update'),
  validateUuidParam,
  organizationController.updateUserRole
);

router.delete('/:id/users/:userId',
  authenticate(),
  requirePermission('organization_user', 'delete'),
  validateUuidParam,
  organizationController.removeUser
);

// Organization fundraisers
router.get('/:id/fundraisers',
  authenticate(),
  requirePermission('fundraiser', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  organizationController.getOrganizationFundraisers
);

// Organization donations
router.get('/:id/donations',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  organizationController.getOrganizationDonations
);

router.get('/:id/donations/summary',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  organizationController.getDonationSummary
);

// Organization disbursements
router.get('/:id/disbursements',
  authenticate(),
  requirePermission('disbursement', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  organizationController.getDisbursements
);

router.post('/:id/disbursements/request',
  authenticate(),
  requirePermission('disbursement', 'request'),
  validateUuidParam,
  organizationController.requestDisbursement
);

// Organization compliance reports
router.get('/:id/compliance/reports',
  authenticate(),
  requirePermission('compliance_report', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  organizationController.getComplianceReports
);

router.post('/:id/compliance/reports',
  authenticate(),
  requirePermission('compliance_report', 'create'),
  validateUuidParam,
  organizationController.generateComplianceReport
);

// Organization analytics
router.get('/:id/analytics/overview',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  organizationController.getAnalyticsOverview
);

router.get('/:id/analytics/donations',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  organizationController.getDonationAnalytics
);

router.get('/:id/analytics/fundraisers',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  organizationController.getFundraiserAnalytics
);

export default router;