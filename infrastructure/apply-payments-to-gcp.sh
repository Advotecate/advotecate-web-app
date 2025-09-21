#!/bin/bash
set -e

echo "💳 Applying Payments Schema to GCP PostgreSQL"
echo "============================================="

PROJECT_ID="advotecate-dev"
DB_INSTANCE_NAME="advotecate-dev-postgres"
DB_NAME="advotecate_payments_dev"
DB_USER="advotecate_app_dev"

# Check if we're in the right directory
if [ ! -f "gcp-supabase/sql/01_payments_schema.sql" ]; then
    echo "❌ Error: gcp-supabase/sql/01_payments_schema.sql not found"
    echo "Please run this script from the infrastructure directory"
    exit 1
fi

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

echo "🔍 Step 1: Getting database password..."
DB_PASSWORD=$(gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID)
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Could not retrieve database password from Secret Manager"
    exit 1
fi
echo "✅ Password retrieved from Secret Manager"

echo "🌐 Step 2: Getting database connection info..."
DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName)")
DB_IP=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")

echo "  Connection Name: $DB_CONNECTION_NAME"
echo "  Private IP: $DB_IP"
echo ""

# Check if Cloud SQL Proxy is available
if ! command -v cloud_sql_proxy &> /dev/null; then
    echo "⚠️  Cloud SQL Proxy not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install cloud-sql-proxy
    else
        echo "❌ Please install Cloud SQL Proxy manually:"
        echo "https://cloud.google.com/sql/docs/postgres/sql-proxy"
        exit 1
    fi
fi

echo "🔧 Step 3: Starting Cloud SQL Proxy..."
cloud_sql_proxy --instances=$DB_CONNECTION_NAME=tcp:5432 &
PROXY_PID=$!

# Wait for proxy to start
sleep 5

echo "📊 Step 4: Applying payments schema..."

# Create connection string for local proxy
CONNECTION_STRING="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# Apply the schema using psql
if command -v psql &> /dev/null; then
    if psql "$CONNECTION_STRING" -f gcp-supabase/sql/01_payments_schema.sql; then
        echo ""
        echo "✅ Payments schema applied successfully!"
        echo ""
        echo "📊 Verifying tables were created..."
        psql "$CONNECTION_STRING" -c "
            SELECT schemaname, tablename, hasindexes, hasrules, hastriggers
            FROM pg_tables
            WHERE schemaname IN ('payments', 'compliance')
            ORDER BY schemaname, tablename;
        "
    else
        echo "❌ Error applying schema"
        kill $PROXY_PID
        exit 1
    fi
else
    echo "❌ psql not found. Please install PostgreSQL client:"
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql-client"
    kill $PROXY_PID
    exit 1
fi

echo "🧹 Step 5: Cleaning up..."
kill $PROXY_PID

echo ""
echo "🎉 Setup complete!"
echo "=================="
echo "Your PostgreSQL database on GCP is ready with the payments schema."
echo ""
echo "Tables created:"
echo "  • payments.payment_methods"
echo "  • payments.donations"
echo "  • payments.transaction_events"
echo "  • payments.refunds"
echo "  • compliance.contribution_limits"
echo "  • compliance.donor_contributions"
echo "  • compliance.fec_reports"
echo ""
echo "🔗 Connection details:"
echo "  Host: $DB_IP (private IP)"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Connection Name: $DB_CONNECTION_NAME"
echo ""
echo "🚀 Your PostgreSQL database on GCP is ready for payments processing!"