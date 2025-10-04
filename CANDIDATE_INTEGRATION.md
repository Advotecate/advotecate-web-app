# ✅ FEC Candidate System Integration - COMPLETE

Your backend now includes a complete FEC candidate management system with multi-organization fundraising!

## What I Built

### 1. ✅ Database Schema
**File**: `db/candidate_system_schema.sql`

**6 New Tables**:
1. **`fec_candidates`** - Official FEC master file data (15 fields)
2. **`candidates`** - Platform enhancement layer with social media, bio, verification
3. **`candidate_fundraisers`** - Junction table enabling multi-org fundraising (KEY FEATURE)
4. **`fec_sync_log`** - Audit trail for FEC API synchronization jobs
5. **`fec_committees`** - FEC committee master data
6. **`candidate_committees`** - Candidate-to-committee linkage

**2 Analytics Views**:
- `v_candidate_fundraising_totals` - Aggregate fundraising across all orgs per candidate
- `v_fec_verified_candidates` - Only FEC-verified candidate profiles

**Deployment**:
```bash
# Copy entire file and paste into Supabase SQL Editor
cat db/candidate_system_schema.sql
```

---

### 2. ✅ Backend Services
**Location**: `backend/src/services/`

#### A. FEC Sync Service (`fecSyncService.ts`)
**Purpose**: Synchronize candidate data from OpenFEC API

**Key Features**:
- Full sync: Sync all candidates for a given year/office
- Incremental sync: Update 100 oldest records
- Single candidate sync: On-demand sync by CAND_ID
- Committee linkage: Sync candidate-committee relationships
- Rate limiting: 1,000 requests/hour compliance
- Audit logging: Track all sync jobs with error handling

**Usage**:
```typescript
import { fecSyncService } from './services/fecSyncService.js';

// Full sync for 2024 Senate candidates
await fecSyncService.fullSync(2024, 'S');

// Incremental sync (updates 100 oldest records)
await fecSyncService.incrementalSync();

// Sync specific candidate
await fecSyncService.syncCandidateById('H8CA52132');

// Check sync job status
const status = await fecSyncService.getSyncJobStatus(jobId);
```

#### B. Candidate Service (`candidateService.ts`)
**Purpose**: Business logic for candidate profiles and multi-org fundraising

**Key Features**:
- Candidate CRUD operations
- Slug generation and validation
- FEC linkage and verification
- Multi-org fundraiser creation
- Fundraiser approval workflows
- Aggregate fundraising analytics

**Usage**:
```typescript
import { candidateService } from './services/candidateService.js';

// Create candidate profile
const candidate = await candidateService.createCandidate({
  display_name: 'Jane Smith',
  slug: 'jane-smith',
  office_type: 'senate',
  fec_cand_id: 'S2CA00001',
});

// Get candidate with FEC data
const fullProfile = await candidateService.getCandidateById(candidateId);

// Create org-specific fundraiser
const fundraiser = await candidateService.createCandidateFundraiser({
  candidate_id: candidateId,
  fundraiser_id: fundraiserId,
  organization_id: orgId,
  fundraiser_role: 'supporting',
  custom_title: 'Our Community Supports Jane',
  custom_description: 'Join our local grassroots effort',
});

// Get aggregate totals
const totals = await candidateService.getCandidateFundraisingTotals(candidateId);
// Returns: { total_raised, total_donors, org_count, fundraiser_count }
```

---

### 3. ✅ API Routes
**File**: `backend/src/routes/candidates.ts`

#### Public Endpoints (No Auth)
```typescript
GET    /api/candidates/public              // List active candidates
GET    /api/candidates/public/:slug        // Get candidate profile
GET    /api/candidates/public/:slug/fundraisers  // Get candidate fundraisers
GET    /api/candidates/search              // Search candidates
```

#### Authenticated Endpoints
```typescript
// Candidate Management
GET    /api/candidates                     // List candidates (filtered)
POST   /api/candidates                     // Create candidate profile
GET    /api/candidates/:id                 // Get candidate by ID
PUT    /api/candidates/:id                 // Update candidate profile
POST   /api/candidates/:id/verify          // Verify/claim candidate
POST   /api/candidates/:id/link-fec        // Link to FEC CAND_ID

// Candidate Fundraisers
GET    /api/candidates/:id/fundraisers     // Get candidate fundraisers
POST   /api/candidates/:id/fundraisers     // Create fundraiser for candidate
PUT    /api/candidates/fundraisers/:fid    // Update candidate fundraiser
POST   /api/candidates/fundraisers/:fid/approve  // Approve fundraiser
POST   /api/candidates/fundraisers/:fid/reject   // Reject fundraiser
GET    /api/candidates/organizations/:orgId/fundraisers  // Get org's candidate fundraisers

// Admin / FEC Sync
POST   /api/candidates/admin/fec/sync/full        // Trigger full FEC sync
POST   /api/candidates/admin/fec/sync/incremental // Trigger incremental sync
GET    /api/candidates/admin/fec/sync/status/:jobId  // Get sync job status
GET    /api/candidates/admin/fec/sync/jobs        // Get recent sync jobs
```

---

### 4. ✅ Permissions System
**File**: `db/PERMISSIONS_ADDENDUM.sql`

**6 New Permissions**:
```sql
candidate.view                    -- View candidate profiles
candidate.create                  -- Create new candidate profiles
candidate.edit                    -- Edit candidate information
candidate.verify                  -- Verify/claim candidate profiles
candidate.fundraiser.create       -- Create fundraiser for candidate
candidate.fundraiser.manage       -- Manage org's candidate fundraisers
```

**Role Access**:
- **OWNER/ADMIN**: Full candidate management
- **CAMPAIGN_MANAGER**: Create/manage candidate fundraisers
- **CONTENT_EDITOR**: Create/edit candidates (no verification)
- **MEMBER**: View candidates only
- **Super Admin**: FEC sync management, verification approval

---

### 5. ✅ Documentation Updates

#### A. Architecture Documentation (`ADVOTECATE-ARCHITECTURE.md`)
Added comprehensive section on FEC candidate system covering:
- Architecture overview
- FEC data integration (OpenFEC API)
- Multi-organization fundraising model
- Verification & compliance features
- Database schema summary
- API endpoints (planned)
- Security & permissions

#### B. Database README (`db/README.md`)
Added detailed documentation:
- Candidate system schema files
- Table descriptions with all FEC fields
- Multi-org fundraising junction table
- Analytics views
- Deployment instructions
- Verification queries
- Performance indexes

---

## Environment Setup

### Required Environment Variables

Add to your `.env` file:

```env
# FEC API (OpenFEC)
FEC_API_KEY=your-fec-api-key-here

# Get your API key: https://api.data.gov/signup/
# Free tier: 1,000 requests/hour
# Demo key: DEMO_KEY (rate limited, not for production)
```

---

## Deployment Steps

### Step 1: Deploy Database Schema

```bash
# 1. Open Supabase SQL Editor
# 2. Copy entire candidate_system_schema.sql file
# 3. Paste and run

# Verify deployment:
SELECT
    'fec_candidates' as table_name, COUNT(*) as count FROM fec_candidates
UNION ALL SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL SELECT 'candidate_fundraisers', COUNT(*) FROM candidate_fundraisers
UNION ALL SELECT 'fec_sync_log', COUNT(*) FROM fec_sync_log;
```

### Step 2: Deploy Permissions

```bash
# Run PERMISSIONS_ADDENDUM.sql (if not already done)
# This adds 6 candidate permissions and grants them to appropriate roles

# Verify permissions:
SELECT * FROM permissions WHERE resource = 'candidate' ORDER BY name;
```

### Step 3: Set Up FEC API Access

1. **Get API Key**: https://api.data.gov/signup/
2. **Add to `.env`**: `FEC_API_KEY=your-key-here`
3. **Test connection**:
```bash
curl "https://api.open.fec.gov/v1/candidates/?api_key=YOUR_KEY&election_year=2024&per_page=5"
```

### Step 4: Register Routes

In your main `app.ts` or `index.ts`:

```typescript
import candidateRoutes from './routes/candidates.js';

// Register routes
app.use('/api/candidates', candidateRoutes);
```

### Step 5: Initial FEC Sync

```bash
# Option A: API endpoint (recommended)
curl -X POST http://localhost:3001/api/candidates/admin/fec/sync/full \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"year": 2024, "office": "S"}'

# Option B: Direct service call
node -e "
  import('./src/services/fecSyncService.js').then(m => {
    m.fecSyncService.fullSync(2024, 'S').then(result => {
      console.log('Sync complete:', result);
    });
  });
"
```

---

## Usage Examples

### Example 1: Create Candidate Profile

```typescript
// API Request
POST /api/candidates
Authorization: Bearer <campaign-manager-jwt>
Content-Type: application/json

{
  "fec_cand_id": "S2CA00001",
  "display_name": "Jane Smith for Senate",
  "slug": "jane-smith-senate",
  "office_type": "senate",
  "bio": "Community advocate running for California Senate",
  "website_url": "https://janeforsenate.com",
  "twitter_handle": "janeforsenate",
  "profile_image_url": "https://storage.example.com/jane-profile.jpg"
}

// Response
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "fec_cand_id": "S2CA00001",
    "display_name": "Jane Smith for Senate",
    "slug": "jane-smith-senate",
    "verification_status": "fec_verified",
    "campaign_status": "active",
    "created_at": "2025-10-04T..."
  }
}
```

### Example 2: Create Multi-Org Fundraiser

```typescript
// Scenario: Local grassroots org wants to fundraise for Jane Smith

// Step 1: Create standard fundraiser (existing flow)
POST /api/fundraisers
{
  "organization_id": "org-uuid",
  "title": "Our Community Supports Jane Smith",
  "description": "Join our local effort to elect Jane!",
  "goal_amount": 50000,
  ...
}
// Returns: { fundraiser_id: "fundraiser-uuid" }

// Step 2: Link fundraiser to candidate
POST /api/candidates/jane-smith-id/fundraisers
{
  "fundraiser_id": "fundraiser-uuid",
  "organization_id": "org-uuid",
  "fundraiser_role": "grassroots",
  "custom_title": "Sacramento Community for Jane",
  "custom_description": "We're Sacramento residents supporting Jane's vision"
}

// Result: Org now has their own branded fundraiser page for Jane
// All donations still count toward Jane's overall total
```

### Example 3: Get Candidate Fundraising Totals

```typescript
GET /api/candidates/public/jane-smith-senate/fundraisers

// Response
{
  "success": true,
  "data": {
    "fundraisers": [
      {
        "id": "uuid1",
        "organization": "Official Campaign",
        "fundraiser_role": "official",
        "is_primary": true,
        "amount_raised": 500000
      },
      {
        "id": "uuid2",
        "organization": "Sacramento Grassroots PAC",
        "fundraiser_role": "supporting",
        "custom_title": "Sacramento Community for Jane",
        "amount_raised": 50000
      },
      {
        "id": "uuid3",
        "organization": "Tech Workers for Jane",
        "fundraiser_role": "independent",
        "amount_raised": 75000
      }
    ],
    "totals": {
      "total_raised": 625000,
      "total_donors": 1250,
      "org_count": 3,
      "fundraiser_count": 3
    }
  }
}
```

---

## Multi-Org Fundraising Flow

### How It Works

1. **Candidate Profile Creation**
   - Anyone can create candidate profile (requires `candidate.create` permission)
   - If FEC CAND_ID provided, auto-sync from FEC API
   - Status: `unverified` → `fec_verified` (if FEC match) → `platform_verified` (after claiming)

2. **Organization Creates Fundraiser**
   - Org creates standard fundraiser via existing API
   - Links fundraiser to candidate via `candidate_fundraisers` junction table
   - Sets custom branding: title, description, role (official/supporting/independent/grassroots)

3. **Approval Workflow**
   - `is_primary=true` (official campaign) requires approval
   - `is_primary=false` (supporting orgs) auto-approved
   - Candidate can claim profile and manage approvals

4. **Donor Experience**
   - Donors see org-specific branded fundraiser page
   - Donations go to the organization's fundraiser
   - Aggregate totals visible on candidate's main profile

5. **FEC Compliance**
   - All donations tracked per CAND_ID for FEC reporting
   - Contribution limits enforced across all orgs per candidate ($3,300 per election)
   - Donor information captured per FEC regulations

---

## Key Features Explained

### Feature 1: Multi-Organization Fundraising

**Problem**: Multiple organizations want to fundraise for the same candidate independently.

**Solution**: Junction table `candidate_fundraisers` with unique constraints:
- `UNIQUE(candidate_id, fundraiser_id)` - One fundraiser per candidate
- `UNIQUE(candidate_id, organization_id, fundraiser_id)` - One fundraiser per org per candidate

**Benefits**:
- Each org maintains their own branded fundraiser page
- Org controls their messaging and donor relationships
- Aggregate analytics show total raised across all orgs
- No duplicate candidate profiles

### Feature 2: FEC Data Synchronization

**Problem**: Candidate data changes frequently (elections, status updates, committee changes).

**Solution**: Automated sync jobs with OpenFEC API:
- **Daily full sync**: Complete refresh of all active candidates (overnight)
- **Hourly incremental**: Update 100 oldest records
- **On-demand**: Sync specific candidate when needed

**Benefits**:
- Always have up-to-date FEC data
- Automatic verification of candidate identity
- Committee linkage for compliance reporting
- Audit trail of all sync jobs

### Feature 3: Verification Workflows

**Statuses**:
- `unverified` - Candidate profile created, not yet verified
- `fec_verified` - Candidate exists in FEC master file with matching CAND_ID
- `platform_verified` - Candidate claimed profile with identity verification
- `claimed` - Candidate initiated verification process

**Workflow**:
1. Candidate profile created (unverified)
2. Link to FEC CAND_ID → auto-verify against FEC data (fec_verified)
3. Candidate claims profile → verification process initiated (claimed)
4. Admin approves → full verification (platform_verified)

---

## Testing Your Setup

### Test 1: Create Candidate Profile

```bash
curl -X POST http://localhost:3001/api/candidates \
  -H "Authorization: Bearer CAMPAIGN_MANAGER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "fec_cand_id": "H8CA52132",
    "display_name": "Test Candidate",
    "slug": "test-candidate",
    "office_type": "house"
  }'

# Expected: 201 Created
# {
#   "success": true,
#   "data": { "id": "uuid", "verification_status": "fec_verified", ... }
# }
```

### Test 2: Search Candidates

```bash
curl "http://localhost:3001/api/candidates/search?query=Smith&office_type=senate"

# Expected: 200 OK
# { "success": true, "data": [...], "pagination": {...} }
```

### Test 3: Trigger FEC Sync

```bash
curl -X POST http://localhost:3001/api/candidates/admin/fec/sync/incremental \
  -H "Authorization: Bearer ADMIN_JWT"

# Expected: 200 OK
# { "success": true, "message": "Incremental FEC sync initiated" }

# Check sync job status
curl "http://localhost:3001/api/candidates/admin/fec/sync/jobs" \
  -H "Authorization: Bearer ADMIN_JWT"
```

---

## Advanced Configuration

### Scheduled Sync Jobs

Set up cron jobs for automatic FEC syncing:

```bash
# Daily full sync at 2 AM
0 2 * * * curl -X POST http://your-backend/api/candidates/admin/fec/sync/full -H "Authorization: Bearer ADMIN_JWT" -d '{"year": 2024}'

# Hourly incremental sync
0 * * * * curl -X POST http://your-backend/api/candidates/admin/fec/sync/incremental -H "Authorization: Bearer ADMIN_JWT"
```

### Custom Fundraiser Roles

Extend the `fundraiser_role` enum to match your use cases:
- `official` - Official campaign committee
- `supporting` - Supporting PAC or organization
- `independent` - Independent expenditure only
- `grassroots` - Community-driven grassroots effort
- `issue_advocacy` - Issue-focused advocacy group
- `local_chapter` - Local chapter of national organization

---

## Performance Optimization

### Caching Strategies

1. **Candidate Profiles**: Cache FEC-verified candidate data (24-hour TTL)
2. **Fundraising Totals**: Use materialized view `v_candidate_fundraising_totals`
3. **Search Results**: Cache popular searches (1-hour TTL)

### Index Usage

All critical indexes already created:
- FEC CAND_ID lookup (primary key)
- Candidate slug for URL routing
- Full-text search on candidate names (GIN index)
- Organization + Candidate lookup for fundraisers
- Election year + office type + state filtering

---

## Troubleshooting

### Issue: FEC Sync Fails

**Check**:
```sql
SELECT * FROM fec_sync_log
ORDER BY started_at DESC
LIMIT 5;
```

**Common Causes**:
- Invalid or expired FEC_API_KEY
- Rate limit exceeded (1,000 req/hour)
- Network connectivity issues

**Fix**:
- Verify API key: `curl "https://api.open.fec.gov/v1/candidates/?api_key=YOUR_KEY"`
- Check rate limits in error_log column
- Implement exponential backoff

### Issue: Permission Denied

**Check user's role**:
```sql
SELECT om.role, p.name as permission
FROM organization_members om
JOIN role_permissions rp ON rp.role_name = om.role
JOIN permissions p ON p.id = rp.permission_id
WHERE om.user_id = 'user-uuid'
  AND om.organization_id = 'org-uuid'
  AND p.resource = 'candidate';
```

**Fix**: Grant appropriate role or user-specific permission.

### Issue: Duplicate Candidate Profiles

**Check**:
```sql
SELECT fec_cand_id, COUNT(*) as count
FROM candidates
WHERE fec_cand_id IS NOT NULL
GROUP BY fec_cand_id
HAVING COUNT(*) > 1;
```

**Fix**: Merge duplicates manually, keeping the FEC-verified one.

---

## Security Considerations

### API Rate Limiting
- Implement rate limiting on candidate search endpoints
- Limit FEC sync triggers to admin users only
- Cache expensive queries (candidate totals, search results)

### Data Validation
- Validate FEC CAND_ID format: `[H|S|P][0-9]{8}`
- Sanitize user input in custom titles/descriptions
- Prevent SQL injection in search queries

### Permission Checks
- Always check permissions before candidate operations
- Verify organization membership for fundraiser creation
- Audit log all verification and approval actions

---

## Summary

✅ **Database Schema**: 6 tables, 2 views, comprehensive indexes
✅ **Backend Services**: FEC sync service + candidate service
✅ **API Routes**: 20+ endpoints for full CRUD + admin operations
✅ **Permissions**: 6 new candidate permissions integrated with existing system
✅ **Documentation**: Architecture docs, database docs, integration guide

**Your platform now supports**:
- ✅ FEC candidate profiles with official data
- ✅ Multi-organization fundraising for same candidate
- ✅ Automated FEC data synchronization
- ✅ Candidate verification workflows
- ✅ Aggregate fundraising analytics
- ✅ Role-based permission system
- ✅ FEC compliance integration

**Next Steps**:
1. Deploy database schema to Supabase
2. Set FEC_API_KEY in environment
3. Register candidate routes in main app
4. Run initial FEC sync for current election year
5. Test candidate creation and multi-org fundraising
6. Build frontend UI components

---

**Need Help?**
- Database schema: See `db/README.md`
- API usage: See `ADVOTECATE-ARCHITECTURE.md`
- Permissions: See `PERMISSIONS_EXAMPLES_EXPLAINED.md`
- Backend integration: See `INTEGRATION_COMPLETE.md`
