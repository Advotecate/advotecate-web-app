import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { config } from '../config/index.js';
import { UserPayload, TokenPair } from '../types/auth.js';

class JWTService {
  private accessTokenSecret: Uint8Array;
  private refreshTokenSecret: Uint8Array;
  private accessTokenExpiry = config.jwt.accessExpiresIn;
  private refreshTokenExpiry = config.jwt.refreshExpiresIn;

  constructor() {
    this.accessTokenSecret = new TextEncoder().encode(config.jwt.accessSecret);
    this.refreshTokenSecret = new TextEncoder().encode(config.jwt.refreshSecret);
  }

  async generateTokenPair(payload: UserPayload): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    // Generate access token
    const accessToken = await new SignJWT({
      ...payload,
      type: 'access',
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(this.accessTokenExpiry)
      .setIssuer('advotecate-platform')
      .setAudience('advotecate-api')
      .setSubject(payload.userId)
      .sign(this.accessTokenSecret);

    // Generate refresh token (minimal payload for security)
    const refreshToken = await new SignJWT({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId,
      type: 'refresh',
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(this.refreshTokenExpiry)
      .setIssuer('advotecate-platform')
      .setAudience('advotecate-api')
      .setSubject(payload.userId)
      .sign(this.refreshTokenSecret);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(this.accessTokenExpiry)
    };
  }

  async verifyAccessToken(token: string): Promise<UserPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.accessTokenSecret, {
        issuer: 'advotecate-platform',
        audience: 'advotecate-api'
      });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Validate token structure
      const userPayload: UserPayload = {
        userId: payload.userId as string,
        email: payload.email as string,
        role: payload.role as string,
        kycStatus: payload.kycStatus as string,
        organizations: payload.organizations as string[],
        permissions: payload.permissions as string[],
        sessionId: payload.sessionId as string
      };

      return userPayload;
    } catch (error) {
      console.error('Access token verification failed:', error);
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string; email: string; sessionId?: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.refreshTokenSecret, {
        issuer: 'advotecate-platform',
        audience: 'advotecate-api'
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return {
        userId: payload.userId as string,
        email: payload.email as string,
        sessionId: payload.sessionId as string
      };
    } catch (error) {
      console.error('Refresh token verification failed:', error);
      return null;
    }
  }

  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return await new SignJWT({
      userId,
      email,
      type: 'password_reset',
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime('30m') // 30 minutes
      .setIssuer('advotecate-platform')
      .setAudience('advotecate-api')
      .setSubject(userId)
      .sign(this.accessTokenSecret);
  }

  async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.accessTokenSecret, {
        issuer: 'advotecate-platform',
        audience: 'advotecate-api'
      });

      if (payload.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }

      return {
        userId: payload.userId as string,
        email: payload.email as string
      };
    } catch (error) {
      console.error('Password reset token verification failed:', error);
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }

  // Utility method to check if token is about to expire
  isTokenExpiringSoon(token: string, bufferMinutes: number = 5): boolean {
    try {
      const [, payloadBase64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds

      return (expirationTime - currentTime) <= bufferTime;
    } catch (error) {
      return true; // Assume expiring if we can't parse
    }
  }
}

export const jwtService = new JWTService();