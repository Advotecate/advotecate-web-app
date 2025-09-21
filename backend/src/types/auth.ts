export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  kycStatus: string;
  organizations: string[];
  permissions: string[];
  sessionId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
  backupCodes: string[];
}

export interface AuthRequest {
  email: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  employer?: string;
  occupation?: string;
  phone?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  organizations: string[];
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  sessionFlags: string[];
}

export type AuthEvent =
  | 'login_success'
  | 'login_failure'
  | 'mfa_required'
  | 'mfa_success'
  | 'mfa_failure'
  | 'password_reset'
  | 'password_changed'
  | 'logout'
  | 'token_refresh'
  | 'suspicious_activity';

export interface SecurityEvent {
  type: AuthEvent;
  userId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  riskScore?: number;
}