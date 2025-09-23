import { useState } from 'react'
import { organizationSchema, type OrganizationFormData } from '../lib/validations'
import { z } from 'zod'

interface CreateOrganizationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (organization: any) => void
}

export default function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess
}: CreateOrganizationModalProps) {
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    description: '',
    type: 'POLITICAL',
    websiteUrl: '',
    fecId: '',
  })
  const [errors, setErrors] = useState<Partial<OrganizationFormData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear field error when user starts typing
    if (errors[name as keyof OrganizationFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsLoading(true)

    try {
      // Validate form data
      const validatedData = organizationSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Mock organization creation (replace with actual API call)
      const mockOrganization = {
        id: 'org_' + Date.now(),
        slug: validatedData.name.toLowerCase().replace(/\s+/g, '-'),
        ...validatedData,
        isActive: true,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      onSuccess(mockOrganization)
      onClose()

      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'POLITICAL',
        websiteUrl: '',
        fecId: '',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<OrganizationFormData> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof OrganizationFormData] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle creation errors
        setSubmitError('Failed to create organization. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  console.log('CreateOrganizationModal render - isOpen:', isOpen)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Create Organization
                  </h3>

                  <div className="space-y-4">
                    {/* Organization Name */}
                    <div>
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
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                        placeholder="Enter organization name"
                        value={formData.name}
                        onChange={handleChange}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
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
                        rows={3}
                        required
                        className={`mt-1 block w-full px-3 py-2 border ${
                          errors.description ? 'border-red-300' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                        placeholder="Describe your organization's mission and goals"
                        value={formData.description}
                        onChange={handleChange}
                      />
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                      )}
                    </div>

                    {/* Organization Type */}
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                        Organization Type
                      </label>
                      <select
                        id="type"
                        name="type"
                        required
                        className={`mt-1 block w-full px-3 py-2 border ${
                          errors.type ? 'border-red-300' : 'border-gray-300'
                        } bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                        value={formData.type}
                        onChange={handleChange}
                      >
                        <option value="POLITICAL">Political Campaign</option>
                        <option value="PAC">Political Action Committee</option>
                        <option value="NONPROFIT">Nonprofit Organization</option>
                      </select>
                      {errors.type && (
                        <p className="mt-1 text-sm text-red-600">{errors.type}</p>
                      )}
                    </div>

                    {/* Website URL */}
                    <div>
                      <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700">
                        Website URL (optional)
                      </label>
                      <input
                        id="websiteUrl"
                        name="websiteUrl"
                        type="url"
                        className={`mt-1 block w-full px-3 py-2 border ${
                          errors.websiteUrl ? 'border-red-300' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
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
                        FEC ID (optional)
                      </label>
                      <input
                        id="fecId"
                        name="fecId"
                        type="text"
                        className={`mt-1 block w-full px-3 py-2 border ${
                          errors.fecId ? 'border-red-300' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                        placeholder="C00123456"
                        value={formData.fecId}
                        onChange={handleChange}
                      />
                      {errors.fecId && (
                        <p className="mt-1 text-sm text-red-600">{errors.fecId}</p>
                      )}
                    </div>

                    {submitError && (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="text-sm text-red-700">{submitError}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Organization'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
  )
}