-- System configuration table
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT false, -- whether this config can be exposed to frontend
    is_encrypted BOOLEAN DEFAULT false, -- whether the value is encrypted

    -- Version control
    version INTEGER DEFAULT 1,
    previous_value JSONB,

    -- Audit fields
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default Advotecate configuration
INSERT INTO system_config (key, value, description, category, is_public) VALUES
-- Donation limits (FEC 2024 limits)
('donation_limits',
 '{"individual_annual": 2900, "individual_per_election": 3300, "pac_annual": 5000}',
 'Federal donation limits per FEC regulations',
 'compliance',
 true),

-- Platform fees
('platform_fees',
 '{"percentage": 2.9, "fixed_fee": 0.30, "recurring_discount": 0.1}',
 'Advotecate platform processing fees',
 'financial',
 true),

-- Compliance thresholds
('compliance_thresholds',
 '{"require_employer_info": 200, "itemize_threshold": 200, "aggregate_threshold": 200}',
 'Compliance reporting thresholds',
 'compliance',
 false),

-- Feature flags
('feature_flags',
 '{"recurring_donations": true, "anonymous_donations": false, "international_donations": false, "crypto_donations": false}',
 'Advotecate feature toggles',
 'features',
 true),

-- Email templates
('email_templates',
 '{"donation_confirmation": "donation_confirmation_v1", "receipt": "receipt_v1", "failure": "donation_failure_v1"}',
 'Email template versions',
 'messaging',
 false),

-- API rate limits
('rate_limits',
 '{"anonymous": {"window_minutes": 60, "max_requests": 100}, "authenticated": {"window_minutes": 60, "max_requests": 1000}, "admin": {"window_minutes": 60, "max_requests": 5000}}',
 'API rate limiting configuration',
 'security',
 false),

-- Security settings
('security_settings',
 '{"session_timeout_hours": 24, "mfa_required_for_admin": true, "password_reset_timeout_minutes": 30}',
 'Security configuration',
 'security',
 false),

-- Maintenance mode
('maintenance_mode',
 '{"enabled": false, "message": "Advotecate is temporarily unavailable for maintenance.", "estimated_end": null}',
 'Maintenance mode settings',
 'system',
 true);

-- Indexes
CREATE INDEX idx_system_config_category ON system_config (category);
CREATE INDEX idx_system_config_public ON system_config (is_public) WHERE is_public = true;
CREATE INDEX idx_system_config_updated ON system_config (updated_at);

-- Comments
COMMENT ON TABLE system_config IS 'System-wide configuration settings for Advotecate';
COMMENT ON COLUMN system_config.is_public IS 'Whether this configuration can be safely exposed to frontend applications';
COMMENT ON COLUMN system_config.is_encrypted IS 'Whether the value field contains encrypted data';