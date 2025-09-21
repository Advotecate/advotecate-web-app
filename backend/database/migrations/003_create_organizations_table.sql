-- Organizations table for political entities
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

-- Enable trigram extension for name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comments
COMMENT ON TABLE organizations IS 'Political organizations that can receive donations';
COMMENT ON COLUMN organizations.bank_account_number IS 'Encrypted bank account for disbursements';
COMMENT ON COLUMN organizations.routing_number IS 'Encrypted bank routing number';
COMMENT ON COLUMN organizations.verification_documents IS 'JSONB array of document references for verification';