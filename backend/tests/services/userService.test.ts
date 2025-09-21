/**
 * UserService Test Suite
 *
 * Comprehensive tests for user management functionality
 */

import { UserService } from '../../src/services/business/userService.js';
import { UserRepository } from '../../src/services/database/repositories/userRepository.js';
import { DatabaseService } from '../../src/services/database/index.js';
import { testUtils } from '../setup.js';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: UserRepository;
  let dbService: DatabaseService;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    userRepository = new UserRepository(dbService);
    userService = new UserService(userRepository);
  });

  afterEach(async () => {
    // Clean up after each test
    await testUtils.cleanup();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test-user@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890'
      };

      const result = await userService.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(userData.email);
      expect(result.user?.firstName).toBe(userData.firstName);
      expect(result.user?.lastName).toBe(userData.lastName);
      expect(result.token).toBeDefined();
    });

    it('should not register user with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // Register first user
      await userService.registerUser(userData);

      // Attempt to register duplicate
      const result = await userService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('email already exists');
    });

    it('should validate password strength', async () => {
      const userData = {
        email: 'test-weak-password@example.com',
        password: '123', // Weak password
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await userService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('password');
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await userService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await userService.registerUser({
        email: 'login-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Login',
        lastName: 'Test'
      });
    });

    it('should login user with correct credentials', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'SecurePassword123!'
      };

      const result = await userService.loginUser(loginData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(loginData.email);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should not login with incorrect password', async () => {
      const loginData = {
        email: 'login-test@example.com',
        password: 'WrongPassword123!'
      };

      const result = await userService.loginUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should not login non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!'
      };

      const result = await userService.loginUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const registerResult = await userService.registerUser({
        email: 'get-user-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'GetUser',
        lastName: 'Test'
      });

      const userId = registerResult.user!.id;
      const user = await userService.getUserById(userId);

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe('get-user-test@example.com');
    });

    it('should return null for non-existent user ID', async () => {
      const user = await userService.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    let testUserId: string;

    beforeEach(async () => {
      const result = await userService.registerUser({
        email: 'update-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Update',
        lastName: 'Test'
      });
      testUserId = result.user!.id;
    });

    it('should update user profile successfully', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'User',
        phone: '+1987654321'
      };

      const result = await userService.updateUserProfile(testUserId, updates);

      expect(result.success).toBe(true);
      expect(result.user?.firstName).toBe('Updated');
      expect(result.user?.lastName).toBe('User');
      expect(result.user?.phone).toBe('+1987654321');
    });

    it('should not update non-existent user', async () => {
      const updates = {
        firstName: 'Updated'
      };

      const result = await userService.updateUserProfile('non-existent-id', updates);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });
  });
});