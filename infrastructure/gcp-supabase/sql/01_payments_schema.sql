-- Advotecate Payments Database Schema
-- Phase 1: Core payment processing tables
-- Created for Supabase on GCP deployment

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create payments schema
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Set search path
SET search_path TO payments, compliance, public;

-- =============================================
-- CORE PAYMENT TABLES
-- =============================================

-- Payment Methods (Credit Cards, Bank Accounts, etc.)
CREATE TABLE IF NOT EXISTS payments.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('credit_card', 'debit_card', 'bank_account', 'paypal', 'apple_pay', 'google_pay')),

    -- Card details (encrypted)
    last_four_digits VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    brand VARCHAR(50), -- visa, mastercard, amex, etc.

    -- Bank account details (encrypted)
    bank_name VARCHAR(255),
    account_type VARCHAR(50),

    -- Security and compliance
    encrypted_data JSONB, -- Encrypted sensitive data
    processor_token VARCHAR(255), -- FluidPay token
    is_verified BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Will reference users later

    -- Indexes
    CONSTRAINT payment_methods_expiry_check CHECK (
        (expiry_month IS NULL AND expiry_year IS NULL) OR
        (expiry_month BETWEEN 1 AND 12 AND expiry_year >= EXTRACT(YEAR FROM NOW()))
    )
);

-- Donations/Transactions table
CREATE TABLE IF NOT EXISTS payments.donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Amount and currency
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Recurring donation setup
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    recurring_day_of_month INTEGER CHECK (recurring_day_of_month BETWEEN 1 AND 28),

    -- Transaction status
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed')),

    -- Payment processing
    payment_method_id UUID REFERENCES payments.payment_methods(id),
    processor_transaction_id VARCHAR(255), -- FluidPay transaction ID
    processor_reference VARCHAR(255), -- Additional processor reference

    -- Failure and error handling
    failure_reason TEXT,
    failure_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,

    -- Fundraiser/Campaign association (will reference later)
    fundraiser_id UUID, -- To be linked to fundraisers table
    organization_id UUID, -- To be linked to organizations table

    -- Donor information (will reference users later)
    donor_id UUID, -- To be linked to users table

    -- Guest donor information (for non-registered donors)
    guest_donor_info JSONB, -- Encrypted donor details

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Compliance tracking
    compliance_checked BOOLEAN DEFAULT FALSE,
    compliance_status VARCHAR(50) DEFAULT 'pending'
        CHECK (compliance_status IN ('pending', 'approved', 'rejected', 'needs_review')),
    compliance_notes TEXT
);

-- Transaction Events/Audit Log
CREATE TABLE IF NOT EXISTS payments.transaction_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES payments.donations(id),

    -- Event details
    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN ('created', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed', 'compliance_check')),
    event_status VARCHAR(50) NOT NULL,

    -- Event data
    event_data JSONB DEFAULT '{}',
    processor_response JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Context
    created_by UUID, -- System/User who triggered the event
    ip_address INET,
    user_agent TEXT
);

-- Refunds table
CREATE TABLE IF NOT EXISTS payments.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES payments.donations(id),

    -- Refund details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason VARCHAR(255) NOT NULL,
    refund_type VARCHAR(50) DEFAULT 'full' CHECK (refund_type IN ('full', 'partial')),

    -- Processing
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processor_refund_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,

    -- Constraints
    CONSTRAINT refunds_amount_check CHECK (
        refund_type = 'full' OR
        (refund_type = 'partial' AND amount < (SELECT amount FROM payments.donations WHERE id = donation_id))
    )
);

-- =============================================
-- COMPLIANCE TABLES
-- =============================================

-- Compliance checks and limits
CREATE TABLE IF NOT EXISTS compliance.contribution_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Limit configuration
    organization_id UUID NOT NULL,
    limit_type VARCHAR(50) NOT NULL
        CHECK (limit_type IN ('individual_annual', 'individual_election', 'pac_annual', 'corporate_prohibited')),

    -- Amounts
    limit_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Time period
    effective_date DATE NOT NULL,
    expiry_date DATE,
    election_year INTEGER,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure no overlapping limits
    UNIQUE(organization_id, limit_type, effective_date)
);

-- Donor contribution tracking for compliance
CREATE TABLE IF NOT EXISTS compliance.donor_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Donor identification
    donor_id UUID, -- Will reference users table
    donor_identifier VARCHAR(255) NOT NULL, -- Email or other identifier
    organization_id UUID NOT NULL,

    -- Contribution totals
    total_amount DECIMAL(10,2) DEFAULT 0,
    election_cycle_amount DECIMAL(10,2) DEFAULT 0,
    annual_amount DECIMAL(10,2) DEFAULT 0,

    -- Time tracking
    election_year INTEGER,
    contribution_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),

    -- Compliance status
    requires_disclosure BOOLEAN DEFAULT FALSE,
    employer_required BOOLEAN DEFAULT FALSE,

    -- Last updated
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(donor_identifier, organization_id, contribution_year)
);

-- FEC Reporting data
CREATE TABLE IF NOT EXISTS compliance.fec_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Report details
    report_type VARCHAR(50) NOT NULL,
    filing_period_start DATE NOT NULL,
    filing_period_end DATE NOT NULL,
    organization_id UUID NOT NULL,

    -- Report data
    report_data JSONB NOT NULL,
    total_contributions DECIMAL(12,2),
    total_donors INTEGER,

    -- Filing status
    status VARCHAR(50) DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'filed', 'amended', 'rejected')),
    filed_at TIMESTAMP WITH TIME ZONE,
    fec_confirmation_number VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Payment Methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_created_by ON payments.payment_methods(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payments.payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_created_at ON payments.payment_methods(created_at);

-- Donations indexes
CREATE INDEX IF NOT EXISTS idx_donations_status ON payments.donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON payments.donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_organization_id ON payments.donations(organization_id);
CREATE INDEX IF NOT EXISTS idx_donations_fundraiser_id ON payments.donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON payments.donations(created_at);
CREATE INDEX IF NOT EXISTS idx_donations_amount ON payments.donations(amount);
CREATE INDEX IF NOT EXISTS idx_donations_recurring ON payments.donations(is_recurring, recurring_frequency);
CREATE INDEX IF NOT EXISTS idx_donations_processor_id ON payments.donations(processor_transaction_id);

-- Transaction Events indexes
CREATE INDEX IF NOT EXISTS idx_transaction_events_donation_id ON payments.transaction_events(donation_id);
CREATE INDEX IF NOT EXISTS idx_transaction_events_type ON payments.transaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_transaction_events_created_at ON payments.transaction_events(created_at);

-- Refunds indexes
CREATE INDEX IF NOT EXISTS idx_refunds_donation_id ON payments.refunds(donation_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON payments.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON payments.refunds(created_at);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_contribution_limits_org ON compliance.contribution_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_contribution_limits_effective ON compliance.contribution_limits(effective_date, expiry_date);

CREATE INDEX IF NOT EXISTS idx_donor_contributions_donor ON compliance.donor_contributions(donor_identifier);
CREATE INDEX IF NOT EXISTS idx_donor_contributions_org ON compliance.donor_contributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_donor_contributions_year ON compliance.donor_contributions(contribution_year);

CREATE INDEX IF NOT EXISTS idx_fec_reports_org ON compliance.fec_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_fec_reports_period ON compliance.fec_reports(filing_period_start, filing_period_end);
CREATE INDEX IF NOT EXISTS idx_fec_reports_status ON compliance.fec_reports(status);

-- =============================================
-- TRIGGERS FOR AUDIT AND UPDATES
-- =============================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payments.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON payments.donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contribution_limits_updated_at
    BEFORE UPDATE ON compliance.contribution_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donor_contributions_updated_at
    BEFORE UPDATE ON compliance.donor_contributions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fec_reports_updated_at
    BEFORE UPDATE ON compliance.fec_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA AND TESTING
-- =============================================

-- Insert sample contribution limits
INSERT INTO compliance.contribution_limits (organization_id, limit_type, limit_amount, effective_date, election_year) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'individual_annual', 3300.00, '2024-01-01', 2024),
    ('550e8400-e29b-41d4-a716-446655440000', 'individual_election', 6600.00, '2024-01-01', 2024)
ON CONFLICT (organization_id, limit_type, effective_date) DO NOTHING;

-- Create a test payment method
INSERT INTO payments.payment_methods (id, type, last_four_digits, expiry_month, expiry_year, brand, is_verified) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'credit_card', '4242', 12, 2025, 'visa', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- Donation summary view
CREATE OR REPLACE VIEW payments.donation_summary AS
SELECT
    d.id,
    d.amount,
    d.currency,
    d.status,
    d.is_recurring,
    d.recurring_frequency,
    d.created_at,
    d.organization_id,
    d.fundraiser_id,
    d.donor_id,
    pm.type as payment_method_type,
    pm.brand as payment_method_brand,
    pm.last_four_digits
FROM payments.donations d
LEFT JOIN payments.payment_methods pm ON d.payment_method_id = pm.id;

-- Compliance tracking view
CREATE OR REPLACE VIEW compliance.donor_contribution_status AS
SELECT
    dc.donor_identifier,
    dc.organization_id,
    dc.total_amount,
    dc.annual_amount,
    dc.contribution_year,
    cl.limit_amount as annual_limit,
    (cl.limit_amount - dc.annual_amount) as remaining_limit,
    CASE
        WHEN dc.annual_amount >= 200 THEN true
        ELSE false
    END as requires_employer_info,
    dc.requires_disclosure
FROM compliance.donor_contributions dc
LEFT JOIN compliance.contribution_limits cl ON (
    dc.organization_id = cl.organization_id
    AND cl.limit_type = 'individual_annual'
    AND cl.effective_date <= CURRENT_DATE
    AND (cl.expiry_date IS NULL OR cl.expiry_date >= CURRENT_DATE)
);

-- Grant permissions (adjust as needed for your Supabase setup)
-- GRANT USAGE ON SCHEMA payments TO authenticated;
-- GRANT USAGE ON SCHEMA compliance TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA payments TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA compliance TO authenticated;

COMMENT ON SCHEMA payments IS 'Core payment processing tables for Advotecate platform';
COMMENT ON SCHEMA compliance IS 'FEC compliance and contribution tracking tables';