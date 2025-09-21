import { DatabaseService } from '../database/index.js';
import { BaseRepository } from '../database/repositories/base.js';
import {
  Organization,
  OrganizationMember,
  CreateOrganizationData,
  UpdateOrganizationData,
  OrganizationFilters,
  PaginationOptions,
  PaginatedResult,
  User
} from '../database/types.js';
import { logger } from '../../middleware/logging.js';

class OrganizationRepository extends BaseRepository<Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationFilters> {
  constructor(db?: DatabaseService) {
    super('organizations', db);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      'SELECT * FROM organizations WHERE slug = $1 LIMIT 1',
      [slug]
    );
    return result.rows[0] || null;
  }

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

  async searchByName(searchTerm: string, limit: number = 10): Promise<Organization[]> {
    const result = await this.query<Organization>(`
      SELECT * FROM organizations
      WHERE name ILIKE $1 AND status = 'active'
      ORDER BY name
      LIMIT $2
    `, [`%${searchTerm}%`, limit]);

    return result.rows;
  }

  protected buildWhereClause(filters: OrganizationFilters): { whereClause: string; params: any[] } {
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
}

class OrganizationMemberRepository extends BaseRepository<OrganizationMember, any, any, any> {
  constructor(db?: DatabaseService) {
    super('organization_members', db);
  }

  async findByUserAndOrganization(userId: string, organizationId: string): Promise<OrganizationMember | null> {
    const result = await this.query<OrganizationMember>(
      'SELECT * FROM organization_members WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
      [userId, organizationId]
    );
    return result.rows[0] || null;
  }

  async findByOrganization(organizationId: string): Promise<(OrganizationMember & { user: Pick<User, 'id' | 'email' | 'first_name' | 'last_name'> })[]> {
    const result = await this.query<any>(`
      SELECT
        om.*,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'first_name', u.first_name,
          'last_name', u.last_name
        ) as user
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE om.organization_id = $1
      ORDER BY om.created_at
    `, [organizationId]);

    return result.rows;
  }

  async findByUser(userId: string): Promise<(OrganizationMember & { organization: Pick<Organization, 'id' | 'name' | 'slug'> })[]> {
    const result = await this.query<any>(`
      SELECT
        om.*,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug
        ) as organization
      FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      WHERE om.user_id = $1 AND om.status = 'active'
      ORDER BY om.created_at DESC
    `, [userId]);

    return result.rows;
  }

  protected buildWhereClause(filters: any): { whereClause: string; params: any[] } {
    return { whereClause: '1=1', params: [] };
  }
}

export interface OrganizationRegistrationData {
  name: string;
  organization_type: Organization['organization_type'];
  description?: string;
  tax_id?: string;
  registration_number?: string;
  website_url?: string;
  contact_email: string;
  contact_phone?: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
  treasurer_name?: string;
  treasurer_email?: string;
  treasurer_phone?: string;
  bank_account_info?: any;
  compliance_settings?: any;
}

export interface OrganizationMemberInvite {
  email: string;
  role: OrganizationMember['role'];
  permissions?: any;
  invited_by: string;
}

export interface OrganizationStats {
  total_members: number;
  active_fundraisers: number;
  total_donations_received: number;
  total_amount_raised: number;
  compliance_score: number;
  verification_status: string;
}

export class OrganizationService {
  private organizationRepository: OrganizationRepository;
  private memberRepository: OrganizationMemberRepository;

  constructor(db?: DatabaseService) {
    this.organizationRepository = new OrganizationRepository(db);
    this.memberRepository = new OrganizationMemberRepository(db);
  }

  async createOrganization(
    organizationData: OrganizationRegistrationData,
    createdByUserId: string
  ): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    try {
      logger.info('Creating organization', {
        name: organizationData.name,
        type: organizationData.organization_type,
        created_by: createdByUserId
      });

      // Generate unique slug
      const slug = await this.generateUniqueSlug(organizationData.name);

      // Create organization data
      const createData: CreateOrganizationData = {
        ...organizationData,
        slug,
        address_country: organizationData.address_country || 'US',
        is_verified: false,
        verification_level: 'none',
        status: 'pending_verification'
      };

      // Create organization
      const organization = await this.organizationRepository.create(createData);

      // Add creator as admin
      await this.memberRepository.create({
        organization_id: organization.id,
        user_id: createdByUserId,
        role: 'admin',
        status: 'active',
        joined_at: new Date().toISOString()
      });

      logger.info('Organization created successfully', {
        organization_id: organization.id,
        name: organization.name,
        slug: organization.slug
      });

      return {
        success: true,
        organization
      };

    } catch (error) {
      logger.error('Failed to create organization', {
        name: organizationData.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to create organization'
      };
    }
  }

  async getOrganizationById(organizationId: string, includeMembers: boolean = false): Promise<Organization | null> {
    try {
      if (includeMembers) {
        return await this.organizationRepository.findWithMembers(organizationId);
      } else {
        return await this.organizationRepository.findById(organizationId);
      }
    } catch (error) {
      logger.error('Failed to get organization by ID', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    try {
      return await this.organizationRepository.findBySlug(slug);
    } catch (error) {
      logger.error('Failed to get organization by slug', {
        slug,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async updateOrganization(
    organizationId: string,
    updateData: Partial<OrganizationRegistrationData>
  ): Promise<Organization | null> {
    try {
      logger.info('Updating organization', {
        organization_id: organizationId,
        fields_updated: Object.keys(updateData)
      });

      const updatedOrganization = await this.organizationRepository.update(organizationId, updateData);

      logger.info('Organization updated successfully', {
        organization_id: organizationId
      });

      return updatedOrganization;

    } catch (error) {
      logger.error('Failed to update organization', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getOrganizations(filters?: OrganizationFilters, pagination?: PaginationOptions): Promise<PaginatedResult<Organization>> {
    try {
      return await this.organizationRepository.findMany(filters, pagination);
    } catch (error) {
      logger.error('Failed to get organizations', {
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

  async searchOrganizations(searchTerm: string, limit: number = 10): Promise<Organization[]> {
    try {
      return await this.organizationRepository.searchByName(searchTerm, limit);
    } catch (error) {
      logger.error('Failed to search organizations', {
        search_term: searchTerm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async addMember(
    organizationId: string,
    memberData: OrganizationMemberInvite
  ): Promise<{ success: boolean; member?: OrganizationMember; error?: string }> {
    try {
      logger.info('Adding organization member', {
        organization_id: organizationId,
        email: memberData.email,
        role: memberData.role
      });

      // TODO: Check if user exists, send invitation email if not
      // For now, assume user exists and get user ID by email
      const user = await this.getUserByEmail(memberData.email);
      if (!user) {
        return {
          success: false,
          error: 'User not found. User must have an account before being added to organization.'
        };
      }

      // Check if user is already a member
      const existingMember = await this.memberRepository.findByUserAndOrganization(user.id, organizationId);
      if (existingMember) {
        return {
          success: false,
          error: 'User is already a member of this organization'
        };
      }

      // Create membership
      const member = await this.memberRepository.create({
        organization_id: organizationId,
        user_id: user.id,
        role: memberData.role,
        permissions: memberData.permissions,
        status: 'active',
        invited_by: memberData.invited_by,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString()
      });

      logger.info('Organization member added successfully', {
        organization_id: organizationId,
        member_id: member.id,
        user_id: user.id
      });

      return {
        success: true,
        member
      };

    } catch (error) {
      logger.error('Failed to add organization member', {
        organization_id: organizationId,
        email: memberData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to add member to organization'
      };
    }
  }

  async getOrganizationMembers(organizationId: string): Promise<(OrganizationMember & { user: Pick<User, 'id' | 'email' | 'first_name' | 'last_name'> })[]> {
    try {
      return await this.memberRepository.findByOrganization(organizationId);
    } catch (error) {
      logger.error('Failed to get organization members', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async getUserOrganizations(userId: string): Promise<(OrganizationMember & { organization: Pick<Organization, 'id' | 'name' | 'slug'> })[]> {
    try {
      return await this.memberRepository.findByUser(userId);
    } catch (error) {
      logger.error('Failed to get user organizations', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    newRole: OrganizationMember['role'],
    permissions?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Updating member role', {
        organization_id: organizationId,
        user_id: userId,
        new_role: newRole
      });

      const member = await this.memberRepository.findByUserAndOrganization(userId, organizationId);
      if (!member) {
        return {
          success: false,
          error: 'Member not found'
        };
      }

      await this.memberRepository.update(member.id, {
        role: newRole,
        permissions
      });

      logger.info('Member role updated successfully', {
        organization_id: organizationId,
        user_id: userId,
        new_role: newRole
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to update member role', {
        organization_id: organizationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to update member role'
      };
    }
  }

  async removeMember(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Removing organization member', {
        organization_id: organizationId,
        user_id: userId
      });

      const member = await this.memberRepository.findByUserAndOrganization(userId, organizationId);
      if (!member) {
        return {
          success: false,
          error: 'Member not found'
        };
      }

      // Check if this is the last admin
      const members = await this.memberRepository.findByOrganization(organizationId);
      const adminCount = members.filter(m => m.role === 'admin' && m.status === 'active').length;

      if (member.role === 'admin' && adminCount <= 1) {
        return {
          success: false,
          error: 'Cannot remove the last admin from the organization'
        };
      }

      const deleted = await this.memberRepository.delete(member.id);

      logger.info('Organization member removed successfully', {
        organization_id: organizationId,
        user_id: userId,
        deleted
      });

      return { success: deleted };

    } catch (error) {
      logger.error('Failed to remove organization member', {
        organization_id: organizationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to remove member from organization'
      };
    }
  }

  async getOrganizationStats(organizationId: string): Promise<OrganizationStats | null> {
    try {
      logger.info('Getting organization stats', { organization_id: organizationId });

      // Get basic member count
      const members = await this.memberRepository.findByOrganization(organizationId);
      const totalMembers = members.filter(m => m.status === 'active').length;

      // TODO: Implement other stats queries
      // - Active fundraisers count
      // - Total donations received
      // - Total amount raised
      // - Compliance score calculation

      return {
        total_members: totalMembers,
        active_fundraisers: 0, // TODO: Implement
        total_donations_received: 0, // TODO: Implement
        total_amount_raised: 0, // TODO: Implement
        compliance_score: 0, // TODO: Implement
        verification_status: 'pending' // TODO: Get from organization
      };

    } catch (error) {
      logger.error('Failed to get organization stats', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async verifyOrganization(
    organizationId: string,
    verificationLevel: Organization['verification_level'],
    verifiedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Verifying organization', {
        organization_id: organizationId,
        verification_level: verificationLevel,
        verified_by: verifiedBy
      });

      const updatedOrg = await this.organizationRepository.update(organizationId, {
        is_verified: true,
        verification_level: verificationLevel,
        status: 'active'
      });

      // TODO: Send verification confirmation email
      // TODO: Create audit log entry

      logger.info('Organization verified successfully', {
        organization_id: organizationId,
        verification_level: verificationLevel
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to verify organization', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to verify organization'
      };
    }
  }

  async suspendOrganization(
    organizationId: string,
    reason: string,
    suspendedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Suspending organization', {
        organization_id: organizationId,
        reason,
        suspended_by: suspendedBy
      });

      await this.organizationRepository.update(organizationId, {
        status: 'suspended'
      });

      // TODO: Send suspension notification email
      // TODO: Create audit log entry
      // TODO: Pause all active fundraisers

      logger.info('Organization suspended successfully', {
        organization_id: organizationId
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to suspend organization', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to suspend organization'
      };
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.organizationRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async getUserByEmail(email: string): Promise<{ id: string } | null> {
    // TODO: This should use UserService or UserRepository
    // For now, return null to indicate user lookup is needed
    return null;
  }
}