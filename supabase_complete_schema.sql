-- ============================================================================
-- ADVOTECATE COMPLETE DATABASE SCHEMA FOR SUPABASE
-- ============================================================================
-- Political platform with user and organization management
-- Includes: Users, Organizations, Fundraisers, Donations, Disbursements, Interest Tagging
-- Generated: 2025-10-02
-- Database: PostgreSQL 14+ / Supabase
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS AND SCHEMAS
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Add comments to schemas
COMMENT ON SCHEMA reporting IS 'Schema for reporting and analytics views';

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS TABLE
-- ----------------------------------------------------------------------------
-- Stores user accounts for donors and administrators
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255), -- nullable for OAuth users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    date_of_birth DATE, -- required for compliance
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,

    -- Address Information
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(2) DEFAULT 'US',

    -- Compliance Fields
    employer VARCHAR(255),
    occupation VARCHAR(255),
    citizenship_status VARCHAR(20) CHECK (citizenship_status IN ('citizen', 'permanent_resident', 'other')),

    -- System Fields
    role VARCHAR(20) DEFAULT 'donor' CHECK (role IN ('donor', 'org_admin', 'super_admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_verification')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_verified_at TIMESTAMP,

    -- MFA fields
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT, -- encrypted TOTP secret
    mfa_backup_codes TEXT[], -- array of backup codes

    -- FluidPay Integration
    fluidpay_customer_id VARCHAR(255),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_fluidpay ON users (fluidpay_customer_id) WHERE fluidpay_customer_id IS NOT NULL;
CREATE INDEX idx_users_status ON users (status, kyc_status);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_users_active ON users (id) WHERE status = 'active';

-- Comments
COMMENT ON TABLE users IS 'Core user accounts for donors and administrators';
COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password, nullable for OAuth users';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA';
COMMENT ON COLUMN users.fluidpay_customer_id IS 'Reference to FluidPay customer record';

-- ----------------------------------------------------------------------------
-- ORGANIZATIONS TABLE
-- ----------------------------------------------------------------------------
-- Political organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50) NOT NULL CHECK (organization_type IN (
        'candidate_committee',
        'pac',
        'super_pac',
        'party_committee',
        'nonprofit_501c3',
        'nonprofit_501c4'
    )),

    -- Contact Information
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(255),

    -- Address
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(2) DEFAULT 'US',

    -- Compliance Identifiers
    fec_id VARCHAR(20), -- FEC Committee ID
    ein VARCHAR(20), -- Employer Identification Number
    state_filing_id VARCHAR(50),

    -- Banking Information (encrypted)
    bank_account_number TEXT, -- encrypted
    routing_number TEXT, -- encrypted
    bank_name VARCHAR(255),

    -- Verification Status
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN (
        'pending', 'verified', 'rejected', 'suspended'
    )),
    verification_documents JSONB, -- store document references
    verified_at TIMESTAMP,
    verified_by UUID,

    -- System Fields
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Indexes
CREATE INDEX idx_orgs_status ON organizations (status, verification_status);
CREATE INDEX idx_orgs_fec ON organizations (fec_id) WHERE fec_id IS NOT NULL;
CREATE INDEX idx_orgs_type ON organizations (organization_type);
CREATE INDEX idx_orgs_created_at ON organizations (created_at);
CREATE INDEX idx_orgs_name ON organizations USING gin(name gin_trgm_ops);

-- Comments
COMMENT ON TABLE organizations IS 'Political organizations';
COMMENT ON COLUMN organizations.bank_account_number IS 'Encrypted bank account';
COMMENT ON COLUMN organizations.routing_number IS 'Encrypted bank routing number';
COMMENT ON COLUMN organizations.verification_documents IS 'JSONB array of document references for verification';

-- ----------------------------------------------------------------------------
-- ORGANIZATION_USERS TABLE
-- ----------------------------------------------------------------------------
-- Many-to-many relationship between organizations and users
CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'treasurer', 'staff', 'viewer')),
    permissions JSONB, -- specific permissions for this user

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP,
    accepted_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Constraints
    UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_users_org ON organization_users (organization_id);
CREATE INDEX idx_org_users_user ON organization_users (user_id);
CREATE INDEX idx_org_users_role ON organization_users (role);
CREATE INDEX idx_org_users_status ON organization_users (status);

-- Comments
COMMENT ON TABLE organization_users IS 'Association between users and organizations with roles';
COMMENT ON COLUMN organization_users.permissions IS 'JSONB object with specific permissions for this user-org relationship';

-- ============================================================================
-- SECTION 3: DONATION TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNDRAISERS TABLE
-- ----------------------------------------------------------------------------
-- Fundraising campaigns and events
CREATE TABLE fundraisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic Information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) UNIQUE NOT NULL, -- for URLs

    -- Financial Goals
    goal_amount DECIMAL(12,2),
    minimum_donation DECIMAL(8,2) DEFAULT 1.00,
    maximum_donation DECIMAL(8,2), -- compliance limits
    suggested_amounts DECIMAL(8,2)[], -- array of suggested donation amounts

    -- Timing
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,

    -- Content
    image_url VARCHAR(500),
    video_url VARCHAR(500),
    custom_fields JSONB, -- flexible additional fields

    -- Settings
    allow_anonymous BOOLEAN DEFAULT false,
    require_address BOOLEAN DEFAULT true,
    require_employer_info BOOLEAN DEFAULT true,
    allow_recurring BOOLEAN DEFAULT true,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'cancelled'
    )),

    -- Statistics (derived fields for performance)
    total_raised DECIMAL(12,2) DEFAULT 0,
    donation_count INTEGER DEFAULT 0,
    unique_donors_count INTEGER DEFAULT 0,
    last_donation_at TIMESTAMP,

    -- SEO and social
    meta_description TEXT,
    social_image_url VARCHAR(500),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Indexes
CREATE INDEX idx_fundraisers_org ON fundraisers (organization_id);
CREATE INDEX idx_fundraisers_status ON fundraisers (status);
CREATE INDEX idx_fundraisers_dates ON fundraisers (start_date, end_date);
CREATE INDEX idx_fundraisers_slug ON fundraisers (slug);
CREATE INDEX idx_fundraisers_active ON fundraisers (status, start_date) WHERE status = 'active';

-- Full text search index
CREATE INDEX idx_fundraisers_search ON fundraisers USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Comments
COMMENT ON TABLE fundraisers IS 'Fundraising campaigns and events';
COMMENT ON COLUMN fundraisers.slug IS 'URL-friendly identifier for the fundraiser';
COMMENT ON COLUMN fundraisers.custom_fields IS 'JSONB for flexible additional campaign data';
COMMENT ON COLUMN fundraisers.suggested_amounts IS 'Array of suggested donation amounts in dollars';

-- ----------------------------------------------------------------------------
-- DONATIONS TABLE (NOT PARTITIONED)
-- ----------------------------------------------------------------------------
-- Individual donation transactions
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fundraiser_id UUID NOT NULL REFERENCES fundraisers(id),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Transaction Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    fee_amount DECIMAL(8,2), -- platform fee
    processing_fee DECIMAL(8,2), -- FluidPay processing fee
    net_amount DECIMAL(10,2), -- amount after all fees

    -- FluidPay Integration
    fluidpay_transaction_id VARCHAR(255),
    fluidpay_customer_id VARCHAR(255),
    payment_method_type VARCHAR(50), -- credit_card, bank_transfer, etc.
    payment_method_last4 VARCHAR(4),
    payment_method_brand VARCHAR(20), -- visa, mastercard, etc.

    -- Transaction Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
    )),
    failure_reason TEXT,
    failure_code VARCHAR(50),

    -- Recurring Donation Support
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annually')),
    parent_donation_id UUID REFERENCES donations(id),
    subscription_id VARCHAR(255), -- FluidPay subscription ID

    -- Compliance Information
    donor_employer VARCHAR(255),
    donor_occupation VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT false,
    compliance_flags JSONB, -- any compliance-related flags or notes

    -- IP and tracking for fraud prevention
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,

    -- Processing Timestamps
    authorized_at TIMESTAMP,
    captured_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes on donations table
CREATE INDEX idx_donations_fundraiser ON donations (fundraiser_id);
CREATE INDEX idx_donations_user ON donations (user_id);
CREATE INDEX idx_donations_org ON donations (organization_id);
CREATE INDEX idx_donations_status ON donations (status);
CREATE INDEX idx_donations_fluidpay ON donations (fluidpay_transaction_id) WHERE fluidpay_transaction_id IS NOT NULL;
CREATE INDEX idx_donations_created ON donations (created_at);
CREATE INDEX idx_donations_recurring ON donations (is_recurring, recurring_frequency) WHERE is_recurring = true;
CREATE INDEX idx_donations_completed ON donations (status, completed_at) WHERE status = 'completed';

-- Comments
COMMENT ON TABLE donations IS 'Individual donation transactions';
COMMENT ON COLUMN donations.net_amount IS 'Amount after platform and processing fees';
COMMENT ON COLUMN donations.compliance_flags IS 'JSONB for compliance-related metadata';

-- ----------------------------------------------------------------------------
-- DISBURSEMENTS TABLE
-- ----------------------------------------------------------------------------
-- Payouts from platform to organizations
CREATE TABLE disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Financial Details
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    fee_amount DECIMAL(8,2),
    net_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Processing Information
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    method VARCHAR(20) NOT NULL CHECK (method IN ('ach', 'wire', 'check')),

    -- Bank Details (when not using stored org details)
    bank_account_number TEXT, -- encrypted
    routing_number TEXT, -- encrypted
    bank_name VARCHAR(255),

    -- Processing Details
    initiated_at TIMESTAMP,
    completed_at TIMESTAMP,
    expected_arrival_date DATE,
    actual_arrival_date DATE,

    -- References
    reference_number VARCHAR(100) UNIQUE,
    external_transaction_id VARCHAR(255), -- FluidPay or bank reference
    batch_id UUID, -- for grouping multiple disbursements

    -- Related donations
    donation_ids UUID[], -- array of donation IDs included in this disbursement
    reporting_period_start DATE,
    reporting_period_end DATE,

    -- Notes
    memo TEXT,
    internal_notes TEXT,
    failure_reason TEXT,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_disbursements_org ON disbursements (organization_id);
CREATE INDEX idx_disbursements_status ON disbursements (status);
CREATE INDEX idx_disbursements_created ON disbursements (created_at);
CREATE INDEX idx_disbursements_batch ON disbursements (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_disbursements_reference ON disbursements (reference_number);
CREATE INDEX idx_disbursements_reporting_period ON disbursements (reporting_period_start, reporting_period_end);

-- Comments
COMMENT ON TABLE disbursements IS 'Payouts from platform to organizations';
COMMENT ON COLUMN disbursements.donation_ids IS 'Array of donation UUIDs included in this disbursement';
COMMENT ON COLUMN disbursements.reference_number IS 'Unique human-readable disbursement reference';

-- ============================================================================
-- SECTION 4: SYSTEM CONFIGURATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SYSTEM_CONFIG TABLE
-- ----------------------------------------------------------------------------
-- System-wide configuration settings
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT false, -- whether this config can be exposed to frontend
    is_encrypted BOOLEAN DEFAULT false, -- whether the value is encrypted

    -- Version control
    version INTEGER DEFAULT 1,
    previous_value JSONB,

    -- Audit fields
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('feature_flags',
 '{"fundraisers": true, "events": true, "organizations": true, "user_profiles": true}',
 'Feature toggles',
 'features',
 true),
('donation_limits',
 '{"individual_per_cycle": 3300.00, "pac_per_year": 5000.00, "minimum_amount": 1.00, "require_employer_info_threshold": 200.00}',
 'FEC and compliance-based donation limits',
 'compliance',
 false),
('platform_fees',
 '{"percentage": 2.9, "fixed_cents": 30, "fluidpay_percentage": 2.5}',
 'Platform and payment processing fees',
 'financial',
 false),
('compliance_thresholds',
 '{"employer_info_required": 200.00, "aggregate_reporting": 200.00, "individual_reporting": 200.00}',
 'Compliance thresholds for FEC reporting',
 'compliance',
 false),
('rate_limits',
 '{"anonymous": {"window_minutes": 60, "max_requests": 100}, "authenticated": {"window_minutes": 60, "max_requests": 1000}, "admin": {"window_minutes": 60, "max_requests": 5000}}',
 'API rate limiting configuration',
 'security',
 false),
('security_settings',
 '{"session_timeout_hours": 24, "mfa_required_for_admin": true, "password_reset_timeout_minutes": 30}',
 'Security configuration',
 'security',
 false),
('maintenance_mode',
 '{"enabled": false, "message": "Platform is temporarily unavailable for maintenance.", "estimated_end": null}',
 'Maintenance mode settings',
 'system',
 true);

-- Indexes
CREATE INDEX idx_system_config_category ON system_config (category);
CREATE INDEX idx_system_config_public ON system_config (is_public) WHERE is_public = true;
CREATE INDEX idx_system_config_updated ON system_config (updated_at);

-- Comments
COMMENT ON TABLE system_config IS 'System-wide configuration settings';
COMMENT ON COLUMN system_config.is_public IS 'Whether this configuration can be safely exposed to frontend applications';
COMMENT ON COLUMN system_config.is_encrypted IS 'Whether the value field contains encrypted data';

-- ============================================================================
-- SECTION 5: INTEREST TAGGING SYSTEM
-- ============================================================================

-- ----------------------------------------------------------------------------
-- INTEREST_CATEGORIES TABLE
-- ----------------------------------------------------------------------------
-- High-level interest categories
CREATE TABLE interest_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(7) NOT NULL,
    color_bg VARCHAR(7) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_interest_categories_slug ON interest_categories(slug);
CREATE INDEX idx_interest_categories_is_active ON interest_categories(is_active);
CREATE INDEX idx_interest_categories_sort_order ON interest_categories(sort_order);

-- ----------------------------------------------------------------------------
-- INTEREST_TAGS TABLE
-- ----------------------------------------------------------------------------
-- Detailed tags under categories
CREATE TABLE interest_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(100),
    color_override VARCHAR(7),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, slug)
);

-- Indexes
CREATE INDEX idx_interest_tags_category_id ON interest_tags(category_id);
CREATE INDEX idx_interest_tags_slug ON interest_tags(slug);
CREATE INDEX idx_interest_tags_is_active ON interest_tags(is_active);
CREATE INDEX idx_interest_tags_sort_order ON interest_tags(sort_order);
CREATE INDEX idx_interest_tags_name ON interest_tags(name);
CREATE INDEX idx_interest_tags_metadata ON interest_tags USING GIN(metadata);

-- ----------------------------------------------------------------------------
-- USER_INTERESTS TABLE
-- ----------------------------------------------------------------------------
-- Tracks user interest selections
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    is_active BOOLEAN DEFAULT TRUE,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tag_id)
);

-- Indexes
CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX idx_user_interests_tag_id ON user_interests(tag_id);
CREATE INDEX idx_user_interests_priority ON user_interests(priority);
CREATE INDEX idx_user_interests_is_active ON user_interests(is_active);

-- ----------------------------------------------------------------------------
-- ENTITY_TAGS TABLE
-- ----------------------------------------------------------------------------
-- Universal tagging system for all platform entities
CREATE TABLE entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('organization', 'event', 'user', 'fundraiser', 'donation')),
    entity_id UUID NOT NULL,
    relevance_score INTEGER NOT NULL DEFAULT 50 CHECK (relevance_score >= 1 AND relevance_score <= 100),
    is_auto_tagged BOOLEAN DEFAULT FALSE,
    tagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tag_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity_type ON entity_tags(entity_type);
CREATE INDEX idx_entity_tags_entity_id ON entity_tags(entity_id);
CREATE INDEX idx_entity_tags_relevance_score ON entity_tags(relevance_score);
CREATE INDEX idx_entity_tags_type_id ON entity_tags(entity_type, entity_id);
CREATE INDEX idx_entity_tags_auto_tagged ON entity_tags(is_auto_tagged);

-- ----------------------------------------------------------------------------
-- USER_FEED_PREFERENCES TABLE
-- ----------------------------------------------------------------------------
-- User personalization preferences
CREATE TABLE user_feed_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_weights JSONB DEFAULT '{}',
    content_type_preferences JSONB DEFAULT '{"fundraisers": 50, "events": 50, "organizations": 50}',
    feed_algorithm VARCHAR(20) DEFAULT 'mixed' CHECK (feed_algorithm IN ('latest', 'relevance', 'popularity', 'mixed')),
    show_recommended_content BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_feed_preferences_user_id ON user_feed_preferences(user_id);

-- ============================================================================
-- SECTION 6: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- ----------------------------------------------------------------------------
-- Automatically updates updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fundraisers_updated_at
    BEFORE UPDATE ON fundraisers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disbursements_updated_at
    BEFORE UPDATE ON disbursements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interest_categories_updated_at
    BEFORE UPDATE ON interest_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interest_tags_updated_at
    BEFORE UPDATE ON interest_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_interests_updated_at
    BEFORE UPDATE ON user_interests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_tags_updated_at
    BEFORE UPDATE ON entity_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_feed_preferences_updated_at
    BEFORE UPDATE ON user_feed_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Function: generate_reference_number
-- ----------------------------------------------------------------------------
-- Generates unique reference numbers for transactions
CREATE OR REPLACE FUNCTION generate_reference_number(prefix text DEFAULT 'REF')
RETURNS text AS $$
BEGIN
    RETURN prefix || '-' ||
           extract(year from current_timestamp) ||
           lpad(extract(month from current_timestamp)::text, 2, '0') ||
           lpad(extract(day from current_timestamp)::text, 2, '0') || '-' ||
           upper(encode(gen_random_bytes(4), 'hex'));
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: REPORTING VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: fundraiser_summary
-- ----------------------------------------------------------------------------
-- Comprehensive fundraiser metrics with real-time calculations
CREATE VIEW reporting.fundraiser_summary AS
SELECT
    f.*,
    o.name as organization_name,
    o.organization_type,
    o.verification_status as org_verification_status,
    COALESCE(stats.actual_raised, 0) as actual_raised,
    COALESCE(stats.donation_count, 0) as actual_donation_count,
    COALESCE(stats.unique_donors, 0) as actual_unique_donors,
    stats.last_donation_at as actual_last_donation,
    CASE
        WHEN f.goal_amount > 0 AND f.goal_amount IS NOT NULL THEN
            ROUND((COALESCE(stats.actual_raised, 0) / f.goal_amount * 100), 2)
        ELSE 0
    END as progress_percentage,
    CASE
        WHEN COALESCE(stats.donation_count, 0) > 0 THEN
            ROUND(COALESCE(stats.actual_raised, 0) / stats.donation_count, 2)
        ELSE 0
    END as average_donation,
    CASE
        WHEN f.end_date IS NOT NULL AND f.end_date > CURRENT_TIMESTAMP THEN
            extract(day from f.end_date - CURRENT_TIMESTAMP)
        ELSE 0
    END as days_remaining,
    f.end_date < CURRENT_TIMESTAMP as is_expired,
    f.start_date > CURRENT_TIMESTAMP as is_upcoming,
    f.start_date <= CURRENT_TIMESTAMP AND (f.end_date IS NULL OR f.end_date > CURRENT_TIMESTAMP) as is_active
FROM fundraisers f
LEFT JOIN organizations o ON f.organization_id = o.id
LEFT JOIN (
    SELECT
        fundraiser_id,
        SUM(amount) as actual_raised,
        COUNT(*) as donation_count,
        COUNT(DISTINCT user_id) as unique_donors,
        MAX(completed_at) as last_donation_at
    FROM donations
    WHERE status = 'completed'
    GROUP BY fundraiser_id
) stats ON f.id = stats.fundraiser_id;

COMMENT ON VIEW reporting.fundraiser_summary IS 'Comprehensive fundraiser metrics with real-time calculations';

-- ----------------------------------------------------------------------------
-- VIEW: user_donation_summary
-- ----------------------------------------------------------------------------
-- User donation history and engagement metrics
CREATE VIEW reporting.user_donation_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.kyc_status,
    u.created_at as user_created_at,
    COUNT(d.id) as total_donations,
    COALESCE(SUM(d.amount), 0) as total_donated,
    COALESCE(AVG(d.amount), 0) as average_donation,
    MAX(d.completed_at) as last_donation_at,
    MIN(d.completed_at) as first_donation_at,
    COUNT(DISTINCT d.organization_id) as organizations_supported,
    COUNT(DISTINCT d.fundraiser_id) as fundraisers_supported,
    COUNT(d.id) FILTER (WHERE d.is_recurring = true) as recurring_donations,
    COUNT(d.id) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as donations_last_30_days,
    COALESCE(SUM(d.amount) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0) as amount_last_30_days
FROM users u
LEFT JOIN donations d ON u.id = d.user_id AND d.status = 'completed'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.kyc_status, u.created_at;

COMMENT ON VIEW reporting.user_donation_summary IS 'User donation history and engagement metrics';

-- ----------------------------------------------------------------------------
-- VIEW: organization_financial_summary
-- ----------------------------------------------------------------------------
-- Organization financial status and performance metrics
CREATE VIEW reporting.organization_financial_summary AS
SELECT
    o.*,
    COALESCE(stats.total_raised, 0) as total_raised,
    COALESCE(stats.total_donations, 0) as total_donations,
    COALESCE(stats.unique_donors, 0) as unique_donors,
    COALESCE(stats.active_fundraisers, 0) as active_fundraisers,
    stats.last_donation_at,
    COALESCE(stats.donations_last_30_days, 0) as donations_last_30_days,
    COALESCE(stats.amount_last_30_days, 0) as amount_last_30_days,
    COALESCE(disbursement_stats.total_disbursed, 0) as total_disbursed,
    COALESCE(disbursement_stats.pending_disbursement, 0) as pending_disbursement,
    disbursement_stats.last_disbursement_at,
    COALESCE(stats.total_raised, 0) - COALESCE(disbursement_stats.total_disbursed, 0) as available_balance
FROM organizations o
LEFT JOIN (
    SELECT
        d.organization_id,
        SUM(d.amount) as total_raised,
        COUNT(d.id) as total_donations,
        COUNT(DISTINCT d.user_id) as unique_donors,
        COUNT(DISTINCT d.fundraiser_id) FILTER (WHERE f.status = 'active') as active_fundraisers,
        MAX(d.completed_at) as last_donation_at,
        COUNT(d.id) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as donations_last_30_days,
        SUM(d.amount) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as amount_last_30_days
    FROM donations d
    LEFT JOIN fundraisers f ON d.fundraiser_id = f.id
    WHERE d.status = 'completed'
    GROUP BY d.organization_id
) stats ON o.id = stats.organization_id
LEFT JOIN (
    SELECT
        organization_id,
        SUM(amount) FILTER (WHERE status = 'completed') as total_disbursed,
        SUM(amount) FILTER (WHERE status IN ('pending', 'processing')) as pending_disbursement,
        MAX(completed_at) as last_disbursement_at
    FROM disbursements
    GROUP BY organization_id
) disbursement_stats ON o.id = disbursement_stats.organization_id;

COMMENT ON VIEW reporting.organization_financial_summary IS 'Organization financial status and performance metrics';

-- ----------------------------------------------------------------------------
-- MATERIALIZED VIEW: daily_donation_stats
-- ----------------------------------------------------------------------------
-- Daily aggregated donation statistics
CREATE MATERIALIZED VIEW reporting.daily_donation_stats AS
SELECT
    DATE(d.created_at) as donation_date,
    COUNT(*) as donation_count,
    SUM(d.amount) as total_amount,
    AVG(d.amount) as average_amount,
    COUNT(DISTINCT d.user_id) as unique_donors,
    COUNT(DISTINCT d.organization_id) as organizations_receiving,
    COUNT(DISTINCT d.fundraiser_id) as active_fundraisers,
    COUNT(*) FILTER (WHERE d.payment_method_type = 'credit_card') as credit_card_count,
    COUNT(*) FILTER (WHERE d.payment_method_type = 'bank_transfer') as bank_transfer_count,
    COUNT(*) FILTER (WHERE d.is_recurring = true) as recurring_count,
    COUNT(*) FILTER (WHERE d.is_recurring = false) as one_time_count
FROM donations d
WHERE d.status = 'completed'
GROUP BY DATE(d.created_at)
ORDER BY donation_date DESC;

CREATE INDEX idx_daily_stats_date ON reporting.daily_donation_stats (donation_date);

COMMENT ON MATERIALIZED VIEW reporting.daily_donation_stats IS 'Daily aggregated donation statistics for reporting and analytics';

-- ----------------------------------------------------------------------------
-- VIEW: v_interest_tags_with_categories
-- ----------------------------------------------------------------------------
-- Tags with their category information
CREATE VIEW v_interest_tags_with_categories AS
SELECT
    t.*,
    c.name as category_name,
    c.slug as category_slug,
    c.icon_name as category_icon,
    c.color_hex as category_color_hex,
    c.color_bg as category_color_bg
FROM interest_tags t
LEFT JOIN interest_categories c ON t.category_id = c.id
WHERE t.is_active = true AND c.is_active = true;

-- ----------------------------------------------------------------------------
-- VIEW: v_user_content_relevance
-- ----------------------------------------------------------------------------
-- Personalized content scoring
CREATE VIEW v_user_content_relevance AS
SELECT
    ui.user_id,
    et.entity_type,
    et.entity_id,
    AVG(ui.priority * et.relevance_score / 100.0) as relevance_score,
    COUNT(*) as matching_interests
FROM user_interests ui
JOIN entity_tags et ON ui.tag_id = et.tag_id
WHERE ui.is_active = true
GROUP BY ui.user_id, et.entity_type, et.entity_id;

-- ============================================================================
-- SECTION 8: SEED DATA FOR INTEREST TAGS
-- ============================================================================

-- Insert default interest categories
INSERT INTO interest_categories (name, slug, description, icon_name, color_hex, color_bg, sort_order) VALUES
('Climate & Environment', 'climate-environment', 'Environmental protection and climate action initiatives', 'Leaf', '#10B981', '#D1FAE5', 1),
('Healthcare', 'healthcare', 'Healthcare access and medical policy advocacy', 'Heart', '#EF4444', '#FEE2E2', 2),
('Education', 'education', 'Educational policy and institutional support', 'GraduationCap', '#3B82F6', '#DBEAFE', 3),
('Economy & Jobs', 'economy-jobs', 'Economic policy and employment initiatives', 'Briefcase', '#F59E0B', '#FEF3C7', 4),
('Civil Rights', 'civil-rights', 'Human rights and civil liberties advocacy', 'Scale', '#8B5CF6', '#EDE9FE', 5),
('Foreign Policy', 'foreign-policy', 'International relations and diplomatic initiatives', 'Globe', '#06B6D4', '#CFFAFE', 6),
('Immigration', 'immigration', 'Immigration policy and reform advocacy', 'Users', '#84CC16', '#ECFCCB', 7),
('Criminal Justice', 'criminal-justice', 'Law enforcement and justice system reform', 'Shield', '#6366F1', '#E0E7FF', 8),
('Technology & Privacy', 'technology-privacy', 'Digital rights and technology policy', 'Smartphone', '#EC4899', '#FCE7F3', 9),
('Social Issues', 'social-issues', 'Community welfare and social justice initiatives', 'Home', '#14B8A6', '#CCFBF1', 10)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample interest tags
INSERT INTO interest_tags (category_id, name, slug, description, icon_name, sort_order, metadata)
SELECT
    c.id,
    v.name,
    v.slug,
    v.description,
    v.icon_name,
    v.sort_order,
    v.metadata::jsonb
FROM interest_categories c
CROSS JOIN (VALUES
    -- Climate & Environment tags
    ('climate-environment', 'Renewable Energy', 'renewable-energy', 'Solar, wind and clean energy initiatives', 'Sun', 1, '{"policy_areas": ["energy_grid", "subsidies"]}'),
    ('climate-environment', 'Climate Change', 'climate-change', 'Global warming and climate adaptation policies', 'CloudRain', 2, '{"urgency": "high", "scope": "global"}'),
    ('climate-environment', 'Environmental Protection', 'environmental-protection', 'Conservation and ecosystem preservation', 'TreePine', 3, '{"focus": ["wildlife", "forests", "oceans"]}'),
    -- Healthcare tags
    ('healthcare', 'Universal Healthcare', 'universal-healthcare', 'Healthcare as a human right for all citizens', 'Heart', 1, '{"model": "single_payer"}'),
    ('healthcare', 'Prescription Drugs', 'prescription-drugs', 'Affordable medication and drug pricing reform', 'Pill', 2, '{"focus": ["pricing", "access", "imports"]}'),
    ('healthcare', 'Mental Health', 'mental-health', 'Mental healthcare access and stigma reduction', 'Brain', 3, '{"services": ["therapy", "crisis_intervention"]}'),
    -- Education tags
    ('education', 'Public Education', 'public-education', 'K-12 public school funding and quality', 'School', 1, '{"levels": ["elementary", "high_school"]}'),
    ('education', 'Higher Education', 'higher-education', 'College affordability and student debt relief', 'GraduationCap', 2, '{"focus": ["tuition", "student_loans"]}'),
    ('education', 'Teacher Support', 'teacher-support', 'Teacher pay, working conditions and resources', 'UserCheck', 3, '{"issues": ["salary", "classroom_resources"]}')
) v(category_slug, name, slug, description, icon_name, sort_order, metadata)
WHERE c.slug = v.category_slug
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Grant appropriate permissions (adjust as needed for your Supabase setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO authenticated;
-- GRANT SELECT ON audit.audit_logs TO authenticated;
