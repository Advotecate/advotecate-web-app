#!/bin/bash

# Show Supabase project status and compare local vs production schema

echo "📊 Supabase Status"
echo "==============================================="
echo ""

echo "🌐 Production:"
echo "   Project:  wbyxrtpzusysxdwtmzfa"
echo "   URL:      https://wbyxrtpzusysxdwtmzfa.supabase.co"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "📦 Install with: brew install supabase/tap/supabase"
    exit 1
fi

# Show local Supabase status
echo "💻 Local:"
supabase status 2>/dev/null || echo "   Not running (start with: supabase start)"
echo ""

# Show schema differences
echo "📋 Schema Differences (Local vs Production):"
echo "-----------------------------------------------"
supabase db diff

echo ""
echo "==============================================="
echo "Commands:"
echo "  npm run supabase:pull   - Pull production schema"
echo "  npm run supabase:seed   - Seed local from production"
echo "  supabase db reset       - Reset local to match migrations"
echo "  supabase start          - Start local Supabase"
echo "  supabase stop           - Stop local Supabase"
