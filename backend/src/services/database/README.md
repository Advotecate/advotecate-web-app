# Database Service

Flexible database abstraction layer supporting both PostgreSQL and Supabase with TypeScript safety, connection pooling, and repository pattern implementation.

## 🏗️ Architecture Overview

```typescript
DatabaseService
├── Connection Management    # PostgreSQL/Supabase connection handling
├── Query Execution         # Parameterized queries with type safety
├── Transaction Support     # ACID compliant transactions
├── Repository Pattern      # Generic CRUD operations
├── Health Monitoring       # Connection status and performance
└── Migration System        # Schema versioning and updates
```

## 🚀 Quick Start

### Initialization
```typescript
import { DatabaseService, createDatabaseConfig } from './services/database';

// Auto-detect configuration from environment
const config = createDatabaseConfig();
const db = DatabaseService.initialize(config);

// Connect to database
await db.connect();
```

### Environment Configuration
```bash
# Option A: PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/advotecate_dev
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Option B: Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📊 Database Schema

### Core Tables

```sql
-- Users and authentication
users                     # User accounts and profiles
organization_members      # User-organization relationships with RBAC

-- Organizations and campaigns
organizations            # Political organizations/campaigns
fundraisers             # Individual fundraising campaigns

-- Financial transactions
donations               # Political contributions (partitioned by month)
disbursements          # Campaign expenditures
compliance_reports     # FEC and state reporting

-- System and audit
audit_logs             # Complete audit trail (partitioned by month)
```

### Data Types & Relationships

```typescript
// Core entity types
User: {
  id: string (UUID)
  email: string (unique)
  role: 'super_admin' | 'org_admin' | 'org_treasurer' | 'org_staff' | 'org_viewer' | 'donor' | 'compliance_officer'
  verification_level: 'none' | 'email' | 'phone' | 'address' | 'full'
  // ... additional fields
}

Organization: {
  id: string (UUID)
  organization_type: 'campaign' | 'pac' | 'super_pac' | 'nonprofit' | 'political_party'
  status: 'active' | 'suspended' | 'pending_verification' | 'banned'
  // ... compliance and contact fields
}

Donation: {
  id: string (UUID)
  amount: number (cents)
  compliance_status: 'compliant' | 'requires_review' | 'flagged' | 'blocked'
  fec_reportable: boolean
  // ... donor and payment details
}
```

## 🔧 Database Service API

### Core DatabaseService Class

```typescript
class DatabaseService {
  // Connection management
  static initialize(config: DatabaseConfig): DatabaseService
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  async healthCheck(): Promise<HealthCheckResult>

  // Query execution
  async query<T>(sql: string, params?: any[], options?: QueryOptions): Promise<DatabaseResult<T>>
  async transaction<T>(callback: TransactionCallback<T>): Promise<T>

  // Helper methods
  async findById<T>(table: string, id: string, columns?: string[]): Promise<T | null>
  async findMany<T>(table: string, whereClause?: string, params?: any[]): Promise<T[]>
  async insert<T>(table: string, data: Record<string, any>): Promise<T>
  async update<T>(table: string, id: string, data: Record<string, any>): Promise<T>
  async delete(table: string, id: string): Promise<boolean>
  async count(table: string, whereClause?: string, params?: any[]): Promise<number>
}
```

### Configuration Factory

```typescript
// Auto-detect database type from environment
const config = createDatabaseConfig();
// Returns PostgreSQL config if DATABASE_URL is set
// Returns Supabase config if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set

// Manual configuration
const postgresConfig: DatabaseConfig = {
  type: 'postgresql',
  postgresql: {
    connectionString: 'postgresql://user:pass@localhost:5432/db',
    maxConnections: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  }
};

const supabaseConfig: DatabaseConfig = {
  type: 'supabase',
  supabase: {
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-role-key'
  }
};
```

## 🗃️ Repository Pattern

### Base Repository

```typescript
abstract class BaseRepository<T, CreateData, UpdateData, Filters> {
  // CRUD operations
  async findById(id: string): Promise<T | null>
  async findMany(filters?: Filters, pagination?: PaginationOptions): Promise<PaginatedResult<T>>
  async create(data: CreateData): Promise<T>
  async update(id: string, data: UpdateData): Promise<T>
  async delete(id: string): Promise<boolean>
  async count(filters?: Filters): Promise<number>
  async exists(id: string): Promise<boolean>

  // Custom queries
  async query<R>(sql: string, params?: any[]): Promise<DatabaseResult<R>>

  // Abstract methods (implement in subclasses)
  protected abstract buildWhereClause(filters: Filters): { whereClause: string; params: any[] }
}
```

### Repository Implementation Example

```typescript
class UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData, UserFilters> {
  constructor() {
    super('users');
  }

  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    const result = await this.query<User>(`
      SELECT u.* FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      WHERE om.organization_id = $1 AND om.status = 'active'
    `, [organizationId]);

    return result.rows;
  }

  // Filter implementation
  protected buildWhereClause(filters: UserFilters): { whereClause: string; params: any[] } {
    let whereClause = '1=1';
    const params: any[] = [];

    if (filters.email) {
      const result = this.addLikeCondition(whereClause, params, 'email', filters.email);
      whereClause = result.whereClause;
      params.push(...result.params);
    }

    if (filters.role) {
      const result = this.addAndCondition(whereClause, params, 'role = ?', filters.role);
      whereClause = result.whereClause;
      params.push(...result.params);
    }

    if (filters.status) {
      const result = this.addAndCondition(whereClause, params, 'status = ?', filters.status);
      whereClause = result.whereClause;
      params.push(...result.params);
    }

    if (filters.created_after || filters.created_before) {
      const result = this.addDateRangeCondition(
        whereClause, params, 'created_at',
        filters.created_after, filters.created_before
      );
      whereClause = result.whereClause;
      params.push(...result.params);
    }

    return { whereClause, params };
  }
}
```

## 🔍 Query Building Helpers

### Filter Helpers
```typescript
// Base repository provides query building helpers
protected addAndCondition(whereClause: string, params: any[], condition: string, value: any)
protected addInCondition(whereClause: string, params: any[], column: string, values: any[])
protected addDateRangeCondition(whereClause: string, params: any[], column: string, start?: string, end?: string)
protected addLikeCondition(whereClause: string, params: any[], column: string, value?: string)
protected addNumericRangeCondition(whereClause: string, params: any[], column: string, min?: number, max?: number)
```

### Usage Examples
```typescript
// Complex filtering with pagination
const userFilters: UserFilters = {
  role: 'donor',
  status: 'active',
  verification_level: 'full',
  created_after: '2024-01-01',
  email: 'john'
};

const pagination: PaginationOptions = {
  page: 1,
  per_page: 20,
  sort_by: 'created_at',
  sort_order: 'desc'
};

const result = await userRepository.findMany(userFilters, pagination);
// Returns: PaginatedResult<User> with data and pagination metadata
```

## 📄 Pagination System

### Pagination Interface
```typescript
interface PaginationOptions {
  page?: number;           // Page number (1-based)
  per_page?: number;       // Items per page (max 100)
  sort_by?: string;        // Column to sort by
  sort_order?: 'asc' | 'desc'; // Sort direction
}

interface PaginatedResult<T> {
  data: T[];               // Array of results
  pagination: {
    page: number;          // Current page
    per_page: number;      // Items per page
    total: number;         // Total item count
    total_pages: number;   // Total page count
    has_next: boolean;     // Has next page
    has_prev: boolean;     // Has previous page
  };
}
```

### Example Usage
```typescript
// Get second page of donations with 50 items per page
const result = await donationRepository.findMany(
  { organization_id: 'org_123' },
  {
    page: 2,
    per_page: 50,
    sort_by: 'created_at',
    sort_order: 'desc'
  }
);

console.log(`Showing ${result.data.length} of ${result.pagination.total} total donations`);
console.log(`Page ${result.pagination.page} of ${result.pagination.total_pages}`);
```

## 🔒 Transaction Management

### Simple Transactions
```typescript
const result = await db.transaction(async (query) => {
  // Create user
  const user = await query(
    'INSERT INTO users (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING *',
    ['user@example.com', 'John', 'Doe']
  );

  // Create organization membership
  await query(
    'INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)',
    [user.rows[0].id, 'org_123', 'member']
  );

  return user.rows[0];
});
```

### Complex Business Transactions
```typescript
async createDonationWithUpdates(donationData: CreateDonationData): Promise<Donation> {
  return await this.db.transaction(async (query) => {
    // Create donation record
    const donation = await query<Donation>(
      'INSERT INTO donations (...) VALUES (...) RETURNING *',
      [/* donation data */]
    );

    // Update fundraiser totals
    await query(
      'UPDATE fundraisers SET current_amount = current_amount + $1, donor_count = donor_count + 1 WHERE id = $2',
      [donationData.amount, donationData.fundraiser_id]
    );

    // Create audit log
    await query(
      'INSERT INTO audit_logs (action, resource_type, resource_id, new_values) VALUES ($1, $2, $3, $4)',
      ['create', 'donation', donation.rows[0].id, JSON.stringify(donation.rows[0])]
    );

    return donation.rows[0];
  });
}
```

## 🏥 Health Monitoring

### Health Check Response
```typescript
interface HealthCheckResult {
  connected: boolean;        // Connection status
  type: string;             // 'postgresql' | 'supabase'
  response_time_ms?: number; // Query response time
  error?: string;           // Error message if unhealthy
}

// Usage
const health = await db.healthCheck();
if (!health.connected) {
  console.error(`Database unhealthy: ${health.error}`);
}
```

### Connection Pool Monitoring (PostgreSQL)
```typescript
// Pool status monitoring
const pool = db.getClient() as Pool;
console.log({
  totalCount: pool.totalCount,     // Total connections
  idleCount: pool.idleCount,       // Idle connections
  waitingCount: pool.waitingCount  // Queued requests
});
```

## 🔧 Type Safety & Validation

### Generated Types
```typescript
// Auto-generated from database schema
interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  // ... all fields typed
  created_at: string;
  updated_at: string;
}

// Create/Update types (omit generated fields)
type CreateUserData = Omit<User, 'id' | 'created_at' | 'updated_at'>;
type UpdateUserData = Partial<Omit<User, 'id' | 'email' | 'created_at' | 'updated_at'>>;
```

### Query Type Safety
```typescript
// Typed query results
const users = await db.query<User>('SELECT * FROM users WHERE active = $1', [true]);
users.rows.forEach(user => {
  console.log(user.email); // TypeScript knows this exists
});

// Repository methods are fully typed
const user: User | null = await userRepository.findById('user_123');
const newUser: User = await userRepository.create({
  email: 'user@example.com',
  password_hash: 'hashed_password',
  // TypeScript enforces required fields
});
```

## 🧪 Testing & Development

### Test Configuration
```typescript
// Test database configuration
const testConfig: DatabaseConfig = {
  type: 'postgresql',
  postgresql: {
    connectionString: 'postgresql://test_user:test_pass@localhost:5432/advotecate_test',
    maxConnections: 5
  }
};

const testDb = DatabaseService.initialize(testConfig);
```

### Repository Testing
```typescript
describe('UserRepository', () => {
  let userRepository: UserRepository;
  let testDb: DatabaseService;

  beforeAll(async () => {
    testDb = DatabaseService.initialize(testConfig);
    await testDb.connect();
    userRepository = new UserRepository(testDb);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await testDb.query('TRUNCATE TABLE users CASCADE');
  });

  it('should create and find user', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'User',
      // ... other required fields
    };

    const user = await userRepository.create(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);

    const foundUser = await userRepository.findById(user.id);
    expect(foundUser).toEqual(user);
  });
});
```

## ⚡ Performance Optimization

### Connection Pooling
```typescript
// PostgreSQL pool configuration
const config: DatabaseConfig = {
  type: 'postgresql',
  postgresql: {
    connectionString: process.env.DATABASE_URL,
    maxConnections: 20,        // Max pool size
    idleTimeoutMillis: 30000,  // Close idle connections
    connectionTimeoutMillis: 5000 // Connection timeout
  }
};
```

### Query Optimization
```typescript
// Use specific column selection
const users = await db.findMany('users', 'active = $1', [true], ['id', 'email', 'first_name']);

// Efficient counting with filters
const activeUserCount = await db.count('users', 'status = $1', ['active']);

// Batch operations
const userIds = ['user1', 'user2', 'user3'];
const users = await db.query<User>(
  'SELECT * FROM users WHERE id = ANY($1)',
  [userIds]
);
```

### Indexing Strategy
```sql
-- Core indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_donations_org_created ON donations(organization_id, created_at DESC);
CREATE INDEX idx_donations_donor ON donations(donor_email, created_at DESC);
CREATE INDEX idx_donations_compliance ON donations(compliance_status, fec_reportable);
```

## 🛡️ Security Features

### SQL Injection Prevention
```typescript
// Always use parameterized queries
const user = await db.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, 'active'] // Parameters are properly escaped
);

// Repository pattern enforces safe queries
const users = await userRepository.findMany({
  email: userEmail,  // Safely handled by buildWhereClause
  status: 'active'
});
```

### Data Sanitization
```typescript
// Sensitive data is automatically sanitized in logs
const sensitiveUser = {
  email: 'user@example.com',
  password_hash: 'secret_hash',
  mfa_secret: 'secret_key'
};

// Logs will show: { email: 'user@example.com', password_hash: '[REDACTED]', mfa_secret: '[REDACTED]' }
await userRepository.create(sensitiveUser);
```

### Access Control
```typescript
// Database-level permissions
GRANT SELECT, INSERT, UPDATE ON users TO advotecate_app;
GRANT DELETE ON audit_logs TO advotecate_admin;
REVOKE ALL ON sensitive_table FROM public;
```

## 🔄 Migration System

### Migration Files
```sql
-- 001_create_users.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();
```

### Migration Commands
```bash
# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create add_user_preferences

# Check migration status
npm run migrate:status
```

---

## 🎯 Best Practices

### Repository Design
- Keep repositories focused on data access only
- Use typed interfaces for all operations
- Implement proper error handling and logging
- Use transactions for multi-table operations
- Cache frequently accessed data appropriately

### Query Performance
- Use specific column selection instead of SELECT *
- Implement proper indexing strategy
- Use LIMIT clauses for large result sets
- Monitor slow queries and optimize as needed
- Use connection pooling for production deployments

### Security
- Always use parameterized queries
- Implement proper access controls at database level
- Sanitize sensitive data in logs
- Use read-only connections where appropriate
- Regularly audit database access patterns

### Error Handling
- Implement comprehensive error logging
- Use meaningful error messages
- Handle connection failures gracefully
- Implement retry logic for transient failures
- Monitor database health continuously