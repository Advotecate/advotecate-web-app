# Environment Setup - Quick Start Guide

Get your Advotecate backend running with Supabase in 5 minutes.

## Step 1: Get Supabase Credentials (2 minutes)

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Click **Project Settings** (gear icon) → **API**
4. Copy these 3 values:

```
✅ Project URL
✅ anon public key
✅ service_role secret key
```

## Step 2: Create .env File (1 minute)

```bash
cd /Volumes/MacBook/Advotecate/repos/advotecate-backend-api
cp .env.supabase.example .env
```

## Step 3: Fill in Required Values (2 minutes)

Edit `.env` and add:

```env
# === REQUIRED: Supabase (from Step 1) ===
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === REQUIRED: Generate these ===
# Run: openssl rand -base64 32
JWT_ACCESS_SECRET=<paste-output-here>
JWT_REFRESH_SECRET=<paste-output-here>
ENCRYPTION_KEY=<paste-output-here>

# === Application Settings ===
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Step 4: Generate Secrets

```bash
# Generate JWT secrets (run this 3 times)
openssl rand -base64 32

# Output example: aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1
```

Copy each output and paste into:
1. `JWT_ACCESS_SECRET`
2. `JWT_REFRESH_SECRET`
3. `ENCRYPTION_KEY`

## Step 5: Verify Setup

```bash
# Start the backend
npm run dev

# Should see:
# ✓ Connected to Supabase
# ✓ Server running on http://localhost:3001
```

## Common Issues

### ❌ "Invalid Supabase URL"
- Check URL format: `https://xxxxx.supabase.co`
- No trailing slash

### ❌ "Authentication failed"
- Verify service_role key (NOT anon key)
- Check for extra spaces in .env file

### ❌ "Cannot find module"
- Run: `npm install`
- Check Node version: `node -v` (need v18+)

## What's Next?

- ✅ **Deploy Permissions SQL** → See `PERMISSIONS_INTEGRATION.md`
- ✅ **Add Permission Checks to Routes** → Examples in integration guide
- ✅ **Test API Endpoints** → Use Postman or curl

## Need Help?

📖 **Full Documentation:**
- `PERMISSIONS_INTEGRATION.md` - Complete permissions guide
- `.env.supabase.example` - All environment variables explained
- `db/README.md` - Database schema and deployment

🔧 **Files Created:**
- `backend/src/services/permissionService.ts` - Permission checking functions
- `backend/src/middleware/permissions.ts` - Express middleware for route protection

---

**Quick Test:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```
