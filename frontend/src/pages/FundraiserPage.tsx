import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AppLayout from '../components/AppLayout'
import type { Fundraiser, Organization, Donation } from '../types/api'

export default function FundraiserPage() {
  const { orgSlug, fundraiserSlug } = useParams<{ orgSlug: string; fundraiserSlug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>('VIEWER')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'donations' | 'settings'>('overview')

  useEffect(() => {
    const loadFundraiser = async () => {
      if (!orgSlug || !fundraiserSlug) return

      try {
        setIsLoading(true)

        // Mock API calls - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Mock fundraiser data
        const mockFundraiser: Fundraiser = {
          id: 'fundraiser_1',
          organizationId: 'org_1',
          slug: fundraiserSlug,
          title: 'Help Fund Our Community Center',
          description: 'We are raising funds to build a new community center that will serve families in our neighborhood. This center will provide after-school programs, senior services, and community events. Your donation will help us purchase equipment, hire staff, and maintain the facility for years to come.',
          goalAmount: 50000,
          currentAmount: 32500,
          suggestedAmounts: [25, 50, 100, 250, 500, 1000],
          isActive: true,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20'),
          imageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
          endDate: new Date('2024-12-31'),
        }

        const mockOrganization: Organization = {
          id: 'org_1',
          name: 'Community Action Network',
          slug: orgSlug,
          description: 'Building stronger communities through collaborative action and mutual aid.',
          type: 'nonprofit',
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          websiteUrl: 'https://can.org',
          logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=200'
        }

        const mockDonations: Donation[] = [
          {
            id: 'donation_1',
            fundraiserId: 'fundraiser_1',
            donorName: 'Sarah Johnson',
            amount: 250,
            message: 'So excited to support this important cause!',
            isAnonymous: false,
            createdAt: new Date('2024-01-20'),
          },
          {
            id: 'donation_2',
            fundraiserId: 'fundraiser_1',
            donorName: 'Anonymous',
            amount: 500,
            message: '',
            isAnonymous: true,
            createdAt: new Date('2024-01-19'),
          },
          {
            id: 'donation_3',
            fundraiserId: 'fundraiser_1',
            donorName: 'Michael Chen',
            amount: 100,
            message: 'Great work, looking forward to seeing the center!',
            isAnonymous: false,
            createdAt: new Date('2024-01-18'),
          },
        ]

        setFundraiser(mockFundraiser)
        setOrganization(mockOrganization)
        setDonations(mockDonations)
        setUserRole('ADMIN') // Mock user role
      } catch (err) {
        setError('Failed to load fundraiser')
      } finally {
        setIsLoading(false)
      }
    }

    loadFundraiser()
  }, [orgSlug, fundraiserSlug])

  const getProgressPercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500'
    if (percentage >= 75) return 'bg-mint-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const canManageFundraiser = userRole === 'OWNER' || userRole === 'ADMIN'

  const handleDonate = () => {
    // Navigate to donation flow
    navigate(`/org/${orgSlug}/fundraiser/${fundraiserSlug}/donate`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-mint-500"></div>
          <p className="mt-4 text-gray-600">Loading fundraiser...</p>
        </div>
      </div>
    )
  }

  if (error || !fundraiser || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Fundraiser not found'}</p>
          <Link
            to={`/org/${orgSlug}`}
            className="mt-4 inline-block text-mint-600 hover:text-mint-900"
          >
            Back to Organization
          </Link>
        </div>
      </div>
    )
  }

  const progressPercentage = getProgressPercentage(fundraiser.currentAmount, fundraiser.goalAmount)

  return (
    <AppLayout organizations={organization ? [organization] : []} currentOrganization={organization}>
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Link
                to={`/org/${orgSlug}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to {organization.name}
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {canManageFundraiser && (
                <>
                  <Link
                    to={`/org/${orgSlug}/fundraiser/${fundraiserSlug}/edit`}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
                  >
                    Edit
                  </Link>
                  <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    {fundraiser.isActive ? 'Pause' : 'Activate'}
                  </button>
                </>
              )}
              <button
                onClick={handleDonate}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-mint-600 hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
              >
                Donate Now
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Fundraiser Header */}
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
          <div className="px-6 py-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{fundraiser.title}</h1>
              <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${
                fundraiser.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {fundraiser.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {fundraiser.imageUrl && (
              <div className="mb-6">
                <img
                  src={fundraiser.imageUrl}
                  alt={fundraiser.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>${fundraiser.currentAmount.toLocaleString()} raised</span>
                <span>Goal: ${fundraiser.goalAmount.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(progressPercentage)}`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{progressPercentage.toFixed(1)}% complete</span>
                <span>${(fundraiser.goalAmount - fundraiser.currentAmount).toLocaleString()} remaining</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-mint-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-mint-600">{donations.length}</div>
                <div className="text-sm text-mint-800">Donations</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {fundraiser.endDate ? Math.ceil((fundraiser.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : '∞'}
                </div>
                <div className="text-sm text-blue-800">Days Left</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${Math.round(donations.reduce((sum, d) => sum + d.amount, 0) / donations.length)}
                </div>
                <div className="text-sm text-green-800">Average Donation</div>
              </div>
            </div>

            <p className="text-gray-700 text-lg leading-relaxed">{fundraiser.description}</p>
          </div>
        </div>

        {/* Suggested Amounts */}
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Donation</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {fundraiser.suggestedAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={handleDonate}
                  className="flex items-center justify-center px-4 py-3 border-2 border-mint-200 rounded-lg text-mint-700 hover:border-mint-500 hover:bg-mint-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 transition-colors"
                >
                  <span className="text-lg font-semibold">${amount}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleDonate}
              className="mt-4 w-full flex items-center justify-center px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:border-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Custom Amount
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', name: 'Overview', count: null },
                { id: 'donations', name: 'Recent Donations', count: donations.length },
                ...(canManageFundraiser ? [{ id: 'settings', name: 'Settings', count: null }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-mint-500 text-mint-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                  {tab.count !== null && (
                    <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      activeTab === tab.id ? 'bg-mint-100 text-mint-600' : 'bg-gray-100 text-gray-900'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">About This Fundraiser</h3>
                  <p className="text-gray-700">{fundraiser.description}</p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Activity</h3>
                  <div className="space-y-3">
                    {donations.slice(0, 3).map((donation) => (
                      <div key={donation.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-mint-100 rounded-full flex items-center justify-center">
                            <span className="text-mint-600 font-semibold text-sm">$</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {donation.donorName} donated ${donation.amount}
                          </p>
                          {donation.message && (
                            <p className="text-sm text-gray-500 mt-1">"{donation.message}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {donation.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'donations' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">All Donations</h3>
                  <span className="text-sm text-gray-500">{donations.length} total donations</span>
                </div>

                <div className="space-y-3">
                  {donations.map((donation) => (
                    <div key={donation.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-mint-100 rounded-full flex items-center justify-center">
                          <span className="text-mint-600 font-semibold">${donation.amount}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {donation.donorName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {donation.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        {donation.message && (
                          <p className="text-sm text-gray-600 mt-1">"{donation.message}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && canManageFundraiser && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Fundraiser Management</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Edit Fundraiser Details</p>
                        <p className="text-sm text-gray-500">Update title, description, goal amount, and more</p>
                      </div>
                      <Link
                        to={`/org/${orgSlug}/fundraiser/${fundraiserSlug}/edit`}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Fundraiser Status</p>
                        <p className="text-sm text-gray-500">
                          {fundraiser.isActive ? 'Currently accepting donations' : 'Paused - not accepting donations'}
                        </p>
                      </div>
                      <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">
                        {fundraiser.isActive ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}