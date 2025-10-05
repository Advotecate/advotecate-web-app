import { DatabaseService } from '../index.js';
import { BaseRepository } from './base.js';
import {
  Fundraiser,
  CreateFundraiserData,
  UpdateFundraiserData,
  FundraiserFilters,
  FundraiserWithStats,
  Organization,
  Donation
} from '../types.js';

export class FundraiserRepository extends BaseRepository<Fundraiser, CreateFundraiserData, UpdateFundraiserData, FundraiserFilters> {
  constructor(db?: DatabaseService) {
    super('fundraisers', db);
  }

  /**
   * Find a fundraiser by its slug
   */
  async findBySlug(slug: string): Promise<Fundraiser | null> {
    const result = await this.query<Fundraiser>(
      'SELECT * FROM fundraisers WHERE slug = $1 LIMIT 1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a fundraiser with statistics and organization details
   */
  async findWithStats(fundraiserId: string): Promise<FundraiserWithStats | null> {
    const result = await this.query<any>(`
      SELECT
        f.*,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug
        ) as organization,
        (
          SELECT json_agg(recent_donations.*)
          FROM (
            SELECT id, amount, donor_first_name, donor_last_name, created_at
            FROM donations
            WHERE fundraiser_id = f.id AND status = 'succeeded'
            ORDER BY created_at DESC
            LIMIT 10
          ) recent_donations
        ) as recent_donations,
        (
          SELECT json_agg(top_donors.*)
          FROM (
            SELECT
              CONCAT(donor_first_name, ' ', donor_last_name) as donor_name,
              SUM(amount) as total_amount,
              COUNT(*) as donation_count
            FROM donations
            WHERE fundraiser_id = f.id AND status = 'succeeded'
            GROUP BY donor_first_name, donor_last_name
            ORDER BY total_amount DESC
            LIMIT 10
          ) top_donors
        ) as top_donors
      FROM fundraisers f
      INNER JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = $1
    `, [fundraiserId]);

    return result.rows[0] || null;
  }

  /**
   * Get fundraisers by organization
   */
  async findByOrganization(
    organizationId: string,
    status?: Fundraiser['status']
  ): Promise<Fundraiser[]> {
    let query = 'SELECT * FROM fundraisers WHERE organization_id = $1';
    const params: any[] = [organizationId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.query<Fundraiser>(query, params);
    return result.rows;
  }

  /**
   * Get active fundraisers
   */
  async findActive(limit: number = 20, offset: number = 0): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT * FROM fundraisers
      WHERE status = 'active'
        AND (end_date IS NULL OR end_date > NOW())
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return result.rows;
  }

  /**
   * Search fundraisers by title or description
   */
  async search(searchTerm: string, limit: number = 20): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT * FROM fundraisers
      WHERE
        (title ILIKE $1 OR description ILIKE $1)
        AND status = 'active'
        AND visibility = 'public'
      ORDER BY created_at DESC
      LIMIT $2
    `, [`%${searchTerm}%`, limit]);

    return result.rows;
  }

  /**
   * Get fundraiser statistics
   */
  async getStatistics(fundraiserId: string): Promise<{
    totalRaised: number;
    donorCount: number;
    donationCount: number;
    averageDonation: number;
    goalProgress: number;
  } | null> {
    const result = await this.query<any>(`
      SELECT
        f.goal_amount,
        f.current_amount,
        COUNT(DISTINCT d.id) as donation_count,
        COUNT(DISTINCT d.donor_email) as donor_count,
        COALESCE(AVG(d.amount), 0) as average_donation,
        CASE
          WHEN f.goal_amount > 0 THEN (f.current_amount / f.goal_amount * 100)
          ELSE 0
        END as goal_progress
      FROM fundraisers f
      LEFT JOIN donations d ON f.id = d.fundraiser_id AND d.status = 'succeeded'
      WHERE f.id = $1
      GROUP BY f.id, f.goal_amount, f.current_amount
    `, [fundraiserId]);

    const row = result.rows[0];
    if (!row) return null;

    return {
      totalRaised: parseFloat(row.current_amount || '0'),
      donorCount: parseInt(row.donor_count || '0'),
      donationCount: parseInt(row.donation_count || '0'),
      averageDonation: parseFloat(row.average_donation || '0'),
      goalProgress: parseFloat(row.goal_progress || '0')
    };
  }

  /**
   * Update fundraiser totals (called after a donation)
   */
  async updateTotals(fundraiserId: string): Promise<void> {
    await this.query(`
      UPDATE fundraisers
      SET
        current_amount = (
          SELECT COALESCE(SUM(amount), 0)
          FROM donations
          WHERE fundraiser_id = $1 AND status = 'succeeded'
        ),
        donor_count = (
          SELECT COUNT(DISTINCT donor_email)
          FROM donations
          WHERE fundraiser_id = $1 AND status = 'succeeded'
        ),
        donation_count = (
          SELECT COUNT(*)
          FROM donations
          WHERE fundraiser_id = $1 AND status = 'succeeded'
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [fundraiserId]);
  }

  /**
   * Check if a slug is available
   */
  async isSlugAvailable(slug: string, excludeFundraiserId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM fundraisers WHERE slug = $1';
    const params: any[] = [slug];

    if (excludeFundraiserId) {
      query += ' AND id != $2';
      params.push(excludeFundraiserId);
    }

    const result = await this.query<{ count: string }>(query, params);
    return parseInt(result.rows[0]?.count || '0') === 0;
  }

  /**
   * Get featured fundraisers
   */
  async getFeatured(limit: number = 10): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT * FROM fundraisers
      WHERE status = 'active'
        AND visibility = 'public'
        AND (end_date IS NULL OR end_date > NOW())
      ORDER BY current_amount DESC, created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Get trending fundraisers (most donations in last 7 days)
   */
  async getTrending(limit: number = 10): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT f.*, COUNT(d.id) as recent_donation_count
      FROM fundraisers f
      LEFT JOIN donations d ON f.id = d.fundraiser_id
        AND d.created_at > NOW() - INTERVAL '7 days'
        AND d.status = 'succeeded'
      WHERE f.status = 'active'
        AND f.visibility = 'public'
      GROUP BY f.id
      ORDER BY recent_donation_count DESC, f.created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Build WHERE clause for filtering fundraisers
   */
  protected override buildWhereClause(filters: FundraiserFilters): { whereClause: string; params: any[] } {
    let whereClause = '1=1';
    let params: any[] = [];

    if (filters.organization_id) {
      const result = this.addAndCondition(whereClause, params, 'organization_id = ?', filters.organization_id);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.status) {
      const result = this.addAndCondition(whereClause, params, 'status = ?', filters.status);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.visibility) {
      const result = this.addAndCondition(whereClause, params, 'visibility = ?', filters.visibility);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.category) {
      const result = this.addAndCondition(whereClause, params, 'category = ?', filters.category);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.election_type) {
      const result = this.addAndCondition(whereClause, params, 'election_type = ?', filters.election_type);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.tags && filters.tags.length > 0) {
      const result = this.addAndCondition(whereClause, params, 'tags && ?', filters.tags);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.goal_min !== undefined || filters.goal_max !== undefined) {
      const result = this.addNumericRangeCondition(
        whereClause,
        params,
        'goal_amount',
        filters.goal_min,
        filters.goal_max
      );
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.current_min !== undefined || filters.current_max !== undefined) {
      const result = this.addNumericRangeCondition(
        whereClause,
        params,
        'current_amount',
        filters.current_min,
        filters.current_max
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
   * Preprocess fundraiser data before creation
   */
  protected override preprocessCreateData(data: CreateFundraiserData): Record<string, any> {
    const processed = { ...data } as any;

    // Ensure required fields have defaults
    if (!processed.current_amount) {
      processed.current_amount = 0;
    }

    if (!processed.donor_count) {
      processed.donor_count = 0;
    }

    if (!processed.visibility) {
      processed.visibility = 'public';
    }

    if (!processed.status) {
      processed.status = 'draft';
    }

    if (!processed.currency) {
      processed.currency = 'USD';
    }

    return processed;
  }

  /**
   * Preprocess fundraiser data before update
   */
  protected override preprocessUpdateData(data: UpdateFundraiserData): Record<string, any> {
    const processed = { ...data } as any;

    // Remove any fields that shouldn't be updated directly
    delete processed.created_at;
    delete processed.organization_id;
    delete processed.created_by;

    return processed;
  }
}
