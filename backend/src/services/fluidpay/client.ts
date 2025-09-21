import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { logger } from '../../middleware/logging.js';
import {
  FluidPayConfig,
  FluidPayApiResponse,
  FluidPayCustomer,
  FluidPayPaymentMethod,
  FluidPayTransaction,
  FluidPayRecurringPayment,
  FluidPayRefund,
  FluidPayError
} from './types.js';

export class FluidPayClient {
  private client: AxiosInstance;
  private config: FluidPayConfig;

  constructor(config: FluidPayConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Advotecate/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');

        // Create signature for FluidPay API authentication
        const signature = this.createSignature(config.method || 'GET', config.url || '', timestamp, nonce);

        config.headers = {
          ...config.headers,
          'X-FP-API-Key': this.config.apiKey,
          'X-FP-Timestamp': timestamp.toString(),
          'X-FP-Nonce': nonce,
          'X-FP-Signature': signature
        };

        logger.info('FluidPay API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          timestamp
        });

        return config;
      },
      (error) => {
        logger.error('FluidPay request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.info('FluidPay API response', {
          status: response.status,
          url: response.config.url,
          success: response.data?.success
        });
        return response;
      },
      (error) => {
        const fluidPayError = this.handleApiError(error);
        logger.error('FluidPay API error', { error: fluidPayError });
        return Promise.reject(fluidPayError);
      }
    );
  }

  private createSignature(method: string, url: string, timestamp: number, nonce: string): string {
    const message = `${method.toUpperCase()}${url}${timestamp}${nonce}`;
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('hex');
  }

  private handleApiError(error: any): FluidPayError {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }

    return {
      type: 'api_error',
      code: error.code || 'unknown_error',
      message: error.message || 'An unknown error occurred'
    };
  }

  // Customer Management
  async createCustomer(customer: FluidPayCustomer): Promise<FluidPayApiResponse<FluidPayCustomer>> {
    try {
      const response = await this.client.post('/customers', customer);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<FluidPayApiResponse<FluidPayCustomer>> {
    try {
      const response = await this.client.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateCustomer(customerId: string, updates: Partial<FluidPayCustomer>): Promise<FluidPayApiResponse<FluidPayCustomer>> {
    try {
      const response = await this.client.put(`/customers/${customerId}`, updates);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Payment Method Management
  async createPaymentMethod(customerId: string, paymentMethod: FluidPayPaymentMethod): Promise<FluidPayApiResponse<FluidPayPaymentMethod>> {
    try {
      const response = await this.client.post(`/customers/${customerId}/payment-methods`, paymentMethod);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getPaymentMethods(customerId: string): Promise<FluidPayApiResponse<FluidPayPaymentMethod[]>> {
    try {
      const response = await this.client.get(`/customers/${customerId}/payment-methods`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePaymentMethod(customerId: string, paymentMethodId: string): Promise<FluidPayApiResponse<void>> {
    try {
      const response = await this.client.delete(`/customers/${customerId}/payment-methods/${paymentMethodId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Transaction Management
  async createTransaction(transaction: Omit<FluidPayTransaction, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<FluidPayApiResponse<FluidPayTransaction>> {
    try {
      const response = await this.client.post('/transactions', transaction);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<FluidPayApiResponse<FluidPayTransaction>> {
    try {
      const response = await this.client.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async captureTransaction(transactionId: string, amount?: number): Promise<FluidPayApiResponse<FluidPayTransaction>> {
    try {
      const response = await this.client.post(`/transactions/${transactionId}/capture`, {
        amount
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async cancelTransaction(transactionId: string): Promise<FluidPayApiResponse<FluidPayTransaction>> {
    try {
      const response = await this.client.post(`/transactions/${transactionId}/cancel`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Recurring Payment Management
  async createRecurringPayment(recurringPayment: Omit<FluidPayRecurringPayment, 'id' | 'status'>): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.post('/recurring-payments', recurringPayment);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.get(`/recurring-payments/${recurringPaymentId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateRecurringPayment(recurringPaymentId: string, updates: Partial<FluidPayRecurringPayment>): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.put(`/recurring-payments/${recurringPaymentId}`, updates);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async pauseRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.post(`/recurring-payments/${recurringPaymentId}/pause`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async resumeRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.post(`/recurring-payments/${recurringPaymentId}/resume`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async cancelRecurringPayment(recurringPaymentId: string): Promise<FluidPayApiResponse<FluidPayRecurringPayment>> {
    try {
      const response = await this.client.post(`/recurring-payments/${recurringPaymentId}/cancel`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Refund Management
  async createRefund(refund: Omit<FluidPayRefund, 'id' | 'status'>): Promise<FluidPayApiResponse<FluidPayRefund>> {
    try {
      const response = await this.client.post('/refunds', refund);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getRefund(refundId: string): Promise<FluidPayApiResponse<FluidPayRefund>> {
    try {
      const response = await this.client.get(`/refunds/${refundId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getRefundsForTransaction(transactionId: string): Promise<FluidPayApiResponse<FluidPayRefund[]>> {
    try {
      const response = await this.client.get(`/transactions/${transactionId}/refunds`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'ok';
    } catch (error) {
      logger.error('FluidPay health check failed', { error });
      return false;
    }
  }
}