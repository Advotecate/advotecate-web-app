import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Phone, DoorOpen, Handshake, Megaphone, DollarSign, GraduationCap, ClipboardList } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import type { Event, Organization } from '../types/api'

// Mock event data - same as in App.tsx
const mockEvents: Event[] = [
  {
    id: 'event_1',
    slug: 'phone-bank-climate-action',
    title: 'Phone Bank for Climate Action',
    description: 'Join us for an evening of phone banking to contact voters about upcoming climate legislation. No experience necessary - we\'ll provide training and scripts! This is a crucial time to reach out to undecided voters and ensure they understand the importance of environmental protection policies.',
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
    instructions: 'Please bring a charged phone and laptop if possible. Light refreshments will be provided. We\'ll start with a 30-minute training session covering the calling script, how to handle common questions, and data entry procedures.',
    contactEmail: 'volunteer@climateactionnow.org',
    contactPhone: '(202) 555-0123',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=400&fit=crop',
    tags: ['Phone Banking', 'Climate', 'Evening', 'Beginner Friendly'],
    accessibility: {
      wheelchairAccessible: true,
      publicTransitAccessible: true,
      childFriendly: false,
      notes: 'Building has elevator access and accessible restrooms. Metro Blue/Orange line, Federal Triangle stop (5 min walk).'
    },
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-20')
  },
  {
    id: 'event_2',
    slug: 'weekend-canvass-education',
    title: 'Weekend Door-to-Door Canvass',
    description: 'Help us talk to voters about education funding and school choice. We\'ll be canvassing friendly neighborhoods and gathering supporter information. This is a great opportunity for both experienced canvassers and newcomers to get involved in grassroots organizing.',
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
    instructions: 'Wear comfortable walking shoes and bring water. We\'ll provide clipboards, literature, and training. Meeting starts promptly at 10 AM with coffee and donuts, followed by territory assignments and training.',
    contactEmail: 'canvass@educationfirst.org',
    contactPhone: '(703) 555-0456',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=400&fit=crop',
    tags: ['Canvassing', 'Education', 'Weekend', 'Outdoor Activity'],
    accessibility: {
      wheelchairAccessible: true,
      publicTransitAccessible: true,
      childFriendly: true,
      notes: 'Family-friendly event. Children welcome with parent supervision. Stroller-friendly routes available.'
    },
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-18')
  },
  {
    id: 'event_3',
    slug: 'virtual-postcard-writing',
    title: 'Virtual Postcard Writing Party',
    description: 'Join us online for a fun evening of writing personalized postcards to voters. Perfect for volunteers who want to help from home! We\'ll provide addresses, scripts, and a social atmosphere to make the work enjoyable and impactful.',
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
    instructions: 'You\'ll need postcards, stamps, and pens. We\'ll send you addresses and messaging guidelines beforehand. Join the Zoom call for community and motivation while you write. Optional: bring snacks and your favorite beverage!',
    contactEmail: 'postcards@votingrights.org',
    contactPhone: '(202) 555-0789',
    imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=400&fit=crop',
    tags: ['Virtual', 'Postcards', 'Evening', 'Remote', 'Social'],
    accessibility: {
      wheelchairAccessible: true,
      publicTransitAccessible: true,
      childFriendly: true,
      notes: 'Virtual event accessible to all. Closed captioning available upon request.'
    },
    createdAt: new Date('2024-02-08'),
    updatedAt: new Date('2024-02-22')
  },
  {
    id: 'event_4',
    slug: 'healthcare-rally-capitol',
    title: 'Healthcare Rally at the Capitol',
    description: 'Join hundreds of advocates for a rally supporting universal healthcare. We\'ll hear from patients, doctors, and elected officials about the urgent need for healthcare reform. This is a powerful opportunity to make your voice heard on this critical issue.',
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
    instructions: 'Bring signs, water, and wear comfortable shoes. Security screening required for Capitol grounds. Arrive early as security lines can be long. Speakers include Senator Smith, Dr. Johnson from Johns Hopkins, and patient advocate Maria Rodriguez.',
    contactEmail: 'rally@healthcareforall.org',
    contactPhone: '(202) 555-0345',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop',
    tags: ['Rally', 'Healthcare', 'Capitol', 'Midday', 'Public Speaking'],
    accessibility: {
      wheelchairAccessible: true,
      publicTransitAccessible: true,
      childFriendly: true,
      notes: 'Metro accessible, multiple entrances available. ASL interpreters will be provided. Accessible viewing areas for wheelchair users.'
    },
    createdAt: new Date('2024-01-30'),
    updatedAt: new Date('2024-02-25')
  },
  {
    id: 'event_5',
    slug: 'campaign-volunteer-training',
    title: 'Campaign Volunteer Training',
    description: 'Learn the basics of political organizing! This comprehensive training covers phone banking, canvassing, voter registration, digital organizing, and volunteer management. Perfect for new volunteers or those wanting to develop leadership skills.',
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
    instructions: 'Please bring a notebook and pen. Lunch will be provided. Registration required 48 hours in advance. Training materials and certificate of completion provided. Networking session follows the formal training.',
    contactEmail: 'training@democracyaction.org',
    contactPhone: '(804) 555-0567',
    imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
    tags: ['Training', 'All Day', 'Registration Required', 'Leadership Development', 'Networking'],
    accessibility: {
      wheelchairAccessible: true,
      publicTransitAccessible: false,
      childFriendly: false,
      notes: 'Parking available on-site. Not recommended for children due to intensive nature of training.'
    },
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-12')
  }
];

// Mock organizations for context
const mockOrganizations: Organization[] = [
  { id: 'org_1', name: 'Climate Action Now', slug: 'climate-action-now', description: 'Fighting for environmental protection', type: 'POLITICAL', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'org_2', name: 'Education First Coalition', slug: 'education-first', description: 'Advocating for quality education', type: 'POLITICAL', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'org_3', name: 'Healthcare for All', slug: 'healthcare-for-all', description: 'Universal healthcare advocacy', type: 'POLITICAL', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'org_4', name: 'Voting Rights Alliance', slug: 'voting-rights', description: 'Protecting voting rights', type: 'POLITICAL', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'org_5', name: 'Democratic Action Network', slug: 'democratic-action', description: 'Democratic organizing', type: 'POLITICAL', isActive: true, createdAt: new Date(), updatedAt: new Date() }
];

export default function EventPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    // Find the event by slug
    const foundEvent = mockEvents.find(e => e.slug === eventSlug);
    if (foundEvent) {
      setEvent(foundEvent);

      // Find the organization
      const foundOrg = mockOrganizations.find(org => org.id === foundEvent.organizationId);
      setOrganization(foundOrg || null);
    }
  }, [eventSlug]);

  if (!event) {
    return (
      <AppLayout organizations={mockOrganizations}>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
            <Link to="/" className="text-blue-600 hover:text-blue-800">
              Return to Home
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    }).format(date);
  };

  const getEventTypeDisplay = (eventType: Event['eventType']) => {
    const types = {
      'PHONE_BANK': { label: 'Phone Bank', color: 'bg-blue-100 text-blue-800', icon: <Phone className="w-4 h-4" strokeWidth={1.5} /> },
      'CANVASS': { label: 'Canvass', color: 'bg-green-100 text-green-800', icon: <DoorOpen className="w-4 h-4" strokeWidth={1.5} /> },
      'VOLUNTEER': { label: 'Volunteer', color: 'bg-purple-100 text-purple-800', icon: <Handshake className="w-4 h-4" strokeWidth={1.5} /> },
      'RALLY': { label: 'Rally', color: 'bg-red-100 text-red-800', icon: <Megaphone className="w-4 h-4" strokeWidth={1.5} /> },
      'FUNDRAISER': { label: 'Fundraiser', color: 'bg-yellow-100 text-yellow-800', icon: <DollarSign className="w-4 h-4" strokeWidth={1.5} /> },
      'TRAINING': { label: 'Training', color: 'bg-indigo-100 text-indigo-800', icon: <GraduationCap className="w-4 h-4" strokeWidth={1.5} /> },
      'MEETING': { label: 'Meeting', color: 'bg-gray-100 text-gray-800', icon: <ClipboardList className="w-4 h-4" strokeWidth={1.5} /> }
    };
    return types[eventType] || types['VOLUNTEER'];
  };

  const eventTypeInfo = getEventTypeDisplay(event.eventType);
  const spotsLeft = event.maxAttendees ? event.maxAttendees - event.currentAttendees : null;

  const handleRegistration = () => {
    setIsRegistered(!isRegistered);
    // In a real app, this would make an API call
  };

  return (
    <AppLayout organizations={mockOrganizations}>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-blue-600">Home</Link>
            <span>›</span>
            <Link to="/" className="hover:text-blue-600">Events</Link>
            <span>›</span>
            <span className="text-gray-900">{event.title}</span>
          </div>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Event Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${eventTypeInfo.color}`}>
                  <span className="mr-2">{eventTypeInfo.icon}</span>
                  {eventTypeInfo.label}
                </span>
                {event.location?.isVirtual && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    🌐 Virtual
                  </span>
                )}
                {event.requiresApproval && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                    ✋ RSVP Required
                  </span>
                )}
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {event.title}
              </h1>

              {organization && (
                <div className="flex items-center text-lg text-gray-600 mb-6">
                  <span>Organized by</span>
                  <Link
                    to={`/org/${organization.slug}`}
                    className="ml-2 font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {organization.name}
                  </Link>
                </div>
              )}
            </div>

            {/* Event Image */}
            <div className="mb-8">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-64 lg:h-80 object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Event Description */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">About This Event</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            </div>

            {/* Instructions */}
            {event.instructions && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">What to Expect</h2>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {event.instructions}
                  </p>
                </div>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              {/* Registration Status */}
              <div className="mb-6">
                {isRegistered ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-800 font-medium">You're registered!</span>
                    </div>
                  </div>
                ) : null}

                <button
                  onClick={handleRegistration}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-center transition-colors ${
                    isRegistered
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isRegistered ? 'Cancel Registration' : (event.requiresApproval ? 'Request to Join' : 'Sign Up')}
                </button>
              </div>

              {/* Event Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Event Details</h3>

                {/* Date & Time */}
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 0h8m-8 0H3a2 2 0 000 4h3m5 0v12a2 2 0 002 2h10a2 2 0 002-2V9M8 7v8a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h2M8 7h8" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Start Time</p>
                    <p className="text-sm text-gray-600">{formatDateTime(event.startTime)}</p>
                    <p className="font-medium text-gray-900 mt-2">End Time</p>
                    <p className="text-sm text-gray-600">{formatDateTime(event.endTime)}</p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Location</p>
                    {event.location?.isVirtual ? (
                      <div>
                        <p className="text-sm text-gray-600">Virtual Event</p>
                        {event.location.virtualLink && (
                          <a
                            href={event.location.virtualLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Join Virtual Event
                          </a>
                        )}
                      </div>
                    ) : (
                      <div>
                        {event.location?.name && (
                          <p className="text-sm text-gray-900 font-medium">{event.location.name}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          {event.location?.address}<br />
                          {event.location?.city}, {event.location?.state} {event.location?.zipCode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attendance */}
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Attendance</p>
                    <p className="text-sm text-gray-600">
                      {event.currentAttendees} registered
                      {spotsLeft && spotsLeft > 0 && (
                        <span className="text-green-600 block">
                          {spotsLeft} spots remaining
                        </span>
                      )}
                      {event.maxAttendees && (
                        <span className="text-gray-500 block">
                          Max capacity: {event.maxAttendees}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Contact */}
                {(event.contactEmail || event.contactPhone) && (
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">Contact</p>
                      {event.contactEmail && (
                        <a
                          href={`mailto:${event.contactEmail}`}
                          className="text-sm text-blue-600 hover:text-blue-800 block"
                        >
                          {event.contactEmail}
                        </a>
                      )}
                      {event.contactPhone && (
                        <a
                          href={`tel:${event.contactPhone}`}
                          className="text-sm text-blue-600 hover:text-blue-800 block"
                        >
                          {event.contactPhone}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Accessibility */}
                {event.accessibility && (
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">Accessibility</p>
                      <div className="text-sm text-gray-600 space-y-1">
                        {event.accessibility.wheelchairAccessible && (
                          <p className="text-green-600">♿ Wheelchair accessible</p>
                        )}
                        {event.accessibility.publicTransitAccessible && (
                          <p className="text-green-600">🚇 Public transit accessible</p>
                        )}
                        {event.accessibility.childFriendly && (
                          <p className="text-green-600">👶 Child friendly</p>
                        )}
                        {event.accessibility.notes && (
                          <p className="text-gray-600 mt-2">{event.accessibility.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Event Visibility */}
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">Visibility</p>
                    <p className="text-sm text-gray-600">
                      {event.isPublic ? 'Public event' : 'Private event'}
                    </p>
                  </div>
                </div>

                {/* Event Metadata */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Created: {event.createdAt.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated: {event.updatedAt.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Event ID: {event.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    Slug: {event.slug}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}