-- Function to update fundraiser statistics
CREATE OR REPLACE FUNCTION update_fundraiser_stats()
RETURNS TRIGGER AS $$
DECLARE
    fundraiser_uuid UUID;
BEGIN
    -- Get the fundraiser ID from either NEW or OLD record
    fundraiser_uuid := COALESCE(NEW.fundraiser_id, OLD.fundraiser_id);

    -- Update fundraiser totals when donations change
    UPDATE fundraisers
    SET
        total_raised = COALESCE((
            SELECT SUM(amount)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ), 0),
        donation_count = (
            SELECT COUNT(*)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        unique_donors_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        last_donation_at = (
            SELECT MAX(completed_at)
            FROM donations
            WHERE fundraiser_id = fundraiser_uuid
            AND status = 'completed'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = fundraiser_uuid;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for donation statistics
CREATE TRIGGER donation_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_stats();

-- Function for audit logging
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields text[];
    old_json jsonb;
    new_json jsonb;
BEGIN
    -- Convert records to JSONB
    old_json := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END;
    new_json := CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;

    -- Calculate changed fields for UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(key)
        INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key;
    END IF;

    -- Insert audit record
    INSERT INTO audit.audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_fields,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE((NEW).id, (OLD).id),
        TG_OP,
        old_json,
        new_json,
        changed_fields,
        COALESCE(
            (NEW).updated_by,
            (OLD).updated_by,
            (NEW).created_by,
            (OLD).created_by
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to sensitive tables
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_donations
    AFTER INSERT OR UPDATE OR DELETE ON donations
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_disbursements
    AFTER INSERT OR UPDATE OR DELETE ON disbursements
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_fundraisers
    AFTER INSERT OR UPDATE OR DELETE ON fundraisers
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fundraisers_updated_at
    BEFORE UPDATE ON fundraisers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disbursements_updated_at
    BEFORE UPDATE ON disbursements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate reference numbers
CREATE OR REPLACE FUNCTION generate_reference_number(prefix text DEFAULT 'REF')
RETURNS text AS $$
BEGIN
    RETURN prefix || '-' ||
           extract(year from current_timestamp) ||
           lpad(extract(month from current_timestamp)::text, 2, '0') ||
           lpad(extract(day from current_timestamp)::text, 2, '0') || '-' ||
           upper(encode(gen_random_bytes(4), 'hex'));
END;
$$ LANGUAGE plpgsql;