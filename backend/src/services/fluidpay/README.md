# FluidPay Integration Service

Complete payment processing integration for political donations with FEC compliance and fraud prevention.

## 🏗️ Architecture Overview

```typescript
FluidPayServiceFactory
├── FluidPayClient              # HTTP API client with authentication
├── DonationService            # Donation processing workflow
├── RecurringPaymentService    # Subscription management
├── RefundService              # Refund processing and compliance
├── WebhookService             # Event handling and synchronization
├── PaymentValidationService   # Compliance and fraud detection
└── ComplianceService          # FEC reporting and alerts
```

## 🚀 Quick Start

### Initialization
```typescript
import { FluidPayServiceFactory, createFluidPayConfig } from './services/fluidpay';

// Initialize services
const config = createFluidPayConfig('sandbox');
const fluidPay = FluidPayServiceFactory.initialize(config);

// Access individual services
const donationService = fluidPay.getDonationService();
const webhookService = fluidPay.getWebhookService();
```

### Environment Configuration
```bash
FLUIDPAY_API_KEY=your-api-key
FLUIDPAY_API_SECRET=your-api-secret
FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
FLUIDPAY_ENVIRONMENT=sandbox  # or 'production'
FLUIDPAY_SANDBOX_URL=https://sandbox-api.fluidpay.com/v1
FLUIDPAY_PRODUCTION_URL=https://api.fluidpay.com/v1
```

## 💳 Core Services

### FluidPayClient (`client.ts`)

HTTP client with authentication, error handling, and rate limiting.

```typescript
class FluidPayClient {
  // Customer management
  async createCustomer(customer: FluidPayCustomer): Promise<FluidPayApiResponse<FluidPayCustomer>>
  async getCustomer(customerId: string): Promise<FluidPayApiResponse<FluidPayCustomer>>
  async updateCustomer(customerId: string, updates: Partial<FluidPayCustomer>): Promise<FluidPayApiResponse<FluidPayCustomer>>

  // Payment methods
  async createPaymentMethod(customerId: string, paymentMethod: FluidPayPaymentMethod): Promise<FluidPayApiResponse<FluidPayPaymentMethod>>
  async getPaymentMethods(customerId: string): Promise<FluidPayApiResponse<FluidPayPaymentMethod[]>>
  async deletePaymentMethod(customerId: string, paymentMethodId: string): Promise<FluidPayApiResponse<void>>

  // Transactions
  async createTransaction(transaction: FluidPayTransaction): Promise<FluidPayApiResponse<FluidPayTransaction>>
  async getTransaction(transactionId: string): Promise<FluidPayApiResponse<FluidPayTransaction>>
  async captureTransaction(transactionId: string, amount?: number): Promise<FluidPayApiResponse<FluidPayTransaction>>
  async cancelTransaction(transactionId: string): Promise<FluidPayApiResponse<FluidPayTransaction>>

  // Recurring payments
  async createRecurringPayment(recurringPayment: FluidPayRecurringPayment): Promise<FluidPayApiResponse<FluidPayRecurringPayment>>
  async pauseRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>>
  async resumeRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>>
  async cancelRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>>

  // Refunds
  async createRefund(refund: FluidPayRefund): Promise<FluidPayApiResponse<FluidPayRefund>>
  async getRefund(refundId: string): Promise<FluidPayApiResponse<FluidPayRefund>>

  // Security
  verifyWebhookSignature(payload: string, signature: string): boolean
  async healthCheck(): Promise<boolean>
}
```

**Features:**
- HMAC signature authentication
- Automatic request signing and timestamping
- Comprehensive error handling and logging
- Request/response interceptors
- Rate limiting and retry logic

### DonationService (`donationService.ts`)

End-to-end donation processing with FEC compliance.

```typescript
class DonationService {
  async processDonation(
    donationRequest: CreateDonationRequest,
    options?: ProcessPaymentOptions
  ): Promise<DonationResult>

  async getDonationStatus(donationId: string): Promise<DonationResult | null>
  async cancelDonation(donationId: string, reason?: string): Promise<boolean>
}
```

**Processing Flow:**
1. **Validation**: FEC limits, fraud detection, payment method validation
2. **Customer Creation**: Create or update FluidPay customer
3. **Payment Method**: Store payment method securely
4. **Transaction Processing**: One-time or recurring payment setup
5. **Compliance Checking**: Contribution limits, verification requirements
6. **Receipt Generation**: PDF receipt and email notifications

**FEC Compliance:**
- Individual contribution limit enforcement ($3,300)
- Address collection for donations $200+
- Employer/occupation information for large donations
- Aggregate contribution tracking
- Blocked entity screening

### RecurringPaymentService (`recurringService.ts`)

Subscription management with compliance monitoring.

```typescript
class RecurringPaymentService {
  async pauseRecurringPayment(recurringPaymentId: string, reason?: string): Promise<RecurringPaymentResult>
  async resumeRecurringPayment(recurringPaymentId: string): Promise<RecurringPaymentResult>
  async cancelRecurringPayment(recurringPaymentId: string, reason?: string): Promise<RecurringPaymentResult>
  async updateRecurringAmount(recurringPaymentId: string, newAmount: number): Promise<RecurringPaymentResult>
  async processRecurringPayments(): Promise<void>
}
```

**Features:**
- Flexible pause/resume functionality
- Amount updates with compliance re-validation
- Automated processing scheduling
- Failure handling and retry logic
- Donor notification system

### RefundService (`refundService.ts`)

Comprehensive refund processing with compliance reporting.

```typescript
class RefundService {
  async processRefund(refundRequest: RefundRequest): Promise<RefundResult>
  async processBulkRefunds(bulkRequest: BulkRefundRequest): Promise<BulkRefundResult>
  async getRefundStatus(refundId: string): Promise<FluidPayRefund | null>
}
```

**Refund Validation:**
- Transaction eligibility checking
- Time window validation (180-day limit)
- Amount validation against original transaction
- Existing refund amount checking
- Compliance impact assessment

**Bulk Operations:**
- Batch processing with rate limiting
- Individual result tracking
- Failure handling and partial success reporting
- Progress monitoring and notifications

### WebhookService (`webhookService.ts`)

Event-driven processing with comprehensive event handling.

```typescript
class WebhookService {
  async processWebhook(
    payload: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<WebhookProcessingResult>
}
```

**Supported Events:**
- `transaction.succeeded` - Payment completed successfully
- `transaction.failed` - Payment failed
- `transaction.canceled` - Payment canceled
- `transaction.refunded` - Refund processed
- `recurring_payment.succeeded` - Recurring payment processed
- `recurring_payment.failed` - Recurring payment failed
- `refund.succeeded` - Refund completed
- `refund.failed` - Refund failed
- `dispute.created` - Chargeback initiated

**Event Processing:**
1. Signature verification
2. Duplicate event detection
3. Event-specific handler execution
4. Database synchronization
5. Notification triggering
6. Error handling and retry

### PaymentValidationService (`validationService.ts`)

Multi-layered validation with fraud detection.

```typescript
class PaymentValidationService {
  async validateDonation(request: CreateDonationRequest): Promise<PaymentValidationResult>
  async validatePaymentMethod(paymentMethod: FluidPayPaymentMethod): Promise<ValidationResult>
}
```

**Validation Layers:**
1. **Basic Validation**: Required fields, format validation, business rules
2. **Compliance Validation**: FEC limits, verification requirements, prohibited sources
3. **Fraud Detection**: Risk scoring, velocity checks, geographic analysis
4. **Payment Method Validation**: Card verification, bank account validation

**Fraud Detection:**
- Email reputation checking
- Velocity analysis (frequency/amounts)
- Geographic risk assessment
- Payment method risk scoring
- Device fingerprinting integration points

### ComplianceService (`complianceService.ts`)

FEC reporting and compliance management.

```typescript
class ComplianceService {
  async createComplianceAlert(alertData: ComplianceAlert): Promise<ComplianceAlert>
  async checkContributionLimits(donorEmail: string, amount: number, organizationId: string): Promise<ContributionLimitResult>
  async generateFECReport(organizationId: string, reportType: string, periodStart: string, periodEnd: string): Promise<ComplianceReport>
  async getItemizedTransactions(organizationId: string, periodStart: string, periodEnd: string): Promise<FECItemizedTransaction[]>
}
```

**Compliance Features:**
- Real-time contribution limit monitoring
- Automated FEC report generation
- Compliance alert management
- Itemized transaction reporting
- Refund impact tracking

## 🔒 Security & Authentication

### API Authentication
```typescript
// HMAC signature generation
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(`${method}${url}${timestamp}${nonce}`)
  .digest('hex');

// Request headers
{
  'X-FP-API-Key': apiKey,
  'X-FP-Timestamp': timestamp,
  'X-FP-Nonce': nonce,
  'X-FP-Signature': signature
}
```

### Webhook Verification
```typescript
// Verify webhook signature
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(signature, 'hex'),
  Buffer.from(expectedSignature, 'hex')
);
```

## 📊 Types & Interfaces

### Core Types (`types.ts`)

```typescript
interface FluidPayConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
}

interface CreateDonationRequest {
  amount: number;
  currency: string;
  fundraiser_id: string;
  donor_info: DonorInfo;
  payment_method: FluidPayPaymentMethod;
  is_recurring?: boolean;
  recurring_interval?: 'monthly' | 'quarterly' | 'yearly';
}

interface DonationResult {
  success: boolean;
  donation_id?: string;
  transaction_id?: string;
  recurring_payment_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  compliance_flags?: ComplianceFlags;
}
```

## 🧪 Testing & Development

### Service Factory Testing
```typescript
// Mock configuration for testing
const testConfig: FluidPayConfig = {
  apiKey: 'test_key',
  apiSecret: 'test_secret',
  baseUrl: 'https://sandbox-api.fluidpay.com/v1',
  webhookSecret: 'test_webhook_secret',
  environment: 'sandbox'
};

const services = FluidPayServiceFactory.initialize(testConfig);
```

### Webhook Testing
```typescript
// Test webhook payload
const testPayload = JSON.stringify({
  id: 'evt_test_webhook',
  type: 'transaction.succeeded',
  data: {
    object: {
      id: 'txn_test_transaction',
      amount: 10000,
      currency: 'USD',
      status: 'succeeded'
    }
  },
  created: Math.floor(Date.now() / 1000),
  livemode: false
});

const result = await webhookService.processWebhook(
  testPayload,
  'test_signature',
  { 'content-type': 'application/json' }
);
```

## 🔧 Configuration Options

### Environment-Specific Settings

```typescript
// Sandbox configuration
const sandboxConfig = createFluidPayConfig('sandbox');

// Production configuration
const productionConfig = createFluidPayConfig('production');

// Custom configuration
const customConfig: FluidPayConfig = {
  apiKey: process.env.FLUIDPAY_API_KEY!,
  apiSecret: process.env.FLUIDPAY_API_SECRET!,
  baseUrl: 'https://custom-api.fluidpay.com/v1',
  webhookSecret: process.env.FLUIDPAY_WEBHOOK_SECRET!,
  environment: 'production'
};
```

### Service Configuration

```typescript
// Donation processing options
const donationOptions: ProcessPaymentOptions = {
  idempotencyKey: 'unique-key-123',
  description: 'Campaign donation',
  metadata: {
    campaign_id: 'camp_123',
    source: 'website'
  },
  capture: true
};

// Refund processing options
const refundRequest: RefundRequest = {
  transaction_id: 'txn_123',
  amount: 5000, // Optional: partial refund
  reason: 'requested_by_customer',
  reason_details: 'Donor requested refund',
  initiated_by_user_id: 'user_123',
  notify_donor: true
};
```

## 📈 Monitoring & Observability

### Health Checks
```typescript
// Overall health check
const health = await fluidPayServices.healthCheck();
// Returns: { fluidpay_api: boolean, services_initialized: boolean, timestamp: string }

// Individual service checks
const clientHealth = await fluidPayClient.healthCheck();
```

### Logging
All services include comprehensive logging:
- Request/response logging with sanitized data
- Error tracking with context
- Performance metrics
- Security events (failed authentications, suspicious activity)
- Compliance events (limit violations, verification requirements)

### Metrics
- Payment success/failure rates
- Processing times
- Compliance violation rates
- Fraud detection accuracy
- Webhook processing performance

## 🚨 Error Handling

### Error Types
```typescript
interface FluidPayError {
  type: 'api_error' | 'validation_error' | 'authentication_error' | 'rate_limit_error';
  code: string;
  message: string;
  param?: string;
}
```

### Common Error Scenarios
- **Authentication Failures**: Invalid API keys, signature mismatches
- **Validation Errors**: Missing required fields, invalid formats
- **Rate Limiting**: API rate limit exceeded
- **Payment Failures**: Insufficient funds, invalid payment methods
- **Compliance Violations**: Contribution limits exceeded, blocked entities

## 🔄 Webhook Event Reference

### Transaction Events
- `transaction.succeeded` - Payment completed successfully
- `transaction.failed` - Payment failed (card declined, insufficient funds)
- `transaction.canceled` - Payment canceled before completion
- `transaction.refunded` - Full or partial refund processed

### Recurring Payment Events
- `recurring_payment.created` - New subscription created
- `recurring_payment.succeeded` - Recurring payment processed
- `recurring_payment.failed` - Recurring payment failed
- `recurring_payment.canceled` - Subscription canceled

### Refund Events
- `refund.succeeded` - Refund completed successfully
- `refund.failed` - Refund processing failed

### Dispute Events
- `dispute.created` - Chargeback or dispute initiated
- `dispute.updated` - Dispute status changed

---

## 🎯 Best Practices

### Security
- Store API credentials securely (environment variables)
- Validate all webhook signatures
- Use idempotency keys for critical operations
- Log security events for monitoring
- Encrypt sensitive data at rest

### Performance
- Use connection pooling for HTTP clients
- Implement caching for frequently accessed data
- Use batch operations for bulk processing
- Monitor API rate limits
- Implement circuit breakers for external dependencies

### Compliance
- Always validate contribution limits before processing
- Collect required information based on amount thresholds
- Maintain comprehensive audit trails
- Generate compliance reports regularly
- Monitor for suspicious activity patterns

### Error Handling
- Implement retry logic with exponential backoff
- Log errors with sufficient context for debugging
- Provide meaningful error messages to users
- Handle partial failures gracefully
- Implement fallback mechanisms where possible