import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import AppLayout from '../components/AppLayout'
import type { Fundraiser, Organization } from '../types/api'

const editFundraiserSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  goalAmount: z.number().min(100, 'Goal amount must be at least $100').max(1000000, 'Goal amount must be less than $1,000,000'),
  suggestedAmounts: z.array(z.number().min(1)).min(3, 'At least 3 suggested amounts are required').max(10, 'Maximum 10 suggested amounts allowed'),
  endDate: z.string().optional(),
  imageUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

type EditFundraiserFormData = z.infer<typeof editFundraiserSchema>

export default function EditFundraiserPage() {
  const { orgSlug, fundraiserSlug } = useParams<{ orgSlug: string; fundraiserSlug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [formData, setFormData] = useState<EditFundraiserFormData>({
    title: '',
    description: '',
    goalAmount: 5000,
    suggestedAmounts: [25, 50, 100, 250, 500],
    endDate: '',
    imageUrl: '',
  })
  const [errors, setErrors] = useState<Partial<EditFundraiserFormData>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [suggestedAmountInput, setSuggestedAmountInput] = useState('')
  const [userRole, setUserRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>('VIEWER')

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
          description: 'We are raising funds to build a new community center that will serve families in our neighborhood.',
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

        setFundraiser(mockFundraiser)
        setOrganization(mockOrganization)
        setUserRole('ADMIN') // Mock user role

        // Initialize form with existing data
        setFormData({
          title: mockFundraiser.title,
          description: mockFundraiser.description,
          goalAmount: mockFundraiser.goalAmount,
          suggestedAmounts: mockFundraiser.suggestedAmounts,
          endDate: mockFundraiser.endDate ? mockFundraiser.endDate.toISOString().split('T')[0] : '',
          imageUrl: mockFundraiser.imageUrl || '',
        })
      } catch (err) {
        setSubmitError('Failed to load fundraiser')
      } finally {
        setIsLoading(false)
      }
    }

    loadFundraiser()
  }, [orgSlug, fundraiserSlug])

  const canEditFundraiser = userRole === 'OWNER' || userRole === 'ADMIN'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target

    if (name === 'goalAmount') {
      const numValue = parseFloat(value) || 0
      setFormData(prev => ({ ...prev, [name]: numValue }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Clear field error when user starts typing
    if (errors[name as keyof EditFundraiserFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }

    // Clear success message when user makes changes
    if (successMessage) {
      setSuccessMessage('')
    }
  }

  const addSuggestedAmount = () => {
    const amount = parseInt(suggestedAmountInput)
    if (amount && amount > 0 && !formData.suggestedAmounts.includes(amount)) {
      const newAmounts = [...formData.suggestedAmounts, amount].sort((a, b) => a - b)
      setFormData(prev => ({ ...prev, suggestedAmounts: newAmounts }))
      setSuggestedAmountInput('')
    }
  }

  const removeSuggestedAmount = (amount: number) => {
    setFormData(prev => ({
      ...prev,
      suggestedAmounts: prev.suggestedAmounts.filter(a => a !== amount)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsSaving(true)

    try {
      // Validate form data
      const validatedData = editFundraiserSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1500))

      const updatedFundraiser: Fundraiser = {
        ...fundraiser!,
        ...validatedData,
        updatedAt: new Date(),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      }

      setFundraiser(updatedFundraiser)
      setSuccessMessage('Fundraiser updated successfully!')

      // Redirect back to fundraiser page after a delay
      setTimeout(() => {
        navigate(`/org/${orgSlug}/fundraiser/${fundraiserSlug}`)
      }, 2000)
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<EditFundraiserFormData> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof EditFundraiserFormData] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle update errors
        setSubmitError('Failed to update fundraiser. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
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

  if (!canEditFundraiser || !fundraiser || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">You don't have permission to edit this fundraiser</p>
          <Link
            to={`/org/${orgSlug}/fundraiser/${fundraiserSlug}`}
            className="mt-4 inline-block text-mint-600 hover:text-mint-900"
          >
            Back to Fundraiser
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AppLayout organizations={organization ? [organization] : []} currentOrganization={organization}>
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Link
                to={`/org/${orgSlug}/fundraiser/${fundraiserSlug}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to {fundraiser.title}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Edit Fundraiser</h1>
            <p className="text-gray-600 mt-1">Update your fundraiser details and settings.</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mx-6 mt-6 rounded-md bg-mint-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-mint-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-mint-800">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Fundraiser Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="Enter fundraiser title"
                value={formData.title}
                onChange={handleChange}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                required
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="Describe your fundraiser goals and how donations will be used"
                value={formData.description}
                onChange={handleChange}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Goal Amount */}
              <div>
                <label htmlFor="goalAmount" className="block text-sm font-medium text-gray-700">
                  Goal Amount ($)
                </label>
                <input
                  id="goalAmount"
                  name="goalAmount"
                  type="number"
                  min="100"
                  max="1000000"
                  step="100"
                  required
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.goalAmount ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                  value={formData.goalAmount}
                  onChange={handleChange}
                />
                {errors.goalAmount && (
                  <p className="mt-1 text-sm text-red-600">{errors.goalAmount}</p>
                )}
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                  End Date (optional)
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  className={`mt-1 block w-full px-3 py-2 border ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                  value={formData.endDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">
                Image URL (optional)
              </label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.imageUrl ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="https://example.com/image.jpg"
                value={formData.imageUrl}
                onChange={handleChange}
              />
              {errors.imageUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.imageUrl}</p>
              )}
            </div>

            {/* Suggested Amounts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested Donation Amounts
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.suggestedAmounts.map((amount) => (
                  <span
                    key={amount}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-mint-100 text-mint-800"
                  >
                    ${amount}
                    <button
                      type="button"
                      onClick={() => removeSuggestedAmount(amount)}
                      className="ml-1 text-mint-600 hover:text-mint-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Add amount"
                  value={suggestedAmountInput}
                  onChange={(e) => setSuggestedAmountInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={addSuggestedAmount}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-mint-700 bg-mint-100 hover:bg-mint-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
                >
                  Add
                </button>
              </div>
              {errors.suggestedAmounts && (
                <p className="mt-1 text-sm text-red-600">{errors.suggestedAmounts}</p>
              )}
            </div>

            {/* Current Fundraising Stats */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current Statistics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Amount Raised:</span>
                  <span className="ml-2 font-medium">${fundraiser.currentAmount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Progress:</span>
                  <span className="ml-2 font-medium">
                    {Math.round((fundraiser.currentAmount / fundraiser.goalAmount) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 font-medium ${fundraiser.isActive ? 'text-mint-600' : 'text-gray-600'}`}>
                    {fundraiser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{submitError}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Link
                to={`/org/${orgSlug}/fundraiser/${fundraiserSlug}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-mint-600 hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}