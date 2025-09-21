# Deployment Guide - Advotecate Backend

Complete deployment strategy for the FluidPay-integrated political donation platform.

## 🚀 Deployment Options

### Quick Deployment Options
1. **Vercel** (Recommended for MVP) - Zero config, automatic scaling
2. **Railway** - Simple deployment with database included
3. **Render** - Free tier available, easy PostgreSQL integration
4. **AWS ECS/Fargate** - Production-grade, full control
5. **Google Cloud Run** - Serverless containers
6. **DigitalOcean App Platform** - Simple and cost-effective

## 🎯 Vercel Deployment (Recommended)

### Prerequisites
- Vercel account
- GitHub repository
- Supabase account (for database)
- FluidPay API credentials

### 1. Database Setup (Supabase)
```bash
# 1. Create Supabase project at https://supabase.com
# 2. Get your credentials:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 2. Vercel Configuration
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["src/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "/src/server.ts"
    },
    {
      "src": "/api/(.*)",
      "dest": "/src/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/server.ts": {
      "maxDuration": 30
    }
  }
}
```

### 3. Environment Variables
Set in Vercel dashboard or CLI:
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
DB_TYPE=supabase

# FluidPay
FLUIDPAY_API_KEY=your-production-api-key
FLUIDPAY_API_SECRET=your-production-api-secret
FLUIDPAY_WEBHOOK_SECRET=your-webhook-secret
FLUIDPAY_PRODUCTION_URL=https://api.fluidpay.com/v1

# Application
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# External Services
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

### 4. Deploy Commands
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add SUPABASE_URL production
vercel env add FLUIDPAY_API_KEY production
# ... add all environment variables
```

### 5. Custom Domain Setup
```bash
# Add custom domain
vercel domains add api.yourdomain.com

# Configure DNS
# Add CNAME record: api.yourdomain.com -> cname.vercel-dns.com
```

## 🐋 Docker Deployment

### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S advotecate -u 1001

# Change ownership
CHOWN advotecate:nodejs /app
USER advotecate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

### Docker Compose (Development)
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/advotecate
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src
    command: npm run dev

  postgres:
    image: postgres:13-alpine
    environment:
      - POSTGRES_DB=advotecate
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Build and Deploy
```bash
# Build image
docker build -t advotecate-backend .

# Run container
docker run -p 3000:3000 -e NODE_ENV=production advotecate-backend

# Deploy to container registry
docker tag advotecate-backend your-registry/advotecate-backend
docker push your-registry/advotecate-backend
```

## ☁️ AWS Deployment

### AWS ECS with Fargate

#### 1. Task Definition
```json
{
  "family": "advotecate-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "advotecate-backend",
      "image": "your-ecr-repo/advotecate-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:region:account:parameter/advotecate/database-url"
        },
        {
          "name": "FLUIDPAY_API_KEY",
          "valueFrom": "arn:aws:ssm:region:account:parameter/advotecate/fluidpay-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/advotecate-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2. Service Configuration
```json
{
  "serviceName": "advotecate-backend",
  "cluster": "advotecate-cluster",
  "taskDefinition": "advotecate-backend:1",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-abcdef"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:region:account:targetgroup/advotecate-tg",
      "containerName": "advotecate-backend",
      "containerPort": 3000
    }
  ]
}
```

#### 3. Infrastructure as Code (CDK)
```typescript
// infrastructure/app.ts
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';

export class AdvotecateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'AdvotecateVPC', {
      maxAzs: 2,
      natGateways: 1
    });

    // RDS Database
    const database = new rds.DatabaseInstance(this, 'AdvotecateDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13_7
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      databaseName: 'advotecate',
      credentials: rds.Credentials.fromGeneratedSecret('postgres')
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'AdvotecateCluster', {
      vpc
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'AdvotecateTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512
    });

    // Container
    const container = taskDefinition.addContainer('AdvotecateContainer', {
      image: ecs.ContainerImage.fromRegistry('your-repo/advotecate-backend'),
      environment: {
        NODE_ENV: 'production'
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(database.secret!, 'engine')
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'advotecate'
      })
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP
    });

    // Service
    const service = new ecs.FargateService(this, 'AdvotecateService', {
      cluster,
      taskDefinition,
      desiredCount: 2
    });

    // Load Balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'AdvotecateLB', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.forward([
        service.loadBalancerTarget({
          containerName: 'AdvotecateContainer',
          containerPort: 3000
        })
      ])
    });
  }
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions Deployment
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:ci
        env:
          NODE_ENV: test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: advotecate-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: task-definition.json
          service: advotecate-backend
          cluster: advotecate-cluster
          wait-for-service-stability: true
```

### Deployment Scripts
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Build application
echo "📦 Building application..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm run test:ci

# Build Docker image
echo "🐋 Building Docker image..."
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t advotecate-backend:$IMAGE_TAG .

# Push to registry
echo "📤 Pushing to registry..."
docker tag advotecate-backend:$IMAGE_TAG your-registry/advotecate-backend:$IMAGE_TAG
docker push your-registry/advotecate-backend:$IMAGE_TAG

# Deploy to production
echo "🎯 Deploying to production..."
kubectl set image deployment/advotecate-backend app=your-registry/advotecate-backend:$IMAGE_TAG

echo "✅ Deployment completed successfully!"
```

## 🔧 Environment-Specific Configurations

### Production Environment Variables
```bash
# Core Application
NODE_ENV=production
PORT=3000
API_VERSION=v1
LOG_LEVEL=info

# Database (Production)
DATABASE_URL=postgresql://username:password@prod-db.amazonaws.com:5432/advotecate
# OR for Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
DB_TYPE=supabase

# FluidPay (Production)
FLUIDPAY_API_KEY=live_pk_your_production_key
FLUIDPAY_API_SECRET=live_sk_your_production_secret
FLUIDPAY_WEBHOOK_SECRET=whsec_your_production_webhook_secret
FLUIDPAY_PRODUCTION_URL=https://api.fluidpay.com/v1

# Security
JWT_SECRET=your-extremely-secure-jwt-secret-64-characters-minimum
JWT_REFRESH_SECRET=your-extremely-secure-refresh-secret-64-characters
SESSION_SECRET=your-extremely-secure-session-secret-64-characters
ENCRYPTION_KEY=your-32-character-encryption-key

# Email (Production)
SENDGRID_API_KEY=SG.your_production_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# File Storage (Production)
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret
S3_BUCKET=yourdomain-prod-uploads
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
NEW_RELIC_LICENSE_KEY=your-new-relic-key

# Features
ENABLE_RATE_LIMITING=true
ENABLE_COMPRESSION=true
ENABLE_HELMET_SECURITY=true
ENABLE_MOCK_PAYMENTS=false
```

### Staging Environment
```bash
# Use staging/sandbox versions of all services
NODE_ENV=staging
FLUIDPAY_API_KEY=test_pk_staging_key
DATABASE_URL=postgresql://staging-db-url
SENTRY_DSN=https://staging-sentry-dsn
```

## 📊 Monitoring & Observability

### Health Check Endpoint
```typescript
// Enhanced health check for production
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    // Database health
    DatabaseService.getInstance().healthCheck(),

    // FluidPay API health
    FluidPayServiceFactory.getInstance().healthCheck(),

    // External services
    checkRedisConnection(),
    checkEmailService(),
    checkFileStorage()
  ]);

  const health = {
    status: checks.every(check => check.status === 'fulfilled' && check.value) ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    services: {
      database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      fluidpay: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      email: checks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      storage: checks[4].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Application Metrics
```typescript
// Prometheus metrics
import prometheus from 'prom-client';

const register = new prometheus.Registry();

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const donationTotal = new prometheus.Counter({
  name: 'donations_total',
  help: 'Total number of donations processed',
  labelNames: ['status', 'amount_range']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(donationTotal);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## 🔒 Security Considerations

### Production Security Checklist
- [ ] Use HTTPS everywhere (TLS 1.2+)
- [ ] Implement proper CORS policies
- [ ] Enable rate limiting
- [ ] Use security headers (Helmet.js)
- [ ] Validate all inputs
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable database SSL connections
- [ ] Implement request/response logging
- [ ] Use environment variables for secrets
- [ ] Enable webhook signature verification
- [ ] Implement proper error handling (no sensitive data exposure)
- [ ] Use least privilege principles for database access
- [ ] Enable audit logging
- [ ] Implement proper session management
- [ ] Use secure cookie settings

### Secrets Management
```bash
# AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/advotecate/prod/database-url" \
  --value "postgresql://..." \
  --type "SecureString"

# Kubernetes Secrets
kubectl create secret generic advotecate-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=fluidpay-api-key="live_pk_..."

# Docker Secrets
echo "postgresql://..." | docker secret create database-url -
```

## 📈 Scaling Considerations

### Horizontal Scaling
```yaml
# Kubernetes Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: advotecate-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: advotecate-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Database Scaling
- **Read Replicas**: For read-heavy operations
- **Connection Pooling**: PgBouncer or built-in pooling
- **Caching**: Redis for session storage and caching
- **Database Sharding**: For very large scales

### CDN and Caching
```nginx
# Nginx reverse proxy configuration
upstream advotecate_backend {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://advotecate_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://advotecate_backend;
        access_log off;
    }
}
```

## 🚨 Disaster Recovery

### Backup Strategy
```bash
# Database backups
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > "backups/advotecate_${DATE}.sql"
aws s3 cp "backups/advotecate_${DATE}.sql" "s3://advotecate-backups/"
```

### Rollback Procedures
```bash
# Rollback deployment
kubectl rollout undo deployment/advotecate-backend

# Database rollback
psql $DATABASE_URL < backups/advotecate_backup.sql
```

This comprehensive deployment guide covers everything from simple Vercel deployments to enterprise-grade AWS infrastructure, ensuring your FluidPay-integrated backend can scale from MVP to production with confidence.