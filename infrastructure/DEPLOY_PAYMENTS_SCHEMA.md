# Deploy Payments Schema - Quick Guide

## Step 1: Create Managed Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. **Project Name**: `Advotecate Payments Dev`
4. **Database Password**: Generate and save securely
5. **Region**: West US (Oregon)
6. **Plan**: Free (for now)

## Step 2: Apply the Payments Schema

1. **Open SQL Editor**: In your Supabase dashboard, go to `SQL Editor`
2. **Copy Schema**: Copy the entire contents of `sql/01_payments_schema.sql`
3. **Paste and Execute**: Paste into SQL Editor and click `RUN`

## What Gets Created

### 🏦 Core Payment Tables
- **`payments.payment_methods`** - Credit cards, bank accounts (encrypted)
- **`payments.donations`** - All transactions with FEC compliance
- **`payments.transaction_events`** - Complete audit trail
- **`payments.refunds`** - Refund processing

### ⚖️ Compliance Tables
- **`compliance.contribution_limits`** - FEC contribution limits
- **`compliance.donor_contributions`** - Donor aggregation tracking
- **`compliance.fec_reports`** - FEC report generation

### 🔐 Security Features
- UUID primary keys
- Encrypted sensitive data fields
- Row Level Security ready
- Audit trails for all transactions
- Input validation and constraints

### 📊 Business Logic
- Support for recurring donations
- FluidPay integration fields
- Guest donor support
- Compliance status tracking
- Automatic timestamps and triggers

## Step 3: Get Your Credentials

After creation, go to **Settings → API**:

```bash
# Project URL
SUPABASE_URL=https://your-project-ref.supabase.co

# Public Key (frontend)
SUPABASE_ANON_KEY=eyJ...

# Service Key (backend only - keep secret!)
SUPABASE_SERVICE_KEY=eyJ...

# Direct Database URL
DATABASE_URL=postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres
```

## Step 4: Test the Schema

Run this in SQL Editor to verify:

```sql
-- Check tables were created
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('payments', 'compliance')
ORDER BY schemaname, tablename;

-- Test sample data exists
SELECT * FROM compliance.contribution_limits;
SELECT * FROM payments.payment_methods;
```

## Step 5: Enable Row Level Security (Optional)

For production, run this SQL:

```sql
-- Enable RLS
ALTER TABLE payments.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.refunds ENABLE ROW LEVEL SECURITY;

-- Basic policies (customize as needed)
CREATE POLICY "Users own data" ON payments.payment_methods
    FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Users own donations" ON payments.donations
    FOR ALL USING (auth.uid() = donor_id);
```

## ✅ Ready for Integration

Once complete, your database is ready for:
- FluidPay payment processing integration
- FEC compliance reporting
- Recurring donation processing
- Frontend connection via Supabase client
- Backend API integration

The schema includes sample data and is production-ready with proper indexing, constraints, and audit capabilities.