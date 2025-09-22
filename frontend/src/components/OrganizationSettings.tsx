import { useState } from 'react'
import { z } from 'zod'
import type { Organization } from '../types/api'

const organizationUpdateSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  websiteUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  fecId: z.string().optional(),
  logoUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

type OrganizationUpdateFormData = z.infer<typeof organizationUpdateSchema>

interface OrganizationSettingsProps {
  organization: Organization
  onOrganizationUpdate: (organization: Organization) => void
}

export default function OrganizationSettings({
  organization,
  onOrganizationUpdate
}: OrganizationSettingsProps) {
  const [formData, setFormData] = useState<OrganizationUpdateFormData>({
    name: organization.name,
    description: organization.description,
    websiteUrl: organization.websiteUrl || '',
    fecId: organization.fecId || '',
    logoUrl: organization.logoUrl || '',
  })
  const [errors, setErrors] = useState<Partial<OrganizationUpdateFormData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear field error when user starts typing
    if (errors[name as keyof OrganizationUpdateFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }

    // Clear success message when user makes changes
    if (successMessage) {
      setSuccessMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsLoading(true)

    try {
      // Validate form data
      const validatedData = organizationUpdateSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000))

      const updatedOrganization: Organization = {
        ...organization,
        ...validatedData,
        updatedAt: new Date(),
      }

      onOrganizationUpdate(updatedOrganization)
      setSuccessMessage('Organization settings updated successfully!')
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<OrganizationUpdateFormData> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof OrganizationUpdateFormData] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle update errors
        setSubmitError('Failed to update organization settings. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    setIsLoading(true)
    try {
      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000))

      const updatedOrganization: Organization = {
        ...organization,
        isActive: !organization.isActive,
        updatedAt: new Date(),
      }

      onOrganizationUpdate(updatedOrganization)
      setSuccessMessage(
        `Organization ${organization.isActive ? 'deactivated' : 'activated'} successfully!`
      )
      setShowDeactivateConfirm(false)
    } catch (error) {
      setSubmitError('Failed to update organization status. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Organization Settings</h2>
        <p className="text-gray-600 mt-1">
          Manage your organization's profile and configuration.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Organization Name */}
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Website URL */}
            <div>
              <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700">
                Website URL
              </label>
              <input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.websiteUrl ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="https://example.com"
                value={formData.websiteUrl}
                onChange={handleChange}
              />
              {errors.websiteUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.websiteUrl}</p>
              )}
            </div>

            {/* FEC ID */}
            <div>
              <label htmlFor="fecId" className="block text-sm font-medium text-gray-700">
                FEC ID
              </label>
              <input
                id="fecId"
                name="fecId"
                type="text"
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.fecId ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="C00123456"
                value={formData.fecId}
                onChange={handleChange}
              />
              {errors.fecId && (
                <p className="mt-1 text-sm text-red-600">{errors.fecId}</p>
              )}
            </div>

            {/* Logo URL */}
            <div className="sm:col-span-2">
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700">
                Logo URL
              </label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.logoUrl ? 'border-red-300' : 'border-gray-300'
                } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={handleChange}
              />
              {errors.logoUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.logoUrl}</p>
              )}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
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
                placeholder="Describe your organization's mission and goals"
                value={formData.description}
                onChange={handleChange}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>
          </div>

          {submitError && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{submitError}</div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-mint-600 hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Organization Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Organization Status</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900 font-medium">
                Current Status: {' '}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  organization.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {organization.isActive ? 'Active' : 'Inactive'}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {organization.isActive
                  ? 'Your organization is active and fundraisers can accept donations.'
                  : 'Your organization is inactive and fundraisers cannot accept donations.'
                }
              </p>
            </div>
            <button
              onClick={() => setShowDeactivateConfirm(true)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                organization.isActive
                  ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
                  : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
              }`}
            >
              {organization.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white shadow rounded-lg border border-red-200">
        <div
          className="px-6 py-4 border-b border-red-200 cursor-pointer"
          onClick={() => setShowDangerZone(!showDangerZone)}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-red-900">Danger Zone</h3>
            <svg
              className={`w-5 h-5 text-red-600 transform transition-transform ${
                showDangerZone ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {showDangerZone && (
          <div className="p-6 bg-red-50">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-red-900">Delete Organization</h4>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete this organization and all associated data. This action cannot be undone.
                </p>
                <button
                  className="mt-2 inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete Organization
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Deactivate/Activate Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {organization.isActive ? 'Deactivate' : 'Activate'} Organization
                    </h3>
                    <p className="text-sm text-gray-500">
                      {organization.isActive
                        ? 'Are you sure you want to deactivate this organization? All fundraisers will be paused and no new donations can be accepted.'
                        : 'Are you sure you want to activate this organization? All fundraisers will be resumed and donations can be accepted.'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleToggleStatus}
                  disabled={isLoading}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    organization.isActive
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  {isLoading ? 'Processing...' : organization.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setShowDeactivateConfirm(false)}
                  disabled={isLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}