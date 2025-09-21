-- Donations table (partitioned by date for performance)
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
    parent_donation_id UUID REFERENCES donations(id), -- for recurring donations
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions
CREATE TABLE donations_2024_01 PARTITION OF donations
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE donations_2024_02 PARTITION OF donations
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE donations_2024_03 PARTITION OF donations
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE donations_2024_04 PARTITION OF donations
FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE donations_2024_05 PARTITION OF donations
FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE donations_2024_06 PARTITION OF donations
FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE donations_2024_07 PARTITION OF donations
FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE donations_2024_08 PARTITION OF donations
FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE donations_2024_09 PARTITION OF donations
FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE donations_2024_10 PARTITION OF donations
FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE donations_2024_11 PARTITION OF donations
FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE donations_2024_12 PARTITION OF donations
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Indexes on main table (will be inherited by partitions)
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