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
  type: 'POLITICAL' | 'PAC' | 'NONPROFIT' | 'nonprofit'
  isActive: boolean
  isVerified?: boolean
  fecId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Donation {
  id: string
  amount: number
  recurring?: boolean
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  donorId?: string
  donorName: string
  isAnonymous: boolean
  message?: string
  fundraiserId: string
  organizationId?: string
  paymentMethodId?: string
  transactionId?: string
  processorTransactionId?: string
  failureReason?: string
  createdAt: Date
  updatedAt?: Date
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

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  createOrganization?: boolean
  organizationName?: string
  organizationType?: 'POLITICAL' | 'PAC' | 'NONPROFIT'
}

export interface OrganizationMember {
  id: string
  userId: string
  organizationId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  joinedAt: Date
  user: User
}

export interface UserOrganization {
  id: string
  organizationId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  organization: Organization
}

export interface Event {
  id: string
  slug: string
  title: string
  description: string
  eventType: 'PHONE_BANK' | 'CANVASS' | 'VOLUNTEER' | 'RALLY' | 'FUNDRAISER' | 'TRAINING' | 'MEETING'
  organizationId: string
  organizationName?: string
  startTime: Date
  endTime: Date
  timeZone: string
  location?: {
    name?: string
    address: string
    city: string
    state: string
    zipCode: string
    isVirtual: boolean
    virtualLink?: string
  }
  maxAttendees?: number
  currentAttendees: number
  isPublic: boolean
  requiresApproval: boolean
  instructions?: string
  contactEmail?: string
  contactPhone?: string
  imageUrl?: string
  tags: string[]
  accessibility?: {
    wheelchairAccessible: boolean
    publicTransitAccessible: boolean
    childFriendly: boolean
    notes?: string
  }
  createdAt: Date
  updatedAt: Date
}