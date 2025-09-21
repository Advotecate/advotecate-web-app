# Advotecate Backend API

A secure, compliant political donation platform backend built with Express.js, TypeScript, and PostgreSQL/Supabase.

## 🏗️ Architecture Overview

```
backend/
├── src/
│   ├── controllers/          # HTTP request handlers
│   ├── middleware/          # Express middleware (auth, validation, security)
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic and external integrations
│   │   ├── database/       # Database connection and repositories
│   │   └── fluidpay/      # Payment processing integration
│   ├── auth/              # Authentication and authorization
│   ├── config/            # Application configuration
│   └── server.ts          # Express server setup
├── database/
│   └── migrations/        # PostgreSQL schema migrations
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ OR Supabase account
- Redis 6+
- FluidPay sandbox account

### Installation
```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure your .env file (see Configuration section)

# Start development stack
docker-compose up -d  # Starts PostgreSQL + Redis
npm run dev          # Starts the API server
```

### Environment Configuration
```bash
# Database (choose one)
DATABASE_URL=postgresql://user:pass@localhost:5432/advotecate_dev
# OR
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# FluidPay Integration
FLUIDPAY_API_KEY=your-sandbox-api-key
FLUIDPAY_SECRET_KEY=your-sandbox-secret
FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
FLUIDPAY_ENVIRONMENT=sandbox

# Security
JWT_ACCESS_SECRET=generate-strong-secret-32-chars+
JWT_REFRESH_SECRET=generate-different-strong-secret
ENCRYPTION_KEY=32-byte-encryption-key

# Redis
REDIS_URL=redis://localhost:6379
```

## 📊 Database Schema

### Core Tables
- **users** - User accounts and profiles
- **organizations** - Political organizations/campaigns
- **organization_members** - User-organization relationships with roles
- **fundraisers** - Individual fundraising campaigns
- **donations** - Political contributions (partitioned by month)
- **disbursements** - Campaign expenditures
- **compliance_reports** - FEC and state reporting
- **audit_logs** - Complete audit trail (partitioned by month)

### Migration System
```bash
# Run migrations
npm run migrate:up

# Rollback migrations
npm run migrate:down

# Create new migration
npm run migrate:create migration_name
```

## 🔐 Authentication & Authorization

### JWT Token System
- **Access Tokens**: 15-minute expiry, contains user claims
- **Refresh Tokens**: 30-day expiry, stored in Redis
- **MFA Support**: TOTP (Google Authenticator) with backup codes

### Role-Based Access Control (RBAC)
```typescript
Roles:
├── super_admin       # Platform administration
├── org_admin        # Organization full access
├── org_treasurer    # Financial management
├── org_staff        # Limited organization access
├── org_viewer       # Read-only organization access
├── donor           # Donation and profile management
└── compliance_officer # Compliance monitoring
```

### Middleware Stack
```typescript
// Example protected route
router.get('/donations',
  authenticate(),                    // JWT validation
  requirePermission('donation', 'read'), // RBAC check
  validatePaginationQuery,          // Input validation
  donationController.getDonations   // Business logic
);
```

## 💳 FluidPay Integration

### Service Architecture
```typescript
FluidPayServiceFactory
├── FluidPayClient          # HTTP API client
├── DonationService         # Donation processing
├── RecurringPaymentService # Subscription management
├── RefundService          # Refund processing
├── WebhookService         # Event handling
├── PaymentValidationService # Compliance validation
└── ComplianceService      # FEC reporting
```

### Payment Flow
1. **Validation** - FEC compliance, fraud detection, payment method validation
2. **Processing** - Create FluidPay customer and transaction
3. **Compliance** - Contribution limit checking, verification requirements
4. **Confirmation** - Receipt generation, database updates
5. **Webhooks** - Async status updates and notifications

### Compliance Features
- **FEC Contribution Limits**: $3,300 per individual per election cycle
- **Verification Requirements**: Address collection for $200+ donations
- **Blocked Entity Screening**: OFAC and prohibited source checking
- **Audit Trail**: Complete transaction and modification history

## 🗃️ Database Service

### Connection Management
```typescript
// Auto-detects PostgreSQL or Supabase from environment
const dbConfig = createDatabaseConfig();
const db = DatabaseService.initialize(dbConfig);
await db.connect();
```

### Repository Pattern
```typescript
// Base repository with generic CRUD operations
class UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData> {
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }
}
```

### Query Features
- **Type-Safe Queries**: Full TypeScript support
- **Pagination**: Built-in with metadata
- **Filtering**: Complex where clauses
- **Transactions**: ACID compliance
- **Health Monitoring**: Connection status and performance

## 🛡️ Security Features

### Middleware Protection
```typescript
// Security headers (Helmet.js)
// CORS configuration
// Rate limiting (Redis-based)
// Input validation (Zod schemas)
// SQL injection prevention
// XSS protection
// Security scanning
```

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **Hashing**: bcrypt for passwords, HMAC for webhooks
- **Sanitization**: Input cleaning and validation
- **Audit Logging**: All actions tracked with context

## 📡 API Endpoints

### Authentication Routes
```typescript
POST /api/auth/register      # User registration
POST /api/auth/login         # User login
POST /api/auth/logout        # User logout
POST /api/auth/refresh       # Token refresh
POST /api/auth/mfa/setup     # MFA configuration
POST /api/auth/forgot-password # Password reset
```

### User Management
```typescript
GET    /api/users/me         # Current user profile
PUT    /api/users/me         # Update profile
GET    /api/users            # List users (admin)
GET    /api/users/:id        # Get user by ID
PUT    /api/users/:id        # Update user (admin)
DELETE /api/users/:id        # Delete user (admin)
```

### Organizations
```typescript
POST   /api/organizations    # Create organization
GET    /api/organizations    # List organizations
GET    /api/organizations/:id # Get organization
PUT    /api/organizations/:id # Update organization
POST   /api/organizations/:id/members # Add member
GET    /api/organizations/:id/reports # Compliance reports
```

### Donations & Payments
```typescript
POST   /api/donations        # Create donation
GET    /api/donations        # List donations
GET    /api/donations/:id    # Get donation details
POST   /api/donations/:id/refund # Process refund
GET    /api/donations/analytics # Donation analytics
POST   /api/webhooks/fluidpay # FluidPay webhooks
```

## 🧪 Testing & Development

### Testing Stack
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage

# Load testing
npm run test:load
```

### Development Tools
```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Database migrations
npm run migrate:up
```

## 🔄 Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://prod-connection
FLUIDPAY_ENVIRONMENT=production
```

### Docker Deployment
```bash
# Build production image
docker build -t advotecate-backend .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up
```

## 📊 Monitoring & Observability

### Logging
- **Structured Logging**: Winston with JSON format
- **Log Levels**: Error, warn, info, debug
- **Context Tracking**: Request IDs, user context, performance metrics
- **Security Events**: Authentication, authorization, suspicious activity

### Health Checks
```typescript
GET /api/health        # Basic health check
GET /api/health/ready  # Readiness probe (dependencies)
GET /api/health/live   # Liveness probe (app status)
```

## 📋 Compliance & Regulations

### FEC Compliance
- **Individual Limits**: $3,300 per election cycle monitoring
- **Reporting Requirements**: Quarterly and special reports
- **Itemization**: $200+ donations require full details
- **Verification**: Address and employment information collection

### Data Handling
- **Audit Trail**: All changes tracked and timestamped
- **Data Retention**: Configurable retention policies
- **Access Control**: Role-based data access
- **Encryption**: PII encrypted at rest and in transit

## 🔧 Configuration Reference

### Required Environment Variables
```bash
# Database
DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

# FluidPay
FLUIDPAY_API_KEY
FLUIDPAY_SECRET_KEY
FLUIDPAY_WEBHOOK_SECRET

# Security
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
ENCRYPTION_KEY

# Infrastructure
REDIS_URL
NODE_ENV
PORT
```

### Optional Configuration
```bash
# Email notifications
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

# Rate limiting
RATE_LIMIT_WINDOW_MINUTES=60
RATE_LIMIT_MAX_REQUESTS=1000

# Database tuning
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

## 📚 Development Guidelines

### Code Organization
- **Controllers**: HTTP request/response handling only
- **Services**: Business logic and external API integration
- **Repositories**: Data access layer abstraction
- **Middleware**: Cross-cutting concerns (auth, validation, security)

### TypeScript Standards
- **Strict Mode**: Full type safety enabled
- **Interface Definitions**: All data structures typed
- **Error Handling**: Typed errors with proper context
- **Async/Await**: Consistent promise handling

### Security Best Practices
- **Input Validation**: All inputs validated with Zod
- **SQL Injection Prevention**: Parameterized queries only
- **Authentication**: JWT with secure defaults
- **Authorization**: Role-based access control
- **Audit Logging**: All sensitive operations logged

---

## 📞 Support & Contribution

### Getting Help
- **Documentation**: Comprehensive inline code documentation
- **Examples**: Working examples in `/examples` directory
- **Troubleshooting**: Common issues and solutions in docs

### Contributing
- **Code Style**: ESLint + Prettier configuration
- **Testing**: Unit tests required for all business logic
- **Documentation**: Update docs with new features
- **Security**: Security review required for sensitive changes