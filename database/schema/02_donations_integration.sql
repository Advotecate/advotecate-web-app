-- Integration with existing FluidPay donation system
-- Extends existing donation tables to work with organizations and fundraisers

-- =============================================
-- EXTEND EXISTING DONATIONS TABLE
-- =============================================

-- Add organization and fundraiser references to existing donations table
-- (This assumes your existing donations table structure from FluidPay)
DO $$
BEGIN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'fundraiser_id') THEN
        ALTER TABLE donations ADD COLUMN fundraiser_id UUID REFERENCES fundraisers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'organization_id') THEN
        ALTER TABLE donations ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;

    -- Add user reference for authenticated donations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'user_id') THEN
        ALTER TABLE donations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Add donation source tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'source') THEN
        ALTER TABLE donations ADD COLUMN source VARCHAR(50) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'api', 'import'));
    END IF;

    -- Add compliance fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'compliance_checked') THEN
        ALTER TABLE donations ADD COLUMN compliance_checked BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'compliance_status') THEN
        ALTER TABLE donations ADD COLUMN compliance_status VARCHAR(20) DEFAULT 'pending'
            CHECK (compliance_status IN ('pending', 'approved', 'rejected', 'review_required'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'compliance_notes') THEN
        ALTER TABLE donations ADD COLUMN compliance_notes TEXT;
    END IF;
END $$;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_donations_fundraiser_id ON donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_donations_organization_id ON donations(organization_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source);
CREATE INDEX IF NOT EXISTS idx_donations_compliance_status ON donations(compliance_status);

-- =============================================
-- DONATION ANALYTICS VIEWS
-- =============================================

-- Fundraiser performance view
CREATE OR REPLACE VIEW fundraiser_analytics AS
SELECT
    f.id,
    f.title,
    f.slug,
    f.goal_amount,
    f.current_amount,
    COALESCE(stats.total_raised, 0.00) as actual_total_raised,
    COALESCE(stats.donation_count, 0) as donation_count,
    COALESCE(stats.avg_donation, 0.00) as avg_donation_amount,
    COALESCE(stats.unique_donors, 0) as unique_donor_count,
    ROUND((COALESCE(stats.total_raised, 0.00) / NULLIF(f.goal_amount, 0)) * 100, 2) as completion_percentage,
    f.created_at,
    f.end_date,
    f.is_active,
    o.name as organization_name,
    o.type as organization_type
FROM fundraisers f
LEFT JOIN organizations o ON f.organization_id = o.id
LEFT JOIN (
    SELECT
        fundraiser_id,
        SUM(amount) as total_raised,
        COUNT(*) as donation_count,
        AVG(amount) as avg_donation,
        COUNT(DISTINCT donor_email) as unique_donors
    FROM donations
    WHERE status = 'completed'
      AND fundraiser_id IS NOT NULL
    GROUP BY fundraiser_id
) stats ON f.id = stats.fundraiser_id;

-- Organization performance view
CREATE OR REPLACE VIEW organization_analytics AS
SELECT
    o.id,
    o.name,
    o.slug,
    o.type,
    COALESCE(stats.total_raised, 0.00) as total_raised,
    COALESCE(stats.donation_count, 0) as total_donations,
    COALESCE(stats.fundraiser_count, 0) as active_fundraisers,
    COALESCE(stats.avg_donation, 0.00) as avg_donation_amount,
    COALESCE(member_stats.member_count, 0) as member_count,
    o.created_at,
    o.is_active
FROM organizations o
LEFT JOIN (
    SELECT
        d.organization_id,
        SUM(d.amount) as total_raised,
        COUNT(*) as donation_count,
        AVG(d.amount) as avg_donation,
        COUNT(DISTINCT f.id) as fundraiser_count
    FROM donations d
    LEFT JOIN fundraisers f ON d.fundraiser_id = f.id
    WHERE d.status = 'completed'
      AND d.organization_id IS NOT NULL
    GROUP BY d.organization_id
) stats ON o.id = stats.organization_id
LEFT JOIN (
    SELECT
        organization_id,
        COUNT(*) as member_count
    FROM organization_members
    WHERE is_active = true
    GROUP BY organization_id
) member_stats ON o.id = member_stats.organization_id;

-- =============================================
-- FUNCTIONS FOR FUNDRAISER UPDATES
-- =============================================

-- Function to update fundraiser current_amount when donations are completed
CREATE OR REPLACE FUNCTION update_fundraiser_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the donation has a fundraiser_id and status changed to completed
    IF NEW.fundraiser_id IS NOT NULL AND NEW.status = 'completed' AND
       (OLD IS NULL OR OLD.status != 'completed') THEN

        UPDATE fundraisers
        SET current_amount = (
            SELECT COALESCE(SUM(amount), 0.00)
            FROM donations
            WHERE fundraiser_id = NEW.fundraiser_id
              AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.fundraiser_id;
    END IF;

    -- If donation was completed but now cancelled/failed, recalculate
    IF NEW.fundraiser_id IS NOT NULL AND OLD IS NOT NULL AND
       OLD.status = 'completed' AND NEW.status != 'completed' THEN

        UPDATE fundraisers
        SET current_amount = (
            SELECT COALESCE(SUM(amount), 0.00)
            FROM donations
            WHERE fundraiser_id = NEW.fundraiser_id
              AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.fundraiser_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for donation updates
DROP TRIGGER IF EXISTS trigger_update_fundraiser_amount ON donations;
CREATE TRIGGER trigger_update_fundraiser_amount
    AFTER INSERT OR UPDATE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_amount();

-- =============================================
-- DONATION COMPLIANCE TRACKING
-- =============================================

-- Table for tracking compliance checks and FEC reporting
CREATE TABLE IF NOT EXISTS donation_compliance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL, -- 'fec_limit', 'identity_verification', 'address_validation'
    status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'manual_review')),
    details JSONB,
    checked_by VARCHAR(50), -- 'system' or user_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_compliance_log_donation_id ON donation_compliance_log(donation_id);
CREATE INDEX idx_compliance_log_check_type ON donation_compliance_log(check_type);
CREATE INDEX idx_compliance_log_status ON donation_compliance_log(status);

-- =============================================
-- SEED DATA FOR TESTING
-- =============================================

-- Function to create seed data that matches frontend expectations
CREATE OR REPLACE FUNCTION create_seed_data()
RETURNS VOID AS $$
DECLARE
    test_user_id UUID;
    test_org_id UUID;
    test_fundraiser_id UUID;
BEGIN
    -- Create test user (matches registration form)
    INSERT INTO users (email, password_hash, first_name, last_name, is_verified)
    VALUES (
        'test@example.com',
        '$2b$10$rPHZJ7n5Q1tYWbFYE8GhQ.K1w1qGqGrQkGQrKrQnPyD5Q7hJGrFqG', -- 'password123'
        'John',
        'Doe',
        true
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO test_user_id;

    -- Get user ID if already exists
    IF test_user_id IS NULL THEN
        SELECT id INTO test_user_id FROM users WHERE email = 'test@example.com';
    END IF;

    -- Create test organization (matches frontend form)
    INSERT INTO organizations (name, slug, description, type, website_url, fec_id)
    VALUES (
        'Test Political Campaign',
        'test-political-campaign',
        'A test political campaign organization for development and testing purposes.',
        'POLITICAL',
        'https://example.com',
        'C00123456'
    ) ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO test_org_id;

    -- Get org ID if already exists
    IF test_org_id IS NULL THEN
        SELECT id INTO test_org_id FROM organizations WHERE slug = 'test-political-campaign';
    END IF;

    -- Add user as organization owner
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (test_user_id, test_org_id, 'OWNER')
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Create test fundraiser
    INSERT INTO fundraisers (organization_id, slug, title, description, goal_amount, suggested_amounts)
    VALUES (
        test_org_id,
        'test-fundraiser-2024',
        'Test Fundraiser 2024',
        'A test fundraiser for the 2024 campaign season.',
        10000.00,
        ARRAY[25, 50, 100, 250, 500, 1000]
    ) ON CONFLICT (organization_id, slug) DO NOTHING;

    RAISE NOTICE 'Seed data created successfully';
END;
$$ LANGUAGE plpgsql;