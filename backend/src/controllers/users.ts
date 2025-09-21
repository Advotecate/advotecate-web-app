import { Request, Response } from 'express';
import { logger } from '../middleware/logging.js';
import { UserService } from '../services/business/userService.js';
import { OrganizationService } from '../services/business/organizationService.js';
import { DatabaseService } from '../services/database/index.js';
import { UserRepository } from '../services/database/repositories/userRepository.js';
import { OrganizationRepository } from '../services/database/repositories/organizationRepository.js';
import { DonationRepository } from '../services/database/repositories/donationRepository.js';

export class UserController {
  private userService: UserService;
  private organizationService: OrganizationService;

  constructor() {
    const dbService = DatabaseService.getInstance();
    const userRepository = new UserRepository(dbService);
    const orgRepository = new OrganizationRepository(dbService);
    const donationRepository = new DonationRepository(dbService);

    this.userService = new UserService(userRepository);
    this.organizationService = new OrganizationService(orgRepository, userRepository);
  }
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const user = await this.userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            kycVerified: user.kycVerified,
            mfaEnabled: user.mfaEnabled,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Get current user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const updates = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.userService.updateUserProfile(userId, updates);

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          code: 'UPDATE_FAILED'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: result.user!.id,
            email: result.user!.email,
            firstName: result.user!.firstName,
            lastName: result.user!.lastName,
            phone: result.user!.phone,
            emailVerified: result.user!.emailVerified,
            phoneVerified: result.user!.phoneVerified,
            updatedAt: result.user!.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Update profile error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement account deletion
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Delete account error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async requestKYCVerification(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement KYC verification request
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('KYC verification request error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getVerificationStatus(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement verification status check
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get verification status error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getUserDonations(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get user donations
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get user donations error', { error });
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

  async getUserOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const organizations = await this.organizationService.getUserOrganizations(userId);

      res.status(200).json({
        success: true,
        data: {
          organizations: organizations.map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            type: org.type,
            status: org.status,
            role: org.role,
            joinedAt: org.joinedAt
          }))
        }
      });
    } catch (error) {
      logger.error('Get user organizations error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get users (admin)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get users error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user search
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Search users error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get user by ID
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get user by ID error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement update user (admin)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Update user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async verifyUser(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user verification (admin)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Verify user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async suspendUser(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user suspension
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Suspend user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async unsuspendUser(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user unsuspension
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Unsuspend user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user deletion (admin)
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Delete user error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getUserAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user analytics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get user analytics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async getUserGrowthAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user growth analytics
      res.status(501).json({ error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' });
    } catch (error) {
      logger.error('Get user growth analytics error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }
}