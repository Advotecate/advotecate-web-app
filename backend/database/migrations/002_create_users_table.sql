-- Users table for donors and admins
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255), -- nullable for OAuth users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    date_of_birth DATE, -- required for compliance
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,

    -- Address Information (required for political donations)
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(2) DEFAULT 'US',

    -- Compliance Fields
    employer VARCHAR(255),
    occupation VARCHAR(255),
    citizenship_status VARCHAR(20) CHECK (citizenship_status IN ('citizen', 'permanent_resident', 'other')),

    -- System Fields
    role VARCHAR(20) DEFAULT 'donor' CHECK (role IN ('donor', 'org_admin', 'super_admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_verification')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_verified_at TIMESTAMP,

    -- MFA fields
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT, -- encrypted TOTP secret
    mfa_backup_codes TEXT[], -- array of backup codes

    -- FluidPay Integration
    fluidpay_customer_id VARCHAR(255),

    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_fluidpay ON users (fluidpay_customer_id) WHERE fluidpay_customer_id IS NOT NULL;
CREATE INDEX idx_users_status ON users (status, kyc_status);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at);

-- Partial index for active users
CREATE INDEX idx_users_active ON users (id) WHERE status = 'active';

-- Comments
COMMENT ON TABLE users IS 'Core user accounts for donors and administrators';
COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password, nullable for OAuth users';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA';
COMMENT ON COLUMN users.fluidpay_customer_id IS 'Reference to FluidPay customer record';