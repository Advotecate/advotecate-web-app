// Database model types corresponding to our migration schema

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country: string;
  employer?: string;
  occupation?: string;
  is_verified: boolean;
  verification_level: 'none' | 'email' | 'phone' | 'address' | 'full';
  verification_documents?: any;
  mfa_enabled: boolean;
  mfa_secret?: string;
  mfa_backup_codes?: string[];
  role: 'super_admin' | 'org_admin' | 'org_treasurer' | 'org_staff' | 'org_viewer' | 'donor' | 'compliance_officer';
  status: 'active' | 'suspended' | 'pending_verification' | 'banned';
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organization_type: 'campaign' | 'pac' | 'super_pac' | 'nonprofit' | 'political_party';
  tax_id?: string;
  registration_number?: string;
  website_url?: string;
  logo_url?: string;
  contact_email: string;
  contact_phone?: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: string;
  treasurer_name?: string;
  treasurer_email?: string;
  treasurer_phone?: string;
  bank_account_info?: any;
  compliance_settings?: any;
  is_verified: boolean;
  verification_level: 'none' | 'basic' | 'enhanced' | 'full';
  verification_documents?: any;
  fec_id?: string;
  status: 'active' | 'suspended' | 'pending_verification' | 'banned';
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'treasurer' | 'staff' | 'viewer';
  permissions?: any;
  status: 'active' | 'suspended' | 'pending';
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Fundraiser {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  description?: string;
  story?: string;
  goal_amount?: number;
  current_amount: number;
  donor_count: number;
  category?: string;
  tags?: string[];
  featured_image_url?: string;
  gallery_images?: string[];
  video_url?: string;
  start_date?: string;
  end_date?: string;
  election_date?: string;
  election_type?: 'primary' | 'general' | 'special' | 'local';
  visibility: 'public' | 'unlisted' | 'private';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  compliance_notes?: string;
  custom_fields?: any;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  organization_id: string;
  fundraiser_id?: string;
  donor_user_id?: string;
  donor_email: string;
  donor_first_name: string;
  donor_last_name: string;
  donor_phone?: string;
  donor_address_street?: string;
  donor_address_city?: string;
  donor_address_state?: string;
  donor_address_zip?: string;
  donor_address_country?: string;
  donor_employer?: string;
  donor_occupation?: string;
  amount: number;
  fees_amount: number;
  net_amount: number;
  currency: string;
  payment_method_type: 'card' | 'bank_transfer' | 'check' | 'cash';
  payment_method_details?: any;
  fluidpay_transaction_id?: string;
  fluidpay_customer_id?: string;
  fluidpay_payment_method_id?: string;
  is_recurring: boolean;
  recurring_interval?: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  recurring_end_date?: string;
  parent_recurring_donation_id?: string;
  is_anonymous: boolean;
  dedication?: string;
  dedication_type?: 'in_memory' | 'in_honor' | 'general';
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  failure_reason?: string;
  compliance_status: 'compliant' | 'requires_review' | 'flagged' | 'blocked';
  compliance_notes?: string;
  fec_reportable: boolean;
  receipt_sent_at?: string;
  thank_you_sent_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  processed_at?: string;
}

export interface Disbursement {
  id: string;
  organization_id: string;
  recipient_name: string;
  recipient_address?: string;
  amount: number;
  currency: string;
  purpose: string;
  category: 'advertising' | 'consulting' | 'travel' | 'office' | 'fundraising' | 'other';
  payment_method: 'check' | 'bank_transfer' | 'card' | 'cash';
  payment_reference?: string;
  receipt_url?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  disbursed_at?: string;
  fec_reportable: boolean;
  compliance_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  id: string;
  organization_id: string;
  report_type: 'fec_quarterly' | 'fec_monthly' | 'fec_pre_primary' | 'fec_pre_general' | 'fec_post_general' | 'state_required' | 'internal';
  period_start: string;
  period_end: string;
  total_receipts: number;
  total_disbursements: number;
  cash_on_hand_start: number;
  cash_on_hand_end: number;
  debts_owed_by: number;
  debts_owed_to: number;
  report_data: any;
  filing_status: 'draft' | 'pending_review' | 'approved' | 'filed' | 'amended' | 'rejected';
  filed_at?: string;
  filed_by?: string;
  fec_report_id?: string;
  amendment_number?: number;
  original_report_id?: string;
  filing_deadline: string;
  late_fee_assessed?: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  session_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  api_endpoint?: string;
  request_id?: string;
  status: 'success' | 'failure' | 'error';
  error_message?: string;
  metadata?: any;
  created_at: string;
}

// Pagination and query interfaces
export interface PaginationOptions {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Query filter interfaces
export interface UserFilters {
  role?: User['role'];
  status?: User['status'];
  is_verified?: boolean;
  verification_level?: User['verification_level'];
  organization_id?: string;
  email?: string;
  created_after?: string;
  created_before?: string;
}

export interface OrganizationFilters {
  organization_type?: Organization['organization_type'];
  status?: Organization['status'];
  is_verified?: boolean;
  verification_level?: Organization['verification_level'];
  created_after?: string;
  created_before?: string;
}

export interface FundraiserFilters {
  organization_id?: string;
  status?: Fundraiser['status'];
  visibility?: Fundraiser['visibility'];
  category?: string;
  tags?: string[];
  election_type?: Fundraiser['election_type'];
  created_after?: string;
  created_before?: string;
  goal_min?: number;
  goal_max?: number;
  current_min?: number;
  current_max?: number;
}

export interface DonationFilters {
  organization_id?: string;
  fundraiser_id?: string;
  donor_user_id?: string;
  donor_email?: string;
  status?: Donation['status'];
  compliance_status?: Donation['compliance_status'];
  is_recurring?: boolean;
  is_anonymous?: boolean;
  fec_reportable?: boolean;
  amount_min?: number;
  amount_max?: number;
  payment_method_type?: Donation['payment_method_type'];
  created_after?: string;
  created_before?: string;
  processed_after?: string;
  processed_before?: string;
}

// Create/Update interfaces (omit generated fields)
export type CreateUserData = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUserData = Partial<Omit<User, 'id' | 'email' | 'created_at' | 'updated_at'>>;

export type CreateOrganizationData = Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
export type UpdateOrganizationData = Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>;

export type CreateFundraiserData = Omit<Fundraiser, 'id' | 'current_amount' | 'donor_count' | 'created_at' | 'updated_at'>;
export type UpdateFundraiserData = Partial<Omit<Fundraiser, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>>;

export type CreateDonationData = Omit<Donation, 'id' | 'created_at' | 'updated_at' | 'processed_at'>;
export type UpdateDonationData = Partial<Omit<Donation, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>;

// Join result types
export interface UserWithOrganizations extends User {
  organizations: (Organization & { role: string; status: string })[];
}

export interface DonationWithDetails extends Donation {
  organization: Pick<Organization, 'id' | 'name' | 'slug'>;
  fundraiser?: Pick<Fundraiser, 'id' | 'title' | 'slug'>;
  donor?: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>;
}

export interface FundraiserWithStats extends Fundraiser {
  organization: Pick<Organization, 'id' | 'name' | 'slug'>;
  recent_donations?: Pick<Donation, 'id' | 'amount' | 'donor_first_name' | 'donor_last_name' | 'created_at'>[];
  top_donors?: {
    donor_name: string;
    total_amount: number;
    donation_count: number;
  }[];
}