-- ============================================================================
-- FIX: CREATE organization_users TABLE
-- ============================================================================
-- The table is referenced but doesn't exist
-- This maps the organization_members table or creates it if missing
-- ============================================================================

-- Check if organization_members exists and organization_users doesn't
DO $$
BEGIN
  -- If organization_members exists but organization_users doesn't, create a view
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_users') THEN

    -- Create organization_users as an alias/view to organization_members
    CREATE VIEW organization_users AS
    SELECT * FROM organization_members;

    RAISE NOTICE 'Created organization_users view pointing to organization_members';

  -- If neither exists, create the table
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_users')
        AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members') THEN

    CREATE TABLE organization_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'treasurer', 'staff', 'viewer')),
      permissions JSONB,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
      invited_by UUID REFERENCES users(id),
      invited_at TIMESTAMP,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by UUID,
      UNIQUE(organization_id, user_id)
    );

    -- Indexes
    CREATE INDEX idx_org_users_org ON organization_users (organization_id);
    CREATE INDEX idx_org_users_user ON organization_users (user_id);
    CREATE INDEX idx_org_users_role ON organization_users (role);
    CREATE INDEX idx_org_users_status ON organization_users (status);

    -- Trigger for updated_at
    CREATE TRIGGER update_organization_users_updated_at
      BEFORE UPDATE ON organization_users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    COMMENT ON TABLE organization_users IS 'Association between users and organizations with roles';

    RAISE NOTICE 'Created organization_users table';

  ELSE
    RAISE NOTICE 'organization_users already exists';
  END IF;
END $$;
