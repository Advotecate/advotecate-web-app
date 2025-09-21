/**
 * Jest Global Setup
 *
 * Runs once before all test suites
 */

export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

  // Set test database URL if not already set
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/advotecate_test';
  }

  // Mock FluidPay services in test environment
  process.env.FLUIDPAY_API_KEY = 'test_api_key';
  process.env.FLUIDPAY_API_SECRET = 'test_api_secret';
  process.env.FLUIDPAY_WEBHOOK_SECRET = 'test_webhook_secret';

  console.log('🧪 Jest global setup completed');
}