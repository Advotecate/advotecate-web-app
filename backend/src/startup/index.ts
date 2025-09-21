/**
 * Application Startup Orchestrator
 *
 * Handles the complete application startup sequence with proper error handling
 * and service initialization order.
 */

import { logger } from '../middleware/logging.js';
import { DatabaseService } from '../services/database/index.js';
import { initializeFluidPayServices } from './fluidpay.js';

/**
 * Application startup sequence
 */
export async function startupApplication(): Promise<void> {
  logger.info('🚀 Starting Advotecate Backend Application');

  try {
    // 1. Initialize Database Services
    logger.info('📊 Initializing database services...');
    await initializeDatabaseServices();

    // 2. Initialize FluidPay Payment Services
    logger.info('💳 Initializing FluidPay payment services...');
    await initializeFluidPayServices();

    // 3. Initialize Additional Services (Future)
    logger.info('🔧 Initializing additional services...');
    await initializeAdditionalServices();

    // 4. Startup Complete
    logger.info('✅ Application startup completed successfully');

  } catch (error) {
    logger.error('❌ Application startup failed', { error });
    throw error;
  }
}

/**
 * Initialize database services
 */
async function initializeDatabaseServices(): Promise<void> {
  try {
    const dbService = DatabaseService.getInstance();

    // Test database connection
    await dbService.healthCheck();

    logger.info('Database services initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed', { error });
    throw new Error('Database services failed to initialize');
  }
}

/**
 * Initialize additional services (placeholder for future services)
 */
async function initializeAdditionalServices(): Promise<void> {
  try {
    // Future services initialization will go here:
    // - Redis cache
    // - Email services
    // - File upload services
    // - External API integrations

    logger.info('Additional services initialized successfully');
  } catch (error) {
    logger.error('Additional services initialization failed', { error });
    // For now, don't fail startup for additional services
    logger.warn('Continuing without some additional services');
  }
}

/**
 * Graceful shutdown handler
 */
export async function shutdownApplication(): Promise<void> {
  logger.info('🛑 Initiating graceful application shutdown');

  try {
    // Close database connections
    const dbService = DatabaseService.getInstance();
    await dbService.close();

    // Additional cleanup will go here
    // - Close Redis connections
    // - Cancel pending operations
    // - Save application state

    logger.info('✅ Application shutdown completed successfully');
  } catch (error) {
    logger.error('❌ Error during application shutdown', { error });
  }
}

/**
 * Setup process event handlers
 */
export function setupProcessHandlers(): void {
  // Graceful shutdown on SIGTERM (e.g., from process managers)
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, initiating graceful shutdown');
    await shutdownApplication();
    process.exit(0);
  });

  // Graceful shutdown on SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, initiating graceful shutdown');
    await shutdownApplication();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception occurred', { error });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason, promise });
    process.exit(1);
  });
}