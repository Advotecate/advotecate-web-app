import { DatabaseService } from '../index.js';
import { BaseRepository } from './base.js';
import {
  Donation,
  CreateDonationData,
  UpdateDonationData,
  DonationFilters,
  DonationWithDetails,
  Organization,
  Fundraiser,
  User
} from '../types.js';

export class DonationRepository extends BaseRepository<Donation, CreateDonationData, UpdateDonationData, DonationFilters> {
  constructor(db?: DatabaseService) {
    super('donations', db);
  }

  /**
   * Find a donation with full details (organization, fundraiser, donor)
   */
  async findWithDetails(donationId: string): Promise<DonationWithDetails | null> {
    const result = await this.query<any>(`
      SELECT
        d.*,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug
        ) as organization,
        CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'slug', f.slug
          )
          ELSE NULL
        END as fundraiser,
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'id', u.id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'email', u.email
          )
          ELSE NULL
        END as donor
      FROM donations d
      INNER JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN fundraisers f ON d.fundraiser_id = f.id
      LEFT JOIN users u ON d.donor_user_id = u.id
      WHERE d.id = $1
    `, [donationId]);

    return result.rows[0] || null;
  }

  /**
   * Get donations by fundraiser
   */
  async findByFundraiser(
    fundraiserId: string,
    status?: Donation['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<Donation[]> {
    let query = 'SELECT * FROM donations WHERE fundraiser_id = $1';
    const params: any[] = [fundraiserId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await this.query<Donation>(query, params);
    return result.rows;
  }

  /**
   * Get donations by organization
   */
  async findByOrganization(
    organizationId: string,
    status?: Donation['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<Donation[]> {
    let query = 'SELECT * FROM donations WHERE organization_id = $1';
    const params: any[] = [organizationId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await this.query<Donation>(query, params);
    return result.rows;
  }

  /**
   * Get donations by donor (user)
   */
  async findByDonor(
    donorUserId: string,
    status?: Donation['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<Donation[]> {
    let query = 'SELECT * FROM donations WHERE donor_user_id = $1';
    const params: any[] = [donorUserId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await this.query<Donation>(query, params);
    return result.rows;
  }

  /**
   * Get donations by email (for guest donors)
   */
  async findByEmail(
    email: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Donation[]> {
    const result = await this.query<Donation>(`
      SELECT * FROM donations
      WHERE donor_email = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [email, limit, offset]);

    return result.rows;
  }

  /**
   * Get recurring donations
   */
  async findRecurring(
    organizationId?: string,
    status?: 'active' | 'paused' | 'cancelled'
  ): Promise<Donation[]> {
    let query = `
      SELECT * FROM donations
      WHERE is_recurring = true
        AND parent_recurring_donation_id IS NULL
    `;
    const params: any[] = [];

    if (organizationId) {
      params.push(organizationId);
      query += ` AND organization_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.query<Donation>(query, params);
    return result.rows;
  }

  /**
   * Get child donations for a recurring donation
   */
  async findRecurringChildren(parentDonationId: string): Promise<Donation[]> {
    const result = await this.query<Donation>(`
      SELECT * FROM donations
      WHERE parent_recurring_donation_id = $1
      ORDER BY created_at DESC
    `, [parentDonationId]);

    return result.rows;
  }

  /**
   * Get donation statistics for a fundraiser
   */
  async getFundraiserStats(fundraiserId: string): Promise<{
    totalAmount: number;
    donationCount: number;
    uniqueDonors: number;
    averageDonation: number;
  }> {
    const result = await this.query<any>(`
      SELECT
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as donation_count,
        COUNT(DISTINCT donor_email) as unique_donors,
        COALESCE(AVG(amount), 0) as average_donation
      FROM donations
      WHERE fundraiser_id = $1 AND status = 'succeeded'
    `, [fundraiserId]);

    const row = result.rows[0];
    return {
      totalAmount: parseFloat(row?.total_amount || '0'),
      donationCount: parseInt(row?.donation_count || '0'),
      uniqueDonors: parseInt(row?.unique_donors || '0'),
      averageDonation: parseFloat(row?.average_donation || '0')
    };
  }

  /**
   * Get donation statistics for an organization
   */
  async getOrganizationStats(organizationId: string, startDate?: string, endDate?: string): Promise<{
    totalAmount: number;
    donationCount: number;
    uniqueDonors: number;
    averageDonation: number;
  }> {
    let query = `
      SELECT
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as donation_count,
        COUNT(DISTINCT donor_email) as unique_donors,
        COALESCE(AVG(amount), 0) as average_donation
      FROM donations
      WHERE organization_id = $1 AND status = 'succeeded'
    `;
    const params: any[] = [organizationId];

    if (startDate) {
      params.push(startDate);
      query += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND created_at <= $${params.length}`;
    }

    const result = await this.query<any>(query, params);

    const row = result.rows[0];
    return {
      totalAmount: parseFloat(row?.total_amount || '0'),
      donationCount: parseInt(row?.donation_count || '0'),
      uniqueDonors: parseInt(row?.unique_donors || '0'),
      averageDonation: parseFloat(row?.average_donation || '0')
    };
  }

  /**
   * Get top donors for a fundraiser
   */
  async getTopDonors(fundraiserId: string, limit: number = 10): Promise<Array<{
    donorName: string;
    donorEmail: string;
    totalAmount: number;
    donationCount: number;
  }>> {
    const result = await this.query<any>(`
      SELECT
        CONCAT(donor_first_name, ' ', donor_last_name) as donor_name,
        donor_email,
        SUM(amount) as total_amount,
        COUNT(*) as donation_count
      FROM donations
      WHERE fundraiser_id = $1 AND status = 'succeeded' AND is_anonymous = false
      GROUP BY donor_first_name, donor_last_name, donor_email
      ORDER BY total_amount DESC
      LIMIT $2
    `, [fundraiserId, limit]);

    return result.rows.map(row => ({
      donorName: row.donor_name,
      donorEmail: row.donor_email,
      totalAmount: parseFloat(row.total_amount || '0'),
      donationCount: parseInt(row.donation_count || '0')
    }));
  }

  /**
   * Get recent donations for a fundraiser
   */
  async getRecentDonations(fundraiserId: string, limit: number = 10): Promise<Donation[]> {
    const result = await this.query<Donation>(`
      SELECT * FROM donations
      WHERE fundraiser_id = $1
        AND status = 'succeeded'
        AND is_anonymous = false
      ORDER BY created_at DESC
      LIMIT $2
    `, [fundraiserId, limit]);

    return result.rows;
  }

  /**
   * Get donations requiring compliance review
   */
  async findRequiringReview(organizationId?: string): Promise<Donation[]> {
    let query = `
      SELECT * FROM donations
      WHERE compliance_status = 'requires_review'
    `;
    const params: any[] = [];

    if (organizationId) {
      params.push(organizationId);
      query += ` AND organization_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.query<Donation>(query, params);
    return result.rows;
  }

  /**
   * Update donation compliance status
   */
  async updateComplianceStatus(
    donationId: string,
    status: Donation['compliance_status'],
    notes?: string
  ): Promise<Donation> {
    const result = await this.query<Donation>(`
      UPDATE donations
      SET
        compliance_status = $2,
        compliance_notes = COALESCE($3, compliance_notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [donationId, status, notes]);

    if (!result.rows[0]) {
      throw new Error('Donation not found');
    }

    return result.rows[0];
  }

  /**
   * Build WHERE clause for filtering donations
   */
  protected override buildWhereClause(filters: DonationFilters): { whereClause: string; params: any[] } {
    let whereClause = '1=1';
    let params: any[] = [];

    if (filters.organization_id) {
      const result = this.addAndCondition(whereClause, params, 'organization_id = ?', filters.organization_id);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.fundraiser_id) {
      const result = this.addAndCondition(whereClause, params, 'fundraiser_id = ?', filters.fundraiser_id);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.donor_user_id) {
      const result = this.addAndCondition(whereClause, params, 'donor_user_id = ?', filters.donor_user_id);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.donor_email) {
      const result = this.addLikeCondition(whereClause, params, 'donor_email', filters.donor_email);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.status) {
      const result = this.addAndCondition(whereClause, params, 'status = ?', filters.status);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.compliance_status) {
      const result = this.addAndCondition(whereClause, params, 'compliance_status = ?', filters.compliance_status);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.is_recurring !== undefined) {
      const result = this.addAndCondition(whereClause, params, 'is_recurring = ?', filters.is_recurring);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.is_anonymous !== undefined) {
      const result = this.addAndCondition(whereClause, params, 'is_anonymous = ?', filters.is_anonymous);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.fec_reportable !== undefined) {
      const result = this.addAndCondition(whereClause, params, 'fec_reportable = ?', filters.fec_reportable);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.payment_method_type) {
      const result = this.addAndCondition(whereClause, params, 'payment_method_type = ?', filters.payment_method_type);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.amount_min !== undefined || filters.amount_max !== undefined) {
      const result = this.addNumericRangeCondition(
        whereClause,
        params,
        'amount',
        filters.amount_min,
        filters.amount_max
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

    if (filters.processed_after || filters.processed_before) {
      const result = this.addDateRangeCondition(
        whereClause,
        params,
        'processed_at',
        filters.processed_after,
        filters.processed_before
      );
      whereClause = result.whereClause;
      params = result.params;
    }

    return { whereClause, params };
  }

  /**
   * Preprocess donation data before creation
   */
  protected override preprocessCreateData(data: CreateDonationData): Record<string, any> {
    const processed = { ...data } as any;

    // Ensure required fields have defaults
    if (!processed.currency) {
      processed.currency = 'USD';
    }

    if (!processed.status) {
      processed.status = 'pending';
    }

    if (!processed.compliance_status) {
      processed.compliance_status = 'compliant';
    }

    if (processed.is_recurring === undefined) {
      processed.is_recurring = false;
    }

    if (processed.is_anonymous === undefined) {
      processed.is_anonymous = false;
    }

    if (processed.fec_reportable === undefined) {
      processed.fec_reportable = false;
    }

    // Calculate fees and net amount if not provided
    if (!processed.fees_amount) {
      processed.fees_amount = 0;
    }

    if (!processed.net_amount) {
      processed.net_amount = processed.amount - processed.fees_amount;
    }

    return processed;
  }

  /**
   * Preprocess donation data before update
   */
  protected override preprocessUpdateData(data: UpdateDonationData): Record<string, any> {
    const processed = { ...data } as any;

    // Remove any fields that shouldn't be updated directly
    delete processed.created_at;
    delete processed.organization_id;

    return processed;
  }
}
