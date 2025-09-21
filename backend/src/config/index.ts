import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  node_env: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().default(3001),

  database: z.object({
    url: z.string(),
  }),

  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string(),
    serviceRoleKey: z.string(),
  }),

  redis: z.object({
    url: z.string(),
  }),

  jwt: z.object({
    accessSecret: z.string(),
    refreshSecret: z.string(),
    accessExpiresIn: z.string().default('15m'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  encryption: z.object({
    key: z.string().min(32, 'Encryption key must be at least 32 characters'),
  }),

  fluidpay: z.object({
    apiKey: z.string(),
    secretKey: z.string(),
    webhookSecret: z.string(),
    environment: z.enum(['sandbox', 'production']).default('sandbox'),
  }),

  app: z.object({
    frontendUrl: z.string().url(),
  }),

  compliance: z.object({
    platformFeePercentage: z.coerce.number().default(2.9),
    platformFeeFixed: z.coerce.number().default(0.30),
    donationLimitIndividualAnnual: z.coerce.number().default(2900),
    donationLimitIndividualElection: z.coerce.number().default(3300),
  }),

  security: z.object({
    bcryptRounds: z.coerce.number().default(12),
    sessionTtlHours: z.coerce.number().default(24),
    rateLimitWindowMinutes: z.coerce.number().default(60),
    rateLimitMaxRequests: z.coerce.number().default(1000),
  }),
});

const envVars = {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,

  database: {
    url: process.env.DATABASE_URL,
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  fluidpay: {
    apiKey: process.env.FLUIDPAY_API_KEY,
    secretKey: process.env.FLUIDPAY_SECRET_KEY,
    webhookSecret: process.env.FLUIDPAY_WEBHOOK_SECRET,
    environment: process.env.FLUIDPAY_ENVIRONMENT,
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  compliance: {
    platformFeePercentage: process.env.PLATFORM_FEE_PERCENTAGE,
    platformFeeFixed: process.env.PLATFORM_FEE_FIXED,
    donationLimitIndividualAnnual: process.env.DONATION_LIMIT_INDIVIDUAL_ANNUAL,
    donationLimitIndividualElection: process.env.DONATION_LIMIT_INDIVIDUAL_ELECTION,
  },

  security: {
    bcryptRounds: process.env.BCRYPT_ROUNDS,
    sessionTtlHours: process.env.SESSION_TTL_HOURS,
    rateLimitWindowMinutes: process.env.RATE_LIMIT_WINDOW_MINUTES,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  },
};

export const config = configSchema.parse(envVars);