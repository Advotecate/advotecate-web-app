import { Request, Response } from 'express';
import { logger } from '../middleware/logging.js';
import { FundraiserService } from '../services/business/fundraiserService.js';
import { DatabaseService } from '../services/database/index.js';
import { FundraiserRepository } from '../services/database/repositories/fundraiserRepository.js';
import { DonationRepository } from '../services/database/repositories/donationRepository.js';

export class DonationController {
  private fundraiserService: FundraiserService;
  private donationRepository: DonationRepository;

  constructor() {
    const dbService = DatabaseService.getInstance();
    const fundraiserRepository = new FundraiserRepository(dbService);
    const donationRepository = new DonationRepository(dbService);

    this.fundraiserService = new FundraiserService(fundraiserRepository, donationRepository);
    this.donationRepository = donationRepository;
  }
  async createDonation(req: Request, res: Response): Promise<void> {
    try {
      const donationData = req.body;
      const userId = (req as any).user?.id;

      if (!donationData.fundraiserId || !donationData.amount) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Fundraiser ID and amount are required'
        });
        return;
      }

      if (!donationData.donorInfo) {
        res.status(400).json({
          error: 'Donor information is required',
          code: 'VALIDATION_ERROR',
          details: 'Donor information including email, firstName, and lastName are required'
        });
        return;
      }

      if (!donationData.paymentMethod) {
        res.status(400).json({
          error: 'Payment method is required',
          code: 'VALIDATION_ERROR',
          details: 'Payment method information is required'
        });
        return;
      }

      const result = await this.fundraiserService.processDonation({
        fundraiserId: donationData.fundraiserId,
        amount: donationData.amount,
        donorInfo: donationData.donorInfo,
        paymentMethod: donationData.paymentMethod,
        isRecurring: donationData.isRecurring,
        recurringInterval: donationData.recurringInterval,
        userId,
        metadata: donationData.metadata
      });

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          code: 'DONATION_FAILED'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Donation processed successfully',
        data: {
          donation: {
            id: result.donation!.id,
            fundraiserId: result.donation!.fundraiserId,
            amount: result.donation!.amount,
            currency: result.donation!.currency,
            status: result.donation!.status,
            isRecurring: result.donation!.isRecurring,
            transactionId: result.donation!.transactionId,
            recurringPaymentId: result.donation!.recurringPaymentId,
            createdAt: result.donation!.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Create donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const fundraiserId = req.query.fundraiserId as string;
      const status = req.query.status as string;
      const userId = (req as any).user?.id;

      const filters: any = {};
      if (fundraiserId) filters.fundraiserId = fundraiserId;
      if (status) filters.status = status;
      if (userId && !req.query.all) filters.userId = userId; // User's own donations unless 'all' is requested

      const result = await this.donationRepository.findMany(filters, { page, limit });

      res.status(200).json({
        success: true,
        data: {
          donations: result.data.map(donation => ({
            id: donation.id,
            fundraiserId: donation.fundraiserId,
            amount: donation.amount,
            currency: donation.currency,
            status: donation.status,
            isRecurring: donation.isRecurring,
            recurringInterval: donation.recurringInterval,
            transactionId: donation.transactionId,
            recurringPaymentId: donation.recurringPaymentId,
            donorFirstName: donation.donorFirstName,
            donorLastName: donation.donorLastName,
            donorEmail: donation.donorEmail,
            createdAt: donation.createdAt
          })),
          pagination: {
            page: result.pagination.page,
            limit: result.pagination.limit,
            total: result.pagination.total,
            pages: result.pagination.pages
          }
        }
      });
    } catch (error) {
      logger.error('Get donations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!id) {
        res.status(400).json({
          error: 'Donation ID is required',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const donation = await this.donationRepository.findById(id);

      if (!donation) {
        res.status(404).json({
          error: 'Donation not found',
          code: 'DONATION_NOT_FOUND'
        });
        return;
      }

      // Check if user has access to this donation (admin, organization member, or donor)
      if (userId && donation.userId !== userId) {
        // Additional authorization checks would go here
        // For now, allow access to authenticated users
      }

      res.status(200).json({
        success: true,
        data: {
          donation: {
            id: donation.id,
            fundraiserId: donation.fundraiserId,
            amount: donation.amount,
            currency: donation.currency,
            status: donation.status,
            isRecurring: donation.isRecurring,
            recurringInterval: donation.recurringInterval,
            transactionId: donation.transactionId,
            recurringPaymentId: donation.recurringPaymentId,
            donorFirstName: donation.donorFirstName,
            donorLastName: donation.donorLastName,
            donorEmail: donation.donorEmail,
            createdAt: donation.createdAt,
            updatedAt: donation.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Get donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async cancelDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation cancellation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Cancel donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async refundDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation refund
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Refund donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getRecurringDonations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get recurring donations
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get recurring donations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async pauseRecurringDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement pause recurring donation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Pause recurring donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async resumeRecurringDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement resume recurring donation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Resume recurring donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async cancelRecurringDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement cancel recurring donation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Cancel recurring donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async updateRecurringAmount(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement update recurring donation amount
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Update recurring amount error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonationReceipt(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get donation receipt
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get donation receipt error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async resendReceipt(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement resend receipt
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Resend receipt error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation analytics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get donation analytics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonationTrends(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation trends
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get donation trends error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getDonorDemographics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donor demographics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get donor demographics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getPaymentMethodAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement payment method analytics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get payment method analytics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getComplianceSummary(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement compliance summary
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get compliance summary error', { error });
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

  async getFlaggedDonations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get flagged donations
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get flagged donations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async flagDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement flag donation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Flag donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async unflagDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement unflag donation
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Unflag donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async verifyDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation verification
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Verify donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async reviewDonation(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement donation review
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Review donation error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async bulkRefund(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement bulk refund
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Bulk refund error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async bulkExport(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement bulk export
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Bulk export error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getRecentDonationStats(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement recent donation stats (public)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get recent donation stats error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getGoalProgress(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement goal progress (public)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get goal progress error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }
}