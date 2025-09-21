-- Disbursements table for payouts to organizations
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