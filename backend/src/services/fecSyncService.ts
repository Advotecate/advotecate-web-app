/**
 * FEC Sync Service
 * Handles synchronization with OpenFEC API for candidate data
 *
 * OpenFEC API Documentation: https://api.open.fec.gov/developers/
 * Rate Limit: 1,000 requests/hour (developer tier)
 */

import axios, { AxiosInstance } from 'axios';
import { supabaseAdmin } from '../config/supabase.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FECCandidate {
  candidate_id: string;           // CAND_ID: [H|S|P] + 8 digits
  name: string;                   // Candidate name
  party: string;                  // Party abbreviation (DEM, REP, etc.)
  election_years: number[];       // Election years
  office: string;                 // H, S, or P
  state: string;                  // State code
  district: string | null;        // District number (House only)
  incumbent_challenge: string;    // I, C, O
  candidate_status: string;       // C (candidate), F (future), N (not yet), P (prior)
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

export interface FECCommittee {
  committee_id: string;
  name: string;
  committee_type: string;
  designation: string;
  party: string;
  state: string;
}

export interface FECSyncResult {
  sync_job_id: string;
  sync_type: string;
  status: string;
  records_fetched: number;
  records_updated: number;
  records_created: number;
  error_count: number;
  started_at: Date;
  completed_at?: Date;
  error_log?: any;
}

// ============================================================================
// FEC API CLIENT
// ============================================================================

export class FECAPIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://api.open.fec.gov/v1';

  constructor() {
    this.apiKey = process.env.FEC_API_KEY || '';

    if (!this.apiKey) {
      console.warn('FEC_API_KEY not set in environment. API requests will be limited.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      params: {
        api_key: this.apiKey,
      },
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Fetch candidates from OpenFEC API
   */
  async fetchCandidates(options: {
    year?: number;
    office?: string;
    state?: string;
    party?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<{ results: FECCandidate[]; pagination: any }> {
    try {
      const response = await this.client.get('/candidates/', {
        params: {
          election_year: options.year,
          office: options.office,
          state: options.state,
          party: options.party,
          page: options.page || 1,
          per_page: options.per_page || 100,
          sort: 'name',
        },
      });

      return {
        results: response.data.results,
        pagination: response.data.pagination,
      };
    } catch (error) {
      console.error('Error fetching candidates from FEC API:', error);
      throw error;
    }
  }

  /**
   * Fetch single candidate by CAND_ID
   */
  async fetchCandidateById(candidateId: string): Promise<FECCandidate | null> {
    try {
      const response = await this.client.get(`/candidate/${candidateId}/`);
      return response.data.results?.[0] || null;
    } catch (error) {
      console.error(`Error fetching candidate ${candidateId} from FEC API:`, error);
      return null;
    }
  }

  /**
   * Fetch committees for a candidate
   */
  async fetchCandidateCommittees(candidateId: string): Promise<FECCommittee[]> {
    try {
      const response = await this.client.get(`/candidate/${candidateId}/committees/`);
      return response.data.results || [];
    } catch (error) {
      console.error(`Error fetching committees for candidate ${candidateId}:`, error);
      return [];
    }
  }

  /**
   * Search candidates by name
   */
  async searchCandidates(name: string): Promise<FECCandidate[]> {
    try {
      const response = await this.client.get('/names/candidates/', {
        params: {
          q: name,
          per_page: 20,
        },
      });
      return response.data.results || [];
    } catch (error) {
      console.error(`Error searching candidates with name "${name}":`, error);
      return [];
    }
  }
}

// ============================================================================
// FEC SYNC SERVICE
// ============================================================================

export class FECSyncService {
  private fecClient: FECAPIClient;

  constructor() {
    this.fecClient = new FECAPIClient();
  }

  /**
   * Create a new sync job log
   */
  private async createSyncLog(syncType: string): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('fec_sync_log')
      .insert({
        sync_type: syncType,
        status: 'running',
        records_fetched: 0,
        records_updated: 0,
        records_created: 0,
        error_count: 0,
        started_at: new Date().toISOString(),
      })
      .select('sync_job_id')
      .single();

    if (error || !data) {
      console.error('Error creating sync log:', error);
      throw new Error('Failed to create sync log');
    }

    return data.sync_job_id;
  }

  /**
   * Update sync job log
   */
  private async updateSyncLog(
    syncJobId: string,
    updates: Partial<FECSyncResult>
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('fec_sync_log')
      .update(updates)
      .eq('sync_job_id', syncJobId);

    if (error) {
      console.error('Error updating sync log:', error);
    }
  }

  /**
   * Sync FEC candidate to database
   */
  private async syncFECCandidate(fecCandidate: FECCandidate): Promise<'created' | 'updated'> {
    // Upsert into fec_candidates table
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('fec_candidates')
      .select('fec_cand_id')
      .eq('fec_cand_id', fecCandidate.candidate_id)
      .single();

    const fecData = {
      fec_cand_id: fecCandidate.candidate_id,
      cand_name: fecCandidate.name,
      cand_pty_affiliation: fecCandidate.party,
      cand_election_yr: fecCandidate.election_years?.[0] || null,
      cand_office: fecCandidate.office,
      cand_office_st: fecCandidate.state,
      cand_office_district: fecCandidate.district,
      cand_ici: fecCandidate.incumbent_challenge,
      cand_status: fecCandidate.candidate_status,
      cand_street_1: fecCandidate.address_street_1,
      cand_street_2: fecCandidate.address_street_2,
      cand_city: fecCandidate.address_city,
      cand_st: fecCandidate.address_state,
      cand_zip: fecCandidate.address_zip,
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('fec_candidates')
      .upsert(fecData, { onConflict: 'fec_cand_id' });

    if (error) {
      console.error(`Error syncing candidate ${fecCandidate.candidate_id}:`, error);
      throw error;
    }

    return existing ? 'updated' : 'created';
  }

  /**
   * Full sync: Sync all candidates for a given year and office
   */
  async fullSync(year: number, office?: string): Promise<FECSyncResult> {
    const syncJobId = await this.createSyncLog('full_sync');

    let recordsFetched = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { results, pagination } = await this.fecClient.fetchCandidates({
          year,
          office,
          page,
          per_page: 100,
        });

        recordsFetched += results.length;

        // Sync each candidate
        for (const candidate of results) {
          try {
            const result = await this.syncFECCandidate(candidate);
            if (result === 'created') recordsCreated++;
            if (result === 'updated') recordsUpdated++;
          } catch (error) {
            errorCount++;
            errors.push({
              candidate_id: candidate.candidate_id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Update progress
        await this.updateSyncLog(syncJobId, {
          records_fetched: recordsFetched,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          error_count: errorCount,
        });

        // Check pagination
        hasMore = pagination.pages > page;
        page++;

        // Rate limiting: 1000 req/hour = ~0.28 req/sec
        // Add small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Mark as completed
      await this.updateSyncLog(syncJobId, {
        status: 'completed',
        completed_at: new Date(),
        error_log: errors.length > 0 ? { errors } : null,
      });

      return {
        sync_job_id: syncJobId,
        sync_type: 'full_sync',
        status: 'completed',
        records_fetched: recordsFetched,
        records_updated: recordsUpdated,
        records_created: recordsCreated,
        error_count: errorCount,
        started_at: new Date(),
        completed_at: new Date(),
        error_log: errors.length > 0 ? { errors } : undefined,
      };

    } catch (error) {
      // Mark as failed
      await this.updateSyncLog(syncJobId, {
        status: 'failed',
        completed_at: new Date(),
        error_log: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Incremental sync: Update existing candidates
   */
  async incrementalSync(): Promise<FECSyncResult> {
    const syncJobId = await this.createSyncLog('incremental');

    try {
      // Get list of candidate IDs from database
      const { data: candidates, error } = await supabaseAdmin
        .from('fec_candidates')
        .select('fec_cand_id')
        .order('last_synced_at', { ascending: true })
        .limit(100); // Update 100 oldest records

      if (error || !candidates) {
        throw new Error('Failed to fetch candidates for incremental sync');
      }

      let recordsUpdated = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Update each candidate
      for (const { fec_cand_id } of candidates) {
        try {
          const fecData = await this.fecClient.fetchCandidateById(fec_cand_id);
          if (fecData) {
            await this.syncFECCandidate(fecData);
            recordsUpdated++;
          }
        } catch (error) {
          errorCount++;
          errors.push({
            candidate_id: fec_cand_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark as completed
      await this.updateSyncLog(syncJobId, {
        status: 'completed',
        records_fetched: candidates.length,
        records_updated: recordsUpdated,
        records_created: 0,
        error_count: errorCount,
        completed_at: new Date(),
        error_log: errors.length > 0 ? { errors } : null,
      });

      return {
        sync_job_id: syncJobId,
        sync_type: 'incremental',
        status: 'completed',
        records_fetched: candidates.length,
        records_updated: recordsUpdated,
        records_created: 0,
        error_count: errorCount,
        started_at: new Date(),
        completed_at: new Date(),
        error_log: errors.length > 0 ? { errors } : undefined,
      };

    } catch (error) {
      await this.updateSyncLog(syncJobId, {
        status: 'failed',
        completed_at: new Date(),
        error_log: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Sync a single candidate by CAND_ID
   */
  async syncCandidateById(candidateId: string): Promise<void> {
    const fecData = await this.fecClient.fetchCandidateById(candidateId);

    if (!fecData) {
      throw new Error(`Candidate ${candidateId} not found in FEC API`);
    }

    await this.syncFECCandidate(fecData);

    // Sync committees for this candidate
    const committees = await this.fecClient.fetchCandidateCommittees(candidateId);
    for (const committee of committees) {
      await this.syncCommittee(committee, candidateId);
    }
  }

  /**
   * Sync committee data
   */
  private async syncCommittee(committee: FECCommittee, candidateId: string): Promise<void> {
    // Upsert committee
    const { error: committeeError } = await supabaseAdmin
      .from('fec_committees')
      .upsert({
        fec_committee_id: committee.committee_id,
        committee_name: committee.name,
        committee_type: committee.committee_type,
        designation: committee.designation,
        party_affiliation: committee.party,
        state: committee.state,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'fec_committee_id' });

    if (committeeError) {
      console.error(`Error syncing committee ${committee.committee_id}:`, committeeError);
      return;
    }

    // Link candidate to committee
    const { error: linkError } = await supabaseAdmin
      .from('candidate_committees')
      .upsert({
        fec_cand_id: candidateId,
        fec_committee_id: committee.committee_id,
        linkage_type: 'principal', // Would need to determine from FEC data
        is_active: true,
      }, { onConflict: 'fec_cand_id,fec_committee_id' });

    if (linkError) {
      console.error(`Error linking candidate ${candidateId} to committee ${committee.committee_id}:`, linkError);
    }
  }

  /**
   * Get sync job status
   */
  async getSyncJobStatus(syncJobId: string): Promise<FECSyncResult | null> {
    const { data, error } = await supabaseAdmin
      .from('fec_sync_log')
      .select('*')
      .eq('sync_job_id', syncJobId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as FECSyncResult;
  }

  /**
   * Get recent sync jobs
   */
  async getRecentSyncJobs(limit: number = 10): Promise<FECSyncResult[]> {
    const { data, error } = await supabaseAdmin
      .from('fec_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as FECSyncResult[];
  }
}

// Export singleton instance
export const fecSyncService = new FECSyncService();
