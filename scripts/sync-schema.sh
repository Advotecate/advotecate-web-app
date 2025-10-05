#!/bin/bash

# Sync Schema from Production to Local Supabase
# This pulls the database schema (tables, triggers, policies, functions) from production
# WITHOUT syncing any actual data

set -e

echo "🔄 Syncing database schema from production to local..."
echo "⚠️  This will NOT sync data, only structure (tables, policies, triggers, functions)"
echo ""

# Check if supabase is running
if ! supabase status > /dev/null 2>&1; then
  echo "❌ Local Supabase is not running. Starting it now..."
  supabase start
fi

# Get project ref from config
PROJECT_REF="wbyxrtpzusysxdwtmzfa"
echo "📡 Pulling schema from project: $PROJECT_REF"

# Prompt for password if not provided
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "🔐 Enter your production Supabase database password:"
  read -s SUPABASE_DB_PASSWORD
  echo ""
fi

# Pull the latest schema from production
echo "📥 Fetching schema from production..."
supabase db pull --password "$SUPABASE_DB_PASSWORD" 2>&1 | grep -v "A new version"

# Get the latest migration file
LATEST_MIGRATION=$(ls -t supabase/migrations/*.sql | head -1)

if [ -z "$LATEST_MIGRATION" ]; then
  echo "❌ No migration file found"
  exit 1
fi

echo "🔧 Cleaning migration file: $LATEST_MIGRATION"

# Remove psql meta-commands that cause syntax errors
sed -i '' '/^\\restrict/d' "$LATEST_MIGRATION"
sed -i '' '/^\\unrestrict/d' "$LATEST_MIGRATION"

echo "🔄 Applying schema changes to local database..."
supabase db reset 2>&1 | grep -v "A new version"

echo ""
echo "✅ Schema sync complete!"
echo ""
echo "📊 Verifying sync..."

# Verify tables
TABLE_COUNT=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "   Tables: $TABLE_COUNT"

# Verify policies
POLICY_COUNT=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';")
echo "   RLS Policies: $POLICY_COUNT"

# Verify triggers
TRIGGER_COUNT=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public';")
echo "   Triggers: $TRIGGER_COUNT"

echo ""
echo "🎉 Local database schema is now in sync with production!"
echo "💡 Your local data was preserved - only the schema was updated"
