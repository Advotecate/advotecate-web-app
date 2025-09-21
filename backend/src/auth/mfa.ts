import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { MFASetup } from '../types/auth.js';

interface MFAConfig {
  serviceName: string;
  issuer: string;
  window: number; // Time window for token validity
}

class MFAService {
  private config: MFAConfig;

  constructor() {
    this.config = {
      serviceName: 'Advotecate',
      issuer: 'Advotecate Platform',
      window: 2 // Allow tokens from 2 time steps before/after current
    };

    // Configure authenticator options
    authenticator.options = {
      window: this.config.window
    };
  }

  async generateSecret(userEmail: string, userName?: string): Promise<MFASetup> {
    // Generate a secret key
    const secret = authenticator.generateSecret();

    // Create the label for the authenticator app
    const label = userName
      ? `${this.config.serviceName}:${userName} (${userEmail})`
      : `${this.config.serviceName}:${userEmail}`;

    // Generate the otpauth URL
    const otpauth = authenticator.keyuri(
      userEmail,
      this.config.issuer,
      secret
    );

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauth, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Generate backup codes
    const backupCodes = await this.generateBackupCodes();

    return {
      secret,
      qrCode,
      manualEntryKey: this.formatSecretForDisplay(secret),
      backupCodes
    };
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      // Remove any spaces or formatting from the token
      const cleanToken = token.replace(/\s/g, '');

      // Verify the token
      return authenticator.verify({
        token: cleanToken,
        secret
      });
    } catch (error) {
      console.error('MFA token verification failed:', error);
      return false;
    }
  }

  verifyBackupCode(code: string, encryptedBackupCodes: string[]): { valid: boolean; remainingCodes: string[] } {
    const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();

    for (let i = 0; i < encryptedBackupCodes.length; i++) {
      // In a real implementation, you'd decrypt and compare
      // For now, we'll assume the codes are stored hashed
      if (this.compareBackupCode(cleanCode, encryptedBackupCodes[i]!)) {
        // Remove the used backup code
        const remainingCodes = [...encryptedBackupCodes];
        remainingCodes.splice(i, 1);

        return {
          valid: true,
          remainingCodes
        };
      }
    }

    return {
      valid: false,
      remainingCodes: encryptedBackupCodes
    };
  }

  async generateBackupCodes(count: number = 8): Promise<string[]> {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character backup code
      const bytes = crypto.randomBytes(4);
      const code = bytes.toString('hex').toUpperCase();
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
      codes.push(formattedCode);
    }

    return codes;
  }

  hashBackupCodes(codes: string[]): string[] {
    return codes.map(code => {
      const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
      return crypto.createHash('sha256').update(cleanCode).digest('hex');
    });
  }

  private formatSecretForDisplay(secret: string): string {
    // Format secret in groups of 4 characters for easier manual entry
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  private compareBackupCode(inputCode: string, storedHash: string): boolean {
    const inputHash = crypto.createHash('sha256').update(inputCode).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  }

  // Utility method to validate MFA setup
  validateSetup(secret: string, userToken: string): boolean {
    return this.verifyToken(userToken, secret);
  }

  // Get current time-based code (for testing purposes)
  getCurrentToken(secret: string): string {
    return authenticator.generate(secret);
  }

  // Check if MFA is required based on user settings and risk assessment
  isMFARequired(userRole: string, riskScore: number = 0): boolean {
    // Super admins always require MFA
    if (userRole === 'super_admin') return true;

    // High-risk activities require MFA
    if (riskScore > 70) return true;

    // Organization admins require MFA for sensitive operations
    if (userRole === 'org_admin' && riskScore > 30) return true;

    return false;
  }

  // Generate emergency bypass code (for support purposes)
  generateEmergencyBypass(userId: string): { code: string; expires: Date } {
    const emergencyCode = crypto.randomBytes(16).toString('hex').toUpperCase();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // Valid for 24 hours

    return {
      code: `EMERGENCY-${emergencyCode}`,
      expires
    };
  }
}

export const mfaService = new MFAService();