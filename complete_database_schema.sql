-- ============================================================================
-- ADVOTECATE COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Political donation platform with FluidPay integration
-- Generated from backend/database/migrations
-- Database: PostgreSQL 14+ / Supabase
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS AND SCHEMAS
-- ============================================================================

-- Create PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Comment on schemas
COMMENT ON SCHEMA audit IS 'Schema for audit and compliance tracking';
COMMENT ON SCHEMA reporting IS 'Schema for reporting and analytics views';

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS TABLE
-- ----------------------------------------------------------------------------
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

    -- Address Information (required for political donations)
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

-- Indexes for performance
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
COMMENT ON TABLE organizations IS 'Political organizations that can receive donations';
COMMENT ON COLUMN organizations.bank_account_number IS 'Encrypted bank account for disbursements';
COMMENT ON COLUMN organizations.routing_number IS 'Encrypted bank routing number';
COMMENT ON COLUMN organizations.verification_documents IS 'JSONB array of document references for verification';

-- ----------------------------------------------------------------------------
-- ORGANIZATION_USERS TABLE
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- FUNDRAISERS TABLE
-- ----------------------------------------------------------------------------
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
CREATE INDEX idx_fundraisers_search ON fundraisers USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Comments
COMMENT ON TABLE fundraisers IS 'Fundraising campaigns and events';
COMMENT ON COLUMN fundraisers.slug IS 'URL-friendly identifier for the fundraiser';
COMMENT ON COLUMN fundraisers.custom_fields IS 'JSONB for flexible additional campaign data';
COMMENT ON COLUMN fundraisers.suggested_amounts IS 'Array of suggested donation amounts in dollars';

-- ----------------------------------------------------------------------------
-- DONATIONS TABLE (PARTITIONED)
-- ----------------------------------------------------------------------------
CREATE TABLE donations (
    id UUID DEFAULT gen_random_uuid(),
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
    parent_donation_id UUID, -- for recurring donations (no FK due to partitioning)
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions for 2024
CREATE TABLE donations_2024_01 PARTITION OF donations FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE donations_2024_02 PARTITION OF donations FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE donations_2024_03 PARTITION OF donations FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE donations_2024_04 PARTITION OF donations FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE donations_2024_05 PARTITION OF donations FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE donations_2024_06 PARTITION OF donations FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE donations_2024_07 PARTITION OF donations FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE donations_2024_08 PARTITION OF donations FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE donations_2024_09 PARTITION OF donations FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE donations_2024_10 PARTITION OF donations FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE donations_2024_11 PARTITION OF donations FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE donations_2024_12 PARTITION OF donations FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Indexes on main table (inherited by partitions)
CREATE INDEX idx_donations_fundraiser ON donations (fundraiser_id);
CREATE INDEX idx_donations_user ON donations (user_id);
CREATE INDEX idx_donations_org ON donations (organization_id);
CREATE INDEX idx_donations_status ON donations (status);
CREATE INDEX idx_donations_fluidpay ON donations (fluidpay_transaction_id) WHERE fluidpay_transaction_id IS NOT NULL;
CREATE INDEX idx_donations_created ON donations (created_at);
CREATE INDEX idx_donations_recurring ON donations (is_recurring, recurring_frequency) WHERE is_recurring = true;
CREATE INDEX idx_donations_completed ON donations (status, completed_at) WHERE status = 'completed';

-- Comments
COMMENT ON TABLE donations IS 'Individual donation transactions, partitioned by creation date';
COMMENT ON COLUMN donations.net_amount IS 'Amount after platform and processing fees';
COMMENT ON COLUMN donations.compliance_flags IS 'JSONB for compliance-related metadata';

-- ----------------------------------------------------------------------------
-- DISBURSEMENTS TABLE
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- COMPLIANCE_REPORTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Report Details
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'fec_quarterly', 'fec_monthly', 'fec_pre_election', 'fec_post_election',
        'state_quarterly', 'state_monthly', 'annual_summary', 'itemized_contributions'
    )),
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    filing_deadline DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'approved', 'filed', 'amended', 'rejected'
    )),

    -- Report Content
    report_data JSONB NOT NULL, -- the actual report content
    generated_file_url VARCHAR(500), -- PDF/CSV export
    generated_file_size INTEGER,
    generated_file_checksum VARCHAR(64), -- SHA-256 checksum

    -- Version control for amendments
    version INTEGER DEFAULT 1,
    amended_report_id UUID REFERENCES compliance_reports(id),
    amendment_description TEXT,

    -- Filing Information
    filed_at TIMESTAMP,
    filed_by UUID,
    filing_confirmation_number VARCHAR(100),
    filing_receipt_url VARCHAR(500),

    -- Metadata
    total_contributions DECIMAL(12,2),
    total_expenditures DECIMAL(12,2),
    itemized_contributions_count INTEGER,
    unique_contributors_count INTEGER,

    -- Validation
    validation_errors JSONB, -- array of validation issues
    validation_warnings JSONB, -- array of warnings

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    reviewed_by UUID,
    reviewed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_compliance_org ON compliance_reports (organization_id);
CREATE INDEX idx_compliance_type ON compliance_reports (report_type);
CREATE INDEX idx_compliance_period ON compliance_reports (reporting_period_start, reporting_period_end);
CREATE INDEX idx_compliance_status ON compliance_reports (status);
CREATE INDEX idx_compliance_filing_deadline ON compliance_reports (filing_deadline) WHERE status IN ('draft', 'pending_review');
CREATE INDEX idx_compliance_created ON compliance_reports (created_at);

-- Comments
COMMENT ON TABLE compliance_reports IS 'FEC and state regulatory compliance reports';
COMMENT ON COLUMN compliance_reports.report_data IS 'JSONB containing the structured report data';
COMMENT ON COLUMN compliance_reports.validation_errors IS 'JSONB array of validation errors preventing filing';
COMMENT ON COLUMN compliance_reports.validation_warnings IS 'JSONB array of non-blocking validation warnings';

-- ============================================================================
-- SECTION 3: AUDIT AND SYSTEM TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- AUDIT_LOGS TABLE (PARTITIONED)
-- ----------------------------------------------------------------------------
CREATE TABLE audit.audit_logs (
    id UUID DEFAULT gen_random_uuid(),

    -- What was changed
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

    -- Changes
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- Who and when
    user_id UUID,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Context
    endpoint VARCHAR(255),
    request_id UUID,
    correlation_id UUID,

    -- Risk and security
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    security_flags TEXT[],

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly audit partitions for 2024
CREATE TABLE audit.audit_logs_2024_01 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE audit.audit_logs_2024_02 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE audit.audit_logs_2024_03 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE audit.audit_logs_2024_04 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE audit.audit_logs_2024_05 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE audit.audit_logs_2024_06 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE audit.audit_logs_2024_07 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE audit.audit_logs_2024_08 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE audit.audit_logs_2024_09 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE audit.audit_logs_2024_10 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE audit.audit_logs_2024_11 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE audit.audit_logs_2024_12 PARTITION OF audit.audit_logs FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Indexes
CREATE INDEX idx_audit_table ON audit.audit_logs (table_name);
CREATE INDEX idx_audit_record ON audit.audit_logs (record_id);
CREATE INDEX idx_audit_user ON audit.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit.audit_logs (created_at);
CREATE INDEX idx_audit_operation ON audit.audit_logs (operation);
CREATE INDEX idx_audit_risk ON audit.audit_logs (risk_score) WHERE risk_score > 50;

-- Comments
COMMENT ON TABLE audit.audit_logs IS 'Comprehensive audit trail for all database changes';
COMMENT ON COLUMN audit.audit_logs.risk_score IS 'Calculated risk score for this operation (0-100)';
COMMENT ON COLUMN audit.audit_logs.security_flags IS 'Array of security-related flags for this operation';

-- ----------------------------------------------------------------------------
-- SYSTEM_CONFIG TABLE
-- ----------------------------------------------------------------------------
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

-- Insert default Advotecate configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
('donation_limits',
 '{"individual_annual": 2900, "individual_per_election": 3300, "pac_annual": 5000}',
 'Federal donation limits per FEC regulations',
 'compliance',
 true),
('platform_fees',
 '{"percentage": 2.9, "fixed_fee": 0.30, "recurring_discount": 0.1}',
 'Advotecate platform processing fees',
 'financial',
 true),
('compliance_thresholds',
 '{"require_employer_info": 200, "itemize_threshold": 200, "aggregate_threshold": 200}',
 'Compliance reporting thresholds',
 'compliance',
 false),
('feature_flags',
 '{"recurring_donations": true, "anonymous_donations": false, "international_donations": false, "crypto_donations": false}',
 'Advotecate feature toggles',
 'features',
 true),
('email_templates',
 '{"donation_confirmation": "donation_confirmation_v1", "receipt": "receipt_v1", "failure": "donation_failure_v1"}',
 'Email template versions',
 'messaging',
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
 '{"enabled": false, "message": "Advotecate is temporarily unavailable for maintenance.", "estimated_end": null}',
 'Maintenance mode settings',
 'system',
 true);

-- Indexes
CREATE INDEX idx_system_config_category ON system_config (category);
CREATE INDEX idx_system_config_public ON system_config (is_public) WHERE is_public = true;
CREATE INDEX idx_system_config_updated ON system_config (updated_at);

-- Comments
COMMENT ON TABLE system_config IS 'System-wide configuration settings for Advotecate';
COMMENT ON COLUMN system_config.is_public IS 'Whether this configuration can be safely exposed to frontend applications';
COMMENT ON COLUMN system_config.is_encrypted IS 'Whether the value field contains encrypted data';

-- ============================================================================
-- SECTION 4: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
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

-- ----------------------------------------------------------------------------
-- Function: update_fundraiser_stats
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_fundraiser_stats()
RETURNS TRIGGER AS $$
DECLARE
    fundraiser_uuid UUID;
BEGIN
    fundraiser_uuid := COALESCE(NEW.fundraiser_id, OLD.fundraiser_id);

    UPDATE fundraisers
    SET
        total_raised = COALESCE((
            SELECT SUM(amount)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ), 0),
        donation_count = (
            SELECT COUNT(*)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        unique_donors_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        last_donation_at = (
            SELECT MAX(completed_at)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = fundraiser_uuid;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for donation statistics
CREATE TRIGGER donation_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_stats();

-- ----------------------------------------------------------------------------
-- Function: audit_log_changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields text[];
    old_json jsonb;
    new_json jsonb;
BEGIN
    old_json := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END;
    new_json := CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;

    IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(key)
        INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key;
    END IF;

    INSERT INTO audit.audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_fields,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE((NEW).id, (OLD).id),
        TG_OP,
        old_json,
        new_json,
        changed_fields,
        COALESCE(
            (NEW).updated_by,
            (OLD).updated_by,
            (NEW).created_by,
            (OLD).created_by
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_donations
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_disbursements
    AFTER INSERT OR UPDATE OR DELETE ON disbursements
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_fundraisers
    AFTER INSERT OR UPDATE OR DELETE ON fundraisers
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- ----------------------------------------------------------------------------
-- Function: generate_reference_number
-- ----------------------------------------------------------------------------
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
-- SECTION 5: REPORTING VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: fundraiser_summary
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
