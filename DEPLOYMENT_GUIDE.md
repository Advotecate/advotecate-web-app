# 🚀 Advotecate Deployment Guide

Complete guide for deploying the Advotecate platform with backend on Google Cloud Platform (GCP) and frontend on Vercel.

## 📋 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│     Vercel      │    │     KrakenD      │    │   GCP (Backend)     │
│   (Frontend)    │───▶│   API Gateway    │───▶│  - Node.js API      │
│   React/Next.js │    │   Load Balancer  │    │  - Supabase DB      │
└─────────────────┘    └──────────────────┘    │  - FluidPay         │
                                │               └─────────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Google Cloud    │
                       │  - GKE Cluster   │
                       │  - Cloud SQL     │
                       │  - Monitoring    │
                       └──────────────────┘
```

## 🛠️ Prerequisites

### Required Tools
- **Google Cloud SDK** (`gcloud`) - [Install](https://cloud.google.com/sdk/docs/install)
- **Terraform** >= 1.5 - [Install](https://terraform.io/downloads)
- **kubectl** - [Install](https://kubernetes.io/docs/tasks/tools/)
- **Docker** - [Install](https://docs.docker.com/get-docker/)
- **Vercel CLI** - `npm install -g vercel`
- **Node.js** >= 18 - [Install](https://nodejs.org/)

### Required Accounts
- **Google Cloud Platform** account with billing enabled
- **Vercel** account
- **FluidPay** account (production & sandbox)
- **GitHub** account (for CI/CD)

## 🏗️ Phase 1: Infrastructure Setup (Supabase on GCP)

### 1.1 Deploy Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure/gcp-supabase

# Configure your variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your GCP project details

# Deploy infrastructure
./scripts/deploy.sh -p YOUR_GCP_PROJECT_ID -d yourdomain.com
```

### 1.2 Verify Infrastructure

```bash
# Check GKE cluster
kubectl get nodes

# Check Supabase services
kubectl get pods -n supabase

# Check KrakenD gateway
kubectl get pods -n krakend

# Test health endpoints
curl https://api.yourdomain.com/health
```

### 1.3 Configure DNS

Point these DNS A records to your LoadBalancer IP:
- `api.yourdomain.com`
- `supabase.yourdomain.com`
- `monitoring.yourdomain.com`

## 🔧 Phase 2: Backend Deployment (Node.js API)

### 2.1 Prepare Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Build the application
npm run build

# Run tests
npm test
```

### 2.2 Deploy Backend to GCP

```bash
# Deploy using the script
./scripts/deploy-gcp.sh -p YOUR_GCP_PROJECT_ID

# Or manually:
# 1. Build Docker image
docker build -f Dockerfile.prod -t gcr.io/YOUR_PROJECT_ID/advotecate-backend:latest .

# 2. Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/advotecate-backend:latest

# 3. Deploy to Kubernetes
kubectl apply -f gcp-deploy.yaml
```

### 2.3 Configure Secrets

```bash
# Create Kubernetes secrets
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_URL="your-database-url" \
  --from-literal=SUPABASE_URL="https://api.yourdomain.com" \
  --from-literal=SUPABASE_SERVICE_KEY="your-service-key" \
  --from-literal=FLUIDPAY_API_KEY="your-api-key" \
  --from-literal=FLUIDPAY_API_SECRET="your-api-secret" \
  --from-literal=FLUIDPAY_WEBHOOK_SECRET="your-webhook-secret" \
  --from-literal=JWT_SECRET="your-jwt-secret-64-chars-minimum" \
  -n default
```

## 🌐 Phase 3: Frontend Deployment (Vercel)

### 3.1 Prepare Frontend

```bash
# Create frontend if it doesn't exist
mkdir -p frontend

# The deployment script will create a basic structure if needed
./scripts/deploy-vercel.sh --help
```

### 3.2 Deploy Frontend to Vercel

```bash
# Deploy using the script
./scripts/deploy-vercel.sh -a https://api.yourdomain.com

# Or manually:
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy
vercel --prod
```

### 3.3 Configure Environment Variables

Set these in Vercel dashboard or via CLI:

```bash
# Required environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.yourdomain.com

vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://api.yourdomain.com

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter: your-supabase-anon-key

vercel env add NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY production
# Enter: your-fluidpay-public-key
```

## 🔒 Phase 4: Security & Environment Configuration

### 4.1 Production Environment

Copy and configure production environment:

```bash
cp .env.production .env.prod
# Edit .env.prod with your actual production values
```

**Critical Security Settings:**
- Use strong JWT secrets (64+ characters)
- Enable HTTPS everywhere
- Set proper CORS origins
- Use production API keys (not sandbox)
- Enable rate limiting

### 4.2 Staging Environment

```bash
cp .env.staging .env.staging
# Edit with staging values
```

**Staging Settings:**
- Use sandbox/test API keys
- Enable debug logging
- Use separate databases
- More lenient rate limiting for testing

## 🚀 Phase 5: CI/CD Pipeline Setup

### 5.1 GitHub Secrets Configuration

Add these secrets to your GitHub repository:

**GCP Secrets:**
- `GCP_PROJECT_ID_PRODUCTION`
- `GCP_PROJECT_ID_STAGING`
- `GCP_SA_KEY` (Service Account JSON)

**Vercel Secrets:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

**Application Secrets:**
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY`
- `FLUIDPAY_API_KEY`
- `FLUIDPAY_API_SECRET`
- `FLUIDPAY_WEBHOOK_SECRET`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY`

**Optional Secrets:**
- `SLACK_WEBHOOK_URL`
- `SNYK_TOKEN`
- `WEBPAGETEST_API_KEY`

### 5.2 Pipeline Triggers

**Backend Pipeline** (`.github/workflows/deploy-backend.yml`):
- Triggers on: `push` to `main`/`staging` branches (backend changes)
- Runs tests, builds Docker image, deploys to GKE
- Automatic rollback on failure

**Frontend Pipeline** (`.github/workflows/deploy-frontend.yml`):
- Triggers on: `push` to `main`/`staging` branches (frontend changes)
- Builds and deploys to Vercel
- Runs performance and security tests

## 📊 Phase 6: Monitoring & Observability

### 6.1 Access Monitoring

- **Grafana Dashboard**: `https://monitoring.yourdomain.com`
  - Username: `admin`
  - Password: `admin123` (change immediately)

### 6.2 Key Metrics to Monitor

**Application Metrics:**
- API response times (< 200ms target)
- Error rates (< 1% target)
- Database connections
- Memory and CPU usage

**Business Metrics:**
- Donation transaction success rate
- User registration/login rates
- FluidPay webhook processing

### 6.3 Alerts Configuration

Critical alerts are pre-configured for:
- Service downtime (>1 minute)
- High error rates (>5%)
- Database connection issues
- Memory/CPU usage (>80%)

## 🧪 Phase 7: Testing & Validation

### 7.1 Backend Testing

```bash
# Health check
curl https://api.yourdomain.com/health

# Authentication test
curl -X POST https://api.yourdomain.com/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Donation API test
curl -X POST https://api.yourdomain.com/v1/donations \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50.00, "donor_email": "donor@example.com"}'
```

### 7.2 Frontend Testing

```bash
# Homepage
curl https://yourapp.vercel.app/

# API proxy test
curl https://yourapp.vercel.app/api/health
```

### 7.3 End-to-End Testing

1. **User Registration Flow**
   - Visit frontend
   - Create account
   - Verify email
   - Login

2. **Donation Flow**
   - Select amount
   - Enter payment details
   - Process payment
   - Verify transaction

3. **Webhook Testing**
   - Trigger FluidPay webhook
   - Verify processing
   - Check database updates

## 🚨 Phase 8: Production Readiness Checklist

### 8.1 Security Checklist

- [ ] HTTPS enabled everywhere
- [ ] Strong JWT secrets configured
- [ ] Production API keys in use
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Database connections encrypted
- [ ] Secrets properly managed
- [ ] Regular security updates scheduled

### 8.2 Performance Checklist

- [ ] CDN configured (Vercel automatic)
- [ ] Database queries optimized
- [ ] API response times < 200ms
- [ ] Frontend bundle size < 500KB
- [ ] Image optimization enabled
- [ ] Caching strategies implemented

### 8.3 Monitoring Checklist

- [ ] Health checks configured
- [ ] Error tracking set up
- [ ] Performance monitoring active
- [ ] Alert notifications configured
- [ ] Log aggregation working
- [ ] Backup verification scheduled

### 8.4 Business Continuity

- [ ] Database backups automated
- [ ] Disaster recovery tested
- [ ] Rollback procedures documented
- [ ] Incident response plan created
- [ ] Support contact information updated

## 🔄 Phase 9: Operational Procedures

### 9.1 Deployment Process

**Production Deployment:**
1. Merge to `main` branch triggers automatic deployment
2. Tests run automatically
3. Backend deploys to GCP
4. Frontend deploys to Vercel
5. Monitoring alerts verify health

**Manual Deployment:**
```bash
# Backend
cd backend
./scripts/deploy-gcp.sh -p YOUR_PROJECT_ID

# Frontend
cd ..
./scripts/deploy-vercel.sh -e production
```

### 9.2 Rollback Procedures

**Backend Rollback:**
```bash
kubectl rollout undo deployment/advotecate-backend -n default
kubectl rollout status deployment/advotecate-backend -n default
```

**Frontend Rollback:**
```bash
vercel rollback [deployment-url]
```

### 9.3 Scaling Procedures

**Backend Scaling:**
```bash
# Manual scaling
kubectl scale deployment advotecate-backend --replicas=5 -n default

# Auto-scaling is configured via HorizontalPodAutoscaler
kubectl get hpa -n default
```

**Database Scaling:**
```bash
# Update Cloud SQL instance size in terraform.tfvars
cloudsql_tier = "db-custom-8-32768"  # 8 vCPU, 32GB RAM

# Apply changes
cd infrastructure/gcp-supabase
terraform apply
```

## 🆘 Troubleshooting Guide

### Common Issues

**Backend Not Starting:**
```bash
# Check pod status
kubectl get pods -l app=advotecate-backend -n default

# Check logs
kubectl logs -f deployment/advotecate-backend -n default

# Check secrets
kubectl get secret backend-secrets -n default -o yaml
```

**Frontend Build Issues:**
```bash
# Check Vercel build logs
vercel logs [deployment-url]

# Test build locally
cd frontend
npm run build
```

**Database Connection Issues:**
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h DATABASE_IP -U postgres

# Check Cloud SQL status
gcloud sql instances describe INSTANCE_NAME
```

**SSL Certificate Issues:**
```bash
# Check certificate status
kubectl describe managedcertificate -A

# Force certificate renewal
kubectl delete managedcertificate CERT_NAME -n NAMESPACE
kubectl apply -f k8s/security.yaml
```

### Emergency Contacts

1. **Check monitoring**: `https://monitoring.yourdomain.com`
2. **Review logs**: Check Grafana and kubectl logs
3. **Scale up resources**: If needed for high traffic
4. **Contact GCP support**: For infrastructure issues
5. **Contact Vercel support**: For frontend issues

## 📈 Performance Optimization

### Backend Optimization

1. **Database Query Optimization**
   - Use indexes effectively
   - Implement connection pooling
   - Monitor slow queries

2. **API Performance**
   - Enable response caching
   - Implement rate limiting
   - Use compression

3. **Resource Optimization**
   - Monitor memory usage
   - Configure appropriate CPU limits
   - Use horizontal pod autoscaling

### Frontend Optimization

1. **Bundle Optimization**
   - Code splitting
   - Tree shaking
   - Lazy loading

2. **Asset Optimization**
   - Image optimization
   - Font optimization
   - CSS minification

3. **Caching Strategies**
   - Static asset caching
   - API response caching
   - Service worker implementation

## 💰 Cost Optimization

### Current Cost Breakdown

**GCP (Monthly estimates):**
- GKE Cluster: $150-300
- Cloud SQL: $200-400
- Load Balancer: $20
- Monitoring: $50
- **Total GCP**: ~$420-770/month

**Vercel:**
- Pro Plan: $20/month (team)
- Bandwidth: Variable
- **Total Vercel**: ~$20-100/month

**Total Infrastructure**: ~$440-870/month

### Cost Reduction Strategies

1. **Development Environment**
   - Use preemptible instances
   - Scale down during off-hours
   - Use smaller machine types

2. **Monitoring**
   - Right-size resources based on usage
   - Implement resource quotas
   - Use spot instances for non-critical workloads

3. **Storage**
   - Set up lifecycle policies
   - Compress and archive old logs
   - Use appropriate storage classes

## 📚 Additional Resources

### Documentation
- [Google Kubernetes Engine Docs](https://cloud.google.com/kubernetes-engine/docs)
- [Vercel Deployment Docs](https://vercel.com/docs/deployments/overview)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [KrakenD Documentation](https://www.krakend.io/docs/)

### Support Channels
- **GCP Support**: [Google Cloud Console](https://console.cloud.google.com/support)
- **Vercel Support**: [Vercel Help](https://vercel.com/help)
- **Supabase Community**: [Discord](https://discord.supabase.com/)
- **FluidPay Support**: Check your account dashboard

---

## 🎉 Deployment Complete!

Your Advotecate platform is now deployed with:
- ✅ Backend API on Google Cloud Platform
- ✅ Frontend on Vercel
- ✅ Self-hosted Supabase with KrakenD Gateway
- ✅ CI/CD pipelines configured
- ✅ Monitoring and alerting active
- ✅ Security best practices implemented

**Next Steps:**
1. Test all functionality thoroughly
2. Configure custom domains
3. Set up monitoring alerts
4. Train your team on operational procedures
5. Plan for go-live activities

**URLs:**
- Frontend: `https://your-app.vercel.app`
- API: `https://api.yourdomain.com`
- Monitoring: `https://monitoring.yourdomain.com`

Good luck with your launch! 🚀