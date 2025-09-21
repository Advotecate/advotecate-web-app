// Simple Express server for MVP deployment
const express = require('express');
const cors = require('cors');

const app = express();
const port = parseInt(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0-mvp',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Basic API routes for MVP
app.get('/api/status', (req, res) => {
    res.json({
        message: 'Advotecate API MVP is running',
        fluidpay: {
            domain: process.env.FLUIDPAY_DOMAIN || 'advotecate2026',
            sandbox: true,
            status: 'configured'
        },
        endpoints: [
            'GET /health',
            'GET /api/status',
            'POST /api/donations (placeholder)',
            'GET /api/fundraisers (placeholder)'
        ]
    });
});

// Placeholder donation endpoint
app.post('/api/donations', (req, res) => {
    res.json({
        message: 'Donation endpoint (MVP placeholder)',
        received_data: {
            amount: req.body.amount,
            donor_email: req.body.donor_email
        },
        note: 'This is a placeholder endpoint for MVP testing. FluidPay integration will be connected in next iteration.'
    });
});

// Placeholder fundraisers endpoint
app.get('/api/fundraisers', (req, res) => {
    res.json({
        message: 'Fundraisers endpoint (MVP placeholder)',
        data: [
            {
                id: 1,
                title: 'Sample Campaign',
                description: 'This is a sample fundraising campaign for MVP testing',
                goal: 10000,
                raised: 2500,
                status: 'active'
            }
        ],
        note: 'This is sample data for MVP testing'
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Advotecate MVP API running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📈 API status: http://localhost:${port}/api/status`);
    console.log(`💰 FluidPay domain: ${process.env.FLUIDPAY_DOMAIN || 'advotecate2026'}`);
});