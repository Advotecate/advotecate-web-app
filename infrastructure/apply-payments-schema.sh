#!/bin/bash
set -e

echo "💳 Applying Payments Schema to Supabase"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "sql/01_payments_schema.sql" ]; then
    echo "❌ Error: sql/01_payments_schema.sql not found"
    echo "Please run this script from the infrastructure directory"
    exit 1
fi

# Check if environment variables are set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL environment variable not set"
    echo ""
    echo "Please set your Supabase database URL:"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres'"
    echo ""
    echo "You can find this in your Supabase project Settings > Database > Connection string"
    exit 1
fi

echo "✅ Environment variables found"
echo "🗄️ Database URL: ${SUPABASE_DB_URL%@*}@***" # Hide credentials in output

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo "Please install PostgreSQL client tools"
    echo ""
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql-client"
    exit 1
fi

echo "🔧 Applying payments schema..."

# Apply the schema
if psql "$SUPABASE_DB_URL" -f sql/01_payments_schema.sql; then
    echo ""
    echo "✅ Payments schema applied successfully!"
    echo ""
    echo "📊 Created tables:"
    echo "  • payments.payment_methods"
    echo "  • payments.donations"
    echo "  • payments.transaction_events"
    echo "  • payments.refunds"
    echo "  • compliance.contribution_limits"
    echo "  • compliance.donor_contributions"
    echo "  • compliance.fec_reports"
    echo ""
    echo "🔍 Verifying tables..."

    # Verify tables were created
    psql "$SUPABASE_DB_URL" -c "
        SELECT schemaname, tablename, hasindexes, hasrules, hastriggers
        FROM pg_tables
        WHERE schemaname IN ('payments', 'compliance')
        ORDER BY schemaname, tablename;
    "

    echo ""
    echo "🎉 Database setup complete!"
    echo "Your Supabase database is ready for payments processing."

else
    echo ""
    echo "❌ Error applying schema"
    echo "Please check the error messages above and try again"
    exit 1
fi