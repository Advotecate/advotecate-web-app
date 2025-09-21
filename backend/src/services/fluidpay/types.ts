// FluidPay API types and interfaces

export interface FluidPayConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
}

export interface FluidPayServices {
  client: any; // FluidPayClient - avoiding circular imports
  donationService: any; // DonationService
  recurringPaymentService: any; // RecurringPaymentService
  refundService: any; // RefundService
  webhookService: any; // WebhookService
  paymentValidationService: any; // PaymentValidationService
  complianceService: any; // ComplianceService
}

export interface FluidPayCustomer {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface FluidPayPaymentMethod {
  id?: string;
  type: 'card' | 'bank_account';
  card?: {
    number: string;
    exp_month: string;
    exp_year: string;
    cvc: string;
    name: string;
  };
  bank_account?: {
    routing_number: string;
    account_number: string;
    account_type: 'checking' | 'savings';
    account_holder_name: string;
  };
}

export interface FluidPayTransaction {
  id?: string;
  amount: number;
  currency: string;
  description?: string;
  customer_id?: string;
  payment_method_id?: string;
  status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface FluidPayRecurringPayment {
  id?: string;
  customer_id: string;
  payment_method_id: string;
  amount: number;
  currency: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_count: number;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'paused' | 'canceled' | 'expired';
  metadata?: Record<string, any>;
}

export interface FluidPayRefund {
  id?: string;
  transaction_id: string;
  amount?: number;
  reason?: string;
  status?: 'pending' | 'succeeded' | 'failed';
  metadata?: Record<string, any>;
}

export interface FluidPayWebhookEvent {
  id: string;
  type: string;
  data: {
    object: FluidPayTransaction | FluidPayRecurringPayment | FluidPayRefund | any;
  };
  created: number;
  livemode: boolean;
}

export interface FluidPayError {
  type: string;
  code: string;
  message: string;
  param?: string;
}

export interface FluidPayApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: FluidPayError;
  metadata?: {
    total_count?: number;
    page?: number;
    per_page?: number;
  };
}

export interface CreateDonationRequest {
  amount: number;
  currency: string;
  fundraiser_id: string;
  donor_info: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };
  payment_method: FluidPayPaymentMethod;
  is_recurring?: boolean;
  recurring_interval?: 'monthly' | 'quarterly' | 'yearly';
  is_anonymous?: boolean;
  metadata?: Record<string, any>;
}

export interface ProcessPaymentOptions {
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, any>;
  capture?: boolean;
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complianceFlags: {
    requiresVerification: boolean;
    exceedsLimit: boolean;
    suspiciousActivity: boolean;
  };
}