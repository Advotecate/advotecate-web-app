import { DatabaseService } from '../database/index.js';
import { BaseRepository } from '../database/repositories/base.js';
import {
  User,
  CreateUserData,
  UpdateUserData,
  UserFilters,
  PaginationOptions,
  PaginatedResult,
  UserWithOrganizations
} from '../database/types.js';
import { passwordService } from '../../auth/password.js';
import { jwtService } from '../../auth/jwt.js';
import { mfaService } from '../../auth/mfa.js';
import { sessionManager } from '../../auth/session.js';
import { logger } from '../../middleware/logging.js';

class UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData, UserFilters> {
  constructor(db?: DatabaseService) {
    super('users', db);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findWithOrganizations(userId: string): Promise<UserWithOrganizations | null> {
    const result = await this.query<UserWithOrganizations>(`
      SELECT
        u.*,
        json_agg(
          json_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'organization_type', o.organization_type,
            'status', o.status,
            'role', om.role,
            'member_status', om.status
          )
        ) FILTER (WHERE o.id IS NOT NULL) as organizations
      FROM users u
      LEFT JOIN organization_members om ON u.id = om.user_id AND om.status = 'active'
      LEFT JOIN organizations o ON om.organization_id = o.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    return result.rows[0] || null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  async countByRole(role: User['role']): Promise<number> {
    return await this.count({ role } as UserFilters);
  }

  protected buildWhereClause(filters: UserFilters): { whereClause: string; params: any[] } {
    let whereClause = '1=1';
    let params: any[] = [];

    if (filters.email) {
      const result = this.addLikeCondition(whereClause, params, 'email', filters.email);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.role) {
      const result = this.addAndCondition(whereClause, params, 'role = ?', filters.role);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.status) {
      const result = this.addAndCondition(whereClause, params, 'status = ?', filters.status);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.is_verified !== undefined) {
      const result = this.addAndCondition(whereClause, params, 'is_verified = ?', filters.is_verified);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.verification_level) {
      const result = this.addAndCondition(whereClause, params, 'verification_level = ?', filters.verification_level);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.organization_id) {
      const result = this.addAndCondition(
        whereClause,
        params,
        'id IN (SELECT user_id FROM organization_members WHERE organization_id = ? AND status = ?)',
        filters.organization_id
      );
      whereClause = result.whereClause;
      params = [...result.params, 'active'];
    }

    if (filters.created_after || filters.created_before) {
      const result = this.addDateRangeCondition(
        whereClause,
        params,
        'created_at',
        filters.created_after,
        filters.created_before
      );
      whereClause = result.whereClause;
      params = result.params;
    }

    return { whereClause, params };
  }
}

export interface UserRegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  employer?: string;
  occupation?: string;
}

export interface UserLoginData {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  employer?: string;
  occupation?: string;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'password_hash' | 'mfa_secret'>;
  tokens?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
  requires_mfa?: boolean;
  temp_token?: string;
}

export interface UserVerificationRequest {
  verification_level: User['verification_level'];
  documents?: any;
  verification_data?: any;
}

export class UserService {
  private userRepository: UserRepository;
  private passwordService: typeof passwordService;
  private jwtService: typeof jwtService;
  private mfaService: typeof mfaService;
  private sessionService: typeof sessionManager;

  constructor(db?: DatabaseService) {
    this.userRepository = new UserRepository(db);
    this.passwordService = passwordService;
    this.jwtService = jwtService;
    this.mfaService = mfaService;
    this.sessionService = sessionManager;
  }

  async registerUser(registrationData: UserRegistrationData): Promise<AuthResult> {
    try {
      logger.info('Starting user registration', {
        email: registrationData.email,
        has_address: !!registrationData.address
      });

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(registrationData.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(registrationData.password);

      // Determine initial verification level
      const verificationLevel = this.determineInitialVerificationLevel(registrationData);

      // Create user data
      const userData: CreateUserData = {
        email: registrationData.email,
        password_hash: passwordHash,
        first_name: registrationData.first_name,
        last_name: registrationData.last_name,
        phone: registrationData.phone,
        date_of_birth: registrationData.date_of_birth,
        address_street: registrationData.address?.street,
        address_city: registrationData.address?.city,
        address_state: registrationData.address?.state,
        address_zip: registrationData.address?.zip,
        address_country: registrationData.address?.country || 'US',
        employer: registrationData.employer,
        occupation: registrationData.occupation,
        is_verified: false,
        verification_level: verificationLevel,
        mfa_enabled: false,
        role: 'donor',
        status: 'active'
      };

      // Create user
      const user = await this.userRepository.create(userData);

      // Generate tokens
      const accessToken = await this.jwtService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = await this.jwtService.generateRefreshToken(user.id);

      // Create session
      await this.sessionService.createSession(user.id, {
        ip_address: '', // Will be set by middleware
        user_agent: '', // Will be set by middleware
        refresh_token: refreshToken
      });

      logger.info('User registration completed successfully', {
        user_id: user.id,
        email: user.email,
        verification_level: user.verification_level
      });

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      };

    } catch (error) {
      logger.error('User registration failed', {
        email: registrationData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Registration failed. Please try again.'
      };
    }
  }

  async loginUser(loginData: UserLoginData): Promise<AuthResult> {
    try {
      logger.info('Starting user login', {
        email: loginData.email,
        has_mfa_code: !!loginData.mfa_code
      });

      // Find user
      const user = await this.userRepository.findByEmail(loginData.email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check user status
      if (user.status !== 'active') {
        return {
          success: false,
          error: 'Account is suspended or inactive'
        };
      }

      // Verify password
      const passwordValid = await this.passwordService.verifyPassword(loginData.password, user.password_hash);
      if (!passwordValid) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Handle MFA
      if (user.mfa_enabled) {
        if (!loginData.mfa_code) {
          // Generate temporary token for MFA step
          const tempToken = await this.jwtService.generateAccessToken(
            { userId: user.id, email: user.email, role: user.role },
            '5m' // 5 minute expiry
          );

          return {
            success: false,
            requires_mfa: true,
            temp_token: tempToken
          };
        }

        // Verify MFA code
        const mfaValid = await this.mfaService.verifyToken(user.mfa_secret!, loginData.mfa_code);
        if (!mfaValid) {
          return {
            success: false,
            error: 'Invalid MFA code'
          };
        }
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Generate tokens
      const accessToken = await this.jwtService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = await this.jwtService.generateRefreshToken(user.id);

      // Create session
      await this.sessionService.createSession(user.id, {
        ip_address: '', // Will be set by middleware
        user_agent: '', // Will be set by middleware
        refresh_token: refreshToken
      });

      logger.info('User login completed successfully', {
        user_id: user.id,
        email: user.email,
        mfa_used: user.mfa_enabled
      });

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      };

    } catch (error) {
      logger.error('User login failed', {
        email: loginData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Login failed. Please try again.'
      };
    }
  }

  async getUserById(userId: string, includeOrganizations: boolean = false): Promise<User | UserWithOrganizations | null> {
    try {
      if (includeOrganizations) {
        return await this.userRepository.findWithOrganizations(userId);
      } else {
        return await this.userRepository.findById(userId);
      }
    } catch (error) {
      logger.error('Failed to get user by ID', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmail(email);
    } catch (error) {
      logger.error('Failed to get user by email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async updateUser(userId: string, updateData: UserUpdateData): Promise<User | null> {
    try {
      logger.info('Updating user', {
        user_id: userId,
        fields_updated: Object.keys(updateData)
      });

      const updatedUser = await this.userRepository.update(userId, updateData);

      logger.info('User updated successfully', {
        user_id: userId
      });

      return updatedUser;

    } catch (error) {
      logger.error('Failed to update user', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Changing user password', { user_id: userId });

      // Get current user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const currentPasswordValid = await this.passwordService.verifyPassword(currentPassword, user.password_hash);
      if (!currentPasswordValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Validate new password
      const passwordValidation = this.passwordService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.errors.join(', ') };
      }

      // Hash new password
      const newPasswordHash = await this.passwordService.hashPassword(newPassword);

      // Update password
      await this.userRepository.update(userId, { password_hash: newPasswordHash });

      // Invalidate all sessions for security
      await this.sessionService.invalidateAllUserSessions(userId);

      logger.info('Password changed successfully', { user_id: userId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to change password', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false, error: 'Failed to change password' };
    }
  }

  async requestVerification(userId: string, verificationRequest: UserVerificationRequest): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Requesting user verification', {
        user_id: userId,
        verification_level: verificationRequest.verification_level
      });

      // Update user verification data
      await this.userRepository.update(userId, {
        verification_level: 'pending_verification' as any, // Temporary status
        verification_documents: verificationRequest.documents
      });

      // TODO: Trigger verification workflow
      // - Send documents to verification service
      // - Create verification task for admin review
      // - Send confirmation email to user

      logger.info('Verification request submitted', { user_id: userId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to request verification', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false, error: 'Failed to submit verification request' };
    }
  }

  async getUsers(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedResult<User>> {
    try {
      return await this.userRepository.findMany(filters, pagination);
    } catch (error) {
      logger.error('Failed to get users', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        data: [],
        pagination: {
          page: 1,
          per_page: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      };
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      logger.info('Deleting user', { user_id: userId });

      // TODO: Handle cascading deletes and data cleanup
      // - Anonymize donations
      // - Remove from organizations
      // - Clean up sessions and tokens

      const deleted = await this.userRepository.delete(userId);

      logger.info('User deleted successfully', { user_id: userId, deleted });

      return deleted;

    } catch (error) {
      logger.error('Failed to delete user', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async getUserStats(): Promise<{
    total_users: number;
    active_users: number;
    verified_users: number;
    users_by_role: Record<User['role'], number>;
  }> {
    try {
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({ status: 'active' });
      const verifiedUsers = await this.userRepository.count({ is_verified: true });

      const usersByRole: Record<User['role'], number> = {
        super_admin: await this.userRepository.countByRole('super_admin'),
        org_admin: await this.userRepository.countByRole('org_admin'),
        org_treasurer: await this.userRepository.countByRole('org_treasurer'),
        org_staff: await this.userRepository.countByRole('org_staff'),
        org_viewer: await this.userRepository.countByRole('org_viewer'),
        donor: await this.userRepository.countByRole('donor'),
        compliance_officer: await this.userRepository.countByRole('compliance_officer')
      };

      return {
        total_users: totalUsers,
        active_users: activeUsers,
        verified_users: verifiedUsers,
        users_by_role: usersByRole
      };

    } catch (error) {
      logger.error('Failed to get user stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private determineInitialVerificationLevel(registrationData: UserRegistrationData): User['verification_level'] {
    if (registrationData.address && registrationData.phone) {
      return 'address';
    } else if (registrationData.phone) {
      return 'phone';
    } else {
      return 'email';
    }
  }

  private sanitizeUser(user: User): Omit<User, 'password_hash' | 'mfa_secret'> {
    const { password_hash, mfa_secret, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}