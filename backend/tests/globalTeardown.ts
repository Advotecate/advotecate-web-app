/**
 * Jest Global Teardown
 *
 * Runs once after all test suites complete
 */

export default async function globalTeardown() {
  // Clean up any global resources
  // Force close any remaining database connections

  console.log('🧪 Jest global teardown completed');
}