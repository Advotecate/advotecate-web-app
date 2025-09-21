# Advotecate Database Infrastructure

This directory contains the infrastructure setup for the Advotecate political donation platform database.

## Current Approach: Managed Supabase

Due to GCP organizational policy restrictions that prevent deployment of Cloud SQL instances, we're using managed Supabase which provides:
- PostgreSQL database hosted by Supabase
- Built-in authentication and authorization
- Real-time subscriptions
- Auto-generated REST and GraphQL APIs
- Web dashboard for database management

## Files Overview

### Database Schema
- `sql/01_payments_schema.sql` - Complete payments database schema with:
  - Payment methods (credit cards, bank accounts)
  - Donations and transaction processing
  - Compliance tracking for FEC requirements
  - Audit trails and refund processing

### Setup Scripts
- `setup-supabase-dev.sh` - Helper script for Supabase configuration
- `SUPABASE_MANAGED_SETUP_DEV.md` - Step-by-step setup guide

### Legacy Files (Deprecated)
- `main.tf` - Original self-hosted Supabase on GKE (blocked by org policies)
- `simple-database.tf` - Simplified Cloud SQL attempt (blocked by org policies)
- `deploy-database.sh` - Shell script for Cloud SQL deployment (blocked)
- `deploy-simple-database.sh` - Alternative deployment script (blocked)

## Quick Start

1. **Create Supabase Project**:
   - Go to https://supabase.com/dashboard
   - Create new project: "Advotecate Payments Dev"
   - Choose region: West US (Oregon)
   - Save your project URL and keys

2. **Apply Database Schema**:
   - Open SQL Editor in Supabase dashboard
   - Copy/paste contents of `sql/01_payments_schema.sql`
   - Execute to create all tables

3. **Configure Environment Variables**:
   ```bash
   # Backend (.env)
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key

   # Frontend (.env.local)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Update Vercel Environment**:
   - Add `@supabase-url-dev` and `@supabase-anon-key-dev` secrets
   - Deploy frontend with new configuration

## Database Schema Details

### Core Payment Tables
- **payment_methods**: Encrypted storage of payment instruments
- **donations**: Transaction records with compliance tracking
- **transaction_events**: Complete audit trail of all payment operations
- **refunds**: Refund processing and tracking

### Compliance Tables
- **contribution_limits**: FEC contribution limits by organization
- **donor_contributions**: Aggregate donor contribution tracking
- **fec_reports**: FEC report generation and filing

### Features
- Row Level Security (RLS) for data protection
- Automated triggers for audit trails
- Views for common queries
- Proper indexing for performance
- Sample data for testing

## Next Steps

1. Complete Supabase setup following the guide
2. Test database connectivity
3. Apply the payments schema
4. Configure authentication policies
5. Later: Add users and organizations schema

This approach provides the PostgreSQL database you requested with Supabase as the interface, avoiding the complexities of self-hosting on GCP while maintaining full control over your data structure.