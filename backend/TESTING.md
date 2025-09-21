# Testing Guide - Advotecate Backend

Complete testing strategy for the FluidPay integration and all backend services.

## 🧪 Testing Strategy

### Test Pyramid
```
                /\
               /  \
              / E2E \     <- End-to-End Tests (Few, High Confidence)
             /______\
            /        \
           /Integration\ <- Integration Tests (Some, Medium Confidence)
          /__________\
         /            \
        /   Unit Tests  \  <- Unit Tests (Many, Fast Feedback)
       /________________\
```

## 🚀 Quick Testing Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests for specific service
npm run test -- --testPathPattern=userService

# Run tests in CI mode
npm run test:ci
```

## 🛠️ Test Environment Setup

### 1. Database Setup
```bash
# Create test database
createdb advotecate_test

# Set test environment
export NODE_ENV=test
export TEST_DATABASE_URL=postgresql://test:test@localhost:5432/advotecate_test
```

### 2. FluidPay Test Configuration
```bash
# Add to .env.test
FLUIDPAY_API_KEY=test_pk_test_123456
FLUIDPAY_API_SECRET=test_sk_test_789012
FLUIDPAY_WEBHOOK_SECRET=whsec_test_345678
FLUIDPAY_SANDBOX_URL=https://sandbox-api.fluidpay.com/v1
```

### 3. Mock Services
```bash
# Enable mocking in tests
ENABLE_MOCK_PAYMENTS=true
ENABLE_EMAIL_MOCK=true
```

## 🔬 Unit Tests

### Service Layer Tests

#### UserService Tests
```typescript
// tests/services/userService.test.ts
describe('UserService', () => {
  beforeEach(async () => {
    await testUtils.cleanup();
  });

  describe('registerUser', () => {
    it('should register valid user', async () => {
      const result = await userService.registerUser(validUserData);
      expect(result.success).toBe(true);
      expect(result.user?.email).toBe(validUserData.email);
    });

    it('should reject duplicate email', async () => {
      await userService.registerUser(validUserData);
      const result = await userService.registerUser(validUserData);
      expect(result.success).toBe(false);
    });
  });
});
```

#### FluidPay Service Tests
```typescript
// tests/services/fluidpay/donationService.test.ts
describe('DonationService', () => {
  let mockClient: jest.Mocked<FluidPayClient>;

  beforeEach(() => {
    mockClient = createMockFluidPayClient();
  });

  it('should process donation successfully', async () => {
    mockClient.createTransaction.mockResolvedValue({
      success: true,
      data: mockTransaction
    });

    const result = await donationService.processDonation(donationRequest);

    expect(result.success).toBe(true);
    expect(mockClient.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: donationRequest.amount,
        currency: 'USD'
      })
    );
  });
});
```

### Repository Tests
```typescript
// tests/repositories/userRepository.test.ts
describe('UserRepository', () => {
  it('should create user with correct data', async () => {
    const user = await userRepository.create(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
  });

  it('should find user by email', async () => {
    const created = await userRepository.create(userData);
    const found = await userRepository.findByEmail(userData.email);
    expect(found?.id).toBe(created.id);
  });
});
```

## 🔗 Integration Tests

### Database Integration
```typescript
// tests/integration/database.test.ts
describe('Database Integration', () => {
  it('should connect to database successfully', async () => {
    const dbService = DatabaseService.getInstance();
    const result = await dbService.healthCheck();
    expect(result).toBe(true);
  });

  it('should handle transactions correctly', async () => {
    const dbService = DatabaseService.getInstance();

    await dbService.transaction(async (client) => {
      await client.query('INSERT INTO users (email) VALUES ($1)', ['test@example.com']);
      const result = await client.query('SELECT * FROM users WHERE email = $1', ['test@example.com']);
      expect(result.rows).toHaveLength(1);
    });
  });
});
```

### FluidPay Integration
```typescript
// tests/integration/fluidpay.test.ts
describe('FluidPay Integration', () => {
  it('should initialize FluidPay services', async () => {
    const config = createFluidPayConfig('sandbox');
    const factory = FluidPayServiceFactory.getInstance();

    await expect(factory.initialize(config)).resolves.toBeDefined();
    expect(factory.isInitialized()).toBe(true);
  });

  it('should process test donation end-to-end', async () => {
    const donationRequest = createTestDonationRequest();
    const donationService = factory.getDonationService();

    // This would use sandbox API
    const result = await donationService.processDonation(donationRequest);
    expect(result.success).toBe(true);
  });
});
```

### API Integration Tests
```typescript
// tests/integration/api.test.ts
describe('API Integration', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(async () => {
    app = new AdvotecateServer().getApp();
    authToken = await getTestAuthToken();
  });

  describe('POST /api/v1/donations', () => {
    it('should create donation successfully', async () => {
      const response = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validDonationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.donation).toBeDefined();
    });

    it('should validate donation data', async () => {
      const response = await request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Invalid data
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## 🌐 End-to-End Tests

### Complete User Journey
```typescript
// tests/e2e/donationFlow.test.ts
describe('Complete Donation Flow', () => {
  it('should handle complete donation journey', async () => {
    // 1. User registration
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(testUserData);

    const token = registerResponse.body.data.token;

    // 2. Create organization
    const orgResponse = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send(testOrgData);

    // 3. Create fundraiser
    const fundraiserResponse = await request(app)
      .post('/api/v1/fundraisers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...testFundraiserData,
        organizationId: orgResponse.body.data.organization.id
      });

    // 4. Process donation
    const donationResponse = await request(app)
      .post('/api/v1/donations')
      .send({
        fundraiserId: fundraiserResponse.body.data.fundraiser.id,
        amount: 10000, // $100.00
        donorInfo: testDonorInfo,
        paymentMethod: testPaymentMethod
      });

    expect(donationResponse.status).toBe(201);
    expect(donationResponse.body.data.donation.status).toBe('succeeded');
  });
});
```

### Webhook Processing Test
```typescript
// tests/e2e/webhooks.test.ts
describe('Webhook Processing', () => {
  it('should process FluidPay webhook correctly', async () => {
    // Create test donation first
    const donation = await createTestDonation();

    // Simulate FluidPay webhook
    const webhookPayload = {
      type: 'transaction.succeeded',
      data: {
        object: {
          id: donation.transactionId,
          amount: donation.amount,
          status: 'succeeded'
        }
      }
    };

    const signature = generateTestWebhookSignature(webhookPayload);

    const response = await request(app)
      .post('/api/v1/webhooks/fluidpay')
      .set('X-FluidPay-Signature', signature)
      .send(webhookPayload);

    expect(response.status).toBe(200);

    // Verify donation was updated
    const updatedDonation = await donationRepository.findById(donation.id);
    expect(updatedDonation?.status).toBe('succeeded');
  });
});
```

## 🎯 Test Utilities & Fixtures

### Test Data Factory
```typescript
// tests/utils/testDataFactory.ts
export class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };
  }

  static createOrganization(overrides = {}) {
    return {
      name: `Test Organization ${Date.now()}`,
      type: 'campaign' as const,
      description: 'Test organization for testing',
      ...overrides
    };
  }

  static createDonationRequest(overrides = {}) {
    return {
      amount: 10000, // $100.00
      fundraiserId: 'test-fundraiser-id',
      donorInfo: {
        email: 'donor@example.com',
        firstName: 'Test',
        lastName: 'Donor',
        phone: '+1234567890',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          country: 'US'
        }
      },
      paymentMethod: {
        type: 'card' as const,
        card: {
          number: '4111111111111111',
          exp_month: '12',
          exp_year: '2025',
          cvc: '123',
          name: 'Test Donor'
        }
      },
      ...overrides
    };
  }
}
```

### Mock Services
```typescript
// tests/mocks/fluidpayMock.ts
export function createMockFluidPayClient(): jest.Mocked<FluidPayClient> {
  return {
    createCustomer: jest.fn(),
    createPaymentMethod: jest.fn(),
    createTransaction: jest.fn(),
    createRecurringPayment: jest.fn(),
    createRefund: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true)
  } as any;
}

export function mockSuccessfulTransaction(transactionId = 'txn_test_123') {
  return {
    success: true,
    data: {
      id: transactionId,
      amount: 10000,
      currency: 'USD',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000)
    }
  };
}
```

## 🔄 Continuous Integration

### GitHub Actions Configuration
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: advotecate_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type checking
        run: npm run type-check

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit
        env:
          NODE_ENV: test
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/advotecate_test

      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/advotecate_test
          FLUIDPAY_API_KEY: ${{ secrets.FLUIDPAY_TEST_API_KEY }}
          FLUIDPAY_API_SECRET: ${{ secrets.FLUIDPAY_TEST_API_SECRET }}

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Package.json Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:unit": "jest --testPathPattern=tests/services --testPathPattern=tests/repositories",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e --runInBand",
    "test:fluidpay": "jest --testPathPattern=fluidpay",
    "test:debug": "jest --runInBand --detectOpenHandles"
  }
}
```

## 🧹 Test Maintenance

### Database Cleanup
```typescript
// tests/utils/cleanup.ts
export async function cleanupDatabase() {
  const db = DatabaseService.getInstance();

  // Clean in reverse dependency order
  await db.query('DELETE FROM donations WHERE donor_email LIKE $1', ['%test%']);
  await db.query('DELETE FROM fundraisers WHERE slug LIKE $1', ['test-%']);
  await db.query('DELETE FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
  await db.query('DELETE FROM organizations WHERE slug LIKE $1', ['test-%']);
  await db.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
}
```

### Performance Testing
```typescript
// tests/performance/load.test.ts
describe('Performance Tests', () => {
  it('should handle multiple concurrent donations', async () => {
    const promises = Array.from({ length: 10 }, () =>
      request(app)
        .post('/api/v1/donations')
        .set('Authorization', `Bearer ${token}`)
        .send(testDonationData)
    );

    const responses = await Promise.all(promises);

    responses.forEach(response => {
      expect(response.status).toBe(201);
    });
  });
});
```

## 🎯 Test Coverage Goals

### Coverage Thresholds
- **Overall**: 80% minimum
- **Business Services**: 90% minimum
- **Controllers**: 85% minimum
- **FluidPay Services**: 95% minimum
- **Database Layer**: 80% minimum

### Critical Test Areas
1. **Payment Processing**: All donation flows
2. **Authentication**: User registration/login
3. **FEC Compliance**: Contribution limits and validation
4. **Webhook Processing**: All FluidPay events
5. **Error Handling**: All error scenarios
6. **Security**: Authentication and authorization

## 🐛 Testing Best Practices

### 1. Test Structure
- **Arrange**: Set up test data
- **Act**: Execute the code under test
- **Assert**: Verify the results

### 2. Test Isolation
- Each test should be independent
- Clean up after each test
- Use fresh test data

### 3. Mock External Services
- Mock FluidPay API calls in unit tests
- Use sandbox environment for integration tests
- Verify mock interactions

### 4. Error Testing
- Test all error conditions
- Verify error messages and codes
- Test edge cases and boundary conditions

### 5. Performance Considerations
- Keep unit tests fast (<100ms)
- Use database transactions for isolation
- Run expensive tests separately

This comprehensive testing strategy ensures your FluidPay integration is robust, reliable, and ready for production deployment.