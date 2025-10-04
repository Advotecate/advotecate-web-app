# Permissions System Integration Guide

Complete guide for integrating the new role-based permissions system with Supabase backend.

## Table of Contents
- [Overview](#overview)
- [Environment Setup](#environment-setup)
- [Permission Service](#permission-service)
- [Middleware Usage](#middleware-usage)
- [Route Protection Examples](#route-protection-examples)
- [Testing](#testing)

---

## Overview

The permissions system provides:
- **16 Roles**: 6 platform roles + 10 organization roles
- **35+ Permissions**: Granular access control across 6 categories
- **Database Functions**: `check_user_permission()` and `get_user_permissions()`
- **Automatic Inheritance**: super_admin → OWNER → role-based → user-specific

### Permission Categories
1. **financial** - Donations, disbursements, exports
2. **content** - Fundraisers, events, organization content
3. **member_mgmt** - Member management, role changes
4. **volunteer_mgmt** - Volunteer approvals, hours
5. **compliance** - Reports, FEC filing
6. **analytics** - Dashboard access, data exports

---

## Environment Setup

### Step 1: Get Supabase Credentials

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **Project Settings > API**
3. Copy the following values:

```env
# Project URL
SUPABASE_URL=https://xxxxx.supabase.co

# API Keys
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Configure Environment Variables

Copy `.env.supabase.example` to `.env`:

```bash
cp .env.supabase.example .env
```

Fill in your values (minimum required):

```env
# REQUIRED: Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# REQUIRED: JWT Secrets
JWT_ACCESS_SECRET=generate-random-32-char-string
JWT_REFRESH_SECRET=generate-random-32-char-string

# REQUIRED: Encryption
ENCRYPTION_KEY=generate-random-32-byte-key

# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Generate secure keys:**
```bash
# JWT secrets (32 characters minimum)
openssl rand -base64 32

# Encryption key
openssl rand -base64 32
```

### Step 3: Database Setup

Ensure you've deployed the permissions system to Supabase:

1. **Main Schema**: Run `complete_supabase_schema.sql` (if not already deployed)
2. **Permissions Addendum**: Run `PERMISSIONS_ADDENDUM.sql`

Verify deployment:
```sql
-- Check permissions table
SELECT COUNT(*) FROM permissions;  -- Should return 35+

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname IN ('check_user_permission', 'get_user_permissions');
```

---

## Permission Service

Located in `backend/src/services/permissionService.ts`

### Core Functions

#### `checkUserPermission(userId, permissionName, organizationId?)`
Check if a user has a specific permission.

```typescript
import { checkUserPermission, PERMISSIONS } from '../services/permissionService.js';

// Check platform-level permission
const canModerate = await checkUserPermission(userId, PERMISSIONS.PLATFORM_MODERATE);

// Check organization-scoped permission
const canCreateFundraiser = await checkUserPermission(
  userId,
  PERMISSIONS.FUNDRAISER_CREATE,
  organizationId
);
```

#### `getUserPermissions(userId, organizationId?)`
Get all permissions for a user with their sources.

```typescript
import { getUserPermissions } from '../services/permissionService.js';

const permissions = await getUserPermissions(userId, organizationId);
// Returns: [
//   {
//     permission_name: 'fundraiser.create',
//     resource: 'fundraiser',
//     action: 'create',
//     source: 'org_role:CAMPAIGN_MANAGER',
//     is_sensitive: false
//   },
//   ...
// ]
```

#### `getUserOrgRole(userId, organizationId)`
Get user's role in an organization.

```typescript
import { getUserOrgRole } from '../services/permissionService.js';

const role = await getUserOrgRole(userId, organizationId);
// Returns: 'ADMIN' | 'TREASURER' | 'MEMBER' | null
```

#### `isSuperAdmin(userId)` / `isOrganizationOwner(userId, orgId)`
Quick checks for elevated roles.

```typescript
import { isSuperAdmin, isOrganizationOwner } from '../services/permissionService.js';

if (await isSuperAdmin(userId)) {
  // User has all permissions
}

if (await isOrganizationOwner(userId, orgId)) {
  // User owns this organization
}
```

---

## Middleware Usage

Located in `backend/src/middleware/permissions.ts`

### `requirePermission(permissionName, options?)`
Most common middleware - protects routes requiring a specific permission.

```typescript
import { requirePermission, PERMISSIONS } from '../middleware/permissions.js';

// Protect route with permission
router.post(
  '/organizations/:organizationId/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE),
  createFundraiser
);

// Custom organization ID extraction
router.post(
  '/fundraisers',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE, {
    getOrgId: (req) => req.body.organization_id,
    errorMessage: 'You need fundraiser creation permission'
  }),
  createFundraiser
);
```

### `requireAnyPermission(permissions[], options?)`
User needs at least ONE of the specified permissions.

```typescript
import { requireAnyPermission, PERMISSIONS } from '../middleware/permissions.js';

// Allow if user can view analytics OR is org admin
router.get(
  '/organizations/:organizationId/dashboard',
  requireAnyPermission([
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ORG_SETTINGS
  ]),
  getDashboard
);
```

### `requireAllPermissions(permissions[], options?)`
User must have ALL specified permissions.

```typescript
import { requireAllPermissions, PERMISSIONS } from '../middleware/permissions.js';

// Requires both view and export permissions
router.get(
  '/organizations/:organizationId/donations/export',
  requireAllPermissions([
    PERMISSIONS.DONATION_VIEW_DETAILS,
    PERMISSIONS.DONATION_EXPORT
  ]),
  exportDonations
);
```

### `requireRole(role)`
Check platform-level role.

```typescript
import { requireRole } from '../middleware/permissions.js';

// Super admin only
router.get('/admin/users', requireRole('super_admin'), listAllUsers);

// Multiple roles allowed
router.get(
  '/admin/reports',
  requireRole(['super_admin', 'compliance_officer']),
  getComplianceReports
);
```

### `attachPermissions(options?)`
Attach user permissions to request for conditional logic.

```typescript
import { attachPermissions } from '../middleware/permissions.js';

router.get(
  '/organizations/:organizationId/data',
  attachPermissions(),
  (req, res) => {
    // req.permissions now contains array of user permissions
    const canViewSensitive = req.permissions.some(
      p => p.permission_name === 'donation.view_details'
    );

    return res.json({
      data: filterData(req.permissions)
    });
  }
);
```

---

## Route Protection Examples

### Organization Routes

```typescript
import { Router } from 'express';
import { requirePermission, PERMISSIONS } from '../middleware/permissions.js';

const router = Router();

// View organization (anyone with org membership)
router.get(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_VIEW),
  getOrganization
);

// Edit organization (admins only)
router.patch(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_EDIT),
  updateOrganization
);

// Manage settings (admins and owners)
router.put(
  '/:organizationId/settings',
  requirePermission(PERMISSIONS.ORG_SETTINGS),
  updateSettings
);

// Delete organization (owner only)
router.delete(
  '/:organizationId',
  requirePermission(PERMISSIONS.ORG_DELETE),
  deleteOrganization
);

export default router;
```

### Fundraiser Routes

```typescript
import { Router } from 'express';
import { requirePermission, requireAnyPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = Router();

// View fundraiser (public or with permission)
router.get('/:fundraiserId', getFundraiser);

// Create fundraiser (campaign managers, admins)
router.post(
  '/',
  requirePermission(PERMISSIONS.FUNDRAISER_CREATE),
  createFundraiser
);

// Edit fundraiser (creator or admin)
router.patch(
  '/:fundraiserId',
  requireAnyPermission([
    PERMISSIONS.FUNDRAISER_EDIT,
    PERMISSIONS.ORG_SETTINGS
  ]),
  updateFundraiser
);

// Publish fundraiser (requires approval)
router.post(
  '/:fundraiserId/publish',
  requirePermission(PERMISSIONS.FUNDRAISER_PUBLISH),
  publishFundraiser
);

// Delete fundraiser (admins only)
router.delete(
  '/:fundraiserId',
  requirePermission(PERMISSIONS.FUNDRAISER_DELETE),
  deleteFundraiser
);

export default router;
```

### Donation Routes

```typescript
import { Router } from 'express';
import { requirePermission, requireAllPermissions, PERMISSIONS } from '../middleware/permissions.js';

const router = Router();

// View donation list (treasurer, admin)
router.get(
  '/organizations/:organizationId/donations',
  requirePermission(PERMISSIONS.DONATION_VIEW),
  listDonations
);

// View donor details (sensitive permission)
router.get(
  '/donations/:donationId/details',
  requirePermission(PERMISSIONS.DONATION_VIEW_DETAILS),
  getDonationDetails
);

// Export donations (requires both view and export)
router.get(
  '/organizations/:organizationId/donations/export',
  requireAllPermissions([
    PERMISSIONS.DONATION_VIEW_DETAILS,
    PERMISSIONS.DONATION_EXPORT
  ]),
  exportDonations
);

// Process refund (treasurer only)
router.post(
  '/donations/:donationId/refund',
  requirePermission(PERMISSIONS.DONATION_REFUND),
  processRefund
);

export default router;
```

### Member Management Routes

```typescript
import { Router } from 'express';
import { requirePermission, PERMISSIONS } from '../middleware/permissions.js';

const router = Router();

// List members (anyone in org)
router.get(
  '/organizations/:organizationId/members',
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  listMembers
);

// Invite member (admins)
router.post(
  '/organizations/:organizationId/members/invite',
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  inviteMember
);

// Change member role (admins)
router.patch(
  '/organizations/:organizationId/members/:userId/role',
  requirePermission(PERMISSIONS.MEMBER_EDIT_ROLE),
  changeMemberRole
);

// Remove member (admins)
router.delete(
  '/organizations/:organizationId/members/:userId',
  requirePermission(PERMISSIONS.MEMBER_REMOVE),
  removeMember
);

// Manage custom permissions (owner/super admin)
router.post(
  '/organizations/:organizationId/members/:userId/permissions',
  requirePermission(PERMISSIONS.MEMBER_MANAGE_PERMS),
  managePermissions
);

export default router;
```

---

## Testing

### Unit Tests Example

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { checkUserPermission } from '../services/permissionService.js';

describe('Permission Service', () => {
  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    // Setup test user and organization
  });

  it('should allow OWNER to do everything', async () => {
    const canDelete = await checkUserPermission(userId, 'organization.delete', orgId);
    expect(canDelete).toBe(true);
  });

  it('should deny MEMBER from managing members', async () => {
    const canManage = await checkUserPermission(userId, 'member.edit_role', orgId);
    expect(canManage).toBe(false);
  });

  it('should allow TREASURER to view donations', async () => {
    const canView = await checkUserPermission(userId, 'donation.view', orgId);
    expect(canView).toBe(true);
  });
});
```

### Manual Testing

```bash
# Start backend
npm run dev

# Test permission check
curl -X GET http://localhost:3001/api/v1/users/me/permissions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test protected route
curl -X POST http://localhost:3001/api/v1/organizations/ORG_ID/fundraisers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Fundraiser"}'
```

---

## Permission Constants Reference

All available permission constants in `PERMISSIONS` object:

```typescript
// Organization
PERMISSIONS.ORG_VIEW
PERMISSIONS.ORG_EDIT
PERMISSIONS.ORG_SETTINGS
PERMISSIONS.ORG_DELETE
PERMISSIONS.ORG_TRANSFER

// Members
PERMISSIONS.MEMBER_VIEW
PERMISSIONS.MEMBER_INVITE
PERMISSIONS.MEMBER_REMOVE
PERMISSIONS.MEMBER_EDIT_ROLE
PERMISSIONS.MEMBER_MANAGE_PERMS

// Fundraisers
PERMISSIONS.FUNDRAISER_VIEW
PERMISSIONS.FUNDRAISER_CREATE
PERMISSIONS.FUNDRAISER_EDIT
PERMISSIONS.FUNDRAISER_DELETE
PERMISSIONS.FUNDRAISER_PUBLISH

// Donations
PERMISSIONS.DONATION_VIEW
PERMISSIONS.DONATION_VIEW_DETAILS
PERMISSIONS.DONATION_EXPORT
PERMISSIONS.DONATION_REFUND

// Disbursements
PERMISSIONS.DISBURSEMENT_VIEW
PERMISSIONS.DISBURSEMENT_CREATE
PERMISSIONS.DISBURSEMENT_APPROVE

// Events
PERMISSIONS.EVENT_VIEW
PERMISSIONS.EVENT_CREATE
PERMISSIONS.EVENT_EDIT
PERMISSIONS.EVENT_DELETE
PERMISSIONS.EVENT_MANAGE_REGISTRATIONS

// Volunteers
PERMISSIONS.VOLUNTEER_VIEW
PERMISSIONS.VOLUNTEER_APPROVE
PERMISSIONS.VOLUNTEER_HOURS_APPROVE

// Compliance
PERMISSIONS.COMPLIANCE_VIEW_REPORTS
PERMISSIONS.COMPLIANCE_FILE_REPORTS

// Analytics
PERMISSIONS.ANALYTICS_VIEW
```

---

## Troubleshooting

### Permission check always returns false

1. **Check database deployment:**
   ```sql
   SELECT * FROM permissions WHERE name = 'your.permission';
   SELECT * FROM role_permissions WHERE permission_id = 'xxx';
   ```

2. **Verify user is active:**
   ```sql
   SELECT status FROM users WHERE id = 'user-id';
   ```

3. **Check organization membership:**
   ```sql
   SELECT * FROM organization_members
   WHERE user_id = 'user-id' AND organization_id = 'org-id';
   ```

### Supabase connection errors

1. Verify environment variables are loaded
2. Check Supabase project is active (not paused)
3. Verify service role key has admin privileges
4. Check network/firewall settings

### Missing permissions

Add new permissions via SQL:
```sql
INSERT INTO permissions (name, resource, action, description, category, is_sensitive)
VALUES ('custom.permission', 'custom', 'action', 'Description', 'category', false);

-- Grant to role
INSERT INTO role_permissions (role_type, role_name, permission_id)
SELECT 'organization', 'ADMIN', id FROM permissions WHERE name = 'custom.permission';
```

---

## Next Steps

1. ✅ Deploy permissions SQL to Supabase
2. ✅ Configure environment variables
3. ✅ Integrate permission middleware into routes
4. 🔄 Add frontend permission checks
5. 🔄 Implement RLS policies (optional)
6. 🔄 Create admin UI for permission management

**Need help?** Check the main `db/README.md` or database schema documentation.
