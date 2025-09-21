/**
 * FluidPay Startup Integration
 *
 * Handles FluidPay service initialization during application startup
 * Ensures all payment services are ready before handling requests
 */

import { FluidPayServiceFactory, createFluidPayConfig } from '../services/fluidpay/index.js';
import { logger } from '../middleware/logging.js';

/**
 * Initialize FluidPay services during application startup
 */
export async function initializeFluidPayServices(): Promise<void> {
  try {
    logger.info('Starting FluidPay service initialization...');

    // Determine environment
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';

    // Create configuration from environment variables
    const config = createFluidPayConfig(environment);

    // Get factory instance and initialize services
    const factory = FluidPayServiceFactory.getInstance();
    await factory.initialize(config);

    // Perform health check
    const health = await factory.healthCheck();

    if (!health.fluidpay_api || !health.services_initialized) {
      throw new Error('FluidPay services failed health check');
    }

    logger.info('FluidPay services initialized successfully', {
      environment: config.environment,
      baseUrl: config.baseUrl,
      healthCheck: health
    });

  } catch (error) {
    logger.error('Failed to initialize FluidPay services', { error });

    // In production, we might want to fail fast
    if (process.env.NODE_ENV === 'production') {
      logger.error('FluidPay initialization failure in production - shutting down');
      process.exit(1);
    }

    // In development, we can continue without FluidPay services
    logger.warn('Continuing without FluidPay services in development mode');
  }
}

/**
 * Verify FluidPay services are ready for handling requests
 */
export function ensureFluidPayReady(): boolean {
  try {
    const factory = FluidPayServiceFactory.getInstance();
    return factory.isInitialized();
  } catch (error) {
    logger.warn('FluidPay services not available', { error });
    return false;
  }
}

/**
 * Get FluidPay services with error handling
 */
export function getFluidPayServices() {
  try {
    const factory = FluidPayServiceFactory.getInstance();
    return factory.getServices();
  } catch (error) {
    logger.error('Failed to get FluidPay services', { error });
    throw new Error('FluidPay services not available');
  }
}

/**
 * Middleware to ensure FluidPay services are available for payment endpoints
 */
export function requireFluidPay() {
  return (req: any, res: any, next: any) => {
    if (!ensureFluidPayReady()) {
      logger.warn('FluidPay services not available for request', {
        path: req.path,
        method: req.method
      });

      return res.status(503).json({
        error: 'Payment services temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    next();
  };
}