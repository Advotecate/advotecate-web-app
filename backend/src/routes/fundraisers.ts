import { Router } from 'express';
import { authenticate, allowAnonymous, requirePermission } from '../middleware/auth.js';
import {
  validateCreateFundraiser,
  validateUpdateFundraiser,
  validatePaginationQuery,
  validateUuidParam,
  validateSlugParam
} from '../middleware/validation.js';
import { FundraiserController } from '../controllers/fundraisers.js';

const router = Router();
const fundraiserController = new FundraiserController();

// Public fundraiser endpoints (no authentication required)
router.get('/public',
  validatePaginationQuery,
  fundraiserController.getActiveFundraisers
);

router.get('/public/:slug',
  validateSlugParam,
  fundraiserController.getFundraiserBySlug
);

router.get('/public/:slug/stats',
  validateSlugParam,
  fundraiserController.getFundraiserStats
);

// Search fundraisers
router.get('/search',
  allowAnonymous,
  fundraiserController.searchFundraisers
);

// Fundraiser management (authenticated)
router.post('/',
  authenticate(),
  requirePermission('fundraiser', 'create'),
  validateCreateFundraiser,
  fundraiserController.createFundraiser
);

router.get('/',
  authenticate(),
  validatePaginationQuery,
  fundraiserController.getFundraisers
);

router.get('/:id',
  authenticate(),
  requirePermission('fundraiser', 'read'),
  validateUuidParam,
  fundraiserController.getFundraiser
);

router.put('/:id',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  validateUpdateFundraiser,
  fundraiserController.updateFundraiser
);

router.delete('/:id',
  authenticate(),
  requirePermission('fundraiser', 'delete'),
  validateUuidParam,
  fundraiserController.deleteFundraiser
);

// Fundraiser status management
router.post('/:id/activate',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.activateFundraiser
);

router.post('/:id/pause',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.pauseFundraiser
);

router.post('/:id/complete',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.completeFundraiser
);

// Fundraiser donations
router.get('/:id/donations',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  fundraiserController.getFundraiserDonations
);

router.get('/:id/donations/summary',
  authenticate(),
  requirePermission('donation', 'read'),
  validateUuidParam,
  fundraiserController.getDonationSummary
);

router.get('/:id/donations/export',
  authenticate(),
  requirePermission('donation', 'export'),
  validateUuidParam,
  fundraiserController.exportDonations
);

// Fundraiser analytics
router.get('/:id/analytics/overview',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  fundraiserController.getAnalyticsOverview
);

router.get('/:id/analytics/timeline',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  fundraiserController.getTimelineAnalytics
);

router.get('/:id/analytics/demographics',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  fundraiserController.getDemographicAnalytics
);

// Fundraiser sharing and social features
router.get('/:id/share-stats',
  authenticate(),
  requirePermission('fundraiser', 'read'),
  validateUuidParam,
  fundraiserController.getShareStats
);

router.post('/:id/share-links',
  authenticate(),
  requirePermission('fundraiser', 'read'),
  validateUuidParam,
  fundraiserController.generateShareLinks
);

// Fundraiser updates and communications
router.get('/:id/updates',
  allowAnonymous,
  validateUuidParam,
  fundraiserController.getFundraiserUpdates
);

router.post('/:id/updates',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.createFundraiserUpdate
);

router.put('/:id/updates/:updateId',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.updateFundraiserUpdate
);

router.delete('/:id/updates/:updateId',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.deleteFundraiserUpdate
);

// Fundraiser media management
router.post('/:id/media',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.uploadMedia
);

router.delete('/:id/media/:mediaId',
  authenticate(),
  requirePermission('fundraiser', 'update'),
  validateUuidParam,
  fundraiserController.deleteMedia
);

// Trending and featured fundraisers
router.get('/featured',
  fundraiserController.getFeaturedFundraisers
);

router.get('/trending',
  fundraiserController.getTrendingFundraisers
);

// Fundraiser categories and tags
router.get('/categories',
  fundraiserController.getCategories
);

router.get('/tags',
  fundraiserController.getTags
);

export default router;