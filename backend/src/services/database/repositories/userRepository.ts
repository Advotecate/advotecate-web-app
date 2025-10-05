import { DatabaseService } from '../index.js';
import { BaseRepository } from './base.js';
import {
  User,
  CreateUserData,
  UpdateUserData,
  UserFilters,
  UserWithOrganizations
} from '../types.js';

export class UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData, UserFilters> {
  constructor(db?: DatabaseService) {
    super('users', db);
  }

  /**
   * Find a user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a user with their organization memberships
   */
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

  /**
   * Update the last login timestamp for a user
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Count users by role
   */
  async countByRole(role: User['role']): Promise<number> {
    return await this.count({ role } as UserFilters);
  }

  /**
   * Find users by organization ID
   */
  async findByOrganization(organizationId: string): Promise<User[]> {
    const result = await this.query<User>(`
      SELECT u.*
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      WHERE om.organization_id = $1 AND om.status = 'active'
      ORDER BY u.first_name, u.last_name
    `, [organizationId]);

    return result.rows;
  }

  /**
   * Search users by name or email
   */
  async search(searchTerm: string, limit: number = 20): Promise<User[]> {
    const result = await this.query<User>(`
      SELECT * FROM users
      WHERE
        email ILIKE $1 OR
        first_name ILIKE $1 OR
        last_name ILIKE $1 OR
        (first_name || ' ' || last_name) ILIKE $1
      AND status = 'active'
      ORDER BY first_name, last_name
      LIMIT $2
    `, [`%${searchTerm}%`, limit]);

    return result.rows;
  }

  /**
   * Build WHERE clause for filtering users
   */
  protected override buildWhereClause(filters: UserFilters): { whereClause: string; params: any[] } {
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
      // This requires a JOIN, so we'll handle it differently
      const result = this.addAndCondition(
        whereClause,
        params,
        'id IN (SELECT user_id FROM organization_members WHERE organization_id = ? AND status = \'active\')',
        filters.organization_id
      );
      whereClause = result.whereClause;
      params = result.params;
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

  /**
   * Preprocess user data before creation
   */
  protected override preprocessCreateData(data: CreateUserData): Record<string, any> {
    const processed = { ...data } as any;

    // Ensure required fields have defaults
    if (!processed.address_country) {
      processed.address_country = 'US';
    }

    if (!processed.is_verified) {
      processed.is_verified = false;
    }

    if (!processed.verification_level) {
      processed.verification_level = 'none';
    }

    if (!processed.mfa_enabled) {
      processed.mfa_enabled = false;
    }

    if (!processed.role) {
      processed.role = 'donor';
    }

    if (!processed.status) {
      processed.status = 'active';
    }

    return processed;
  }

  /**
   * Preprocess user data before update
   */
  protected override preprocessUpdateData(data: UpdateUserData): Record<string, any> {
    const processed = { ...data } as any;

    // Remove any fields that shouldn't be updated directly
    delete processed.created_at;
    delete processed.email; // Email changes should go through verification

    return processed;
  }
}
