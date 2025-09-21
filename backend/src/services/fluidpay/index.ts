// FluidPay Integration Services - Complete payment processing suite
export * from './types.js';
export { FluidPayClient } from './client.js';
export { DonationService } from './donationService.js';
export { RecurringPaymentService } from './recurringService.js';
export { RefundService } from './refundService.js';
export { WebhookService } from './webhookService.js';
export { PaymentValidationService } from './validationService.js';
export { ComplianceService } from './complianceService.js';

import { FluidPayClient } from './client.js';
import { DonationService } from './donationService.js';
import { RecurringPaymentService } from './recurringService.js';
import { RefundService } from './refundService.js';
import { WebhookService } from './webhookService.js';
import { PaymentValidationService } from './validationService.js';
import { ComplianceService } from './complianceService.js';
import { FluidPayConfig, FluidPayServices } from './types.js';
import { logger } from '../../middleware/logging.js';

/**
 * FluidPay Service Factory
 *
 * Centralized initialization and management of all FluidPay services.
 * Implements singleton pattern with enhanced error handling and validation.
 */
export class FluidPayServiceFactory {
  private static instance: FluidPayServiceFactory | null = null;
  private services: FluidPayServices | null = null;
  private config: FluidPayConfig | null = null;
  private initialized: boolean = false;

  private constructor() {}

  /**
   * Initialize FluidPay services with configuration
   */
  public async initialize(config: FluidPayConfig): Promise<FluidPayServices> {
    if (this.services && this.initialized) {
      logger.info('FluidPay services already initialized');
      return this.services;
    }

    try {
      logger.info('Initializing FluidPay services', {
        environment: config.environment,
        baseUrl: config.baseUrl
      });

      // Validate configuration
      this.validateConfig(config);
      this.config = config;

      // Initialize core client
      const client = new FluidPayClient(config);

      // Test client connection
      logger.info('Testing FluidPay API connection');
      const isHealthy = await client.healthCheck();
      if (!isHealthy) {
        throw new Error('FluidPay API health check failed');
      }

      // Initialize validation service (no dependencies)
      const paymentValidationService = new PaymentValidationService();
      const complianceService = new ComplianceService();

      // Initialize services with client dependency
      const donationService = new DonationService(client);
      const recurringPaymentService = new RecurringPaymentService(client);
      const refundService = new RefundService(client);
      const webhookService = new WebhookService(client);

      // Create services object
      this.services = {
        client,
        donationService,
        recurringPaymentService,
        refundService,
        webhookService,
        paymentValidationService,
        complianceService
      };

      this.initialized = true;

      logger.info('FluidPay services initialized successfully', {
        servicesCount: Object.keys(this.services).length,
        environment: config.environment
      });

      return this.services;
    } catch (error) {
      logger.error('Failed to initialize FluidPay services', { error });
      this.services = null;
      this.initialized = false;
      throw new Error(`FluidPay initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate FluidPay configuration
   */
  private validateConfig(config: FluidPayConfig): void {
    const required = ['apiKey', 'apiSecret', 'baseUrl', 'webhookSecret'];
    const missing = required.filter(key => !config[key as keyof FluidPayConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required FluidPay configuration: ${missing.join(', ')}`);
    }

    if (!['sandbox', 'production'].includes(config.environment)) {
      throw new Error('Invalid environment. Must be "sandbox" or "production"');
    }

    if (!config.baseUrl.startsWith('https://')) {
      throw new Error('Base URL must use HTTPS');
    }

    // Validate API key format (basic validation)
    if (config.apiKey.length < 10) {
      throw new Error('API key appears to be invalid (too short)');
    }

    if (config.apiSecret.length < 10) {
      throw new Error('API secret appears to be invalid (too short)');
    }

    logger.info('FluidPay configuration validated successfully');
  }

  /**
   * Get singleton instance of FluidPay service factory
   */
  public static getInstance(): FluidPayServiceFactory {
    if (!FluidPayServiceFactory.instance) {
      FluidPayServiceFactory.instance = new FluidPayServiceFactory();
    }
    return FluidPayServiceFactory.instance;
  }

  /**
   * Get initialized services (throws if not initialized)
   */
  public getServices(): FluidPayServices {
    if (!this.services || !this.initialized) {
      throw new Error('FluidPay services not initialized. Call initialize() first.');
    }
    return this.services;
  }

  /**
   * Check if services are initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.services !== null;
  }

  // Service getters
  public getClient(): FluidPayClient {
    return this.getServices().client;
  }

  public getDonationService(): DonationService {
    return this.getServices().donationService;
  }

  public getRecurringPaymentService(): RecurringPaymentService {
    return this.getServices().recurringPaymentService;
  }

  public getRefundService(): RefundService {
    return this.getServices().refundService;
  }

  public getWebhookService(): WebhookService {
    return this.getServices().webhookService;
  }

  public getPaymentValidationService(): PaymentValidationService {
    return this.getServices().paymentValidationService;
  }

  public getComplianceService(): ComplianceService {
    return this.getServices().complianceService;
  }

  /**
   * Get current configuration
   */
  public getConfig(): FluidPayConfig {
    if (!this.config) {
      throw new Error('FluidPay not initialized');
    }
    return this.config;
  }

  /**
   * Health check for all services
   */
  public async healthCheck(): Promise<{
    fluidpay_api: boolean;
    services_initialized: boolean;
    timestamp: string;
  }> {
    try {
      const fluidpayApi = this.isInitialized() ? await this.getClient().healthCheck() : false;

      return {
        fluidpay_api: fluidpayApi,
        services_initialized: this.isInitialized(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('FluidPay health check failed', { error });
      return {
        fluidpay_api: false,
        services_initialized: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reset services (for testing or re-initialization)
   */
  public reset(): void {
    this.services = null;
    this.config = null;
    this.initialized = false;
    logger.info('FluidPay services reset');
  }
}

/**
 * Create FluidPay configuration from environment variables
 */
export function createFluidPayConfig(environment: 'sandbox' | 'production' = 'sandbox'): FluidPayConfig {
  const apiKey = process.env.FLUIDPAY_API_KEY;
  const apiSecret = process.env.FLUIDPAY_API_SECRET;
  const webhookSecret = process.env.FLUIDPAY_WEBHOOK_SECRET;

  if (!apiKey || !apiSecret || !webhookSecret) {
    throw new Error('Missing required FluidPay environment variables: FLUIDPAY_API_KEY, FLUIDPAY_API_SECRET, FLUIDPAY_WEBHOOK_SECRET');
  }

  const baseUrl = environment === 'production'
    ? (process.env.FLUIDPAY_PRODUCTION_URL || 'https://api.fluidpay.com/v1')
    : (process.env.FLUIDPAY_SANDBOX_URL || 'https://sandbox-api.fluidpay.com/v1');

  return {
    apiKey,
    apiSecret,
    baseUrl,
    webhookSecret,
    environment
  };
}

/**
 * Initialize FluidPay services with environment-based configuration
 */
export async function initializeFluidPay(environment: 'sandbox' | 'production' = 'sandbox'): Promise<FluidPayServices> {
  const config = createFluidPayConfig(environment);
  const factory = FluidPayServiceFactory.getInstance();
  return await factory.initialize(config);
}

// Export singleton instance for easy access
export const fluidPayServices = FluidPayServiceFactory.getInstance();