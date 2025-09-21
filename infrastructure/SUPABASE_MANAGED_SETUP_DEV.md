# Managed Supabase Setup for Advotecate Payments (Dev)

Due to GCP organizational policy restrictions preventing self-hosted Cloud SQL deployment, we'll use managed Supabase which provides both PostgreSQL database and frontend interface.

## Step 1: Create Supabase Project

1. **Go to**: https://supabase.com/dashboard
2. **Click**: "New Project"
3. **Settings**:
   - **Name**: `Advotecate Payments Dev`
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: `West US (Oregon)` (closest to us-central1)
   - **Pricing Plan**: `Free` for MVP, upgrade later

## Step 2: Get Your Project Credentials

Once created, go to **Settings** → **API** and copy these values:

```bash
# Project URL
PROJECT_URL=https://your-project-ref.supabase.co

# Public Anon Key (safe for frontend)
SUPABASE_ANON_KEY=eyJ...

# Service Role Key (server-side only - keep secret)
SUPABASE_SERVICE_KEY=eyJ...

# Database URL (for direct connections)
DATABASE_URL=postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres
```

## Step 3: Apply the Payments Schema

1. **Go to**: SQL Editor in your Supabase dashboard
2. **Copy and paste**: The entire contents of `sql/01_payments_schema.sql`
3. **Click**: "RUN" to create all the payment tables

The schema includes:
- `payments.payment_methods` - Credit cards, bank accounts, etc.
- `payments.donations` - Transaction records with compliance tracking
- `payments.transaction_events` - Audit trail
- `payments.refunds` - Refund processing
- `compliance.contribution_limits` - FEC limits
- `compliance.donor_contributions` - Donor tracking
- `compliance.fec_reports` - Reporting data

## Step 4: Enable Row Level Security (RLS)

Run this additional SQL to secure the tables:

```sql
-- Enable RLS on all payment tables
ALTER TABLE payments.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.contribution_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.donor_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.fec_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (we'll refine these later)
-- Allow authenticated users to read their own data
CREATE POLICY "Users can view own payment methods" ON payments.payment_methods
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own payment methods" ON payments.payment_methods
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view own donations" ON payments.donations
    FOR SELECT USING (auth.uid() = donor_id);

CREATE POLICY "Users can insert own donations" ON payments.donations
    FOR INSERT WITH CHECK (auth.uid() = donor_id);

-- Allow service role full access (for backend processing)
CREATE POLICY "Service role full access" ON payments.payment_methods
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access donations" ON payments.donations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

## Step 5: Update Environment Variables

**Backend (.env)**:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres
```

**Frontend (.env.local)**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Step 6: Test the Connection

You can test the database connection using the Supabase dashboard or by connecting directly with psql:

```bash
psql "postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres"
```

## Benefits of Managed Supabase

✅ **No infrastructure management** - Fully managed PostgreSQL
✅ **Built-in authentication** - User management included
✅ **Real-time subscriptions** - Live data updates
✅ **Auto-generated APIs** - REST and GraphQL endpoints
✅ **Built-in dashboard** - Data management interface
✅ **Automatic backups** - Point-in-time recovery
✅ **Global CDN** - Fast worldwide access
✅ **No organizational policy conflicts** - External service

## Next Steps

1. Create the managed Supabase project
2. Apply the payments schema
3. Configure RLS policies
4. Update environment variables in your frontend and backend
5. Test database connectivity
6. Later: Add users and organizations schema

This approach gives you the PostgreSQL database you requested with Supabase as the interface, without the complexities of self-hosting on GCP.