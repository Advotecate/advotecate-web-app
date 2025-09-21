-- Fundraisers table for campaigns and events
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