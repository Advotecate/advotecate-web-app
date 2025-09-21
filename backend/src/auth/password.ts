import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { config } from '../config/index.js';

// Strong password requirements schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
  .refine((password) => !isCommonPassword(password), 'Password is too common');

export interface PasswordHash {
  hash: string;
  salt: string;
}

export interface PasswordStrength {
  score: number; // 0-100
  isStrong: boolean;
  suggestions: string[];
  estimatedCrackTime: string;
}

class PasswordService {
  private readonly saltRounds = config.security.bcryptRounds;

  async hashPassword(password: string): Promise<string> {
    // Validate password strength first
    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      throw new Error(validation.error.errors[0]?.message || 'Invalid password');
    }

    // Generate salt and hash
    const salt = await bcrypt.genSalt(this.saltRounds);
    const hash = await bcrypt.hash(password, salt);

    return hash;
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateResetToken(): { token: string; expires: Date } {
    const token = this.generateSecureToken(32);
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 30); // 30 minutes

    return { token, expires };
  }

  checkPasswordStrength(password: string): PasswordStrength {
    let score = 0;
    const suggestions: string[] = [];

    // Length scoring
    if (password.length >= 8) score += 15;
    else suggestions.push('Use at least 8 characters');

    if (password.length >= 12) score += 10;
    else if (password.length >= 8) suggestions.push('Consider using 12+ characters for better security');

    // Character variety
    if (/[a-z]/.test(password)) {
      score += 10;
    } else {
      suggestions.push('Add lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      score += 10;
    } else {
      suggestions.push('Add uppercase letters');
    }

    if (/\d/.test(password)) {
      score += 10;
    } else {
      suggestions.push('Add numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 15;
    } else {
      suggestions.push('Add special characters (!@#$%^&*)');
    }

    // Bonus for additional variety
    const uniqueChars = new Set(password).size;
    if (uniqueChars > password.length * 0.7) score += 10;

    // Penalties
    if (/(.)\1{2,}/.test(password)) {
      score -= 15;
      suggestions.push('Avoid repeating characters');
    }

    if (/123|abc|qwerty|password/i.test(password)) {
      score -= 25;
      suggestions.push('Avoid common patterns and words');
    }

    if (isCommonPassword(password)) {
      score -= 30;
      suggestions.push('Avoid common passwords');
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const isStrong = finalScore >= 70;

    return {
      score: finalScore,
      isStrong,
      suggestions: isStrong ? [] : suggestions,
      estimatedCrackTime: this.estimateCrackTime(finalScore)
    };
  }

  private estimateCrackTime(score: number): string {
    if (score < 25) return 'Less than 1 minute';
    if (score < 50) return 'Less than 1 hour';
    if (score < 70) return 'Less than 1 day';
    if (score < 85) return 'Several months';
    return 'Many years';
  }

  validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
    const validation = passwordSchema.safeParse(password);

    if (validation.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: validation.error.errors.map(err => err.message)
    };
  }
}

// Common password check - in production, use a comprehensive list or service
function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'letmein',
    'welcome', 'monkey', '1234567890', 'qwerty', 'abc123',
    'Password1', 'password1', 'Passw0rd', 'Password123',
    'welcome123', 'admin123', 'root', 'toor', 'pass',
    'test', 'guest', 'user', 'login', 'changeme'
  ];

  return commonPasswords.includes(password.toLowerCase());
}

export const passwordService = new PasswordService();