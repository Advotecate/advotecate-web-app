-- Create PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Comment on schemas
COMMENT ON SCHEMA audit IS 'Schema for audit and compliance tracking';
COMMENT ON SCHEMA reporting IS 'Schema for reporting and analytics views';