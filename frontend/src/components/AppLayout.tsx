import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Organization } from '../types/api'

interface AppLayoutProps {
  children: React.ReactNode
  organizations?: Organization[]
  currentOrganization?: Organization
  showSidebar?: boolean
}

export default function AppLayout({
  children,
  organizations = [],
  currentOrganization,
  showSidebar = true
}: AppLayoutProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path
  const isPathActive = (path: string) => location.pathname.startsWith(path)

  // Navigation items
  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    ...(currentOrganization ? [
      { name: 'Overview', href: `/org/${currentOrganization.slug}`, icon: 'overview' },
      { name: 'Fundraisers', href: `/org/${currentOrganization.slug}?tab=fundraisers`, icon: 'fundraisers' },
      { name: 'Members', href: `/org/${currentOrganization.slug}?tab=members`, icon: 'members' },
      { name: 'Settings', href: `/org/${currentOrganization.slug}?tab=settings`, icon: 'settings' },
    ] : []),
  ]

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'dashboard':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10" />
          </svg>
        )
      case 'overview':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      case 'fundraisers':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'members':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        )
      case 'settings':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-0 z-40 flex">
            <div className="relative max-w-xs w-full bg-white pt-5 pb-4 flex-1 flex flex-col transform transition-transform duration-300 ease-in-out">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-shrink-0 px-4">
                <Link to="/dashboard" className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-mint-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">A</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-semibold text-gray-900">Advotecate</p>
                  </div>
                </Link>
              </div>
              <div className="mt-5 flex-1 h-0 overflow-y-auto">
                <nav className="px-2 space-y-1">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href) || isPathActive(item.href.split('?')[0])
                          ? 'bg-mint-100 text-mint-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {getIconComponent(item.icon)}
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      {showSidebar && (
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <div className="flex items-center flex-shrink-0 px-4">
                  <Link to="/dashboard" className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-mint-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">A</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-base font-semibold text-gray-900">Advotecate</p>
                    </div>
                  </Link>
                </div>
                <nav className="mt-5 flex-1 px-2 space-y-1">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href) || isPathActive(item.href.split('?')[0])
                          ? 'bg-mint-100 text-mint-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                    >
                      {getIconComponent(item.icon)}
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  ))}
                </nav>

                {/* Organization Selector */}
                {organizations.length > 0 && (
                  <div className="px-2 mt-6">
                    <div className="px-2 mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Organizations
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {organizations.slice(0, 3).map((org) => (
                        <Link
                          key={org.id}
                          to={`/org/${org.slug}`}
                          className={`${
                            currentOrganization?.id === org.id
                              ? 'bg-mint-50 text-mint-700 border-mint-200'
                              : 'text-gray-700 hover:bg-gray-50 border-transparent'
                          } group flex items-center px-2 py-2 text-sm font-medium rounded-md border`}
                        >
                          <div className="flex-shrink-0 mr-3">
                            {org.logoUrl ? (
                              <img className="w-6 h-6 rounded" src={org.logoUrl} alt={org.name} />
                            ) : (
                              <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-700">
                                  {org.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="truncate">{org.name}</span>
                        </Link>
                      ))}
                      {organizations.length > 3 && (
                        <Link
                          to="/dashboard"
                          className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        >
                          <span className="text-xs">+{organizations.length - 3} more</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-mint-500 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {!showSidebar && (
            <div className="flex items-center px-4">
              <Link to="/dashboard" className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-mint-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">A</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-base font-semibold text-gray-900">Advotecate</p>
                </div>
              </Link>
            </div>
          )}

          <div className="flex-1 px-4 flex justify-between items-center">
            {/* Breadcrumb */}
            <div className="hidden sm:block">
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <div>
                      <Link to="/dashboard" className="text-gray-400 hover:text-gray-500">
                        <svg className="flex-shrink-0 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                        <span className="sr-only">Home</span>
                      </Link>
                    </div>
                  </li>
                  {currentOrganization && (
                    <>
                      <li>
                        <div className="flex items-center">
                          <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <Link
                            to={`/org/${currentOrganization.slug}`}
                            className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                          >
                            {currentOrganization.name}
                          </Link>
                        </div>
                      </li>
                    </>
                  )}
                </ol>
              </nav>
            </div>

            {/* User menu */}
            <div className="ml-4 flex items-center md:ml-6">
              <div className="relative ml-3">
                <div>
                  <button
                    type="button"
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint-500"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-mint-500 flex items-center justify-center">
                      <span className="text-sm font-medium leading-none text-white">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </span>
                    </div>
                  </button>
                </div>

                {profileMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none transform transition-all duration-100 ease-out">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                      <p className="text-gray-500">{user?.email}</p>
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Your Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}