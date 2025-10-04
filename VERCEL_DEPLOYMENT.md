# Vercel Deployment Guide

Complete guide for deploying Advotecate to Vercel with Supabase database.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Supabase Sync](#supabase-sync)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
```bash
# Node.js 18+ and npm 9+
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher

# Vercel CLI
npm install -g vercel

# Supabase CLI (for database sync)
brew install supabase/tap/supabase

# Git
git --version
```

### Required Accounts
1. **Vercel Account**: https://vercel.com (free tier works)
2. **Supabase Account**: https://supabase.com (free tier works)
3. **FluidPay Account**: https://fluidpay.com (sandbox for development)

## Initial Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/Advotecate/advotecate-backend-api.git
cd advotecate-backend-api

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Link to Vercel

**Backend:**
```bash
cd backend
vercel link  # Follow prompts to create/link project
cd ..
```

**Frontend:**
```bash
cd frontend
vercel link  # Follow prompts to create/link project
cd ..
```

### 3. Link to Supabase

```bash
# Link to your Supabase project
supabase link --project-ref wbyxrtpzusysxdwtmzfa

# Pull current schema
npm run supabase:pull
```

## Environment Variables

### Backend Environment Variables

Configure these in Vercel Dashboard → Your Project → Settings → Environment Variables:

**Required:**
```bash
# Supabase
SUPABASE_URL=https://wbyxrtpzusysxdwtmzfa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your-random-32-char-string
JWT_REFRESH_SECRET=your-random-32-char-string
ENCRYPTION_KEY=your-random-32-char-string

# Frontend URL (update after frontend deployed)
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# FluidPay (sandbox for dev, production for prod)
FLUIDPAY_API_KEY=pub_330kTO6pORDnEdVP1NSMp7AWPMu
FLUIDPAY_SECRET_KEY=api_330kYWzNcgyrd84mgLFoq6ZV1Ad
FLUIDPAY_ENVIRONMENT=sandbox

# FEC API
FEC_API_KEY=t7ZBksd0AdsylsKZPRTRFUVJ9FaKNLpfKL2BOo47
```

**Optional:**
```bash
# Application Settings
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Feature Flags
ENABLE_RECURRING_DONATIONS=true
ENABLE_VOLUNTEER_MANAGEMENT=true
ENABLE_EVENT_REGISTRATION=true
```

### Frontend Environment Variables

Configure these in Vercel Dashboard → Your Project → Settings → Environment Variables:

```bash
# Supabase
VITE_SUPABASE_URL=https://wbyxrtpzusysxdwtmzfa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# FluidPay
VITE_FLUIDPAY_ENVIRONMENT=sandbox
VITE_FLUIDPAY_DOMAIN=advotecate2026

# Optional: Backend API URL (if using backend instead of direct Supabase)
VITE_API_URL=https://your-backend.vercel.app/api/v1
```

### Local Development Environment

Create `.env` files from templates:

**Backend `.env`:**
```bash
cd backend
cp ../.env.TEMPLATE .env
# Edit .env with your values
```

**Frontend `.env`:**
```bash
cd frontend
cp .env.example .env
# Edit .env with your values
```

## Deployment

### Deploy Both Apps

```bash
# Deploy backend and frontend together
npm run deploy

# Or deploy individually:
npm run deploy:backend
npm run deploy:frontend
```

### Deploy Specific Environment

```bash
# Production
cd backend && vercel --prod
cd frontend && vercel --prod

# Preview/Staging
cd backend && vercel
cd frontend && vercel
```

### First-Time Deployment Checklist

- [ ] Environment variables configured in Vercel Dashboard
- [ ] Supabase database schema deployed
- [ ] RLS policies enabled on all tables
- [ ] Backend deployed and verified
- [ ] Frontend deployed and verified
- [ ] Update `FRONTEND_URL` in backend env vars with actual frontend URL
- [ ] Update `CORS_ORIGINS` in backend env vars
- [ ] Test end-to-end: frontend → backend → database

## Local Development

### Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm run dev:backend  # Runs on http://localhost:3001
npm run dev:frontend # Runs on http://localhost:3000
```

### Using Start Script (Frontend)

```bash
cd frontend
./start-local-dev.sh
```

This will:
1. Check for `.env` file (creates from `.env.example` if missing)
2. Start Vite dev server
3. Connect directly to Supabase (no proxy needed)

## Supabase Sync

### Pull Production Schema to Local

```bash
# Pull latest schema from production
npm run supabase:pull

# This creates: supabase/migrations/[timestamp]_remote_commit.sql
```

### Check Local vs Production Diff

```bash
# Show schema differences
npm run supabase:status
```

### Apply Schema Changes Locally

```bash
# Reset local database to match migrations
supabase db reset
```

### Seed Local Database (Optional)

```bash
# WARNING: This overwrites local data
npm run supabase:seed
```

### Supabase CLI Commands

```bash
# Start local Supabase (includes PostgreSQL, PostgREST, Auth, etc.)
supabase start

# Stop local Supabase
supabase stop

# View local services status
supabase status

# Generate TypeScript types from schema
supabase gen types typescript --local > types/supabase.ts
```

## Troubleshooting

### Build Failures

**Issue:** Backend build fails on Vercel
```bash
# Solution: Ensure TypeScript compiles locally
cd backend
npm run build

# Check for TypeScript errors
npm run typecheck
```

**Issue:** Frontend build fails on Vercel
```bash
# Solution: Test build locally
cd frontend
npm run build

# Check environment variables are set
```

### Database Connection Issues

**Issue:** Backend can't connect to Supabase
```bash
# Verify environment variables:
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection locally:
node -e "import('./backend/check-schema.js')"
```

**Issue:** RLS blocking queries
```bash
# Verify RLS policies are deployed:
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Run: SELECT * FROM pg_policies;
# 3. Ensure policies exist for all tables

# Re-run RLS deployment:
psql $SUPABASE_URL < rls_policies.sql
```

### CORS Issues

**Issue:** Frontend can't call backend API
```bash
# Solution: Update CORS_ORIGINS in backend Vercel env vars
# Format: https://your-frontend.vercel.app,http://localhost:3000

# Redeploy backend after updating:
cd backend && vercel --prod
```

### Environment Variables Not Loading

**Issue:** Environment variables undefined in code
```bash
# Backend: Ensure variables are set in Vercel Dashboard
# Frontend: Ensure variables start with VITE_ prefix

# Redeploy after adding env vars:
vercel --prod
```

### Vercel Deployment URL

**Issue:** Need to find deployment URL
```bash
# Check Vercel Dashboard or:
vercel ls

# Or check recent deployments:
cd backend && vercel ls
cd frontend && vercel ls
```

### Local Development Port Conflicts

**Issue:** Port already in use
```bash
# Kill process on port 3001 (backend):
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000 (frontend):
lsof -ti:3000 | xargs kill -9
```

## Advanced Configuration

### Custom Domain

```bash
# Add domain in Vercel Dashboard → Domains
# Or via CLI:
vercel domains add yourdomain.com --project your-project-name
```

### Automatic Deployments

Vercel automatically deploys on:
- **Production:** Push to `main` branch
- **Preview:** Push to any other branch or open PR

Configure in: Vercel Dashboard → Your Project → Settings → Git

### Environment-Specific Configs

```bash
# Production
VERCEL_ENV=production

# Preview/Staging
VERCEL_ENV=preview

# Development
VERCEL_ENV=development
```

Use in code:
```typescript
if (process.env.VERCEL_ENV === 'production') {
  // Production-only code
}
```

## Support

### Useful Links
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [FluidPay API Docs](https://developer.fluidpay.com/)
- [Project GitHub](https://github.com/Advotecate/advotecate-backend-api)

### Common Commands Reference

```bash
# Development
npm run dev                    # Start both apps
npm run dev:backend           # Start backend only
npm run dev:frontend          # Start frontend only

# Build
npm run build                 # Build both apps
npm run typecheck            # TypeScript check

# Deployment
npm run deploy               # Deploy both to production
vercel --prod               # Deploy current directory
vercel                      # Deploy to preview

# Supabase
npm run supabase:status     # Check schema status
npm run supabase:pull       # Pull production schema
supabase start             # Start local Supabase
supabase db reset          # Reset local database

# Testing
npm run test               # Run tests
npm run lint              # Run linter
```

---

**Last Updated:** October 4, 2025
**Maintained By:** Advotecate Team
