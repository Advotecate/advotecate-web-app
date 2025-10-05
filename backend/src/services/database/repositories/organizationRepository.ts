import { DatabaseService } from '../index.js';
import { BaseRepository } from './base.js';
import {
  Organization,
  OrganizationMember,
  CreateOrganizationData,
  UpdateOrganizationData,
  OrganizationFilters,
  User
} from '../types.js';

export class OrganizationRepository extends BaseRepository<Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationFilters> {
  constructor(db?: DatabaseService) {
    super('organizations', db);
  }

  /**
   * Find an organization by its slug
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE slug = $1 LIMIT 1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find an organization with its members
   */
  async findWithMembers(organizationId: string): Promise<Organization & { members: (OrganizationMember & { user: Pick<User, 'id' | 'email' | 'first_name' | 'last_name'> })[] } | null> {
    const result = await this.query<any>(`
      SELECT
        o.*,
        json_agg(
          json_build_object(
            'id', om.id,
            'role', om.role,
            'status', om.status,
            'joined_at', om.joined_at,
            'user', json_build_object(
              'id', u.id,
              'email', u.email,
              'first_name', u.first_name,
              'last_name', u.last_name
            )
          )
        ) FILTER (WHERE om.id IS NOT NULL) as members
      FROM organizations o
      LEFT JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN users u ON om.user_id = u.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [organizationId]);

    return result.rows[0] || null;
  }

  /**
   * Get organization members with user details
   */
  async getMembers(organizationId: string): Promise<(OrganizationMember & {
    firstName: string;
    lastName: string;
    email: string;
    userId: string;
    joinedAt: string;
  })[]> {
    const result = await this.query<any>(`
      SELECT
        om.id,
        om.user_id as "userId",
        om.role,
        om.status,
        om.joined_at as "joinedAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      WHERE om.organization_id = $1
      ORDER BY om.joined_at DESC
    `, [organizationId]);

    return result.rows;
  }

  /**
   * Get organizations for a specific user
   */
  async getUserOrganizations(userId: string): Promise<(Organization & {
    role: string;
    status: string;
    joinedAt: string;
  })[]> {
    const result = await this.query<any>(`
      SELECT
        o.*,
        om.role,
        om.status as member_status,
        om.joined_at as "joinedAt"
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = $1 AND om.status = 'active'
      ORDER BY o.name
    `, [userId]);

    return result.rows.map(row => ({
      ...row,
      status: row.member_status,
      role: row.role,
      joinedAt: row.joinedAt
    }));
  }

  /**
   * Search organizations by name
   */
  async searchByName(searchTerm: string, limit: number = 10): Promise<Organization[]> {
    const result = await this.query<Organization>(`
      SELECT * FROM organizations
      WHERE name ILIKE $1 AND status = 'active'
      ORDER BY name
      LIMIT $2
    `, [`%${searchTerm}%`, limit]);

    return result.rows;
  }

  /**
   * Find organizations by type
   */
  async findByType(organizationType: Organization['organization_type']): Promise<Organization[]> {
    const result = await this.query<Organization>(`
      SELECT * FROM organizations
      WHERE organization_type = $1 AND status = 'active'
      ORDER BY name
    `, [organizationType]);

    return result.rows;
  }

  /**
   * Check if a slug is available
   */
  async isSlugAvailable(slug: string, excludeOrgId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM organizations WHERE slug = $1';
    const params: any[] = [slug];

    if (excludeOrgId) {
      query += ' AND id != $2';
      params.push(excludeOrgId);
    }

    const result = await this.query<{ count: string }>(query, params);
    return parseInt(result.rows[0]?.count || '0') === 0;
  }

  /**
   * Add a member to an organization
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationMember['role'],
    invitedBy?: string
  ): Promise<OrganizationMember> {
    const result = await this.query<OrganizationMember>(`
      INSERT INTO organization_members (
        organization_id,
        user_id,
        role,
        status,
        invited_by,
        invited_at,
        joined_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [organizationId, userId, role, 'active', invitedBy]);

    return result.rows[0]!;
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationMember['role']
  ): Promise<OrganizationMember> {
    const result = await this.query<OrganizationMember>(`
      UPDATE organization_members
      SET role = $3, updated_at = NOW()
      WHERE organization_id = $1 AND user_id = $2
      RETURNING *
    `, [organizationId, userId, role]);

    if (!result.rows[0]) {
      throw new Error('Member not found');
    }

    return result.rows[0];
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await this.query(`
      DELETE FROM organization_members
      WHERE organization_id = $1 AND user_id = $2
    `, [organizationId, userId]);

    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if user is a member of organization
   */
  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await this.query<{ exists: boolean }>(`
      SELECT EXISTS(
        SELECT 1 FROM organization_members
        WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
      ) as exists
    `, [organizationId, userId]);

    return result.rows[0]?.exists || false;
  }

  /**
   * Get user's role in organization
   */
  async getMemberRole(organizationId: string, userId: string): Promise<string | null> {
    const result = await this.query<{ role: string }>(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
      LIMIT 1
    `, [organizationId, userId]);

    return result.rows[0]?.role || null;
  }

  /**
   * Build WHERE clause for filtering organizations
   */
  protected override buildWhereClause(filters: OrganizationFilters): { whereClause: string; params: any[] } {
    let whereClause = '1=1';
    let params: any[] = [];

    if (filters.organization_type) {
      const result = this.addAndCondition(whereClause, params, 'organization_type = ?', filters.organization_type);
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
   * Preprocess organization data before creation
   */
  protected override preprocessCreateData(data: CreateOrganizationData): Record<string, any> {
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

    if (!processed.status) {
      processed.status = 'active';
    }

    return processed;
  }

  /**
   * Preprocess organization data before update
   */
  protected override preprocessUpdateData(data: UpdateOrganizationData): Record<string, any> {
    const processed = { ...data } as any;

    // Remove any fields that shouldn't be updated directly
    delete processed.created_at;

    return processed;
  }
}
