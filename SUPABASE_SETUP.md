# Supabase Setup for Advotecate Payments

Since the GCP organizational policies are preventing us from creating public Cloud SQL instances, let's use managed Supabase which will be faster to set up and manage.

## Steps to Set Up Managed Supabase

### 1. Create Supabase Project

1. **Go to**: https://supabase.com/dashboard
2. **Click**: "New Project"
3. **Settings**:
   - **Name**: `Advotecate Payments`
   - **Database Password**: Generate a strong password and save it
   - **Region**: `West US (Oregon)` (closest to us-central1)
   - **Pricing Plan**: `Free` for MVP, upgrade later

### 2. Get Your Project Credentials

Once created, go to **Settings** → **API** and copy:

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

### 3. Run the Payments Schema

Once you have your Supabase project:

1. **Go to**: SQL Editor in your Supabase dashboard
2. **Copy and paste**: The entire contents of `infrastructure/gcp-supabase/sql/01_payments_schema.sql`
3. **Click**: "RUN" to create all the payment tables

### 4. Enable Row Level Security (RLS)

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

### 5. Update Your Environment Variables

Add these to your backend and frontend:

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

## Advantages of Managed Supabase

✅ **No infrastructure management**
✅ **Built-in authentication**
✅ **Real-time subscriptions**
✅ **Auto-generated REST and GraphQL APIs**
✅ **Built-in Row Level Security**
✅ **Dashboard for data management**
✅ **Automatic backups**
✅ **Edge functions support**

## Next Steps

1. Set up the managed Supabase project
2. Run the payments schema
3. Update environment variables
4. Test the connection from your backend
5. Connect the frontend to Supabase

This approach will be much faster than the self-hosted GKE setup and perfect for the MVP phase!