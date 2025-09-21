-- Many-to-many relationship between organizations and users
CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'treasurer', 'staff', 'viewer')),
    permissions JSONB, -- specific permissions for this user

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP,
    accepted_at TIMESTAMP,

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    -- Constraints
    UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_users_org ON organization_users (organization_id);
CREATE INDEX idx_org_users_user ON organization_users (user_id);
CREATE INDEX idx_org_users_role ON organization_users (role);
CREATE INDEX idx_org_users_status ON organization_users (status);

-- Comments
COMMENT ON TABLE organization_users IS 'Association between users and organizations with roles';
COMMENT ON COLUMN organization_users.permissions IS 'JSONB object with specific permissions for this user-org relationship';