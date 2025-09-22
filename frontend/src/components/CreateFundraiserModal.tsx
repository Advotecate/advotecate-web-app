import { useState } from 'react'
import { z } from 'zod'
import type { Fundraiser } from '../types/api'

const createFundraiserSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  goalAmount: z.number().min(100, 'Goal amount must be at least $100').max(1000000, 'Goal amount must be less than $1,000,000'),
  suggestedAmounts: z.array(z.number().min(1)).min(3, 'At least 3 suggested amounts are required').max(10, 'Maximum 10 suggested amounts allowed'),
  endDate: z.string().optional(),
  imageUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

type CreateFundraiserFormData = z.infer<typeof createFundraiserSchema>

interface CreateFundraiserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (fundraiser: Fundraiser) => void
  organizationId: string
}

export default function CreateFundraiserModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId
}: CreateFundraiserModalProps) {
  const [formData, setFormData] = useState<CreateFundraiserFormData>({
    title: '',
    description: '',
    goalAmount: 5000,
    suggestedAmounts: [25, 50, 100, 250, 500],
    endDate: '',
    imageUrl: '',
  })
  const [errors, setErrors] = useState<Partial<CreateFundraiserFormData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [suggestedAmountInput, setSuggestedAmountInput] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target

    if (name === 'goalAmount') {
      const numValue = parseFloat(value) || 0
      setFormData(prev => ({ ...prev, [name]: numValue }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Clear field error when user starts typing
    if (errors[name as keyof CreateFundraiserFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
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

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsLoading(true)

    try {
      // Validate form data
      const validatedData = createFundraiserSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Mock fundraiser creation (replace with actual API call)
      const mockFundraiser: Fundraiser = {
        id: 'fundraiser_' + Date.now(),
        organizationId: organizationId,
        slug: generateSlug(validatedData.title),
        title: validatedData.title,
        description: validatedData.description,
        goalAmount: validatedData.goalAmount,
        currentAmount: 0,
        suggestedAmounts: validatedData.suggestedAmounts,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        imageUrl: validatedData.imageUrl || undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      onSuccess(mockFundraiser)
      onClose()

      // Reset form
      setFormData({
        title: '',
        description: '',
        goalAmount: 5000,
        suggestedAmounts: [25, 50, 100, 250, 500],
        endDate: '',
        imageUrl: '',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<CreateFundraiserFormData> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof CreateFundraiserFormData] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle creation errors
        setSubmitError('Failed to create fundraiser. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Create New Fundraiser
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
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

                  {submitError && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="text-sm text-red-700">{submitError}</div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              disabled={isLoading}
              onClick={handleSubmit}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-mint-600 text-base font-medium text-white hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Fundraiser...' : 'Create Fundraiser'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}