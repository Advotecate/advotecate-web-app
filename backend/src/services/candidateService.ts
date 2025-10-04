/**
 * Candidate Service
 * Business logic for candidate profiles and multi-org fundraising
 */

import { supabaseAdmin } from '../config/supabase.js';
import { fecSyncService } from './fecSyncService.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Candidate {
  id: string;
  fec_cand_id: string | null;
  display_name: string;
  slug: string;
  office_type: string;
  bio: string | null;
  website_url: string | null;
  twitter_handle: string | null;
  facebook_url: string | null;
  instagram_handle: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  verification_status: string;
  campaign_status: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateFundraiser {
  id: string;
  candidate_id: string;
  fundraiser_id: string;
  organization_id: string;
  is_primary: boolean;
  fundraiser_role: string;
  custom_title: string | null;
  custom_description: string | null;
  approval_status: string;
  created_at: string;
}

export interface CandidateWithFEC extends Candidate {
  fec_data?: {
    cand_name: string;
    cand_office: string;
    cand_office_st: string;
    cand_office_district: string | null;
    cand_pty_affiliation: string;
    cand_election_yr: number | null;
    cand_ici: string;
  };
}

// ============================================================================
// CANDIDATE SERVICE
// ============================================================================

export class CandidateService {
  /**
   * Get candidate by ID with optional FEC data
   */
  async getCandidateById(candidateId: string, includeFEC: boolean = true): Promise<CandidateWithFEC | null> {
    let query = supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    const { data: candidate, error } = await query;

    if (error || !candidate) {
      return null;
    }

    if (includeFEC && candidate.fec_cand_id) {
      const { data: fecData } = await supabaseAdmin
        .from('fec_candidates')
        .select('cand_name, cand_office, cand_office_st, cand_office_district, cand_pty_affiliation, cand_election_yr, cand_ici')
        .eq('fec_cand_id', candidate.fec_cand_id)
        .single();

      return {
        ...candidate,
        fec_data: fecData || undefined,
      };
    }

    return candidate;
  }

  /**
   * Get candidate by slug
   */
  async getCandidateBySlug(slug: string): Promise<CandidateWithFEC | null> {
    const { data: candidate, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !candidate) {
      return null;
    }

    if (candidate.fec_cand_id) {
      const { data: fecData } = await supabaseAdmin
        .from('fec_candidates')
        .select('cand_name, cand_office, cand_office_st, cand_office_district, cand_pty_affiliation, cand_election_yr, cand_ici')
        .eq('fec_cand_id', candidate.fec_cand_id)
        .single();

      return {
        ...candidate,
        fec_data: fecData || undefined,
      };
    }

    return candidate;
  }

  /**
   * Search candidates
   */
  async searchCandidates(options: {
    query?: string;
    office_type?: string;
    state?: string;
    party?: string;
    verification_status?: string;
    campaign_status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ candidates: CandidateWithFEC[]; total: number }> {
    let query = supabaseAdmin
      .from('candidates')
      .select('*, fec_candidates!inner(cand_name, cand_office, cand_office_st, cand_office_district, cand_pty_affiliation, cand_election_yr, cand_ici)', { count: 'exact' });

    // Apply filters
    if (options.query) {
      query = query.or(`display_name.ilike.%${options.query}%, fec_candidates.cand_name.ilike.%${options.query}%`);
    }
    if (options.office_type) {
      query = query.eq('office_type', options.office_type);
    }
    if (options.state) {
      query = query.eq('fec_candidates.cand_office_st', options.state);
    }
    if (options.party) {
      query = query.eq('fec_candidates.cand_pty_affiliation', options.party);
    }
    if (options.verification_status) {
      query = query.eq('verification_status', options.verification_status);
    }
    if (options.campaign_status) {
      query = query.eq('campaign_status', options.campaign_status);
    }

    // Pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching candidates:', error);
      return { candidates: [], total: 0 };
    }

    return {
      candidates: data || [],
      total: count || 0,
    };
  }

  /**
   * Create new candidate profile
   */
  async createCandidate(candidateData: {
    fec_cand_id?: string;
    display_name: string;
    slug: string;
    office_type: string;
    bio?: string;
    website_url?: string;
    twitter_handle?: string;
    facebook_url?: string;
    instagram_handle?: string;
    profile_image_url?: string;
    banner_image_url?: string;
  }): Promise<Candidate | null> {
    // If FEC ID provided, try to sync from FEC first
    if (candidateData.fec_cand_id) {
      try {
        await fecSyncService.syncCandidateById(candidateData.fec_cand_id);
      } catch (error) {
        console.error('Failed to sync FEC data:', error);
        // Continue anyway, FEC data is optional
      }
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .insert({
        ...candidateData,
        verification_status: candidateData.fec_cand_id ? 'fec_verified' : 'unverified',
        campaign_status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating candidate:', error);
      return null;
    }

    return data;
  }

  /**
   * Update candidate profile
   */
  async updateCandidate(
    candidateId: string,
    updates: Partial<Candidate>
  ): Promise<Candidate | null> {
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update(updates)
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating candidate:', error);
      return null;
    }

    return data;
  }

  /**
   * Verify/claim candidate profile
   */
  async verifyCandidate(
    candidateId: string,
    userId: string
  ): Promise<boolean> {
    // TODO: Implement verification workflow
    // - Send verification email
    // - Require proof of identity
    // - Admin approval process

    const { error } = await supabaseAdmin
      .from('candidates')
      .update({
        verification_status: 'claimed',
        // verified_by: userId, // Would need to add this column
      })
      .eq('id', candidateId);

    return !error;
  }

  /**
   * Get all fundraisers for a candidate
   */
  async getCandidateFundraisers(candidateId: string): Promise<CandidateFundraiser[]> {
    const { data, error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .select('*, fundraisers(*), organizations(name, slug)')
      .eq('candidate_id', candidateId)
      .eq('approval_status', 'approved')
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching candidate fundraisers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create fundraiser for candidate (multi-org feature)
   */
  async createCandidateFundraiser(data: {
    candidate_id: string;
    fundraiser_id: string;
    organization_id: string;
    is_primary?: boolean;
    fundraiser_role?: string;
    custom_title?: string;
    custom_description?: string;
  }): Promise<CandidateFundraiser | null> {
    // Check if this org already has a fundraiser for this candidate
    const { data: existing } = await supabaseAdmin
      .from('candidate_fundraisers')
      .select('id')
      .eq('candidate_id', data.candidate_id)
      .eq('organization_id', data.organization_id)
      .single();

    if (existing) {
      console.error('Organization already has a fundraiser for this candidate');
      return null;
    }

    const { data: candidateFundraiser, error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .insert({
        ...data,
        is_primary: data.is_primary || false,
        fundraiser_role: data.fundraiser_role || 'supporting',
        approval_status: data.is_primary ? 'pending' : 'approved', // Primary needs approval
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating candidate fundraiser:', error);
      return null;
    }

    return candidateFundraiser;
  }

  /**
   * Update candidate fundraiser
   */
  async updateCandidateFundraiser(
    fundraiserId: string,
    updates: Partial<CandidateFundraiser>
  ): Promise<CandidateFundraiser | null> {
    const { data, error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .update(updates)
      .eq('id', fundraiserId)
      .select()
      .single();

    if (error) {
      console.error('Error updating candidate fundraiser:', error);
      return null;
    }

    return data;
  }

  /**
   * Approve candidate fundraiser
   */
  async approveCandidateFundraiser(
    fundraiserId: string,
    approverId: string
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .update({
        approval_status: 'approved',
        // approved_by: approverId, // Would need to add this column
      })
      .eq('id', fundraiserId);

    return !error;
  }

  /**
   * Reject candidate fundraiser
   */
  async rejectCandidateFundraiser(
    fundraiserId: string,
    reason?: string
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .update({
        approval_status: 'rejected',
        // rejection_reason: reason, // Would need to add this column
      })
      .eq('id', fundraiserId);

    return !error;
  }

  /**
   * Get organization's candidate fundraisers
   */
  async getOrganizationCandidateFundraisers(
    organizationId: string
  ): Promise<CandidateFundraiser[]> {
    const { data, error } = await supabaseAdmin
      .from('candidate_fundraisers')
      .select('*, candidates(*), fundraisers(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching org candidate fundraisers:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get fundraising totals for a candidate across all orgs
   */
  async getCandidateFundraisingTotals(candidateId: string): Promise<{
    total_raised: number;
    total_donors: number;
    org_count: number;
    fundraiser_count: number;
  }> {
    const { data, error } = await supabaseAdmin
      .from('v_candidate_fundraising_totals')
      .select('*')
      .eq('candidate_id', candidateId)
      .single();

    if (error || !data) {
      return {
        total_raised: 0,
        total_donors: 0,
        org_count: 0,
        fundraiser_count: 0,
      };
    }

    return data;
  }

  /**
   * Get FEC-verified candidates only
   */
  async getFECVerifiedCandidates(options: {
    office?: string;
    state?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ candidates: CandidateWithFEC[]; total: number }> {
    let query = supabaseAdmin
      .from('v_fec_verified_candidates')
      .select('*', { count: 'exact' });

    if (options.office) {
      query = query.eq('cand_office', options.office);
    }
    if (options.state) {
      query = query.eq('cand_office_st', options.state);
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching FEC verified candidates:', error);
      return { candidates: [], total: 0 };
    }

    return {
      candidates: data || [],
      total: count || 0,
    };
  }

  /**
   * Link candidate to FEC CAND_ID
   */
  async linkToFEC(candidateId: string, fecCandId: string): Promise<boolean> {
    try {
      // Sync FEC data first
      await fecSyncService.syncCandidateById(fecCandId);

      // Update candidate with FEC link
      const { error } = await supabaseAdmin
        .from('candidates')
        .update({
          fec_cand_id: fecCandId,
          verification_status: 'fec_verified',
        })
        .eq('id', candidateId);

      return !error;
    } catch (error) {
      console.error('Error linking candidate to FEC:', error);
      return false;
    }
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string, excludeCandidateId?: string): Promise<boolean> {
    let query = supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('slug', slug);

    if (excludeCandidateId) {
      query = query.neq('id', excludeCandidateId);
    }

    const { data, error } = await query.single();

    return !data && !error; // Available if not found
  }

  /**
   * Generate unique slug from name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')          // Replace spaces with hyphens
      .replace(/-+/g, '-')           // Remove consecutive hyphens
      .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
  }
}

// Export singleton instance
export const candidateService = new CandidateService();
