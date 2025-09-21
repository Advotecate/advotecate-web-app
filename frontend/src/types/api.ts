export interface Fundraiser {
  id: string
  slug: string
  title: string
  description: string
  imageUrl?: string
  organizationId: string
  goalAmount: number
  currentAmount: number
  suggestedAmounts: number[]
  isActive: boolean
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Organization {
  id: string
  name: string
  slug: string
  description: string
  logoUrl?: string
  websiteUrl?: string
  type: 'POLITICAL' | 'PAC' | 'NONPROFIT'
  isVerified: boolean
  fecId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Donation {
  id: string
  amount: number
  recurring: boolean
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  donorId: string
  fundraiserId: string
  organizationId: string
  paymentMethodId?: string
  transactionId?: string
  processorTransactionId?: string
  failureReason?: string
  createdAt: Date
  updatedAt: Date
}

export interface DonorInfo {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address: string
  city: string
  state: string
  zipCode: string
  employer?: string
  occupation?: string
}

export interface ComplianceResult {
  allowed: boolean
  reason?: string
  warnings?: string[]
  remainingLimit?: number
  requiresEmployerInfo: boolean
  disclosureRequired: boolean
}

export interface CreateDonationRequest {
  amount: number
  recurring: boolean
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  fundraiserId: string
  organizationId: string
  donorInfo: DonorInfo
  paymentMethod: {
    type: 'card'
    cardNumber: string
    expiryMonth: string
    expiryYear: string
    cvc: string
  }
}

export interface APIError {
  message: string
  code?: string
  details?: any
}