import { z } from 'zod'

export const donationSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least $1').max(5000, 'Amount cannot exceed $5,000'),
  recurring: z.boolean().default(false),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),

  // Donor information
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'Please select a state').max(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code'),

  // Compliance fields
  employer: z.string().optional(),
  occupation: z.string().optional(),

  // Payment method
  paymentMethod: z.object({
    type: z.literal('card'),
    cardNumber: z.string().min(13, 'Please enter a valid card number'),
    expiryMonth: z.string().min(2, 'Please enter expiry month').max(2),
    expiryYear: z.string().min(2, 'Please enter expiry year').max(2),
    cvc: z.string().min(3, 'Please enter CVC').max(4),
  })
})

export type DonationFormData = z.infer<typeof donationSchema>

export const complianceCheckSchema = z.object({
  amount: z.number().min(0),
  donorIdentifier: z.string().min(1),
  organizationId: z.string().min(1),
  donorInfo: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
})

export type ComplianceCheckRequest = z.infer<typeof complianceCheckSchema>