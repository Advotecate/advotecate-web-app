import { DatabaseService } from '../database/index.js';
import { BaseRepository } from '../database/repositories/base.js';
import {
  Fundraiser,
  Donation,
  CreateFundraiserData,
  UpdateFundraiserData,
  FundraiserFilters,
  CreateDonationData,
  PaginationOptions,
  PaginatedResult,
  FundraiserWithStats,
  DonationWithDetails,
  Organization
} from '../database/types.js';
import { FluidPayServiceFactory, DonationService, CreateDonationRequest, DonationResult } from '../fluidpay/index.js';
import { logger } from '../../middleware/logging.js';

class FundraiserRepository extends BaseRepository<Fundraiser, CreateFundraiserData, UpdateFundraiserData, FundraiserFilters> {
  constructor(db?: DatabaseService) {
    super('fundraisers', db);
  }

  async findBySlug(slug: string): Promise<Fundraiser | null> {
    const result = await this.query<Fundraiser>(
      'SELECT * FROM fundraisers WHERE slug = $1 LIMIT 1',
      [slug]
    );
    return result.rows[0] || null;
  }

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
          SELECT json_agg(
            json_build_object(
              'id', d.id,
              'amount', d.amount,
              'donor_first_name', d.donor_first_name,
              'donor_last_name', d.donor_last_name,
              'created_at', d.created_at
            )
          )
          FROM donations d
          WHERE d.fundraiser_id = f.id AND d.status = 'succeeded'
          ORDER BY d.created_at DESC
          LIMIT 5
        ) as recent_donations,
        (
          SELECT json_agg(
            json_build_object(
              'donor_name', CASE WHEN d.is_anonymous THEN 'Anonymous' ELSE d.donor_first_name || ' ' || d.donor_last_name END,
              'total_amount', SUM(d.amount),
              'donation_count', COUNT(d.id)
            )
          )
          FROM donations d
          WHERE d.fundraiser_id = f.id AND d.status = 'succeeded'
          GROUP BY d.donor_email, d.is_anonymous, d.donor_first_name, d.donor_last_name
          ORDER BY SUM(d.amount) DESC
          LIMIT 10
        ) as top_donors
      FROM fundraisers f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = $1
    `, [fundraiserId]);

    return result.rows[0] || null;
  }

  async findPublicFundraisers(limit: number = 20, offset: number = 0): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT f.*, o.name as organization_name, o.slug as organization_slug
      FROM fundraisers f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.visibility = 'public' AND f.status = 'active'
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return result.rows;
  }

  async findFeaturedFundraisers(limit: number = 10): Promise<Fundraiser[]> {
    const result = await this.query<Fundraiser>(`
      SELECT f.*, o.name as organization_name, o.slug as organization_slug
      FROM fundraisers f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.visibility = 'public' AND f.status = 'active'
      ORDER BY f.current_amount DESC, f.donor_count DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  async updateStats(fundraiserId: string): Promise<void> {
    await this.query(`
      UPDATE fundraisers
      SET
        current_amount = COALESCE((
          SELECT SUM(amount) FROM donations
          WHERE fundraiser_id = $1 AND status = 'succeeded'
        ), 0),
        donor_count = COALESCE((
          SELECT COUNT(DISTINCT donor_email) FROM donations
          WHERE fundraiser_id = $1 AND status = 'succeeded'
        ), 0),
        updated_at = NOW()
      WHERE id = $1
    `, [fundraiserId]);
  }

  protected buildWhereClause(filters: FundraiserFilters): { whereClause: string; params: any[] } {
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

    if (filters.tags && filters.tags.length > 0) {
      const result = this.addAndCondition(whereClause, params, 'tags && ?', filters.tags);
      whereClause = result.whereClause;
      params = result.params;
    }

    if (filters.election_type) {
      const result = this.addAndCondition(whereClause, params, 'election_type = ?', filters.election_type);
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

    return { whereClause, params };
  }
}

class DonationRepository extends BaseRepository<Donation, CreateDonationData, any, any> {
  constructor(db?: DatabaseService) {
    super('donations', db);
  }

  async findByFundraiser(
    fundraiserId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<DonationWithDetails>> {
    const page = pagination?.page || 1;
    const perPage = Math.min(pagination?.per_page || 20, 100);
    const offset = (page - 1) * perPage;

    // Get total count
    const totalResult = await this.query<{count: string}>(
      'SELECT COUNT(*) as count FROM donations WHERE fundraiser_id = $1',
      [fundraiserId]
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    // Get donations with details
    const result = await this.query<any>(`
      SELECT
        d.*,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug
        ) as organization,
        json_build_object(
          'id', f.id,
          'title', f.title,
          'slug', f.slug
        ) as fundraiser
      FROM donations d
      JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN fundraisers f ON d.fundraiser_id = f.id
      WHERE d.fundraiser_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [fundraiserId, perPage, offset]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: result.rows,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  async findByOrganization(organizationId: string, pagination?: PaginationOptions): Promise<PaginatedResult<DonationWithDetails>> {
    // Similar implementation to findByFundraiser but for organization
    // TODO: Implement similar to findByFundraiser
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

  protected buildWhereClause(filters: any): { whereClause: string; params: any[] } {
    return { whereClause: '1=1', params: [] };
  }
}

export interface FundraiserCreationData {
  title: string;
  description?: string;
  story?: string;
  goal_amount?: number;
  category?: string;
  tags?: string[];
  featured_image_url?: string;
  gallery_images?: string[];
  video_url?: string;
  start_date?: string;
  end_date?: string;
  election_date?: string;
  election_type?: Fundraiser['election_type'];
  visibility: Fundraiser['visibility'];
  custom_fields?: any;
}

export interface DonationCreationData {
  amount: number;
  donor_info: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
    employer?: string;
    occupation?: string;
  };
  payment_method: {
    type: 'card' | 'bank_account';
    card?: {
      number: string;
      exp_month: string;
      exp_year: string;
      cvc: string;
      name: string;
    };
    bank_account?: {
      routing_number: string;
      account_number: string;
      account_type: 'checking' | 'savings';
      account_holder_name: string;
    };
  };
  is_recurring?: boolean;
  recurring_interval?: 'monthly' | 'quarterly' | 'yearly';
  is_anonymous?: boolean;
  dedication?: string;
  dedication_type?: 'in_memory' | 'in_honor' | 'general';
}

export class FundraiserService {
  private fundraiserRepository: FundraiserRepository;
  private donationRepository: DonationRepository;
  private donationService?: DonationService;

  constructor(
    fundraiserRepository: FundraiserRepository,
    donationRepository: DonationRepository
  ) {
    this.fundraiserRepository = fundraiserRepository;
    this.donationRepository = donationRepository;

    // Initialize FluidPay donation service
    try {
      const factory = FluidPayServiceFactory.getInstance();
      if (factory.isInitialized()) {
        this.donationService = factory.getDonationService();
      } else {
        logger.warn('FluidPay services not initialized - donation processing will be unavailable');
        this.donationService = null;
      }
    } catch (error) {
      logger.warn('Failed to get FluidPay donation service', { error });
      this.donationService = null;
    }
  }

  async createFundraiser(
    organizationId: string,
    fundraiserData: FundraiserCreationData,
    createdBy: string
  ): Promise<{ success: boolean; fundraiser?: Fundraiser; error?: string }> {
    try {
      logger.info('Creating fundraiser', {
        organization_id: organizationId,
        title: fundraiserData.title,
        created_by: createdBy
      });

      // Generate unique slug
      const slug = await this.generateUniqueSlug(fundraiserData.title);

      // Create fundraiser data
      const createData: CreateFundraiserData = {
        organization_id: organizationId,
        title: fundraiserData.title,
        slug,
        description: fundraiserData.description,
        story: fundraiserData.story,
        goal_amount: fundraiserData.goal_amount,
        current_amount: 0,
        donor_count: 0,
        category: fundraiserData.category,
        tags: fundraiserData.tags,
        featured_image_url: fundraiserData.featured_image_url,
        gallery_images: fundraiserData.gallery_images,
        video_url: fundraiserData.video_url,
        start_date: fundraiserData.start_date,
        end_date: fundraiserData.end_date,
        election_date: fundraiserData.election_date,
        election_type: fundraiserData.election_type,
        visibility: fundraiserData.visibility,
        status: 'draft',
        custom_fields: fundraiserData.custom_fields,
        created_by: createdBy
      };

      // Create fundraiser
      const fundraiser = await this.fundraiserRepository.create(createData);

      logger.info('Fundraiser created successfully', {
        fundraiser_id: fundraiser.id,
        title: fundraiser.title,
        slug: fundraiser.slug
      });

      return {
        success: true,
        fundraiser
      };

    } catch (error) {
      logger.error('Failed to create fundraiser', {
        organization_id: organizationId,
        title: fundraiserData.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to create fundraiser'
      };
    }
  }

  async getFundraiserById(fundraiserId: string, includeStats: boolean = false): Promise<Fundraiser | FundraiserWithStats | null> {
    try {
      if (includeStats) {
        return await this.fundraiserRepository.findWithStats(fundraiserId);
      } else {
        return await this.fundraiserRepository.findById(fundraiserId);
      }
    } catch (error) {
      logger.error('Failed to get fundraiser by ID', {
        fundraiser_id: fundraiserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getFundraiserBySlug(slug: string): Promise<Fundraiser | null> {
    try {
      return await this.fundraiserRepository.findBySlug(slug);
    } catch (error) {
      logger.error('Failed to get fundraiser by slug', {
        slug,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async updateFundraiser(
    fundraiserId: string,
    updateData: Partial<FundraiserCreationData>
  ): Promise<Fundraiser | null> {
    try {
      logger.info('Updating fundraiser', {
        fundraiser_id: fundraiserId,
        fields_updated: Object.keys(updateData)
      });

      const updatedFundraiser = await this.fundraiserRepository.update(fundraiserId, updateData);

      logger.info('Fundraiser updated successfully', {
        fundraiser_id: fundraiserId
      });

      return updatedFundraiser;

    } catch (error) {
      logger.error('Failed to update fundraiser', {
        fundraiser_id: fundraiserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async activateFundraiser(fundraiserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Activating fundraiser', { fundraiser_id: fundraiserId });

      await this.fundraiserRepository.update(fundraiserId, {
        status: 'active'
      });

      logger.info('Fundraiser activated successfully', { fundraiser_id: fundraiserId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to activate fundraiser', {
        fundraiser_id: fundraiserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to activate fundraiser'
      };
    }
  }

  async pauseFundraiser(fundraiserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Pausing fundraiser', { fundraiser_id: fundraiserId });

      await this.fundraiserRepository.update(fundraiserId, {
        status: 'paused'
      });

      logger.info('Fundraiser paused successfully', { fundraiser_id: fundraiserId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to pause fundraiser', {
        fundraiser_id: fundraiserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to pause fundraiser'
      };
    }
  }

  async completeFundraiser(fundraiserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Completing fundraiser', { fundraiser_id: fundraiserId });

      await this.fundraiserRepository.update(fundraiserId, {
        status: 'completed'
      });

      logger.info('Fundraiser completed successfully', { fundraiser_id: fundraiserId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to complete fundraiser', {
        fundraiser_id: fundraiserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to complete fundraiser'
      };
    }
  }

  async processDonation(
    fundraiserId: string,
    donationData: DonationCreationData
  ): Promise<{ success: boolean; donation_result?: DonationResult; error?: string }> {
    try {
      logger.info('Processing donation to fundraiser', {
        fundraiser_id: fundraiserId,
        amount: donationData.amount,
        donor_email: donationData.donor_info.email
      });

      // Get fundraiser and organization info
      const fundraiser = await this.fundraiserRepository.findById(fundraiserId);
      if (!fundraiser) {
        return {
          success: false,
          error: 'Fundraiser not found'
        };
      }

      if (fundraiser.status !== 'active') {
        return {
          success: false,
          error: 'Fundraiser is not active'
        };
      }

      // Check if donation service is available
      if (!this.donationService) {
        return {
          success: false,
          error: 'Payment processing not available'
        };
      }

      // Create FluidPay donation request
      const fluidPayRequest: CreateDonationRequest = {
        amount: donationData.amount,
        currency: 'USD',
        fundraiser_id: fundraiserId,
        donor_info: {
          email: donationData.donor_info.email,
          first_name: donationData.donor_info.first_name,
          last_name: donationData.donor_info.last_name,
          phone: donationData.donor_info.phone,
          address: donationData.donor_info.address
        },
        payment_method: donationData.payment_method,
        is_recurring: donationData.is_recurring,
        recurring_interval: donationData.recurring_interval,
        is_anonymous: donationData.is_anonymous,
        metadata: {
          fundraiser_id: fundraiserId,
          organization_id: fundraiser.organization_id,
          dedication: donationData.dedication,
          dedication_type: donationData.dedication_type
        }
      };

      // Process donation with FluidPay
      const donationResult = await this.donationService.processDonation(fluidPayRequest);

      // Create donation record in database
      if (donationResult.success) {
        await this.createDonationRecord(fundraiser, donationResult, donationData);

        // Update fundraiser stats
        await this.fundraiserRepository.updateStats(fundraiserId);
      }

      logger.info('Donation processing completed', {
        fundraiser_id: fundraiserId,
        donation_id: donationResult.donation_id,
        success: donationResult.success,
        amount: donationResult.amount
      });

      return {
        success: donationResult.success,
        donation_result: donationResult,
        error: donationResult.error
      };

    } catch (error) {
      logger.error('Failed to process donation', {
        fundraiser_id: fundraiserId,
        amount: donationData.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to process donation'
      };
    }
  }

  async getFundraisers(filters?: FundraiserFilters, pagination?: PaginationOptions): Promise<PaginatedResult<Fundraiser>> {
    try {
      return await this.fundraiserRepository.findMany(filters, pagination);
    } catch (error) {
      logger.error('Failed to get fundraisers', {
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

  async getPublicFundraisers(page: number = 1, perPage: number = 20): Promise<Fundraiser[]> {
    try {
      const offset = (page - 1) * perPage;
      return await this.fundraiserRepository.findPublicFundraisers(perPage, offset);
    } catch (error) {
      logger.error('Failed to get public fundraisers', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async getFeaturedFundraisers(limit: number = 10): Promise<Fundraiser[]> {
    try {
      return await this.fundraiserRepository.findFeaturedFundraisers(limit);
    } catch (error) {
      logger.error('Failed to get featured fundraisers', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async getFundraiserDonations(
    fundraiserId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<DonationWithDetails>> {
    try {
      return await this.donationRepository.findByFundraiser(fundraiserId, pagination);
    } catch (error) {
      logger.error('Failed to get fundraiser donations', {
        fundraiser_id: fundraiserId,
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

  private async generateUniqueSlug(title: string): Promise<string> {
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.fundraiserRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async createDonationRecord(
    fundraiser: Fundraiser,
    donationResult: DonationResult,
    donationData: DonationCreationData
  ): Promise<void> {
    try {
      const donationRecord: CreateDonationData = {
        organization_id: fundraiser.organization_id,
        fundraiser_id: fundraiser.id,
        donor_email: donationData.donor_info.email,
        donor_first_name: donationData.donor_info.first_name,
        donor_last_name: donationData.donor_info.last_name,
        donor_phone: donationData.donor_info.phone,
        donor_address_street: donationData.donor_info.address?.street,
        donor_address_city: donationData.donor_info.address?.city,
        donor_address_state: donationData.donor_info.address?.state,
        donor_address_zip: donationData.donor_info.address?.zip,
        donor_address_country: donationData.donor_info.address?.country || 'US',
        donor_employer: donationData.donor_info.employer,
        donor_occupation: donationData.donor_info.occupation,
        amount: donationResult.amount,
        fees_amount: Math.round(donationResult.amount * 0.029 + 30), // Estimated fees
        net_amount: donationResult.amount - Math.round(donationResult.amount * 0.029 + 30),
        currency: donationResult.currency,
        payment_method_type: donationData.payment_method.type,
        payment_method_details: null, // Don't store sensitive payment details
        fluidpay_transaction_id: donationResult.transaction_id,
        fluidpay_customer_id: '', // Will be updated from FluidPay response
        fluidpay_payment_method_id: '', // Will be updated from FluidPay response
        is_recurring: donationData.is_recurring || false,
        recurring_interval: donationData.recurring_interval,
        is_anonymous: donationData.is_anonymous || false,
        dedication: donationData.dedication,
        dedication_type: donationData.dedication_type,
        status: donationResult.status as any,
        compliance_status: 'compliant', // Will be updated by compliance checks
        fec_reportable: donationResult.amount >= 200, // $200+ requires FEC reporting
        metadata: {
          donation_id: donationResult.donation_id,
          compliance_flags: donationResult.compliance_flags
        },
        processed_at: new Date().toISOString()
      };

      await this.donationRepository.create(donationRecord);

    } catch (error) {
      logger.error('Failed to create donation record', {
        fundraiser_id: fundraiser.id,
        donation_id: donationResult.donation_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error here as the payment was successful
    }
  }
}