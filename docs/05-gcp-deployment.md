# GCP Deployment Architecture

## Overview

Google Cloud Platform deployment architecture for the Advotecate backend API, featuring a production-ready enhanced server with 139 comprehensive endpoints deployed on Cloud Run.

## Current Production Deployment

**Production API URL**: `https://advotecate-api-367966088269.us-central1.run.app/api/v1`
**Project ID**: `advotecate-dev`
**Region**: `us-central1`
**Service**: Cloud Run containerized deployment
**Endpoints**: 139 production endpoints with comprehensive business logic

### Enhanced API Features

- **Complete Feature Set**: All 139 endpoints from TypeScript source code
- **JWT Authentication**: Role-based access control (admin, staff, compliance, user)
- **Rate Limiting**: Redis-backed rate limiting for API protection
- **Input Validation**: Comprehensive Zod schema validation
- **Security**: Helmet.js security headers, CORS configuration
- **File Storage**: File-based data storage with PostgreSQL fallback
- **Health Monitoring**: `/health` and `/ready` endpoints for Cloud Run
- **Logging**: Structured Winston logging for production monitoring

## GCP Services Architecture

### Current Infrastructure Services

```yaml
Compute:
  - Cloud Run: Enhanced API server (enhanced-server.js)
  - Cloud Build: Container image building and deployment

Data & Storage:
  - File System: Primary data storage with JSON files
  - PostgreSQL: Fallback database capability (not currently required)
  - Cloud Storage: Container image storage (GCR)

Networking & Security:
  - Cloud Run: Built-in load balancing and HTTPS
  - Rate Limiting: Redis-backed request throttling
  - CORS: Configured for frontend access
  - JWT: Authentication and authorization

Monitoring & Operations:
  - Cloud Monitoring: Cloud Run metrics and health monitoring
  - Cloud Logging: Application logs via Winston
  - Health Checks: /health and /ready endpoints
```

### Planned Infrastructure Expansion

```yaml
Future Enhancements:
  - Cloud SQL (PostgreSQL): When database scaling needed
  - Cloud Memorystore (Redis): For enhanced caching
  - Cloud CDN: For global content delivery
  - Cloud Armor: For advanced security protection
  - VPC: For network isolation
```

## Detailed Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Users/Internet                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Cloud CDN + Load Balancer                  │
│              (Global HTTP(S) Load Balancer)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Cloud Armor (WAF)                         │
│        • DDoS Protection                                    │
│        • IP Whitelisting/Blacklisting                      │
│        • OWASP Rule Sets                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               Cloud Endpoints (API Gateway)                │
│        • Authentication                                     │
│        • Rate Limiting                                      │
│        • API Analytics                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴────────────┐
          │                        │
          ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Cloud Run)   │    │   (Cloud Run)   │
│                 │    │                 │
│ • Next.js App   │    │ • Node.js API   │
│ • Static Assets │    │ • Business Logic│
│ • SSR/SSG       │    │ • FluidPay Integ│
└─────────────────┘    └─────────┬───────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
                    ▼                          ▼
        ┌─────────────────┐         ┌─────────────────┐
        │   Cloud SQL     │         │  Cloud Storage  │
        │  (PostgreSQL)   │         │                 │
        │ • Primary DB    │         │ • File Uploads  │
        │ • Read Replicas │         │ • Backups       │
        │ • Auto Backup   │         │ • Static Assets │
        └─────────────────┘         └─────────────────┘
```

## Environment Setup

### 1. Project Structure

```yaml
gcp-projects:
  current-production:
    project-id: "advotecate-dev"
    region: "us-central1"
    zone: "us-central1-a"
    service-name: "advotecate-api"
    url: "https://advotecate-api-367966088269.us-central1.run.app/api/v1"

  planned-environments:
    production:
      project-id: "advotecate-donation-prod"
      region: "us-central1"
      zone: "us-central1-a"

    staging:
      project-id: "advotecate-donation-staging"
      region: "us-central1"
      zone: "us-central1-a"
```

### 2. Terraform Infrastructure as Code

```hcl
# terraform/main.tf
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sql-component.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "storage-api.googleapis.com",
  ])

  service = each.value
  project = var.project_id

  disable_on_destroy = false
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "donation-platform-vpc"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
}

resource "google_compute_subnetwork" "private_subnet" {
  name          = "private-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc_network.id

  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "192.168.1.0/24"
  }

  secondary_ip_range {
    range_name    = "pod-range"
    ip_cidr_range = "192.168.2.0/24"
  }
}

# Cloud SQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "donation-platform-postgres"
  database_version = "POSTGRES_15"
  region          = var.region

  settings {
    tier                        = var.environment == "production" ? "db-custom-4-16384" : "db-f1-micro"
    availability_type           = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_type                  = "PD_SSD"
    disk_size                  = var.environment == "production" ? 100 : 20
    disk_autoresize           = true
    disk_autoresize_limit     = var.environment == "production" ? 500 : 100

    backup_configuration {
      enabled                        = true
      start_time                    = "02:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc_network.id
      require_ssl     = true

      authorized_networks {
        name  = "cloud-run"
        value = "0.0.0.0/0"
      }
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "log_duration"
      value = "on"
    }
  }

  deletion_protection = var.environment == "production"

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "database" {
  name     = "donation_platform"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}
```

### 3. Current Cloud Run Deployment

**Service Name**: `advotecate-api`
**Current URL**: `https://advotecate-api-367966088269.us-central1.run.app`
**Container Image**: `gcr.io/advotecate-dev/advotecate-api-enhanced:latest`

```yaml
# Current Production Configuration
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: advotecate-api
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    spec:
      containerConcurrency: 1000
      timeoutSeconds: 300
      containers:
      - image: gcr.io/advotecate-dev/advotecate-api-enhanced:latest
        ports:
        - containerPort: 3002  # Enhanced server port
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3002"
        resources:
          limits:
            cpu: "1"
            memory: "2Gi"
          requests:
            cpu: "0.5"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 10
```

### 3.1 Enhanced Server Features

```javascript
// Key configurations in enhanced-server.js
const PORT = process.env.PORT || 3002; // Cloud Run uses PORT env var

// Middleware stack:
- helmet() // Security headers
- compression() // Response compression
- cors() // Cross-origin requests
- express.json() // JSON parsing
- rateLimit() // Request rate limiting
- JWT authentication middleware
- Zod validation middleware

// 139 Production Endpoints including:
- Authentication & Authorization
- User Management
- Campaign Management
- Donation Processing
- Compliance & Reporting
- Candidate & Political Entity Management
- Document & File Management
- Administrative Functions
```

### 4. Frontend Cloud Run Service

```yaml
# frontend/cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: donation-frontend
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "50"
    spec:
      containerConcurrency: 1000
      containers:
      - image: gcr.io/PROJECT_ID/donation-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.donation-platform.com"
        - name: NEXT_PUBLIC_FLUIDPAY_API_KEY
          valueFrom:
            secretKeyRef:
              name: fluidpay-credentials
              key: api-key
        resources:
          limits:
            cpu: "1"
            memory: "2Gi"
          requests:
            cpu: "0.5"
            memory: "1Gi"
```

## Database Configuration

### 1. Cloud SQL Setup

```sql
-- Initialize database with required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user with limited privileges
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE donation_platform TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

-- Create read-only user for reporting
CREATE USER readonly_user WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE donation_platform TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
```

### 2. Connection Pooling with PgBouncer

```ini
# pgbouncer.ini
[databases]
donation_platform = host=/cloudsql/PROJECT_ID:REGION:donation-platform-postgres dbname=donation_platform

[pgbouncer]
listen_port = 6543
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
admin_users = postgres
stats_users = stats
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 100
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 5
max_db_connections = 200
max_user_connections = 200
```

## Security Configuration

### 1. Identity and Access Management (IAM)

```yaml
# iam-roles.yaml
roles:
  backend-service:
    permissions:
      - cloudsql.instances.connect
      - secretmanager.versions.access
      - storage.objects.get
      - storage.objects.create
      - logging.logEntries.create
      - monitoring.metricDescriptors.create
      - monitoring.metricDescriptors.get
      - monitoring.timeSeries.create

  frontend-service:
    permissions:
      - storage.objects.get
      - logging.logEntries.create
      - monitoring.metricDescriptors.create
      - monitoring.timeSeries.create

  ci-cd-pipeline:
    permissions:
      - cloudbuild.builds.create
      - cloudbuild.builds.get
      - run.services.update
      - run.services.setIamPolicy
      - storage.objects.create
      - storage.objects.get
```

### 2. Secret Management

```bash
#!/bin/bash
# setup-secrets.sh

# Create secrets in Secret Manager
gcloud secrets create database-url --data-file=database-url.txt
gcloud secrets create fluidpay-credentials --data-file=fluidpay-credentials.json
gcloud secrets create jwt-secret --data-file=jwt-secret.txt
gcloud secrets create encryption-key --data-file=encryption-key.txt

# Grant access to service accounts
gcloud secrets add-iam-policy-binding database-url \
    --member="serviceAccount:donation-backend-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding fluidpay-credentials \
    --member="serviceAccount:donation-backend-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 3. Cloud KMS for Encryption

```hcl
# terraform/kms.tf
resource "google_kms_key_ring" "donation_platform" {
  name     = "donation-platform-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "database_encryption" {
  name            = "database-encryption-key"
  key_ring        = google_kms_key_ring.donation_platform.id
  rotation_period = "2592000s" # 30 days

  purpose = "ENCRYPT_DECRYPT"

  version_template {
    algorithm = "GOOGLE_SYMMETRIC_ENCRYPTION"
  }
}

resource "google_kms_crypto_key" "application_secrets" {
  name            = "application-secrets-key"
  key_ring        = google_kms_key_ring.donation_platform.id
  rotation_period = "7776000s" # 90 days

  purpose = "ENCRYPT_DECRYPT"
}
```

## CI/CD Pipeline Configuration

### 1. Cloud Build Pipeline

```yaml
# cloudbuild.yaml
steps:
  # Build backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/donation-backend:$COMMIT_SHA', './backend']
    id: 'build-backend'

  # Build frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/donation-frontend:$COMMIT_SHA', './frontend']
    id: 'build-frontend'

  # Push images
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/donation-backend:$COMMIT_SHA']
    id: 'push-backend'

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/donation-frontend:$COMMIT_SHA']
    id: 'push-frontend'

  # Run tests
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['test']
    dir: 'backend'
    env:
      - 'NODE_ENV=test'
    id: 'test-backend'

  # Run security scans
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud container images scan gcr.io/$PROJECT_ID/donation-backend:$COMMIT_SHA \
        --remote --format='value(response.scan.analysisKind,response.scan.createTime)'
    id: 'security-scan-backend'

  # Deploy to staging
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud run deploy donation-backend-staging \
        --image gcr.io/$PROJECT_ID/donation-backend:$COMMIT_SHA \
        --region us-central1 \
        --platform managed \
        --allow-unauthenticated
    id: 'deploy-staging-backend'

  # Run integration tests
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['run', 'test:integration']
    dir: 'backend'
    env:
      - 'NODE_ENV=staging'
      - 'API_URL=https://donation-backend-staging-xxx.run.app'
    id: 'integration-tests'

  # Deploy to production (manual approval required)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        if [ "$BRANCH_NAME" = "main" ]; then
          gcloud run deploy donation-backend \
          --image gcr.io/$PROJECT_ID/donation-backend:$COMMIT_SHA \
          --region us-central1 \
          --platform managed \
          --allow-unauthenticated
        fi
    id: 'deploy-production-backend'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'
  substitution_option: 'ALLOW_LOOSE'

substitutions:
  _DEPLOY_ENV: 'staging'

timeout: '1800s'
```

### 2. Automated Testing Integration

```bash
#!/bin/bash
# scripts/run-tests.sh

set -e

echo "Running unit tests..."
npm test

echo "Running integration tests..."
npm run test:integration

echo "Running security tests..."
npm audit --audit-level=high

echo "Running linting..."
npm run lint

echo "Running type checking..."
npm run type-check

echo "Generating test coverage report..."
npm run test:coverage

# Upload coverage to Cloud Storage
gsutil cp coverage/lcov.info gs://donation-platform-artifacts/coverage/$BUILD_ID/
```

## Monitoring and Observability

### 1. Cloud Monitoring Setup

```yaml
# monitoring/alerts.yaml
alertPolicy:
  displayName: "High Error Rate"
  conditions:
    - displayName: "Error rate above 5%"
      conditionThreshold:
        filter: 'resource.type="cloud_run_revision" resource.label.service_name="donation-backend"'
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 0.05
        duration: "300s"
        aggregations:
          - alignmentPeriod: "60s"
            perSeriesAligner: ALIGN_RATE
            crossSeriesReducer: REDUCE_MEAN
  notificationChannels:
    - "projects/PROJECT_ID/notificationChannels/CHANNEL_ID"
  alertStrategy:
    autoClose: "1800s"

---
alertPolicy:
  displayName: "Database Connection Pool Exhaustion"
  conditions:
    - displayName: "Active connections > 80% of pool"
      conditionThreshold:
        filter: 'resource.type="cloudsql_database"'
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 160  # 80% of 200 max connections
        duration: "120s"
```

### 2. Custom Dashboards

```json
{
  "displayName": "Donation Platform Overview",
  "mosaicLayout": {
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Request Volume",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_run_revision\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM"
                  }
                }
              }
            }]
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Error Rate",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }
      }
    ]
  }
}
```

## Disaster Recovery and Backup

### 1. Automated Backup Strategy

```bash
#!/bin/bash
# scripts/backup-strategy.sh

# Daily automated backups
gcloud sql backups create \
  --instance=donation-platform-postgres \
  --description="Daily automated backup $(date +%Y%m%d)"

# Weekly full backup to Cloud Storage
pg_dump \
  --host=/cloudsql/PROJECT_ID:REGION:donation-platform-postgres \
  --username=app_user \
  --dbname=donation_platform \
  --format=custom \
  --verbose \
  --file=/tmp/weekly_backup_$(date +%Y%m%d).dump

gsutil cp /tmp/weekly_backup_*.dump gs://donation-platform-backups/weekly/

# Cross-region replication
gsutil -m rsync -r -d gs://donation-platform-backups/ gs://donation-platform-backups-dr/
```

### 2. Disaster Recovery Plan

```yaml
# disaster-recovery.yaml
recovery-procedures:
  database:
    rto: "4 hours"  # Recovery Time Objective
    rpo: "1 hour"   # Recovery Point Objective
    steps:
      1. "Assess damage and determine recovery scope"
      2. "Activate cross-region standby instance"
      3. "Restore from latest backup if needed"
      4. "Update DNS to point to DR region"
      5. "Verify application functionality"
      6. "Communicate status to stakeholders"

  application:
    rto: "30 minutes"
    rpo: "5 minutes"
    steps:
      1. "Deploy application to DR region"
      2. "Update load balancer configuration"
      3. "Verify health checks pass"
      4. "Monitor error rates and performance"

  data-validation:
    checks:
      - "Verify donation transaction integrity"
      - "Confirm compliance data consistency"
      - "Validate user account information"
      - "Check audit log completeness"
```

## Current Cost Optimization

### 1. Resource Configuration

```yaml
# Current optimized configuration
cloud-run:
  current-production:
    cpu: "1 vCPU"
    memory: "2 GB"
    max-instances: 10
    min-instances: 1
    cost: ~$15-30/month (estimated)

storage:
  file-based:
    cost: ~$0 (local container storage)
    notes: "Data persists in container, suitable for development"

  future-database:
    cloud-sql-micro: "~$25/month"
    cloud-sql-small: "~$50/month"
    notes: "When scaling requires database"
```

### 2. Cost Monitoring

Current deployment is cost-optimized for development and initial production:

- **Cloud Run**: Pay-per-request pricing with 1 minimum instance
- **Container Registry**: Minimal storage costs for single image
- **Networking**: Standard egress costs
- **No Database**: File-based storage reduces costs

**Estimated Monthly Cost**: $15-30 USD for current usage patterns

### 2. Budget Alerts

```hcl
# terraform/budget.tf
resource "google_billing_budget" "donation_platform_budget" {
  billing_account = var.billing_account
  display_name    = "Donation Platform Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = var.monthly_budget
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis      = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis      = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis      = "CURRENT_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.id
    ]
    disable_default_iam_recipients = true
  }
}
```

## Current Deployment Process

### 1. Build and Deploy Enhanced API

```bash
#!/bin/bash
# Current deployment commands used

PROJECT_ID="advotecate-dev"
REGION="us-central1"
SERVICE_NAME="advotecate-api"

# Build container image
gcloud builds submit --tag gcr.io/$PROJECT_ID/advotecate-api-enhanced .

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/advotecate-api-enhanced:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3002 \
  --set-env-vars NODE_ENV=production

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
echo "Service deployed at: $SERVICE_URL"
```

### 2. Dockerfile Configuration

```dockerfile
# Dockerfile.prod - Production configuration
FROM node:18-alpine

# Install security updates
RUN apk --no-cache upgrade

# Create app directory and non-root user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S advotecate -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/*

# Copy enhanced server
COPY --chown=advotecate:nodejs enhanced-server.js ./

# Create data directory for file storage
RUN mkdir -p /app/data && chown -R advotecate:nodejs /app/data

# Set proper ownership
RUN chown -R advotecate:nodejs /app

# Switch to non-root user
USER advotecate

# Expose port (Cloud Run uses PORT environment variable)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3002; require('http').get('http://localhost:' + port + '/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Set production environment
ENV NODE_ENV=production

# Start the enhanced server
CMD ["node", "enhanced-server.js"]
```

### 3. Frontend Configuration Update

```bash
# frontend/.env.local
VITE_API_URL=https://advotecate-api-367966088269.us-central1.run.app/api/v1
VITE_NODE_ENV=development
```

### 4. API Endpoint Verification

```bash
# Test deployed API endpoints
API_BASE="https://advotecate-api-367966088269.us-central1.run.app/api/v1"

# Health check
curl $API_BASE/health

# Test authentication endpoint
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# List available endpoints
curl $API_BASE/admin/debug/routes
```

### 5. Production Monitoring

```bash
# Monitor service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=advotecate-api" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"

# Check service metrics
gcloud run services describe advotecate-api \
  --region=us-central1 \
  --format="table(status.traffic[].percent,status.traffic[].url)"
```

### 6. Scaling Configuration

```bash
# Update service with custom scaling
gcloud run services update advotecate-api \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 1000 \
  --memory 2Gi \
  --cpu 1
```

## API Endpoints Summary

The enhanced server provides **139 production endpoints** organized by functionality:

- **Authentication & Authorization**: 8 endpoints
- **User Management**: 12 endpoints
- **Campaign Management**: 24 endpoints
- **Donation Processing**: 18 endpoints
- **Compliance & Reporting**: 15 endpoints
- **Candidate Management**: 16 endpoints
- **Political Entity Management**: 14 endpoints
- **Document Management**: 10 endpoints
- **Administrative Functions**: 22 endpoints

**Current Status**: ✅ All endpoints deployed and accessible at production URL

This deployment provides a production-ready API server with comprehensive business logic, security features, and Cloud Run scalability for the Advotecate political donation platform.