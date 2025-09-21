# Testing Strategy & Implementation

## Overview

Comprehensive testing strategy for the political donation platform ensuring reliability, security, compliance, and performance across all components with automated testing pipelines and quality gates.

## Testing Pyramid

```mermaid
graph TD
    A[E2E Tests] --> B[Integration Tests]
    B --> C[Unit Tests]

    A1[Payment Flows<br/>Compliance Scenarios<br/>User Journeys] --> A
    B1[API Endpoints<br/>Database Operations<br/>External Integrations] --> B
    C1[Business Logic<br/>Utilities<br/>Components] --> C

    style A fill:#ff6b6b
    style B fill:#4ecdc4
    style C fill:#45b7d1
```

### Testing Distribution
- **Unit Tests (70%)**: Fast, isolated tests for business logic
- **Integration Tests (20%)**: API and database interaction tests
- **End-to-End Tests (10%)**: Critical user journey validation

## Unit Testing Framework

### Backend Unit Tests (Jest + TypeScript)

```typescript
// tests/unit/services/donation.service.test.ts
import { DonationService } from '../../../src/services/donation.service';
import { ComplianceService } from '../../../src/services/compliance.service';
import { FluidPayService } from '../../../src/services/fluidpay.service';
import { DatabaseService } from '../../../src/services/database.service';

// Mock external dependencies
jest.mock('../../../src/services/compliance.service');
jest.mock('../../../src/services/fluidpay.service');
jest.mock('../../../src/services/database.service');

describe('DonationService', () => {
  let donationService: DonationService;
  let mockComplianceService: jest.Mocked<ComplianceService>;
  let mockFluidPayService: jest.Mocked<FluidPayService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockComplianceService = new ComplianceService() as jest.Mocked<ComplianceService>;
    mockFluidPayService = new FluidPayService({} as any) as jest.Mocked<FluidPayService>;
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;

    donationService = new DonationService(
      mockComplianceService,
      mockFluidPayService,
      mockDatabaseService
    );
  });

  describe('processDonation', () => {
    const validDonationRequest = {
      fundraiserId: 'fundraiser-123',
      userId: 'user-456',
      amount: 100,
      paymentMethodId: 'pm-789',
      donorInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        employer: 'Tech Corp',
        occupation: 'Engineer'
      }
    };

    it('should successfully process a compliant donation', async () => {
      // Arrange
      mockComplianceService.validateDonation.mockResolvedValue({
        isAllowed: true,
        remainingLimit: 2800,
        warnings: []
      });

      mockFluidPayService.processPayment.mockResolvedValue({
        id: 'txn-123',
        status: 'succeeded',
        amount: 10000, // $100.00 in cents
        fees: { platform: 290, processing: 30 }
      });

      mockDatabaseService.createDonation.mockResolvedValue({
        id: 'donation-123',
        status: 'completed',
        amount: 100,
        netAmount: 97.20
      });

      // Act
      const result = await donationService.processDonation(validDonationRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.donation.amount).toBe(100);
      expect(result.donation.status).toBe('completed');

      expect(mockComplianceService.validateDonation).toHaveBeenCalledWith({
        userId: 'user-456',
        amount: 100,
        organizationId: expect.any(String)
      });

      expect(mockFluidPayService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
          paymentMethodId: 'pm-789'
        })
      );
    });

    it('should reject donations that violate compliance rules', async () => {
      // Arrange
      mockComplianceService.validateDonation.mockResolvedValue({
        isAllowed: false,
        reason: 'Exceeds annual contribution limit',
        remainingLimit: 0
      });

      // Act & Assert
      await expect(
        donationService.processDonation(validDonationRequest)
      ).rejects.toThrow('Exceeds annual contribution limit');

      expect(mockFluidPayService.processPayment).not.toHaveBeenCalled();
    });

    it('should handle payment processing failures gracefully', async () => {
      // Arrange
      mockComplianceService.validateDonation.mockResolvedValue({
        isAllowed: true,
        remainingLimit: 2800
      });

      mockFluidPayService.processPayment.mockRejectedValue(
        new Error('Card declined')
      );

      // Act & Assert
      await expect(
        donationService.processDonation(validDonationRequest)
      ).rejects.toThrow('Card declined');

      expect(mockDatabaseService.createDonation).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'Card declined'
        })
      );
    });

    it('should calculate fees correctly', async () => {
      // Arrange
      const donationAmount = 1000; // $1000
      const expectedPlatformFee = 29.00; // 2.9%
      const expectedProcessingFee = 0.30; // Fixed fee

      mockComplianceService.validateDonation.mockResolvedValue({
        isAllowed: true,
        remainingLimit: 1900
      });

      // Act
      const fees = donationService.calculateFees(donationAmount);

      // Assert
      expect(fees.platformFee).toBe(expectedPlatformFee);
      expect(fees.processingFee).toBe(expectedProcessingFee);
      expect(fees.total).toBe(expectedPlatformFee + expectedProcessingFee);
    });
  });

  describe('setupRecurringDonation', () => {
    it('should create recurring donation schedule', async () => {
      // Arrange
      const recurringRequest = {
        ...validDonationRequest,
        recurring: true,
        frequency: 'monthly'
      };

      mockFluidPayService.createSubscription.mockResolvedValue({
        id: 'sub-123',
        status: 'active',
        nextPaymentDate: '2024-02-01'
      });

      // Act
      const result = await donationService.setupRecurringDonation(recurringRequest);

      // Assert
      expect(result.subscriptionId).toBe('sub-123');
      expect(mockFluidPayService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: 'monthly',
          amount: 10000
        })
      );
    });
  });
});
```

### Frontend Unit Tests (Jest + React Testing Library)

```typescript
// tests/unit/components/donation-form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DonationForm } from '../../../src/components/donation/donation-form';
import { mockFundraiser, mockOrganization } from '../../fixtures/test-data';
import * as api from '../../../src/lib/api';

// Mock API calls
jest.mock('../../../src/lib/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Test wrapper with providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('DonationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders donation form with suggested amounts', () => {
    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Other amount')).toBeInTheDocument();
  });

  it('validates required donor information', async () => {
    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    // Select amount and try to submit without filling required fields
    fireEvent.click(screen.getByText('$100'));
    fireEvent.click(screen.getByRole('button', { name: /donate/i }));

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('shows compliance warnings for large donations', async () => {
    mockedApi.checkCompliance.mockResolvedValue({
      allowed: true,
      warnings: ['Employer information required for donations over $200'],
      disclosureRequired: true,
      remainingLimit: 2800
    });

    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    // Enter large donation amount
    const customAmountInput = screen.getByPlaceholderText('Other amount');
    fireEvent.change(customAmountInput, { target: { value: '500' } });

    // Fill in email to trigger compliance check
    const emailInput = screen.getByPlaceholderText('Email');
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });

    await waitFor(() => {
      expect(screen.getByText('Employer information required for donations over $200')).toBeInTheDocument();
    });
  });

  it('prevents donations that exceed compliance limits', async () => {
    mockedApi.checkCompliance.mockResolvedValue({
      allowed: false,
      reason: 'Exceeds annual contribution limit',
      remainingLimit: 0
    });

    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    const customAmountInput = screen.getByPlaceholderText('Other amount');
    fireEvent.change(customAmountInput, { target: { value: '3000' } });

    const emailInput = screen.getByPlaceholderText('Email');
    fireEvent.change(emailInput, { target: { value: 'maxed-donor@example.com' } });

    await waitFor(() => {
      expect(screen.getByText('Exceeds annual contribution limit')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /donate/i });
    expect(submitButton).toBeDisabled();
  });

  it('handles payment method selection', async () => {
    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    // Should show payment method selection
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Bank Transfer')).toBeInTheDocument();

    // Default to credit card
    expect(screen.getByLabelText('Credit Card')).toBeChecked();
  });

  it('submits donation with complete data', async () => {
    mockedApi.processDonation.mockResolvedValue({
      id: 'donation-123',
      status: 'completed',
      amount: 100
    });

    render(
      <DonationForm
        fundraiser={mockFundraiser}
        organization={mockOrganization}
      />,
      { wrapper: createTestWrapper() }
    );

    // Fill form
    fireEvent.click(screen.getByText('$100'));
    fireEvent.change(screen.getByPlaceholderText('First Name'), {
      target: { value: 'John' }
    });
    fireEvent.change(screen.getByPlaceholderText('Last Name'), {
      target: { value: 'Doe' }
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'john@example.com' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /donate \$100/i }));

    await waitFor(() => {
      expect(mockedApi.processDonation).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          donorInfo: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com'
          })
        })
      );
    });
  });
});
```

### Compliance Testing

```typescript
// tests/unit/services/compliance.test.ts
import { ComplianceService } from '../../../src/services/compliance.service';
import { DatabaseService } from '../../../src/services/database.service';

describe('ComplianceService', () => {
  let complianceService: ComplianceService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = {
      getUserContributions: jest.fn(),
      getOrganization: jest.fn(),
      getUser: jest.fn()
    } as any;

    complianceService = new ComplianceService(mockDatabaseService);
  });

  describe('validateFederalLimits', () => {
    it('should allow donations within federal limits', async () => {
      // Arrange
      mockDatabaseService.getUserContributions.mockResolvedValue([
        { amount: 1000, date: '2024-01-01', type: 'primary' },
        { amount: 500, date: '2024-02-01', type: 'general' }
      ]);

      // Act
      const result = await complianceService.validateFederalLimits(
        'user-123',
        'org-456',
        1000, // $1000 donation
        'primary'
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remainingLimit).toBe(2300); // $3300 - $1000 existing
    });

    it('should reject donations exceeding federal limits', async () => {
      // Arrange - user has already contributed $3000 in primary
      mockDatabaseService.getUserContributions.mockResolvedValue([
        { amount: 3000, date: '2024-01-01', type: 'primary' }
      ]);

      // Act
      const result = await complianceService.validateFederalLimits(
        'user-123',
        'org-456',
        500, // Trying to donate $500 more
        'primary'
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('federal contribution limit');
    });

    it('should handle separate primary and general election limits', async () => {
      // Arrange - user maxed out primary but not general
      mockDatabaseService.getUserContributions.mockResolvedValue([
        { amount: 3300, date: '2024-01-01', type: 'primary' }
      ]);

      // Act - donate to general election
      const result = await complianceService.validateFederalLimits(
        'user-123',
        'org-456',
        1000,
        'general'
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remainingLimit).toBe(2300); // Full $3300 limit for general
    });
  });

  describe('validateProhibitedSources', () => {
    it('should reject foreign nationals', async () => {
      // Arrange
      mockDatabaseService.getUser.mockResolvedValue({
        id: 'user-123',
        citizenship: 'foreign',
        country: 'CA'
      });

      // Act
      const result = await complianceService.validateProhibitedSources('user-123');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Foreign nationals');
    });

    it('should reject federal contractors', async () => {
      // Arrange
      mockDatabaseService.getUser.mockResolvedValue({
        id: 'user-123',
        isFederalContractor: true
      });

      // Act
      const result = await complianceService.validateProhibitedSources('user-123');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('federal contractor');
    });

    it('should allow eligible citizens', async () => {
      // Arrange
      mockDatabaseService.getUser.mockResolvedValue({
        id: 'user-123',
        citizenship: 'citizen',
        isFederalContractor: false
      });

      // Act
      const result = await complianceService.validateProhibitedSources('user-123');

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkDisclosureRequirements', () => {
    it('should require disclosure for donations over $200', () => {
      const result = complianceService.checkDisclosureRequirements(250);

      expect(result.required).toBe(true);
      expect(result.requiredFields).toContain('employer');
      expect(result.requiredFields).toContain('occupation');
    });

    it('should not require disclosure for small donations', () => {
      const result = complianceService.checkDisclosureRequirements(50);

      expect(result.required).toBe(false);
      expect(result.requiredFields).toEqual([]);
    });

    it('should aggregate multiple donations for disclosure threshold', async () => {
      // Arrange - user has already donated $150 this year
      mockDatabaseService.getUserContributions.mockResolvedValue([
        { amount: 150, date: '2024-01-01' }
      ]);

      // Act - donating another $75 (total $225)
      const result = await complianceService.checkAggregateDisclosure(
        'user-123',
        'org-456',
        75
      );

      // Assert
      expect(result.required).toBe(true);
      expect(result.reason).toContain('aggregate contributions exceed');
    });
  });
});
```

## Integration Testing

### API Integration Tests

```typescript
// tests/integration/api/donations.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database';
import { createTestUser, createTestOrganization, createTestFundraiser } from '../../helpers/fixtures';

describe('Donations API', () => {
  let testUser: any;
  let testOrganization: any;
  let testFundraiser: any;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();

    // Create test data
    testUser = await createTestUser({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      kycStatus: 'verified'
    });

    testOrganization = await createTestOrganization({
      name: 'Test PAC',
      organizationType: 'pac',
      verificationStatus: 'verified'
    });

    testFundraiser = await createTestFundraiser({
      organizationId: testOrganization.id,
      title: 'Test Campaign',
      status: 'active',
      goalAmount: 10000
    });

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testPassword123'
      });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/donations', () => {
    it('should create a donation successfully', async () => {
      const donationData = {
        fundraiserId: testFundraiser.id,
        amount: 100,
        paymentMethod: {
          type: 'credit_card',
          token: 'test_token_123',
          last4: '4242'
        },
        donorInformation: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '90210',
          employer: 'Tech Corp',
          occupation: 'Engineer'
        }
      };

      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(donationData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        amount: 100,
        status: 'completed',
        fundraiserId: testFundraiser.id
      });

      expect(response.body.donorInformation.firstName).toBe('John');
    });

    it('should reject donation exceeding compliance limits', async () => {
      // First, create donations that approach the limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/donations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fundraiserId: testFundraiser.id,
            amount: 1000,
            paymentMethod: {
              type: 'credit_card',
              token: 'test_token_123'
            },
            donorInformation: {
              firstName: 'Max',
              lastName: 'Contributor',
              email: 'max@example.com',
              address: '456 Oak Ave',
              city: 'Springfield',
              state: 'NY',
              zipCode: '12345',
              employer: 'Big Corp',
              occupation: 'CEO'
            }
          });
      }

      // Now attempt donation that would exceed limit
      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fundraiserId: testFundraiser.id,
          amount: 500, // This would exceed the limit
          paymentMethod: {
            type: 'credit_card',
            token: 'test_token_123'
          },
          donorInformation: {
            firstName: 'Max',
            lastName: 'Contributor',
            email: 'max@example.com',
            address: '456 Oak Ave',
            city: 'Springfield',
            state: 'NY',
            zipCode: '12345'
          }
        })
        .expect(400);

      expect(response.body.title).toBe('Contribution Limit Exceeded');
      expect(response.body.detail).toContain('contribution limit');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/donations')
        .send({
          fundraiserId: testFundraiser.id,
          amount: 100
        })
        .expect(401);
    });

    it('should validate donation data', async () => {
      const response = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          amount: 100
        })
        .expect(400);

      expect(response.body.title).toBe('Validation Error');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'fundraiserId',
            message: expect.stringContaining('required')
          })
        ])
      );
    });
  });

  describe('GET /api/donations/{id}', () => {
    it('should retrieve donation details', async () => {
      // First create a donation
      const createResponse = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fundraiserId: testFundraiser.id,
          amount: 250,
          paymentMethod: {
            type: 'credit_card',
            token: 'test_token_456'
          },
          donorInformation: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            address: '789 Pine St',
            city: 'Somewhere',
            state: 'TX',
            zipCode: '75001',
            employer: 'Non-Profit Inc',
            occupation: 'Manager'
          }
        });

      const donationId = createResponse.body.id;

      // Then retrieve it
      const response = await request(app)
        .get(`/api/donations/${donationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: donationId,
        amount: 250,
        status: 'completed'
      });
    });

    it('should not allow access to other users donations', async () => {
      // Create another user
      const otherUser = await createTestUser({
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherAuthResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'testPassword123'
        });

      const otherToken = otherAuthResponse.body.accessToken;

      // Create donation with first user
      const donationResponse = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fundraiserId: testFundraiser.id,
          amount: 100,
          paymentMethod: { type: 'credit_card', token: 'test_token' },
          donorInformation: {
            firstName: 'First',
            lastName: 'User',
            email: 'first@example.com'
          }
        });

      // Try to access with other user
      await request(app)
        .get(`/api/donations/${donationResponse.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404); // Should appear as not found for security
    });
  });

  describe('GET /api/donations', () => {
    beforeEach(async () => {
      // Create several donations for pagination testing
      for (let i = 0; i < 25; i++) {
        await request(app)
          .post('/api/donations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fundraiserId: testFundraiser.id,
            amount: 50 + (i * 10),
            paymentMethod: { type: 'credit_card', token: 'test_token' },
            donorInformation: {
              firstName: 'Donor',
              lastName: `${i}`,
              email: `donor${i}@example.com`
            }
          });
      }
    });

    it('should paginate donations correctly', async () => {
      const response = await request(app)
        .get('/api/donations?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.donations).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: true,
        hasPrevious: false
      });
    });

    it('should filter donations by status', async () => {
      const response = await request(app)
        .get('/api/donations?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.donations.every((d: any) => d.status === 'completed')).toBe(true);
    });

    it('should filter donations by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/donations?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.donations.forEach((donation: any) => {
        const donationDate = new Date(donation.createdAt);
        expect(donationDate >= new Date(startDate)).toBe(true);
        expect(donationDate <= new Date(endDate)).toBe(true);
      });
    });
  });
});
```

### Database Integration Tests

```typescript
// tests/integration/database/donations.test.ts
import { Pool } from 'pg';
import { DonationRepository } from '../../../src/repositories/donation.repository';
import { setupTestDatabase, cleanupTestDatabase, getTestPool } from '../../helpers/database';

describe('DonationRepository', () => {
  let pool: Pool;
  let repository: DonationRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    pool = getTestPool();
    repository = new DonationRepository(pool);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await pool.end();
  });

  beforeEach(async () => {
    // Clear donations table before each test
    await pool.query('DELETE FROM donations');
  });

  describe('createDonation', () => {
    it('should create donation with all fields', async () => {
      const donationData = {
        fundraiserId: 'fundraiser-123',
        userId: 'user-456',
        organizationId: 'org-789',
        amount: 100.00,
        currency: 'USD',
        paymentMethodType: 'credit_card',
        donorEmployer: 'Tech Corp',
        donorOccupation: 'Engineer',
        fluidpayTransactionId: 'txn-123'
      };

      const donation = await repository.createDonation(donationData);

      expect(donation).toMatchObject({
        id: expect.any(String),
        fundraiserId: 'fundraiser-123',
        userId: 'user-456',
        amount: 100.00,
        status: 'pending',
        createdAt: expect.any(Date)
      });

      // Verify in database
      const { rows } = await pool.query(
        'SELECT * FROM donations WHERE id = $1',
        [donation.id]
      );

      expect(rows[0]).toMatchObject({
        fundraiser_id: 'fundraiser-123',
        user_id: 'user-456',
        amount: '100.00',
        donor_employer: 'Tech Corp',
        donor_occupation: 'Engineer'
      });
    });

    it('should enforce database constraints', async () => {
      const invalidData = {
        // Missing required fields
        amount: -100 // Invalid negative amount
      };

      await expect(
        repository.createDonation(invalidData as any)
      ).rejects.toThrow();
    });
  });

  describe('updateDonationStatus', () => {
    it('should update donation status and completion time', async () => {
      // Create initial donation
      const donation = await repository.createDonation({
        fundraiserId: 'fundraiser-123',
        userId: 'user-456',
        organizationId: 'org-789',
        amount: 100.00
      });

      // Update status
      const updated = await repository.updateDonationStatus(
        donation.id,
        'completed',
        { completedAt: new Date() }
      );

      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('getUserContributions', () => {
    beforeEach(async () => {
      // Create test donations for aggregation
      const donations = [
        {
          fundraiserId: 'fundraiser-1',
          userId: 'user-123',
          organizationId: 'org-456',
          amount: 500.00,
          status: 'completed',
          completedAt: new Date('2024-01-15')
        },
        {
          fundraiserId: 'fundraiser-2',
          userId: 'user-123',
          organizationId: 'org-456',
          amount: 750.00,
          status: 'completed',
          completedAt: new Date('2024-03-20')
        },
        {
          fundraiserId: 'fundraiser-1',
          userId: 'user-123',
          organizationId: 'org-456',
          amount: 1000.00,
          status: 'pending' // Should not be counted
        }
      ];

      for (const donation of donations) {
        await repository.createDonation(donation);
        if (donation.status === 'completed') {
          await repository.updateDonationStatus(
            (await repository.createDonation(donation)).id,
            'completed',
            { completedAt: donation.completedAt }
          );
        }
      }
    });

    it('should calculate total contributions for user to organization', async () => {
      const total = await repository.getUserContributions(
        'user-123',
        'org-456',
        2024
      );

      expect(total).toBe(1250.00); // $500 + $750, pending not counted
    });

    it('should respect year filter', async () => {
      // Add donation from previous year
      const oldDonation = await repository.createDonation({
        fundraiserId: 'fundraiser-1',
        userId: 'user-123',
        organizationId: 'org-456',
        amount: 300.00
      });

      await repository.updateDonationStatus(
        oldDonation.id,
        'completed',
        { completedAt: new Date('2023-12-01') }
      );

      const total2024 = await repository.getUserContributions(
        'user-123',
        'org-456',
        2024
      );

      const total2023 = await repository.getUserContributions(
        'user-123',
        'org-456',
        2023
      );

      expect(total2024).toBe(1250.00);
      expect(total2023).toBe(300.00);
    });
  });

  describe('getDonationsForCompliance', () => {
    it('should return donations requiring disclosure', async () => {
      // Create donations with different amounts
      const donations = [
        { amount: 50.00, status: 'completed' },
        { amount: 250.00, status: 'completed' }, // Requires disclosure
        { amount: 500.00, status: 'completed' }, // Requires disclosure
        { amount: 100.00, status: 'pending' } // Not completed
      ];

      for (const donationData of donations) {
        const donation = await repository.createDonation({
          fundraiserId: 'fundraiser-123',
          userId: 'user-456',
          organizationId: 'org-789',
          ...donationData
        });

        if (donationData.status === 'completed') {
          await repository.updateDonationStatus(
            donation.id,
            'completed',
            { completedAt: new Date() }
          );
        }
      }

      const disclosureDonations = await repository.getDonationsForCompliance(
        'org-789',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        200.00 // Disclosure threshold
      );

      expect(disclosureDonations).toHaveLength(2);
      expect(disclosureDonations.every(d => d.amount >= 200.00)).toBe(true);
      expect(disclosureDonations.every(d => d.status === 'completed')).toBe(true);
    });
  });
});
```

## End-to-End Testing

### E2E Test Setup (Playwright)

```typescript
// tests/e2e/donation-flow.spec.ts
import { test, expect, Page } from '@playwright/test';
import { setupE2EEnvironment, cleanupE2EEnvironment } from '../helpers/e2e-setup';

test.describe('Donation Flow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await setupE2EEnvironment();
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await cleanupE2EEnvironment();
    await page.close();
  });

  test('complete donation process with new donor', async () => {
    // Navigate to fundraiser page
    await page.goto('/donate/save-democracy-2024');

    // Verify fundraiser information is displayed
    await expect(page.locator('[data-testid="fundraiser-title"]')).toContainText('Save Democracy 2024');
    await expect(page.locator('[data-testid="organization-name"]')).toContainText('Citizens for Better Government');

    // Select donation amount
    await page.click('[data-testid="amount-100"]');
    await expect(page.locator('[data-testid="selected-amount"]')).toContainText('$100');

    // Fill donor information
    await page.fill('[data-testid="first-name"]', 'John');
    await page.fill('[data-testid="last-name"]', 'Doe');
    await page.fill('[data-testid="email"]', 'john.doe.e2e@example.com');
    await page.fill('[data-testid="phone"]', '555-123-4567');

    // Fill address
    await page.fill('[data-testid="address"]', '123 Main Street');
    await page.fill('[data-testid="city"]', 'Anytown');
    await page.selectOption('[data-testid="state"]', 'CA');
    await page.fill('[data-testid="zip"]', '90210');

    // Fill compliance information (required for $100+ donations)
    await page.fill('[data-testid="employer"]', 'Tech Corporation');
    await page.fill('[data-testid="occupation"]', 'Software Engineer');

    // Verify compliance check passes
    await expect(page.locator('[data-testid="compliance-status"]')).toContainText('✅');

    // Add payment method
    const cardFrame = page.frameLocator('[data-testid="card-element"] iframe');
    await cardFrame.fill('[data-testid="card-number"]', '4242424242424242');
    await cardFrame.fill('[data-testid="card-expiry"]', '12/25');
    await cardFrame.fill('[data-testid="card-cvc"]', '123');

    // Submit donation
    await page.click('[data-testid="donate-button"]');

    // Wait for processing
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();

    // Verify success page
    await expect(page).toHaveURL(/\/donate\/success/);
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Thank you for your donation!');
    await expect(page.locator('[data-testid="donation-amount"]')).toContainText('$100.00');
    await expect(page.locator('[data-testid="receipt-number"]')).toBeVisible();

    // Verify email receipt (mock email service)
    // In real implementation, check email delivery service
  });

  test('handles contribution limit validation', async () => {
    await page.goto('/donate/save-democracy-2024');

    // Use email of user who has already maxed out contributions
    await page.fill('[data-testid="email"]', 'maxed.donor@example.com');
    await page.fill('[data-testid="first-name"]', 'Max');
    await page.fill('[data-testid="last-name"]', 'Contributor');

    // Try to donate large amount that would exceed limit
    await page.fill('[data-testid="custom-amount"]', '2000');

    // Should show compliance warning
    await expect(page.locator('[data-testid="compliance-warning"]')).toContainText('exceeds contribution limit');

    // Donate button should be disabled
    await expect(page.locator('[data-testid="donate-button"]')).toBeDisabled();

    // Try smaller amount within remaining limit
    await page.fill('[data-testid="custom-amount"]', '100');

    // Should now be allowed
    await expect(page.locator('[data-testid="compliance-status"]')).toContainText('✅');
    await expect(page.locator('[data-testid="donate-button"]')).toBeEnabled();
  });

  test('recurring donation setup', async () => {
    await page.goto('/donate/save-democracy-2024');

    // Select recurring donation
    await page.check('[data-testid="recurring-checkbox"]');
    await page.selectOption('[data-testid="frequency-select"]', 'monthly');

    // Fill required information
    await page.click('[data-testid="amount-50"]');
    await page.fill('[data-testid="first-name"]', 'Jane');
    await page.fill('[data-testid="last-name"]', 'Smith');
    await page.fill('[data-testid="email"]', 'jane.smith.recurring@example.com');

    // Complete form and submit
    // ... (fill remaining required fields)

    await page.click('[data-testid="donate-button"]');

    // Verify recurring donation confirmation
    await expect(page).toHaveURL(/\/donate\/success/);
    await expect(page.locator('[data-testid="recurring-info"]')).toContainText('Monthly donation of $50.00');
    await expect(page.locator('[data-testid="next-payment"]')).toBeVisible();
  });

  test('payment failure handling', async () => {
    await page.goto('/donate/save-democracy-2024');

    // Fill form with test card that will be declined
    await page.click('[data-testid="amount-25"]');
    await page.fill('[data-testid="first-name"]', 'Declined');
    await page.fill('[data-testid="last-name"]', 'Card');
    await page.fill('[data-testid="email"]', 'declined.card@example.com');

    // Use card number that triggers decline
    const cardFrame = page.frameLocator('[data-testid="card-element"] iframe');
    await cardFrame.fill('[data-testid="card-number"]', '4000000000000002'); // Declined card

    await page.click('[data-testid="donate-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('card was declined');

    // Form should remain available for retry
    await expect(page.locator('[data-testid="donate-button"]')).toBeEnabled();

    // Try with valid card
    await cardFrame.fill('[data-testid="card-number"]', '4242424242424242');
    await page.click('[data-testid="donate-button"]');

    // Should now succeed
    await expect(page).toHaveURL(/\/donate\/success/);
  });

  test('anonymous donation option', async () => {
    await page.goto('/donate/save-democracy-2024');

    // Check anonymous donation option
    await page.check('[data-testid="anonymous-checkbox"]');

    await page.click('[data-testid="amount-75"]');

    // Should still require basic compliance information
    await page.fill('[data-testid="first-name"]', 'Anonymous');
    await page.fill('[data-testid="last-name"]', 'Donor');
    await page.fill('[data-testid="email"]', 'anonymous@example.com');

    // Complete donation
    await page.click('[data-testid="donate-button"]');

    await expect(page).toHaveURL(/\/donate\/success/);

    // Verify donation is marked as anonymous
    await expect(page.locator('[data-testid="anonymous-notice"]')).toContainText('This donation was made anonymously');
  });
});
```

### Performance Testing

```typescript
// tests/performance/load-test.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('donation form loads within performance budget', async ({ page }) => {
    // Start performance measurement
    await page.goto('/donate/save-democracy-2024');

    // Measure Time to Interactive (TTI)
    const tti = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const ttiEntry = entries.find(entry => entry.name === 'first-input');
          if (ttiEntry) {
            resolve(ttiEntry.startTime);
          }
        }).observe({ entryTypes: ['first-input'] });

        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });

    // TTI should be under 3 seconds
    expect(tti).toBeLessThan(3000);

    // Measure Largest Contentful Paint (LCP)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });

    // LCP should be under 2.5 seconds
    expect(lcp).toBeLessThan(2500);
  });

  test('API response times meet SLA', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get('/api/fundraisers/save-democracy-2024');

    const responseTime = Date.now() - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(500); // 500ms SLA
  });

  test('concurrent donation processing', async ({ browser }) => {
    const contexts = await Promise.all(
      Array.from({ length: 10 }, () => browser.newContext())
    );

    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );

    const startTime = Date.now();

    // Submit 10 concurrent donations
    await Promise.all(
      pages.map(async (page, index) => {
        await page.goto('/donate/save-democracy-2024');
        await page.click('[data-testid="amount-25"]');

        // Fill unique donor info
        await page.fill('[data-testid="email"]', `concurrent${index}@example.com`);
        await page.fill('[data-testid="first-name"]', `User${index}`);

        // Add payment method and submit
        // ... (payment details)

        await page.click('[data-testid="donate-button"]');
        await expect(page).toHaveURL(/\/donate\/success/);
      })
    );

    const totalTime = Date.now() - startTime;

    // All 10 donations should complete within 30 seconds
    expect(totalTime).toBeLessThan(30000);

    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });
});
```

## Test Data Management

### Test Fixtures

```typescript
// tests/helpers/fixtures.ts
import { faker } from '@faker-js/faker';
import { Pool } from 'pg';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kycStatus: string;
}

export interface TestOrganization {
  id: string;
  name: string;
  organizationType: string;
  verificationStatus: string;
}

export interface TestFundraiser {
  id: string;
  organizationId: string;
  title: string;
  status: string;
  goalAmount: number;
}

export class TestDataFactory {
  constructor(private pool: Pool) {}

  async createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const userData = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      passwordHash: 'hashed_password',
      streetAddress: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      employer: faker.company.name(),
      occupation: faker.person.jobTitle(),
      citizenshipStatus: 'citizen',
      kycStatus: 'verified',
      ...overrides
    };

    await this.pool.query(`
      INSERT INTO users (
        id, email, first_name, last_name, password_hash,
        street_address, city, state, postal_code,
        employer, occupation, citizenship_status, kyc_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      userData.id, userData.email, userData.firstName, userData.lastName,
      userData.passwordHash, userData.streetAddress, userData.city,
      userData.state, userData.postalCode, userData.employer,
      userData.occupation, userData.citizenshipStatus, userData.kycStatus
    ]);

    return userData;
  }

  async createOrganization(overrides: Partial<TestOrganization> = {}): Promise<TestOrganization> {
    const orgData = {
      id: faker.string.uuid(),
      name: faker.company.name() + ' PAC',
      legalName: faker.company.name() + ' Political Action Committee',
      organizationType: 'pac',
      email: faker.internet.email(),
      streetAddress: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      fecId: 'C' + faker.string.numeric(8),
      verificationStatus: 'verified',
      ...overrides
    };

    await this.pool.query(`
      INSERT INTO organizations (
        id, name, legal_name, organization_type, email,
        street_address, city, state, postal_code,
        fec_id, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      orgData.id, orgData.name, orgData.legalName, orgData.organizationType,
      orgData.email, orgData.streetAddress, orgData.city, orgData.state,
      orgData.postalCode, orgData.fecId, orgData.verificationStatus
    ]);

    return orgData;
  }

  async createFundraiser(overrides: Partial<TestFundraiser> = {}): Promise<TestFundraiser> {
    const fundraiserData = {
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(), // Should be provided in overrides
      title: faker.lorem.words(4),
      description: faker.lorem.paragraph(),
      slug: faker.helpers.slugify(faker.lorem.words(4)),
      goalAmount: faker.number.int({ min: 1000, max: 100000 }),
      startDate: faker.date.past(),
      endDate: faker.date.future(),
      status: 'active',
      ...overrides
    };

    await this.pool.query(`
      INSERT INTO fundraisers (
        id, organization_id, title, description, slug,
        goal_amount, start_date, end_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      fundraiserData.id, fundraiserData.organizationId, fundraiserData.title,
      fundraiserData.description, fundraiserData.slug, fundraiserData.goalAmount,
      fundraiserData.startDate, fundraiserData.endDate, fundraiserData.status
    ]);

    return fundraiserData;
  }

  async cleanup(): Promise<void> {
    // Clean up test data in reverse dependency order
    await this.pool.query('DELETE FROM donations WHERE id LIKE \'test-%\'');
    await this.pool.query('DELETE FROM fundraisers WHERE id LIKE \'test-%\'');
    await this.pool.query('DELETE FROM organizations WHERE id LIKE \'test-%\'');
    await this.pool.query('DELETE FROM users WHERE id LIKE \'test-%\'');
  }
}
```

## CI/CD Test Integration

### GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, staging, develop]
  pull_request:
    branches: [main, staging]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci

      - name: Run unit tests with coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: |
          npm run test:coverage
          cd frontend && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info,./frontend/coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: integration_test_db

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/integration_test_db
        run: npm run migrate

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/integration_test_db
          FLUIDPAY_API_URL: https://sandbox-api.fluidpay.com
          FLUIDPAY_SECRET_KEY: ${{ secrets.FLUIDPAY_TEST_SECRET_KEY }}
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: |
          npm run build
          cd frontend && npm run build

      - name: Start test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services

      - name: Run E2E tests
        env:
          BASE_URL: http://localhost:3000
          API_URL: http://localhost:8080
        run: npx playwright test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

      - name: Stop test environment
        if: always()
        run: docker-compose -f docker-compose.test.yml down

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Run load tests
        run: |
          npm install -g artillery
          artillery run tests/performance/load-test.yml
```

This comprehensive testing strategy ensures the political donation platform maintains high quality, security, and compliance standards through automated testing at all levels of the application stack.