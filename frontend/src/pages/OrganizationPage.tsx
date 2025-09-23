import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Globe, Mail, Building, MapPin, Calendar, Users, ExternalLink, CheckCircle, Shield } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import type { Organization, Fundraiser, Event } from '../types/api'

// Mock organization data
const mockOrganizations: Organization[] = [
  {
    id: 'org_1',
    slug: 'climate-action-now',
    name: 'Climate Action Now',
    description: 'Leading the fight against climate change through grassroots organizing, policy advocacy, and direct action. We believe that immediate action is necessary to prevent catastrophic climate change and ensure a sustainable future for generations to come.',
    logoUrl: 'https://images.unsplash.com/photo-1569163139394-de4e4f43e4e3?w=200&h=200&fit=crop&crop=center',
    websiteUrl: 'https://climateactionnow.org',
    type: 'NONPROFIT',
    isActive: true,
    isVerified: true,
    createdAt: new Date('2020-01-15'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 'org_2',
    slug: 'healthcare-for-all',
    name: 'Healthcare for All',
    description: 'Fighting for universal healthcare access and affordable medical care for every American. We organize communities, lobby lawmakers, and raise awareness about the healthcare crisis facing working families.',
    logoUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=200&h=200&fit=crop&crop=center',
    websiteUrl: 'https://healthcareforall.org',
    type: 'NONPROFIT',
    isActive: true,
    isVerified: true,
    createdAt: new Date('2019-05-20'),
    updatedAt: new Date('2024-02-28')
  },
  {
    id: 'org_3',
    slug: 'democratic-future-pac',
    name: 'Democratic Future PAC',
    description: 'Supporting progressive candidates who champion voting rights, economic equality, and social justice. We provide funding, volunteers, and strategic support to candidates who share our vision of a more equitable democracy.',
    logoUrl: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=200&h=200&fit=crop&crop=center',
    websiteUrl: 'https://democraticfuture.org',
    type: 'PAC',
    isActive: true,
    isVerified: true,
    fecId: 'C00123456',
    createdAt: new Date('2018-09-10'),
    updatedAt: new Date('2024-02-15')
  }
];

// Mock related fundraisers and events for the organization
const getOrganizationFundraisers = (organizationId: string): Fundraiser[] => {
  const allFundraisers: Fundraiser[] = [
    {
      id: 'fund_1',
      slug: 'emergency-climate-fund',
      title: 'Emergency Climate Action Fund',
      description: 'Help us mobilize communities nationwide to fight climate change.',
      imageUrl: 'https://images.unsplash.com/photo-1569163139394-de4e4f43e4e3?w=400&h=200&fit=crop',
      organizationId: 'org_1',
      goalAmount: 50000,
      currentAmount: 32500,
      suggestedAmounts: [25, 50, 100, 250],
      isActive: true,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-01')
    },
    {
      id: 'fund_2',
      slug: 'healthcare-access-campaign',
      title: 'Healthcare Access Campaign',
      description: 'Funding our advocacy efforts to expand healthcare coverage.',
      imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=200&fit=crop',
      organizationId: 'org_2',
      goalAmount: 75000,
      currentAmount: 28750,
      suggestedAmounts: [50, 100, 250, 500],
      isActive: true,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-05')
    }
  ];

  return allFundraisers.filter(f => f.organizationId === organizationId);
};

const getOrganizationEvents = (organizationId: string): Event[] => {
  const allEvents: Event[] = [
    {
      id: 'event_1',
      slug: 'phone-bank-climate-action',
      title: 'Phone Bank for Climate Action',
      description: 'Join us for an evening of phone banking to contact voters about upcoming climate legislation.',
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
      tags: ['climate', 'phone-bank', 'legislation'],
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-03-01')
    }
  ];

  return allEvents.filter(e => e.organizationId === organizationId);
};

export default function OrganizationPage() {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<'about' | 'fundraisers' | 'events'>('about');

  useEffect(() => {
    // Find organization by slug
    const foundOrganization = mockOrganizations.find(org => org.slug === organizationSlug);
    if (foundOrganization) {
      setOrganization(foundOrganization);
      setFundraisers(getOrganizationFundraisers(foundOrganization.id));
      setEvents(getOrganizationEvents(foundOrganization.id));
    }
  }, [organizationSlug]);

  if (!organization) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Organization not found</h1>
            <Link
              to="/"
              className="text-mint-600 hover:text-mint-700 font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const getOrganizationTypeDisplay = (type: Organization['type']) => {
    const types = {
      'POLITICAL': { label: 'Political Campaign', color: 'bg-blue-100 text-blue-800', icon: <Building className="w-4 h-4" strokeWidth={1.5} /> },
      'PAC': { label: 'Political Action Committee', color: 'bg-purple-100 text-purple-800', icon: <Shield className="w-4 h-4" strokeWidth={1.5} /> },
      'NONPROFIT': { label: 'Nonprofit Organization', color: 'bg-mint-100 text-mint-800', icon: <Building className="w-4 h-4" strokeWidth={1.5} /> },
      'nonprofit': { label: 'Nonprofit Organization', color: 'bg-mint-100 text-mint-800', icon: <Building className="w-4 h-4" strokeWidth={1.5} /> }
    };
    return types[type] || types['NONPROFIT'];
  };

  const typeDisplay = getOrganizationTypeDisplay(organization.type);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-mint-50/30 to-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center text-mint-600 hover:text-mint-700 font-medium mb-6 transition-colors"
          >
            ← Back to Home
          </Link>

          {/* Organization Header */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
            <div className="relative h-48 bg-gradient-to-r from-mint-400 to-mint-600">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-end gap-6">
                  {organization.logoUrl && (
                    <div className="w-24 h-24 rounded-2xl bg-white shadow-xl flex-shrink-0 overflow-hidden">
                      <img
                        src={organization.logoUrl}
                        alt={`${organization.name} logo`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-white font-Poppins">
                        {organization.name}
                      </h1>
                      {organization.isVerified && (
                        <CheckCircle className="w-6 h-6 text-white flex-shrink-0" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${typeDisplay.color}`}>
                        {typeDisplay.icon}
                        {typeDisplay.label}
                      </span>
                      {organization.fecId && (
                        <span className="text-white/90 text-sm bg-white/20 px-3 py-1.5 rounded-full">
                          FEC ID: {organization.fecId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { key: 'about', label: 'About', count: null },
                  { key: 'fundraisers', label: 'Fundraisers', count: fundraisers.length },
                  { key: 'events', label: 'Events', count: events.length }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'border-mint-500 text-mint-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && (
                      <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'about' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3 font-Poppins">About {organization.name}</h2>
                    <p className="text-gray-600 leading-relaxed font-Figtree">
                      {organization.description}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 font-Poppins">Organization Details</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                          <span className="text-gray-600 font-Figtree">
                            Founded {formatDate(organization.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Building className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                          <span className="text-gray-600 font-Figtree">
                            {typeDisplay.label}
                          </span>
                        </div>
                        {organization.websiteUrl && (
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                            <a
                              href={organization.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mint-600 hover:text-mint-700 font-Figtree inline-flex items-center gap-1"
                            >
                              Visit Website
                              <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 font-Poppins">Quick Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-mint-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-mint-600 font-Poppins">{fundraisers.length}</div>
                          <div className="text-sm text-gray-600 font-Figtree">Active Fundraisers</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600 font-Poppins">{events.length}</div>
                          <div className="text-sm text-gray-600 font-Figtree">Upcoming Events</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fundraisers' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 font-Poppins">
                    Active Fundraisers ({fundraisers.length})
                  </h2>
                  {fundraisers.length > 0 ? (
                    <div className="grid gap-6">
                      {fundraisers.map(fundraiser => (
                        <div key={fundraiser.id} className="border rounded-2xl p-6 hover:shadow-lg transition-shadow">
                          <div className="flex gap-6">
                            {fundraiser.imageUrl && (
                              <img
                                src={fundraiser.imageUrl}
                                alt={fundraiser.title}
                                className="w-32 h-24 rounded-xl object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-gray-900 mb-2 font-Poppins">
                                {fundraiser.title}
                              </h3>
                              <p className="text-gray-600 mb-4 font-Figtree">
                                {fundraiser.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-500 font-Figtree">
                                  ${fundraiser.currentAmount.toLocaleString()} of ${fundraiser.goalAmount.toLocaleString()} raised
                                </div>
                                <Link
                                  to={`/fundraiser/${fundraiser.slug}`}
                                  className="text-mint-600 hover:text-mint-700 font-medium font-Figtree"
                                >
                                  View Fundraiser →
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <Building className="w-16 h-16 mx-auto" strokeWidth={1} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 font-Poppins">No Active Fundraisers</h3>
                      <p className="text-gray-600 font-Figtree">This organization doesn't have any active fundraisers at the moment.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 font-Poppins">
                    Upcoming Events ({events.length})
                  </h2>
                  {events.length > 0 ? (
                    <div className="grid gap-6">
                      {events.map(event => (
                        <div key={event.id} className="border rounded-2xl p-6 hover:shadow-lg transition-shadow">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2 font-Poppins">
                                <Link
                                  to={`/event/${event.slug}`}
                                  className="hover:text-mint-600 transition-colors"
                                >
                                  {event.title}
                                </Link>
                              </h3>
                              <p className="text-gray-600 font-Figtree">{event.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 font-Figtree">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" strokeWidth={1.5} />
                              {formatDate(event.startTime)}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" strokeWidth={1.5} />
                                {event.location.city}, {event.location.state}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" strokeWidth={1.5} />
                              {event.currentAttendees} attending
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <Calendar className="w-16 h-16 mx-auto" strokeWidth={1} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 font-Poppins">No Upcoming Events</h3>
                      <p className="text-gray-600 font-Figtree">This organization doesn't have any upcoming events scheduled.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}