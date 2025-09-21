import { Router } from 'express';
import { authenticate, requireMFA } from '../middleware/auth.js';
import {
  validateLogin,
  validateRegister,
  validatePasswordReset,
  validatePasswordResetConfirm,
  validateChangePassword,
  validateSetupMFA,
  validateVerifyMFA
} from '../middleware/validation.js';
import { AuthController } from '../controllers/auth.js';

const router = Router();
const authController = new AuthController();

// Public authentication endpoints
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

// Password reset flow
router.post('/forgot-password', validatePasswordReset, authController.forgotPassword);
router.post('/reset-password', validatePasswordResetConfirm, authController.resetPassword);

// MFA endpoints
router.post('/mfa/setup', authenticate(), authController.setupMFA);
router.post('/mfa/confirm-setup', authenticate(), validateSetupMFA, authController.confirmMFASetup);
router.post('/mfa/verify', validateVerifyMFA, authController.verifyMFA);
router.post('/mfa/disable', authenticate(), requireMFA, authController.disableMFA);
router.post('/mfa/regenerate-backup-codes', authenticate(), requireMFA, authController.regenerateBackupCodes);

// Authenticated user management
router.post('/change-password', authenticate(), validateChangePassword, authController.changePassword);
router.get('/me', authenticate(), authController.getCurrentUser);
router.get('/sessions', authenticate(), authController.getUserSessions);
router.delete('/sessions/:sessionId', authenticate(), authController.terminateSession);
router.delete('/sessions', authenticate(), authController.terminateAllSessions);

// Email verification
router.post('/verify-email', authenticate(), authController.sendEmailVerification);
router.get('/verify-email/:token', authController.verifyEmail);

// Phone verification
router.post('/verify-phone', authenticate(), authController.sendPhoneVerification);
router.post('/verify-phone/confirm', authenticate(), authController.confirmPhoneVerification);

export default router;