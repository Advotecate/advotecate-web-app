-- ============================================================================
-- PERMISSIONS SYSTEM SCHEMA FOR SUPABASE
-- ============================================================================
-- Granular permission management with role-based access control
-- Run this AFTER the main supabase_complete_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PERMISSIONS TABLE
-- ----------------------------------------------------------------------------
-- Defines all available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'fundraiser.create', 'donation.view'
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- e.g., 'fundraiser', 'organization', 'user'
    is_system BOOLEAN DEFAULT FALSE, -- system permissions can't be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_name ON permissions(name);

COMMENT ON TABLE permissions IS 'Available permissions in the system';
COMMENT ON COLUMN permissions.is_system IS 'System permissions cannot be deleted or modified';

-- ----------------------------------------------------------------------------
-- ROLE_PERMISSIONS TABLE
-- ----------------------------------------------------------------------------
-- Maps permissions to user roles
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('donor', 'org_admin', 'super_admin', 'treasurer', 'staff', 'viewer')),
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Default permissions for each role';

-- ----------------------------------------------------------------------------
-- USER_PERMISSIONS TABLE
-- ----------------------------------------------------------------------------
-- User-specific permission overrides
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global permission
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- optional expiration
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission_id, organization_id)
);

-- Indexes
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_org ON user_permissions(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_user_permissions_active ON user_permissions(user_id, permission_id)
    WHERE is_revoked = FALSE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

COMMENT ON TABLE user_permissions IS 'User-specific permission grants and overrides';
COMMENT ON COLUMN user_permissions.organization_id IS 'NULL means global permission; UUID means org-specific';

-- ----------------------------------------------------------------------------
-- PERMISSION_AUDIT_LOG TABLE
-- ----------------------------------------------------------------------------
-- Audit trail for permission changes
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('granted', 'revoked', 'expired')),
    performed_by UUID REFERENCES users(id),
    reason TEXT,
    metadata JSONB, -- additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_permission_audit_user ON permission_audit_log(user_id);
CREATE INDEX idx_permission_audit_permission ON permission_audit_log(permission_id);
CREATE INDEX idx_permission_audit_action ON permission_audit_log(action);
CREATE INDEX idx_permission_audit_created ON permission_audit_log(created_at);

COMMENT ON TABLE permission_audit_log IS 'Audit trail for all permission changes';

-- ============================================================================
-- FUNCTIONS FOR PERMISSION CHECKING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: check_user_permission
-- ----------------------------------------------------------------------------
-- Checks if a user has a specific permission
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_permission_name VARCHAR,
    p_organization_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role VARCHAR(20);
    v_permission_id UUID;
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- Get user's primary role
    SELECT role INTO v_user_role FROM users WHERE id = p_user_id;

    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get permission ID
    SELECT id INTO v_permission_id FROM permissions WHERE name = p_permission_name;

    IF v_permission_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check for explicit user permission (overrides role)
    SELECT EXISTS(
        SELECT 1 FROM user_permissions
        WHERE user_id = p_user_id
        AND permission_id = v_permission_id
        AND (organization_id = p_organization_id OR (organization_id IS NULL AND p_organization_id IS NULL))
        AND is_revoked = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ) INTO v_has_permission;

    IF v_has_permission THEN
        RETURN TRUE;
    END IF;

    -- Check role-based permission
    SELECT EXISTS(
        SELECT 1 FROM role_permissions
        WHERE role = v_user_role
        AND permission_id = v_permission_id
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_user_permission IS 'Checks if user has specific permission, considering both role and user-specific grants';

-- ----------------------------------------------------------------------------
-- Function: get_user_permissions
-- ----------------------------------------------------------------------------
-- Returns all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    permission_name VARCHAR,
    permission_description TEXT,
    category VARCHAR,
    source VARCHAR -- 'role' or 'direct'
) AS $$
BEGIN
    RETURN QUERY
    -- Role-based permissions
    SELECT DISTINCT
        p.name,
        p.description,
        p.category,
        'role'::VARCHAR as source
    FROM users u
    JOIN role_permissions rp ON rp.role = u.role
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = p_user_id

    UNION

    -- Direct user permissions
    SELECT DISTINCT
        p.name,
        p.description,
        p.category,
        'direct'::VARCHAR as source
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_user_id
    AND up.is_revoked = FALSE
    AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP)
    AND (up.organization_id = p_organization_id OR (up.organization_id IS NULL AND p_organization_id IS NULL))

    ORDER BY category, permission_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS 'Returns all effective permissions for a user';

-- ============================================================================
-- SEED DATA: DEFAULT PERMISSIONS
-- ============================================================================

-- Insert base permissions
INSERT INTO permissions (name, description, category, is_system) VALUES
-- User Management
('user.view', 'View user profiles', 'user', true),
('user.edit', 'Edit user profiles', 'user', true),
('user.delete', 'Delete user accounts', 'user', true),
('user.manage_roles', 'Assign and modify user roles', 'user', true),

-- Organization Management
('org.create', 'Create new organizations', 'organization', true),
('org.view', 'View organization details', 'organization', true),
('org.edit', 'Edit organization information', 'organization', true),
('org.delete', 'Delete organizations', 'organization', true),
('org.manage_members', 'Add/remove organization members', 'organization', true),
('org.view_financials', 'View organization financial data', 'organization', true),

-- Fundraiser Management
('fundraiser.create', 'Create fundraising campaigns', 'fundraiser', true),
('fundraiser.view', 'View fundraiser details', 'fundraiser', true),
('fundraiser.edit', 'Edit fundraising campaigns', 'fundraiser', true),
('fundraiser.delete', 'Delete fundraising campaigns', 'fundraiser', true),
('fundraiser.publish', 'Publish fundraisers to public', 'fundraiser', true),

-- Donation Management
('donation.view', 'View donation records', 'donation', true),
('donation.create', 'Process new donations', 'donation', true),
('donation.refund', 'Process donation refunds', 'donation', true),
('donation.export', 'Export donation data', 'donation', true),

-- Disbursement Management
('disbursement.view', 'View disbursement records', 'disbursement', true),
('disbursement.create', 'Create disbursement requests', 'disbursement', true),
('disbursement.approve', 'Approve disbursement requests', 'disbursement', true),
('disbursement.process', 'Execute disbursement payments', 'disbursement', true),

-- Reporting
('report.view_basic', 'View basic reports and analytics', 'reporting', true),
('report.view_advanced', 'View advanced analytics and insights', 'reporting', true),
('report.export', 'Export reports and data', 'reporting', true),
('report.compliance', 'Access compliance reports', 'reporting', true),

-- System Administration
('system.config', 'Modify system configuration', 'system', true),
('system.audit', 'View audit logs', 'system', true),
('system.maintenance', 'Perform system maintenance', 'system', true),

-- Candidate Management
('candidate.create', 'Create candidate profiles', 'candidate', true),
('candidate.view', 'View candidate information', 'candidate', true),
('candidate.edit', 'Edit candidate profiles', 'candidate', true),
('candidate.verify', 'Verify candidate accounts', 'candidate', true),
('candidate.fundraiser_create', 'Create fundraisers for candidates', 'candidate', true),
('candidate.fundraiser_approve', 'Approve candidate fundraiser requests', 'candidate', true)

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DATA: ROLE PERMISSIONS MAPPING
-- ============================================================================

-- DONOR role permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'donor', id FROM permissions WHERE name IN (
    'user.view',
    'org.view',
    'fundraiser.view',
    'donation.view',
    'donation.create',
    'report.view_basic',
    'candidate.view'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- ORG_ADMIN role permissions (organization administrators)
INSERT INTO role_permissions (role, permission_id)
SELECT 'org_admin', id FROM permissions WHERE name IN (
    'user.view',
    'user.edit',
    'org.view',
    'org.edit',
    'org.manage_members',
    'org.view_financials',
    'fundraiser.create',
    'fundraiser.view',
    'fundraiser.edit',
    'fundraiser.publish',
    'donation.view',
    'donation.create',
    'donation.export',
    'disbursement.view',
    'disbursement.create',
    'report.view_basic',
    'report.view_advanced',
    'report.export',
    'report.compliance',
    'candidate.view',
    'candidate.fundraiser_create'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- TREASURER role permissions (financial oversight)
INSERT INTO role_permissions (role, permission_id)
SELECT 'treasurer', id FROM permissions WHERE name IN (
    'org.view',
    'org.view_financials',
    'fundraiser.view',
    'donation.view',
    'donation.export',
    'donation.refund',
    'disbursement.view',
    'disbursement.create',
    'disbursement.approve',
    'report.view_basic',
    'report.view_advanced',
    'report.export',
    'report.compliance'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF role permissions (organization staff)
INSERT INTO role_permissions (role, permission_id)
SELECT 'staff', id FROM permissions WHERE name IN (
    'user.view',
    'org.view',
    'fundraiser.view',
    'fundraiser.edit',
    'donation.view',
    'donation.create',
    'report.view_basic',
    'candidate.view'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- VIEWER role permissions (read-only access)
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions WHERE name IN (
    'org.view',
    'fundraiser.view',
    'donation.view',
    'report.view_basic',
    'candidate.view'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- SUPER_ADMIN role permissions (full system access)
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION check_user_permission IS 'Primary function for checking if a user has a specific permission. Checks both role-based and direct user permissions.';
COMMENT ON FUNCTION get_user_permissions IS 'Returns complete list of all permissions a user has access to';

-- ============================================================================
-- COMPLETE
-- ============================================================================
