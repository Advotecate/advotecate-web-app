import { Link } from 'react-router-dom'
import type { Fundraiser } from '../types/api'

interface FundraisersListProps {
  fundraisers: Fundraiser[]
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  organizationSlug: string
  onFundraisersUpdate: (fundraisers: Fundraiser[]) => void
}

export default function FundraisersList({
  fundraisers,
  userRole,
  organizationSlug,
  onFundraisersUpdate
}: FundraisersListProps) {
  const canManageFundraisers = userRole === 'OWNER' || userRole === 'ADMIN'

  const getProgressPercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-mint-600'
    if (percentage >= 75) return 'bg-mint-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const toggleFundraiserStatus = async (fundraiser: Fundraiser) => {
    try {
      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 500))

      const updatedFundraiser: Fundraiser = {
        ...fundraiser,
        isActive: !fundraiser.isActive,
        updatedAt: new Date()
      }

      onFundraisersUpdate(
        fundraisers.map(f => f.id === fundraiser.id ? updatedFundraiser : f)
      )
    } catch (error) {
      console.error('Failed to update fundraiser status:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Fundraisers</h2>
      </div>

      {fundraisers.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {fundraisers.map((fundraiser) => {
            const progressPercentage = getProgressPercentage(fundraiser.currentAmount, fundraiser.goalAmount)

            return (
              <div key={fundraiser.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        <Link
                          to={`/org/${organizationSlug}/fundraiser/${fundraiser.slug}`}
                          className="hover:text-mint-600 transition-colors"
                        >
                          {fundraiser.title}
                        </Link>
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        fundraiser.isActive
                          ? 'bg-mint-100 text-mint-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {fundraiser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {canManageFundraisers && (
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/org/${organizationSlug}/fundraiser/${fundraiser.slug}/edit`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => toggleFundraiserStatus(fundraiser)}
                          className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            fundraiser.isActive
                              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                              : 'bg-mint-600 hover:bg-mint-700 focus:ring-mint-500'
                          }`}
                        >
                          {fundraiser.isActive ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{fundraiser.description}</p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>${fundraiser.currentAmount.toLocaleString()} raised</span>
                      <span>Goal: ${fundraiser.goalAmount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(progressPercentage)}`}
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{progressPercentage.toFixed(1)}% complete</span>
                      <span>${(fundraiser.goalAmount - fundraiser.currentAmount).toLocaleString()} remaining</span>
                    </div>
                  </div>

                  {/* Suggested Amounts */}
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-2">Suggested donation amounts:</div>
                    <div className="flex flex-wrap gap-2">
                      {fundraiser.suggestedAmounts.map((amount, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-mint-100 text-mint-800"
                        >
                          ${amount}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dates and Actions */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>Created {fundraiser.createdAt.toLocaleDateString()}</span>
                      {fundraiser.endDate && (
                        <span>
                          Ends {fundraiser.endDate.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/org/${organizationSlug}/fundraiser/${fundraiser.slug}`}
                      className="text-mint-600 hover:text-mint-900 font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">No fundraisers yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first fundraiser to start collecting donations.
          </p>
          {canManageFundraisers && (
            <div className="mt-6">
              <p className="text-sm text-gray-600">
                Use the "Create Fundraiser" button above to get started.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}