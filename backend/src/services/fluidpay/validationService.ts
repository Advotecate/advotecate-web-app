import { logger } from '../../middleware/logging.js';
import {
  CreateDonationRequest,
  FluidPayPaymentMethod,
  PaymentValidationResult
} from './types.js';

export interface ValidationRule {
  name: string;
  check: (request: CreateDonationRequest) => Promise<ValidationResult>;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  passed: boolean;
  message?: string;
  details?: any;
}

export interface FraudCheckResult {
  risk_score: number; // 0-100, higher is riskier
  risk_level: 'low' | 'medium' | 'high' | 'very_high';
  flags: string[];
  recommended_action: 'approve' | 'review' | 'decline';
}

export interface ComplianceCheckResult {
  fec_compliant: boolean;
  requires_verification: boolean;
  exceeds_limits: boolean;
  blocked_entity: boolean;
  issues: string[];
  warnings: string[];
}

export class PaymentValidationService {
  private validationRules: ValidationRule[];

  constructor() {
    this.validationRules = this.initializeValidationRules();
  }

  async validateDonation(request: CreateDonationRequest): Promise<PaymentValidationResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting donation validation', {
        amount: request.amount,
        currency: request.currency,
        donor_email: request.donor_info.email,
        fundraiser_id: request.fundraiser_id
      });

      const errors: string[] = [];
      const warnings: string[] = [];
      let complianceFlags = {
        requiresVerification: false,
        exceedsLimit: false,
        suspiciousActivity: false
      };

      // Run basic validation rules
      for (const rule of this.validationRules) {
        try {
          const result = await rule.check(request);
          if (!result.passed) {
            if (rule.severity === 'error') {
              errors.push(`${rule.name}: ${result.message}`);
            } else if (rule.severity === 'warning') {
              warnings.push(`${rule.name}: ${result.message}`);
            }
          }
        } catch (ruleError) {
          logger.error('Validation rule failed', {
            rule: rule.name,
            error: ruleError instanceof Error ? ruleError.message : 'Unknown error'
          });

          if (rule.severity === 'error') {
            errors.push(`${rule.name}: Validation failed`);
          }
        }
      }

      // Run compliance checks
      const complianceCheck = await this.performComplianceChecks(request);
      if (!complianceCheck.fec_compliant) {
        errors.push(...complianceCheck.issues);
      }
      warnings.push(...complianceCheck.warnings);

      complianceFlags.requiresVerification = complianceCheck.requires_verification;
      complianceFlags.exceedsLimit = complianceCheck.exceeds_limits;

      // Run fraud detection
      const fraudCheck = await this.performFraudChecks(request);
      if (fraudCheck.recommended_action === 'decline') {
        errors.push(`Payment declined due to fraud risk: ${fraudCheck.flags.join(', ')}`);
      } else if (fraudCheck.recommended_action === 'review') {
        warnings.push(`Payment flagged for review: ${fraudCheck.flags.join(', ')}`);
        complianceFlags.suspiciousActivity = true;
      }

      const processingTime = Date.now() - startTime;

      logger.info('Donation validation completed', {
        valid: errors.length === 0,
        errors_count: errors.length,
        warnings_count: warnings.length,
        compliance_flags: complianceFlags,
        processing_time: processingTime,
        donor_email: request.donor_info.email
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        complianceFlags
      };

    } catch (error) {
      logger.error('Donation validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time: Date.now() - startTime,
        donor_email: request.donor_info.email
      });

      return {
        isValid: false,
        errors: ['Validation system error'],
        warnings: [],
        complianceFlags: {
          requiresVerification: false,
          exceedsLimit: false,
          suspiciousActivity: true
        }
      };
    }
  }

  async validatePaymentMethod(paymentMethod: FluidPayPaymentMethod): Promise<ValidationResult> {
    try {
      logger.info('Validating payment method', {
        type: paymentMethod.type
      });

      if (paymentMethod.type === 'card' && paymentMethod.card) {
        return await this.validateCreditCard(paymentMethod.card);
      } else if (paymentMethod.type === 'bank_account' && paymentMethod.bank_account) {
        return await this.validateBankAccount(paymentMethod.bank_account);
      }

      return {
        passed: false,
        message: 'Invalid payment method type or missing payment details'
      };

    } catch (error) {
      logger.error('Payment method validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        passed: false,
        message: 'Payment method validation error'
      };
    }
  }

  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        name: 'Amount Validation',
        severity: 'error',
        check: async (request) => {
          if (request.amount <= 0) {
            return { passed: false, message: 'Amount must be greater than zero' };
          }
          if (request.amount < 1) {
            return { passed: false, message: 'Minimum donation amount is $1.00' };
          }
          if (request.amount > 100000) {
            return { passed: false, message: 'Maximum donation amount is $100,000' };
          }
          return { passed: true };
        }
      },
      {
        name: 'Currency Validation',
        severity: 'error',
        check: async (request) => {
          const supportedCurrencies = ['USD'];
          if (!supportedCurrencies.includes(request.currency)) {
            return { passed: false, message: 'Unsupported currency' };
          }
          return { passed: true };
        }
      },
      {
        name: 'Donor Information',
        severity: 'error',
        check: async (request) => {
          const donor = request.donor_info;

          if (!donor.email) {
            return { passed: false, message: 'Email address is required' };
          }
          if (!this.isValidEmail(donor.email)) {
            return { passed: false, message: 'Invalid email address format' };
          }
          if (!donor.first_name || !donor.last_name) {
            return { passed: false, message: 'First name and last name are required' };
          }
          if (donor.first_name.length < 2 || donor.last_name.length < 2) {
            return { passed: false, message: 'Names must be at least 2 characters long' };
          }

          return { passed: true };
        }
      },
      {
        name: 'Address Validation for Large Donations',
        severity: 'error',
        check: async (request) => {
          if (request.amount >= 200 && !request.donor_info.address) {
            return {
              passed: false,
              message: 'Address is required for donations of $200 or more (FEC requirement)'
            };
          }

          if (request.donor_info.address) {
            const addr = request.donor_info.address;
            if (!addr.street || !addr.city || !addr.state || !addr.zip) {
              return {
                passed: false,
                message: 'Complete address (street, city, state, zip) is required'
              };
            }
          }

          return { passed: true };
        }
      },
      {
        name: 'Fundraiser Validation',
        severity: 'error',
        check: async (request) => {
          if (!request.fundraiser_id) {
            return { passed: false, message: 'Fundraiser ID is required' };
          }

          // TODO: Check if fundraiser exists and is active
          const fundraiserExists = await this.checkFundraiserExists(request.fundraiser_id);
          if (!fundraiserExists) {
            return { passed: false, message: 'Invalid or inactive fundraiser' };
          }

          return { passed: true };
        }
      },
      {
        name: 'Recurring Payment Validation',
        severity: 'error',
        check: async (request) => {
          if (request.is_recurring) {
            if (!request.recurring_interval) {
              return { passed: false, message: 'Recurring interval is required for recurring donations' };
            }
            if (!['monthly', 'quarterly', 'yearly'].includes(request.recurring_interval)) {
              return { passed: false, message: 'Invalid recurring interval' };
            }
            if (request.amount < 5) {
              return { passed: false, message: 'Minimum recurring donation amount is $5.00' };
            }
          }
          return { passed: true };
        }
      }
    ];
  }

  private async performComplianceChecks(request: CreateDonationRequest): Promise<ComplianceCheckResult> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // FEC Individual contribution limits (per election cycle)
    const FEC_INDIVIDUAL_LIMIT = 3300;
    const VERIFICATION_THRESHOLD = 200;

    let requiresVerification = false;
    let exceedsLimits = false;
    let blockedEntity = false;

    // Check contribution limits
    if (request.amount > FEC_INDIVIDUAL_LIMIT) {
      exceedsLimits = true;
      issues.push(`Donation amount exceeds FEC individual limit of $${FEC_INDIVIDUAL_LIMIT}`);
    }

    // Check verification requirements
    if (request.amount >= VERIFICATION_THRESHOLD) {
      requiresVerification = true;
      if (!request.donor_info.address) {
        issues.push('Address is required for donations $200 and above');
      }
    }

    // Check against blocked entities list
    blockedEntity = await this.checkBlockedEntity(request.donor_info);
    if (blockedEntity) {
      issues.push('Donor is on blocked entities list');
    }

    // TODO: Check aggregate donations for this donor
    // This would require database queries to sum up previous donations

    // Check for prohibited donation sources
    const prohibitedCheck = await this.checkProhibitedSources(request);
    if (!prohibitedCheck.allowed) {
      issues.push(prohibitedCheck.reason || 'Donation from prohibited source');
    }

    return {
      fec_compliant: issues.length === 0,
      requires_verification: requiresVerification,
      exceeds_limits: exceedsLimits,
      blocked_entity: blockedEntity,
      issues,
      warnings
    };
  }

  private async performFraudChecks(request: CreateDonationRequest): Promise<FraudCheckResult> {
    let riskScore = 0;
    const flags: string[] = [];

    // Email validation and reputation
    const emailRisk = await this.checkEmailRisk(request.donor_info.email);
    riskScore += emailRisk.score;
    if (emailRisk.flags.length > 0) {
      flags.push(...emailRisk.flags);
    }

    // Amount-based risk assessment
    if (request.amount > 10000) {
      riskScore += 20;
      flags.push('large_amount');
    }

    // Payment method risk
    const paymentMethodRisk = await this.checkPaymentMethodRisk(request.payment_method);
    riskScore += paymentMethodRisk.score;
    if (paymentMethodRisk.flags.length > 0) {
      flags.push(...paymentMethodRisk.flags);
    }

    // Geographic risk (if address provided)
    if (request.donor_info.address) {
      const geoRisk = await this.checkGeographicRisk(request.donor_info.address);
      riskScore += geoRisk.score;
      if (geoRisk.flags.length > 0) {
        flags.push(...geoRisk.flags);
      }
    }

    // Velocity checks
    const velocityRisk = await this.checkVelocityRisk(request.donor_info.email, request.amount);
    riskScore += velocityRisk.score;
    if (velocityRisk.flags.length > 0) {
      flags.push(...velocityRisk.flags);
    }

    // Determine risk level and recommendation
    let riskLevel: FraudCheckResult['risk_level'];
    let recommendedAction: FraudCheckResult['recommended_action'];

    if (riskScore < 20) {
      riskLevel = 'low';
      recommendedAction = 'approve';
    } else if (riskScore < 50) {
      riskLevel = 'medium';
      recommendedAction = 'approve';
    } else if (riskScore < 80) {
      riskLevel = 'high';
      recommendedAction = 'review';
    } else {
      riskLevel = 'very_high';
      recommendedAction = 'decline';
    }

    return {
      risk_score: Math.min(riskScore, 100),
      risk_level: riskLevel,
      flags,
      recommended_action: recommendedAction
    };
  }

  private async validateCreditCard(card: NonNullable<FluidPayPaymentMethod['card']>): Promise<ValidationResult> {
    // Basic card validation
    if (!card.number || !card.exp_month || !card.exp_year || !card.cvc) {
      return { passed: false, message: 'Missing required card information' };
    }

    // Luhn algorithm validation
    if (!this.validateLuhn(card.number.replace(/\s/g, ''))) {
      return { passed: false, message: 'Invalid card number' };
    }

    // Expiration date validation
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const expMonth = parseInt(card.exp_month);
    const expYear = parseInt(card.exp_year);

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      return { passed: false, message: 'Card is expired' };
    }

    return { passed: true };
  }

  private async validateBankAccount(bankAccount: NonNullable<FluidPayPaymentMethod['bank_account']>): Promise<ValidationResult> {
    if (!bankAccount.routing_number || !bankAccount.account_number || !bankAccount.account_holder_name) {
      return { passed: false, message: 'Missing required bank account information' };
    }

    // Basic routing number validation (US)
    if (!/^\d{9}$/.test(bankAccount.routing_number)) {
      return { passed: false, message: 'Invalid routing number format' };
    }

    // Account number length validation
    if (bankAccount.account_number.length < 4 || bankAccount.account_number.length > 20) {
      return { passed: false, message: 'Invalid account number length' };
    }

    return { passed: true };
  }

  // Helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validateLuhn(cardNumber: string): boolean {
    let sum = 0;
    let alternate = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber.charAt(i), 10);

      if (alternate) {
        n *= 2;
        if (n > 9) {
          n = (n % 10) + 1;
        }
      }

      sum += n;
      alternate = !alternate;
    }

    return (sum % 10) === 0;
  }

  private async checkFundraiserExists(fundraiserId: string): Promise<boolean> {
    // TODO: Check database for active fundraiser
    return true; // Placeholder
  }

  private async checkBlockedEntity(donorInfo: CreateDonationRequest['donor_info']): Promise<boolean> {
    // TODO: Check against OFAC and other blocked entity lists
    return false; // Placeholder
  }

  private async checkProhibitedSources(request: CreateDonationRequest): Promise<{ allowed: boolean; reason?: string }> {
    // TODO: Check for prohibited sources (foreign nationals, corporations, etc.)
    return { allowed: true }; // Placeholder
  }

  private async checkEmailRisk(email: string): Promise<{ score: number; flags: string[] }> {
    // TODO: Implement email risk checking
    return { score: 0, flags: [] }; // Placeholder
  }

  private async checkPaymentMethodRisk(paymentMethod: FluidPayPaymentMethod): Promise<{ score: number; flags: string[] }> {
    // TODO: Implement payment method risk checking
    return { score: 0, flags: [] }; // Placeholder
  }

  private async checkGeographicRisk(address: NonNullable<CreateDonationRequest['donor_info']['address']>): Promise<{ score: number; flags: string[] }> {
    // TODO: Implement geographic risk checking
    return { score: 0, flags: [] }; // Placeholder
  }

  private async checkVelocityRisk(email: string, amount: number): Promise<{ score: number; flags: string[] }> {
    // TODO: Implement velocity risk checking (frequency and amounts)
    return { score: 0, flags: [] }; // Placeholder
  }
}