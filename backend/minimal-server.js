// Minimal Express server for testing admin functionality
import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

const DATA_FILE = './data.json';

// Default data
const defaultData = {
  organizations: [
    { id: 'org_1', name: 'Climate Action Now', slug: 'climate-action-now' },
    { id: 'org_2', name: 'Education First', slug: 'education-first' },
    { id: 'org_3', name: 'Healthcare for All', slug: 'healthcare-for-all' }
  ],
  users: [],
  fundraisers: [],
  events: []
};

// Load data from file or use defaults
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      console.log('📁 Loaded data from file:', Object.keys(data).map(k => `${k}: ${data[k].length}`).join(', '));
      return data;
    }
  } catch (error) {
    console.error('Error loading data file:', error);
  }
  console.log('📁 Using default data (file not found or error)');
  return defaultData;
}

// Save data to file
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Data saved to file');
  } catch (error) {
    console.error('Error saving data file:', error);
  }
}

// Initialize data
let data = loadData();
let organizations = data.organizations;
let users = data.users;
let fundraisers = data.fundraisers;
let events = data.events;

const mockEventCategories = [
  { id: 'cat_1', name: 'PHONE_BANK', display_name: 'Phone Bank' },
  { id: 'cat_2', name: 'RALLY', display_name: 'Rally' },
  { id: 'cat_3', name: 'CANVASSING', display_name: 'Canvassing' },
  { id: 'cat_4', name: 'FUNDRAISER', display_name: 'Fundraiser' },
  { id: 'cat_5', name: 'MEETING', display_name: 'Meeting' }
];

// Helper function to create slug from name
function createSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// API Routes
app.get('/api/v1/admin/organizations', (req, res) => {
  console.log('GET /api/v1/admin/organizations');
  res.json({
    success: true,
    organizations: organizations
  });
});

app.get('/api/v1/admin/event-categories', (req, res) => {
  console.log('GET /api/v1/admin/event-categories');
  res.json({
    success: true,
    categories: mockEventCategories
  });
});

app.post('/api/v1/admin/organizations', (req, res) => {
  console.log('POST /api/v1/admin/organizations', req.body);
  const newOrg = {
    id: `org_${Date.now()}`,
    slug: req.body.slug || createSlug(req.body.name),
    ...req.body,
    created_at: new Date().toISOString()
  };

  // Add to our in-memory storage
  organizations.push(newOrg);

  // Save to file
  saveData({ organizations, users, fundraisers, events });

  console.log(`✅ Created organization: ${newOrg.name} (${newOrg.id})`);
  console.log(`📊 Total organizations: ${organizations.length}`);

  res.status(201).json({
    success: true,
    organization: newOrg
  });
});

app.post('/api/v1/admin/users', (req, res) => {
  console.log('POST /api/v1/admin/users', req.body);
  const newUser = {
    id: `user_${Date.now()}`,
    ...req.body,
    created_at: new Date().toISOString()
  };

  // Add to our in-memory storage
  users.push(newUser);

  // Save to file
  saveData({ organizations, users, fundraisers, events });

  console.log(`✅ Created user: ${newUser.first_name} ${newUser.last_name} (${newUser.id})`);
  console.log(`📊 Total users: ${users.length}`);

  res.status(201).json({
    success: true,
    user: newUser
  });
});

app.post('/api/v1/admin/fundraisers', (req, res) => {
  console.log('POST /api/v1/admin/fundraisers', req.body);
  const newFundraiser = {
    id: `fund_${Date.now()}`,
    slug: req.body.slug || createSlug(req.body.title),
    ...req.body,
    // Convert snake_case to camelCase for frontend compatibility
    goalAmount: req.body.goal_amount,
    currentAmount: req.body.current_amount,
    suggestedAmounts: req.body.suggested_amounts,
    imageUrl: req.body.image_url,
    isActive: req.body.is_active,
    endDate: req.body.end_date,
    organizationId: req.body.organization_id,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  // Add to our in-memory storage
  fundraisers.push(newFundraiser);

  // Save to file
  saveData({ organizations, users, fundraisers, events });

  console.log(`✅ Created fundraiser: ${newFundraiser.title} (${newFundraiser.id})`);
  console.log(`📊 Total fundraisers: ${fundraisers.length}`);

  res.status(201).json({
    success: true,
    fundraiser: newFundraiser
  });
});

app.post('/api/v1/admin/events', (req, res) => {
  console.log('POST /api/v1/admin/events', req.body);
  const newEvent = {
    id: `event_${Date.now()}`,
    slug: req.body.slug || createSlug(req.body.title),
    ...req.body,
    created_at: new Date().toISOString()
  };

  // Add to our in-memory storage
  events.push(newEvent);

  // Save to file
  saveData({ organizations, users, fundraisers, events });

  console.log(`✅ Created event: ${newEvent.title} (${newEvent.id})`);
  console.log(`📊 Total events: ${events.length}`);

  res.status(201).json({
    success: true,
    event: newEvent
  });
});

// Image Upload Routes
app.post('/api/v1/upload/signed-url', (req, res) => {
  console.log('POST /api/v1/upload/signed-url', req.body);
  const { filename, contentType, folder = 'images' } = req.body;

  // For development, return a mock signed URL
  // In production, this would generate a real Google Cloud Storage signed URL
  const mockSignedUrl = `https://storage.googleapis.com/advotecate-images-dev/${folder}/${filename}`;
  const publicUrl = mockSignedUrl;

  res.json({
    success: true,
    uploadUrl: mockSignedUrl,
    publicUrl: publicUrl,
    expiresIn: 3600 // 1 hour
  });
});

// Public API Routes (for frontend feed display)
app.get('/api/v1/fundraisers', (req, res) => {
  console.log('GET /api/v1/fundraisers');
  res.json({
    success: true,
    fundraisers: fundraisers
  });
});

app.get('/api/v1/fundraisers/featured', (req, res) => {
  console.log('GET /api/v1/fundraisers/featured');
  // Return active fundraisers as featured for now
  const featuredFundraisers = fundraisers.filter(f => f.is_active);
  res.json({
    success: true,
    fundraisers: featuredFundraisers
  });
});

app.get('/api/v1/events', (req, res) => {
  console.log('GET /api/v1/events');
  res.json({
    success: true,
    events: events
  });
});

app.get('/api/v1/events/featured', (req, res) => {
  console.log('GET /api/v1/events/featured');
  // Return active events as featured for now
  const featuredEvents = events.filter(e => e.is_active);
  res.json({
    success: true,
    events: featuredEvents
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch all for debugging
app.use('*', (req, res) => {
  console.log(`${req.method} ${req.originalUrl} - Not Found`);
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal Backend Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin endpoints available at http://localhost:${PORT}/api/v1/admin/*`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});