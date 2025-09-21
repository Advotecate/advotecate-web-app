-- Simplified Advotecate Payments Schema for GCP Import
-- Enable extensions (may need to be done separately)

-- Create payments schema
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Set search path
SET search_path TO payments, compliance, public;

-- Payment Methods table
CREATE TABLE payments.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('credit_card', 'debit_card', 'bank_account', 'paypal', 'apple_pay', 'google_pay')),
    last_four_digits VARCHAR(4),
    expiry_month INTEGER,
    expiry_year INTEGER,
    brand VARCHAR(50),
    bank_name VARCHAR(255),
    account_type VARCHAR(50),
    encrypted_data JSONB,
    processor_token VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT payment_methods_expiry_check CHECK (
        (expiry_month IS NULL AND expiry_year IS NULL) OR
        (expiry_month BETWEEN 1 AND 12 AND expiry_year >= EXTRACT(YEAR FROM NOW()))
    )
);

-- Donations table
CREATE TABLE payments.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    recurring_day_of_month INTEGER CHECK (recurring_day_of_month BETWEEN 1 AND 28),
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed')),
    payment_method_id UUID REFERENCES payments.payment_methods(id),
    processor_transaction_id VARCHAR(255),
    processor_reference VARCHAR(255),
    failure_reason TEXT,
    failure_code VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    fundraiser_id UUID,
    organization_id UUID,
    donor_id UUID,
    guest_donor_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    compliance_checked BOOLEAN DEFAULT FALSE,
    compliance_status VARCHAR(50) DEFAULT 'pending'
        CHECK (compliance_status IN ('pending', 'approved', 'rejected', 'needs_review')),
    compliance_notes TEXT
);

-- Transaction Events table
CREATE TABLE payments.transaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES payments.donations(id),
    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN ('created', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed', 'compliance_check')),
    event_status VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    processor_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    ip_address INET,
    user_agent TEXT
);

-- Refunds table
CREATE TABLE payments.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES payments.donations(id),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    reason VARCHAR(255) NOT NULL,
    refund_type VARCHAR(50) DEFAULT 'full' CHECK (refund_type IN ('full', 'partial')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processor_refund_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
);

-- Compliance tables
CREATE TABLE compliance.contribution_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    limit_type VARCHAR(50) NOT NULL
        CHECK (limit_type IN ('individual_annual', 'individual_election', 'pac_annual', 'corporate_prohibited')),
    limit_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    effective_date DATE NOT NULL,
    expiry_date DATE,
    election_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, limit_type, effective_date)
);

CREATE TABLE compliance.donor_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID,
    donor_identifier VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0,
    election_cycle_amount DECIMAL(10,2) DEFAULT 0,
    annual_amount DECIMAL(10,2) DEFAULT 0,
    election_year INTEGER,
    contribution_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
    requires_disclosure BOOLEAN DEFAULT FALSE,
    employer_required BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(donor_identifier, organization_id, contribution_year)
);

CREATE TABLE compliance.fec_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL,
    filing_period_start DATE NOT NULL,
    filing_period_end DATE NOT NULL,
    organization_id UUID NOT NULL,
    report_data JSONB NOT NULL,
    total_contributions DECIMAL(12,2),
    total_donors INTEGER,
    status VARCHAR(50) DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'filed', 'amended', 'rejected')),
    filed_at TIMESTAMP WITH TIME ZONE,
    fec_confirmation_number VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Create indexes
CREATE INDEX idx_payment_methods_created_by ON payments.payment_methods(created_by);
CREATE INDEX idx_payment_methods_type ON payments.payment_methods(type);
CREATE INDEX idx_donations_status ON payments.donations(status);
CREATE INDEX idx_donations_donor_id ON payments.donations(donor_id);
CREATE INDEX idx_donations_organization_id ON payments.donations(organization_id);
CREATE INDEX idx_transaction_events_donation_id ON payments.transaction_events(donation_id);
CREATE INDEX idx_refunds_donation_id ON payments.refunds(donation_id);

-- Insert sample data
INSERT INTO compliance.contribution_limits (organization_id, limit_type, limit_amount, effective_date, election_year) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'individual_annual', 3300.00, '2024-01-01', 2024),
    ('550e8400-e29b-41d4-a716-446655440000', 'individual_election', 6600.00, '2024-01-01', 2024)
ON CONFLICT (organization_id, limit_type, effective_date) DO NOTHING;