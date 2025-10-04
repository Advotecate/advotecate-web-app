/**
 * Candidate Routes
 * API endpoints for FEC candidate management and multi-org fundraising
 */

import { Router, Request, Response } from 'express';
import { authenticate, allowAnonymous, requirePermission } from '../middleware/auth.js';
import { candidateService } from '../services/candidateService.js';
import { fecSyncService } from '../services/fecSyncService.js';

const router = Router();

// ============================================================================
// PUBLIC CANDIDATE ENDPOINTS
// ============================================================================

/**
 * GET /api/candidates/public
 * List all active candidates (public access)
 */
router.get('/public', async (req: Request, res: Response) => {
  try {
    const { query, office_type, state, party, limit, offset } = req.query;

    const result = await candidateService.searchCandidates({
      query: query as string,
      office_type: office_type as string,
      state: state as string,
      party: party as string,
      verification_status: 'fec_verified', // Only show verified candidates publicly
      campaign_status: 'active',
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
    });

    res.json({
      success: true,
      data: result.candidates,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching public candidates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch candidates',
    });
  }
});

/**
 * GET /api/candidates/public/:slug
 * Get candidate profile by slug (public access)
 */
router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const candidate = await candidateService.getCandidateBySlug(slug);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
    }

    res.json({
      success: true,
      data: candidate,
    });
  } catch (error) {
    console.error('Error fetching candidate by slug:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch candidate',
    });
  }
});

/**
 * GET /api/candidates/public/:slug/fundraisers
 * Get all fundraisers for a candidate (public access)
 */
router.get('/public/:slug/fundraisers', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const candidate = await candidateService.getCandidateBySlug(slug);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
    }

    const fundraisers = await candidateService.getCandidateFundraisers(candidate.id);
    const totals = await candidateService.getCandidateFundraisingTotals(candidate.id);

    res.json({
      success: true,
      data: {
        fundraisers,
        totals,
      },
    });
  } catch (error) {
    console.error('Error fetching candidate fundraisers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fundraisers',
    });
  }
});

/**
 * GET /api/candidates/search
 * Search candidates (public/authenticated)
 */
router.get('/search', allowAnonymous, async (req: Request, res: Response) => {
  try {
    const { query, office_type, state, party, limit, offset } = req.query;

    const result = await candidateService.searchCandidates({
      query: query as string,
      office_type: office_type as string,
      state: state as string,
      party: party as string,
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
    });

    res.json({
      success: true,
      data: result.candidates,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search candidates',
    });
  }
});

// ============================================================================
// AUTHENTICATED CANDIDATE ENDPOINTS
// ============================================================================

/**
 * GET /api/candidates
 * List candidates (authenticated, with filters)
 */
router.get(
  '/',
  authenticate(),
  requirePermission('candidate', 'view'),
  async (req: Request, res: Response) => {
    try {
      const { query, office_type, state, party, verification_status, campaign_status, limit, offset } = req.query;

      const result = await candidateService.searchCandidates({
        query: query as string,
        office_type: office_type as string,
        state: state as string,
        party: party as string,
        verification_status: verification_status as string,
        campaign_status: campaign_status as string,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0,
      });

      res.json({
        success: true,
        data: result.candidates,
        pagination: {
          total: result.total,
          limit: parseInt(limit as string) || 20,
          offset: parseInt(offset as string) || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching candidates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch candidates',
      });
    }
  }
);

/**
 * POST /api/candidates
 * Create new candidate profile
 */
router.post(
  '/',
  authenticate(),
  requirePermission('candidate', 'create'),
  async (req: Request, res: Response) => {
    try {
      const candidateData = req.body;

      // Generate slug if not provided
      if (!candidateData.slug) {
        candidateData.slug = candidateService.generateSlug(candidateData.display_name);
      }

      // Check slug availability
      const slugAvailable = await candidateService.isSlugAvailable(candidateData.slug);
      if (!slugAvailable) {
        return res.status(400).json({
          success: false,
          error: 'Slug already in use',
        });
      }

      const candidate = await candidateService.createCandidate(candidateData);

      if (!candidate) {
        return res.status(400).json({
          success: false,
          error: 'Failed to create candidate',
        });
      }

      res.status(201).json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      console.error('Error creating candidate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create candidate',
      });
    }
  }
);

/**
 * GET /api/candidates/:id
 * Get candidate by ID
 */
router.get(
  '/:id',
  authenticate(),
  requirePermission('candidate', 'view'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const candidate = await candidateService.getCandidateById(id);

      if (!candidate) {
        return res.status(404).json({
          success: false,
          error: 'Candidate not found',
        });
      }

      res.json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      console.error('Error fetching candidate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch candidate',
      });
    }
  }
);

/**
 * PUT /api/candidates/:id
 * Update candidate profile
 */
router.put(
  '/:id',
  authenticate(),
  requirePermission('candidate', 'edit'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const candidate = await candidateService.updateCandidate(id, updates);

      if (!candidate) {
        return res.status(404).json({
          success: false,
          error: 'Candidate not found',
        });
      }

      res.json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      console.error('Error updating candidate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update candidate',
      });
    }
  }
);

/**
 * POST /api/candidates/:id/verify
 * Verify/claim candidate profile
 */
router.post(
  '/:id/verify',
  authenticate(),
  requirePermission('candidate', 'verify'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const success = await candidateService.verifyCandidate(id, userId);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to verify candidate',
        });
      }

      res.json({
        success: true,
        message: 'Candidate verification initiated',
      });
    } catch (error) {
      console.error('Error verifying candidate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify candidate',
      });
    }
  }
);

/**
 * POST /api/candidates/:id/link-fec
 * Link candidate to FEC CAND_ID
 */
router.post(
  '/:id/link-fec',
  authenticate(),
  requirePermission('candidate', 'edit'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { fec_cand_id } = req.body;

      if (!fec_cand_id) {
        return res.status(400).json({
          success: false,
          error: 'FEC CAND_ID is required',
        });
      }

      const success = await candidateService.linkToFEC(id, fec_cand_id);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to link to FEC',
        });
      }

      res.json({
        success: true,
        message: 'Candidate linked to FEC data',
      });
    } catch (error) {
      console.error('Error linking to FEC:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to link to FEC',
      });
    }
  }
);

// ============================================================================
// CANDIDATE FUNDRAISER ENDPOINTS
// ============================================================================

/**
 * GET /api/candidates/:id/fundraisers
 * Get all fundraisers for a candidate
 */
router.get(
  '/:id/fundraisers',
  authenticate(),
  requirePermission('candidate', 'view'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const fundraisers = await candidateService.getCandidateFundraisers(id);
      const totals = await candidateService.getCandidateFundraisingTotals(id);

      res.json({
        success: true,
        data: {
          fundraisers,
          totals,
        },
      });
    } catch (error) {
      console.error('Error fetching candidate fundraisers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fundraisers',
      });
    }
  }
);

/**
 * POST /api/candidates/:id/fundraisers
 * Create fundraiser for candidate (multi-org feature)
 */
router.post(
  '/:id/fundraisers',
  authenticate(),
  requirePermission('candidate.fundraiser', 'create'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { fundraiser_id, organization_id, is_primary, fundraiser_role, custom_title, custom_description } = req.body;

      if (!fundraiser_id || !organization_id) {
        return res.status(400).json({
          success: false,
          error: 'fundraiser_id and organization_id are required',
        });
      }

      const candidateFundraiser = await candidateService.createCandidateFundraiser({
        candidate_id: id,
        fundraiser_id,
        organization_id,
        is_primary,
        fundraiser_role,
        custom_title,
        custom_description,
      });

      if (!candidateFundraiser) {
        return res.status(400).json({
          success: false,
          error: 'Failed to create candidate fundraiser',
        });
      }

      res.status(201).json({
        success: true,
        data: candidateFundraiser,
      });
    } catch (error) {
      console.error('Error creating candidate fundraiser:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create fundraiser',
      });
    }
  }
);

/**
 * PUT /api/candidates/fundraisers/:fundraiserId
 * Update candidate fundraiser
 */
router.put(
  '/fundraisers/:fundraiserId',
  authenticate(),
  requirePermission('candidate.fundraiser', 'manage'),
  async (req: Request, res: Response) => {
    try {
      const { fundraiserId } = req.params;
      const updates = req.body;

      const fundraiser = await candidateService.updateCandidateFundraiser(fundraiserId, updates);

      if (!fundraiser) {
        return res.status(404).json({
          success: false,
          error: 'Candidate fundraiser not found',
        });
      }

      res.json({
        success: true,
        data: fundraiser,
      });
    } catch (error) {
      console.error('Error updating candidate fundraiser:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update fundraiser',
      });
    }
  }
);

/**
 * POST /api/candidates/fundraisers/:fundraiserId/approve
 * Approve candidate fundraiser
 */
router.post(
  '/fundraisers/:fundraiserId/approve',
  authenticate(),
  requirePermission('candidate', 'verify'),
  async (req: Request, res: Response) => {
    try {
      const { fundraiserId } = req.params;
      const userId = req.user!.userId;

      const success = await candidateService.approveCandidateFundraiser(fundraiserId, userId);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to approve fundraiser',
        });
      }

      res.json({
        success: true,
        message: 'Candidate fundraiser approved',
      });
    } catch (error) {
      console.error('Error approving fundraiser:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve fundraiser',
      });
    }
  }
);

/**
 * POST /api/candidates/fundraisers/:fundraiserId/reject
 * Reject candidate fundraiser
 */
router.post(
  '/fundraisers/:fundraiserId/reject',
  authenticate(),
  requirePermission('candidate', 'verify'),
  async (req: Request, res: Response) => {
    try {
      const { fundraiserId } = req.params;
      const { reason } = req.body;

      const success = await candidateService.rejectCandidateFundraiser(fundraiserId, reason);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to reject fundraiser',
        });
      }

      res.json({
        success: true,
        message: 'Candidate fundraiser rejected',
      });
    } catch (error) {
      console.error('Error rejecting fundraiser:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject fundraiser',
      });
    }
  }
);

/**
 * GET /api/candidates/organizations/:orgId/fundraisers
 * Get organization's candidate fundraisers
 */
router.get(
  '/organizations/:orgId/fundraisers',
  authenticate(),
  requirePermission('candidate.fundraiser', 'manage'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const fundraisers = await candidateService.getOrganizationCandidateFundraisers(orgId);

      res.json({
        success: true,
        data: fundraisers,
      });
    } catch (error) {
      console.error('Error fetching org candidate fundraisers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fundraisers',
      });
    }
  }
);

// ============================================================================
// ADMIN / FEC SYNC ENDPOINTS
// ============================================================================

/**
 * POST /api/candidates/admin/fec/sync/full
 * Trigger full FEC sync (admin only)
 */
router.post(
  '/admin/fec/sync/full',
  authenticate(),
  requirePermission('compliance', 'file_reports'), // Reuse compliance permission for admin FEC sync
  async (req: Request, res: Response) => {
    try {
      const { year, office } = req.body;

      if (!year) {
        return res.status(400).json({
          success: false,
          error: 'Election year is required',
        });
      }

      // Run in background and return immediately
      fecSyncService.fullSync(year, office).catch(error => {
        console.error('Full FEC sync failed:', error);
      });

      res.json({
        success: true,
        message: 'Full FEC sync initiated',
      });
    } catch (error) {
      console.error('Error initiating FEC sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate sync',
      });
    }
  }
);

/**
 * POST /api/candidates/admin/fec/sync/incremental
 * Trigger incremental FEC sync (admin only)
 */
router.post(
  '/admin/fec/sync/incremental',
  authenticate(),
  requirePermission('compliance', 'file_reports'),
  async (req: Request, res: Response) => {
    try {
      // Run in background
      fecSyncService.incrementalSync().catch(error => {
        console.error('Incremental FEC sync failed:', error);
      });

      res.json({
        success: true,
        message: 'Incremental FEC sync initiated',
      });
    } catch (error) {
      console.error('Error initiating incremental sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate sync',
      });
    }
  }
);

/**
 * GET /api/candidates/admin/fec/sync/status/:jobId
 * Get FEC sync job status
 */
router.get(
  '/admin/fec/sync/status/:jobId',
  authenticate(),
  requirePermission('compliance', 'view_reports'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const status = await fecSyncService.getSyncJobStatus(jobId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Sync job not found',
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error fetching sync status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sync status',
      });
    }
  }
);

/**
 * GET /api/candidates/admin/fec/sync/jobs
 * Get recent FEC sync jobs
 */
router.get(
  '/admin/fec/sync/jobs',
  authenticate(),
  requirePermission('compliance', 'view_reports'),
  async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;

      const jobs = await fecSyncService.getRecentSyncJobs(parseInt(limit as string) || 10);

      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      console.error('Error fetching sync jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sync jobs',
      });
    }
  }
);

export default router;
