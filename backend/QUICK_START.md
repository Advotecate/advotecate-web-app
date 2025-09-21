# 🚀 Quick Start - Testing & Deployment

Complete setup guide to get Advotecate backend running locally and deployed to production.

## ⚡ Local Development Setup

### 1. Prerequisites
```bash
# Required software
node --version  # v18.0.0+
npm --version   # v9.0.0+
docker --version  # v20.0.0+ (optional)
git --version
```

### 2. Installation
```bash
# Clone repository
git clone <your-repo-url>
cd advotecate/backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your actual values
```

### 3. Database Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql

# Create databases
createdb advotecate_dev
createdb advotecate_test

# Update .env
DATABASE_URL=postgresql://username:password@localhost:5432/advotecate_dev
DB_TYPE=postgres
```

#### Option B: Supabase (Recommended)
```bash
# 1. Create account at https://supabase.com
# 2. Create new project
# 3. Get credentials from Settings > API
# 4. Update .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
DB_TYPE=supabase
```

#### Option C: Docker (Complete Setup)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### 4. FluidPay Setup
```bash
# Get sandbox credentials from FluidPay
# Add to .env
FLUIDPAY_API_KEY=test_pk_your_key
FLUIDPAY_API_SECRET=test_sk_your_secret
FLUIDPAY_WEBHOOK_SECRET=whsec_your_secret
```

### 5. Start Development Server
```bash
npm run dev
```

Server starts at `http://localhost:3000`

## 🧪 Testing

### Quick Test Commands
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:unit        # Fast unit tests
npm run test:integration # Database integration tests
npm run test:e2e        # End-to-end API tests
npm run test:fluidpay   # FluidPay service tests

# Watch mode for development
npm run test:watch
```

### Test Environment Setup
```bash
# Create test database
createdb advotecate_test

# Set test environment variables
export NODE_ENV=test
export TEST_DATABASE_URL=postgresql://username:password@localhost:5432/advotecate_test
export FLUIDPAY_API_KEY=test_pk_test_key
```

### Running Specific Tests
```bash
# Test specific service
npm test -- userService

# Test with debugging
npm run test:debug

# Test with verbose output
npm test -- --verbose

# Test specific file
npm test -- tests/services/userService.test.ts
```

## 🚀 Deployment Options

### Option 1: Vercel (Recommended for MVP)

#### Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
npm run deploy:vercel
```

#### Environment Variables (Vercel Dashboard)
```
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
FLUIDPAY_API_KEY=your-production-key
FLUIDPAY_API_SECRET=your-production-secret
JWT_SECRET=your-super-secure-jwt-secret
```

### Option 2: Docker Deployment

#### Build and Run
```bash
# Build Docker image
npm run build:docker

# Run container
npm run deploy:docker

# Or manually
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=your-db-url \
  advotecate-backend
```

#### Docker Compose Production
```bash
# Production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway new
railway up
```

### Option 4: Render

1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on git push

## ✅ Health Checks

### Local Health Check
```bash
# Check if server is running
npm run health

# Or manually
curl http://localhost:3000/health
```

### Production Health Check
```bash
curl https://your-domain.com/health
```

Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "fluidpay": "healthy"
  },
  "version": "1.0.0"
}
```

## 🔧 Common Issues & Solutions

### Database Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check Supabase connection
curl -H "apikey: your-anon-key" https://your-project.supabase.co/rest/v1/

# Reset database
npm run db:reset
```

### FluidPay API Issues
```bash
# Test FluidPay connection
curl -H "X-FP-API-Key: your-key" https://sandbox-api.fluidpay.com/v1/health

# Check webhook endpoint
ngrok http 3000  # For local webhook testing
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

### Memory Issues
```bash
# Check memory usage
docker stats

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## 📊 Monitoring & Debugging

### Logs
```bash
# Development logs
npm run dev  # Watch logs in terminal

# Production logs
docker logs advotecate-backend -f

# Specific log levels
LOG_LEVEL=debug npm run dev
```

### Debugging
```bash
# Debug with inspector
npm run dev:debug

# Then connect Chrome DevTools to localhost:9229
```

### Performance Monitoring
```bash
# Check memory usage
curl http://localhost:3000/health

# Monitor requests
# Logs automatically include request timing
```

## 🔐 Security Checklist

### Development
- [ ] Never commit secrets to git
- [ ] Use `.env` files for configuration
- [ ] Use sandbox/test API keys
- [ ] Enable CORS only for development domains

### Production
- [ ] Use HTTPS everywhere
- [ ] Set strong JWT secrets (64+ characters)
- [ ] Enable rate limiting
- [ ] Use production database with SSL
- [ ] Set up monitoring and alerts
- [ ] Regular security updates

## 📈 Performance Tips

### Development
```bash
# Enable hot reload
npm run dev

# Use Docker for consistent environment
docker-compose up
```

### Production
```bash
# Build optimized version
npm run build

# Enable gzip compression (handled by framework)
# Enable Redis caching (if configured)
# Use connection pooling (handled by database service)
```

## 🚨 Emergency Procedures

### Rollback Deployment
```bash
# Vercel rollback
vercel --prod rollback

# Docker rollback
docker run previous-image-tag

# Database rollback (if needed)
npm run db:backup  # Create backup first
psql $DATABASE_URL < backup.sql
```

### Scale Up (Quick)
```bash
# Vercel: Automatic scaling
# Docker: Increase container count
docker-compose up --scale app=3

# Check load balancing
curl http://localhost/health
```

## 📞 Getting Help

1. **Check logs first**: `npm run dev` or `docker logs`
2. **Review documentation**: DEVELOPMENT.md, TESTING.md, DEPLOYMENT.md
3. **Test locally**: `npm test` and `npm run health`
4. **Check environment**: Verify all environment variables
5. **Community support**: GitHub issues or development team

## 🎯 Next Steps

After successful setup:

1. **API Testing**: Use Postman or curl to test endpoints
2. **Frontend Integration**: Connect your frontend to the API
3. **Production Deployment**: Deploy to your chosen platform
4. **Monitoring Setup**: Configure monitoring and alerts
5. **Custom Domain**: Set up your custom domain
6. **SSL Certificate**: Ensure HTTPS is enabled
7. **Backup Strategy**: Set up automated backups

---

**Ready to go!** 🚀

Your FluidPay-integrated political donation platform backend is now ready for development and deployment.