# Advotecate Backend API - Comprehensive Documentation

## Overview

The Advotecate backend API is a comprehensive political donation platform API with 179 total endpoints across 11 functional areas. The API serves both production and development environments with robust security, rate limiting, and permissions system.

**Base URL**: `https://api.advotecate.com` (Production) | `http://localhost:3001` (Development)
**API Version**: v1
**Authentication**: JWT Bearer tokens with optional MFA

## Architecture & Security

### Server Configuration
- **Framework**: Express.js with TypeScript
- **Security**: CORS, security headers, input sanitization, SQL injection protection
- **Rate Limiting**: Redis-based with role-based dynamic limits
- **Monitoring**: Health checks, logging, error handling
- **Body Parsing**: 10MB limit with webhook signature verification support

### Route Organization
All API endpoints are versioned under `/api/v1` except:
- Health endpoints: `/health/*`
- API documentation: `/api/docs`

## Rate Limiting Configuration

| Category | Window | Max Requests | Key Pattern |
|----------|--------|--------------|-------------|
| Global | 15 min | 1,000 | `user:{userId}` or `ip:{ip}` |
| Authentication | 15 min | 5 | `auth:{ip}` |
| Password Reset | 1 hour | 3 | `password_reset:{email}` |
| Donations | 1 hour | 10 | `donations:{userId}` |
| Admin Operations | 1 hour | 500 | `admin:{userId}` |
| File Uploads | 1 hour | 20 | `upload:{userId}` |
| Webhooks | 1 minute | 100 | `webhook:{source}` |
| Service Accounts | 1 hour | 10,000 | `service:{apiKey}` |

### Role-based Rate Limit Multipliers
- Super Admin: 10x base limit
- Compliance Officer: 5x base limit
- Organization Admin/Treasurer: 3x base limit
- Organization Staff/Viewer: 2x base limit
- Regular User: 1x base limit

## Authentication & Permissions

### Authentication Types
1. **Public**: No authentication required
2. **Optional**: `authenticate({ allowAnonymous: true })`
3. **Required**: `authenticate()`
4. **MFA Required**: `requireMFA`
5. **Role-based**: `requireAdmin`, `requireSuperAdmin`
6. **Permission-based**: `requirePermission('resource', 'action')`

### Permission System
Granular permissions for resources:
- `user`: read, update, verify, delete
- `organization`: read, create, update, delete, verify
- `fundraiser`: read, create, update, delete, export
- `event`: read, create, update, delete, export
- `donation`: read, create, update, cancel, refund, verify, review, flag, export
- `compliance_report`: read, create
- `analytics`: read
- `organization_user`: read, create, update, delete
- `disbursement`: read, request
- `location`: read, create

## Complete Endpoint Inventory

### 1. Authentication Routes (`/api/v1/auth`) - 19 Endpoints
**Rate Limit**: auth (5 req/15min)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | Public | User registration |
| POST | `/login` | Public | User authentication |
| POST | `/logout` | Public | User logout |
| POST | `/refresh` | Public | Token refresh |
| POST | `/forgot-password` | Public | Password reset request |
| POST | `/reset-password` | Public | Password reset confirmation |
| POST | `/mfa/setup` | Required | MFA setup initiation |
| POST | `/mfa/confirm-setup` | Required | MFA setup confirmation |
| POST | `/mfa/verify` | Public | MFA token verification |
| POST | `/mfa/disable` | Required + MFA | Disable MFA |
| POST | `/mfa/regenerate-backup-codes` | Required + MFA | Generate new backup codes |
| POST | `/change-password` | Required | Password change |
| GET | `/me` | Required | Current user info |
| GET | `/sessions` | Required | User sessions list |
| DELETE | `/sessions/:sessionId` | Required | Terminate specific session |
| DELETE | `/sessions` | Required | Terminate all sessions |
| POST | `/verify-email` | Required | Send email verification |
| GET | `/verify-email/:token` | Public | Verify email token |
| POST | `/verify-phone` | Required | Send phone verification |
| POST | `/verify-phone/confirm` | Required | Confirm phone verification |

### 2. User Routes (`/api/v1/users`) - 16 Endpoints
**Rate Limit**: global (1000 req/15min)

| Method | Endpoint | Auth | Permissions | Description |
|--------|----------|------|-------------|-------------|
| GET | `/me` | Required | - | Current user profile |
| PUT | `/me` | Required | - | Update own profile |
| DELETE | `/me` | Required | - | Delete own account |
| POST | `/me/verify` | Required | - | Request KYC verification |
| GET | `/me/verification-status` | Required | - | Get verification status |
| GET | `/me/donations` | Required | - | User donation history |
| GET | `/me/donations/summary` | Required | - | Donation summary stats |
| GET | `/me/organizations` | Required | - | User organizations |
| GET | `/` | Required | user:read | List all users (admin) |
| GET | `/search` | Required | admin | Search users |
| GET | `/:id` | Required | user:read | Get user by ID |
| PUT | `/:id` | Required | user:update | Update user |
| POST | `/:id/verify` | Required | user:verify | Verify user |
| POST | `/:id/suspend` | Required | admin | Suspend user |
| POST | `/:id/unsuspend` | Required | admin | Unsuspend user |
| DELETE | `/:id` | Required | super_admin | Delete user |
| GET | `/analytics/overview` | Required | admin | User analytics |
| GET | `/analytics/growth` | Required | admin | User growth analytics |

### 3. Organization Routes (`/api/v1/organizations`) - 24 Endpoints
**Rate Limit**: global (1000 req/15min)

| Method | Endpoint | Auth | Permissions | Description |
|--------|----------|------|-------------|-------------|
| GET | `/public` | Public | - | Public organizations |
| GET | `/public/:id` | Public | - | Public organization details |
| POST | `/` | Required | - | Create organization |
| GET | `/` | Required | - | User organizations |
| GET | `/:id` | Required | organization:read | Organization details |
| PUT | `/:id` | Required | organization:update | Update organization |
| DELETE | `/:id` | Required | organization:delete | Delete organization |
| POST | `/:id/verify` | Required | organization:verify | Verify organization |
| POST | `/:id/reject` | Required | organization:verify | Reject organization |
| POST | `/:id/suspend` | Required | admin | Suspend organization |
| GET | `/:id/users` | Required | organization_user:read | Organization members |
| POST | `/:id/users/invite` | Required | organization_user:create | Invite user |
| PUT | `/:id/users/:userId` | Required | organization_user:update | Update user role |
| DELETE | `/:id/users/:userId` | Required | organization_user:delete | Remove user |
| GET | `/:id/fundraisers` | Required | fundraiser:read | Organization fundraisers |
| GET | `/:id/donations` | Required | donation:read | Organization donations |
| GET | `/:id/donations/summary` | Required | donation:read | Donation summary |
| GET | `/:id/disbursements` | Required | disbursement:read | Disbursements |
| POST | `/:id/disbursements/request` | Required | disbursement:request | Request disbursement |
| GET | `/:id/compliance/reports` | Required | compliance_report:read | Compliance reports |
| POST | `/:id/compliance/reports` | Required | compliance_report:create | Generate compliance report |
| GET | `/:id/analytics/overview` | Required | analytics:read | Analytics overview |
| GET | `/:id/analytics/donations` | Required | analytics:read | Donation analytics |
| GET | `/:id/analytics/fundraisers` | Required | analytics:read | Fundraiser analytics |

### 4. Fundraiser Routes (`/api/v1/fundraisers`) - 32 Endpoints
**Rate Limit**: global (1000 req/15min)

| Method | Endpoint | Auth | Permissions | Description |
|--------|----------|------|-------------|-------------|
| GET | `/public` | Public | - | Active fundraisers |
| GET | `/public/:slug` | Public | - | Fundraiser by slug |
| GET | `/public/:slug/stats` | Public | - | Fundraiser statistics |
| GET | `/search` | Optional | - | Search fundraisers |
| POST | `/` | Required | fundraiser:create | Create fundraiser |
| GET | `/` | Required | - | User fundraisers |
| GET | `/:id` | Required | fundraiser:read | Fundraiser details |
| PUT | `/:id` | Required | fundraiser:update | Update fundraiser |
| DELETE | `/:id` | Required | fundraiser:delete | Delete fundraiser |
| POST | `/:id/activate` | Required | fundraiser:update | Activate fundraiser |
| POST | `/:id/pause` | Required | fundraiser:update | Pause fundraiser |
| POST | `/:id/complete` | Required | fundraiser:update | Complete fundraiser |
| GET | `/:id/donations` | Required | donation:read | Fundraiser donations |
| GET | `/:id/donations/summary` | Required | donation:read | Donation summary |
| GET | `/:id/donations/export` | Required | donation:export | Export donations |
| GET | `/:id/analytics/overview` | Required | analytics:read | Analytics overview |
| GET | `/:id/analytics/timeline` | Required | analytics:read | Timeline analytics |
| GET | `/:id/analytics/demographics` | Required | analytics:read | Demographic analytics |
| GET | `/:id/share-stats` | Required | fundraiser:read | Share statistics |
| POST | `/:id/share-links` | Required | fundraiser:read | Generate share links |
| GET | `/:id/updates` | Optional | - | Fundraiser updates |
| POST | `/:id/updates` | Required | fundraiser:update | Create update |
| PUT | `/:id/updates/:updateId` | Required | fundraiser:update | Update existing update |
| DELETE | `/:id/updates/:updateId` | Required | fundraiser:update | Delete update |
| POST | `/:id/media` | Required | fundraiser:update | Upload media |
| DELETE | `/:id/media/:mediaId` | Required | fundraiser:update | Delete media |
| GET | `/featured` | Public | - | Featured fundraisers |
| GET | `/trending` | Public | - | Trending fundraisers |
| GET | `/categories` | Public | - | Fundraiser categories |
| GET | `/tags` | Public | - | Available tags |

### 5. Event Routes (`/api/v1/events`) - 28 Endpoints
**Rate Limit**: global (1000 req/15min)

| Method | Endpoint | Auth | Permissions | Description |
|--------|----------|------|-------------|-------------|
| GET | `/public` | Public | - | Active events |
| GET | `/public/:slug` | Public | - | Event by slug |
| GET | `/public/:slug/stats` | Public | - | Event statistics |
| GET | `/search` | Optional | - | Search events |
| POST | `/` | Required | event:create | Create event |
| GET | `/` | Required | - | User events |
| GET | `/:id` | Required | event:read | Event details |
| PUT | `/:id` | Required | event:update | Update event |
| DELETE | `/:id` | Required | event:delete | Delete event |
| POST | `/:id/activate` | Required | event:update | Activate event |
| POST | `/:id/cancel` | Required | event:update | Cancel event |
| POST | `/:id/complete` | Required | event:update | Complete event |
| GET | `/:id/attendees` | Required | event:read | Event attendees |
| POST | `/:id/register` | Required | - | Register for event |
| DELETE | `/:id/register` | Required | - | Unregister from event |
| GET | `/:id/attendees/export` | Required | event:export | Export attendees |
| GET | `/:id/analytics/overview` | Required | analytics:read | Analytics overview |
| GET | `/:id/analytics/attendance` | Required | analytics:read | Attendance analytics |
| GET | `/:id/analytics/engagement` | Required | analytics:read | Engagement analytics |
| GET | `/:id/share-stats` | Required | event:read | Share statistics |
| POST | `/:id/share-links` | Required | event:read | Generate share links |
| GET | `/:id/updates` | Optional | - | Event updates |
| POST | `/:id/updates` | Required | event:update | Create update |
| PUT | `/:id/updates/:updateId` | Required | event:update | Update existing update |
| DELETE | `/:id/updates/:updateId` | Required | event:update | Delete update |
| GET | `/featured` | Public | - | Featured events |
| GET | `/trending` | Public | - | Trending events |
| GET | `/categories` | Public | - | Event categories |
| GET | `/types` | Public | - | Event types |
| GET | `/locations` | Required | location:read | Event locations |
| POST | `/locations` | Required | location:create | Create location |

### 6. Donation Routes (`/api/v1/donations`) - 25 Endpoints
**Rate Limit**: donations (10 req/hour)

| Method | Endpoint | Auth | Permissions | Description |
|--------|----------|------|-------------|-------------|
| POST | `/` | Optional | - | Create donation |
| GET | `/` | Required | - | User donations |
| GET | `/:id` | Required | donation:read | Donation details |
| POST | `/:id/cancel` | Required | donation:cancel | Cancel donation |
| POST | `/:id/refund` | Required | donation:refund | Refund donation |
| GET | `/recurring` | Required | - | Recurring donations |
| POST | `/:id/recurring/pause` | Required | donation:update | Pause recurring |
| POST | `/:id/recurring/resume` | Required | donation:update | Resume recurring |
| POST | `/:id/recurring/cancel` | Required | donation:cancel | Cancel recurring |
| PUT | `/:id/recurring/amount` | Required | donation:update | Update recurring amount |
| GET | `/:id/receipt` | Required | donation:read | Donation receipt |
| POST | `/:id/receipt/resend` | Required | donation:read | Resend receipt |
| GET | `/analytics/overview` | Required | analytics:read | Donation analytics |
| GET | `/analytics/trends` | Required | analytics:read | Donation trends |
| GET | `/analytics/demographics` | Required | analytics:read | Donor demographics |
| GET | `/analytics/payment-methods` | Required | analytics:read | Payment method analytics |
| GET | `/compliance/summary` | Required | compliance_report:read | Compliance summary |
| GET | `/export` | Required | donation:export | Export donations |
| GET | `/compliance/flagged` | Required | compliance_report:read | Flagged donations |
| POST | `/:id/compliance/flag` | Required | donation:flag | Flag donation |
| POST | `/:id/compliance/unflag` | Required | donation:flag | Unflag donation |
| POST | `/:id/verify` | Required | donation:verify | Verify donation |
| POST | `/:id/review` | Required | donation:review | Review donation |
| POST | `/bulk/refund` | Required | donation:refund | Bulk refund |
| POST | `/bulk/export` | Required | donation:export | Bulk export |
| GET | `/stats/recent` | Public | - | Recent donation stats |
| GET | `/stats/goals` | Public | - | Goal progress |

### 7. Admin Routes (`/api/v1/admin`) - 20 Endpoints
**Rate Limit**: admin (500 req/hour)
**Auth**: All routes require admin authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/organizations` | Create organization |
| GET | `/organizations` | List organizations |
| GET | `/organizations/:id` | Get organization |
| PUT | `/organizations/:id` | Update organization |
| DELETE | `/organizations/:id` | Delete organization |
| POST | `/users` | Create user |
| GET | `/users` | List users |
| GET | `/users/:id` | Get user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| POST | `/fundraisers` | Create fundraiser |
| GET | `/fundraisers` | List fundraisers |
| GET | `/fundraisers/:id` | Get fundraiser |
| PUT | `/fundraisers/:id` | Update fundraiser |
| DELETE | `/fundraisers/:id` | Delete fundraiser |
| POST | `/events` | Create event |
| GET | `/events` | List events |
| GET | `/events/:id` | Get event |
| PUT | `/events/:id` | Update event |
| DELETE | `/events/:id` | Delete event |
| GET | `/event-categories` | Get event categories |
| GET | `/event-types` | Get event types |
| GET | `/analytics/dashboard` | Admin dashboard analytics |

### 8. Webhook Routes (`/api/v1/webhooks`) - 11 Endpoints
**Rate Limit**: webhook (100 req/minute)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/fluidpay` | Signature | FluidPay payment webhooks |
| POST | `/system/user-verification` | API Key | User verification webhooks |
| POST | `/system/organization-verification` | API Key | Organization verification webhooks |
| POST | `/system/compliance-alert` | API Key | Compliance alert webhooks |
| POST | `/supabase/database-changes` | API Key | Supabase real-time webhooks |
| POST | `/email/sendgrid` | Signature | SendGrid email webhooks |
| POST | `/sms/twilio` | Signature | Twilio SMS webhooks |
| GET | `/status` | API Key | Webhook status |
| GET | `/logs` | API Key | Webhook logs |
| POST | `/test/:service` | API Key | Test webhook |

### 9. Health Routes (`/health`) - 4 Endpoints
**Rate Limit**: None

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Basic health check |
| GET | `/detailed` | Detailed health with dependencies |
| GET | `/live` | Kubernetes liveness probe |
| GET | `/ready` | Kubernetes readiness probe |

### 10. Development Routes (minimal-server.js) - 12 Endpoints
**Port**: 3001 (Development only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/organizations` | Get organizations |
| POST | `/api/v1/admin/organizations` | Create organization |
| GET | `/api/v1/admin/event-categories` | Get event categories |
| POST | `/api/v1/admin/users` | Create user |
| POST | `/api/v1/admin/fundraisers` | Create fundraiser |
| POST | `/api/v1/admin/events` | Create event |
| POST | `/api/v1/upload/signed-url` | Generate upload URL |
| GET | `/api/v1/fundraisers` | Get fundraisers |
| GET | `/api/v1/fundraisers/featured` | Get featured fundraisers |
| GET | `/api/v1/events` | Get events |
| GET | `/api/v1/events/featured` | Get featured events |
| GET | `/health` | Health check |

### 11. API Documentation Route - 1 Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | API documentation overview |

## Data Structures & Validation

### Common Request/Response Patterns

#### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

#### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Validation Requirements

#### Input Validation
- UUID validation for resource IDs
- Slug validation for public URLs
- Email format validation
- Phone number format validation
- Password strength requirements
- Input sanitization for XSS prevention

#### Request Size Limits
- JSON payload: 10MB maximum
- URL-encoded payload: 10MB maximum
- File uploads: Configurable per endpoint

## Security Features

### Security Headers
- CORS configuration
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

### Input Security
- SQL injection protection
- XSS prevention through sanitization
- Request size limiting
- Raw body storage for webhook signature verification

### Authentication Security
- JWT with refresh tokens
- Multi-factor authentication (TOTP)
- Session management
- Backup codes for MFA recovery
- Password reset flow with tokens
- Email and phone verification

## Integration Patterns

### External Service Integrations
1. **FluidPay**: Payment processing webhooks
2. **SendGrid**: Email service webhooks
3. **Twilio**: SMS service webhooks
4. **Supabase**: Database change notifications
5. **Redis**: Rate limiting and caching
6. **Google Cloud Storage**: File uploads (development URLs)

### Frontend Integration Points
- Public endpoints for unauthenticated content
- JWT authentication flow
- Real-time updates via webhooks
- File upload with signed URLs
- Comprehensive analytics endpoints
- Export functionality for reports

## Error Handling

### HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request (validation errors)
- 401: Unauthorized (authentication required)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 409: Conflict (duplicate resource)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error

### Error Codes
- `ENDPOINT_NOT_FOUND`: Route not found
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INTERNAL_ERROR`: Generic server error
- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_REQUIRED`: Auth token required
- `PERMISSION_DENIED`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `DUPLICATE_RESOURCE`: Resource already exists

## Development vs Production

### Development Environment
- Additional minimal server on port 3001
- Mock data storage in JSON files
- Simplified authentication
- Mock external service responses
- Enhanced logging and debugging

### Production Environment
- Full database integration
- Real external service integrations
- Production security headers
- Comprehensive error handling
- Performance monitoring
- Automated backups and recovery

## Summary

The Advotecate API provides a comprehensive platform for political donation management with:

- **179 total endpoints** across 11 functional areas
- **Robust security** with JWT, MFA, and granular permissions
- **Advanced rate limiting** with role-based dynamic limits
- **Public and authenticated** access patterns
- **Real-time webhook** integrations
- **Comprehensive analytics** and reporting
- **Development and production** environment support
- **Compliance and audit** trail functionality
- **Scalable architecture** with proper separation of concerns

The API is designed to support both web and mobile frontends, third-party integrations, and administrative interfaces while maintaining security, performance, and regulatory compliance standards required for political donation platforms.