import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AppLayout from '../components/AppLayout'
import type { Organization, OrganizationMember, Fundraiser } from '../types/api'
import MembersList from '../components/MembersList'
import FundraisersList from '../components/FundraisersList'
import OrganizationSettings from '../components/OrganizationSettings'
import CreateFundraiserModal from '../components/CreateFundraiserModal'

export default function OrganizationPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'fundraisers' | 'settings'>('overview')
  const [isCreateFundraiserModalOpen, setIsCreateFundraiserModalOpen] = useState(false)
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null>(null)

  useEffect(() => {
    if (!slug) return

    // Mock data fetch - replace with actual API calls
    const mockOrganization: Organization = {
      id: 'org_1',
      name: 'Sample Political Campaign',
      slug: slug,
      description: 'A sample political campaign working to make positive change in our community.',
      type: 'POLITICAL',
      websiteUrl: 'https://example.com',
      fecId: 'C00123456',
      logoUrl: undefined,
      isVerified: true,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    const mockMembers: OrganizationMember[] = [
      {
        id: 'member_1',
        userId: user?.id || 'user_1',
        organizationId: 'org_1',
        role: 'OWNER',
        joinedAt: new Date('2024-01-01'),
        user: user || {
          id: 'user_1',
          email: 'owner@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      },
      {
        id: 'member_2',
        userId: 'user_2',
        organizationId: 'org_1',
        role: 'ADMIN',
        joinedAt: new Date('2024-01-15'),
        user: {
          id: 'user_2',
          email: 'admin@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    ]

    const mockFundraisers: Fundraiser[] = [
      {
        id: 'fundraiser_1',
        organizationId: 'org_1',
        slug: 'campaign-2024',
        title: 'Campaign 2024 Fundraiser',
        description: 'Help us reach our fundraising goals for the 2024 campaign season.',
        goalAmount: 50000,
        currentAmount: 12500,
        suggestedAmounts: [25, 50, 100, 250, 500],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
      },
      {
        id: 'fundraiser_2',
        organizationId: 'org_1',
        slug: 'voter-outreach',
        title: 'Voter Outreach Initiative',
        description: 'Support our voter registration and outreach efforts.',
        goalAmount: 25000,
        currentAmount: 8750,
        suggestedAmounts: [15, 35, 75, 150, 300],
        isActive: true,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-10'),
      }
    ]

    setOrganization(mockOrganization)
    setMembers(mockMembers)
    setFundraisers(mockFundraisers)

    // Set user's role in this organization
    const currentUserMember = mockMembers.find(member => member.userId === user?.id)
    setUserRole(currentUserMember?.role || null)

    setIsLoading(false)
  }, [slug, user?.id])

  const handleCreateFundraiser = (fundraiser: Fundraiser) => {
    setFundraisers(prev => [...prev, fundraiser])
  }

  const canManageMembers = userRole === 'OWNER' || userRole === 'ADMIN'
  const canManageSettings = userRole === 'OWNER'
  const canCreateFundraisers = userRole === 'OWNER' || userRole === 'ADMIN'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-mint-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organization...</p>
        </div>
      </div>
    )
  }

  if (!organization) {
    return <Navigate to="/dashboard" replace />
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view this organization.</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: 'Overview', count: null },
    { id: 'members', name: 'Members', count: members.length },
    { id: 'fundraisers', name: 'Fundraisers', count: fundraisers.length },
    ...(canManageSettings ? [{ id: 'settings', name: 'Settings', count: null }] : [])
  ]

  return (
    <AppLayout organizations={organization ? [organization] : []} currentOrganization={organization}>
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                {organization.logoUrl ? (
                  <img
                    className="h-12 w-12 rounded-full"
                    src={organization.logoUrl}
                    alt={organization.name}
                  />
                ) : (
                  <div className="h-12 w-12 bg-mint-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {organization.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {organization.type}
                  </span>
                  {organization.isVerified && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  )}
                  <span className="text-sm text-gray-500">Your role: {userRole}</span>
                </div>
              </div>
            </div>
            {canCreateFundraisers && (
              <button
                onClick={() => setIsCreateFundraiserModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-mint-600 hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
              >
                Create Fundraiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-mint-500 text-mint-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
                {tab.count !== null && (
                  <span className="ml-2 py-0.5 px-2 rounded-full bg-gray-100 text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Organization Info */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    About {organization.name}
                  </h3>
                  <p className="text-gray-600 mb-4">{organization.description}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {organization.websiteUrl && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Website</dt>
                        <dd className="mt-1">
                          <a
                            href={organization.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-mint-600 hover:text-mint-900"
                          >
                            {organization.websiteUrl}
                          </a>
                        </dd>
                      </div>
                    )}
                    {organization.fecId && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">FEC ID</dt>
                        <dd className="mt-1 text-sm text-gray-900">{organization.fecId}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {organization.createdAt.toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          organization.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {organization.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </dd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">{members.length}</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Team Members</dt>
                          <dd className="text-lg font-medium text-gray-900">{members.length}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-mint-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">{fundraisers.length}</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Fundraisers</dt>
                          <dd className="text-lg font-medium text-gray-900">{fundraisers.length}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                          <span className="text-white font-semibold">$</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Raised</dt>
                          <dd className="text-lg font-medium text-gray-900">
                            ${fundraisers.reduce((sum, f) => sum + f.currentAmount, 0).toLocaleString()}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <MembersList
              members={members}
              userRole={userRole}
              canManageMembers={canManageMembers}
              organizationId={organization.id}
              onMembersUpdate={setMembers}
            />
          )}

          {activeTab === 'fundraisers' && (
            <FundraisersList
              fundraisers={fundraisers}
              userRole={userRole}
              organizationSlug={organization.slug}
              onFundraisersUpdate={setFundraisers}
            />
          )}

          {activeTab === 'settings' && canManageSettings && (
            <OrganizationSettings
              organization={organization}
              onOrganizationUpdate={setOrganization}
            />
          )}
        </div>
      </div>

      {/* Create Fundraiser Modal */}
      {isCreateFundraiserModalOpen && (
        <CreateFundraiserModal
          isOpen={isCreateFundraiserModalOpen}
          onClose={() => setIsCreateFundraiserModalOpen(false)}
          onSuccess={handleCreateFundraiser}
          organizationId={organization.id}
        />
      )}
    </AppLayout>
  )
}