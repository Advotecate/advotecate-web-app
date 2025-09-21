/**
 * Test Setup Configuration
 *
 * Global setup for all tests including database, mocks, and test utilities
 */

import { DatabaseService } from '../src/services/database/index.js';
import { logger } from '../src/middleware/logging.js';

// Mock logger for tests to reduce noise
jest.mock('../src/middleware/logging.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Global test setup
beforeAll(async () => {
  // Initialize test database
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/advotecate_test';

  // Initialize database service for tests
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.healthCheck();
    logger.info('Test database initialized');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  // Clean up database connections
  try {
    const dbService = DatabaseService.getInstance();
    await dbService.close();
  } catch (error) {
    console.error('Error closing test database:', error);
  }
});

// Test utilities
export const testUtils = {
  /**
   * Create a test user for authenticated requests
   */
  async createTestUser() {
    // Implementation would go here
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    };
  },

  /**
   * Create a test organization
   */
  async createTestOrganization() {
    return {
      id: 'test-org-id',
      name: 'Test Organization',
      slug: 'test-org',
      type: 'campaign' as const
    };
  },

  /**
   * Create a test fundraiser
   */
  async createTestFundraiser() {
    return {
      id: 'test-fundraiser-id',
      title: 'Test Fundraiser',
      slug: 'test-fundraiser',
      organizationId: 'test-org-id',
      goalAmount: 10000
    };
  },

  /**
   * Clean up test data
   */
  async cleanup() {
    // Implementation would clean up test data from database
    const dbService = DatabaseService.getInstance();

    // Clean up in reverse dependency order
    await dbService.query('DELETE FROM donations WHERE donor_email LIKE %test%');
    await dbService.query('DELETE FROM fundraisers WHERE slug LIKE test-%');
    await dbService.query('DELETE FROM organizations WHERE slug LIKE test-%');
    await dbService.query('DELETE FROM users WHERE email LIKE %test%');
  }
};