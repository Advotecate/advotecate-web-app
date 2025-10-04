# .env Setup - Step by Step

Follow these exact steps to create your `.env` file.

## Step 1: Copy the Template

```bash
cd /Volumes/MacBook/Advotecate/repos/advotecate-backend-api
cp .env.TEMPLATE .env
```

## Step 2: Get Supabase Credentials (3 values needed)

1. Open browser → https://app.supabase.com
2. Click your project (or create one if you haven't)
3. Click **Settings** (gear icon in left sidebar)
4. Click **API** tab
5. Copy these 3 values:

### Value 1: Project URL
- Look for **Project URL** section
- Copy the URL (looks like: `https://abcdefgh.supabase.co`)
- Paste into `.env` → `SUPABASE_URL=`

### Value 2: anon public key
- Scroll to **Project API keys** section
- Find **anon** **public** key
- Click eye icon to reveal
- Copy the long JWT token (starts with `eyJhbG...`)
- Paste into `.env` → `SUPABASE_ANON_KEY=`

### Value 3: service_role secret key
- Same section, find **service_role** **secret** key
- ⚠️ **KEEP THIS SECRET** - never commit to git or expose in frontend
- Click eye icon to reveal
- Copy the long JWT token
- Paste into `.env` → `SUPABASE_SERVICE_ROLE_KEY=`

## Step 3: Generate JWT Secrets (3 random strings needed)

Open Terminal and run this command **3 times**:

```bash
openssl rand -base64 32
```

### First Output → JWT_ACCESS_SECRET
```bash
# Example output: aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1
```
Copy and paste into `.env` → `JWT_ACCESS_SECRET=`

### Second Output → JWT_REFRESH_SECRET
```bash
# Run the command again
openssl rand -base64 32
```
Copy and paste into `.env` → `JWT_REFRESH_SECRET=`

### Third Output → ENCRYPTION_KEY
```bash
# Run the command one more time
openssl rand -base64 32
```
Copy and paste into `.env` → `ENCRYPTION_KEY=`

## Step 4: FluidPay Credentials (For Payments)

### Option A: Use Sandbox (Development)
The template already has sandbox credentials:
```env
FLUIDPAY_API_KEY=pub_330kTO6pORDnEdVP1NSMp7AWPMu
FLUIDPAY_SECRET_KEY=api_330kYWzNcgyrd84mgLFoq6ZV1Ad
FLUIDPAY_ENVIRONMENT=sandbox
```
✅ **No changes needed for development**

### Option B: Production Keys
1. Go to https://fluidpay.com
2. Log in to your account
3. Navigate to API Settings
4. Copy your production keys
5. Update in `.env`:
```env
FLUIDPAY_API_KEY=your-production-api-key
FLUIDPAY_SECRET_KEY=your-production-secret-key
FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
FLUIDPAY_ENVIRONMENT=production
```

## Step 5: Verify Application Settings

Check these values in your `.env`:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

✅ These should be correct for local development.

## Step 6: Optional - Email Setup (Skip for now)

If you want to send emails:

### Gmail Example:
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate an App Password
4. Update `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=Advotecate <noreply@advotecate.com>
```

**Skip this for now** - not required to run the backend.

## Step 7: Optional - Redis (Skip for now)

If you have Redis running:
```env
REDIS_URL=redis://localhost:6379
```

**Skip this for now** - not required to run the backend.

## ✅ Final .env File Should Look Like:

```env
# === REQUIRED ===
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...

JWT_ACCESS_SECRET=aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1
JWT_REFRESH_SECRET=xY9zA7bC9dE1fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA
ENCRYPTION_KEY=pQ7rS9tU1vW3xY5zA7bC9dE1fG7hI9jK1lM3nO5pQ7rS

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

FLUIDPAY_API_KEY=pub_330kTO6pORDnEdVP1NSMp7AWPMu
FLUIDPAY_SECRET_KEY=api_330kYWzNcgyrd84mgLFoq6ZV1Ad
FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
FLUIDPAY_ENVIRONMENT=sandbox

NODE_ENV=development
PORT=3001
API_VERSION=v1
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# === OPTIONAL (leave as-is for now) ===
PLATFORM_FEE_PERCENTAGE=2.9
PLATFORM_FEE_FIXED=0.30
DONATION_LIMIT_INDIVIDUAL_ANNUAL=2900
DONATION_LIMIT_INDIVIDUAL_ELECTION=3300

BCRYPT_ROUNDS=12
SESSION_TTL_HOURS=24
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info
DEBUG_MODE=true
ENABLE_API_DOCS=true
ENABLE_QUERY_LOGGING=false

# Storage buckets
STORAGE_BUCKET_AVATARS=avatars
STORAGE_BUCKET_DOCUMENTS=documents
STORAGE_BUCKET_ORG_IMAGES=organization-images

# Feature flags
ENABLE_RECURRING_DONATIONS=true
ENABLE_VOLUNTEER_MANAGEMENT=true
ENABLE_EVENT_REGISTRATION=true
ENABLE_INTEREST_PERSONALIZATION=true
```

## Step 8: Test Your Setup

```bash
# Install dependencies (if you haven't)
npm install

# Start the backend
npm run dev
```

### Expected Output:
```
✓ Environment variables loaded
✓ Connected to Supabase
✓ Server running on http://localhost:3001
✓ API documentation available at http://localhost:3001/api-docs
```

### Test the API:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"2025-10-04T..."}
```

## Troubleshooting

### ❌ Error: "Invalid Supabase URL"
- Check the URL format: `https://xxxxx.supabase.co`
- Remove any trailing slashes
- Make sure it's your project URL, not the dashboard URL

### ❌ Error: "Invalid API key"
- Double-check you copied the **service_role** key (not anon key)
- Make sure there are no extra spaces or line breaks
- Try copying again from Supabase dashboard

### ❌ Error: "Cannot find module"
- Run: `npm install`
- Make sure you're in the backend directory

### ❌ Error: "Port 3001 already in use"
- Change `PORT=3002` in `.env`
- Or kill the process using port 3001:
  ```bash
  lsof -ti:3001 | xargs kill -9
  ```

### ❌ Error: "JWT secret too short"
- Make sure your JWT secrets are at least 32 characters
- Re-generate with: `openssl rand -base64 32`

## 🎉 Success!

If you see the server running without errors, you're ready to:

1. ✅ Test API endpoints
2. ✅ Connect your frontend
3. ✅ Add permission checks to routes (see `PERMISSIONS_INTEGRATION.md`)

## Quick Reference

| Variable | Where to Get It | Required? |
|----------|----------------|-----------|
| SUPABASE_URL | Supabase Dashboard → API | ✅ Yes |
| SUPABASE_ANON_KEY | Supabase Dashboard → API | ✅ Yes |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard → API | ✅ Yes |
| JWT_ACCESS_SECRET | `openssl rand -base64 32` | ✅ Yes |
| JWT_REFRESH_SECRET | `openssl rand -base64 32` | ✅ Yes |
| ENCRYPTION_KEY | `openssl rand -base64 32` | ✅ Yes |
| FLUIDPAY_* | FluidPay Dashboard | ✅ Yes (use sandbox for dev) |
| SMTP_* | Email provider | ❌ Optional |
| REDIS_URL | Redis server | ❌ Optional |

---

**Need help?** Check:
- `PERMISSIONS_INTEGRATION.md` - Full integration guide
- `.env.TEMPLATE` - Complete variable reference
- `ENV_SETUP_QUICKSTART.md` - Alternative quick guide
