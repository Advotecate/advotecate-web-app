import { Request, Response } from 'express';
import { logger } from '../middleware/logging.js';
import { OrganizationService } from '../services/business/organizationService.js';
import { FundraiserService } from '../services/business/fundraiserService.js';
import { DatabaseService } from '../services/database/index.js';
import { OrganizationRepository } from '../services/database/repositories/organizationRepository.js';
import { UserRepository } from '../services/database/repositories/userRepository.js';
import { FundraiserRepository } from '../services/database/repositories/fundraiserRepository.js';
import { DonationRepository } from '../services/database/repositories/donationRepository.js';

export class OrganizationController {
  private organizationService: OrganizationService;
  private fundraiserService: FundraiserService;

  constructor() {
    const dbService = DatabaseService.getInstance();
    const orgRepository = new OrganizationRepository(dbService);
    const userRepository = new UserRepository(dbService);
    const fundraiserRepository = new FundraiserRepository(dbService);
    const donationRepository = new DonationRepository(dbService);

    this.organizationService = new OrganizationService(orgRepository, userRepository);
    this.fundraiserService = new FundraiserService(fundraiserRepository, donationRepository);
  }
  async createOrganization(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const organizationData = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!organizationData.name || !organizationData.type) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Name and type are required'
        });
        return;
      }

      const result = await this.organizationService.createOrganization({
        ...organizationData,
        ownerId: userId
      });

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          code: 'CREATION_FAILED'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: {
          organization: {
            id: result.organization!.id,
            name: result.organization!.name,
            slug: result.organization!.slug,
            type: result.organization!.type,
            description: result.organization!.description,
            status: result.organization!.status,
            createdAt: result.organization!.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Create organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getOrganizations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get organizations with pagination
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get organizations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Organization ID is required',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const organization = await this.organizationService.getOrganizationById(id);

      if (!organization) {
        res.status(404).json({
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            type: organization.type,
            description: organization.description,
            website: organization.website,
            address: organization.address,
            phone: organization.phone,
            email: organization.email,
            ein: organization.ein,
            status: organization.status,
            verified: organization.verified,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Get organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async updateOrganization(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization update
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Update organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async deleteOrganization(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization deletion
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Delete organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async verifyOrganization(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization verification (admin)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Verify organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async suspendOrganization(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization suspension
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Suspend organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async unsuspendOrganization(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization unsuspension
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Unsuspend organization error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getOrganizationMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: 'Organization ID is required',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const members = await this.organizationService.getOrganizationMembers(id);

      res.status(200).json({
        success: true,
        data: {
          members: members.map(member => ({
            id: member.id,
            userId: member.userId,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            role: member.role,
            status: member.status,
            joinedAt: member.joinedAt
          }))
        }
      });
    } catch (error) {
      logger.error('Get organization members error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async addOrganizationMember(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement add organization member
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Add organization member error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement member role update
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Update member role error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement member removal
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Remove member error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getOrganizationFundraisers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;

      if (!id) {
        res.status(400).json({
          error: 'Organization ID is required',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const filters: any = { organizationId: id };
      if (status) {
        filters.status = status;
      }

      const result = await this.fundraiserService.getFundraisers({ page, limit, ...filters });

      res.status(200).json({
        success: true,
        data: {
          fundraisers: result.fundraisers.map(fundraiser => ({
            id: fundraiser.id,
            title: fundraiser.title,
            slug: fundraiser.slug,
            description: fundraiser.description,
            goalAmount: fundraiser.goalAmount,
            raisedAmount: fundraiser.raisedAmount,
            donorCount: fundraiser.donorCount,
            status: fundraiser.status,
            startDate: fundraiser.startDate,
            endDate: fundraiser.endDate,
            createdAt: fundraiser.createdAt,
            updatedAt: fundraiser.updatedAt
          })),
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error('Get organization fundraisers error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getOrganizationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization analytics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get organization analytics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement compliance report generation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get compliance report error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonationSummary(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation summary
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get donation summary error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async exportDonations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation export
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Export donations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async searchOrganizations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement organization search
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Search organizations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }
}