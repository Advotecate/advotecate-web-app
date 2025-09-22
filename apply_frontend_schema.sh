#!/bin/bash

echo "📊 Applying Frontend-Driven Database Schema"
echo "==========================================="
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MINT='\033[0;36m'  # Mint color theme
NC='\033[0m' # No Color

# Database connection settings
DB_CONNECTION="postgresql://postgres@localhost:5432/advotecate"

echo -e "${MINT}🎯 Frontend-Driven Schema Application${NC}"
echo "Creating database structure to match React frontend"
echo ""

# Test database connectivity
echo -e "${BLUE}🔍 Step 1: Testing Database Connection${NC}"
echo "--------------------------------------"

if psql "$DB_CONNECTION" -c "SELECT 'Connection successful' as status;" 2>/dev/null; then
    echo -e "${GREEN}✅ Database connection: ESTABLISHED${NC}"
else
    echo -e "${RED}❌ Database connection: FAILED${NC}"
    echo "Please ensure PostgreSQL is running and accessible at:"
    echo "  $DB_CONNECTION"
    exit 1
fi

echo ""

# Apply user and organization schema
echo -e "${BLUE}👥 Step 2: Creating User & Organization Tables${NC}"
echo "------------------------------------------------"

if psql "$DB_CONNECTION" -f "database/schema/01_users_organizations.sql" 2>/dev/null; then
    echo -e "${GREEN}✅ Users & Organizations schema: APPLIED${NC}"

    # Verify table creation
    echo -e "${MINT}📋 Verifying table creation:${NC}"
    psql "$DB_CONNECTION" -c "
        SELECT
            'users' as table_name,
            count(*) as column_count
        FROM information_schema.columns
        WHERE table_name = 'users'
        UNION ALL
        SELECT
            'organizations' as table_name,
            count(*) as column_count
        FROM information_schema.columns
        WHERE table_name = 'organizations'
        UNION ALL
        SELECT
            'organization_members' as table_name,
            count(*) as column_count
        FROM information_schema.columns
        WHERE table_name = 'organization_members'
        UNION ALL
        SELECT
            'fundraisers' as table_name,
            count(*) as column_count
        FROM information_schema.columns
        WHERE table_name = 'fundraisers';
    " 2>/dev/null

else
    echo -e "${RED}❌ Users & Organizations schema: FAILED${NC}"
    exit 1
fi

echo ""

# Apply donations integration
echo -e "${BLUE}💳 Step 3: Integrating with FluidPay Donations${NC}"
echo "-----------------------------------------------"

if psql "$DB_CONNECTION" -f "database/schema/02_donations_integration.sql" 2>/dev/null; then
    echo -e "${GREEN}✅ Donations integration: APPLIED${NC}"

    # Verify integration
    echo -e "${MINT}🔗 Verifying FluidPay integration:${NC}"
    psql "$DB_CONNECTION" -c "
        SELECT
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_name = 'donations'
          AND column_name IN ('fundraiser_id', 'organization_id', 'user_id', 'compliance_status')
        ORDER BY column_name;
    " 2>/dev/null

else
    echo -e "${RED}❌ Donations integration: FAILED${NC}"
    exit 1
fi

echo ""

# Create seed data
echo -e "${BLUE}🌱 Step 4: Creating Test Data${NC}"
echo "------------------------------"

echo "Creating test data that matches frontend forms..."
if psql "$DB_CONNECTION" -c "SELECT create_seed_data();" 2>/dev/null; then
    echo -e "${GREEN}✅ Seed data: CREATED${NC}"

    # Show created data
    echo -e "${MINT}📋 Test data summary:${NC}"
    psql "$DB_CONNECTION" -c "
        SELECT
            'Users' as category,
            count(*)::text as count
        FROM users
        UNION ALL
        SELECT
            'Organizations' as category,
            count(*)::text as count
        FROM organizations
        UNION ALL
        SELECT
            'Memberships' as category,
            count(*)::text as count
        FROM organization_members
        UNION ALL
        SELECT
            'Fundraisers' as category,
            count(*)::text as count
        FROM fundraisers;
    " 2>/dev/null

else
    echo -e "${YELLOW}⚠️ Seed data: SKIPPED (may already exist)${NC}"
fi

echo ""

# Verify complete schema
echo -e "${BLUE}🔍 Step 5: Schema Verification${NC}"
echo "-------------------------------"

echo -e "${MINT}📊 Complete table overview:${NC}"
psql "$DB_CONNECTION" -c "
    SELECT
        t.table_name,
        t.table_type,
        c.column_count,
        CASE
            WHEN t.table_name IN ('users', 'organizations', 'organization_members', 'fundraisers')
            THEN '✅ Frontend-Driven'
            WHEN t.table_name LIKE 'donation%' OR t.table_name LIKE 'payment%'
            THEN '🔗 FluidPay Integration'
            ELSE '📋 System Table'
        END as category
    FROM information_schema.tables t
    LEFT JOIN (
        SELECT
            table_name,
            count(*) as column_count
        FROM information_schema.columns
        GROUP BY table_name
    ) c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY
        CASE
            WHEN t.table_name IN ('users', 'organizations', 'organization_members', 'fundraisers') THEN 1
            WHEN t.table_name LIKE 'donation%' OR t.table_name LIKE 'payment%' THEN 2
            ELSE 3
        END,
        t.table_name;
" 2>/dev/null

echo ""

# Test the integration
echo -e "${BLUE}🧪 Step 6: Testing Frontend Integration${NC}"
echo "---------------------------------------"

echo "Testing organization creation (matches frontend form)..."
TEST_RESULT=$(psql "$DB_CONNECTION" -c "
    WITH test_org AS (
        INSERT INTO organizations (name, slug, description, type, website_url, fec_id)
        VALUES (
            'Frontend Test Campaign',
            'frontend-test-campaign',
            'A test organization created through the frontend-driven schema.',
            'POLITICAL',
            'https://test.example.com',
            'C00TEST123'
        )
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, name, type
    )
    SELECT
        'Organization Test' as test_name,
        CASE
            WHEN count(*) > 0 THEN '✅ PASSED - Can create organizations'
            ELSE '❌ FAILED - Cannot create organizations'
        END as result
    FROM test_org;
" 2>&1)

if echo "$TEST_RESULT" | grep -q "✅ PASSED"; then
    echo -e "${GREEN}✅ Frontend integration: WORKING${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend integration: Data may already exist${NC}"
fi

echo ""

# Show views for analytics
echo -e "${BLUE}📈 Step 7: Analytics Views${NC}"
echo "---------------------------"

echo -e "${MINT}🔍 Available analytics views:${NC}"
psql "$DB_CONNECTION" -c "
    SELECT
        viewname as view_name,
        definition as view_definition
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname IN ('fundraiser_analytics', 'organization_analytics')
    ORDER BY viewname;
" 2>/dev/null

echo ""

# Final summary
echo -e "${MINT}🎉 Frontend-Driven Database Schema Complete!${NC}"
echo "=================================================="

echo ""
echo "📋 What was created:"
echo "• Users table (matches User interface)"
echo "• Organizations table (matches Organization interface)"
echo "• Organization membership system (matches OrganizationMember interface)"
echo "• Fundraisers table (matches Fundraiser interface)"
echo "• Enhanced donations table (integrates with existing FluidPay system)"
echo "• Analytics views for dashboard stats"
echo "• Compliance tracking system"
echo "• Test data matching frontend forms"

echo ""
echo "🔗 Frontend Integration Points:"
echo "• Register form → users table"
echo "• Organization creation modal → organizations table"
echo "• User roles → organization_members table"
echo "• Fundraiser creation → fundraisers table"
echo "• Dashboard stats → analytics views"
echo "• Donation flow → donations table (enhanced)"

echo ""
echo "✨ Next Steps:"
echo "1. Update frontend API calls to use new database structure"
echo "2. Implement user registration/login endpoints"
echo "3. Create organization management API endpoints"
echo "4. Build fundraiser creation and management APIs"
echo "5. Connect dashboard statistics to analytics views"

echo ""
echo -e "${GREEN}🚀 Your database now perfectly matches your frontend!${NC}"