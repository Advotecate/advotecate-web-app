# Advotecate Backend Development Guide

This guide will help you set up and run the Advotecate backend API in development mode.

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **PostgreSQL** >= 13 (or Supabase account)
- **FluidPay** API credentials (sandbox)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Set up database**
   ```bash
   # Option 1: Local PostgreSQL
   createdb advotecate_dev
   createdb advotecate_test

   # Option 2: Use Supabase (update .env with Supabase credentials)
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The API server will start on `http://localhost:3000` by default.

## 🛠️ Development Scripts

### Core Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run type-check   # Run TypeScript type checking
```

### Testing Scripts

```bash
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:unit    # Run unit tests only
npm run test:integration # Run integration tests only
```

### Database Scripts

```bash
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run db:reset     # Reset database (drop + recreate)
npm run db:backup    # Create database backup
```

### Code Quality Scripts

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run format       # Format code with Prettier
npm run format:check # Check if code is formatted
```

## 🏗️ Architecture Overview

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers and API endpoints
├── middleware/       # Express middleware (auth, logging, etc.)
├── routes/          # API route definitions
├── services/        # Business logic and external integrations
│   ├── business/    # Core business services
│   ├── database/    # Database access layer
│   └── fluidpay/    # Payment processing services
├── startup/         # Application initialization
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## 🎯 Key Services

### Database Service
- Supports both PostgreSQL and Supabase
- Connection pooling and health monitoring
- Repository pattern for data access

### FluidPay Integration
- Complete payment processing suite
- FEC compliance and fraud detection
- Webhook handling for payment events

### Business Services
- **UserService**: Authentication and user management
- **OrganizationService**: Organization and member management
- **FundraiserService**: Campaign management and donation processing

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run specific test file
npm run test userService.test.ts
```

### Test Structure

```
tests/
├── setup.ts              # Global test configuration
├── globalSetup.ts         # Jest global setup
├── globalTeardown.ts      # Jest global teardown
├── services/              # Service layer tests
├── controllers/           # API endpoint tests
├── integration/           # Integration tests
└── utils/                 # Test utilities and fixtures
```

### Writing Tests

Tests use Jest with TypeScript support. Example:

```typescript
describe('UserService', () => {
  let userService: UserService;

  beforeAll(() => {
    userService = new UserService(mockRepository);
  });

  it('should register a user successfully', async () => {
    const result = await userService.registerUser(validUserData);
    expect(result.success).toBe(true);
  });
});
```

## 🔧 Configuration

### Environment Variables

All configuration is managed through environment variables. See `.env.example` for all available options:

- **Database**: `DATABASE_URL`, `SUPABASE_URL`, etc.
- **FluidPay**: `FLUIDPAY_API_KEY`, `FLUIDPAY_API_SECRET`, etc.
- **Authentication**: `JWT_SECRET`, `JWT_EXPIRES_IN`, etc.
- **Email**: `SENDGRID_API_KEY`, etc.
- **File Storage**: `AWS_ACCESS_KEY_ID`, etc.

### FluidPay Setup

1. Get sandbox credentials from FluidPay
2. Add to your `.env`:
   ```
   FLUIDPAY_API_KEY=your-sandbox-api-key
   FLUIDPAY_API_SECRET=your-sandbox-api-secret
   FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
   ```

### Database Setup

#### Option 1: Local PostgreSQL
```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql

# Create databases
createdb advotecate_dev
createdb advotecate_test

# Update .env
DATABASE_URL=postgresql://username:password@localhost:5432/advotecate_dev
```

#### Option 2: Supabase
```bash
# Create project at https://supabase.com
# Update .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
DB_TYPE=supabase
```

## 📡 API Documentation

### Base URL
```
Development: http://localhost:3000/api/v1
Production: https://api.advotecate.com/api/v1
```

### Authentication
Most endpoints require JWT authentication:

```bash
Authorization: Bearer <token>
```

### Core Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user

#### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `GET /users/organizations` - Get user organizations

#### Organizations
- `POST /organizations` - Create organization
- `GET /organizations/:id` - Get organization details
- `GET /organizations/:id/fundraisers` - Get organization fundraisers
- `GET /organizations/:id/members` - Get organization members

#### Fundraisers
- `POST /fundraisers` - Create fundraiser
- `GET /fundraisers/active` - Get active fundraisers (public)
- `GET /fundraisers/:slug` - Get fundraiser by slug (public)
- `GET /fundraisers/:slug/stats` - Get fundraiser statistics (public)

#### Donations
- `POST /donations` - Process donation
- `GET /donations` - Get donations (filtered)
- `GET /donations/:id` - Get donation details

#### Webhooks
- `POST /webhooks/fluidpay` - FluidPay webhook endpoint

### Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    // Pagination info (for paginated responses)
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🚨 Health Monitoring

### Health Check Endpoint
```bash
GET /health
```

Returns system status:

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

### Logging

Structured logging with different levels:
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug information (development only)

## 🔐 Security

### Best Practices Implemented

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **JWT Authentication**: Secure token-based auth
- **SQL Injection Prevention**: Parameterized queries
- **Webhook Signature Verification**: Verify external webhooks

### Development Security

- Never commit secrets to git
- Use `.env` files for local development
- Rotate API keys regularly
- Use sandbox/test credentials for development

## 🐛 Debugging

### Logging
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable specific debug namespaces
DEBUG=advotecate:* npm run dev
```

### Database Debugging
```bash
# Enable database query logging
DATABASE_LOGGING=true npm run dev
```

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in .env
   PORT=3001
   ```

2. **Database connection failed**
   - Check PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Check firewall/network settings

3. **FluidPay API errors**
   - Verify API credentials
   - Check sandbox vs production URLs
   - Review FluidPay documentation

## 📝 Contributing

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Write tests for new features
- Document public APIs

### Git Workflow
1. Create feature branch
2. Make changes with tests
3. Run linting and tests
4. Submit pull request
5. Code review and merge

### Commit Messages
Use conventional commits:
```
feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
test: add user service tests
```

## 📚 Additional Resources

- [FluidPay API Documentation](https://docs.fluidpay.com)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [Jest Testing Documentation](https://jestjs.io/docs/)

## 🆘 Getting Help

- Check this documentation first
- Review error logs in console
- Check the GitHub issues
- Contact the development team

---

Happy coding! 🚀