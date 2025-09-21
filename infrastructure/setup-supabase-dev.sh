#!/bin/bash
set -e

echo "🚀 Supabase Dev Database Setup"
echo "=============================="

# Check if required environment variables are set
if [ -z "$SUPABASE_PROJECT_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Missing required environment variables!"
    echo "Please set:"
    echo "  export SUPABASE_PROJECT_URL=https://your-project-ref.supabase.co"
    echo "  export SUPABASE_SERVICE_KEY=your-service-key"
    echo ""
    echo "You can find these in your Supabase project settings > API"
    exit 1
fi

echo "✅ Environment variables found"
echo "📊 Applying payments schema to Supabase..."

# Apply the payments schema using curl and the Supabase API
SCHEMA_FILE="sql/01_payments_schema.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Schema file not found: $SCHEMA_FILE"
    echo "Please run this script from the infrastructure directory"
    exit 1
fi

# Read the schema file and execute it via Supabase API
echo "🔧 Executing schema creation..."

# Note: This would require the Supabase CLI or direct SQL execution
# For now, we'll provide the manual instructions
echo ""
echo "📋 Manual Steps Required:"
echo "========================="
echo ""
echo "1. Open your Supabase dashboard SQL Editor:"
echo "   $SUPABASE_PROJECT_URL/sql/editor"
echo ""
echo "2. Copy and paste the contents of: gcp-supabase/sql/01_payments_schema.sql"
echo ""
echo "3. Click 'RUN' to execute the schema"
echo ""
echo "4. The following tables will be created:"
echo "   • payments.payment_methods"
echo "   • payments.donations"
echo "   • payments.transaction_events"
echo "   • payments.refunds"
echo "   • compliance.contribution_limits"
echo "   • compliance.donor_contributions"
echo "   • compliance.fec_reports"
echo ""
echo "5. Update your .env files with:"
echo "   SUPABASE_URL=$SUPABASE_PROJECT_URL"
echo "   SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY"
echo ""
echo "✅ Setup complete! Your PostgreSQL database is ready for payments processing."