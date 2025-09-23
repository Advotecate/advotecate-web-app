import { useState } from 'react'
import type { OrganizationMember } from '../types/api'
import InviteMemberModal from './InviteMemberModal'
import ManageMemberModal from './ManageMemberModal'

interface MembersListProps {
  members: OrganizationMember[]
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  canManageMembers: boolean
  organizationId: string
  onMembersUpdate: (members: OrganizationMember[]) => void
}

export default function MembersList({
  members,
  userRole,
  canManageMembers,
  organizationId,
  onMembersUpdate
}: MembersListProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)

  const handleInviteMember = (member: OrganizationMember) => {
    onMembersUpdate([...members, member])
  }

  const handleUpdateMember = (updatedMember: OrganizationMember) => {
    onMembersUpdate(
      members.map(member =>
        member.id === updatedMember.id ? updatedMember : member
      )
    )
  }

  const handleRemoveMember = (memberId: string) => {
    onMembersUpdate(members.filter(member => member.id !== memberId))
  }

  const openManageMember = (member: OrganizationMember) => {
    setSelectedMember(member)
    setIsManageModalOpen(true)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      case 'MEMBER':
        return 'bg-mint-100 text-mint-800'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const canManageMember = (member: OrganizationMember) => {
    if (!canManageMembers) return false
    if (member.role === 'OWNER') return false // Can't manage owners
    if (userRole === 'ADMIN' && member.role === 'ADMIN') return false // Admins can't manage other admins
    return true
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Team Members</h2>
        {canManageMembers && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-mint-600 hover:bg-mint-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
          >
            Invite Member
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {members.map((member) => (
            <li key={member.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 bg-mint-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      {!member.user.isVerified && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{member.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                  <div className="text-sm text-gray-500">
                    Joined {member.joinedAt.toLocaleDateString()}
                  </div>
                  {canManageMember(member) && (
                    <button
                      onClick={() => openManageMember(member)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {members.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <p className="text-gray-500">No team members yet</p>
          {canManageMembers && (
            <p className="text-sm text-gray-400 mt-1">
              Invite your first team member to get started.
            </p>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={handleInviteMember}
          organizationId={organizationId}
        />
      )}

      {/* Manage Member Modal */}
      {selectedMember && (
        <ManageMemberModal
          isOpen={isManageModalOpen}
          onClose={() => {
            setIsManageModalOpen(false)
            setSelectedMember(null)
          }}
          member={selectedMember}
          userRole={userRole}
          onUpdate={handleUpdateMember}
          onRemove={handleRemoveMember}
        />
      )}
    </div>
  )
}