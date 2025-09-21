# Database Schema Design - Political Donation Platform

## Overview

PostgreSQL database schema optimized for political donation processing, compliance tracking, and audit requirements with FluidPay API integration.

## Schema Design Principles

- **ACID Compliance**: All financial transactions are atomic and consistent
- **Audit Trail**: Complete history of all changes with timestamps and user tracking
- **Encryption**: Sensitive data encrypted at field level
- **Partitioning**: Large tables partitioned by date for performance
- **Referential Integrity**: Foreign keys with proper cascading rules
- **Compliance Ready**: Schema supports FEC and state-level reporting requirements

## Core Entities & Relationships

```sql
-- Users (Donors & Admins)
-- Organizations (Political entities)
-- Fundraisers (Campaigns/Events)
-- Donations (Transactions)
-- Disbursements (Payouts to organizations)
-- Compliance Records (Regulatory tracking)
```

## Detailed Schema

### 1. Users Table

```sql
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

    -- FluidPay Integration
    fluidpay_customer_id VARCHAR(255),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Indexes
    INDEX idx_users_email (email),
    INDEX idx_users_fluidpay (fluidpay_customer_id),
    INDEX idx_users_status (status, kyc_status)
);
```

### 2. Organizations Table

```sql
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
    updated_by UUID,

    -- Indexes
    INDEX idx_orgs_status (status, verification_status),
    INDEX idx_orgs_fec (fec_id),
    INDEX idx_orgs_type (organization_type)
);
```

### 3. Organization Users Table (Many-to-Many)

```sql
CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'treasurer', 'staff', 'viewer')),
    permissions JSONB, -- specific permissions for this user

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Constraints
    UNIQUE(organization_id, user_id),
    INDEX idx_org_users_org (organization_id),
    INDEX idx_org_users_user (user_id)
);
```

### 4. Fundraisers Table

```sql
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

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'cancelled'
    )),

    -- Statistics (derived fields for performance)
    total_raised DECIMAL(12,2) DEFAULT 0,
    donation_count INTEGER DEFAULT 0,
    last_donation_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Indexes
    INDEX idx_fundraisers_org (organization_id),
    INDEX idx_fundraisers_status (status),
    INDEX idx_fundraisers_dates (start_date, end_date),
    INDEX idx_fundraisers_slug (slug)
);
```

### 5. Donations Table (Partitioned by Date)

```sql
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fundraiser_id UUID NOT NULL REFERENCES fundraisers(id),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Transaction Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    fee_amount DECIMAL(8,2), -- platform fee
    net_amount DECIMAL(10,2), -- amount after fees

    -- FluidPay Integration
    fluidpay_transaction_id VARCHAR(255),
    fluidpay_customer_id VARCHAR(255),
    payment_method_type VARCHAR(50), -- credit_card, bank_transfer, etc.
    payment_method_last4 VARCHAR(4),

    -- Transaction Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
    )),
    failure_reason TEXT,

    -- Recurring Donation Support
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annually')),
    parent_donation_id UUID REFERENCES donations(id), -- for recurring donations

    -- Compliance Information
    donor_employer VARCHAR(255),
    donor_occupation VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT false,
    compliance_flags JSONB, -- any compliance-related flags or notes

    -- Processing Timestamps
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_donations_fundraiser (fundraiser_id),
    INDEX idx_donations_user (user_id),
    INDEX idx_donations_org (organization_id),
    INDEX idx_donations_status (status),
    INDEX idx_donations_fluidpay (fluidpay_transaction_id),
    INDEX idx_donations_created (created_at),
    INDEX idx_donations_recurring (is_recurring, recurring_frequency)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for donations table
CREATE TABLE donations_2024_01 PARTITION OF donations
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... additional partitions as needed
```

### 6. Disbursements Table

```sql
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

    -- References
    reference_number VARCHAR(100),
    external_transaction_id VARCHAR(255),
    batch_id UUID, -- for grouping multiple disbursements

    -- Notes
    memo TEXT,
    internal_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP,

    -- Indexes
    INDEX idx_disbursements_org (organization_id),
    INDEX idx_disbursements_status (status),
    INDEX idx_disbursements_created (created_at),
    INDEX idx_disbursements_batch (batch_id)
);
```

### 7. Compliance Reports Table

```sql
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Report Details
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'fec_quarterly', 'fec_monthly', 'state_quarterly', 'annual_summary'
    )),
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    filing_deadline DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'filed', 'amended'
    )),

    -- Content
    report_data JSONB NOT NULL, -- the actual report content
    generated_file_url VARCHAR(500), -- PDF/CSV export

    -- Filing Information
    filed_at TIMESTAMP,
    filed_by UUID,
    confirmation_number VARCHAR(100),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Indexes
    INDEX idx_compliance_org (organization_id),
    INDEX idx_compliance_type (report_type),
    INDEX idx_compliance_period (reporting_period_start, reporting_period_end),
    INDEX idx_compliance_status (status)
);
```

### 8. Audit Log Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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
    ip_address INET,
    user_agent TEXT,

    -- Context
    endpoint VARCHAR(255),
    request_id UUID,

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_audit_table (table_name),
    INDEX idx_audit_record (record_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_created (created_at)
) PARTITION BY RANGE (created_at);
```

### 9. System Configuration Table

```sql
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default configuration
INSERT INTO system_config (key, value, description) VALUES
('donation_limits', '{"individual_annual": 2900, "individual_per_election": 3300}', 'Federal donation limits'),
('platform_fees', '{"percentage": 2.9, "fixed_fee": 0.30}', 'Platform processing fees'),
('compliance_thresholds', '{"require_employer_info": 200, "itemize_threshold": 200}', 'Compliance reporting thresholds');
```

## Views for Common Queries

### 1. Fundraiser Summary View

```sql
CREATE VIEW fundraiser_summary AS
SELECT
    f.*,
    o.name as organization_name,
    COALESCE(SUM(d.amount), 0) as actual_raised,
    COUNT(d.id) as total_donations,
    MAX(d.created_at) as last_donation_at,
    CASE
        WHEN f.goal_amount > 0 THEN ROUND((COALESCE(SUM(d.amount), 0) / f.goal_amount * 100), 2)
        ELSE 0
    END as progress_percentage
FROM fundraisers f
LEFT JOIN organizations o ON f.organization_id = o.id
LEFT JOIN donations d ON f.id = d.fundraiser_id AND d.status = 'completed'
GROUP BY f.id, o.name;
```

### 2. User Donation Summary View

```sql
CREATE VIEW user_donation_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(d.id) as total_donations,
    SUM(d.amount) as total_donated,
    MAX(d.created_at) as last_donation_at,
    COUNT(DISTINCT d.organization_id) as organizations_supported
FROM users u
LEFT JOIN donations d ON u.id = d.user_id AND d.status = 'completed'
GROUP BY u.id, u.email, u.first_name, u.last_name;
```

## Triggers and Functions

### 1. Update Statistics Trigger

```sql
-- Function to update fundraiser statistics
CREATE OR REPLACE FUNCTION update_fundraiser_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update fundraiser totals when donations change
    UPDATE fundraisers
    SET
        total_raised = (
            SELECT COALESCE(SUM(amount), 0)
            FROM donations
            WHERE fundraiser_id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id)
            AND status = 'completed'
        ),
        donation_count = (
            SELECT COUNT(*)
            FROM donations
            WHERE fundraiser_id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id)
            AND status = 'completed'
        ),
        last_donation_at = (
            SELECT MAX(created_at)
            FROM donations
            WHERE fundraiser_id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id)
            AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER donation_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_stats();
```

### 2. Audit Log Trigger

```sql
-- Function for audit logging
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        COALESCE(NEW.updated_by, OLD.updated_by)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to key tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
CREATE TRIGGER audit_donations AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
-- ... apply to other sensitive tables
```

## Performance Optimizations

### 1. Indexes for Common Queries

```sql
-- Composite indexes for common filter combinations
CREATE INDEX idx_donations_org_status_date ON donations (organization_id, status, created_at);
CREATE INDEX idx_fundraisers_org_status ON fundraisers (organization_id, status);
CREATE INDEX idx_users_role_status ON users (role, status, kyc_status);

-- Partial indexes for active records
CREATE INDEX idx_active_fundraisers ON fundraisers (organization_id) WHERE status = 'active';
CREATE INDEX idx_completed_donations ON donations (fundraiser_id, amount) WHERE status = 'completed';
```

### 2. Materialized Views for Reporting

```sql
CREATE MATERIALIZED VIEW daily_donation_stats AS
SELECT
    DATE(created_at) as donation_date,
    COUNT(*) as donation_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount,
    COUNT(DISTINCT user_id) as unique_donors,
    COUNT(DISTINCT organization_id) as organizations_receiving
FROM donations
WHERE status = 'completed'
GROUP BY DATE(created_at);

-- Refresh policy
CREATE INDEX idx_daily_stats_date ON daily_donation_stats (donation_date);
```

## Security Considerations

### 1. Row Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY user_data_policy ON users
    FOR ALL TO authenticated_user
    USING (id = current_user_id());

-- Organization admins can see their org data
CREATE POLICY org_donation_policy ON donations
    FOR ALL TO authenticated_user
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_users
            WHERE user_id = current_user_id()
        )
    );
```

### 2. Encryption Functions

```sql
-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;
```

## Migration Strategy

### 1. Initial Setup Script

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Set up initial roles and permissions
-- (to be defined based on deployment environment)
```

### 2. Sample Data for Testing

```sql
-- Insert test users
INSERT INTO users (email, first_name, last_name, street_address, city, state, postal_code, employer, occupation, citizenship_status, kyc_status)
VALUES
('donor1@example.com', 'John', 'Doe', '123 Main St', 'Anytown', 'CA', '90210', 'Tech Corp', 'Software Engineer', 'citizen', 'verified'),
('donor2@example.com', 'Jane', 'Smith', '456 Oak Ave', 'Springfield', 'NY', '12345', 'Non-Profit Inc', 'Program Manager', 'citizen', 'verified');

-- Insert test organization
INSERT INTO organizations (name, legal_name, organization_type, email, street_address, city, state, postal_code, fec_id, verification_status)
VALUES
('Citizens for Better Government', 'Citizens for Better Government PAC', 'pac', 'contact@bettergovpac.org', '789 Democracy Blvd', 'Washington', 'DC', '20001', 'C00123456', 'verified');
```

This schema provides a solid foundation for your political donation platform with proper compliance tracking, audit trails, and integration points for FluidPay API.