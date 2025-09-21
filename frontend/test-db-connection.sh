#!/bin/bash
# Test Database Connection Script
# Run this in Cloud Shell to test your database connection and create sample payments

echo "🔌 Testing PostgreSQL Database Connection..."

# Test basic connection
psql "postgresql://advotecate_app_dev:XPyL97uYXWuLMyaO2nu17MbLC@10.229.208.3:5432/advotecate_payments_dev" -c "SELECT 'Database connection successful!' as status, NOW() as timestamp;"

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"

    echo "📊 Checking database tables..."
    psql "postgresql://advotecate_app_dev:XPyL97uYXWuLMyaO2nu17MbLC@10.229.208.3:5432/advotecate_payments_dev" -c "
    SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes
    FROM pg_stat_user_tables
    WHERE schemaname IN ('payments', 'compliance')
    ORDER BY schemaname, tablename;
    "

    echo "💳 Creating test payment..."
    psql "postgresql://advotecate_app_dev:XPyL97uYXWuLMyaO2nu17MbLC@10.229.208.3:5432/advotecate_payments_dev" -c "
    INSERT INTO payments.donations (
        amount, currency, organization_id, guest_donor_info, status
    ) VALUES (
        25.00, 'USD', '550e8400-e29b-41d4-a716-446655440000',
        '{\"name\": \"Test Donor\", \"email\": \"test@example.com\"}', 'pending'
    ) RETURNING id, amount, currency, status, created_at;
    "

    echo "📋 Listing recent payments..."
    psql "postgresql://advotecate_app_dev:XPyL97uYXWuLMyaO2nu17MbLC@10.229.208.3:5432/advotecate_payments_dev" -c "
    SELECT id, amount, currency, status, created_at
    FROM payments.donations
    ORDER BY created_at DESC
    LIMIT 5;
    "

    echo "🎉 Database test completed successfully!"
else
    echo "❌ Database connection failed!"
fi