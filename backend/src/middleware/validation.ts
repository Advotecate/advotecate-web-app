import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidatedRequest<T = any> extends Request {
  validatedData: T;
}

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body :
                   source === 'query' ? req.query :
                   req.params;

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors: ValidationError[] = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
        return;
      }

      // Attach validated data to request
      (req as ValidatedRequest<T>).validatedData = result.data;
      next();

    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

// Common validation schemas for Advotecate
export const ValidationSchemas = {
  // Authentication schemas
  login: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
    mfaToken: z.string().optional(),
    rememberMe: z.boolean().optional().default(false)
  }),

  register: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/\d/, 'Password must contain number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character'),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    streetAddress: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required').max(100),
    state: z.string().length(2, 'State must be 2 characters'),
    postalCode: z.string().min(5, 'Postal code is required').max(10),
    country: z.string().length(2).optional().default('US'),
    employer: z.string().max(255).optional(),
    occupation: z.string().max(255).optional(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number').optional()
  }),

  passwordReset: z.object({
    email: z.string().email('Invalid email address').toLowerCase()
  }),

  passwordResetConfirm: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/\d/, 'Password must contain number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character')
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/\d/, 'Password must contain number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character')
  }),

  // MFA schemas
  setupMFA: z.object({
    secret: z.string().min(1, 'Secret is required'),
    token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/)
  }),

  verifyMFA: z.object({
    token: z.string().min(6, 'Token is required').max(8)
  }),

  // User profile schemas
  updateProfile: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    streetAddress: z.string().min(1).optional(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().length(2).optional(),
    postalCode: z.string().min(5).max(10).optional(),
    employer: z.string().max(255).optional(),
    occupation: z.string().max(255).optional()
  }),

  // Organization schemas
  createOrganization: z.object({
    name: z.string().min(1, 'Organization name is required').max(255),
    legalName: z.string().min(1, 'Legal name is required').max(255),
    organizationType: z.enum([
      'candidate_committee',
      'pac',
      'super_pac',
      'party_committee',
      'nonprofit_501c3',
      'nonprofit_501c4'
    ]),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    website: z.string().url().optional(),
    streetAddress: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required').max(100),
    state: z.string().length(2, 'State must be 2 characters'),
    postalCode: z.string().min(5, 'Postal code is required').max(10),
    country: z.string().length(2).optional().default('US'),
    fecId: z.string().max(20).optional(),
    ein: z.string().max(20).optional(),
    stateFilingId: z.string().max(50).optional()
  }),

  updateOrganization: z.object({
    name: z.string().min(1).max(255).optional(),
    legalName: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    website: z.string().url().optional(),
    streetAddress: z.string().min(1).optional(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().length(2).optional(),
    postalCode: z.string().min(5).max(10).optional(),
    fecId: z.string().max(20).optional(),
    ein: z.string().max(20).optional(),
    stateFilingId: z.string().max(50).optional()
  }),

  // Fundraiser schemas
  createFundraiser: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    slug: z.string().min(1, 'URL slug is required').max(255)
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
    goalAmount: z.number().positive('Goal amount must be positive').optional(),
    minimumDonation: z.number().positive('Minimum donation must be positive').default(1),
    maximumDonation: z.number().positive('Maximum donation must be positive').optional(),
    suggestedAmounts: z.array(z.number().positive()).max(10).optional(),
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date').optional(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    allowAnonymous: z.boolean().default(false),
    requireAddress: z.boolean().default(true),
    requireEmployerInfo: z.boolean().default(true),
    allowRecurring: z.boolean().default(true)
  }).refine(data => {
    if (data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  }, {
    message: 'End date must be after start date',
    path: ['endDate']
  }),

  updateFundraiser: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    goalAmount: z.number().positive().optional(),
    minimumDonation: z.number().positive().optional(),
    maximumDonation: z.number().positive().optional(),
    suggestedAmounts: z.array(z.number().positive()).max(10).optional(),
    endDate: z.string().datetime().optional(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    allowAnonymous: z.boolean().optional(),
    requireAddress: z.boolean().optional(),
    requireEmployerInfo: z.boolean().optional(),
    allowRecurring: z.boolean().optional(),
    status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional()
  }),

  // Donation schemas
  createDonation: z.object({
    fundraiserId: z.string().uuid('Invalid fundraiser ID'),
    amount: z.number().positive('Donation amount must be positive').max(10000, 'Donation amount too large'),
    isRecurring: z.boolean().default(false),
    recurringFrequency: z.enum(['monthly', 'quarterly', 'annually']).optional(),
    isAnonymous: z.boolean().default(false),
    paymentMethodToken: z.string().min(1, 'Payment method is required'),
    donorEmployer: z.string().max(255).optional(),
    donorOccupation: z.string().max(255).optional()
  }).refine(data => {
    if (data.isRecurring && !data.recurringFrequency) {
      return false;
    }
    return true;
  }, {
    message: 'Recurring frequency is required for recurring donations',
    path: ['recurringFrequency']
  }),

  // Query parameter schemas
  paginationQuery: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),

  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    dateField: z.enum(['created_at', 'updated_at', 'completed_at']).default('created_at')
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  }, {
    message: 'End date must be after or equal to start date'
  }),

  // ID parameter schemas
  uuidParam: z.object({
    id: z.string().uuid('Invalid ID format')
  }),

  slugParam: z.object({
    slug: z.string().min(1, 'Slug is required')
  })
};

// Validation middleware shortcuts
export const validateLogin = validate(ValidationSchemas.login);
export const validateRegister = validate(ValidationSchemas.register);
export const validatePasswordReset = validate(ValidationSchemas.passwordReset);
export const validatePasswordResetConfirm = validate(ValidationSchemas.passwordResetConfirm);
export const validateChangePassword = validate(ValidationSchemas.changePassword);
export const validateSetupMFA = validate(ValidationSchemas.setupMFA);
export const validateVerifyMFA = validate(ValidationSchemas.verifyMFA);
export const validateUpdateProfile = validate(ValidationSchemas.updateProfile);
export const validateCreateOrganization = validate(ValidationSchemas.createOrganization);
export const validateUpdateOrganization = validate(ValidationSchemas.updateOrganization);
export const validateCreateFundraiser = validate(ValidationSchemas.createFundraiser);
export const validateUpdateFundraiser = validate(ValidationSchemas.updateFundraiser);
export const validateCreateDonation = validate(ValidationSchemas.createDonation);

export const validatePaginationQuery = validate(ValidationSchemas.paginationQuery, 'query');
export const validateDateRangeQuery = validate(ValidationSchemas.dateRangeQuery, 'query');
export const validateUuidParam = validate(ValidationSchemas.uuidParam, 'params');
export const validateSlugParam = validate(ValidationSchemas.slugParam, 'params');

// Custom validation helpers
export function sanitizeInput<T>(data: T): T {
  if (typeof data === 'string') {
    return data.trim() as T;
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return data;
}