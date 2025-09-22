# Advotecate Database Schema

This document outlines the database tables needed based on the TypeScript interfaces used in the frontend application.

## Core Tables

### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Organizations Table
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    type VARCHAR(50) CHECK (type IN ('POLITICAL', 'PAC', 'NONPROFIT')) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    fec_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Organization Members Table
```sql
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id)
);
```

### 4. Fundraisers Table
```sql
CREATE TABLE fundraisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    goal_amount INTEGER NOT NULL, -- Amount in cents
    current_amount INTEGER DEFAULT 0, -- Amount in cents
    suggested_amounts INTEGER[], -- Array of amounts in cents
    is_active BOOLEAN DEFAULT TRUE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Events Table - Core Event Information

### 5. Events Table
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_type VARCHAR(50) CHECK (event_type IN ('PHONE_BANK', 'CANVASS', 'VOLUNTEER', 'RALLY', 'FUNDRAISER', 'TRAINING', 'MEETING')) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    time_zone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    instructions TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Event Locations Table
```sql
CREATE TABLE event_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    is_virtual BOOLEAN DEFAULT FALSE,
    virtual_link VARCHAR(500),
    UNIQUE(event_id) -- One location per event
);
```

### 7. Event Tags Table
```sql
CREATE TABLE event_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 8. Event Accessibility Table
```sql
CREATE TABLE event_accessibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    wheelchair_accessible BOOLEAN DEFAULT FALSE,
    public_transit_accessible BOOLEAN DEFAULT FALSE,
    child_friendly BOOLEAN DEFAULT FALSE,
    notes TEXT,
    UNIQUE(event_id) -- One accessibility record per event
);
```

### 9. Event Registrations Table
```sql
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status VARCHAR(50) CHECK (status IN ('registered', 'approved', 'denied', 'cancelled')) DEFAULT 'registered',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
```

## Donations Table

### 10. Donations Table
```sql
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount INTEGER NOT NULL, -- Amount in cents
    recurring BOOLEAN DEFAULT FALSE,
    frequency VARCHAR(20) CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    donor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    donor_name VARCHAR(255) NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    message TEXT,
    fundraiser_id UUID NOT NULL REFERENCES fundraisers(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    payment_method_id VARCHAR(255),
    transaction_id VARCHAR(255),
    processor_transaction_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 11. Donor Information Table
```sql
CREATE TABLE donor_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    employer VARCHAR(255),
    occupation VARCHAR(255),
    UNIQUE(donation_id) -- One donor info record per donation
);
```

## Indexes for Performance

```sql
-- Events indexes
CREATE INDEX idx_events_organization_id ON events(organization_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_is_public ON events(is_public);

-- Organizations indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);

-- Organization members indexes
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_role ON organization_members(role);

-- Fundraisers indexes
CREATE INDEX idx_fundraisers_organization_id ON fundraisers(organization_id);
CREATE INDEX idx_fundraisers_slug ON fundraisers(slug);
CREATE INDEX idx_fundraisers_is_active ON fundraisers(is_active);
CREATE INDEX idx_fundraisers_end_date ON fundraisers(end_date);

-- Event registrations indexes
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);

-- Donations indexes
CREATE INDEX idx_donations_fundraiser_id ON donations(fundraiser_id);
CREATE INDEX idx_donations_organization_id ON donations(organization_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_created_at ON donations(created_at);

-- Event tags indexes
CREATE INDEX idx_event_tags_event_id ON event_tags(event_id);
CREATE INDEX idx_event_tags_tag_name ON event_tags(tag_name);

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
```

## Key Data Relationships

1. **Users ↔ Organizations** (Many-to-Many via organization_members)
   - Users can belong to multiple organizations
   - Organizations can have multiple users with different roles

2. **Organizations → Fundraisers** (One-to-Many)
   - Each fundraiser belongs to one organization
   - Organizations can have multiple fundraisers

3. **Organizations → Events** (One-to-Many)
   - Each event belongs to one organization
   - Organizations can have multiple events

4. **Events → Event Locations** (One-to-One)
   - Each event has exactly one location (physical or virtual)

5. **Events → Event Tags** (One-to-Many)
   - Events can have multiple tags
   - Tags help with filtering and discovery

6. **Events → Event Accessibility** (One-to-One)
   - Each event has one accessibility record
   - Stores accessibility-related information

7. **Events → Event Registrations** (One-to-Many)
   - Events can have multiple registrations
   - Tracks who's attending each event

8. **Fundraisers → Donations** (One-to-Many)
   - Each donation is tied to a specific fundraiser
   - Fundraisers can have multiple donations

9. **Donations → Donor Information** (One-to-One)
   - Each donation has associated donor information
   - Required for compliance and reporting

## Frontend Interface Mapping

### Event Interface Fields → Database Tables

| Frontend Field | Database Location | Notes |
|----------------|------------------|-------|
| `id` | `events.id` | Primary key |
| `slug` | `events.slug` | URL-friendly identifier |
| `title` | `events.title` | Event name |
| `description` | `events.description` | Event details |
| `eventType` | `events.event_type` | Enum constraint |
| `organizationId` | `events.organization_id` | Foreign key |
| `organizationName` | `organizations.name` | Via JOIN |
| `startTime` | `events.start_time` | Timestamp with timezone |
| `endTime` | `events.end_time` | Timestamp with timezone |
| `timeZone` | `events.time_zone` | String |
| `location` | `event_locations.*` | Separate table |
| `maxAttendees` | `events.max_attendees` | Integer |
| `currentAttendees` | `events.current_attendees` | Calculated field |
| `isPublic` | `events.is_public` | Boolean |
| `requiresApproval` | `events.requires_approval` | Boolean |
| `instructions` | `events.instructions` | Text field |
| `contactEmail` | `events.contact_email` | String |
| `contactPhone` | `events.contact_phone` | String |
| `imageUrl` | `events.image_url` | String |
| `tags` | `event_tags.tag_name` | Array via JOIN |
| `accessibility` | `event_accessibility.*` | Separate table |
| `createdAt` | `events.created_at` | Timestamp |
| `updatedAt` | `events.updated_at` | Timestamp |

## Query Examples

### Get Event with All Related Data
```sql
SELECT
    e.*,
    o.name as organization_name,
    el.name as location_name,
    el.address,
    el.city,
    el.state,
    el.zip_code,
    el.is_virtual,
    el.virtual_link,
    ea.wheelchair_accessible,
    ea.public_transit_accessible,
    ea.child_friendly,
    ea.notes as accessibility_notes,
    ARRAY_AGG(et.tag_name) as tags
FROM events e
LEFT JOIN organizations o ON e.organization_id = o.id
LEFT JOIN event_locations el ON e.id = el.event_id
LEFT JOIN event_accessibility ea ON e.id = ea.event_id
LEFT JOIN event_tags et ON e.id = et.event_id
WHERE e.slug = $1
GROUP BY e.id, o.name, el.name, el.address, el.city, el.state, el.zip_code,
         el.is_virtual, el.virtual_link, ea.wheelchair_accessible,
         ea.public_transit_accessible, ea.child_friendly, ea.notes;
```

### Get Events Feed (Mixed with Fundraisers)
```sql
-- Events for feed
SELECT
    e.id,
    e.slug,
    e.title,
    e.description,
    e.image_url,
    e.start_time as sort_date,
    'event' as item_type,
    o.name as organization_name
FROM events e
LEFT JOIN organizations o ON e.organization_id = o.id
WHERE e.is_public = true AND e.start_time > CURRENT_TIMESTAMP

UNION ALL

-- Fundraisers for feed
SELECT
    f.id,
    f.slug,
    f.title,
    f.description,
    f.image_url,
    f.created_at as sort_date,
    'fundraiser' as item_type,
    o.name as organization_name
FROM fundraisers f
LEFT JOIN organizations o ON f.organization_id = o.id
WHERE f.is_active = true

ORDER BY sort_date DESC
LIMIT 10;
```

This schema provides a solid foundation for your advocacy platform with proper normalization, performance indexes, and data relationships that match your TypeScript interfaces.