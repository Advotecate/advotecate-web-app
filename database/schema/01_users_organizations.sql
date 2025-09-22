-- Advotecate Database Schema
-- Frontend-driven design for political fundraising platform
-- Created to match the React frontend structure

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE USER MANAGEMENT
-- =============================================

-- Users table (matches frontend User interface)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);

-- =============================================
-- ORGANIZATION SYSTEM
-- =============================================

-- Organization types enum (matches frontend validation)
CREATE TYPE organization_type AS ENUM ('POLITICAL', 'PAC', 'NONPROFIT');

-- Organizations table (matches frontend Organization interface)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly version of name
    description TEXT NOT NULL,
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    type organization_type NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    fec_id VARCHAR(50), -- Federal Election Commission ID

    -- Address information for compliance
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    country VARCHAR(2) DEFAULT 'US',

    -- Settings
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);
CREATE INDEX idx_organizations_fec_id ON organizations(fec_id) WHERE fec_id IS NOT NULL;

-- =============================================
-- ORGANIZATION MEMBERSHIP SYSTEM
-- =============================================

-- Organization member roles (matches frontend)
CREATE TYPE organization_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- Organization members (matches frontend OrganizationMember interface)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role organization_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(id),
    invitation_accepted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Unique constraint: one membership per user per organization
    UNIQUE(user_id, organization_id)
);

-- Indexes for membership queries
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_active ON organization_members(is_active);

-- =============================================
-- FUNDRAISER SYSTEM
-- =============================================

-- Fundraisers table (matches frontend Fundraiser interface)
CREATE TABLE fundraisers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug VARCHAR(255) NOT NULL, -- URL-friendly identifier
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500),

    -- Financial targets
    goal_amount DECIMAL(12,2) NOT NULL CHECK (goal_amount > 0),
    current_amount DECIMAL(12,2) DEFAULT 0.00 CHECK (current_amount >= 0),
    suggested_amounts INTEGER[] NOT NULL DEFAULT '{25,50,100,250,500}', -- Array of suggested donation amounts

    -- Status and timing
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,

    -- Settings
    settings JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique slug per organization
    UNIQUE(organization_id, slug)
);

-- Indexes for fundraiser queries
CREATE INDEX idx_fundraisers_organization_id ON fundraisers(organization_id);
CREATE INDEX idx_fundraisers_slug ON fundraisers(slug);
CREATE INDEX idx_fundraisers_is_active ON fundraisers(is_active);
CREATE INDEX idx_fundraisers_end_date ON fundraisers(end_date) WHERE end_date IS NOT NULL;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fundraisers_updated_at BEFORE UPDATE ON fundraisers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTIONS FOR SLUG GENERATION
-- =============================================

-- Function to generate URL-friendly slug
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(
        regexp_replace(
            lower(trim(input_text)),
            '[^a-z0-9\s-]', '', 'gi'
        ),
        '\s+', '-', 'g'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;