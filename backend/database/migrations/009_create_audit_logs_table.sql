-- Audit logs table (partitioned for performance)
CREATE TABLE audit.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was changed
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

    -- Changes
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- Who and when
    user_id UUID,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Context
    endpoint VARCHAR(255),
    request_id UUID,
    correlation_id UUID,

    -- Risk and security
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    security_flags TEXT[],

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly audit partitions
CREATE TABLE audit.audit_logs_2024_01 PARTITION OF audit.audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit.audit_logs_2024_02 PARTITION OF audit.audit_logs
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE audit.audit_logs_2024_03 PARTITION OF audit.audit_logs
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Continue pattern for remaining months...

-- Indexes
CREATE INDEX idx_audit_table ON audit.audit_logs (table_name);
CREATE INDEX idx_audit_record ON audit.audit_logs (record_id);
CREATE INDEX idx_audit_user ON audit.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit.audit_logs (created_at);
CREATE INDEX idx_audit_operation ON audit.audit_logs (operation);
CREATE INDEX idx_audit_risk ON audit.audit_logs (risk_score) WHERE risk_score > 50;

-- Comments
COMMENT ON TABLE audit.audit_logs IS 'Comprehensive audit trail for all database changes';
COMMENT ON COLUMN audit.audit_logs.risk_score IS 'Calculated risk score for this operation (0-100)';
COMMENT ON COLUMN audit.audit_logs.security_flags IS 'Array of security-related flags for this operation';