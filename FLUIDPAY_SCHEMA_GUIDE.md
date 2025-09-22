# FluidPay Payments Database Schema Guide

## Overview

This comprehensive database schema provides a production-ready foundation for payment processing using FluidPay's gateway, with built-in FEC compliance features for political donations. The schema follows industry best practices for security, performance, and regulatory compliance.

## Key Features

### 🔒 Security
- **No Raw Payment Data**: All payment details are tokenized through FluidPay
- **Row Level Security (RLS)**: Granular access control
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Audit Trails**: Complete transaction history

### ⚡ Performance
- **Optimized Indexes**: 16 strategic indexes for fast queries
- **Efficient Aggregation**: Pre-calculated donor totals
- **Partition-Ready**: Designed for large-scale data

### 📊 FEC Compliance
- **Contribution Limits**: Automated limit tracking
- **Itemization Rules**: $200 threshold automation
- **Report Generation**: Built-in FEC reporting support
- **Audit Requirements**: Complete donation trails

## Schema Structure

### Core Payment Tables

#### `payment_methods`
Stores tokenized payment method information securely.

**Key Fields:**
- `fluidpay_token`: Secure payment method token from FluidPay
- `payment_type`: credit_card, ach, bank_transfer
- `last_four`: Masked payment details for identification
- `is_default`: User's preferred payment method

**Security Features:**
- Never stores raw card data (PCI DSS compliant)
- Enforces single default per user
- Automatic token validation

#### `donations`
Core donation transaction records with FEC compliance.

**Key Fields:**
- `donor_*`: Complete donor information for FEC reporting
- `amount`: Donation amount with validation rules
- `fluidpay_transaction_id`: Gateway transaction reference
- `election_cycle`: Format "2023-2024" for FEC reporting
- `is_anonymous`: Limited to $200 per FEC rules

**Validation Rules:**
- Amount between $0.01 and $99,999.99
- Anonymous donations ≤ $200
- Required donor information for itemized donations

#### `transaction_events`
Detailed event log for all payment processing activities.

**Event Types:**
- `created`: Initial transaction creation
- `authorized`: Payment authorized by bank
- `captured`: Funds captured successfully
- `settled`: Transaction settled
- `failed`: Transaction failed
- `refunded`: Full or partial refund processed

### Compliance Tables

#### `contribution_limits`
FEC contribution limits by election cycle and recipient type.

**Pre-loaded Data:**
- 2023-2024 cycle limits
- 2025-2026 cycle limits
- Individual, PAC, and party committee limits

#### `donor_contributions`
Aggregated donor totals for FEC reporting efficiency.

**Auto-calculated Fields:**
- `total_amount`: Cumulative donations per donor/recipient
- `requires_itemization`: True when total exceeds $200
- `contribution_count`: Number of individual donations

#### `fec_reports`
FEC filing requirements and report generation tracking.

**Report Types:**
- Quarterly reports
- Pre-election reports
- Year-end reports
- Monthly reports (for large committees)

## Installation Instructions

### Method 1: Through Hasura Console (Recommended)

1. Navigate to your Hasura console: `http://100.107.103.5:3000/console`
2. Go to **Data** > **SQL**
3. Copy the entire contents of `fluidpay_payments_schema.sql`
4. Paste into the SQL editor
5. Click **Run!**

### Method 2: Using the Application Script

```bash
./apply_schema.sh
```

The script will attempt multiple application methods automatically.

### Method 3: Direct PostgreSQL Connection

```bash
psql -h 100.107.103.5 -p 5432 -U your_user -d your_database -f fluidpay_payments_schema.sql
```

## Usage Examples

### Creating a Donation Record

```sql
-- First, create a payment method (tokenized through FluidPay)
INSERT INTO payment_methods (
    user_id, fluidpay_token, payment_type, last_four, brand
) VALUES (
    'user-uuid-here',
    'fluidpay-token-from-api',
    'credit_card',
    '1234',
    'Visa'
);

-- Then create the donation
INSERT INTO donations (
    donor_id, donor_email, donor_first_name, donor_last_name,
    donor_address, recipient_id, recipient_type, amount,
    payment_method_id, election_cycle, contribution_date
) VALUES (
    'donor-uuid-here',
    'donor@example.com',
    'John',
    'Smith',
    '{"street": "123 Main St", "city": "City", "state": "ST", "zip": "12345"}',
    'campaign-uuid-here',
    'candidate',
    100.00,
    'payment-method-uuid',
    '2023-2024',
    CURRENT_DATE
);
```

### Checking FEC Compliance

```sql
-- Find donors requiring itemization (>$200 total)
SELECT
    donor_email,
    total_amount,
    contribution_count
FROM donor_contributions
WHERE requires_itemization = true
  AND election_cycle = '2023-2024';

-- Check contribution limit violations
SELECT
    d.donor_email,
    dc.total_amount,
    cl.individual_per_election as limit
FROM donor_contributions dc
JOIN donations d ON d.donor_id = dc.donor_id
JOIN contribution_limits cl ON cl.election_cycle = dc.election_cycle
WHERE dc.total_amount > cl.individual_per_election;
```

### Transaction Event Tracking

```sql
-- Add transaction event
INSERT INTO transaction_events (
    donation_id, event_type, status, amount,
    fluidpay_event_id, gateway_response
) VALUES (
    'donation-uuid-here',
    'captured',
    'success',
    100.00,
    'fluidpay-event-id',
    '{"response": "success", "transaction_id": "12345"}'
);
```

## Performance Optimization

### Query Optimization
The schema includes 16 strategic indexes for optimal query performance:

```sql
-- Fast donor lookup
EXPLAIN ANALYZE SELECT * FROM donations WHERE donor_id = 'uuid';

-- Efficient date-range queries
EXPLAIN ANALYZE SELECT * FROM donations
WHERE contribution_date BETWEEN '2024-01-01' AND '2024-12-31';

-- FEC reporting queries
EXPLAIN ANALYZE SELECT * FROM fec_reportable_donations
WHERE election_cycle = '2023-2024';
```

### Aggregation Performance
Use pre-calculated aggregates instead of real-time calculations:

```sql
-- Fast donor total lookup (uses donor_contributions table)
SELECT total_amount FROM donor_contributions
WHERE donor_id = 'uuid' AND recipient_id = 'recipient-uuid';

-- Instead of slow real-time calculation
SELECT SUM(amount) FROM donations
WHERE donor_id = 'uuid' AND recipient_id = 'recipient-uuid';
```

## Security Considerations

### Payment Data Security
- **Never store raw payment data** - always use FluidPay tokens
- **Encrypt sensitive fields** - addresses and personal information
- **Use HTTPS only** - all API communications must be encrypted
- **Implement rate limiting** - prevent payment processing abuse

### Access Control
The schema includes Row Level Security (RLS) policies:

```sql
-- Users can only see their own payment methods
-- Admins can see all donations for reporting

-- Set current user context for RLS
SELECT set_config('app.current_user_id', 'user-uuid-here', true);
SELECT set_config('app.user_role', 'user', true);
```

### Audit Requirements
All tables include comprehensive audit trails:
- `created_at` / `updated_at` timestamps
- `created_by` / `updated_by` user tracking
- Full transaction event history
- Change tracking through triggers

## FEC Compliance Features

### Automatic Compliance Checking
The schema automatically handles FEC requirements:

1. **Contribution Limits**: Validates against current FEC limits
2. **Itemization Threshold**: Flags donors over $200 total
3. **Anonymous Limit**: Prevents anonymous donations over $200
4. **Required Fields**: Enforces complete donor information

### Report Generation
Use the built-in views for FEC reporting:

```sql
-- All reportable donations for a cycle
SELECT * FROM fec_reportable_donations
WHERE election_cycle = '2023-2024'
  AND recipient_id = 'campaign-uuid';

-- Itemized contributions report
SELECT
    donor_first_name, donor_last_name, donor_address,
    donor_employer, donor_occupation, amount, contribution_date
FROM fec_reportable_donations
WHERE requires_itemization = true;
```

## Maintenance Tasks

### Regular Maintenance
Execute these queries periodically:

```sql
-- Update table statistics for query optimization
ANALYZE payment_methods, donations, transaction_events, refunds;

-- Check for orphaned records
SELECT COUNT(*) FROM donations d
LEFT JOIN payment_methods pm ON d.payment_method_id = pm.id
WHERE pm.id IS NULL;

-- Validate aggregate consistency
SELECT
    COUNT(*) as mismatched_aggregates
FROM donor_contributions dc
JOIN (
    SELECT donor_id, recipient_id, election_cycle,
           SUM(amount) as actual_total
    FROM donations
    WHERE status = 'completed'
    GROUP BY donor_id, recipient_id, election_cycle
) actual ON dc.donor_id = actual.donor_id
         AND dc.recipient_id = actual.recipient_id
         AND dc.election_cycle = actual.election_cycle
WHERE ABS(dc.total_amount - actual.actual_total) > 0.01;
```

### Data Archival
For large-scale deployments, consider archiving old data:

```sql
-- Archive completed donations older than 7 years
-- (Adjust retention based on legal requirements)
CREATE TABLE donations_archive (LIKE donations);
INSERT INTO donations_archive
SELECT * FROM donations
WHERE contribution_date < CURRENT_DATE - INTERVAL '7 years'
  AND status = 'completed';
```

## Integration with FluidPay

### API Integration Points

1. **Payment Method Creation**
```javascript
// Frontend: Tokenize payment method with FluidPay
const token = await fluidpay.tokenizePaymentMethod(cardData);

// Backend: Store tokenized method
await db.payment_methods.insert({
    user_id: userId,
    fluidpay_token: token.id,
    payment_type: 'credit_card',
    last_four: token.card.last_four,
    brand: token.card.brand
});
```

2. **Process Donation**
```javascript
// Process payment through FluidPay
const transaction = await fluidpay.processPayment({
    token: paymentMethod.fluidpay_token,
    amount: donation.amount,
    order_id: donation.id
});

// Update donation with FluidPay response
await db.donations.update(donation.id, {
    fluidpay_transaction_id: transaction.id,
    status: transaction.status
});
```

3. **Handle Webhooks**
```javascript
// FluidPay webhook handler
app.post('/webhooks/fluidpay', async (req, res) => {
    const event = req.body;

    await db.transaction_events.insert({
        donation_id: event.order_id,
        event_type: event.type,
        fluidpay_event_id: event.id,
        gateway_response: event
    });

    // Update donation status based on event
    if (event.type === 'payment.succeeded') {
        await db.donations.update(event.order_id, {
            status: 'completed',
            processed_at: new Date()
        });
    }
});
```

## Troubleshooting

### Common Issues

1. **Schema Application Fails**
   - Check database user permissions
   - Verify PostgreSQL extensions are available
   - Review connection settings

2. **Performance Issues**
   - Run `ANALYZE` on tables after bulk data loads
   - Monitor index usage with `pg_stat_user_indexes`
   - Consider partitioning for very large datasets

3. **FEC Compliance Warnings**
   - Validate donor information completeness
   - Check contribution limit calculations
   - Verify election cycle formatting

### Monitoring Queries

```sql
-- Check schema health
SELECT
    schemaname, tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Monitor payment processing errors
SELECT
    event_type, status,
    COUNT(*) as count,
    MAX(event_timestamp) as last_occurrence
FROM transaction_events
WHERE event_timestamp > CURRENT_DATE - INTERVAL '24 hours'
  AND status = 'error'
GROUP BY event_type, status;

-- Check FEC compliance status
SELECT
    election_cycle,
    COUNT(*) as total_donations,
    COUNT(*) FILTER (WHERE requires_itemization) as itemized_count,
    SUM(total_amount) as total_raised
FROM donor_contributions
GROUP BY election_cycle;
```

## Support and Updates

### Getting Help
- Review the comprehensive schema comments
- Check application logs in `schema_application.log`
- Validate data integrity with provided monitoring queries

### Future Updates
The schema is designed to be extensible:
- Additional payment methods can be added
- New FEC requirements can be accommodated
- Performance optimizations can be implemented

### Version History
- v1.0: Initial FluidPay integration with FEC compliance
- Designed for production deployment
- Comprehensive security and performance features

---

For technical support or questions about this schema, please refer to the detailed comments within the SQL file or consult the FluidPay API documentation.