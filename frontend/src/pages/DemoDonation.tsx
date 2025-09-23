import { DonationForm } from '../components/donation/donation-form'
import type { Fundraiser, Organization } from '../types/api'

// Mock data for demo
const mockFundraiser: Fundraiser = {
  id: 'fundraiser-123',
  slug: 'save-democracy-2024',
  title: 'Save Democracy 2024',
  description: 'Help protect democracy and ensure fair elections in 2024. Your contribution will support voter registration drives, election security initiatives, and civic education programs.',
  imageUrl: '/fundraiser-image.jpg',
  organizationId: 'org-456',
  goalAmount: 100000,
  currentAmount: 45000,
  suggestedAmounts: [25, 50, 100, 250, 500, 1000],
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-09-21'),
}

const mockOrganization: Organization = {
  id: 'org-456',
  name: 'Democracy Action Fund',
  slug: 'democracy-action-fund',
  description: 'A non-profit organization dedicated to protecting democratic institutions and ensuring fair elections.',
  logoUrl: '/org-logo.png',
  websiteUrl: 'https://democracyactionfund.org',
  type: 'NONPROFIT',
  isVerified: true,
  fecId: 'C00123456',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2024-09-21'),
}

export default function DemoDonation() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            DEMO MODE - No real payments will be processed
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {mockFundraiser.title}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {mockFundraiser.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Fundraiser Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Campaign Progress</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Raised: ${mockFundraiser.currentAmount.toLocaleString()}</span>
                  <span>Goal: ${mockFundraiser.goalAmount.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-mint-600 h-2 rounded-full"
                    style={{ width: `${(mockFundraiser.currentAmount / mockFundraiser.goalAmount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {Math.round((mockFundraiser.currentAmount / mockFundraiser.goalAmount) * 100)}% of goal reached
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">About {mockOrganization.name}</h2>
              <p className="text-gray-600 mb-4">{mockOrganization.description}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-mint-600 rounded-full mr-2" />
                  Verified Organization
                </div>
                <div>FEC ID: {mockOrganization.fecId}</div>
              </div>
            </div>
          </div>

          {/* Donation Form */}
          <div>
            <DonationForm
              fundraiser={mockFundraiser}
              organization={mockOrganization}
            />
          </div>
        </div>
      </div>
    </div>
  )
}