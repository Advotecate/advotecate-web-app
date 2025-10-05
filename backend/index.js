// Vercel serverless entry point - minimal test first
import express from 'express';

const app = express();

// CORS headers for testing
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Test route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Advotecate API is running on Vercel',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/api/v1/organizations', (req, res) => {
  res.json({
    message: 'Organizations endpoint - WORKING!',
    note: 'Full API will be restored once this test succeeds'
  });
});

// Catch-all
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    note: 'If you see this, the serverless function IS working - just route not found'
  });
});

export default app;
