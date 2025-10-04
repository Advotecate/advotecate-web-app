# Permissions in Routes - Explained with Examples

## What Does "Using Permissions in Routes" Mean?

**Routes** = Your API endpoints (URLs that accept requests)
**Permissions** = Rules about who can access what

**Using permissions in routes** = Adding permission checks to your API endpoints so only authorized users can access them.

---

## Simple Analogy

Think of your API like a building:

- **Routes** = Different rooms in the building
- **Permissions** = Security badges that grant access to specific rooms
- **Middleware** = Security guards checking badges at each door

Without permissions, anyone with a building pass can enter any room.
With permissions, security guards check if your badge allows access to that specific room.

---

## Real Code Example: Organization Routes

### File: `backend/src/routes/organizations.ts`

```typescript
import { Router } from 'express';
import { requirePermission, PERMISSIONS } from '../middleware/permissions.js';

const router = Router();

// ============================================================================
// EXAMPLE 1: View Organization (Most people can do this)
// ============================================================================
router.get(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_VIEW),  // 👈 Check: Can user view this org?
  getOrganization  // If yes, run this function
);

/*
What happens:
1. User makes request: GET /api/organizations/123
2. Middleware checks: Does this user have 'organization.view' permission for org 123?
3. If YES → Call getOrganization() and return data
4. If NO → Return 403 Forbidden error
*/

// ============================================================================
// EXAMPLE 2: Edit Organization (Only admins can do this)
// ============================================================================
router.patch(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_EDIT),  // 👈 Check: Can user edit this org?
  updateOrganization
);

/*
Who can pass this check?
✅ OWNER - Always has all permissions
✅ ADMIN - Has organization.edit permission by default
❌ TREASURER - Only has financial permissions
❌ MEMBER - Only has viewing permissions
❌ Random logged-in user - Not a member of this org
*/

// ============================================================================
// EXAMPLE 3: Delete Organization (Only owner can do this)
// ============================================================================
router.delete(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_DELETE),  // 👈 Very restricted permission
  deleteOrganization
);

/*
Who can pass this check?
✅ OWNER - Has organization.delete permission
❌ ADMIN - Does NOT have delete permission (only owner can delete)
❌ Everyone else - No chance
*/

export default router;
```

---

## Step-by-Step: What Happens When a Request is Made

### Scenario: Bob (CAMPAIGN_MANAGER) tries to create a fundraiser

```typescript
// In your route file
router.post(
  '/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE),  // 👈 Permission check here
  createFundraiser
);
```

**Step-by-step flow:**

```
1. Request arrives
   POST /api/fundraisers
   Authorization: Bearer bob-jwt-token
   Body: { title: "New Fundraiser", organization_id: "org-123" }

2. Authentication middleware runs first (separate from permissions)
   → Verifies JWT token
   → Attaches user info to request: req.user = { id: 'bob-uuid', role: 'user' }

3. Permission middleware runs (requirePermission)
   → Extracts organization_id from request body: "org-123"
   → Calls database function: check_user_permission('bob-uuid', 'fundraiser.create', 'org-123')

4. Database checks Bob's permissions
   → Bob is CAMPAIGN_MANAGER in org-123
   → CAMPAIGN_MANAGER role has fundraiser.create permission
   → Returns: true ✅

5. Permission check passes
   → Calls createFundraiser() function
   → Fundraiser is created
   → Returns 200 OK

6. Response sent to Bob
   {
     "id": "fundraiser-456",
     "title": "New Fundraiser",
     "status": "created"
   }
```

### Scenario: Diana (MEMBER) tries to create a fundraiser

```
1. Request arrives
   POST /api/fundraisers
   Authorization: Bearer diana-jwt-token
   Body: { title: "New Fundraiser", organization_id: "org-123" }

2. Authentication passes
   → req.user = { id: 'diana-uuid', role: 'user' }

3. Permission middleware runs
   → Calls: check_user_permission('diana-uuid', 'fundraiser.create', 'org-123')

4. Database checks Diana's permissions
   → Diana is MEMBER in org-123
   → MEMBER role does NOT have fundraiser.create permission
   → Returns: false ❌

5. Permission check FAILS
   → Does NOT call createFundraiser()
   → Returns 403 Forbidden immediately

6. Response sent to Diana
   {
     "error": "Forbidden",
     "message": "You don't have permission to perform this action",
     "requiredPermission": "fundraiser.create"
   }
```

---

## Different Types of Permission Checks

### 1. Single Permission Check
User needs ONE specific permission:

```typescript
router.post(
  '/events',
  requirePermission(PERMISSIONS.EVENT_CREATE),
  createEvent
);
```

### 2. Any Permission Check
User needs AT LEAST ONE of multiple permissions:

```typescript
router.get(
  '/dashboard',
  requireAnyPermission([
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ORG_SETTINGS
  ]),
  getDashboard
);
// ✅ Passes if user has EITHER analytics.view OR organization.settings
```

### 3. All Permissions Check
User needs ALL specified permissions:

```typescript
router.get(
  '/donations/export',
  requireAllPermissions([
    PERMISSIONS.DONATION_VIEW_DETAILS,
    PERMISSIONS.DONATION_EXPORT
  ]),
  exportDonations
);
// ✅ Passes ONLY if user has BOTH permissions
```

---

## Complete Real-World Example

Let's build a complete route file with permissions:

```typescript
// backend/src/routes/donations.ts
import { Router } from 'express';
import {
  requirePermission,
  requireAllPermissions,
  PERMISSIONS
} from '../middleware/permissions.js';
import {
  listDonations,
  getDonationDetails,
  exportDonations,
  processRefund
} from '../controllers/donations.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTE - No permission needed
// ============================================================================
router.post('/donate', processDonation);
// Anyone can donate (even non-logged-in users)

// ============================================================================
// VIEW DONATION LIST - Requires: donation.view
// ============================================================================
router.get(
  '/organizations/:organizationId/donations',
  requirePermission(PERMISSIONS.DONATION_VIEW),
  listDonations
);
/*
WHO CAN ACCESS:
✅ OWNER - Has all permissions
✅ ADMIN - Has donation.view
✅ TREASURER - Has donation.view (financial role)
❌ CAMPAIGN_MANAGER - Only has content permissions
❌ MEMBER - Only has basic viewing
*/

// ============================================================================
// VIEW DONOR DETAILS - Requires: donation.view_details (SENSITIVE)
// ============================================================================
router.get(
  '/donations/:donationId/details',
  requirePermission(PERMISSIONS.DONATION_VIEW_DETAILS),
  getDonationDetails
);
/*
WHO CAN ACCESS:
✅ OWNER - Has all permissions
✅ ADMIN - Has sensitive data access
✅ TREASURER - Has financial data access
❌ CAMPAIGN_MANAGER - No sensitive data access
❌ MEMBER - Definitely not
*/

// ============================================================================
// EXPORT DONATIONS - Requires: BOTH view_details AND export
// ============================================================================
router.get(
  '/organizations/:organizationId/donations/export',
  requireAllPermissions([
    PERMISSIONS.DONATION_VIEW_DETAILS,
    PERMISSIONS.DONATION_EXPORT
  ]),
  exportDonations
);
/*
WHO CAN ACCESS:
✅ OWNER - Has all permissions
✅ ADMIN - Has both permissions
✅ TREASURER - Has both financial permissions
❌ CAMPAIGN_MANAGER - Has neither
❌ MEMBER - Has neither

Why two permissions?
- view_details: Can see donor info
- export: Can download/export data
Must have BOTH to export sensitive donor data
*/

// ============================================================================
// REFUND DONATION - Requires: donation.refund
// ============================================================================
router.post(
  '/donations/:donationId/refund',
  requirePermission(PERMISSIONS.DONATION_REFUND),
  processRefund
);
/*
WHO CAN ACCESS:
✅ OWNER - Has all permissions
✅ ADMIN - Has refund permission
✅ TREASURER - Has financial permissions including refunds
❌ CAMPAIGN_MANAGER - Cannot handle money
❌ MEMBER - Cannot handle money
*/

export default router;
```

---

## How to Add Permissions to YOUR Routes

### Step 1: Import the Middleware

```typescript
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  PERMISSIONS
} from '../middleware/permissions.js';
```

### Step 2: Add to Your Routes

```typescript
// BEFORE (no permissions)
router.post('/fundraisers', createFundraiser);

// AFTER (with permissions)
router.post(
  '/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE),  // 👈 Add this line
  createFundraiser
);
```

### Step 3: Choose the Right Permission

Look at the permission constants in `permissionService.ts`:

```typescript
// Organization permissions
PERMISSIONS.ORG_VIEW           // View organization
PERMISSIONS.ORG_EDIT           // Edit organization
PERMISSIONS.ORG_DELETE         // Delete organization

// Fundraiser permissions
PERMISSIONS.FUNDRAISER_CREATE  // Create fundraisers
PERMISSIONS.FUNDRAISER_EDIT    // Edit fundraisers
PERMISSIONS.FUNDRAISER_DELETE  // Delete fundraisers

// Donation permissions
PERMISSIONS.DONATION_VIEW              // View donation list
PERMISSIONS.DONATION_VIEW_DETAILS      // View donor info (sensitive)
PERMISSIONS.DONATION_EXPORT            // Export donation data
PERMISSIONS.DONATION_REFUND            // Process refunds

// ... etc
```

---

## Testing Permissions

### Test 1: Try without authentication
```bash
curl -X POST http://localhost:3001/api/fundraisers
# Result: 401 Unauthorized - "You must be logged in"
```

### Test 2: Try with authentication but no permission
```bash
curl -X POST http://localhost:3001/api/fundraisers \
  -H "Authorization: Bearer member-jwt-token"
# Result: 403 Forbidden - "You don't have permission"
```

### Test 3: Try with proper permission
```bash
curl -X POST http://localhost:3001/api/fundraisers \
  -H "Authorization: Bearer campaign-manager-jwt-token"
# Result: 200 OK - Fundraiser created!
```

---

## Common Patterns

### Pattern 1: Public + Protected Routes
```typescript
// Public - anyone can view
router.get('/fundraisers', listFundraisers);

// Protected - only authorized can create
router.post(
  '/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE),
  createFundraiser
);
```

### Pattern 2: Different Permissions for Different Actions
```typescript
// Anyone in org can view
router.get(
  '/organizations/:id',
  requirePermission(PERMISSIONS.ORG_VIEW),
  getOrg
);

// Only admins can edit
router.patch(
  '/organizations/:id',
  requirePermission(PERMISSIONS.ORG_EDIT),
  updateOrg
);

// Only owner can delete
router.delete(
  '/organizations/:id',
  requirePermission(PERMISSIONS.ORG_DELETE),
  deleteOrg
);
```

### Pattern 3: Extract Organization ID from Different Places
```typescript
// From URL parameter
router.get(
  '/organizations/:organizationId/members',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  listMembers
);
// Automatically uses req.params.organizationId

// From request body
router.post(
  '/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE, {
    getOrgId: (req) => req.body.organization_id  // 👈 Custom extractor
  }),
  createFundraiser
);
```

---

## Summary

**Using permissions in routes** means:

1. ✅ Import permission middleware
2. ✅ Add it between the route path and controller function
3. ✅ Choose the appropriate permission constant
4. ✅ The middleware automatically checks if the user has permission
5. ✅ Only authorized users can access the endpoint

**Benefits:**
- 🔒 Security - Only authorized users can perform actions
- 🎯 Granular control - Different permissions for different actions
- 📊 Audit trail - All permission checks are logged
- 🚀 Easy to use - Just add one line to each route

**Next steps:**
1. Read `PERMISSIONS_INTEGRATION.md` for more examples
2. Add permissions to your existing routes
3. Test with different user roles
4. Check the audit logs in `permission_audit_log` table
