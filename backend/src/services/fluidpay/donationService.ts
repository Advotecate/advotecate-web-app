import { FluidPayClient } from './client.js';
import { logger } from '../../middleware/logging.js';
import {
  CreateDonationRequest,
  FluidPayCustomer,
  FluidPayTransaction,
  FluidPayRecurringPayment,
  ProcessPaymentOptions,
  PaymentValidationResult
} from './types.js';

export interface DonationResult {
  success: boolean;
  donation_id?: string;
  transaction_id?: string;
  recurring_payment_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  receipt_url?: string;
  error?: string;
  compliance_flags?: {
    requires_verification: boolean;
    exceeds_limit: boolean;
    suspicious_activity: boolean;
  };
}

export class DonationService {
  private fluidPayClient: FluidPayClient;

  constructor(fluidPayClient: FluidPayClient) {
    this.fluidPayClient = fluidPayClient;
  }

  async processDonation(donationRequest: CreateDonationRequest, options: ProcessPaymentOptions = {}): Promise<DonationResult> {
    const donationId = this.generateDonationId();

    try {
      logger.info('Processing donation', {
        donation_id: donationId,
        amount: donationRequest.amount,
        currency: donationRequest.currency,
        fundraiser_id: donationRequest.fundraiser_id,
        is_recurring: donationRequest.is_recurring,
        donor_email: donationRequest.donor_info.email
      });

      // Step 1: Validate the donation
      const validation = await this.validateDonation(donationRequest);
      if (!validation.isValid) {
        return {
          success: false,
          donation_id: donationId,
          amount: donationRequest.amount,
          currency: donationRequest.currency,
          status: 'failed',
          error: validation.errors.join(', '),
          compliance_flags: validation.complianceFlags
        };
      }

      // Step 2: Create or get customer
      const customer = await this.createOrUpdateCustomer(donationRequest.donor_info);
      if (!customer.success || !customer.data) {
        throw new Error('Failed to create customer');
      }

      // Step 3: Create payment method
      const paymentMethod = await this.fluidPayClient.createPaymentMethod(
        customer.data.id!,
        donationRequest.payment_method
      );
      if (!paymentMethod.success || !paymentMethod.data) {
        throw new Error('Failed to create payment method');
      }

      let result: DonationResult;

      if (donationRequest.is_recurring) {
        // Process recurring donation
        result = await this.processRecurringDonation(
          donationId,
          donationRequest,
          customer.data.id!,
          paymentMethod.data.id!,
          options
        );
      } else {
        // Process one-time donation
        result = await this.processOneTimeDonation(
          donationId,
          donationRequest,
          customer.data.id!,
          paymentMethod.data.id!,
          options
        );
      }

      // Step 4: Handle compliance flags
      if (validation.complianceFlags.requiresVerification ||
          validation.complianceFlags.exceedsLimit ||
          validation.complianceFlags.suspiciousActivity) {
        await this.handleComplianceFlags(donationId, validation.complianceFlags, donationRequest);
        result.compliance_flags = validation.complianceFlags;
      }

      // Step 5: Generate receipt if successful
      if (result.success && result.status === 'succeeded') {
        result.receipt_url = await this.generateReceipt(donationId, donationRequest, result);
      }

      logger.info('Donation processing completed', {
        donation_id: donationId,
        success: result.success,
        status: result.status,
        transaction_id: result.transaction_id,
        recurring_payment_id: result.recurring_payment_id
      });

      return result;

    } catch (error) {
      logger.error('Donation processing failed', {
        donation_id: donationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        donor_email: donationRequest.donor_info.email,
        amount: donationRequest.amount
      });

      return {
        success: false,
        donation_id: donationId,
        amount: donationRequest.amount,
        currency: donationRequest.currency,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  private async processOneTimeDonation(
    donationId: string,
    donationRequest: CreateDonationRequest,
    customerId: string,
    paymentMethodId: string,
    options: ProcessPaymentOptions
  ): Promise<DonationResult> {

    const transaction = await this.fluidPayClient.createTransaction({
      amount: donationRequest.amount,
      currency: donationRequest.currency,
      customer_id: customerId,
      payment_method_id: paymentMethodId,
      description: `Donation to ${donationRequest.fundraiser_id}`,
      metadata: {
        donation_id: donationId,
        fundraiser_id: donationRequest.fundraiser_id,
        is_anonymous: donationRequest.is_anonymous,
        ...donationRequest.metadata,
        ...options.metadata
      }
    });

    if (!transaction.success || !transaction.data) {
      throw new Error('Failed to create transaction');
    }

    return {
      success: true,
      donation_id: donationId,
      transaction_id: transaction.data.id,
      amount: donationRequest.amount,
      currency: donationRequest.currency,
      status: transaction.data.status || 'processing'
    };
  }

  private async processRecurringDonation(
    donationId: string,
    donationRequest: CreateDonationRequest,
    customerId: string,
    paymentMethodId: string,
    options: ProcessPaymentOptions
  ): Promise<DonationResult> {

    const recurringPayment = await this.fluidPayClient.createRecurringPayment({
      customer_id: customerId,
      payment_method_id: paymentMethodId,
      amount: donationRequest.amount,
      currency: donationRequest.currency,
      interval: donationRequest.recurring_interval === 'monthly' ? 'monthly' :
                donationRequest.recurring_interval === 'quarterly' ? 'monthly' : 'yearly',
      interval_count: donationRequest.recurring_interval === 'quarterly' ? 3 : 1,
      description: `Recurring donation to ${donationRequest.fundraiser_id}`,
      metadata: {
        donation_id: donationId,
        fundraiser_id: donationRequest.fundraiser_id,
        is_anonymous: donationRequest.is_anonymous,
        ...donationRequest.metadata,
        ...options.metadata
      }
    });

    if (!recurringPayment.success || !recurringPayment.data) {
      throw new Error('Failed to create recurring payment');
    }

    return {
      success: true,
      donation_id: donationId,
      recurring_payment_id: recurringPayment.data.id,
      amount: donationRequest.amount,
      currency: donationRequest.currency,
      status: 'succeeded'
    };
  }

  private async createOrUpdateCustomer(donorInfo: CreateDonationRequest['donor_info']): Promise<{ success: boolean; data?: FluidPayCustomer }> {
    // First try to find existing customer by email
    // This would require a search endpoint in FluidPay API
    // For now, we'll always create a new customer

    const customer: FluidPayCustomer = {
      first_name: donorInfo.first_name,
      last_name: donorInfo.last_name,
      email: donorInfo.email,
      phone: donorInfo.phone,
      address: donorInfo.address
    };

    return await this.fluidPayClient.createCustomer(customer);
  }

  private async validateDonation(donationRequest: CreateDonationRequest): Promise<PaymentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const complianceFlags = {
      requiresVerification: false,
      exceedsLimit: false,
      suspiciousActivity: false
    };

    // Basic validation
    if (donationRequest.amount <= 0) {
      errors.push('Donation amount must be greater than zero');
    }

    if (donationRequest.amount < 1) {
      errors.push('Minimum donation amount is $1.00');
    }

    if (!donationRequest.donor_info.email) {
      errors.push('Donor email is required');
    }

    if (!donationRequest.donor_info.first_name || !donationRequest.donor_info.last_name) {
      errors.push('Donor name is required');
    }

    // FEC compliance checks
    const FEC_INDIVIDUAL_LIMIT = 3300; // Per election cycle
    const VERIFICATION_THRESHOLD = 200; // Requires verification above this amount
    const SUSPICIOUS_AMOUNT = 10000; // Flag for review

    if (donationRequest.amount >= VERIFICATION_THRESHOLD) {
      complianceFlags.requiresVerification = true;

      if (!donationRequest.donor_info.address) {
        errors.push('Address is required for donations $200 and above');
      }
    }

    if (donationRequest.amount > FEC_INDIVIDUAL_LIMIT) {
      complianceFlags.exceedsLimit = true;
      errors.push(`Donation amount exceeds FEC limit of $${FEC_INDIVIDUAL_LIMIT}`);
    }

    if (donationRequest.amount >= SUSPICIOUS_AMOUNT) {
      complianceFlags.suspiciousActivity = true;
      warnings.push('Large donation flagged for compliance review');
    }

    // TODO: Check against existing donations for this donor to ensure aggregate limits
    // This would require database queries

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complianceFlags
    };
  }

  private async handleComplianceFlags(
    donationId: string,
    flags: PaymentValidationResult['complianceFlags'],
    donationRequest: CreateDonationRequest
  ): Promise<void> {
    logger.info('Handling compliance flags', {
      donation_id: donationId,
      flags,
      donor_email: donationRequest.donor_info.email
    });

    // TODO: Implement compliance handling
    // - Create compliance report entry
    // - Send notifications to compliance team
    // - Update donation status if needed
    // - Trigger additional verification workflows
  }

  private async generateReceipt(
    donationId: string,
    donationRequest: CreateDonationRequest,
    result: DonationResult
  ): Promise<string> {
    // TODO: Generate PDF receipt and upload to storage
    // For now, return a placeholder URL
    return `https://receipts.advotecate.com/${donationId}.pdf`;
  }

  private generateDonationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `don_${timestamp}${random}`;
  }

  async getDonationStatus(donationId: string): Promise<DonationResult | null> {
    try {
      // TODO: Query database for donation status
      // This is a placeholder implementation
      logger.info('Getting donation status', { donation_id: donationId });
      return null;
    } catch (error) {
      logger.error('Failed to get donation status', { donation_id: donationId, error });
      return null;
    }
  }

  async cancelDonation(donationId: string, reason?: string): Promise<boolean> {
    try {
      logger.info('Canceling donation', { donation_id: donationId, reason });

      // TODO: Implement donation cancellation
      // - Get donation from database
      // - Cancel transaction or recurring payment in FluidPay
      // - Update donation status
      // - Send notifications

      return true;
    } catch (error) {
      logger.error('Failed to cancel donation', { donation_id: donationId, error });
      return false;
    }
  }
}