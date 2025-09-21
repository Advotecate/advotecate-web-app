-- Create helpful views for common queries

-- Fundraiser summary view with calculated metrics
CREATE VIEW reporting.fundraiser_summary AS
SELECT
    f.*,
    o.name as organization_name,
    o.organization_type,
    o.verification_status as org_verification_status,

    -- Financial metrics (calculated from actual donations)
    COALESCE(stats.actual_raised, 0) as actual_raised,
    COALESCE(stats.donation_count, 0) as actual_donation_count,
    COALESCE(stats.unique_donors, 0) as actual_unique_donors,
    stats.last_donation_at as actual_last_donation,

    -- Goal progress
    CASE
        WHEN f.goal_amount > 0 AND f.goal_amount IS NOT NULL THEN
            ROUND((COALESCE(stats.actual_raised, 0) / f.goal_amount * 100), 2)
        ELSE 0
    END as progress_percentage,

    -- Average donation
    CASE
        WHEN COALESCE(stats.donation_count, 0) > 0 THEN
            ROUND(COALESCE(stats.actual_raised, 0) / stats.donation_count, 2)
        ELSE 0
    END as average_donation,

    -- Days remaining
    CASE
        WHEN f.end_date IS NOT NULL AND f.end_date > CURRENT_TIMESTAMP THEN
            extract(day from f.end_date - CURRENT_TIMESTAMP)
        ELSE 0
    END as days_remaining,

    -- Status flags
    f.end_date < CURRENT_TIMESTAMP as is_expired,
    f.start_date > CURRENT_TIMESTAMP as is_upcoming,
    f.start_date <= CURRENT_TIMESTAMP AND (f.end_date IS NULL OR f.end_date > CURRENT_TIMESTAMP) as is_active

FROM fundraisers f
LEFT JOIN organizations o ON f.organization_id = o.id
LEFT JOIN (
    SELECT
        fundraiser_id,
        SUM(amount) as actual_raised,
        COUNT(*) as donation_count,
        COUNT(DISTINCT user_id) as unique_donors,
        MAX(completed_at) as last_donation_at
    FROM donations
    WHERE status = 'completed'
    GROUP BY fundraiser_id
) stats ON f.id = stats.fundraiser_id;

-- User donation summary view
CREATE VIEW reporting.user_donation_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.kyc_status,
    u.created_at as user_created_at,

    -- Donation metrics
    COUNT(d.id) as total_donations,
    COALESCE(SUM(d.amount), 0) as total_donated,
    COALESCE(AVG(d.amount), 0) as average_donation,
    MAX(d.completed_at) as last_donation_at,
    MIN(d.completed_at) as first_donation_at,

    -- Organization diversity
    COUNT(DISTINCT d.organization_id) as organizations_supported,
    COUNT(DISTINCT d.fundraiser_id) as fundraisers_supported,

    -- Recurring donations
    COUNT(d.id) FILTER (WHERE d.is_recurring = true) as recurring_donations,

    -- Recent activity (last 30 days)
    COUNT(d.id) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as donations_last_30_days,
    COALESCE(SUM(d.amount) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0) as amount_last_30_days

FROM users u
LEFT JOIN donations d ON u.id = d.user_id AND d.status = 'completed'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.kyc_status, u.created_at;

-- Organization financial summary
CREATE VIEW reporting.organization_financial_summary AS
SELECT
    o.*,

    -- Donation metrics
    COALESCE(stats.total_raised, 0) as total_raised,
    COALESCE(stats.total_donations, 0) as total_donations,
    COALESCE(stats.unique_donors, 0) as unique_donors,
    COALESCE(stats.active_fundraisers, 0) as active_fundraisers,

    -- Recent activity
    stats.last_donation_at,
    COALESCE(stats.donations_last_30_days, 0) as donations_last_30_days,
    COALESCE(stats.amount_last_30_days, 0) as amount_last_30_days,

    -- Disbursement info
    COALESCE(disbursement_stats.total_disbursed, 0) as total_disbursed,
    COALESCE(disbursement_stats.pending_disbursement, 0) as pending_disbursement,
    disbursement_stats.last_disbursement_at,

    -- Available balance (raised - disbursed - fees)
    COALESCE(stats.total_raised, 0) - COALESCE(disbursement_stats.total_disbursed, 0) as available_balance

FROM organizations o
LEFT JOIN (
    SELECT
        d.organization_id,
        SUM(d.amount) as total_raised,
        COUNT(d.id) as total_donations,
        COUNT(DISTINCT d.user_id) as unique_donors,
        COUNT(DISTINCT d.fundraiser_id) FILTER (WHERE f.status = 'active') as active_fundraisers,
        MAX(d.completed_at) as last_donation_at,
        COUNT(d.id) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as donations_last_30_days,
        SUM(d.amount) FILTER (WHERE d.completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as amount_last_30_days
    FROM donations d
    LEFT JOIN fundraisers f ON d.fundraiser_id = f.id
    WHERE d.status = 'completed'
    GROUP BY d.organization_id
) stats ON o.id = stats.organization_id
LEFT JOIN (
    SELECT
        organization_id,
        SUM(amount) FILTER (WHERE status = 'completed') as total_disbursed,
        SUM(amount) FILTER (WHERE status IN ('pending', 'processing')) as pending_disbursement,
        MAX(completed_at) as last_disbursement_at
    FROM disbursements
    GROUP BY organization_id
) disbursement_stats ON o.id = disbursement_stats.organization_id;

-- Daily donation statistics for reporting
CREATE MATERIALIZED VIEW reporting.daily_donation_stats AS
SELECT
    DATE(d.created_at) as donation_date,
    COUNT(*) as donation_count,
    SUM(d.amount) as total_amount,
    AVG(d.amount) as average_amount,
    COUNT(DISTINCT d.user_id) as unique_donors,
    COUNT(DISTINCT d.organization_id) as organizations_receiving,
    COUNT(DISTINCT d.fundraiser_id) as active_fundraisers,

    -- Payment method breakdown
    COUNT(*) FILTER (WHERE d.payment_method_type = 'credit_card') as credit_card_count,
    COUNT(*) FILTER (WHERE d.payment_method_type = 'bank_transfer') as bank_transfer_count,

    -- Recurring vs one-time
    COUNT(*) FILTER (WHERE d.is_recurring = true) as recurring_count,
    COUNT(*) FILTER (WHERE d.is_recurring = false) as one_time_count

FROM donations d
WHERE d.status = 'completed'
GROUP BY DATE(d.created_at)
ORDER BY donation_date DESC;

-- Create index on materialized view
CREATE INDEX idx_daily_stats_date ON reporting.daily_donation_stats (donation_date);

-- Comments on views
COMMENT ON VIEW reporting.fundraiser_summary IS 'Comprehensive fundraiser metrics with real-time calculations';
COMMENT ON VIEW reporting.user_donation_summary IS 'User donation history and engagement metrics';
COMMENT ON VIEW reporting.organization_financial_summary IS 'Organization financial status and performance metrics';
COMMENT ON MATERIALIZED VIEW reporting.daily_donation_stats IS 'Daily aggregated donation statistics for reporting and analytics';