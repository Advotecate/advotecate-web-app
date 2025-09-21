# FluidPay API Integration Framework

## Overview

Comprehensive integration framework for FluidPay API optimized for political donation processing, compliance tracking, and secure financial transactions.

## FluidPay API Architecture

### Authentication & Security

**API Authentication:**
```typescript
interface FluidPayConfig {
  apiKey: string; // Public key for client-side tokenization
  secretKey: string; // Secret key for server-side operations
  environment: 'sandbox' | 'production';
  webhookSecret: string; // For webhook signature verification
}

class FluidPayClient {
  private config: FluidPayConfig;
  private baseUrl: string;

  constructor(config: FluidPayConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'sandbox'
      ? 'https://sandbox-api.fluidpay.com'
      : 'https://api.fluidpay.com';
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new FluidPayError(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### Core Integration Services

#### 1. Customer Management Service

```typescript
interface FluidPayCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  metadata: {
    userId: string;
    kycStatus: string;
    complianceFlags: string[];
  };
}

class CustomerService {
  constructor(private fluidPay: FluidPayClient) {}

  async createCustomer(userData: UserData): Promise<FluidPayCustomer> {
    const customerData = {
      email: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone,
      address: {
        line1: userData.streetAddress,
        city: userData.city,
        state: userData.state,
        postal_code: userData.postalCode,
        country: userData.country || 'US'
      },
      metadata: {
        user_id: userData.id,
        kyc_status: userData.kycStatus,
        employer: userData.employer,
        occupation: userData.occupation
      }
    };

    const response = await this.fluidPay.makeRequest<FluidPayCustomer>(
      '/v1/customers',
      'POST',
      customerData
    );

    // Update user record with FluidPay customer ID
    await this.updateUserFluidPayId(userData.id, response.id);

    return response;
  }

  async updateCustomer(customerId: string, updates: Partial<UserData>): Promise<FluidPayCustomer> {
    return this.fluidPay.makeRequest<FluidPayCustomer>(
      `/v1/customers/${customerId}`,
      'PUT',
      this.transformUserToFluidPay(updates)
    );
  }

  async getCustomer(customerId: string): Promise<FluidPayCustomer> {
    return this.fluidPay.makeRequest<FluidPayCustomer>(
      `/v1/customers/${customerId}`,
      'GET'
    );
  }

  private async updateUserFluidPayId(userId: string, fluidPayId: string): Promise<void> {
    await db.users.update({
      where: { id: userId },
      data: { fluidpay_customer_id: fluidPayId }
    });
  }
}
```

#### 2. Payment Processing Service

```typescript
interface DonationRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethodToken;
  fundraiserId: string;
  organizationId: string;
  metadata: {
    isRecurring: boolean;
    recurringFrequency?: string;
    complianceData: ComplianceData;
  };
}

interface FluidPayTransaction {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  customer: string;
  paymentMethod: PaymentMethodDetails;
  createdAt: string;
  failureReason?: string;
  fees: {
    platformFee: number;
    processingFee: number;
  };
}

class PaymentService {
  constructor(
    private fluidPay: FluidPayClient,
    private compliance: ComplianceService
  ) {}

  async processDonation(request: DonationRequest): Promise<DonationResult> {
    // Pre-transaction compliance check
    const complianceCheck = await this.compliance.validateDonation({
      userId: request.customerId,
      amount: request.amount,
      organizationId: request.organizationId,
      fundraiserId: request.fundraiserId
    });

    if (!complianceCheck.isAllowed) {
      throw new ComplianceError(complianceCheck.reason);
    }

    // Process payment through FluidPay
    const transactionData = {
      amount: request.amount * 100, // Convert to cents
      currency: request.currency.toLowerCase(),
      customer: request.customerId,
      payment_method: request.paymentMethod.id,
      description: `Donation to ${request.organizationId}`,
      metadata: {
        fundraiser_id: request.fundraiserId,
        organization_id: request.organizationId,
        is_recurring: request.metadata.isRecurring.toString(),
        compliance_data: JSON.stringify(request.metadata.complianceData)
      }
    };

    try {
      const transaction = await this.fluidPay.makeRequest<FluidPayTransaction>(
        '/v1/payments',
        'POST',
        transactionData
      );

      // Create donation record in database
      const donation = await this.createDonationRecord({
        ...request,
        fluidPayTransactionId: transaction.id,
        status: this.mapFluidPayStatus(transaction.status),
        fees: transaction.fees
      });

      // Set up recurring payment if needed
      if (request.metadata.isRecurring) {
        await this.setupRecurringPayment(request, transaction.id);
      }

      return {
        donation,
        transaction,
        complianceCheck
      };

    } catch (error) {
      // Log failure and create failed donation record
      await this.createFailedDonationRecord(request, error.message);
      throw error;
    }
  }

  private async setupRecurringPayment(
    request: DonationRequest,
    parentTransactionId: string
  ): Promise<void> {
    const scheduleData = {
      customer: request.customerId,
      amount: request.amount * 100,
      currency: request.currency.toLowerCase(),
      interval: this.mapRecurringFrequency(request.metadata.recurringFrequency),
      payment_method: request.paymentMethod.id,
      metadata: {
        parent_transaction: parentTransactionId,
        fundraiser_id: request.fundraiserId,
        organization_id: request.organizationId,
        type: 'recurring_donation'
      }
    };

    await this.fluidPay.makeRequest('/v1/subscriptions', 'POST', scheduleData);
  }

  private mapFluidPayStatus(status: string): DonationStatus {
    const statusMap = {
      'pending': 'pending',
      'processing': 'processing',
      'succeeded': 'completed',
      'failed': 'failed'
    };
    return statusMap[status] || 'pending';
  }
}
```

#### 3. Webhook Handler Service

```typescript
interface FluidPayWebhook {
  id: string;
  type: string;
  data: {
    object: FluidPayTransaction | FluidPayCustomer | FluidPayRefund;
  };
  created: number;
}

class WebhookService {
  constructor(
    private fluidPay: FluidPayClient,
    private donationService: DonationService
  ) {}

  async handleWebhook(
    payload: string,
    signature: string
  ): Promise<WebhookResponse> {
    // Verify webhook signature
    if (!this.verifySignature(payload, signature)) {
      throw new WebhookError('Invalid webhook signature');
    }

    const webhook: FluidPayWebhook = JSON.parse(payload);

    switch (webhook.type) {
      case 'payment.succeeded':
        return this.handlePaymentSucceeded(webhook);

      case 'payment.failed':
        return this.handlePaymentFailed(webhook);

      case 'payment.refunded':
        return this.handlePaymentRefunded(webhook);

      case 'subscription.payment.succeeded':
        return this.handleRecurringPayment(webhook);

      case 'customer.updated':
        return this.handleCustomerUpdated(webhook);

      default:
        console.log(`Unhandled webhook type: ${webhook.type}`);
        return { status: 'ignored' };
    }
  }

  private async handlePaymentSucceeded(webhook: FluidPayWebhook): Promise<WebhookResponse> {
    const transaction = webhook.data.object as FluidPayTransaction;

    // Update donation status in database
    const donation = await db.donations.update({
      where: { fluidpay_transaction_id: transaction.id },
      data: {
        status: 'completed',
        completed_at: new Date(),
        net_amount: transaction.amount - transaction.fees.platformFee - transaction.fees.processingFee
      }
    });

    // Trigger compliance reporting if needed
    await this.compliance.processDonationComplete(donation);

    // Send confirmation emails
    await this.notificationService.sendDonationConfirmation(donation);

    return { status: 'processed', donationId: donation.id };
  }

  private async handlePaymentFailed(webhook: FluidPayWebhook): Promise<WebhookResponse> {
    const transaction = webhook.data.object as FluidPayTransaction;

    // Update donation status
    const donation = await db.donations.update({
      where: { fluidpay_transaction_id: transaction.id },
      data: {
        status: 'failed',
        failure_reason: transaction.failureReason
      }
    });

    // Send failure notification
    await this.notificationService.sendDonationFailure(donation);

    return { status: 'processed', donationId: donation.id };
  }

  private verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.fluidPay.config.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
```

#### 4. Disbursement Service

```typescript
interface DisbursementRequest {
  organizationId: string;
  amount: number;
  bankAccount: BankAccountDetails;
  description: string;
  metadata: {
    reportingPeriod: string;
    transactionIds: string[];
  };
}

class DisbursementService {
  constructor(private fluidPay: FluidPayClient) {}

  async initiateDisbursement(request: DisbursementRequest): Promise<Disbursement> {
    // Validate organization and amount
    const validation = await this.validateDisbursement(request);
    if (!validation.isValid) {
      throw new DisbursementError(validation.reason);
    }

    // Create transfer request
    const transferData = {
      amount: request.amount * 100, // Convert to cents
      currency: 'usd',
      destination: request.bankAccount.id,
      description: request.description,
      metadata: {
        organization_id: request.organizationId,
        reporting_period: request.metadata.reportingPeriod,
        transaction_count: request.metadata.transactionIds.length.toString()
      }
    };

    const transfer = await this.fluidPay.makeRequest(
      '/v1/transfers',
      'POST',
      transferData
    );

    // Create disbursement record
    const disbursement = await db.disbursements.create({
      data: {
        organization_id: request.organizationId,
        amount: request.amount,
        status: 'pending',
        method: 'ach',
        external_transaction_id: transfer.id,
        reference_number: this.generateReferenceNumber(),
        memo: request.description,
        created_by: 'system' // or actual user ID
      }
    });

    return disbursement;
  }

  async getDisbursementStatus(disbursementId: string): Promise<DisbursementStatus> {
    const disbursement = await db.disbursements.findUnique({
      where: { id: disbursementId }
    });

    if (!disbursement.external_transaction_id) {
      return { status: disbursement.status, estimatedArrival: null };
    }

    // Check status with FluidPay
    const transfer = await this.fluidPay.makeRequest(
      `/v1/transfers/${disbursement.external_transaction_id}`,
      'GET'
    );

    // Update local record if status changed
    if (transfer.status !== disbursement.status) {
      await db.disbursements.update({
        where: { id: disbursementId },
        data: { status: transfer.status }
      });
    }

    return {
      status: transfer.status,
      estimatedArrival: transfer.estimated_arrival,
      fees: transfer.fees
    };
  }

  private generateReferenceNumber(): string {
    return `DISB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Error Handling & Retry Logic

### FluidPay Error Types

```typescript
class FluidPayError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

class RetryableError extends FluidPayError {
  constructor(message: string, code: string, statusCode: number) {
    super(message, code, statusCode, true);
  }
}

class RateLimitError extends RetryableError {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded', 'rate_limit', 429);
  }
}
```

### Retry Strategy Implementation

```typescript
class RetryHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (error instanceof FluidPayError && !error.retryable) {
          throw error; // Don't retry non-retryable errors
        }

        if (attempt === maxRetries) {
          throw error; // Max retries reached
        }

        const delay = this.calculateDelay(attempt, baseDelay, error);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number, baseDelay: number, error: Error): number {
    if (error instanceof RateLimitError) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return exponentialDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Testing Framework

### Mock FluidPay Service

```typescript
class MockFluidPayService implements FluidPayClient {
  private mockData: Map<string, any> = new Map();

  async createCustomer(data: any): Promise<any> {
    const customer = {
      id: `cust_${Date.now()}`,
      ...data,
      created: Math.floor(Date.now() / 1000)
    };
    this.mockData.set(customer.id, customer);
    return customer;
  }

  async processPayment(data: any): Promise<any> {
    // Simulate different scenarios based on test data
    if (data.amount === 99999) {
      throw new FluidPayError('Card declined', 'card_declined', 402);
    }

    if (data.amount === 88888) {
      throw new RateLimitError(60); // Rate limited, retry after 60 seconds
    }

    const transaction = {
      id: `txn_${Date.now()}`,
      amount: data.amount,
      status: 'succeeded',
      ...data
    };

    // Simulate processing delay
    setTimeout(() => {
      this.triggerWebhook('payment.succeeded', transaction);
    }, 1000);

    return transaction;
  }

  private triggerWebhook(type: string, data: any): void {
    // Simulate webhook delivery in test environment
    const webhook = {
      id: `evt_${Date.now()}`,
      type,
      data: { object: data },
      created: Math.floor(Date.now() / 1000)
    };

    // In real tests, this would call your webhook handler
    console.log('Mock webhook triggered:', webhook);
  }
}
```

### Integration Tests

```typescript
describe('FluidPay Integration', () => {
  let paymentService: PaymentService;
  let mockFluidPay: MockFluidPayService;

  beforeEach(() => {
    mockFluidPay = new MockFluidPayService();
    paymentService = new PaymentService(mockFluidPay, mockComplianceService);
  });

  test('successful donation processing', async () => {
    const donationRequest = {
      amount: 100,
      currency: 'USD',
      customerId: 'cust_test123',
      paymentMethod: { id: 'pm_test456' },
      fundraiserId: 'fund_test789',
      organizationId: 'org_test101',
      metadata: {
        isRecurring: false,
        complianceData: {
          employer: 'Test Corp',
          occupation: 'Developer'
        }
      }
    };

    const result = await paymentService.processDonation(donationRequest);

    expect(result.donation.status).toBe('completed');
    expect(result.transaction.amount).toBe(10000); // In cents
    expect(result.complianceCheck.isAllowed).toBe(true);
  });

  test('handles payment failures gracefully', async () => {
    const donationRequest = {
      amount: 999.99, // Special amount that triggers failure
      // ... other fields
    };

    await expect(paymentService.processDonation(donationRequest))
      .rejects
      .toThrow('Card declined');

    // Verify failed donation record was created
    const failedDonation = await db.donations.findFirst({
      where: { status: 'failed' }
    });
    expect(failedDonation).toBeTruthy();
  });
});
```

## Monitoring & Observability

### Performance Metrics

```typescript
class FluidPayMetrics {
  private metrics = {
    apiCalls: 0,
    failures: 0,
    retries: 0,
    averageResponseTime: 0,
    webhookLatency: 0
  };

  recordAPICall(duration: number, success: boolean): void {
    this.metrics.apiCalls++;
    if (!success) this.metrics.failures++;

    // Update average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.apiCalls - 1) + duration)
      / this.metrics.apiCalls;
  }

  recordRetry(): void {
    this.metrics.retries++;
  }

  recordWebhookLatency(latency: number): void {
    this.metrics.webhookLatency = latency;
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
}
```

### Health Checks

```typescript
class FluidPayHealthCheck {
  constructor(private fluidPay: FluidPayClient) {}

  async checkHealth(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await this.fluidPay.makeRequest('/v1/health', 'GET');
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date()
      };
    }
  }
}
```

## Configuration Management

### Environment Configuration

```typescript
interface FluidPayEnvironment {
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
  endpoints: {
    api: string;
    webhooks: string;
  };
  limits: {
    maxRetries: number;
    timeoutMs: number;
    rateLimitRpm: number;
  };
}

const config: Record<string, FluidPayEnvironment> = {
  development: {
    apiKey: process.env.FLUIDPAY_SANDBOX_API_KEY!,
    secretKey: process.env.FLUIDPAY_SANDBOX_SECRET_KEY!,
    webhookSecret: process.env.FLUIDPAY_SANDBOX_WEBHOOK_SECRET!,
    environment: 'sandbox',
    endpoints: {
      api: 'https://sandbox-api.fluidpay.com',
      webhooks: 'https://sandbox-webhooks.fluidpay.com'
    },
    limits: {
      maxRetries: 3,
      timeoutMs: 30000,
      rateLimitRpm: 100
    }
  },
  production: {
    apiKey: process.env.FLUIDPAY_PROD_API_KEY!,
    secretKey: process.env.FLUIDPAY_PROD_SECRET_KEY!,
    webhookSecret: process.env.FLUIDPAY_PROD_WEBHOOK_SECRET!,
    environment: 'production',
    endpoints: {
      api: 'https://api.fluidpay.com',
      webhooks: 'https://webhooks.fluidpay.com'
    },
    limits: {
      maxRetries: 5,
      timeoutMs: 60000,
      rateLimitRpm: 500
    }
  }
};
```

This comprehensive FluidPay integration framework provides secure, compliant, and scalable payment processing for your political donation platform with proper error handling, monitoring, and testing capabilities.