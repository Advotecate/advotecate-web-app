import {
  Fundraiser,
  Organization,
  Donation,
  CreateDonationRequest,
  ComplianceResult,
  ComplianceCheckRequest,
  APIError
} from '@/types/api'

class APIClient {
  private baseURL: string
  private headers: HeadersInit

  constructor() {
    // Use import.meta.env for Vite environment variables with fallback
    const apiUrl = import.meta?.env?.VITE_API_URL
      || 'https://advotecate-api-367966088269.us-central1.run.app/api/v1'

    this.baseURL = apiUrl
    this.headers = {
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    try {
      const response = await fetch(url, {
        headers: { ...this.headers, ...options.headers },
        ...options,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }

  // Fundraiser endpoints
  async getFundraiser(slug: string): Promise<Fundraiser> {
    return this.request(`/fundraisers/${slug}`)
  }

  async getOrganization(id: string): Promise<Organization> {
    return this.request(`/organizations/${id}`)
  }

  // Donation endpoints
  async createDonation(data: CreateDonationRequest): Promise<Donation> {
    return this.request('/donations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getDonation(id: string): Promise<Donation> {
    return this.request(`/donations/${id}`)
  }

  // Compliance endpoints
  async checkCompliance(data: ComplianceCheckRequest): Promise<ComplianceResult> {
    return this.request('/compliance/check', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health')
  }
}

export const apiClient = new APIClient()

// Error handling utility
export function isAPIError(error: any): error is APIError {
  return error && typeof error.message === 'string'
}

export function getErrorMessage(error: any): string {
  if (isAPIError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}
