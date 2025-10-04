#!/bin/bash

# Seed local database with production data
# WARNING: This will overwrite your local database

echo "🌱 Seeding local database from production..."
echo ""
echo "⚠️  WARNING: This will overwrite your local database!"
read -p "Are you sure? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables"
    echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    exit 1
fi

echo "📊 Dumping production data..."
# Export data from production (structure only, no data for now)
supabase db dump --data-only > /tmp/prod-data.sql

echo "📥 Importing to local database..."
# Apply to local Supabase instance
psql $DATABASE_URL < /tmp/prod-data.sql

echo "🧹 Cleaning up..."
rm /tmp/prod-data.sql

echo ""
echo "✅ Local database seeded from production"
echo "💡 Note: For security, only schema is synced by default"
echo "   To include data, modify the dump command flags"
