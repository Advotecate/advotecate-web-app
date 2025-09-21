#!/bin/bash
set -e

echo "🚀 Deploying Advotecate MVP to Vercel..."
echo "=========================================="

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy backend
echo ""
echo "🔧 Deploying Backend..."
cd backend

# Create vercel.json for backend
cat > vercel.json << 'EOF'
{
  "version": 2,
  "name": "advotecate-backend-mvp",
  "builds": [{ "src": "simple-server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/simple-server.js" }],
  "env": { "NODE_ENV": "production" }
}
EOF

echo "Deploying backend to Vercel..."
BACKEND_URL=$(vercel --prod --yes 2>/dev/null | tail -1)
echo "✅ Backend deployed to: $BACKEND_URL"

# Deploy frontend
echo ""
echo "🎨 Deploying Frontend..."
cd ../frontend

# Update environment variables
echo "NEXT_PUBLIC_API_URL=${BACKEND_URL}/api" > .env.local
echo "NEXT_PUBLIC_ENVIRONMENT=production" >> .env.local
echo "NEXT_PUBLIC_FLUIDPAY_ENVIRONMENT=sandbox" >> .env.local
echo "NEXT_PUBLIC_FLUIDPAY_DOMAIN=advotecate2026" >> .env.local

# Update vercel.json with correct backend URL
sed -i.bak "s|https://advotecate-api-367966088269.us-central1.run.app/api|${BACKEND_URL}/api|g" vercel.json

echo "Deploying frontend to Vercel..."
FRONTEND_URL=$(vercel --prod --yes 2>/dev/null | tail -1)
echo "✅ Frontend deployed to: $FRONTEND_URL"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""
echo "🧪 Test your app:"
echo "1. Visit: $FRONTEND_URL"
echo "2. Click 'Demo Donation'"
echo "3. Fill out the form with test data"
echo ""
echo "💳 Test card: 4242424242424242, 12/25, 123"