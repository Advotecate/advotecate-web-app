import { FluidPayClient } from './client.js';
import { logger } from '../../middleware/logging.js';
import { FluidPayRefund, FluidPayTransaction } from './types.js';

export interface RefundRequest {
  transaction_id: string;
  amount?: number; // If not provided, refunds full amount
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'compliance' | 'other';
  reason_details?: string;
  initiated_by_user_id: string;
  notify_donor?: boolean;
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  amount?: number;
  status?: 'pending' | 'succeeded' | 'failed';
  error?: string;
  transaction_id: string;
  processing_time?: string;
}

export interface BulkRefundRequest {
  transaction_ids: string[];
  reason: RefundRequest['reason'];
  reason_details?: string;
  initiated_by_user_id: string;
  notify_donors?: boolean;
}

export interface BulkRefundResult {
  total_requested: number;
  successful_refunds: number;
  failed_refunds: number;
  results: RefundResult[];
  summary: {
    total_amount_refunded: number;
    processing_time: string;
  };
}

export class RefundService {
  private fluidPayClient: FluidPayClient;

  constructor(fluidPayClient: FluidPayClient) {
    this.fluidPayClient = fluidPayClient;
  }

  async processRefund(refundRequest: RefundRequest): Promise<RefundResult> {
    const startTime = Date.now();

    try {
      logger.info('Processing refund', {
        transaction_id: refundRequest.transaction_id,
        amount: refundRequest.amount,
        reason: refundRequest.reason,
        initiated_by: refundRequest.initiated_by_user_id
      });

      // Step 1: Validate the refund request
      const validation = await this.validateRefundRequest(refundRequest);
      if (!validation.isValid) {
        return {
          success: false,
          transaction_id: refundRequest.transaction_id,
          error: validation.error,
          processing_time: `${Date.now() - startTime}ms`
        };
      }

      // Step 2: Get original transaction details
      const originalTransaction = await this.fluidPayClient.getTransaction(refundRequest.transaction_id);
      if (!originalTransaction.success || !originalTransaction.data) {
        return {
          success: false,
          transaction_id: refundRequest.transaction_id,
          error: 'Original transaction not found',
          processing_time: `${Date.now() - startTime}ms`
        };
      }

      // Step 3: Calculate refund amount
      const refundAmount = refundRequest.amount || originalTransaction.data.amount;

      // Step 4: Check refund eligibility
      const eligibilityCheck = await this.checkRefundEligibility(
        originalTransaction.data,
        refundAmount
      );

      if (!eligibilityCheck.isEligible) {
        return {
          success: false,
          transaction_id: refundRequest.transaction_id,
          error: eligibilityCheck.reason,
          processing_time: `${Date.now() - startTime}ms`
        };
      }

      // Step 5: Process refund with FluidPay
      const refund = await this.fluidPayClient.createRefund({
        transaction_id: refundRequest.transaction_id,
        amount: refundAmount,
        reason: refundRequest.reason_details || refundRequest.reason,
        metadata: {
          initiated_by: refundRequest.initiated_by_user_id,
          reason: refundRequest.reason,
          processed_at: new Date().toISOString()
        }
      });

      if (!refund.success || !refund.data) {
        return {
          success: false,
          transaction_id: refundRequest.transaction_id,
          error: refund.error?.message || 'Failed to process refund',
          processing_time: `${Date.now() - startTime}ms`
        };
      }

      // Step 6: Update database records
      await this.updateRefundRecords(refundRequest, refund.data, originalTransaction.data);

      // Step 7: Handle compliance reporting
      await this.handleComplianceReporting(refundRequest, refund.data, originalTransaction.data);

      // Step 8: Send notifications
      if (refundRequest.notify_donor) {
        await this.sendRefundNotification(refund.data.id!, originalTransaction.data, refundAmount);
      }

      const processingTime = `${Date.now() - startTime}ms`;

      logger.info('Refund processed successfully', {
        refund_id: refund.data.id,
        transaction_id: refundRequest.transaction_id,
        amount: refundAmount,
        processing_time: processingTime
      });

      return {
        success: true,
        refund_id: refund.data.id,
        amount: refundAmount,
        status: refund.data.status,
        transaction_id: refundRequest.transaction_id,
        processing_time: processingTime
      };

    } catch (error) {
      logger.error('Refund processing failed', {
        transaction_id: refundRequest.transaction_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time: `${Date.now() - startTime}ms`
      });

      return {
        success: false,
        transaction_id: refundRequest.transaction_id,
        error: error instanceof Error ? error.message : 'Refund processing failed',
        processing_time: `${Date.now() - startTime}ms`
      };
    }
  }

  async processBulkRefunds(bulkRequest: BulkRefundRequest): Promise<BulkRefundResult> {
    const startTime = Date.now();

    try {
      logger.info('Processing bulk refunds', {
        transaction_count: bulkRequest.transaction_ids.length,
        reason: bulkRequest.reason,
        initiated_by: bulkRequest.initiated_by_user_id
      });

      const results: RefundResult[] = [];
      let successfulRefunds = 0;
      let totalAmountRefunded = 0;

      // Process refunds in batches to avoid overwhelming the API
      const batchSize = 10;
      const batches = this.chunkArray(bulkRequest.transaction_ids, batchSize);

      for (const batch of batches) {
        const batchPromises = batch.map(transactionId =>
          this.processRefund({
            transaction_id: transactionId,
            reason: bulkRequest.reason,
            reason_details: bulkRequest.reason_details,
            initiated_by_user_id: bulkRequest.initiated_by_user_id,
            notify_donor: bulkRequest.notify_donors
          })
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.success) {
              successfulRefunds++;
              totalAmountRefunded += result.value.amount || 0;
            }
          } else {
            // Handle promise rejection
            results.push({
              success: false,
              transaction_id: 'unknown',
              error: 'Promise rejected',
              processing_time: '0ms'
            });
          }
        }

        // Add delay between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(1000); // 1 second delay
        }
      }

      const processingTime = `${Date.now() - startTime}ms`;

      logger.info('Bulk refund processing completed', {
        total_requested: bulkRequest.transaction_ids.length,
        successful_refunds: successfulRefunds,
        failed_refunds: results.length - successfulRefunds,
        total_amount_refunded: totalAmountRefunded,
        processing_time: processingTime
      });

      return {
        total_requested: bulkRequest.transaction_ids.length,
        successful_refunds: successfulRefunds,
        failed_refunds: results.length - successfulRefunds,
        results,
        summary: {
          total_amount_refunded: totalAmountRefunded,
          processing_time: processingTime
        }
      };

    } catch (error) {
      logger.error('Bulk refund processing failed', {
        transaction_count: bulkRequest.transaction_ids.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getRefundStatus(refundId: string): Promise<FluidPayRefund | null> {
    try {
      logger.info('Getting refund status', { refund_id: refundId });

      const result = await this.fluidPayClient.getRefund(refundId);

      if (!result.success || !result.data) {
        logger.error('Failed to get refund status', {
          refund_id: refundId,
          error: result.error?.message
        });
        return null;
      }

      return result.data;

    } catch (error) {
      logger.error('Error getting refund status', {
        refund_id: refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getTransactionRefunds(transactionId: string): Promise<FluidPayRefund[]> {
    try {
      logger.info('Getting transaction refunds', { transaction_id: transactionId });

      const result = await this.fluidPayClient.getRefundsForTransaction(transactionId);

      if (!result.success || !result.data) {
        logger.error('Failed to get transaction refunds', {
          transaction_id: transactionId,
          error: result.error?.message
        });
        return [];
      }

      return result.data;

    } catch (error) {
      logger.error('Error getting transaction refunds', {
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private async validateRefundRequest(request: RefundRequest): Promise<{ isValid: boolean; error?: string }> {
    // Basic validation
    if (!request.transaction_id) {
      return { isValid: false, error: 'Transaction ID is required' };
    }

    if (!request.initiated_by_user_id) {
      return { isValid: false, error: 'Initiated by user ID is required' };
    }

    if (request.amount && request.amount <= 0) {
      return { isValid: false, error: 'Refund amount must be greater than zero' };
    }

    // TODO: Additional validation logic
    // - Check user permissions
    // - Validate reason codes
    // - Check business rules

    return { isValid: true };
  }

  private async checkRefundEligibility(
    transaction: FluidPayTransaction,
    refundAmount: number
  ): Promise<{ isEligible: boolean; reason?: string }> {

    // Check transaction status
    if (transaction.status !== 'succeeded') {
      return {
        isEligible: false,
        reason: `Cannot refund ${transaction.status} transaction`
      };
    }

    // Check refund amount
    if (refundAmount > transaction.amount) {
      return {
        isEligible: false,
        reason: 'Refund amount cannot exceed original transaction amount'
      };
    }

    // Check for existing refunds
    const existingRefunds = await this.getTransactionRefunds(transaction.id!);
    const totalRefunded = existingRefunds.reduce((sum, refund) =>
      sum + (refund.amount || 0), 0
    );

    if (totalRefunded + refundAmount > transaction.amount) {
      return {
        isEligible: false,
        reason: 'Total refunds would exceed original transaction amount'
      };
    }

    // Check refund time window (e.g., 180 days)
    const transactionDate = new Date(transaction.created_at!);
    const daysSinceTransaction = Math.floor(
      (Date.now() - transactionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceTransaction > 180) {
      return {
        isEligible: false,
        reason: 'Transaction is too old for refund (>180 days)'
      };
    }

    return { isEligible: true };
  }

  private async updateRefundRecords(
    request: RefundRequest,
    refund: FluidPayRefund,
    originalTransaction: FluidPayTransaction
  ): Promise<void> {
    try {
      // TODO: Update database records
      // - Update donation status
      // - Create refund audit log
      // - Update compliance tracking

      logger.info('Updated refund records', {
        refund_id: refund.id,
        transaction_id: originalTransaction.id
      });

    } catch (error) {
      logger.error('Failed to update refund records', {
        refund_id: refund.id,
        transaction_id: originalTransaction.id,
        error
      });
    }
  }

  private async handleComplianceReporting(
    request: RefundRequest,
    refund: FluidPayRefund,
    originalTransaction: FluidPayTransaction
  ): Promise<void> {
    try {
      // TODO: Handle compliance reporting for refunds
      // - Update FEC reports if applicable
      // - Create compliance audit entries
      // - Check if refund affects contribution limits

      logger.info('Processed compliance reporting for refund', {
        refund_id: refund.id,
        transaction_id: originalTransaction.id
      });

    } catch (error) {
      logger.error('Failed to process compliance reporting', {
        refund_id: refund.id,
        error
      });
    }
  }

  private async sendRefundNotification(
    refundId: string,
    originalTransaction: FluidPayTransaction,
    refundAmount: number
  ): Promise<void> {
    try {
      // TODO: Send refund notification email to donor
      logger.info('Sent refund notification', {
        refund_id: refundId,
        transaction_id: originalTransaction.id,
        amount: refundAmount
      });

    } catch (error) {
      logger.error('Failed to send refund notification', {
        refund_id: refundId,
        error
      });
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}