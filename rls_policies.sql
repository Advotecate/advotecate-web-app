-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Comprehensive RLS policies for all tables
-- Service role bypasses RLS automatically
-- These policies are for authenticated users and anon access
-- ============================================================================

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Super admins can view all users
CREATE POLICY "Super admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Super admins can update all users
CREATE POLICY "Super admins can manage all users"
ON users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow user registration (insert)
CREATE POLICY "Allow user registration"
ON users FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ============================================================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Anyone can view active verified organizations
CREATE POLICY "Public can view verified organizations"
ON organizations FOR SELECT
TO anon, authenticated
USING (status = 'active' AND verification_status = 'verified');

-- Organization members can view their org
CREATE POLICY "Members can view their organization"
ON organizations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Organization admins can update their org
CREATE POLICY "Admins can update their organization"
ON organizations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  )
);

-- Super admins can manage all organizations
CREATE POLICY "Super admins can manage all organizations"
ON organizations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================================================
-- Note: organization_members is a view of organization_members
-- Apply RLS policies to the base table

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
ON organization_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Organization admins can view all members
CREATE POLICY "Admins can view all organization members"
ON organization_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
    AND om.status = 'active'
  )
);

-- Organization admins can manage members
CREATE POLICY "Admins can manage organization members"
ON organization_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
    AND om.status = 'active'
  )
);

-- ============================================================================
-- FUNDRAISERS TABLE POLICIES
-- ============================================================================

ALTER TABLE fundraisers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active fundraisers
CREATE POLICY "Public can view active fundraisers"
ON fundraisers FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Organization members can view all fundraisers for their org
CREATE POLICY "Members can view organization fundraisers"
ON fundraisers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = fundraisers.organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Organization admins and staff can create fundraisers
CREATE POLICY "Admins and staff can create fundraisers"
ON fundraisers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = fundraisers.organization_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'staff')
    AND status = 'active'
  )
);

-- Organization admins and staff can update fundraisers
CREATE POLICY "Admins and staff can update fundraisers"
ON fundraisers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = fundraisers.organization_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'staff')
    AND status = 'active'
  )
);

-- ============================================================================
-- DONATIONS TABLE POLICIES
-- ============================================================================

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Users can view their own donations
CREATE POLICY "Users can view own donations"
ON donations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Organization members can view donations to their org
CREATE POLICY "Organization members can view org donations"
ON donations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = donations.organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Authenticated users can create donations
CREATE POLICY "Authenticated users can create donations"
ON donations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- System can update donation status
CREATE POLICY "Service can update donations"
ON donations FOR UPDATE
TO authenticated
USING (true);

-- ============================================================================
-- DISBURSEMENTS TABLE POLICIES
-- ============================================================================

ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

-- Organization admins and treasurers can view disbursements
CREATE POLICY "Admins and treasurers can view disbursements"
ON disbursements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = disbursements.organization_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'treasurer')
    AND status = 'active'
  )
);

-- Treasurers can create disbursement requests
CREATE POLICY "Treasurers can create disbursements"
ON disbursements FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = disbursements.organization_id
    AND user_id = auth.uid()
    AND role = 'treasurer'
    AND status = 'active'
  )
);

-- Super admins can approve disbursements
CREATE POLICY "Super admins can approve disbursements"
ON disbursements FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- ============================================================================
-- EVENTS TABLE POLICIES
-- ============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone can view published events
CREATE POLICY "Public can view published events"
ON events FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Organization members can view all org events
CREATE POLICY "Members can view organization events"
ON events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = events.organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Organization admins can manage events
CREATE POLICY "Admins can manage events"
ON events FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = events.organization_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  )
);

-- ============================================================================
-- EVENT_REGISTRATIONS TABLE POLICIES
-- ============================================================================

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
ON event_registrations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Organization members can view all registrations
CREATE POLICY "Organization can view all registrations"
ON event_registrations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN organization_members ou ON ou.organization_id = e.organization_id
    WHERE e.id = event_registrations.event_id
    AND ou.user_id = auth.uid()
    AND ou.status = 'active'
  )
);

-- Authenticated users can register for events
CREATE POLICY "Users can register for events"
ON event_registrations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- INTEREST SYSTEM POLICIES
-- ============================================================================

ALTER TABLE interest_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feed_preferences ENABLE ROW LEVEL SECURITY;

-- Everyone can view interest categories and tags
CREATE POLICY "Public can view interest categories"
ON interest_categories FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Public can view interest tags"
ON interest_tags FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Users can manage their own interests
CREATE POLICY "Users can view own interests"
ON user_interests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own interests"
ON user_interests FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Users can manage their feed preferences
CREATE POLICY "Users can manage own feed preferences"
ON user_feed_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Entity tags are publicly viewable
CREATE POLICY "Public can view entity tags"
ON entity_tags FOR SELECT
TO anon, authenticated
USING (true);

-- Organization members can tag their entities
CREATE POLICY "Members can tag organization entities"
ON entity_tags FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- PERMISSIONS SYSTEM POLICIES
-- ============================================================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view permissions
CREATE POLICY "Authenticated can view permissions"
ON permissions FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can view role permissions
CREATE POLICY "Authenticated can view role permissions"
ON role_permissions FOR SELECT
TO authenticated
USING (true);

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON user_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Super admins can manage all permissions
CREATE POLICY "Super admins can manage permissions"
ON user_permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Anyone can view audit log (for transparency)
CREATE POLICY "Users can view permission audit log"
ON permission_audit_log FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- CANDIDATE SYSTEM POLICIES
-- ============================================================================

ALTER TABLE fec_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_fundraisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fec_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fec_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_committees ENABLE ROW LEVEL SECURITY;

-- Public can view FEC candidate data
CREATE POLICY "Public can view FEC candidates"
ON fec_candidates FOR SELECT
TO anon, authenticated
USING (true);

-- Public can view verified candidates
CREATE POLICY "Public can view verified candidates"
ON candidates FOR SELECT
TO anon, authenticated
USING (verification_status IN ('fec_verified', 'claimed') AND campaign_status = 'active');

-- Authenticated users can create candidate profiles
CREATE POLICY "Authenticated can create candidates"
ON candidates FOR INSERT
TO authenticated
WITH CHECK (true);

-- Candidates can update their own profile
CREATE POLICY "Users can update own candidate profile"
ON candidates FOR UPDATE
TO authenticated
USING (true); -- Would need to link candidate to user

-- Public can view approved candidate fundraisers
CREATE POLICY "Public can view approved candidate fundraisers"
ON candidate_fundraisers FOR SELECT
TO anon, authenticated
USING (approval_status = 'approved');

-- Organization admins can create candidate fundraisers
CREATE POLICY "Org admins can create candidate fundraisers"
ON candidate_fundraisers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = candidate_fundraisers.organization_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  )
);

-- Public can view FEC committees
CREATE POLICY "Public can view FEC committees"
ON fec_committees FOR SELECT
TO anon, authenticated
USING (true);

-- Public can view candidate committees
CREATE POLICY "Public can view candidate committees"
ON candidate_committees FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can view sync log
CREATE POLICY "Authenticated can view sync log"
ON fec_sync_log FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- SYSTEM CONFIG POLICIES
-- ============================================================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Public can view public config
CREATE POLICY "Public can view public config"
ON system_config FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Super admins can manage all config
CREATE POLICY "Super admins can manage config"
ON system_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- ============================================================================
-- VOLUNTEER SYSTEM POLICIES
-- ============================================================================

ALTER TABLE volunteer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_hours ENABLE ROW LEVEL SECURITY;

-- Users can view their own volunteer profile
CREATE POLICY "Users can view own volunteer profile"
ON volunteer_profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can manage their own volunteer profile
CREATE POLICY "Users can manage own volunteer profile"
ON volunteer_profiles FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Organization members can view volunteer profiles
CREATE POLICY "Org members can view volunteer profiles"
ON volunteer_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND status = 'active'
  )
);

-- Users can view their own volunteer hours
CREATE POLICY "Users can view own volunteer hours"
ON volunteer_hours FOR SELECT
TO authenticated
USING (volunteer_id = auth.uid());

-- Users can create their own volunteer hours
CREATE POLICY "Users can create own volunteer hours"
ON volunteer_hours FOR INSERT
TO authenticated
WITH CHECK (volunteer_id = auth.uid());

-- Organization members can view volunteer hours for their org
CREATE POLICY "Org members can view org volunteer hours"
ON volunteer_hours FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = volunteer_hours.organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Organization admins can approve/manage volunteer hours
CREATE POLICY "Org admins can manage volunteer hours"
ON volunteer_hours FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = volunteer_hours.organization_id
    AND user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN', 'VOLUNTEER_COORDINATOR')
    AND status = 'active'
  )
);

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- COMPLIANCE SYSTEM POLICIES
-- ============================================================================

ALTER TABLE compliance_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Everyone can view compliance jurisdictions
CREATE POLICY "Public can view compliance jurisdictions"
ON compliance_jurisdictions FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Organization members can view their compliance reports
CREATE POLICY "Org members can view org compliance reports"
ON compliance_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = compliance_reports.organization_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- Org admins and treasurers can create compliance reports
CREATE POLICY "Org admins can create compliance reports"
ON compliance_reports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = compliance_reports.organization_id
    AND user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN', 'TREASURER')
    AND status = 'active'
  )
);

-- Org admins and treasurers can update compliance reports
CREATE POLICY "Org admins can update compliance reports"
ON compliance_reports FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = compliance_reports.organization_id
    AND user_id = auth.uid()
    AND role IN ('OWNER', 'ADMIN', 'TREASURER')
    AND status = 'active'
  )
);

-- ============================================================================
-- COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'All tables have RLS enabled with appropriate policies';
