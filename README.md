# Advotecate Platform

Political donation and engagement platform with FEC compliance, built on Vercel + Supabase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.TEMPLATE .env
# Edit .env with your values

# Start development servers
npm run dev
```

Visit:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## 📚 Documentation

- **[Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)** - Complete deployment instructions
- **[API Documentation](./backend/README.md)** - Backend API reference
- **[Architecture](./ADVOTECATE-ARCHITECTURE.md)** - System architecture overview

## 🏗️ Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Payments**: FluidPay
- **Compliance**: FEC API integration

## 📦 Project Structure

```
advotecate-backend-api/
├── backend/           # Express API server
│   ├── src/          # TypeScript source
│   ├── dist/         # Compiled JavaScript
│   └── vercel.json   # Backend deployment config
├── frontend/          # React application
│   ├── src/          # React components
│   ├── dist/         # Production build
│   └── vercel.json   # Frontend deployment config
├── scripts/           # Utility scripts
│   ├── supabase-pull.sh        # Sync prod schema
│   ├── supabase-status.sh      # Check sync status
│   └── supabase-seed-from-prod.sh  # Seed local DB
└── .gcp-archive/     # Archived GCP infrastructure

```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase account
- Vercel account (for deployment)

### Local Development

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend   # Port 3001
npm run dev:frontend  # Port 3000

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Environment Variables

**Backend** (.env):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `JWT_ACCESS_SECRET` - Access token secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `FLUIDPAY_API_KEY` - FluidPay API key
- `FEC_API_KEY` - FEC API key

**Frontend** (.env):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Anonymous key
- `VITE_FLUIDPAY_ENVIRONMENT` - sandbox or production
- `VITE_FLUIDPAY_DOMAIN` - FluidPay domain

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete environment variable documentation.

## 🚢 Deployment

### Deploy to Vercel

```bash
# Deploy both apps to production
npm run deploy

# Or deploy individually
npm run deploy:backend
npm run deploy:frontend
```

Vercel automatically deploys:
- **Production**: Push to `main` branch
- **Preview**: Push to any branch or open PR

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed deployment instructions.

## 🗄️ Database Management

### Supabase Sync

```bash
# Pull production schema to local
npm run supabase:pull

# Check local vs production differences
npm run supabase:status

# Seed local database from production
npm run supabase:seed
```

### Local Supabase

```bash
# Start local Supabase instance
supabase start

# Stop local instance
supabase stop

# Reset local database
supabase db reset
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend
```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both apps in development mode |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build both apps for production |
| `npm run deploy` | Deploy both apps to Vercel |
| `npm run test` | Run all tests |
| `npm run lint` | Run linter on all code |
| `npm run typecheck` | TypeScript type checking |
| `npm run supabase:pull` | Pull production database schema |
| `npm run supabase:status` | Check database sync status |

## 🔒 Security

- Row Level Security (RLS) enabled on all Supabase tables
- JWT-based authentication
- CORS configured for allowed origins only
- Rate limiting on all API endpoints
- Helmet.js security headers
- FEC compliance validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)
- [API Documentation](./backend/README.md)
- [GitHub Issues](https://github.com/Advotecate/advotecate-backend-api/issues)

---

**Built with ❤️ by the Advotecate Team**
