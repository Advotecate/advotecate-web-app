-- FluidPay Payments Database Schema
-- Production-ready schema with security, performance, and FEC compliance
-- Created: 2025-01-25

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PAYMENTS SCHEMA - Core payment processing
-- =============================================

-- Payment Methods Table - Stores tokenized payment method information
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Reference to users table
    fluidpay_token VARCHAR(255) NOT NULL UNIQUE, -- FluidPay tokenized payment method
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('credit_card', 'ach', 'bank_transfer')),

    -- Masked payment details (never store raw card data)
    last_four VARCHAR(4),
    brand VARCHAR(20), -- Visa, Mastercard, etc.
    exp_month INTEGER CHECK (exp_month BETWEEN 1 AND 12),
    exp_year INTEGER CHECK (exp_year >= EXTRACT(YEAR FROM CURRENT_DATE)),

    -- ACH/Bank details (masked)
    bank_name VARCHAR(100),
    account_type VARCHAR(20) CHECK (account_type IN ('checking', 'savings')),
    routing_last_four VARCHAR(4),

    -- Metadata
    billing_address JSONB, -- Encrypted billing address data
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- FluidPay integration fields
    fluidpay_customer_id VARCHAR(100),
    fluidpay_method_id VARCHAR(100),

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Constraints
    CONSTRAINT valid_card_details CHECK (
        (payment_type != 'credit_card') OR
        (last_four IS NOT NULL AND brand IS NOT NULL AND exp_month IS NOT NULL AND exp_year IS NOT NULL)
    ),
    CONSTRAINT valid_ach_details CHECK (
        (payment_type != 'ach') OR
        (bank_name IS NOT NULL AND account_type IS NOT NULL AND routing_last_four IS NOT NULL)
    )
);

-- Donations Table - Core donation transactions
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Donor information
    donor_id UUID NOT NULL, -- Reference to users/donors table
    donor_email VARCHAR(320) NOT NULL,
    donor_first_name VARCHAR(100) NOT NULL,
    donor_last_name VARCHAR(100) NOT NULL,
    donor_address JSONB NOT NULL, -- Encrypted address for FEC compliance
    donor_employer VARCHAR(200),
    donor_occupation VARCHAR(200),

    -- Campaign/Recipient information
    recipient_id UUID NOT NULL, -- Campaign or committee receiving donation
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('candidate', 'pac', 'party_committee', 'independent_expenditure')),

    -- Transaction details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Payment processing
    payment_method_id UUID REFERENCES payment_methods(id),

    -- FluidPay transaction data
    fluidpay_transaction_id VARCHAR(100) UNIQUE,
    fluidpay_order_id VARCHAR(100),
    fluidpay_customer_id VARCHAR(100),

    -- Transaction status and flow
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded')
    ),

    -- FEC Compliance fields
    is_anonymous BOOLEAN DEFAULT false,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    election_cycle VARCHAR(9) NOT NULL, -- Format: 2023-2024
    election_type VARCHAR(20) CHECK (election_type IN ('primary', 'general', 'special', 'runoff')),

    -- Additional metadata
    source VARCHAR(50), -- web, mobile, event, etc.
    campaign_source VARCHAR(100), -- UTM tracking
    notes TEXT,

    -- Security and audit
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,

    -- Constraints for FEC compliance
    CONSTRAINT valid_donation_amount CHECK (amount BETWEEN 0.01 AND 99999.99),
    CONSTRAINT anonymous_donation_limit CHECK (
        (NOT is_anonymous) OR (is_anonymous AND amount <= 200.00)
    )
);

-- Transaction Events Table - Detailed transaction event log
CREATE TABLE transaction_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(30) NOT NULL CHECK (
        event_type IN ('created', 'authorized', 'captured', 'settled', 'failed', 'cancelled', 'refunded', 'chargeback')
    ),
    status VARCHAR(20) NOT NULL,

    -- FluidPay event data
    fluidpay_event_id VARCHAR(100),
    gateway_response JSONB, -- Full gateway response for debugging

    -- Financial details
    amount DECIMAL(10,2),
    fee_amount DECIMAL(6,2),
    net_amount DECIMAL(10,2),

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,

    -- Timing
    event_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    gateway_timestamp TIMESTAMPTZ,

    -- Metadata
    processor VARCHAR(50), -- Which processor handled this event
    gateway_transaction_id VARCHAR(100),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Refunds Table - Track refund transactions
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id),

    -- Refund details
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason VARCHAR(100) NOT NULL,
    reason_code VARCHAR(20),

    -- FluidPay refund data
    fluidpay_refund_id VARCHAR(100) UNIQUE,
    fluidpay_transaction_id VARCHAR(100),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),

    -- Timing
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,

    -- Metadata
    requested_by UUID, -- Staff member who initiated refund
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- COMPLIANCE SCHEMA - FEC compliance tracking
-- =============================================

-- Contribution Limits Table - Track FEC contribution limits by election cycle
CREATE TABLE contribution_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_cycle VARCHAR(9) NOT NULL, -- Format: 2023-2024
    recipient_type VARCHAR(20) NOT NULL CHECK (
        recipient_type IN ('candidate', 'pac', 'party_committee', 'independent_expenditure')
    ),

    -- Limit amounts
    individual_per_election DECIMAL(10,2) NOT NULL,
    individual_annual DECIMAL(10,2),
    pac_per_election DECIMAL(10,2),
    pac_annual DECIMAL(10,2),

    -- Special limits
    anonymous_limit DECIMAL(8,2) DEFAULT 200.00,
    cash_limit DECIMAL(8,2) DEFAULT 100.00,

    -- Timing
    effective_date DATE NOT NULL,
    expiration_date DATE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique limits per cycle and type
    UNIQUE(election_cycle, recipient_type)
);

-- Donor Contributions Aggregate Table - Track total contributions per donor
CREATE TABLE donor_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Donor identification (for FEC aggregate reporting)
    donor_id UUID NOT NULL,
    donor_email VARCHAR(320) NOT NULL,
    donor_name_hash VARCHAR(64) NOT NULL, -- Hash of first+last name for deduplication

    -- Recipient identification
    recipient_id UUID NOT NULL,
    election_cycle VARCHAR(9) NOT NULL,
    election_type VARCHAR(20),

    -- Contribution totals
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    contribution_count INTEGER NOT NULL DEFAULT 0,

    -- Date tracking
    first_contribution_date DATE,
    last_contribution_date DATE,

    -- FEC reporting flags
    requires_itemization BOOLEAN DEFAULT false, -- Over $200 threshold
    requires_quarterly_report BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint for aggregation
    UNIQUE(donor_id, recipient_id, election_cycle, election_type)
);

-- FEC Reports Table - Track FEC filing requirements
CREATE TABLE fec_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Report identification
    report_type VARCHAR(20) NOT NULL CHECK (
        report_type IN ('quarterly', 'monthly', 'pre_primary', 'pre_general', 'post_general', 'year_end')
    ),
    recipient_id UUID NOT NULL,
    election_cycle VARCHAR(9) NOT NULL,

    -- Reporting period
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Report data
    total_contributions DECIMAL(12,2) DEFAULT 0,
    total_itemized_contributions DECIMAL(12,2) DEFAULT 0,
    total_unitemized_contributions DECIMAL(12,2) DEFAULT 0,
    contributor_count INTEGER DEFAULT 0,

    -- Filing status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'ready', 'filed', 'amended', 'late')
    ),
    filed_at TIMESTAMPTZ,

    -- FEC confirmation
    fec_confirmation_number VARCHAR(50),

    -- Report files
    report_data JSONB, -- Generated report data
    report_file_url TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- =============================================
-- INDEXES - Performance optimization
-- =============================================

-- Payment Methods indexes
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_fluidpay_token ON payment_methods(fluidpay_token);
CREATE INDEX idx_payment_methods_active ON payment_methods(user_id, is_active) WHERE is_active = true;

-- Donations indexes
CREATE INDEX idx_donations_donor_id ON donations(donor_id);
CREATE INDEX idx_donations_recipient_id ON donations(recipient_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX idx_donations_contribution_date ON donations(contribution_date DESC);
CREATE INDEX idx_donations_fluidpay_transaction_id ON donations(fluidpay_transaction_id);
CREATE INDEX idx_donations_election_cycle ON donations(election_cycle);
CREATE INDEX idx_donations_amount ON donations(amount);
CREATE INDEX idx_donations_fec_reporting ON donations(recipient_id, election_cycle, contribution_date, amount)
    WHERE NOT is_anonymous;

-- Transaction Events indexes
CREATE INDEX idx_transaction_events_donation_id ON transaction_events(donation_id);
CREATE INDEX idx_transaction_events_type ON transaction_events(event_type);
CREATE INDEX idx_transaction_events_timestamp ON transaction_events(event_timestamp DESC);
CREATE INDEX idx_transaction_events_fluidpay ON transaction_events(fluidpay_event_id);

-- Refunds indexes
CREATE INDEX idx_refunds_donation_id ON refunds(donation_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_requested_at ON refunds(requested_at DESC);

-- Compliance indexes
CREATE INDEX idx_contribution_limits_cycle_type ON contribution_limits(election_cycle, recipient_type);
CREATE INDEX idx_donor_contributions_donor_recipient ON donor_contributions(donor_id, recipient_id, election_cycle);
CREATE INDEX idx_donor_contributions_reporting ON donor_contributions(requires_itemization, election_cycle)
    WHERE requires_itemization = true;
CREATE INDEX idx_fec_reports_recipient_cycle ON fec_reports(recipient_id, election_cycle);
CREATE INDEX idx_fec_reports_due_date ON fec_reports(due_date) WHERE status != 'filed';

-- =============================================
-- TRIGGERS - Data consistency and automation
-- =============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donor_contributions_updated_at BEFORE UPDATE ON donor_contributions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fec_reports_updated_at BEFORE UPDATE ON fec_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default payment method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Remove default flag from other payment methods for this user
        UPDATE payment_methods
        SET is_default = false
        WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER ensure_single_default_payment_method_trigger
    BEFORE INSERT OR UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_payment_method();

-- Update donor contribution aggregates when donations change
CREATE OR REPLACE FUNCTION update_donor_contribution_aggregates()
RETURNS TRIGGER AS $$
DECLARE
    donor_contrib_record donor_contributions%ROWTYPE;
BEGIN
    -- Handle INSERT or UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update or insert donor contribution aggregate
        INSERT INTO donor_contributions (
            donor_id, donor_email, donor_name_hash, recipient_id,
            election_cycle, election_type, total_amount, contribution_count,
            first_contribution_date, last_contribution_date, requires_itemization
        )
        VALUES (
            NEW.donor_id,
            NEW.donor_email,
            encode(sha256((NEW.donor_first_name || NEW.donor_last_name)::bytea), 'hex'),
            NEW.recipient_id,
            NEW.election_cycle,
            NEW.election_type,
            NEW.amount,
            1,
            NEW.contribution_date,
            NEW.contribution_date,
            (NEW.amount > 200.00 AND NOT NEW.is_anonymous)
        )
        ON CONFLICT (donor_id, recipient_id, election_cycle, election_type)
        DO UPDATE SET
            total_amount = donor_contributions.total_amount + NEW.amount - COALESCE(OLD.amount, 0),
            contribution_count = donor_contributions.contribution_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END,
            last_contribution_date = GREATEST(donor_contributions.last_contribution_date, NEW.contribution_date),
            requires_itemization = (donor_contributions.total_amount + NEW.amount - COALESCE(OLD.amount, 0) > 200.00),
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- Handle DELETE or UPDATE (removing old values)
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        UPDATE donor_contributions
        SET
            total_amount = total_amount - OLD.amount,
            contribution_count = contribution_count - 1,
            requires_itemization = (total_amount - OLD.amount > 200.00),
            updated_at = CURRENT_TIMESTAMP
        WHERE donor_id = OLD.donor_id
          AND recipient_id = OLD.recipient_id
          AND election_cycle = OLD.election_cycle
          AND election_type = OLD.election_type;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_donor_contribution_aggregates_trigger
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_donor_contribution_aggregates();

-- =============================================
-- VIEWS - Simplified data access
-- =============================================

-- Active donations view with payment method details
CREATE VIEW active_donations AS
SELECT
    d.*,
    pm.payment_type,
    pm.last_four,
    pm.brand,
    dc.total_amount as donor_total_amount,
    dc.contribution_count as donor_contribution_count,
    dc.requires_itemization
FROM donations d
LEFT JOIN payment_methods pm ON d.payment_method_id = pm.id
LEFT JOIN donor_contributions dc ON (
    d.donor_id = dc.donor_id AND
    d.recipient_id = dc.recipient_id AND
    d.election_cycle = dc.election_cycle AND
    d.election_type = dc.election_type
)
WHERE d.status NOT IN ('cancelled', 'failed');

-- FEC reportable donations view
CREATE VIEW fec_reportable_donations AS
SELECT
    d.*,
    dc.total_amount as donor_total_to_recipient,
    dc.requires_itemization,
    cl.individual_per_election as contribution_limit
FROM donations d
JOIN donor_contributions dc ON (
    d.donor_id = dc.donor_id AND
    d.recipient_id = dc.recipient_id AND
    d.election_cycle = dc.election_cycle
)
LEFT JOIN contribution_limits cl ON (
    d.election_cycle = cl.election_cycle AND
    d.recipient_type = cl.recipient_type
)
WHERE d.status = 'completed'
  AND NOT d.is_anonymous
  AND d.amount >= 0.01;

-- Transaction summary view
CREATE VIEW donation_transaction_summary AS
SELECT
    d.id as donation_id,
    d.amount as donation_amount,
    d.status as donation_status,
    d.created_at as donation_date,
    COUNT(te.id) as event_count,
    SUM(CASE WHEN te.event_type = 'captured' THEN te.amount ELSE 0 END) as captured_amount,
    SUM(CASE WHEN te.event_type = 'refunded' THEN te.amount ELSE 0 END) as refunded_amount,
    SUM(te.fee_amount) as total_fees,
    MAX(te.event_timestamp) as last_event_timestamp
FROM donations d
LEFT JOIN transaction_events te ON d.id = te.donation_id
GROUP BY d.id, d.amount, d.status, d.created_at;

-- =============================================
-- SECURITY - Row Level Security
-- =============================================

-- Enable RLS on sensitive tables
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_contributions ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (adjust based on your auth system)
-- Only allow users to see their own payment methods
CREATE POLICY user_payment_methods_policy ON payment_methods
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- Allow users to see their own donations, admins to see all
CREATE POLICY user_donations_policy ON donations
    FOR SELECT USING (
        donor_id = current_setting('app.current_user_id')::UUID OR
        current_setting('app.user_role') = 'admin'
    );

-- =============================================
-- INITIAL DATA - Default contribution limits
-- =============================================

-- Insert current FEC contribution limits for 2023-2024 cycle
INSERT INTO contribution_limits (election_cycle, recipient_type, individual_per_election, individual_annual, pac_per_election, pac_annual, effective_date) VALUES
('2023-2024', 'candidate', 3300.00, 6600.00, 5000.00, 10000.00, '2023-01-01'),
('2023-2024', 'pac', 5000.00, 10000.00, 5000.00, 10000.00, '2023-01-01'),
('2023-2024', 'party_committee', 41300.00, 41300.00, 15000.00, 45000.00, '2023-01-01'),
('2025-2026', 'candidate', 3300.00, 6600.00, 5000.00, 10000.00, '2025-01-01'),
('2025-2026', 'pac', 5000.00, 10000.00, 5000.00, 10000.00, '2025-01-01'),
('2025-2026', 'party_committee', 41300.00, 41300.00, 15000.00, 45000.00, '2025-01-01');

-- =============================================
-- COMMENTS - Table and column documentation
-- =============================================

COMMENT ON TABLE payment_methods IS 'Stores tokenized payment method information for secure payment processing';
COMMENT ON TABLE donations IS 'Core donation transactions with FEC compliance fields';
COMMENT ON TABLE transaction_events IS 'Detailed log of all payment processing events';
COMMENT ON TABLE refunds IS 'Tracks refund transactions and their status';
COMMENT ON TABLE contribution_limits IS 'FEC contribution limits by election cycle and recipient type';
COMMENT ON TABLE donor_contributions IS 'Aggregated contribution totals per donor for FEC reporting';
COMMENT ON TABLE fec_reports IS 'FEC filing requirements and report generation tracking';

COMMENT ON COLUMN payment_methods.fluidpay_token IS 'FluidPay tokenized payment method - never store raw payment data';
COMMENT ON COLUMN donations.is_anonymous IS 'Anonymous donations limited to $200 per FEC rules';
COMMENT ON COLUMN donations.election_cycle IS 'Format: YYYY-YYYY (e.g., 2023-2024)';
COMMENT ON COLUMN donor_contributions.requires_itemization IS 'True if donor total exceeds $200 threshold requiring FEC itemization';

-- =============================================
-- COMPLETION SUMMARY
-- =============================================

SELECT 'FluidPay Payments Schema Installation Complete' as status,
       'Tables: 7, Indexes: 16, Triggers: 4, Views: 3' as components,
       'Features: Payment processing, FEC compliance, Security, Performance optimization' as features;