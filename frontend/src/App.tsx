// Advotecate Frontend - Mixed Feed with Authentication
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import EventPage from './pages/EventPage';
import OrganizationPage from './pages/OrganizationPage';
import { Target, Star, Phone, MapPin, Users, Calendar, Heart, Megaphone, GraduationCap, Building, User, LogOut, DoorOpen, Clipboard, Vote, TrendingUp, Eye, Settings, Shield, Clock, Search } from 'lucide-react';
import type { Fundraiser, Event } from './types/api';

function HomePage() {
  const { isAuthenticated, user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleProtectedAction = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setShowLoginModal(true);
    }
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setShowRegisterModal(true);
  };

  const switchToLogin = () => {
    setShowRegisterModal(false);
    setShowLoginModal(true);
  };

  // Mock fundraiser data
  const mockFundraisers: Fundraiser[] = [
    {
      id: 'fund_1',
      slug: 'climate-action-2024',
      title: 'Climate Action Initiative 2024',
      description: 'Supporting renewable energy policies and environmental protection measures across the nation.',
      imageUrl: 'https://images.unsplash.com/photo-1569163139394-de44cb69c2ba?w=400&h=300&fit=crop',
      organizationId: 'org_1',
      goalAmount: 50000,
      currentAmount: 32450,
      suggestedAmounts: [25, 50, 100, 250, 500],
      isActive: true,
      endDate: new Date('2024-12-31'),
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
    },
    {
      id: 'fund_2',
      slug: 'education-equality',
      title: 'Education Equality Fund',
      description: 'Advocating for fair funding and resources for schools in underserved communities.',
      imageUrl: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=400&h=300&fit=crop',
      organizationId: 'org_2',
      goalAmount: 75000,
      currentAmount: 28900,
      suggestedAmounts: [20, 50, 100, 200, 300],
      isActive: true,
      endDate: new Date('2024-11-15'),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-10'),
    },
    {
      id: 'fund_3',
      slug: 'healthcare-access',
      title: 'Healthcare Access for All',
      description: 'Working to expand healthcare coverage and reduce prescription drug costs for working families.',
      imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop',
      organizationId: 'org_3',
      goalAmount: 100000,
      currentAmount: 67890,
      suggestedAmounts: [30, 75, 150, 300, 500],
      isActive: true,
      endDate: new Date('2024-10-30'),
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-02-15'),
    },
    {
      id: 'fund_4',
      slug: 'voting-rights-campaign',
      title: 'Protect Voting Rights',
      description: 'Defending democracy by ensuring every eligible citizen can exercise their right to vote.',
      imageUrl: 'https://images.unsplash.com/photo-1587814960189-bc2e27a38065?w=400&h=300&fit=crop',
      organizationId: 'org_4',
      goalAmount: 40000,
      currentAmount: 38750,
      suggestedAmounts: [25, 50, 100, 250, 400],
      isActive: true,
      endDate: new Date('2024-09-30'),
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-10'),
    },
    {
      id: 'fund_5',
      slug: 'local-community-support',
      title: 'Local Community Development',
      description: 'Supporting local businesses and community programs that strengthen our neighborhoods.',
      imageUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=300&fit=crop',
      organizationId: 'org_5',
      goalAmount: 25000,
      currentAmount: 18200,
      suggestedAmounts: [15, 35, 75, 150, 250],
      isActive: true,
      endDate: new Date('2024-08-15'),
      createdAt: new Date('2024-02-20'),
      updatedAt: new Date('2024-03-05'),
    },
    {
      id: 'fund_6',
      slug: 'digital-privacy-rights',
      title: 'Digital Privacy Protection',
      description: 'Advocating for stronger data protection laws and individual privacy rights in the digital age.',
      imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=300&fit=crop',
      organizationId: 'org_6',
      goalAmount: 60000,
      currentAmount: 45300,
      suggestedAmounts: [20, 50, 100, 200, 350],
      isActive: true,
      endDate: new Date('2024-12-15'),
      createdAt: new Date('2024-01-25'),
      updatedAt: new Date('2024-02-28'),
    }
  ];

  // Mock events data
  const mockEvents: Event[] = [
    {
      id: 'event_1',
      slug: 'phone-bank-climate-action',
      title: 'Phone Bank for Climate Action',
      description: 'Join us for an evening of phone banking to contact voters about upcoming climate legislation. No experience necessary - we\'ll provide training and scripts!',
      eventType: 'PHONE_BANK',
      organizationId: 'org_1',
      organizationName: 'Climate Action Now',
      startTime: new Date('2024-03-15T18:00:00'),
      endTime: new Date('2024-03-15T21:00:00'),
      timeZone: 'America/New_York',
      location: {
        name: 'Climate Action HQ',
        address: '123 Green Street',
        city: 'Washington',
        state: 'DC',
        zipCode: '20001',
        isVirtual: false
      },
      maxAttendees: 50,
      currentAttendees: 23,
      isPublic: true,
      requiresApproval: false,
      instructions: 'Please bring a charged phone and laptop if possible. Light refreshments will be provided.',
      contactEmail: 'volunteer@climateactionnow.org',
      imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=200&fit=crop',
      tags: ['Phone Banking', 'Climate', 'Evening'],
      accessibility: {
        wheelchairAccessible: true,
        publicTransitAccessible: true,
        childFriendly: false
      },
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-20')
    },
    {
      id: 'event_2',
      slug: 'weekend-canvass-education',
      title: 'Weekend Door-to-Door Canvass',
      description: 'Help us talk to voters about education funding and school choice. We\'ll be canvassing friendly neighborhoods and gathering supporter information.',
      eventType: 'CANVASS',
      organizationId: 'org_2',
      organizationName: 'Education First Coalition',
      startTime: new Date('2024-03-16T10:00:00'),
      endTime: new Date('2024-03-16T16:00:00'),
      timeZone: 'America/New_York',
      location: {
        name: 'Community Center',
        address: '456 Main Street',
        city: 'Alexandria',
        state: 'VA',
        zipCode: '22301',
        isVirtual: false
      },
      maxAttendees: 30,
      currentAttendees: 18,
      isPublic: true,
      requiresApproval: false,
      instructions: 'Wear comfortable walking shoes and bring water. We\'ll provide clipboards, literature, and training.',
      contactEmail: 'canvass@educationfirst.org',
      imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop',
      tags: ['Canvassing', 'Education', 'Weekend'],
      accessibility: {
        wheelchairAccessible: true,
        publicTransitAccessible: true,
        childFriendly: true
      },
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-18')
    },
    {
      id: 'event_3',
      slug: 'virtual-postcard-writing',
      title: 'Virtual Postcard Writing Party',
      description: 'Join us online for a fun evening of writing personalized postcards to voters. Perfect for volunteers who want to help from home!',
      eventType: 'VOLUNTEER',
      organizationId: 'org_4',
      organizationName: 'Voting Rights Alliance',
      startTime: new Date('2024-03-18T19:00:00'),
      endTime: new Date('2024-03-18T21:30:00'),
      timeZone: 'America/New_York',
      location: {
        address: 'Virtual Event',
        city: 'Online',
        state: 'DC',
        zipCode: '00000',
        isVirtual: true,
        virtualLink: 'https://zoom.us/j/1234567890'
      },
      maxAttendees: 100,
      currentAttendees: 67,
      isPublic: true,
      requiresApproval: false,
      instructions: 'You\'ll need postcards, stamps, and pens. We\'ll send you addresses and messaging guidelines beforehand.',
      contactEmail: 'postcards@votingrights.org',
      imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=200&fit=crop',
      tags: ['Virtual', 'Postcards', 'Evening', 'Remote'],
      accessibility: {
        wheelchairAccessible: true,
        publicTransitAccessible: true,
        childFriendly: true,
        notes: 'Virtual event accessible to all'
      },
      createdAt: new Date('2024-02-08'),
      updatedAt: new Date('2024-02-22')
    },
    {
      id: 'event_4',
      slug: 'healthcare-rally-capitol',
      title: 'Healthcare Rally at the Capitol',
      description: 'Join hundreds of advocates for a rally supporting universal healthcare. We\'ll hear from patients, doctors, and elected officials.',
      eventType: 'RALLY',
      organizationId: 'org_3',
      organizationName: 'Healthcare for All',
      startTime: new Date('2024-03-20T12:00:00'),
      endTime: new Date('2024-03-20T15:00:00'),
      timeZone: 'America/New_York',
      location: {
        name: 'U.S. Capitol West Lawn',
        address: 'First Street SW',
        city: 'Washington',
        state: 'DC',
        zipCode: '20515',
        isVirtual: false
      },
      currentAttendees: 342,
      isPublic: true,
      requiresApproval: false,
      instructions: 'Bring signs, water, and wear comfortable shoes. Security screening required for Capitol grounds.',
      contactEmail: 'rally@healthcareforall.org',
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop',
      tags: ['Rally', 'Healthcare', 'Capitol', 'Midday'],
      accessibility: {
        wheelchairAccessible: true,
        publicTransitAccessible: true,
        childFriendly: true,
        notes: 'Metro accessible, multiple entrances available'
      },
      createdAt: new Date('2024-01-30'),
      updatedAt: new Date('2024-02-25')
    },
    {
      id: 'event_5',
      slug: 'campaign-volunteer-training',
      title: 'Campaign Volunteer Training',
      description: 'Learn the basics of political organizing! This training covers phone banking, canvassing, voter registration, and digital organizing.',
      eventType: 'TRAINING',
      organizationId: 'org_5',
      organizationName: 'Democratic Action Network',
      startTime: new Date('2024-03-22T10:00:00'),
      endTime: new Date('2024-03-22T17:00:00'),
      timeZone: 'America/New_York',
      location: {
        name: 'Community Training Center',
        address: '789 Democracy Ave',
        city: 'Richmond',
        state: 'VA',
        zipCode: '23220',
        isVirtual: false
      },
      maxAttendees: 25,
      currentAttendees: 15,
      isPublic: true,
      requiresApproval: true,
      instructions: 'Please bring a notebook and pen. Lunch will be provided. Registration required 48 hours in advance.',
      contactEmail: 'training@democracyaction.org',
      imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=200&fit=crop',
      tags: ['Training', 'All Day', 'Registration Required'],
      accessibility: {
        wheelchairAccessible: true,
        publicTransitAccessible: false,
        childFriendly: false,
        notes: 'Parking available on-site'
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-12')
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateProgress = (current: number, goal: number) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const formatEventDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const getEventTypeDisplay = (eventType: Event['eventType']) => {
    const types = {
      'PHONE_BANK': { label: 'Phone Bank', color: 'bg-blue-100 text-blue-800' },
      'CANVASS': { label: 'Canvass', color: 'bg-mint-100 text-mint-800' },
      'VOLUNTEER': { label: 'Volunteer', color: 'bg-purple-100 text-purple-800' },
      'RALLY': { label: 'Rally', color: 'bg-red-100 text-red-800' },
      'FUNDRAISER': { label: 'Fundraiser', color: 'bg-yellow-100 text-yellow-800' },
      'TRAINING': { label: 'Training', color: 'bg-indigo-100 text-indigo-800' },
      'MEETING': { label: 'Meeting', color: 'bg-gray-100 text-gray-800' }
    };
    return types[eventType] || types['VOLUNTEER'];
  };

  const getEventTypeIcon = (eventType: Event['eventType']) => {
    switch (eventType) {
      case 'PHONE_BANK':
        return <Phone className="w-4 h-4" strokeWidth={1.5} />;
      case 'CANVASS':
        return <MapPin className="w-4 h-4" strokeWidth={1.5} />;
      case 'VOLUNTEER':
        return <Heart className="w-4 h-4" strokeWidth={1.5} />;
      case 'RALLY':
        return <Megaphone className="w-4 h-4" strokeWidth={1.5} />;
      case 'TRAINING':
        return <GraduationCap className="w-4 h-4" strokeWidth={1.5} />;
      case 'FUNDRAISER':
        return <Target className="w-4 h-4" strokeWidth={1.5} />;
      case 'MEETING':
        return <Users className="w-4 h-4" strokeWidth={1.5} />;
      default:
        return <Calendar className="w-4 h-4" strokeWidth={1.5} />;
    }
  };

  // Helper function to convert organization name to slug
  const getOrganizationSlug = (organizationName: string) => {
    const organizationMap: { [key: string]: string } = {
      'Climate Action Now': 'climate-action-now',
      'Healthcare for All': 'healthcare-for-all',
      'Democratic Future PAC': 'democratic-future-pac',
      'Education First Coalition': 'education-first-coalition',
      'Voting Rights Alliance': 'voting-rights-alliance',
      'Democratic Action Network': 'democratic-action-network'
    };
    return organizationMap[organizationName] || organizationName.toLowerCase().replace(/\s+/g, '-');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3FDFB] via-white to-[#E9FBF6]">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-mint-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h2 className="text-2xl font-bold text-gray-900 font-Poppins">
                Advotecate
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                    <span className="text-gray-700 font-Figtree">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-Figtree"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.5} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-Figtree"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="px-4 py-2 rounded-xl text-white transition-all hover:scale-105 font-Figtree"
                    style={{
                      background: 'linear-gradient(135deg, #02cb97 0%, #3EB489 100%)',
                      boxShadow: '0 4px 16px rgba(2, 203, 151, 0.25)',
                    }}
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F3FDFB] via-white to-[#E9FBF6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium text-[#111827] mb-6" style={{ fontFamily: 'Poppins, system-ui, sans-serif', letterSpacing: '-0.025em' }}>
              Advotecate
            </h1>
            <p className="text-xl sm:text-2xl text-[#374151] mb-4 max-w-3xl mx-auto" style={{ fontFamily: 'Figtree, system-ui, sans-serif' }}>
              Empower Change Through Digital Advocacy
            </p>
            <p className="text-lg text-[#6B7280] mb-10 max-w-2xl mx-auto" style={{ fontFamily: 'Figtree, system-ui, sans-serif', lineHeight: '1.6' }}>
              Connect causes with supporters, organize campaigns, and drive meaningful impact with our comprehensive advocacy platform.
            </p>
            <div className="flex justify-center space-x-4 mb-16">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-4 rounded-2xl font-medium text-lg text-white transition-all transform hover:scale-105 hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #02cb97 0%, #3EB489 100%)',
                  boxShadow: '0 4px 16px rgba(2, 203, 151, 0.25)',
                  fontFamily: 'Figtree, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #3EB489 0%, #359A77 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 203, 151, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #02cb97 0%, #3EB489 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(2, 203, 151, 0.25)';
                }}
              >
                Start Your Campaign
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 bg-white text-[#111827] border border-[#E5E7EB] rounded-2xl font-medium text-lg transition-all transform hover:-translate-y-0.5 hover:border-[#3EB489]"
                style={{
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                  fontFamily: 'Figtree, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.04)';
                }}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Activity Section */}
      <div className="py-16 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-medium text-[#111827] mb-4" style={{ fontFamily: 'Poppins, system-ui, sans-serif', letterSpacing: '-0.025em' }}>
              Featured Activity
            </h2>
            <p className="text-lg text-[#374151] max-w-2xl mx-auto" style={{ fontFamily: 'Figtree, system-ui, sans-serif', lineHeight: '1.6' }}>
              Trending campaigns and upcoming events making a difference right now
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Featured items - top 3 most impactful */}
            {(() => {
              // Create featured array with specific high-impact items
              const featuredItems = [
                ...mockFundraisers.slice(2, 3).map(item => ({ ...item, type: 'fundraiser', sortDate: item.createdAt })), // Healthcare (high progress)
                ...mockEvents.slice(3, 4).map(item => ({ ...item, type: 'event', sortDate: item.startTime })), // Healthcare Rally (big crowd)
                ...mockFundraisers.slice(3, 4).map(item => ({ ...item, type: 'fundraiser', sortDate: item.createdAt })) // Voting Rights (near goal)
              ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

              return featuredItems.map((item) => {
                if (item.type === 'fundraiser') {
                  const progress = calculateProgress(item.currentAmount, item.goalAmount);
                  return (
                    <div key={`featured-fundraiser-${item.id}`} className="bg-white rounded-[20px] overflow-hidden hover:shadow-xl transition-all duration-300 mb-6 hover:-translate-y-1"
                         style={{
                           boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06)',
                           border: '1px solid #E5E7EB'
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.1)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06)';
                         }}>
                      <div className="md:flex">
                        {/* Fundraiser Image */}
                        <div className="md:flex-shrink-0">
                          <img
                            className="h-full w-full object-cover"
                            src={item.imageUrl}
                            alt={item.title}
                          />
                        </div>

                        {/* Fundraiser Content */}
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#E9FBF6] text-[#3EB489]" style={{ fontFamily: 'Figtree, system-ui, sans-serif' }}>
                                <Target className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
                                Featured Campaign
                              </span>
                              <span className="ml-3 text-sm text-gray-500">
                                Created {item.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {item.title}
                          </h3>
                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {item.description}
                          </p>

                          {/* Progress Section */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>Progress: {formatCurrency(item.currentAmount)} raised</span>
                              <span>{progress}% of {formatCurrency(item.goalAmount)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-mint-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleProtectedAction(() => {
                                  // Navigate to donation page or open donation modal
                                  window.location.href = '/demo';
                                })}
                                className="px-6 py-3 rounded-2xl font-medium text-white transition-all transform hover:-translate-y-0.5"
                                style={{
                                  background: 'linear-gradient(135deg, #02cb97 0%, #3EB489 100%)',
                                  boxShadow: '0 4px 16px rgba(2, 203, 151, 0.25)',
                                  fontFamily: 'Figtree, system-ui, sans-serif'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'linear-gradient(135deg, #3EB489 0%, #359A77 100%)';
                                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 203, 151, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'linear-gradient(135deg, #02cb97 0%, #3EB489 100%)';
                                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(2, 203, 151, 0.25)';
                                }}
                              >
                                Donate Now
                              </button>
                              <button
                                className="bg-white text-[#111827] border border-[#E5E7EB] px-6 py-3 rounded-2xl font-medium transition-all transform hover:-translate-y-0.5 hover:border-[#3EB489]"
                                style={{
                                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                                  fontFamily: 'Figtree, system-ui, sans-serif'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.04)';
                                }}
                              >
                                Learn More
                              </button>
                            </div>
                            {item.endDate && (
                              <span className="text-sm text-gray-500">
                                Ends {item.endDate.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Featured Event item
                  const eventTypeInfo = getEventTypeDisplay(item.eventType);
                  const spotsLeft = item.maxAttendees ? item.maxAttendees - item.currentAttendees : null;

                  return (
                    <div key={`featured-event-${item.id}`} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 mb-6">
                      <div className="md:flex">
                        {/* Event Image */}
                        <div className="md:flex-shrink-0">
                          <img
                            className="h-full w-full object-cover"
                            src={item.imageUrl}
                            alt={item.title}
                          />
                        </div>

                        {/* Event Content */}
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                <Star className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
                                Featured Event
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eventTypeInfo.color}`}>
                                <span className="mr-1">{getEventTypeIcon(item.eventType)}</span>
                                {eventTypeInfo.label}
                              </span>
                              {item.location?.isVirtual && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Virtual
                                </span>
                              )}
                            </div>
                          </div>

                          <Link to={`/event/${item.slug}`}>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors cursor-pointer">
                              {item.title}
                            </h3>
                          </Link>

                          {item.organizationName && (
                            <p className="text-sm text-gray-600 mb-2">
                              by <Link
                                to={`/organization/${getOrganizationSlug(item.organizationName)}`}
                                className="text-mint-600 hover:text-mint-700 font-medium transition-colors"
                              >
                                {item.organizationName}
                              </Link>
                            </p>
                          )}

                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {item.description}
                          </p>

                          {/* Event Details */}
                          <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 0h8m-8 0H3a2 2 0 000 4h3m5 0v12a2 2 0 002 2h10a2 2 0 002-2V9M8 7v8a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h2M8 7h8" />
                              </svg>
                              <span>{formatEventDate(item.startTime)}</span>
                            </div>

                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>
                                {item.location?.isVirtual ? 'Virtual Event' :
                                  `${item.location?.city}, ${item.location?.state}`
                                }
                              </span>
                            </div>

                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                              <span>{item.currentAttendees} attending</span>
                              {spotsLeft && spotsLeft > 0 && (
                                <span className="text-mint-600 ml-2">
                                  ({spotsLeft} spots left)
                                </span>
                              )}
                            </div>

                            {item.accessibility?.wheelchairAccessible && (
                              <div className="flex items-center text-mint-600">
                                <span>♿ Accessible</span>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => handleProtectedAction(() => {
                              // Handle event registration
                              alert(`Registering for: ${item.title}`);
                            })}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                          >
                            {item.requiresApproval ? 'Request to Join' : 'Sign Up to Attend'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              });
            })()}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            How Advotecate Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Three simple steps to launch your advocacy campaign and create lasting change
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Create Campaign Card */}
          <div className="bg-white shadow-xl rounded-xl p-8 text-center hover:shadow-2xl transition-shadow">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Create Your Cause
            </h3>
            <p className="text-gray-600 mb-6">
              Set up your advocacy campaign in minutes. Define your mission, set goals, and customize your fundraising pages.
            </p>
            <Link
              to="/register"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Connect Supporters Card */}
          <div className="bg-white shadow-xl rounded-xl p-8 text-center hover:shadow-2xl transition-shadow">
            <div className="bg-mint-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Connect Supporters
            </h3>
            <p className="text-gray-600 mb-6">
              Build your community with powerful outreach tools. Share your story, engage supporters, and grow your movement.
            </p>
            <Link
              to="/demo"
              className="inline-block bg-mint-600 hover:bg-mint-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              See Demo
            </Link>
          </div>

          {/* Drive Impact Card */}
          <div className="bg-white shadow-xl rounded-xl p-8 text-center hover:shadow-2xl transition-shadow">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Drive Impact
            </h3>
            <p className="text-gray-600 mb-6">
              Track your progress with real-time analytics. Secure donations, manage compliance, and measure your campaign's success.
            </p>
            <Link
              to="/admin/database"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              View Analytics
            </Link>
          </div>
        </div>
      </div>

      {/* Mixed Activity Feed */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Activity Feed
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Latest campaigns and events from advocacy groups working to create positive change
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Mixed feed items */}
            {(() => {
              // Create mixed array with type indicators
              const mixedItems = [
                ...mockFundraisers.slice(0, 3).map(item => ({ ...item, type: 'fundraiser', sortDate: item.createdAt })),
                ...mockEvents.slice(0, 3).map(item => ({ ...item, type: 'event', sortDate: item.startTime }))
              ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

              return mixedItems.map((item) => {
                if (item.type === 'fundraiser') {
                  const progress = calculateProgress(item.currentAmount, item.goalAmount);
                  return (
                    <div key={`fundraiser-${item.id}`} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 mb-8">
                      <div className="md:flex">
                        {/* Fundraiser Image */}
                        <div className="md:flex-shrink-0">
                          <img
                            className="h-full w-full object-cover"
                            src={item.imageUrl}
                            alt={item.title}
                          />
                        </div>

                        {/* Fundraiser Content */}
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-mint-100 text-mint-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                Fundraiser
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                Created {item.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {item.title}
                          </h3>
                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {item.description}
                          </p>

                          {/* Progress Section */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>Progress: {formatCurrency(item.currentAmount)} raised</span>
                              <span>{progress}% of {formatCurrency(item.goalAmount)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-mint-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleProtectedAction(() => {
                                  // Navigate to donation page or open donation modal
                                  window.location.href = '/demo';
                                })}
                                className="bg-mint-600 hover:bg-mint-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                              >
                                Donate Now
                              </button>
                              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                                Learn More
                              </button>
                            </div>
                            {item.endDate && (
                              <span className="text-xs text-gray-500">
                                Ends {item.endDate.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Event item
                  const eventTypeInfo = getEventTypeDisplay(item.eventType);
                  const spotsLeft = item.maxAttendees ? item.maxAttendees - item.currentAttendees : null;

                  return (
                    <div key={`event-${item.id}`} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 mb-8">
                      <div className="md:flex">
                        {/* Event Image */}
                        <div className="md:flex-shrink-0">
                          <img
                            className="h-full w-full object-cover"
                            src={item.imageUrl}
                            alt={item.title}
                          />
                        </div>

                        {/* Event Content */}
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eventTypeInfo.color}`}>
                                <span className="mr-1">{getEventTypeIcon(item.eventType)}</span>
                                {eventTypeInfo.label}
                              </span>
                              {item.location?.isVirtual && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Virtual
                                </span>
                              )}
                              {item.requiresApproval && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  RSVP Required
                                </span>
                              )}
                            </div>
                          </div>

                          <Link to={`/event/${item.slug}`}>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors cursor-pointer">
                              {item.title}
                            </h3>
                          </Link>

                          {item.organizationName && (
                            <p className="text-sm text-gray-600 mb-2">
                              by <Link
                                to={`/organization/${getOrganizationSlug(item.organizationName)}`}
                                className="text-mint-600 hover:text-mint-700 font-medium transition-colors"
                              >
                                {item.organizationName}
                              </Link>
                            </p>
                          )}

                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {item.description}
                          </p>

                          {/* Event Details */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 0h8m-8 0H3a2 2 0 000 4h3m5 0v12a2 2 0 002 2h10a2 2 0 002-2V9M8 7v8a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h2M8 7h8" />
                              </svg>
                              <span>{formatEventDate(item.startTime)}</span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>
                                {item.location?.isVirtual ? 'Virtual Event' :
                                  `${item.location?.city}, ${item.location?.state}`
                                }
                              </span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                              <span>{item.currentAttendees} attending</span>
                              {spotsLeft && spotsLeft > 0 && (
                                <span className="text-mint-600 ml-2">
                                  ({spotsLeft} spots left)
                                </span>
                              )}
                              {item.accessibility?.wheelchairAccessible && (
                                <span className="text-mint-600 ml-4">
                                  ♿ Accessible
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => handleProtectedAction(() => {
                              // Handle event registration
                              alert(`Registering for: ${item.title}`);
                            })}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm"
                          >
                            {item.requiresApproval ? 'Request to Join' : 'Sign Up to Attend'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              });
            })()}
          </div>

          {/* View All Links */}
          <div className="text-center mt-12 space-y-4">
            <div className="flex justify-center space-x-4 flex-wrap gap-2">
              <Link
                to="/register"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-mint-600 bg-mint-100 hover:bg-mint-200 transition-colors"
              >
                View All Campaigns
                <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-indigo-600 bg-indigo-100 hover:bg-indigo-200 transition-colors"
              >
                View All Events
                <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Platform Features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to run successful advocacy campaigns and create lasting change
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center hover:shadow-xl transition-shadow">
              <div className="bg-mint-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-mint-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Secure Fundraising</h3>
              <p className="text-gray-600">Bank-grade security with automated compliance tracking and transparent donation management for all your campaigns.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg text-center hover:shadow-xl transition-shadow">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Campaign Management</h3>
              <p className="text-gray-600">Organize multiple campaigns, manage team members, track progress, and coordinate your advocacy efforts from one dashboard.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg text-center hover:shadow-xl transition-shadow">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Real-time Analytics</h3>
              <p className="text-gray-600">Track donations, supporter engagement, campaign performance, and impact metrics with comprehensive reporting tools.</p>
            </div>
          </div>
        </div>
      </div>


      {/* Footer Section */}
      <div className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Advotecate</h3>
              <p className="text-gray-400">Empowering change through digital advocacy</p>
            </div>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-mint-600 rounded-full mr-3"></div>
                <span className="text-gray-300 font-medium">Platform Status</span>
                <span className="ml-auto text-mint-500">Online</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-mint-600 rounded-full mr-3"></div>
                <span className="text-gray-300 font-medium">Security</span>
                <span className="ml-auto text-mint-500">Secure</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-gray-300 font-medium">Environment</span>
                <span className="ml-auto text-blue-400">Production</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-mint-600 rounded-full mr-3"></div>
                <span className="text-gray-300 font-medium">Support</span>
                <span className="ml-auto text-mint-500">24/7</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={switchToRegister}
      />
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={switchToLogin}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Main route with authentication */}
          <Route path="/" element={<HomePage />} />

          {/* Event and Organization detail pages */}
          <Route path="/event/:eventSlug" element={<EventPage />} />
          <Route path="/organization/:organizationSlug" element={<OrganizationPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;