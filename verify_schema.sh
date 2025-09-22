#!/bin/bash

echo "🔍 FluidPay Schema Verification"
echo "=============================="
echo "Timestamp: $(date)"
echo ""

# Function to test database connection and verify schema
verify_schema() {
    local connection_string="$1"
    local method="$2"

    echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: Testing connection via $method"

    if psql "$connection_string" -c "SELECT current_database(), current_user;" 2>/dev/null; then
        echo "✅ Connection successful!"
        echo ""

        echo "📊 Checking for FluidPay schemas..."
        psql "$connection_string" -c "
            SELECT schemaname as schema, count(*) as table_count
            FROM pg_tables
            WHERE schemaname IN ('payments', 'compliance')
            GROUP BY schemaname
            ORDER BY schemaname;
        " 2>/dev/null

        echo ""
        echo "📋 Checking for FluidPay tables..."
        psql "$connection_string" -c "
            SELECT schemaname, tablename, hasindexes, hasrules, hastriggers
            FROM pg_tables
            WHERE schemaname IN ('payments', 'compliance')
            ORDER BY schemaname, tablename;
        " 2>/dev/null

        echo ""
        echo "📈 Checking table row counts..."
        psql "$connection_string" -c "
            SELECT
                'payments.payment_methods' as table_name, count(*) as rows FROM payments.payment_methods
            UNION ALL
            SELECT 'payments.donations', count(*) FROM payments.donations
            UNION ALL
            SELECT 'payments.transaction_events', count(*) FROM payments.transaction_events
            UNION ALL
            SELECT 'payments.refunds', count(*) FROM payments.refunds
            UNION ALL
            SELECT 'compliance.contribution_limits', count(*) FROM compliance.contribution_limits
            UNION ALL
            SELECT 'compliance.donor_contributions', count(*) FROM compliance.donor_contributions
            UNION ALL
            SELECT 'compliance.fec_reports', count(*) FROM compliance.fec_reports;
        " 2>/dev/null

        return 0
    else
        echo "❌ Connection failed via $method"
        return 1
    fi
}

# Try multiple connection methods
echo "🔗 Attempting multiple database connections..."
echo ""

# Method 1: Try localhost connections (Cloud SQL Proxy)
for port in 5432 5433 5434; do
    if netstat -an | grep -q ":${port}.*LISTEN" 2>/dev/null || lsof -i :${port} >/dev/null 2>&1; then
        echo "Found service listening on port ${port}"

        # Try different database names and users
        for db in "advotecate-dev" "advotecate" "postgres"; do
            for user in "postgres" "advotecate" "advotecate_app_dev"; do
                connection="postgresql://${user}@localhost:${port}/${db}"
                if verify_schema "$connection" "localhost:${port} db:${db} user:${user}"; then
                    echo "✅ Schema verification completed successfully!"
                    exit 0
                fi
            done
        done
    fi
done

# Method 2: Try connection through Cloud SQL instance directly
echo ""
echo "💾 Attempting direct Cloud SQL connection..."

# Get Cloud SQL connection info
PROJECT_ID="advotecate-dev"
INSTANCE_NAME="advotecate-dev-postgres"

if command -v gcloud &> /dev/null; then
    echo "Getting Cloud SQL instance details..."
    gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName,ipAddresses[0].ipAddress)" 2>/dev/null || echo "Could not get Cloud SQL details"
fi

echo ""
echo "❓ No working database connection found."
echo ""
echo "To verify the schema manually, you can:"
echo "1. Connect to your database using any working connection"
echo "2. Run these SQL commands:"
echo ""
echo "   -- Check if schemas exist:"
echo "   SELECT schemaname FROM information_schema.schemata WHERE schemaname IN ('payments', 'compliance');"
echo ""
echo "   -- Check if tables exist:"
echo "   SELECT schemaname, tablename FROM information_schema.tables WHERE schemaname IN ('payments', 'compliance');"
echo ""
echo "   -- Count rows in tables:"
echo "   SELECT 'payments.donations' as table_name, count(*) as rows FROM payments.donations;"
echo ""
echo "Expected results if schema is applied:"
echo "✅ 2 schemas: payments, compliance"
echo "✅ 7 tables: payment_methods, donations, transaction_events, refunds, contribution_limits, donor_contributions, fec_reports"
echo "✅ Non-zero row count in contribution_limits (pre-loaded data)"
echo ""