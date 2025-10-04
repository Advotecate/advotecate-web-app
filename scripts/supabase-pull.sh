#!/bin/bash

# Pull production database schema from Supabase to local
# This syncs the schema structure (tables, columns, relationships, policies)

echo "📥 Pulling production schema from Supabase..."
echo ""
echo "Project: wbyxrtpzusysxdwtmzfa"
echo "URL: https://wbyxrtpzusysxdwtmzfa.supabase.co"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "📦 Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Link to production project if not already linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Linking to production Supabase project..."
    supabase link --project-ref wbyxrtpzusysxdwtmzfa
fi

# Pull the schema
supabase db pull

echo ""
echo "✅ Schema synced from production to local"
echo "📝 Schema file: supabase/migrations/[timestamp]_remote_commit.sql"
echo ""
echo "💡 To apply locally: supabase db reset"
