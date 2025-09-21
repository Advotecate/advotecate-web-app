import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import {
  validateCreateDonation,
  validatePaginationQuery,
  validateUuidParam
} from '../middleware/validation.js';
import { DonationController } from '../controllers/donations.js';

const router = Router();
const donationController = new DonationController();

// Create donation (public endpoint with optional auth)
router.post('/',
  authenticate({ allowAnonymous: true }),
  validateCreateDonation,
  donationController.createDonation
);

// Donation management (authenticated)
router.get('/',
  authenticate(),
  validatePaginationQuery,
  donationController.getDonations
);

router.get('/:id',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  donationController.getDonation
);

// Donation status updates
router.post('/:id/cancel',
  authenticate(),
  requirePermission('donation', 'cancel'),
  validateUuidParam,
  donationController.cancelDonation
);

router.post('/:id/refund',
  authenticate(),
  requirePermission('donation', 'refund'),
  validateUuidParam,
  donationController.refundDonation
);

// Recurring donation management
router.get('/recurring',
  authenticate(),
  validatePaginationQuery,
  donationController.getRecurringDonations
);

router.post('/:id/recurring/pause',
  authenticate(),
  requirePermission('donation', 'update'),
  validateUuidParam,
  donationController.pauseRecurringDonation
);

router.post('/:id/recurring/resume',
  authenticate(),
  requirePermission('donation', 'update'),
  validateUuidParam,
  donationController.resumeRecurringDonation
);

router.post('/:id/recurring/cancel',
  authenticate(),
  requirePermission('donation', 'cancel'),
  validateUuidParam,
  donationController.cancelRecurringDonation
);

router.put('/:id/recurring/amount',
  authenticate(),
  requirePermission('donation', 'update'),
  validateUuidParam,
  donationController.updateRecurringAmount
);

// Donation receipts and documentation
router.get('/:id/receipt',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  donationController.getDonationReceipt
);

router.post('/:id/receipt/resend',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  donationController.resendReceipt
);

// Donation analytics (admin/org admin only)
router.get('/analytics/overview',
  authenticate(),
  requirePermission('analytics', 'read'),
  donationController.getDonationAnalytics
);

router.get('/analytics/trends',
  authenticate(),
  requirePermission('analytics', 'read'),
  donationController.getDonationTrends
);

router.get('/analytics/demographics',
  authenticate(),
  requirePermission('analytics', 'read'),
  donationController.getDonorDemographics
);

router.get('/analytics/payment-methods',
  authenticate(),
  requirePermission('analytics', 'read'),
  donationController.getPaymentMethodAnalytics
);

// Compliance and reporting
router.get('/compliance/summary',
  authenticate(),
  requirePermission('compliance_report', 'read'),
  donationController.getComplianceSummary
);

router.get('/export',
  authenticate(),
  requirePermission('donation', 'export'),
  donationController.exportDonations
);

router.get('/compliance/flagged',
  authenticate(),
  requirePermission('compliance_report', 'read'),
  donationController.getFlaggedDonations
);

router.post('/:id/compliance/flag',
  authenticate(),
  requirePermission('donation', 'flag'),
  validateUuidParam,
  donationController.flagDonation
);

router.post('/:id/compliance/unflag',
  authenticate(),
  requirePermission('donation', 'flag'),
  validateUuidParam,
  donationController.unflagDonation
);

// Donation verification and review
router.post('/:id/verify',
  authenticate(),
  requirePermission('donation', 'verify'),
  validateUuidParam,
  donationController.verifyDonation
);

router.post('/:id/review',
  authenticate(),
  requirePermission('donation', 'review'),
  validateUuidParam,
  donationController.reviewDonation
);

// Bulk operations (admin only)
router.post('/bulk/refund',
  authenticate(),
  requirePermission('donation', 'refund'),
  donationController.bulkRefund
);

router.post('/bulk/export',
  authenticate(),
  requirePermission('donation', 'export'),
  donationController.bulkExport
);

// Donation statistics (public aggregated data)
router.get('/stats/recent',
  donationController.getRecentDonationStats
);

router.get('/stats/goals',
  donationController.getGoalProgress
);

export default router;