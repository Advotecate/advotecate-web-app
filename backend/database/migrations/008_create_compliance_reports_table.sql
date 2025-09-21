-- Compliance reports table for regulatory filings
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