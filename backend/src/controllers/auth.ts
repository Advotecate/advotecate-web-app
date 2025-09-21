import { Request, Response } from 'express';
import { logger } from '../middleware/logging.js';
import { UserService } from '../services/business/userService.js';
import { DatabaseService } from '../services/database/index.js';
import { UserRepository } from '../services/database/repositories/userRepository.js';

export class AuthController {
  private userService: UserService;

  constructor() {
    const dbService = DatabaseService.getInstance();
    const userRepository = new UserRepository(dbService);
    this.userService = new UserService(userRepository);
  }
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone } = req.body;

      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Email, password, firstName, and lastName are required'
        });
        return;
      }

      const result = await this.userService.registerUser({
        email,
        password,
        firstName,
        lastName,
        phone
      });

      if (!result.success) {
        res.status(400).json({
          error: result.error,
          code: 'REGISTRATION_FAILED'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: result.user!.id,
            email: result.user!.email,
            firstName: result.user!.firstName,
            lastName: result.user!.lastName,
            emailVerified: result.user!.emailVerified,
            createdAt: result.user!.createdAt
          },
          token: result.token
        }
      });
    } catch (error) {
      logger.error('Registration error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, mfaCode } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          details: 'Email and password are required'
        });
        return;
      }

      const result = await this.userService.loginUser({
        email,
        password,
        mfaCode
      });

      if (!result.success) {
        if (result.requiresMFA) {
          res.status(200).json({
            success: false,
            requiresMFA: true,
            message: 'MFA verification required'
          });
          return;
        }

        res.status(401).json({
          error: result.error,
          code: 'LOGIN_FAILED'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: result.user!.id,
            email: result.user!.email,
            firstName: result.user!.firstName,
            lastName: result.user!.lastName,
            emailVerified: result.user!.emailVerified,
            mfaEnabled: result.user!.mfaEnabled
          },
          token: result.token,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement user logout
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Logout error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement token refresh
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Token refresh error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement forgot password
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Forgot password error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement password reset
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Password reset error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async setupMFA(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement MFA setup
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('MFA setup error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async confirmMFASetup(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement MFA setup confirmation
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('MFA setup confirmation error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement MFA verification
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('MFA verification error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async disableMFA(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement MFA disable
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('MFA disable error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement backup codes regeneration
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Backup codes regeneration error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement password change
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Password change error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
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
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async getUserSessions(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement get user sessions
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Get user sessions error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async terminateSession(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement session termination
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Session termination error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async terminateAllSessions(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement all sessions termination
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('All sessions termination error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async sendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement email verification sending
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Send email verification error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement email verification
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Email verification error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async sendPhoneVerification(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement phone verification sending
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Send phone verification error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  async confirmPhoneVerification(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement phone verification confirmation
      res.status(501).json({
        error: 'Not implemented yet',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      logger.error('Phone verification confirmation error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}