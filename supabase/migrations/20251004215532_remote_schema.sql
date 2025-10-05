SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "audit";


ALTER SCHEMA "audit" OWNER TO "postgres";


COMMENT ON SCHEMA "audit" IS 'Schema for audit and compliance tracking';





ALTER SCHEMA "public" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'All tables have RLS enabled with appropriate policies';



CREATE SCHEMA IF NOT EXISTS "reporting";


ALTER SCHEMA "reporting" OWNER TO "postgres";


COMMENT ON SCHEMA "reporting" IS 'Schema for reporting and analytics views';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_user_permission"("p_user_id" "uuid", "p_permission_name" character varying, "p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_has_permission BOOLEAN := false;
    v_user_role VARCHAR(20);
    v_org_role VARCHAR(20);
BEGIN
    -- Check user exists and is active
    SELECT role INTO v_user_role FROM users WHERE id = p_user_id AND status = 'active';
    IF v_user_role IS NULL THEN RETURN false; END IF;

    -- Super admin has all permissions
    IF v_user_role = 'super_admin' THEN RETURN true; END IF;

    -- Check user-specific overrides
    SELECT is_granted INTO v_has_permission
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id
        AND p.name = p_permission_name
        AND (up.organization_id = p_organization_id OR (up.organization_id IS NULL AND p_organization_id IS NULL))
        AND (up.expires_at IS NULL OR up.expires_at > NOW());

    IF v_has_permission IS NOT NULL THEN RETURN v_has_permission; END IF;

    -- Check organization role permissions
    IF p_organization_id IS NOT NULL THEN
        SELECT om.role INTO v_org_role
        FROM organization_members om
        WHERE om.user_id = p_user_id AND om.organization_id = p_organization_id AND om.status = 'active';

        IF v_org_role = 'OWNER' THEN RETURN true; END IF;

        IF v_org_role IS NOT NULL THEN
            SELECT EXISTS(
                SELECT 1 FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_type = 'organization' AND rp.role_name = v_org_role AND p.name = p_permission_name
            ) INTO v_has_permission;

            IF v_has_permission THEN RETURN true; END IF;
        END IF;
    END IF;

    -- Check platform role permissions
    SELECT EXISTS(
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_type = 'platform' AND rp.role_name = v_user_role AND p.name = p_permission_name
    ) INTO v_has_permission;

    RETURN COALESCE(v_has_permission, false);
END;
$$;


ALTER FUNCTION "public"."check_user_permission"("p_user_id" "uuid", "p_permission_name" character varying, "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("permission_name" character varying, "resource" character varying, "action" character varying, "source" character varying, "is_sensitive" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT p.name, p.resource, p.action, 'direct_grant'::VARCHAR, p.is_sensitive
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id AND up.is_granted = true
        AND (up.organization_id = p_organization_id OR (up.organization_id IS NULL AND p_organization_id IS NULL))
        AND (up.expires_at IS NULL OR up.expires_at > NOW())

    UNION

    SELECT p.name, p.resource, p.action, CONCAT('org_role:', om.role)::VARCHAR, p.is_sensitive
    FROM organization_members om
    JOIN role_permissions rp ON rp.role_name = om.role AND rp.role_type = 'organization'
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = p_user_id AND om.organization_id = p_organization_id AND om.status = 'active'

    UNION

    SELECT p.name, p.resource, p.action, CONCAT('platform_role:', u.role)::VARCHAR, p.is_sensitive
    FROM users u
    JOIN role_permissions rp ON rp.role_name = u.role AND rp.role_type = 'platform'
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = p_user_id AND u.status = 'active';
END;
$$;


ALTER FUNCTION "public"."get_user_permissions"("p_user_id" "uuid", "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_candidate_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_candidate_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'registered' THEN
        UPDATE events
        SET current_attendees = current_attendees + 1 + COALESCE(NEW.number_of_guests, 0)
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'registered' AND NEW.status = 'registered' THEN
            UPDATE events
            SET current_attendees = current_attendees + 1 + COALESCE(NEW.number_of_guests, 0)
            WHERE id = NEW.event_id;
        ELSIF OLD.status = 'registered' AND NEW.status != 'registered' THEN
            UPDATE events
            SET current_attendees = current_attendees - 1 - COALESCE(OLD.number_of_guests, 0)
            WHERE id = NEW.event_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'registered' THEN
        UPDATE events
        SET current_attendees = current_attendees - 1 - COALESCE(OLD.number_of_guests, 0)
        WHERE id = OLD.event_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_event_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fundraiser_current_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.fundraiser_id IS NOT NULL THEN
        UPDATE fundraisers
        SET
            current_amount = COALESCE(current_amount, 0) + NEW.amount,
            donation_count = donation_count + 1,
            last_donation_at = NEW.completed_at
        WHERE id = NEW.fundraiser_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fundraiser_current_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';


CREATE TABLE IF NOT EXISTS "audit"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "audit"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "audit"."audit_logs" IS 'Comprehensive audit trail for all database changes';



COMMENT ON COLUMN "audit"."audit_logs"."risk_score" IS 'Calculated risk score for this operation (0-100)';



COMMENT ON COLUMN "audit"."audit_logs"."security_flags" IS 'Array of security-related flags for this operation';


SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2024_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2024_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "audit"."audit_logs_2025_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" character varying(20) NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "user_id" "uuid",
    "session_id" character varying(255),
    "ip_address" "inet",
    "user_agent" "text",
    "endpoint" character varying(255),
    "request_id" "uuid",
    "correlation_id" "uuid",
    "risk_score" integer DEFAULT 0,
    "security_flags" "text"[],
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::"text"[]))),
    CONSTRAINT "audit_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "audit"."audit_logs_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" character varying(50) NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid",
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Audit trail of system actions';



CREATE TABLE IF NOT EXISTS "public"."candidate_committees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "fec_cand_id" character varying(9) NOT NULL,
    "cmte_id" character varying(9) NOT NULL,
    "cand_election_yr" integer,
    "fec_election_yr" integer,
    "cmte_tp" character varying(1),
    "cmte_dsgn" character varying(1),
    "linkage_id" integer,
    "is_active" boolean DEFAULT true,
    "first_synced_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_committees" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidate_committees" IS 'Links candidates to their FEC authorized committees';



CREATE TABLE IF NOT EXISTS "public"."candidate_fundraisers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "fundraiser_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "fundraiser_role" character varying(20),
    "custom_title" character varying(255),
    "custom_description" "text",
    "custom_image_url" character varying(500),
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "allow_custom_amounts" boolean DEFAULT true,
    "suggested_amounts" "jsonb" DEFAULT '[]'::"jsonb",
    "unique_visitors" integer DEFAULT 0,
    "conversion_rate" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "candidate_fundraisers_approval_status_check" CHECK ((("approval_status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'needs_review'::character varying])::"text"[]))),
    CONSTRAINT "candidate_fundraisers_fundraiser_role_check" CHECK ((("fundraiser_role")::"text" = ANY ((ARRAY['official'::character varying, 'supporting'::character varying, 'independent'::character varying, 'grassroots'::character varying])::"text"[])))
);


ALTER TABLE "public"."candidate_fundraisers" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidate_fundraisers" IS 'Junction table enabling multiple orgs to fundraise for the same candidate';



COMMENT ON COLUMN "public"."candidate_fundraisers"."is_primary" IS 'True if this is the candidate official campaign fundraiser';



COMMENT ON COLUMN "public"."candidate_fundraisers"."fundraiser_role" IS 'Type of fundraiser: official campaign, supporting org, independent expenditure, or grassroots';



CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fec_cand_id" character varying(9),
    "display_name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100) NOT NULL,
    "middle_name" character varying(100),
    "nickname" character varying(100),
    "office_type" character varying(20) NOT NULL,
    "office_state" character varying(2),
    "office_district" character varying(10),
    "election_year" integer,
    "party_affiliation" character varying(50),
    "bio" "text",
    "campaign_platform" "text",
    "website_url" character varying(500),
    "twitter_handle" character varying(100),
    "facebook_url" character varying(500),
    "instagram_handle" character varying(100),
    "youtube_url" character varying(500),
    "tiktok_handle" character varying(100),
    "profile_image_url" character varying(500),
    "banner_image_url" character varying(500),
    "campaign_logo_url" character varying(500),
    "verification_status" character varying(20) DEFAULT 'unverified'::character varying,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "is_active" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "campaign_status" character varying(20),
    "campaign_start_date" "date",
    "campaign_end_date" "date",
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "candidates_campaign_status_check" CHECK ((("campaign_status")::"text" = ANY ((ARRAY['announced'::character varying, 'active'::character varying, 'suspended'::character varying, 'withdrawn'::character varying, 'won'::character varying, 'lost'::character varying])::"text"[]))),
    CONSTRAINT "candidates_office_type_check" CHECK ((("office_type")::"text" = ANY ((ARRAY['president'::character varying, 'senate'::character varying, 'house'::character varying, 'governor'::character varying, 'state_senate'::character varying, 'state_house'::character varying, 'mayor'::character varying, 'city_council'::character varying, 'county'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "candidates_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying, 'archived'::character varying])::"text"[]))),
    CONSTRAINT "candidates_verification_status_check" CHECK ((("verification_status")::"text" = ANY ((ARRAY['unverified'::character varying, 'fec_verified'::character varying, 'platform_verified'::character varying, 'claimed'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidates" IS 'Platform candidate profiles with FEC linkage and enhanced content';



COMMENT ON COLUMN "public"."candidates"."fec_cand_id" IS 'Links to FEC candidate master data (NULL for local/non-federal candidates)';



COMMENT ON COLUMN "public"."candidates"."verification_status" IS 'fec_verified = linked to FEC, platform_verified = manually verified, claimed = candidate claimed profile';



CREATE TABLE IF NOT EXISTS "public"."compliance_jurisdictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(255) NOT NULL,
    "jurisdiction_type" character varying(50) NOT NULL,
    "contribution_limits" "jsonb",
    "disclosure_rules" "jsonb",
    "reporting_requirements" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_jurisdictions_jurisdiction_type_check" CHECK ((("jurisdiction_type")::"text" = ANY ((ARRAY['federal'::character varying, 'state'::character varying, 'local'::character varying])::"text"[])))
);


ALTER TABLE "public"."compliance_jurisdictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."compliance_jurisdictions" IS 'Compliance rules by jurisdiction';



CREATE TABLE IF NOT EXISTS "public"."compliance_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "jurisdiction_id" "uuid",
    "report_type" character varying(50) NOT NULL,
    "filing_period_start" "date" NOT NULL,
    "filing_period_end" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "filed_at" timestamp with time zone,
    "filed_by" "uuid",
    "report_data" "jsonb",
    "filing_confirmation_number" character varying(100),
    "filing_receipt" "jsonb",
    "notes" "text",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    CONSTRAINT "compliance_reports_report_type_check" CHECK ((("report_type")::"text" = ANY ((ARRAY['fec_quarterly'::character varying, 'fec_monthly'::character varying, 'fec_pre_election'::character varying, 'fec_post_election'::character varying, 'state_quarterly'::character varying, 'state_annual'::character varying, 'irs_990'::character varying, 'irs_8872'::character varying])::"text"[]))),
    CONSTRAINT "compliance_reports_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'ready_to_file'::character varying, 'filed'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'amended'::character varying])::"text"[])))
);


ALTER TABLE "public"."compliance_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."compliance_reports" IS 'Compliance and regulatory reports';



CREATE TABLE IF NOT EXISTS "public"."disbursements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "fee_amount" numeric(8,2),
    "net_amount" numeric(12,2),
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "method" character varying(20) NOT NULL,
    "bank_account_number" "text",
    "routing_number" "text",
    "bank_name" character varying(255),
    "initiated_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expected_arrival_date" "date",
    "actual_arrival_date" "date",
    "reference_number" character varying(100),
    "external_transaction_id" character varying(255),
    "batch_id" "uuid",
    "donation_ids" "uuid"[],
    "reporting_period_start" "date",
    "reporting_period_end" "date",
    "memo" "text",
    "internal_notes" "text",
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "disbursements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "disbursements_method_check" CHECK ((("method")::"text" = ANY ((ARRAY['ach'::character varying, 'wire'::character varying, 'check'::character varying])::"text"[]))),
    CONSTRAINT "disbursements_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."disbursements" OWNER TO "postgres";


COMMENT ON TABLE "public"."disbursements" IS 'Payouts from platform to organizations';



CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fundraiser_id" "uuid",
    "user_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "fee_amount" numeric(8,2),
    "processing_fee" numeric(8,2),
    "net_amount" numeric(10,2),
    "payment_processor" character varying(50) DEFAULT 'fluidpay'::character varying,
    "payment_transaction_id" character varying(255),
    "payment_customer_id" character varying(255),
    "payment_method_type" character varying(50),
    "payment_method_last4" character varying(4),
    "payment_method_brand" character varying(20),
    "payment_processor_data" "jsonb",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "failure_reason" "text",
    "failure_code" character varying(50),
    "is_recurring" boolean DEFAULT false,
    "recurring_frequency" character varying(20),
    "parent_donation_id" "uuid",
    "subscription_id" character varying(255),
    "guest_donor_info" "jsonb",
    "donor_employer" character varying(255),
    "donor_occupation" character varying(255),
    "is_anonymous" boolean DEFAULT false,
    "compliance_flags" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "referrer_url" "text",
    "authorized_at" timestamp with time zone,
    "captured_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "donations_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "donations_recurring_frequency_check" CHECK ((("recurring_frequency")::"text" = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annually'::character varying])::"text"[]))),
    CONSTRAINT "donations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."donations" OWNER TO "postgres";


COMMENT ON TABLE "public"."donations" IS 'Donation transactions and payment records';



CREATE TABLE IF NOT EXISTS "public"."entity_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "relevance_score" integer DEFAULT 50 NOT NULL,
    "is_auto_tagged" boolean DEFAULT false,
    "tagged_by_user_id" "uuid",
    "tagged_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_tags_entity_type_check" CHECK ((("entity_type")::"text" = ANY ((ARRAY['organization'::character varying, 'fundraiser'::character varying, 'event'::character varying, 'user'::character varying, 'donation'::character varying])::"text"[]))),
    CONSTRAINT "entity_tags_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 100)))
);


ALTER TABLE "public"."entity_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_tags" IS 'Universal tagging system for all entities';



CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "status" character varying(20) DEFAULT 'registered'::character varying,
    "registration_type" character varying(20) DEFAULT 'attendee'::character varying,
    "guest_name" character varying(255),
    "guest_email" character varying(255),
    "guest_phone" character varying(20),
    "number_of_guests" integer DEFAULT 0,
    "volunteer_role" character varying(100),
    "volunteer_availability" "jsonb",
    "volunteer_skills" "jsonb",
    "dietary_restrictions" "text",
    "accessibility_needs" "text",
    "notes" "text",
    "custom_fields" "jsonb",
    "confirmation_sent" boolean DEFAULT false,
    "confirmation_sent_at" timestamp with time zone,
    "reminder_sent" boolean DEFAULT false,
    "reminder_sent_at" timestamp with time zone,
    "checked_in" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "checked_in_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_registrations_registration_type_check" CHECK ((("registration_type")::"text" = ANY ((ARRAY['attendee'::character varying, 'volunteer'::character varying, 'speaker'::character varying, 'organizer'::character varying])::"text"[]))),
    CONSTRAINT "event_registrations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['registered'::character varying, 'waitlisted'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'attended'::character varying, 'no_show'::character varying])::"text"[])))
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_registrations" IS 'Event registrations and attendance tracking';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "description" "text",
    "event_type" character varying(50) NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "time_zone" character varying(50) NOT NULL,
    "location_data" "jsonb",
    "is_virtual" boolean DEFAULT false,
    "virtual_link" character varying(500),
    "max_attendees" integer,
    "current_attendees" integer DEFAULT 0,
    "waitlist_enabled" boolean DEFAULT false,
    "max_waitlist" integer,
    "current_waitlist" integer DEFAULT 0,
    "is_public" boolean DEFAULT true,
    "requires_approval" boolean DEFAULT false,
    "allow_guests" boolean DEFAULT true,
    "max_guests_per_registration" integer DEFAULT 1,
    "instructions" "text",
    "contact_email" character varying(255),
    "contact_phone" character varying(20),
    "image_url" character varying(500),
    "accessibility_info" "jsonb",
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "is_active" boolean DEFAULT true,
    "volunteer_slots_available" integer,
    "volunteer_roles" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "events_event_type_check" CHECK ((("event_type")::"text" = ANY ((ARRAY['rally'::character varying, 'townhall'::character varying, 'fundraiser'::character varying, 'volunteer'::character varying, 'phonebank'::character varying, 'canvass'::character varying, 'meeting'::character varying, 'training'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'cancelled'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON TABLE "public"."events" IS 'Political events and volunteer opportunities';



CREATE TABLE IF NOT EXISTS "public"."fec_candidates" (
    "fec_cand_id" character varying(9) NOT NULL,
    "cand_name" character varying(200) NOT NULL,
    "cand_pty_affiliation" character varying(3),
    "cand_election_yr" integer,
    "cand_office_st" character varying(2),
    "cand_office" character varying(1) NOT NULL,
    "cand_office_district" character varying(2),
    "cand_ici" character varying(1),
    "cand_status" character varying(1),
    "cand_pcc" character varying(9),
    "cand_st1" character varying(34),
    "cand_st2" character varying(34),
    "cand_city" character varying(30),
    "cand_st" character varying(2),
    "cand_zip" character varying(9),
    "first_synced_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "sync_source" character varying(50) DEFAULT 'openfec_api'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fec_candidates_cand_ici_check" CHECK ((("cand_ici")::"text" = ANY ((ARRAY['C'::character varying, 'I'::character varying, 'O'::character varying])::"text"[]))),
    CONSTRAINT "fec_candidates_cand_office_check" CHECK ((("cand_office")::"text" = ANY ((ARRAY['H'::character varying, 'S'::character varying, 'P'::character varying])::"text"[])))
);


ALTER TABLE "public"."fec_candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."fec_candidates" IS 'Official FEC candidate master data synced from OpenFEC API';



COMMENT ON COLUMN "public"."fec_candidates"."fec_cand_id" IS 'FEC unique 9-character candidate ID (format: [H|S|P][0-9]{8})';



COMMENT ON COLUMN "public"."fec_candidates"."cand_office" IS 'H=House, S=Senate, P=President';



COMMENT ON COLUMN "public"."fec_candidates"."cand_ici" IS 'C=Challenger, I=Incumbent, O=Open Seat';



CREATE TABLE IF NOT EXISTS "public"."fec_committees" (
    "cmte_id" character varying(9) NOT NULL,
    "cmte_nm" character varying(200) NOT NULL,
    "tres_nm" character varying(90),
    "cmte_st1" character varying(34),
    "cmte_st2" character varying(34),
    "cmte_city" character varying(30),
    "cmte_st" character varying(2),
    "cmte_zip" character varying(9),
    "cmte_dsgn" character varying(1),
    "cmte_tp" character varying(1),
    "cmte_pty_affiliation" character varying(3),
    "cmte_filing_freq" character varying(1),
    "org_tp" character varying(1),
    "connected_org_nm" character varying(200),
    "first_synced_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fec_committees_cmte_dsgn_check" CHECK ((("cmte_dsgn")::"text" = ANY ((ARRAY['A'::character varying, 'J'::character varying, 'P'::character varying, 'U'::character varying, 'B'::character varying, 'D'::character varying])::"text"[]))),
    CONSTRAINT "fec_committees_cmte_tp_check" CHECK ((("cmte_tp")::"text" = ANY ((ARRAY['C'::character varying, 'D'::character varying, 'E'::character varying, 'H'::character varying, 'I'::character varying, 'N'::character varying, 'O'::character varying, 'P'::character varying, 'Q'::character varying, 'S'::character varying, 'U'::character varying, 'V'::character varying, 'W'::character varying, 'X'::character varying, 'Y'::character varying, 'Z'::character varying])::"text"[])))
);


ALTER TABLE "public"."fec_committees" OWNER TO "postgres";


COMMENT ON TABLE "public"."fec_committees" IS 'FEC committee master data for tracking authorized campaign committees';



COMMENT ON COLUMN "public"."fec_committees"."cmte_dsgn" IS 'A=Authorized, J=Joint Fundraiser, P=Principal, U=Unauthorized, B=Lobbyist/Registrant PAC, D=Leadership PAC';



CREATE TABLE IF NOT EXISTS "public"."fec_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" character varying(50) NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_seconds" integer,
    "status" character varying(20) NOT NULL,
    "records_processed" integer DEFAULT 0,
    "records_created" integer DEFAULT 0,
    "records_updated" integer DEFAULT 0,
    "records_failed" integer DEFAULT 0,
    "error_message" "text",
    "error_details" "jsonb",
    "failed_records" "jsonb",
    "api_endpoint" character varying(255),
    "api_parameters" "jsonb",
    "api_response_code" integer,
    "api_rate_limit_remaining" integer,
    "triggered_by" character varying(50),
    "triggered_by_user_id" "uuid",
    "notes" "text",
    "custom_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "fec_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['running'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial_success'::character varying])::"text"[]))),
    CONSTRAINT "fec_sync_log_sync_type_check" CHECK ((("sync_type")::"text" = ANY ((ARRAY['full_sync'::character varying, 'incremental_sync'::character varying, 'single_candidate'::character varying, 'manual_import'::character varying])::"text"[]))),
    CONSTRAINT "fec_sync_log_triggered_by_check" CHECK ((("triggered_by")::"text" = ANY ((ARRAY['scheduled_job'::character varying, 'manual_trigger'::character varying, 'api_request'::character varying, 'system_auto'::character varying])::"text"[])))
);


ALTER TABLE "public"."fec_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."fec_sync_log" IS 'Audit log for FEC API synchronization jobs';



COMMENT ON COLUMN "public"."fec_sync_log"."sync_type" IS 'Type of sync: full, incremental, single candidate, or manual import';



CREATE TABLE IF NOT EXISTS "public"."fundraisers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "description" "text",
    "goal_amount" numeric(12,2),
    "current_amount" numeric(12,2) DEFAULT 0,
    "minimum_donation" numeric(8,2) DEFAULT 1.00,
    "maximum_donation" numeric(8,2),
    "suggested_amounts" "jsonb" DEFAULT '[]'::"jsonb",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "image_url" character varying(500),
    "video_url" character varying(500),
    "custom_fields" "jsonb",
    "allow_anonymous" boolean DEFAULT false,
    "require_address" boolean DEFAULT true,
    "require_employer_info" boolean DEFAULT true,
    "allow_recurring" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "is_active" boolean DEFAULT true,
    "donation_count" integer DEFAULT 0,
    "unique_donors_count" integer DEFAULT 0,
    "last_donation_at" timestamp with time zone,
    "meta_description" "text",
    "social_image_url" character varying(500),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "fundraisers_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'paused'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."fundraisers" OWNER TO "postgres";


COMMENT ON TABLE "public"."fundraisers" IS 'Fundraising campaigns and events';



CREATE TABLE IF NOT EXISTS "public"."interest_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "icon_name" character varying(100) NOT NULL,
    "color_hex" character varying(7) NOT NULL,
    "color_bg" character varying(7) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."interest_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."interest_categories" IS 'Top-level interest categories';



CREATE TABLE IF NOT EXISTS "public"."interest_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "icon_name" character varying(100),
    "color_override" character varying(7),
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."interest_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."interest_tags" IS 'Detailed interest tags under categories';



CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(20) NOT NULL,
    "permissions" "jsonb",
    "status" character varying(20) DEFAULT 'active'::character varying,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    CONSTRAINT "organization_members_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'TREASURER'::character varying, 'CAMPAIGN_MANAGER'::character varying, 'VOLUNTEER_COORDINATOR'::character varying, 'CONTENT_EDITOR'::character varying, 'EVENT_ORGANIZER'::character varying, 'STAFF'::character varying, 'MEMBER'::character varying, 'VIEWER'::character varying])::"text"[]))),
    CONSTRAINT "organization_members_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'pending'::character varying])::"text"[])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_members" IS 'Association between users and organizations with roles';



CREATE OR REPLACE VIEW "public"."organization_users" AS
 SELECT "id",
    "organization_id",
    "user_id",
    "role",
    "permissions",
    "status",
    "invited_by",
    "invited_at",
    "accepted_at",
    "created_at",
    "updated_at",
    "created_by"
   FROM "public"."organization_members";


ALTER VIEW "public"."organization_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "legal_name" character varying(255) NOT NULL,
    "organization_type" character varying(50) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(20),
    "website" character varying(500),
    "street_address" "text" NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(2) NOT NULL,
    "postal_code" character varying(10) NOT NULL,
    "country" character varying(2) DEFAULT 'US'::character varying,
    "fec_id" character varying(20),
    "ein" character varying(20),
    "state_filing_id" character varying(50),
    "bank_account_number" "text",
    "routing_number" "text",
    "bank_name" character varying(255),
    "verification_status" character varying(20) DEFAULT 'pending'::character varying,
    "verification_documents" "jsonb",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "logo_url" character varying(500),
    "banner_image_url" character varying(500),
    "description" "text",
    "is_active" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "organizations_organization_type_check" CHECK ((("organization_type")::"text" = ANY ((ARRAY['candidate_committee'::character varying, 'pac'::character varying, 'super_pac'::character varying, 'party_committee'::character varying, 'nonprofit_501c3'::character varying, 'nonprofit_501c4'::character varying])::"text"[]))),
    CONSTRAINT "organizations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::"text"[]))),
    CONSTRAINT "organizations_verification_status_check" CHECK ((("verification_status")::"text" = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'rejected'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Political organizations, PACs, and campaigns';



CREATE TABLE IF NOT EXISTS "public"."permission_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "action" character varying(50) NOT NULL,
    "resource_type" character varying(50),
    "resource_id" "uuid",
    "permission_name" character varying(100),
    "was_granted" boolean,
    "metadata" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permission_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "resource" character varying(50) NOT NULL,
    "action" character varying(50) NOT NULL,
    "description" "text",
    "category" character varying(50),
    "is_sensitive" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_type" character varying(20) NOT NULL,
    "role_name" character varying(50) NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "granted_by" "uuid",
    CONSTRAINT "role_permissions_role_type_check" CHECK ((("role_type")::"text" = ANY ((ARRAY['platform'::character varying, 'organization'::character varying])::"text"[])))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" character varying(100) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "category" character varying(50) DEFAULT 'general'::character varying,
    "is_public" boolean DEFAULT false,
    "is_encrypted" boolean DEFAULT false,
    "version" integer DEFAULT 1,
    "previous_value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" "uuid"
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_config" IS 'System-wide configuration settings';



CREATE TABLE IF NOT EXISTS "public"."user_feed_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "interest_weights" "jsonb" DEFAULT '{}'::"jsonb",
    "content_type_preferences" "jsonb" DEFAULT '{"events": 50, "fundraisers": 50, "organizations": 50}'::"jsonb",
    "feed_algorithm" character varying(20) DEFAULT 'mixed'::character varying,
    "show_recommended_content" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_feed_preferences_feed_algorithm_check" CHECK ((("feed_algorithm")::"text" = ANY ((ARRAY['latest'::character varying, 'relevance'::character varying, 'popularity'::character varying, 'mixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_feed_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_feed_preferences" IS 'User personalization preferences';



CREATE TABLE IF NOT EXISTS "public"."user_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "priority" integer DEFAULT 3 NOT NULL,
    "is_active" boolean DEFAULT true,
    "selected_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_interests_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 5)))
);


ALTER TABLE "public"."user_interests" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_interests" IS 'User interest selections with priority';



CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "permission_id" "uuid" NOT NULL,
    "is_granted" boolean NOT NULL,
    "reason" "text",
    "expires_at" timestamp with time zone,
    "granted_by" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid"
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "email_verified" boolean DEFAULT false,
    "password_hash" character varying(255),
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "middle_name" character varying(100),
    "date_of_birth" "date",
    "phone" character varying(20),
    "phone_verified" boolean DEFAULT false,
    "street_address" "text",
    "city" character varying(100),
    "state" character varying(2),
    "postal_code" character varying(10),
    "country" character varying(2) DEFAULT 'US'::character varying,
    "employer" character varying(255),
    "occupation" character varying(255),
    "citizenship_status" character varying(20),
    "role" character varying(20) DEFAULT 'user'::character varying,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "kyc_status" character varying(20) DEFAULT 'pending'::character varying,
    "kyc_verified_at" timestamp with time zone,
    "mfa_enabled" boolean DEFAULT false,
    "mfa_secret" "text",
    "mfa_backup_codes" "text"[],
    "profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "avatar_url" character varying(500),
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "users_citizenship_status_check" CHECK ((("citizenship_status")::"text" = ANY ((ARRAY['citizen'::character varying, 'permanent_resident'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "users_kyc_status_check" CHECK ((("kyc_status")::"text" = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['super_admin'::character varying, 'platform_moderator'::character varying, 'compliance_officer'::character varying, 'support_staff'::character varying, 'developer'::character varying, 'user'::character varying])::"text"[]))),
    CONSTRAINT "users_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'pending_verification'::character varying])::"text"[])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'User accounts for the platform';



CREATE OR REPLACE VIEW "public"."v_active_fundraisers" AS
 SELECT "f"."id",
    "f"."organization_id",
    "f"."title",
    "f"."slug",
    "f"."description",
    "f"."goal_amount",
    "f"."current_amount",
    "f"."minimum_donation",
    "f"."maximum_donation",
    "f"."suggested_amounts",
    "f"."start_date",
    "f"."end_date",
    "f"."image_url",
    "f"."video_url",
    "f"."custom_fields",
    "f"."allow_anonymous",
    "f"."require_address",
    "f"."require_employer_info",
    "f"."allow_recurring",
    "f"."status",
    "f"."is_active",
    "f"."donation_count",
    "f"."unique_donors_count",
    "f"."last_donation_at",
    "f"."meta_description",
    "f"."social_image_url",
    "f"."created_at",
    "f"."updated_at",
    "f"."created_by",
    "f"."updated_by",
    "o"."name" AS "organization_name",
    "o"."slug" AS "organization_slug",
    "o"."logo_url" AS "organization_logo",
    COALESCE("f"."goal_amount", (0)::numeric) AS "goal",
    COALESCE("f"."current_amount", (0)::numeric) AS "raised",
        CASE
            WHEN ("f"."goal_amount" > (0)::numeric) THEN "round"((("f"."current_amount" / "f"."goal_amount") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "progress_percentage"
   FROM ("public"."fundraisers" "f"
     JOIN "public"."organizations" "o" ON (("f"."organization_id" = "o"."id")))
  WHERE (("f"."is_active" = true) AND ("o"."is_active" = true) AND (("f"."end_date" IS NULL) OR ("f"."end_date" >= CURRENT_DATE)));


ALTER VIEW "public"."v_active_fundraisers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_candidate_fundraising_totals" AS
 SELECT "c"."id" AS "candidate_id",
    "c"."display_name",
    "c"."office_type",
    "c"."party_affiliation",
    "count"(DISTINCT "cf"."fundraiser_id") AS "total_fundraisers",
    "count"(DISTINCT "cf"."organization_id") AS "supporting_organizations",
    "sum"("f"."current_amount") AS "total_raised_across_all_orgs",
    "sum"("f"."donation_count") AS "total_donations",
    "max"("f"."last_donation_at") AS "last_donation_at"
   FROM (("public"."candidates" "c"
     LEFT JOIN "public"."candidate_fundraisers" "cf" ON (("c"."id" = "cf"."candidate_id")))
     LEFT JOIN "public"."fundraisers" "f" ON (("cf"."fundraiser_id" = "f"."id")))
  WHERE ("c"."is_active" = true)
  GROUP BY "c"."id", "c"."display_name", "c"."office_type", "c"."party_affiliation";


ALTER VIEW "public"."v_candidate_fundraising_totals" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_candidate_fundraising_totals" IS 'Aggregate fundraising totals for each candidate across all organizations';



CREATE OR REPLACE VIEW "public"."v_fec_verified_candidates" AS
 SELECT "c"."id",
    "c"."fec_cand_id",
    "c"."display_name",
    "c"."slug",
    "c"."first_name",
    "c"."last_name",
    "c"."middle_name",
    "c"."nickname",
    "c"."office_type",
    "c"."office_state",
    "c"."office_district",
    "c"."election_year",
    "c"."party_affiliation",
    "c"."bio",
    "c"."campaign_platform",
    "c"."website_url",
    "c"."twitter_handle",
    "c"."facebook_url",
    "c"."instagram_handle",
    "c"."youtube_url",
    "c"."tiktok_handle",
    "c"."profile_image_url",
    "c"."banner_image_url",
    "c"."campaign_logo_url",
    "c"."verification_status",
    "c"."verified_at",
    "c"."verified_by",
    "c"."is_active",
    "c"."status",
    "c"."campaign_status",
    "c"."campaign_start_date",
    "c"."campaign_end_date",
    "c"."custom_fields",
    "c"."created_at",
    "c"."updated_at",
    "c"."created_by",
    "c"."updated_by",
    "fc"."cand_office",
    "fc"."cand_office_st",
    "fc"."cand_office_district",
    "fc"."cand_pty_affiliation" AS "fec_party",
    "fc"."cand_ici" AS "incumbent_status",
    "fc"."cand_election_yr" AS "fec_election_year"
   FROM ("public"."candidates" "c"
     JOIN "public"."fec_candidates" "fc" ON ((("c"."fec_cand_id")::"text" = ("fc"."fec_cand_id")::"text")))
  WHERE ((("c"."verification_status")::"text" = 'fec_verified'::"text") AND ("c"."is_active" = true) AND ("fc"."is_active" = true));


ALTER VIEW "public"."v_fec_verified_candidates" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_fec_verified_candidates" IS 'Active candidates with FEC verification and enriched data';



CREATE OR REPLACE VIEW "public"."v_interest_tags_with_categories" AS
 SELECT "t"."id",
    "t"."category_id",
    "t"."name",
    "t"."slug",
    "t"."description",
    "t"."icon_name",
    "t"."color_override",
    "t"."sort_order",
    "t"."is_active",
    "t"."metadata",
    "t"."created_at",
    "t"."updated_at",
    "c"."name" AS "category_name",
    "c"."slug" AS "category_slug",
    "c"."icon_name" AS "category_icon",
    "c"."color_hex" AS "category_color_hex",
    "c"."color_bg" AS "category_color_bg"
   FROM ("public"."interest_tags" "t"
     LEFT JOIN "public"."interest_categories" "c" ON (("t"."category_id" = "c"."id")))
  WHERE (("t"."is_active" = true) AND ("c"."is_active" = true));


ALTER VIEW "public"."v_interest_tags_with_categories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_upcoming_events" AS
 SELECT "e"."id",
    "e"."organization_id",
    "e"."title",
    "e"."slug",
    "e"."description",
    "e"."event_type",
    "e"."start_time",
    "e"."end_time",
    "e"."time_zone",
    "e"."location_data",
    "e"."is_virtual",
    "e"."virtual_link",
    "e"."max_attendees",
    "e"."current_attendees",
    "e"."waitlist_enabled",
    "e"."max_waitlist",
    "e"."current_waitlist",
    "e"."is_public",
    "e"."requires_approval",
    "e"."allow_guests",
    "e"."max_guests_per_registration",
    "e"."instructions",
    "e"."contact_email",
    "e"."contact_phone",
    "e"."image_url",
    "e"."accessibility_info",
    "e"."status",
    "e"."is_active",
    "e"."volunteer_slots_available",
    "e"."volunteer_roles",
    "e"."created_at",
    "e"."updated_at",
    "e"."created_by",
    "e"."updated_by",
    "o"."name" AS "organization_name",
    "o"."slug" AS "organization_slug",
    "o"."logo_url" AS "organization_logo",
    ("e"."max_attendees" - "e"."current_attendees") AS "spots_remaining",
        CASE
            WHEN (("e"."max_attendees" IS NOT NULL) AND ("e"."current_attendees" >= "e"."max_attendees")) THEN true
            ELSE false
        END AS "is_full"
   FROM ("public"."events" "e"
     JOIN "public"."organizations" "o" ON (("e"."organization_id" = "o"."id")))
  WHERE ((("e"."status")::"text" = 'published'::"text") AND ("e"."start_time" > CURRENT_TIMESTAMP) AND ("o"."is_active" = true))
  ORDER BY "e"."start_time";


ALTER VIEW "public"."v_upcoming_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_user_content_relevance" AS
 SELECT "ui"."user_id",
    "et"."entity_type",
    "et"."entity_id",
    "avg"(((("ui"."priority" * "et"."relevance_score"))::numeric / 100.0)) AS "relevance_score",
    "count"(*) AS "matching_interests"
   FROM ("public"."user_interests" "ui"
     JOIN "public"."entity_tags" "et" ON (("ui"."tag_id" = "et"."tag_id")))
  WHERE ("ui"."is_active" = true)
  GROUP BY "ui"."user_id", "et"."entity_type", "et"."entity_id";


ALTER VIEW "public"."v_user_content_relevance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."volunteer_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "volunteer_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "activity_type" character varying(50) NOT NULL,
    "activity_description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "hours" numeric(5,2) GENERATED ALWAYS AS ((EXTRACT(epoch FROM ("end_time" - "start_time")) / (3600)::numeric)) STORED,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "verification_notes" "text",
    "notes" "text",
    "tasks_completed" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "uuid",
    CONSTRAINT "volunteer_hours_activity_type_check" CHECK ((("activity_type")::"text" = ANY ((ARRAY['event_attendance'::character varying, 'phonebank'::character varying, 'canvass'::character varying, 'data_entry'::character varying, 'outreach'::character varying, 'training'::character varying, 'meeting'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "volunteer_hours_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."volunteer_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."volunteer_hours" IS 'Volunteer time tracking and verification';



CREATE TABLE IF NOT EXISTS "public"."volunteer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "interests" "jsonb" DEFAULT '[]'::"jsonb",
    "availability" "jsonb" DEFAULT '{}'::"jsonb",
    "languages" "jsonb" DEFAULT '["en"]'::"jsonb",
    "experience_level" character varying(20),
    "previous_campaigns" "text",
    "certifications" "jsonb" DEFAULT '[]'::"jsonb",
    "preferred_roles" "jsonb" DEFAULT '[]'::"jsonb",
    "preferred_activities" "jsonb" DEFAULT '[]'::"jsonb",
    "travel_radius_miles" integer,
    "has_transportation" boolean DEFAULT false,
    "can_host_events" boolean DEFAULT false,
    "background_check_status" character varying(20) DEFAULT 'pending'::character varying,
    "background_check_completed_at" timestamp with time zone,
    "background_check_expires_at" timestamp with time zone,
    "emergency_contact_name" character varying(255),
    "emergency_contact_phone" character varying(20),
    "emergency_contact_relationship" character varying(100),
    "total_hours_volunteered" numeric(10,2) DEFAULT 0,
    "events_attended" integer DEFAULT 0,
    "events_no_show" integer DEFAULT 0,
    "reliability_score" numeric(3,2) DEFAULT 1.00,
    "is_active" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "volunteer_capabilities" "jsonb" DEFAULT '{"can_lead_events": false, "can_approve_hours": false, "can_train_volunteers": false, "max_volunteers_supervised": 0}'::"jsonb",
    CONSTRAINT "volunteer_profiles_background_check_status_check" CHECK ((("background_check_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::"text"[]))),
    CONSTRAINT "volunteer_profiles_experience_level_check" CHECK ((("experience_level")::"text" = ANY ((ARRAY['team_lead'::character varying, 'experienced'::character varying, 'intermediate'::character varying, 'beginner'::character varying, 'inactive'::character varying])::"text"[]))),
    CONSTRAINT "volunteer_profiles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "public"."volunteer_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."volunteer_profiles" IS 'Extended volunteer information and qualifications';



CREATE OR REPLACE VIEW "public"."v_volunteer_stats" AS
 SELECT "vp"."user_id",
    "u"."first_name",
    "u"."last_name",
    "u"."email",
    "vp"."total_hours_volunteered",
    "vp"."events_attended",
    "vp"."reliability_score",
    "count"(DISTINCT "vh"."organization_id") AS "organizations_supported",
    "sum"("vh"."hours") FILTER (WHERE ("vh"."start_time" >= (CURRENT_TIMESTAMP - '30 days'::interval))) AS "hours_last_30_days",
    "count"(DISTINCT "vh"."event_id") FILTER (WHERE ("vh"."start_time" >= (CURRENT_TIMESTAMP - '90 days'::interval))) AS "events_last_90_days"
   FROM (("public"."volunteer_profiles" "vp"
     JOIN "public"."users" "u" ON (("vp"."user_id" = "u"."id")))
     LEFT JOIN "public"."volunteer_hours" "vh" ON ((("vp"."user_id" = "vh"."volunteer_id") AND (("vh"."status")::"text" = 'approved'::"text"))))
  WHERE ("vp"."is_active" = true)
  GROUP BY "vp"."user_id", "u"."first_name", "u"."last_name", "u"."email", "vp"."total_hours_volunteered", "vp"."events_attended", "vp"."reliability_score";


ALTER VIEW "public"."v_volunteer_stats" OWNER TO "postgres";


ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_01" FOR VALUES FROM ('2024-01-01 00:00:00') TO ('2024-02-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_02" FOR VALUES FROM ('2024-02-01 00:00:00') TO ('2024-03-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_03" FOR VALUES FROM ('2024-03-01 00:00:00') TO ('2024-04-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_04" FOR VALUES FROM ('2024-04-01 00:00:00') TO ('2024-05-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_05" FOR VALUES FROM ('2024-05-01 00:00:00') TO ('2024-06-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_06" FOR VALUES FROM ('2024-06-01 00:00:00') TO ('2024-07-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_07" FOR VALUES FROM ('2024-07-01 00:00:00') TO ('2024-08-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_08" FOR VALUES FROM ('2024-08-01 00:00:00') TO ('2024-09-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_09" FOR VALUES FROM ('2024-09-01 00:00:00') TO ('2024-10-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_10" FOR VALUES FROM ('2024-10-01 00:00:00') TO ('2024-11-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_11" FOR VALUES FROM ('2024-11-01 00:00:00') TO ('2024-12-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2024_12" FOR VALUES FROM ('2024-12-01 00:00:00') TO ('2025-01-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_01" FOR VALUES FROM ('2025-01-01 00:00:00') TO ('2025-02-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_02" FOR VALUES FROM ('2025-02-01 00:00:00') TO ('2025-03-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_03" FOR VALUES FROM ('2025-03-01 00:00:00') TO ('2025-04-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_04" FOR VALUES FROM ('2025-04-01 00:00:00') TO ('2025-05-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_05" FOR VALUES FROM ('2025-05-01 00:00:00') TO ('2025-06-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_06" FOR VALUES FROM ('2025-06-01 00:00:00') TO ('2025-07-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_07" FOR VALUES FROM ('2025-07-01 00:00:00') TO ('2025-08-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_08" FOR VALUES FROM ('2025-08-01 00:00:00') TO ('2025-09-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_09" FOR VALUES FROM ('2025-09-01 00:00:00') TO ('2025-10-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00') TO ('2025-11-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00') TO ('2025-12-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs" ATTACH PARTITION "audit"."audit_logs_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00') TO ('2026-01-01 00:00:00');



ALTER TABLE ONLY "audit"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_01"
    ADD CONSTRAINT "audit_logs_2024_01_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_02"
    ADD CONSTRAINT "audit_logs_2024_02_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_03"
    ADD CONSTRAINT "audit_logs_2024_03_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_04"
    ADD CONSTRAINT "audit_logs_2024_04_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_05"
    ADD CONSTRAINT "audit_logs_2024_05_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_06"
    ADD CONSTRAINT "audit_logs_2024_06_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_07"
    ADD CONSTRAINT "audit_logs_2024_07_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_08"
    ADD CONSTRAINT "audit_logs_2024_08_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_09"
    ADD CONSTRAINT "audit_logs_2024_09_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_10"
    ADD CONSTRAINT "audit_logs_2024_10_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_11"
    ADD CONSTRAINT "audit_logs_2024_11_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2024_12"
    ADD CONSTRAINT "audit_logs_2024_12_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_01"
    ADD CONSTRAINT "audit_logs_2025_01_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_02"
    ADD CONSTRAINT "audit_logs_2025_02_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_03"
    ADD CONSTRAINT "audit_logs_2025_03_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_04"
    ADD CONSTRAINT "audit_logs_2025_04_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_05"
    ADD CONSTRAINT "audit_logs_2025_05_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_06"
    ADD CONSTRAINT "audit_logs_2025_06_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_07"
    ADD CONSTRAINT "audit_logs_2025_07_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_08"
    ADD CONSTRAINT "audit_logs_2025_08_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_09"
    ADD CONSTRAINT "audit_logs_2025_09_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_10"
    ADD CONSTRAINT "audit_logs_2025_10_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_11"
    ADD CONSTRAINT "audit_logs_2025_11_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "audit"."audit_logs_2025_12"
    ADD CONSTRAINT "audit_logs_2025_12_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_committees"
    ADD CONSTRAINT "candidate_committees_fec_cand_id_cmte_id_cand_election_yr_key" UNIQUE ("fec_cand_id", "cmte_id", "cand_election_yr");



ALTER TABLE ONLY "public"."candidate_committees"
    ADD CONSTRAINT "candidate_committees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_candidate_id_fundraiser_id_key" UNIQUE ("candidate_id", "fundraiser_id");



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_candidate_id_organization_id_fundrais_key" UNIQUE ("candidate_id", "organization_id", "fundraiser_id");



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_fec_cand_id_key" UNIQUE ("fec_cand_id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."compliance_jurisdictions"
    ADD CONSTRAINT "compliance_jurisdictions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."compliance_jurisdictions"
    ADD CONSTRAINT "compliance_jurisdictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_reports"
    ADD CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disbursements"
    ADD CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disbursements"
    ADD CONSTRAINT "disbursements_reference_number_key" UNIQUE ("reference_number");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_tags"
    ADD CONSTRAINT "entity_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_tags"
    ADD CONSTRAINT "entity_tags_tag_id_entity_type_entity_id_key" UNIQUE ("tag_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."fec_candidates"
    ADD CONSTRAINT "fec_candidates_pkey" PRIMARY KEY ("fec_cand_id");



ALTER TABLE ONLY "public"."fec_committees"
    ADD CONSTRAINT "fec_committees_pkey" PRIMARY KEY ("cmte_id");



ALTER TABLE ONLY "public"."fec_sync_log"
    ADD CONSTRAINT "fec_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fundraisers"
    ADD CONSTRAINT "fundraisers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fundraisers"
    ADD CONSTRAINT "fundraisers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."interest_categories"
    ADD CONSTRAINT "interest_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."interest_categories"
    ADD CONSTRAINT "interest_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interest_categories"
    ADD CONSTRAINT "interest_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."interest_tags"
    ADD CONSTRAINT "interest_tags_category_id_slug_key" UNIQUE ("category_id", "slug");



ALTER TABLE ONLY "public"."interest_tags"
    ADD CONSTRAINT "interest_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interest_tags"
    ADD CONSTRAINT "interest_tags_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_type_role_name_permission_id_key" UNIQUE ("role_type", "role_name", "permission_id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_feed_preferences"
    ADD CONSTRAINT "user_feed_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_feed_preferences"
    ADD CONSTRAINT "user_feed_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_user_id_tag_id_key" UNIQUE ("user_id", "tag_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_hours"
    ADD CONSTRAINT "volunteer_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_profiles"
    ADD CONSTRAINT "volunteer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_profiles"
    ADD CONSTRAINT "volunteer_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_audit_created" ON ONLY "audit"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_01_created_at_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("created_at");



CREATE INDEX "idx_audit_operation" ON ONLY "audit"."audit_logs" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_01_operation_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("operation");



CREATE INDEX "idx_audit_record" ON ONLY "audit"."audit_logs" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_01_record_id_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("record_id");



CREATE INDEX "idx_audit_risk" ON ONLY "audit"."audit_logs" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_01_risk_score_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "idx_audit_table" ON ONLY "audit"."audit_logs" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_01_table_name_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("table_name");



CREATE INDEX "idx_audit_user" ON ONLY "audit"."audit_logs" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_01_user_id_idx" ON "audit"."audit_logs_2024_01" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_02_created_at_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_02_operation_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_02_record_id_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_02_risk_score_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_02_table_name_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_02_user_id_idx" ON "audit"."audit_logs_2024_02" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_03_created_at_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_03_operation_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_03_record_id_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_03_risk_score_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_03_table_name_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_03_user_id_idx" ON "audit"."audit_logs_2024_03" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_04_created_at_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_04_operation_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_04_record_id_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_04_risk_score_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_04_table_name_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_04_user_id_idx" ON "audit"."audit_logs_2024_04" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_05_created_at_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_05_operation_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_05_record_id_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_05_risk_score_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_05_table_name_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_05_user_id_idx" ON "audit"."audit_logs_2024_05" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_06_created_at_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_06_operation_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_06_record_id_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_06_risk_score_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_06_table_name_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_06_user_id_idx" ON "audit"."audit_logs_2024_06" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_07_created_at_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_07_operation_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_07_record_id_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_07_risk_score_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_07_table_name_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_07_user_id_idx" ON "audit"."audit_logs_2024_07" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_08_created_at_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_08_operation_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_08_record_id_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_08_risk_score_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_08_table_name_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_08_user_id_idx" ON "audit"."audit_logs_2024_08" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_09_created_at_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_09_operation_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_09_record_id_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_09_risk_score_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_09_table_name_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_09_user_id_idx" ON "audit"."audit_logs_2024_09" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_10_created_at_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_10_operation_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_10_record_id_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_10_risk_score_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_10_table_name_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_10_user_id_idx" ON "audit"."audit_logs_2024_10" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_11_created_at_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_11_operation_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_11_record_id_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_11_risk_score_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_11_table_name_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_11_user_id_idx" ON "audit"."audit_logs_2024_11" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2024_12_created_at_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2024_12_operation_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("operation");



CREATE INDEX "audit_logs_2024_12_record_id_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2024_12_risk_score_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2024_12_table_name_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2024_12_user_id_idx" ON "audit"."audit_logs_2024_12" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_01_created_at_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_01_operation_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_01_record_id_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_01_risk_score_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_01_table_name_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_01_user_id_idx" ON "audit"."audit_logs_2025_01" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_02_created_at_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_02_operation_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_02_record_id_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_02_risk_score_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_02_table_name_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_02_user_id_idx" ON "audit"."audit_logs_2025_02" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_03_created_at_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_03_operation_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_03_record_id_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_03_risk_score_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_03_table_name_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_03_user_id_idx" ON "audit"."audit_logs_2025_03" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_04_created_at_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_04_operation_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_04_record_id_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_04_risk_score_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_04_table_name_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_04_user_id_idx" ON "audit"."audit_logs_2025_04" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_05_created_at_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_05_operation_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_05_record_id_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_05_risk_score_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_05_table_name_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_05_user_id_idx" ON "audit"."audit_logs_2025_05" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_06_created_at_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_06_operation_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_06_record_id_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_06_risk_score_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_06_table_name_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_06_user_id_idx" ON "audit"."audit_logs_2025_06" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_07_created_at_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_07_operation_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_07_record_id_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_07_risk_score_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_07_table_name_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_07_user_id_idx" ON "audit"."audit_logs_2025_07" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_08_created_at_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_08_operation_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_08_record_id_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_08_risk_score_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_08_table_name_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_08_user_id_idx" ON "audit"."audit_logs_2025_08" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_09_created_at_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_09_operation_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_09_record_id_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_09_risk_score_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_09_table_name_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_09_user_id_idx" ON "audit"."audit_logs_2025_09" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_10_created_at_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_10_operation_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_10_record_id_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_10_risk_score_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_10_table_name_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_10_user_id_idx" ON "audit"."audit_logs_2025_10" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_11_created_at_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_11_operation_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_11_record_id_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_11_risk_score_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_11_table_name_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_11_user_id_idx" ON "audit"."audit_logs_2025_11" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "audit_logs_2025_12_created_at_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("created_at");



CREATE INDEX "audit_logs_2025_12_operation_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("operation");



CREATE INDEX "audit_logs_2025_12_record_id_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("record_id");



CREATE INDEX "audit_logs_2025_12_risk_score_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("risk_score") WHERE ("risk_score" > 50);



CREATE INDEX "audit_logs_2025_12_table_name_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("table_name");



CREATE INDEX "audit_logs_2025_12_user_id_idx" ON "audit"."audit_logs_2025_12" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_candidate_committees_candidate" ON "public"."candidate_committees" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_committees_cmte" ON "public"."candidate_committees" USING "btree" ("cmte_id");



CREATE INDEX "idx_candidate_committees_election" ON "public"."candidate_committees" USING "btree" ("cand_election_yr");



CREATE INDEX "idx_candidate_committees_fec_cand" ON "public"."candidate_committees" USING "btree" ("fec_cand_id");



CREATE INDEX "idx_candidate_fundraisers_approval" ON "public"."candidate_fundraisers" USING "btree" ("approval_status");



CREATE INDEX "idx_candidate_fundraisers_candidate" ON "public"."candidate_fundraisers" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_fundraisers_fundraiser" ON "public"."candidate_fundraisers" USING "btree" ("fundraiser_id");



CREATE INDEX "idx_candidate_fundraisers_organization" ON "public"."candidate_fundraisers" USING "btree" ("organization_id");



CREATE INDEX "idx_candidate_fundraisers_primary" ON "public"."candidate_fundraisers" USING "btree" ("candidate_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_candidates_election" ON "public"."candidates" USING "btree" ("election_year");



CREATE INDEX "idx_candidates_fec" ON "public"."candidates" USING "btree" ("fec_cand_id");



CREATE INDEX "idx_candidates_name_search" ON "public"."candidates" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((("display_name")::"text" || ' '::"text") || COALESCE("bio", ''::"text"))));



CREATE INDEX "idx_candidates_office" ON "public"."candidates" USING "btree" ("office_type", "office_state", "office_district");



CREATE INDEX "idx_candidates_party" ON "public"."candidates" USING "btree" ("party_affiliation");



CREATE INDEX "idx_candidates_slug" ON "public"."candidates" USING "btree" ("slug");



CREATE INDEX "idx_candidates_status" ON "public"."candidates" USING "btree" ("status", "is_active");



CREATE INDEX "idx_candidates_verification" ON "public"."candidates" USING "btree" ("verification_status");



CREATE INDEX "idx_compliance_reports_due_date" ON "public"."compliance_reports" USING "btree" ("due_date");



CREATE INDEX "idx_compliance_reports_jurisdiction" ON "public"."compliance_reports" USING "btree" ("jurisdiction_id");



CREATE INDEX "idx_compliance_reports_org" ON "public"."compliance_reports" USING "btree" ("organization_id");



CREATE INDEX "idx_compliance_reports_period" ON "public"."compliance_reports" USING "btree" ("filing_period_start", "filing_period_end");



CREATE INDEX "idx_compliance_reports_status" ON "public"."compliance_reports" USING "btree" ("status");



CREATE INDEX "idx_compliance_reports_type" ON "public"."compliance_reports" USING "btree" ("report_type");



CREATE INDEX "idx_disbursements_batch" ON "public"."disbursements" USING "btree" ("batch_id") WHERE ("batch_id" IS NOT NULL);



CREATE INDEX "idx_disbursements_created" ON "public"."disbursements" USING "btree" ("created_at");



CREATE INDEX "idx_disbursements_org" ON "public"."disbursements" USING "btree" ("organization_id");



CREATE INDEX "idx_disbursements_status" ON "public"."disbursements" USING "btree" ("status");



CREATE INDEX "idx_donations_completed" ON "public"."donations" USING "btree" ("status", "completed_at") WHERE (("status")::"text" = 'completed'::"text");



CREATE INDEX "idx_donations_created" ON "public"."donations" USING "btree" ("created_at");



CREATE INDEX "idx_donations_fundraiser" ON "public"."donations" USING "btree" ("fundraiser_id");



CREATE INDEX "idx_donations_org" ON "public"."donations" USING "btree" ("organization_id");



CREATE INDEX "idx_donations_payment_tx" ON "public"."donations" USING "btree" ("payment_transaction_id") WHERE ("payment_transaction_id" IS NOT NULL);



CREATE INDEX "idx_donations_recurring" ON "public"."donations" USING "btree" ("is_recurring", "recurring_frequency") WHERE ("is_recurring" = true);



CREATE INDEX "idx_donations_status" ON "public"."donations" USING "btree" ("status");



CREATE INDEX "idx_donations_user" ON "public"."donations" USING "btree" ("user_id");



CREATE INDEX "idx_entity_tags_auto_tagged" ON "public"."entity_tags" USING "btree" ("is_auto_tagged");



CREATE INDEX "idx_entity_tags_entity_id" ON "public"."entity_tags" USING "btree" ("entity_id");



CREATE INDEX "idx_entity_tags_entity_type" ON "public"."entity_tags" USING "btree" ("entity_type");



CREATE INDEX "idx_entity_tags_relevance_score" ON "public"."entity_tags" USING "btree" ("relevance_score");



CREATE INDEX "idx_entity_tags_tag_id" ON "public"."entity_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_entity_tags_type_id" ON "public"."entity_tags" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_event_registrations_event" ON "public"."event_registrations" USING "btree" ("event_id");



CREATE INDEX "idx_event_registrations_guest_email" ON "public"."event_registrations" USING "btree" ("guest_email");



CREATE INDEX "idx_event_registrations_status" ON "public"."event_registrations" USING "btree" ("status");



CREATE INDEX "idx_event_registrations_type" ON "public"."event_registrations" USING "btree" ("registration_type");



CREATE INDEX "idx_event_registrations_user" ON "public"."event_registrations" USING "btree" ("user_id");



CREATE INDEX "idx_events_end_time" ON "public"."events" USING "btree" ("end_time");



CREATE INDEX "idx_events_is_public" ON "public"."events" USING "btree" ("is_public");



CREATE INDEX "idx_events_org" ON "public"."events" USING "btree" ("organization_id");



CREATE INDEX "idx_events_search" ON "public"."events" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((("title")::"text" || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_events_slug" ON "public"."events" USING "btree" ("slug");



CREATE INDEX "idx_events_start_time" ON "public"."events" USING "btree" ("start_time");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_events_type" ON "public"."events" USING "btree" ("event_type");



CREATE INDEX "idx_fec_candidates_active" ON "public"."fec_candidates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fec_candidates_election" ON "public"."fec_candidates" USING "btree" ("cand_election_yr");



CREATE INDEX "idx_fec_candidates_name_search" ON "public"."fec_candidates" USING "gin" ("to_tsvector"('"english"'::"regconfig", ("cand_name")::"text"));



CREATE INDEX "idx_fec_candidates_office" ON "public"."fec_candidates" USING "btree" ("cand_office", "cand_office_st");



CREATE INDEX "idx_fec_candidates_party" ON "public"."fec_candidates" USING "btree" ("cand_pty_affiliation");



CREATE INDEX "idx_fec_committees_active" ON "public"."fec_committees" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fec_committees_name" ON "public"."fec_committees" USING "btree" ("cmte_nm");



CREATE INDEX "idx_fec_committees_type" ON "public"."fec_committees" USING "btree" ("cmte_tp", "cmte_dsgn");



CREATE INDEX "idx_fec_sync_log_started" ON "public"."fec_sync_log" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_fec_sync_log_status" ON "public"."fec_sync_log" USING "btree" ("status");



CREATE INDEX "idx_fec_sync_log_type" ON "public"."fec_sync_log" USING "btree" ("sync_type");



CREATE INDEX "idx_fundraisers_active" ON "public"."fundraisers" USING "btree" ("status", "start_date") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_fundraisers_dates" ON "public"."fundraisers" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_fundraisers_org" ON "public"."fundraisers" USING "btree" ("organization_id");



CREATE INDEX "idx_fundraisers_search" ON "public"."fundraisers" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((("title")::"text" || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_fundraisers_slug" ON "public"."fundraisers" USING "btree" ("slug");



CREATE INDEX "idx_fundraisers_status" ON "public"."fundraisers" USING "btree" ("status");



CREATE INDEX "idx_interest_categories_is_active" ON "public"."interest_categories" USING "btree" ("is_active");



CREATE INDEX "idx_interest_categories_slug" ON "public"."interest_categories" USING "btree" ("slug");



CREATE INDEX "idx_interest_categories_sort_order" ON "public"."interest_categories" USING "btree" ("sort_order");



CREATE INDEX "idx_interest_tags_category_id" ON "public"."interest_tags" USING "btree" ("category_id");



CREATE INDEX "idx_interest_tags_is_active" ON "public"."interest_tags" USING "btree" ("is_active");



CREATE INDEX "idx_interest_tags_metadata" ON "public"."interest_tags" USING "gin" ("metadata");



CREATE INDEX "idx_interest_tags_name" ON "public"."interest_tags" USING "btree" ("name");



CREATE INDEX "idx_interest_tags_slug" ON "public"."interest_tags" USING "btree" ("slug");



CREATE INDEX "idx_interest_tags_sort_order" ON "public"."interest_tags" USING "btree" ("sort_order");



CREATE INDEX "idx_jurisdictions_code" ON "public"."compliance_jurisdictions" USING "btree" ("code");



CREATE INDEX "idx_jurisdictions_is_active" ON "public"."compliance_jurisdictions" USING "btree" ("is_active");



CREATE INDEX "idx_jurisdictions_type" ON "public"."compliance_jurisdictions" USING "btree" ("jurisdiction_type");



CREATE INDEX "idx_org_members_org" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_org_members_role" ON "public"."organization_members" USING "btree" ("role");



CREATE INDEX "idx_org_members_status" ON "public"."organization_members" USING "btree" ("status");



CREATE INDEX "idx_org_members_user" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_orgs_created_at" ON "public"."organizations" USING "btree" ("created_at");



CREATE INDEX "idx_orgs_fec" ON "public"."organizations" USING "btree" ("fec_id") WHERE ("fec_id" IS NOT NULL);



CREATE INDEX "idx_orgs_name" ON "public"."organizations" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_orgs_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE INDEX "idx_orgs_status" ON "public"."organizations" USING "btree" ("status", "verification_status");



CREATE INDEX "idx_orgs_type" ON "public"."organizations" USING "btree" ("organization_type");



CREATE INDEX "idx_permission_audit_denied" ON "public"."permission_audit_log" USING "btree" ("action", "created_at" DESC) WHERE (("action")::"text" = 'access_denied'::"text");



CREATE INDEX "idx_permission_audit_org" ON "public"."permission_audit_log" USING "btree" ("organization_id", "created_at" DESC) WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "idx_permission_audit_user" ON "public"."permission_audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_permissions_category" ON "public"."permissions" USING "btree" ("category");



CREATE INDEX "idx_permissions_resource" ON "public"."permissions" USING "btree" ("resource");



CREATE INDEX "idx_permissions_sensitive" ON "public"."permissions" USING "btree" ("is_sensitive") WHERE ("is_sensitive" = true);



CREATE INDEX "idx_role_permissions_permission" ON "public"."role_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_role_permissions_type" ON "public"."role_permissions" USING "btree" ("role_type", "role_name");



CREATE INDEX "idx_system_config_category" ON "public"."system_config" USING "btree" ("category");



CREATE INDEX "idx_system_config_public" ON "public"."system_config" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_user_feed_preferences_user_id" ON "public"."user_feed_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_interests_is_active" ON "public"."user_interests" USING "btree" ("is_active");



CREATE INDEX "idx_user_interests_priority" ON "public"."user_interests" USING "btree" ("priority");



CREATE INDEX "idx_user_interests_tag_id" ON "public"."user_interests" USING "btree" ("tag_id");



CREATE INDEX "idx_user_interests_user_id" ON "public"."user_interests" USING "btree" ("user_id");



CREATE INDEX "idx_user_permissions_active" ON "public"."user_permissions" USING "btree" ("user_id", "is_granted") WHERE ("is_granted" = true);



CREATE INDEX "idx_user_permissions_org" ON "public"."user_permissions" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_user_permissions_unique_with_org" ON "public"."user_permissions" USING "btree" ("user_id", "permission_id", "organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_user_permissions_unique_without_org" ON "public"."user_permissions" USING "btree" ("user_id", "permission_id") WHERE ("organization_id" IS NULL);



CREATE INDEX "idx_user_permissions_user" ON "public"."user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_users_active" ON "public"."users" USING "btree" ("id") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_users_created_at" ON "public"."users" USING "btree" ("created_at");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status", "kyc_status");



CREATE INDEX "idx_volunteer_hours_activity_type" ON "public"."volunteer_hours" USING "btree" ("activity_type");



CREATE INDEX "idx_volunteer_hours_event" ON "public"."volunteer_hours" USING "btree" ("event_id");



CREATE INDEX "idx_volunteer_hours_org" ON "public"."volunteer_hours" USING "btree" ("organization_id");



CREATE INDEX "idx_volunteer_hours_start_time" ON "public"."volunteer_hours" USING "btree" ("start_time");



CREATE INDEX "idx_volunteer_hours_status" ON "public"."volunteer_hours" USING "btree" ("status");



CREATE INDEX "idx_volunteer_hours_volunteer" ON "public"."volunteer_hours" USING "btree" ("volunteer_id");



CREATE INDEX "idx_volunteer_profiles_background_check" ON "public"."volunteer_profiles" USING "btree" ("background_check_status");



CREATE INDEX "idx_volunteer_profiles_capabilities" ON "public"."volunteer_profiles" USING "gin" ("volunteer_capabilities");



CREATE INDEX "idx_volunteer_profiles_status" ON "public"."volunteer_profiles" USING "btree" ("status");



CREATE INDEX "idx_volunteer_profiles_user" ON "public"."volunteer_profiles" USING "btree" ("user_id");



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_01_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_01_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_01_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_01_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_01_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_01_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_01_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_02_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_02_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_02_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_02_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_02_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_02_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_02_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_03_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_03_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_03_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_03_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_03_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_03_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_03_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_04_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_04_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_04_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_04_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_04_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_04_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_04_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_05_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_05_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_05_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_05_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_05_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_05_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_05_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_06_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_06_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_06_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_06_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_06_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_06_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_06_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_07_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_07_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_07_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_07_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_07_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_07_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_07_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_08_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_08_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_08_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_08_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_08_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_08_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_08_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_09_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_09_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_09_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_09_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_09_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_09_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_09_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_10_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_10_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_10_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_10_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_10_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_10_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_10_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_11_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_11_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_11_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_11_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_11_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_11_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_11_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2024_12_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2024_12_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2024_12_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2024_12_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2024_12_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2024_12_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2024_12_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_01_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_01_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_01_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_01_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_01_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_01_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_01_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_02_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_02_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_02_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_02_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_02_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_02_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_02_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_03_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_03_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_03_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_03_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_03_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_03_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_03_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_04_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_04_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_04_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_04_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_04_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_04_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_04_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_05_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_05_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_05_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_05_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_05_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_05_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_05_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_06_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_06_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_06_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_06_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_06_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_06_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_06_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_07_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_07_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_07_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_07_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_07_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_07_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_07_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_08_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_08_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_08_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_08_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_08_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_08_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_08_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_09_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_09_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_09_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_09_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_09_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_09_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_09_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_10_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_10_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_10_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_10_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_10_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_10_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_10_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_11_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_11_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_11_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_11_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_11_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_11_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_11_user_id_idx";



ALTER INDEX "audit"."idx_audit_created" ATTACH PARTITION "audit"."audit_logs_2025_12_created_at_idx";



ALTER INDEX "audit"."idx_audit_operation" ATTACH PARTITION "audit"."audit_logs_2025_12_operation_idx";



ALTER INDEX "audit"."audit_logs_pkey" ATTACH PARTITION "audit"."audit_logs_2025_12_pkey";



ALTER INDEX "audit"."idx_audit_record" ATTACH PARTITION "audit"."audit_logs_2025_12_record_id_idx";



ALTER INDEX "audit"."idx_audit_risk" ATTACH PARTITION "audit"."audit_logs_2025_12_risk_score_idx";



ALTER INDEX "audit"."idx_audit_table" ATTACH PARTITION "audit"."audit_logs_2025_12_table_name_idx";



ALTER INDEX "audit"."idx_audit_user" ATTACH PARTITION "audit"."audit_logs_2025_12_user_id_idx";



CREATE OR REPLACE TRIGGER "update_candidate_fundraisers_timestamp" BEFORE UPDATE ON "public"."candidate_fundraisers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_candidates_timestamp" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_candidate_updated_at"();



CREATE OR REPLACE TRIGGER "update_compliance_jurisdictions_updated_at" BEFORE UPDATE ON "public"."compliance_jurisdictions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compliance_reports_updated_at" BEFORE UPDATE ON "public"."compliance_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_disbursements_updated_at" BEFORE UPDATE ON "public"."disbursements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_donations_updated_at" BEFORE UPDATE ON "public"."donations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_entity_tags_updated_at" BEFORE UPDATE ON "public"."entity_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_attendance_on_registration" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_attendance"();



CREATE OR REPLACE TRIGGER "update_event_registrations_updated_at" BEFORE UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_fec_candidates_timestamp" BEFORE UPDATE ON "public"."fec_candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_fundraiser_amount_on_donation" AFTER INSERT OR UPDATE ON "public"."donations" FOR EACH ROW WHEN ((("new"."status")::"text" = 'completed'::"text")) EXECUTE FUNCTION "public"."update_fundraiser_current_amount"();



CREATE OR REPLACE TRIGGER "update_fundraisers_updated_at" BEFORE UPDATE ON "public"."fundraisers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_interest_categories_updated_at" BEFORE UPDATE ON "public"."interest_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_interest_tags_updated_at" BEFORE UPDATE ON "public"."interest_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_interests_updated_at" BEFORE UPDATE ON "public"."user_interests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_volunteer_hours_updated_at" BEFORE UPDATE ON "public"."volunteer_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_volunteer_profiles_updated_at" BEFORE UPDATE ON "public"."volunteer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidate_committees"
    ADD CONSTRAINT "candidate_committees_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_committees"
    ADD CONSTRAINT "candidate_committees_cmte_id_fkey" FOREIGN KEY ("cmte_id") REFERENCES "public"."fec_committees"("cmte_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_committees"
    ADD CONSTRAINT "candidate_committees_fec_cand_id_fkey" FOREIGN KEY ("fec_cand_id") REFERENCES "public"."fec_candidates"("fec_cand_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_fundraiser_id_fkey" FOREIGN KEY ("fundraiser_id") REFERENCES "public"."fundraisers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_fundraisers"
    ADD CONSTRAINT "candidate_fundraisers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_fec_cand_id_fkey" FOREIGN KEY ("fec_cand_id") REFERENCES "public"."fec_candidates"("fec_cand_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."compliance_reports"
    ADD CONSTRAINT "compliance_reports_filed_by_fkey" FOREIGN KEY ("filed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."compliance_reports"
    ADD CONSTRAINT "compliance_reports_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."compliance_jurisdictions"("id");



ALTER TABLE ONLY "public"."compliance_reports"
    ADD CONSTRAINT "compliance_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."disbursements"
    ADD CONSTRAINT "disbursements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_fundraiser_id_fkey" FOREIGN KEY ("fundraiser_id") REFERENCES "public"."fundraisers"("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_parent_donation_id_fkey" FOREIGN KEY ("parent_donation_id") REFERENCES "public"."donations"("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."entity_tags"
    ADD CONSTRAINT "entity_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."interest_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_tags"
    ADD CONSTRAINT "entity_tags_tagged_by_user_id_fkey" FOREIGN KEY ("tagged_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fec_sync_log"
    ADD CONSTRAINT "fec_sync_log_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."fundraisers"
    ADD CONSTRAINT "fundraisers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interest_tags"
    ADD CONSTRAINT "interest_tags_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."interest_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."permission_audit_log"
    ADD CONSTRAINT "permission_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_feed_preferences"
    ADD CONSTRAINT "user_feed_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."interest_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interests"
    ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_hours"
    ADD CONSTRAINT "volunteer_hours_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."volunteer_hours"
    ADD CONSTRAINT "volunteer_hours_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_hours"
    ADD CONSTRAINT "volunteer_hours_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."volunteer_hours"
    ADD CONSTRAINT "volunteer_hours_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_profiles"
    ADD CONSTRAINT "volunteer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and staff can create fundraisers" ON "public"."fundraisers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "fundraisers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'staff'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins and staff can update fundraisers" ON "public"."fundraisers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "fundraisers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'staff'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins and treasurers can view disbursements" ON "public"."disbursements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "disbursements"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'treasurer'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins can manage events" ON "public"."events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "events"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = 'admin'::"text") AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins can manage organization members" ON "public"."organization_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND (("om"."role")::"text" = 'admin'::"text") AND (("om"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins can update their organization" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = 'admin'::"text") AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Admins can view all organization members" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND (("om"."role")::"text" = 'admin'::"text") AND (("om"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Allow user registration" ON "public"."users" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Authenticated can create candidates" ON "public"."candidates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can view permissions" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view sync log" ON "public"."fec_sync_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create donations" ON "public"."donations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Members can tag organization entities" ON "public"."entity_tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Members can view organization events" ON "public"."events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "events"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Members can view organization fundraisers" ON "public"."fundraisers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "fundraisers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Members can view their organization" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org admins can create candidate fundraisers" ON "public"."candidate_fundraisers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "candidate_fundraisers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = 'admin'::"text") AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org admins can create compliance reports" ON "public"."compliance_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "compliance_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'TREASURER'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org admins can manage volunteer hours" ON "public"."volunteer_hours" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "volunteer_hours"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'VOLUNTEER_COORDINATOR'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org admins can update compliance reports" ON "public"."compliance_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "compliance_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'TREASURER'::character varying])::"text"[])) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org members can view org compliance reports" ON "public"."compliance_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "compliance_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org members can view org volunteer hours" ON "public"."volunteer_hours" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "volunteer_hours"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Org members can view volunteer profiles" ON "public"."volunteer_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Organization can view all registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organization_members" "ou" ON (("ou"."organization_id" = "e"."organization_id")))
  WHERE (("e"."id" = "event_registrations"."event_id") AND ("ou"."user_id" = "auth"."uid"()) AND (("ou"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Organization members can view org donations" ON "public"."donations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "donations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Public can view FEC candidates" ON "public"."fec_candidates" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view FEC committees" ON "public"."fec_committees" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view active fundraisers" ON "public"."fundraisers" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'active'::"text"));



CREATE POLICY "Public can view approved candidate fundraisers" ON "public"."candidate_fundraisers" FOR SELECT TO "authenticated", "anon" USING ((("approval_status")::"text" = 'approved'::"text"));



CREATE POLICY "Public can view candidate committees" ON "public"."candidate_committees" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view compliance jurisdictions" ON "public"."compliance_jurisdictions" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public can view entity tags" ON "public"."entity_tags" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view interest categories" ON "public"."interest_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public can view interest tags" ON "public"."interest_tags" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public can view public config" ON "public"."system_config" FOR SELECT TO "authenticated", "anon" USING (("is_public" = true));



CREATE POLICY "Public can view published events" ON "public"."events" FOR SELECT TO "authenticated", "anon" USING ((("status")::"text" = 'published'::"text"));



CREATE POLICY "Public can view verified candidates" ON "public"."candidates" FOR SELECT TO "authenticated", "anon" USING (((("verification_status")::"text" = ANY ((ARRAY['fec_verified'::character varying, 'claimed'::character varying])::"text"[])) AND (("campaign_status")::"text" = 'active'::"text")));



CREATE POLICY "Public can view verified organizations" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (((("status")::"text" = 'active'::"text") AND (("verification_status")::"text" = 'verified'::"text")));



CREATE POLICY "Service can update donations" ON "public"."donations" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Super admins can approve disbursements" ON "public"."disbursements" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can manage all organizations" ON "public"."organizations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can manage all users" ON "public"."users" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND (("users_1"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can manage config" ON "public"."system_config" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can manage permissions" ON "public"."user_permissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all users" ON "public"."users" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND (("users_1"."role")::"text" = 'super_admin'::"text")))));



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Treasurers can create disbursements" ON "public"."disbursements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "disbursements"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND (("organization_members"."role")::"text" = 'treasurer'::"text") AND (("organization_members"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Users can create own volunteer hours" ON "public"."volunteer_hours" FOR INSERT TO "authenticated" WITH CHECK (("volunteer_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own feed preferences" ON "public"."user_feed_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own interests" ON "public"."user_interests" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own volunteer profile" ON "public"."volunteer_profiles" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can register for events" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own candidate profile" ON "public"."candidates" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own donations" ON "public"."donations" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own interests" ON "public"."user_interests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own memberships" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own permissions" ON "public"."user_permissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own volunteer hours" ON "public"."volunteer_hours" FOR SELECT TO "authenticated" USING (("volunteer_id" = "auth"."uid"()));



CREATE POLICY "Users can view own volunteer profile" ON "public"."volunteer_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view permission audit log" ON "public"."permission_audit_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_committees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_fundraisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_jurisdictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disbursements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fec_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fec_committees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fec_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fundraisers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interest_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interest_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_feed_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."volunteer_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."volunteer_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;







































































































































































































RESET ALL;
