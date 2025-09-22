import { useState } from 'react'
import { z } from 'zod'
import type { OrganizationMember } from '../types/api'

const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
  message: z.string().optional(),
})

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (member: OrganizationMember) => void
  organizationId: string
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId
}: InviteMemberModalProps) {
  const [formData, setFormData] = useState<InviteMemberFormData>({
    email: '',
    role: 'MEMBER',
    message: '',
  })
  const [errors, setErrors] = useState<Partial<InviteMemberFormData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear field error when user starts typing
    if (errors[name as keyof InviteMemberFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsLoading(true)

    try {
      // Validate form data
      const validatedData = inviteMemberSchema.parse(formData)

      // Clear any existing errors
      setErrors({})

      // Mock member invitation (replace with actual API call)
      const mockMember: OrganizationMember = {
        id: 'member_' + Date.now(),
        userId: 'user_' + Date.now(),
        organizationId: organizationId,
        role: validatedData.role,
        joinedAt: new Date(),
        user: {
          id: 'user_' + Date.now(),
          email: validatedData.email,
          firstName: 'New',
          lastName: 'Member',
          isVerified: false, // New invites start unverified
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      onSuccess(mockMember)
      onClose()

      // Reset form
      setFormData({
        email: '',
        role: 'MEMBER',
        message: '',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<InviteMemberFormData> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof InviteMemberFormData] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle invitation errors
        setSubmitError('Failed to send invitation. Please try again.')
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

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Invite Team Member
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                      placeholder="member@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      required
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.role ? 'border-red-300' : 'border-gray-300'
                      } bg-white rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                      value={formData.role}
                      onChange={handleChange}
                    >
                      <option value="MEMBER">Member - Can view and participate</option>
                      <option value="ADMIN">Admin - Can manage members and settings</option>
                      <option value="VIEWER">Viewer - Can only view content</option>
                    </select>
                    {errors.role && (
                      <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                    )}
                  </div>

                  {/* Optional Message */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                      Personal Message (optional)
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={3}
                      className={`mt-1 block w-full px-3 py-2 border ${
                        errors.message ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm`}
                      placeholder="Add a personal message to your invitation..."
                      value={formData.message}
                      onChange={handleChange}
                    />
                    {errors.message && (
                      <p className="mt-1 text-sm text-red-600">{errors.message}</p>
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
              {isLoading ? 'Sending Invitation...' : 'Send Invitation'}
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