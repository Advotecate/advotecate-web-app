import { useState } from 'react'
import type { OrganizationMember } from '../types/api'

interface ManageMemberModalProps {
  isOpen: boolean
  onClose: () => void
  member: OrganizationMember
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  onUpdate: (member: OrganizationMember) => void
  onRemove: (memberId: string) => void
}

export default function ManageMemberModal({
  isOpen,
  onClose,
  member,
  userRole,
  onUpdate,
  onRemove
}: ManageMemberModalProps) {
  const [selectedRole, setSelectedRole] = useState(member.role)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmRemove, setShowConfirmRemove] = useState(false)

  const canChangeRole = () => {
    if (userRole === 'OWNER') return true
    if (userRole === 'ADMIN' && member.role !== 'OWNER' && member.role !== 'ADMIN') return true
    return false
  }

  const getAvailableRoles = () => {
    if (userRole === 'OWNER') {
      return [
        { value: 'ADMIN', label: 'Admin - Can manage members and settings' },
        { value: 'MEMBER', label: 'Member - Can view and participate' },
        { value: 'VIEWER', label: 'Viewer - Can only view content' }
      ]
    } else if (userRole === 'ADMIN') {
      return [
        { value: 'MEMBER', label: 'Member - Can view and participate' },
        { value: 'VIEWER', label: 'Viewer - Can only view content' }
      ]
    }
    return []
  }

  const handleRoleUpdate = async () => {
    if (selectedRole === member.role) {
      onClose()
      return
    }

    setIsLoading(true)
    try {
      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000))

      const updatedMember: OrganizationMember = {
        ...member,
        role: selectedRole as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
      }

      onUpdate(updatedMember)
      onClose()
    } catch (error) {
      console.error('Failed to update member role:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    setIsLoading(true)
    try {
      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000))

      onRemove(member.id)
      onClose()
    } catch (error) {
      console.error('Failed to remove member:', error)
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
                  Manage Team Member
                </h3>

                {/* Member Info */}
                <div className="flex items-center mb-6">
                  <div className="flex-shrink-0 h-12 w-12">
                    <div className="h-12 w-12 bg-mint-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {member.user.firstName} {member.user.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{member.user.email}</div>
                    <div className="text-xs text-gray-400">
                      Joined {member.joinedAt.toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {!showConfirmRemove ? (
                  <div className="space-y-4">
                    {/* Role Management */}
                    {canChangeRole() && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Member Role
                        </label>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as any)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-mint-500 focus:border-mint-500 sm:text-sm"
                        >
                          {getAvailableRoles().map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {!canChangeRole() && (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">
                          You don't have permission to change this member's role.
                        </p>
                      </div>
                    )}

                    {/* Member Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.user.isVerified
                            ? 'bg-mint-100 text-mint-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {member.user.isVerified ? 'Verified' : 'Pending Verification'}
                        </span>
                        <span className="text-sm text-gray-500">
                          Current role: {member.role}
                        </span>
                      </div>
                    </div>

                    {/* Remove Member Section */}
                    <div className="border-t pt-4 mt-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Danger Zone</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Remove this member from the organization. This action cannot be undone.
                      </p>
                      <button
                        onClick={() => setShowConfirmRemove(true)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Remove Member
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Remove Team Member
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>
                              Are you sure you want to remove{' '}
                              <strong>{member.user.firstName} {member.user.lastName}</strong>{' '}
                              from this organization? This action cannot be undone.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {!showConfirmRemove ? (
              <>
                {canChangeRole() && selectedRole !== member.role && (
                  <button
                    onClick={handleRoleUpdate}
                    disabled={isLoading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-mint-600 text-base font-medium text-white hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Updating...' : 'Update Role'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {canChangeRole() && selectedRole !== member.role ? 'Cancel' : 'Close'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRemoveMember}
                  disabled={isLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Removing...' : 'Yes, Remove Member'}
                </button>
                <button
                  onClick={() => setShowConfirmRemove(false)}
                  disabled={isLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}