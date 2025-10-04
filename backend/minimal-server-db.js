// Minimal Express server with PostgreSQL database integration
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = 3001;

// Database connection to sandbox/Cloud SQL
const pool = new Pool({
  host: '127.0.0.1',  // Cloud SQL proxy address
  port: 5432,         // Cloud SQL proxy port
  database: 'advotecate_payments_dev',
  user: 'advotecate_app_dev',
  password: 'XPyL97uYXWuLMyaO2nu17MbLC',
  ssl: false  // No SSL needed for Cloud SQL proxy
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to create slug from name
function createSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Mock event categories (could be moved to database later)
const mockEventCategories = [
  { id: 'cat_1', name: 'PHONE_BANK', display_name: 'Phone Bank' },
  { id: 'cat_2', name: 'RALLY', display_name: 'Rally' },
  { id: 'cat_3', name: 'CANVASSING', display_name: 'Canvassing' },
  { id: 'cat_4', name: 'FUNDRAISER', display_name: 'Fundraiser' },
  { id: 'cat_5', name: 'MEETING', display_name: 'Meeting' }
];

// API Routes
app.get('/api/v1/admin/organizations', async (req, res) => {
  console.log('GET /api/v1/admin/organizations');
  try {
    const result = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
    res.json({
      success: true,
      organizations: result.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organizations'
    });
  }
});

app.get('/api/v1/admin/event-categories', (req, res) => {
  console.log('GET /api/v1/admin/event-categories');
  res.json({
    success: true,
    categories: mockEventCategories
  });
});

app.post('/api/v1/admin/organizations', async (req, res) => {
  console.log('POST /api/v1/admin/organizations', req.body);
  try {
    const { name, description, website, contact_email, logo_url, is_active = true } = req.body;
    const slug = req.body.slug || createSlug(name);
    const id = `org_${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO organizations (id, name, slug, description, website, contact_email, logo_url, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name, slug, description, website, contact_email, logo_url, is_active, created_at]
    );

    const newOrg = result.rows[0];
    console.log(`✅ Created organization: ${newOrg.name} (${newOrg.id})`);

    res.status(201).json({
      success: true,
      organization: newOrg
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create organization'
    });
  }
});

app.post('/api/v1/admin/fundraisers', async (req, res) => {
  console.log('POST /api/v1/admin/fundraisers', req.body);
  try {
    const {
      title,
      description,
      organization_id,
      goal_amount,
      current_amount = 0,
      suggested_amounts,
      image_url,
      is_active = true,
      end_date
    } = req.body;

    const slug = req.body.slug || createSlug(title);
    const id = `fund_${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO fundraisers (id, title, slug, description, organization_id, goal_amount, current_amount, suggested_amounts, image_url, is_active, end_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [id, title, slug, description, organization_id, goal_amount, current_amount, JSON.stringify(suggested_amounts), image_url, is_active, end_date, created_at]
    );

    const newFundraiser = result.rows[0];

    // Convert to frontend-compatible format
    const fundraiserResponse = {
      ...newFundraiser,
      goalAmount: newFundraiser.goal_amount,
      currentAmount: newFundraiser.current_amount,
      suggestedAmounts: Array.isArray(newFundraiser.suggested_amounts) ? newFundraiser.suggested_amounts : JSON.parse(newFundraiser.suggested_amounts || '[]'),
      imageUrl: newFundraiser.image_url,
      isActive: newFundraiser.is_active,
      endDate: newFundraiser.end_date,
      organizationId: newFundraiser.organization_id,
      createdAt: newFundraiser.created_at
    };

    console.log(`✅ Created fundraiser: ${newFundraiser.title} (${newFundraiser.id})`);

    res.status(201).json({
      success: true,
      fundraiser: fundraiserResponse
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create fundraiser'
    });
  }
});

app.post('/api/v1/admin/users', async (req, res) => {
  console.log('POST /api/v1/admin/users', req.body);
  try {
    const { first_name, last_name, email, role = 'MEMBER' } = req.body;
    const id = `user_${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, email, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, first_name, last_name, email, role, created_at]
    );

    const newUser = result.rows[0];
    console.log(`✅ Created user: ${newUser.first_name} ${newUser.last_name} (${newUser.id})`);

    res.status(201).json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

app.post('/api/v1/admin/events', async (req, res) => {
  console.log('POST /api/v1/admin/events', req.body);
  try {
    const {
      title,
      description,
      organization_id,
      event_date,
      location,
      max_attendees,
      is_active = true
    } = req.body;

    const slug = req.body.slug || createSlug(title);
    const id = `event_${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO events (id, title, slug, description, organization_id, event_date, location, max_attendees, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, title, slug, description, organization_id, event_date, location, max_attendees, is_active, created_at]
    );

    const newEvent = result.rows[0];
    console.log(`✅ Created event: ${newEvent.title} (${newEvent.id})`);

    res.status(201).json({
      success: true,
      event: newEvent
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event'
    });
  }
});

// Image Upload Routes
app.post('/api/v1/upload/signed-url', (req, res) => {
  console.log('POST /api/v1/upload/signed-url', req.body);
  const { filename, contentType, folder = 'images' } = req.body;

  // For development, return a mock signed URL
  const mockSignedUrl = `https://storage.googleapis.com/advotecate-images-dev/${folder}/${filename}`;
  const publicUrl = mockSignedUrl;

  res.json({
    success: true,
    uploadUrl: mockSignedUrl,
    publicUrl: publicUrl,
    expiresIn: 3600
  });
});

// Public API Routes (for frontend feed display)
app.get('/api/v1/fundraisers', async (req, res) => {
  console.log('GET /api/v1/fundraisers');
  try {
    const result = await pool.query(`
      SELECT f.*, o.name as organization_name
      FROM fundraisers f
      LEFT JOIN organizations o ON f.organization_id = o.id
      WHERE f.is_active = true
      ORDER BY f.created_at DESC
    `);

    // Convert to frontend-compatible format
    const fundraisers = result.rows.map(f => ({
      ...f,
      goalAmount: f.goal_amount,
      currentAmount: f.current_amount,
      suggestedAmounts: Array.isArray(f.suggested_amounts) ? f.suggested_amounts : JSON.parse(f.suggested_amounts || '[]'),
      imageUrl: f.image_url,
      isActive: f.is_active,
      endDate: f.end_date,
      organizationId: f.organization_id,
      createdAt: f.created_at
    }));

    res.json({
      success: true,
      fundraisers: fundraisers
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fundraisers'
    });
  }
});

app.get('/api/v1/fundraisers/featured', async (req, res) => {
  console.log('GET /api/v1/fundraisers/featured');
  try {
    const result = await pool.query(`
      SELECT f.*, o.name as organization_name
      FROM fundraisers f
      LEFT JOIN organizations o ON f.organization_id = o.id
      WHERE f.is_active = true
      ORDER BY f.created_at DESC
      LIMIT 6
    `);

    // Convert to frontend-compatible format
    const fundraisers = result.rows.map(f => ({
      ...f,
      goalAmount: f.goal_amount,
      currentAmount: f.current_amount,
      suggestedAmounts: Array.isArray(f.suggested_amounts) ? f.suggested_amounts : JSON.parse(f.suggested_amounts || '[]'),
      imageUrl: f.image_url,
      isActive: f.is_active,
      endDate: f.end_date,
      organizationId: f.organization_id,
      createdAt: f.created_at
    }));

    res.json({
      success: true,
      fundraisers: fundraisers
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured fundraisers'
    });
  }
});

app.get('/api/v1/events', async (req, res) => {
  console.log('GET /api/v1/events');
  try {
    const result = await pool.query(`
      SELECT e.*, o.name as organization_name
      FROM events e
      LEFT JOIN organizations o ON e.organization_id = o.id
      WHERE e.is_active = true
      ORDER BY e.event_date ASC
    `);

    res.json({
      success: true,
      events: result.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

app.get('/api/v1/events/featured', async (req, res) => {
  console.log('GET /api/v1/events/featured');
  try {
    const result = await pool.query(`
      SELECT e.*, o.name as organization_name
      FROM events e
      LEFT JOIN organizations o ON e.organization_id = o.id
      WHERE e.is_active = true
      ORDER BY e.event_date ASC
      LIMIT 6
    `);

    res.json({
      success: true,
      events: result.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured events'
    });
  }
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
  console.log(`🚀 Backend Server (PostgreSQL) running on http://localhost:${PORT}`);
  console.log(`📋 Admin endpoints available at http://localhost:${PORT}/api/v1/admin/*`);
  console.log(`🗄️ Database: advotecate_payments_dev`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});