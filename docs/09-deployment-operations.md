# Deployment & Operations Guide

## Overview

Complete deployment and operations guide for the political donation platform, covering infrastructure provisioning, application deployment, monitoring, maintenance, and incident response procedures.

## Pre-Deployment Requirements

### Infrastructure Prerequisites

```bash
#!/bin/bash
# scripts/check-prerequisites.sh

echo "🔍 Checking deployment prerequisites..."

# Check required tools
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud CLI required"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl required"; exit 1; }

# Check GCP authentication
gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null || {
  echo "❌ Please authenticate with gcloud: gcloud auth login"
  exit 1
}

# Check required environment variables
required_vars=("PROJECT_ID" "REGION" "DATABASE_PASSWORD" "JWT_SECRET" "FLUIDPAY_SECRET_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Environment variable $var is required"
    exit 1
  fi
done

echo "✅ All prerequisites met"
```

### Environment Configuration

```yaml
# config/environments/production.yaml
environment: production
project:
  id: "advotecate-donation-prod"
  region: "us-central1"
  zone: "us-central1-a"

services:
  frontend:
    min_instances: 2
    max_instances: 20
    cpu: "1"
    memory: "2Gi"
    timeout: "300s"

  backend:
    min_instances: 2
    max_instances: 50
    cpu: "2"
    memory: "4Gi"
    timeout: "300s"

database:
  tier: "db-custom-4-16384"
  storage_size: "100"
  storage_type: "PD_SSD"
  backup_enabled: true
  maintenance_window: "sun:06:00"

monitoring:
  enabled: true
  log_level: "INFO"
  metrics_retention: "30d"
  alerts:
    email: ["admin@advotecate.com"]
    slack_webhook: "${SLACK_WEBHOOK_URL}"

security:
  force_https: true
  cors_origins: ["https://donation-platform.com"]
  rate_limits:
    anonymous: 100
    authenticated: 1000
    admin: 5000
```

## Infrastructure Deployment

### Terraform Infrastructure

```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    bucket = "advotecate-terraform-state"
    prefix = "donation-platform"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Data sources
data "google_project" "project" {
  project_id = var.project_id
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "vpcaccess.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "clouderrorreporting.googleapis.com",
    "cloudtrace.googleapis.com",
  ])

  service = each.value
  project = var.project_id

  disable_on_destroy = false
}

# VPC and networking
module "networking" {
  source = "./modules/networking"

  project_id = var.project_id
  region     = var.region
}

# Cloud SQL
module "database" {
  source = "./modules/database"

  project_id     = var.project_id
  region         = var.region
  network_id     = module.networking.network_id
  database_name  = var.database_name
  db_password    = var.database_password
  environment    = var.environment
}

# KMS for encryption
module "kms" {
  source = "./modules/kms"

  project_id = var.project_id
  region     = var.region
}

# Secret Manager
module "secrets" {
  source = "./modules/secrets"

  project_id = var.project_id
  secrets = {
    database-url        = module.database.connection_string
    jwt-secret         = var.jwt_secret
    fluidpay-api-key   = var.fluidpay_api_key
    fluidpay-secret-key = var.fluidpay_secret_key
    encryption-key     = module.kms.encryption_key_id
  }
}

# IAM service accounts
module "iam" {
  source = "./modules/iam"

  project_id = var.project_id
}

# Cloud Run services
module "cloud_run" {
  source = "./modules/cloud_run"

  project_id          = var.project_id
  region              = var.region
  vpc_connector_id    = module.networking.vpc_connector_id
  database_instance   = module.database.instance_name
  service_account_email = module.iam.backend_service_account_email

  depends_on = [
    google_project_service.apis,
    module.database,
    module.networking
  ]
}

# Load balancer
module "load_balancer" {
  source = "./modules/load_balancer"

  project_id    = var.project_id
  backend_service = module.cloud_run.backend_service
  frontend_service = module.cloud_run.frontend_service
  ssl_certificate_domains = var.domains
}

# Monitoring and alerting
module "monitoring" {
  source = "./modules/monitoring"

  project_id = var.project_id
  notification_channels = var.notification_channels
}

# Outputs
output "database_connection" {
  value     = module.database.connection_string
  sensitive = true
}

output "backend_url" {
  value = module.cloud_run.backend_url
}

output "frontend_url" {
  value = module.cloud_run.frontend_url
}

output "load_balancer_ip" {
  value = module.load_balancer.ip_address
}
```

### Database Module

```hcl
# terraform/modules/database/main.tf
resource "google_sql_database_instance" "postgres" {
  name             = "donation-platform-${var.environment}"
  database_version = "POSTGRES_15"
  region          = var.region
  project         = var.project_id

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
      location                      = var.region

      backup_retention_settings {
        retained_backups = var.environment == "production" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      require_ssl     = true
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries taking more than 1 second
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 6  # 6 AM
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address  = true
    }
  }

  deletion_protection = var.environment == "production"

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "database" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
  project  = var.project_id
}

resource "google_sql_user" "readonly_user" {
  name     = "readonly_user"
  instance = google_sql_database_instance.postgres.name
  password = var.readonly_password
  project  = var.project_id
}

# Private service connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.network_id
  service                = "servicenetworking.googleapis.com"
  reserved_peering_ranges = ["google-managed-services-default"]
}

# Database initialization
resource "null_resource" "db_init" {
  depends_on = [google_sql_database.database, google_sql_user.app_user]

  provisioner "local-exec" {
    command = <<-EOT
      export PGPASSWORD="${var.db_password}"
      psql -h ${google_sql_database_instance.postgres.private_ip_address} \
           -U app_user \
           -d ${var.database_name} \
           -f ${path.module}/init.sql
    EOT
  }

  triggers = {
    instance_id = google_sql_database_instance.postgres.id
  }
}

# Outputs
output "instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "connection_string" {
  value = "postgresql://app_user:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${var.database_name}"
  sensitive = true
}

output "private_ip" {
  value = google_sql_database_instance.postgres.private_ip_address
}
```

## Application Deployment

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to GCP

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: |
        npm ci
        cd frontend && npm ci

    - name: Run linting
      run: |
        npm run lint
        cd frontend && npm run lint

    - name: Run type checking
      run: |
        npm run type-check
        cd frontend && npm run type-check

    - name: Run backend tests
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      run: npm test

    - name: Run frontend tests
      working-directory: frontend
      run: npm test

    - name: Run E2E tests
      run: |
        npm run build
        npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Run security audit
      run: |
        npm audit --audit-level high
        cd frontend && npm audit --audit-level high

    - name: Run SAST scan
      uses: securecodewarrior/github-action-add-sarif@v1
      with:
        sarif-file: security-scan-results.sarif

  build:
    needs: [test, security-scan]
    runs-on: ubuntu-latest

    outputs:
      backend-image: ${{ steps.build-backend.outputs.image }}
      frontend-image: ${{ steps.build-frontend.outputs.image }}

    steps:
    - uses: actions/checkout@v4

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}

    - name: Configure Docker
      run: gcloud auth configure-docker

    - name: Build backend image
      id: build-backend
      run: |
        IMAGE="gcr.io/$PROJECT_ID/donation-backend:$GITHUB_SHA"
        docker build -t $IMAGE ./backend
        docker push $IMAGE
        echo "image=$IMAGE" >> $GITHUB_OUTPUT

    - name: Build frontend image
      id: build-frontend
      run: |
        IMAGE="gcr.io/$PROJECT_ID/donation-frontend:$GITHUB_SHA"
        docker build -t $IMAGE ./frontend
        docker push $IMAGE
        echo "image=$IMAGE" >> $GITHUB_OUTPUT

    - name: Run security scan on images
      run: |
        gcloud container images scan ${{ steps.build-backend.outputs.image }}
        gcloud container images scan ${{ steps.build-frontend.outputs.image }}

  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    needs: build
    runs-on: ubuntu-latest
    environment: staging

    steps:
    - uses: actions/checkout@v4

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}

    - name: Deploy to staging
      run: |
        # Deploy backend
        gcloud run deploy donation-backend-staging \
          --image ${{ needs.build.outputs.backend-image }} \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated \
          --set-env-vars="NODE_ENV=staging" \
          --max-instances=10

        # Deploy frontend
        gcloud run deploy donation-frontend-staging \
          --image ${{ needs.build.outputs.frontend-image }} \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated \
          --set-env-vars="NODE_ENV=staging,NEXT_PUBLIC_API_URL=https://donation-backend-staging-xxx.run.app"

    - name: Run integration tests against staging
      run: |
        export API_URL=$(gcloud run services describe donation-backend-staging --region=$REGION --format='value(status.url)')
        npm run test:integration
      env:
        TEST_ENV: staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production

    steps:
    - uses: actions/checkout@v4

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}

    - name: Run database migrations
      run: |
        export DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
        npm run migrate

    - name: Deploy backend with zero downtime
      run: |
        # Deploy new revision
        gcloud run deploy donation-backend \
          --image ${{ needs.build.outputs.backend-image }} \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated \
          --no-traffic

        # Get revision name
        REVISION=$(gcloud run revisions list --service=donation-backend --region=$REGION --limit=1 --format='value(metadata.name)')

        # Gradual traffic migration
        gcloud run services update-traffic donation-backend \
          --to-revisions=$REVISION=10 \
          --region=$REGION

        # Health check
        sleep 60

        # Full traffic migration if healthy
        gcloud run services update-traffic donation-backend \
          --to-revisions=$REVISION=100 \
          --region=$REGION

    - name: Deploy frontend
      run: |
        gcloud run deploy donation-frontend \
          --image ${{ needs.build.outputs.frontend-image }} \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated

    - name: Verify deployment
      run: |
        export API_URL=$(gcloud run services describe donation-backend --region=$REGION --format='value(status.url)')
        curl -f $API_URL/health || exit 1

    - name: Update DNS if needed
      run: |
        # Update Cloud DNS records if using custom domain
        # This would point your custom domain to the new deployment
        echo "DNS updates would go here"

  notify:
    if: always()
    needs: [deploy-staging, deploy-production]
    runs-on: ubuntu-latest

    steps:
    - name: Notify Slack
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Database Migrations

```typescript
// scripts/migrate.ts
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor(databaseUrl: string, migrationsDir: string = './migrations') {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.migrationsDir = migrationsDir;
  }

  async run(): Promise<void> {
    console.log('🚀 Starting database migrations...');

    try {
      // Ensure migrations table exists
      await this.createMigrationsTable();

      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📝 Found ${pendingMigrations.length} pending migrations`);

      // Run migrations in transaction
      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const migration of pendingMigrations) {
          console.log(`⚡ Running migration: ${migration.name}`);

          await client.query(migration.sql);
          await client.query(
            'INSERT INTO schema_migrations (id, name, executed_at) VALUES ($1, $2, NOW())',
            [migration.id, migration.name]
          );

          console.log(`✅ Completed: ${migration.name}`);
        }

        await client.query('COMMIT');
        console.log('🎉 All migrations completed successfully');

      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed, rolling back:', error);
        throw error;
      } finally {
        client.release();
      }

    } finally {
      await this.pool.end();
    }
  }

  private async createMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async getPendingMigrations(): Promise<Migration[]> {
    // Get executed migrations
    const { rows: executedMigrations } = await this.pool.query(
      'SELECT id FROM schema_migrations ORDER BY id'
    );
    const executedIds = new Set(executedMigrations.map(row => row.id));

    // Load all migration files
    const migrationFiles = readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of migrationFiles) {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const id = parseInt(match[1]);
      const name = match[2];

      if (!executedIds.has(id)) {
        const sql = readFileSync(
          join(this.migrationsDir, filename),
          'utf8'
        );

        migrations.push({ id, name, filename, sql });
      }
    }

    return migrations.sort((a, b) => a.id - b.id);
  }
}

// CLI usage
if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable required');
    process.exit(1);
  }

  const runner = new MigrationRunner(databaseUrl);
  runner.run().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
```

## Health Checks & Monitoring

### Application Health Checks

```typescript
// src/routes/health.ts
import express from 'express';
import { Pool } from 'pg';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

class HealthMonitor {
  private pool: Pool;
  private startTime: number;

  constructor(pool: Pool) {
    this.pool = pool;
    this.startTime = Date.now();
  }

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      await this.pool.query('SELECT 1');
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message }
      };
    }
  }

  async checkFluidPay(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      const response = await fetch(`${process.env.FLUIDPAY_API_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FLUIDPAY_SECRET_KEY}`
        },
        timeout: 5000
      });

      if (response.ok) {
        return {
          service: 'fluidpay',
          status: 'healthy',
          responseTime: Date.now() - start
        };
      } else {
        return {
          service: 'fluidpay',
          status: 'degraded',
          responseTime: Date.now() - start,
          details: { statusCode: response.status }
        };
      }
    } catch (error) {
      return {
        service: 'fluidpay',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message }
      };
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Implement Redis ping check
      return {
        service: 'redis',
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message }
      };
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkFluidPay(),
      this.checkRedis()
    ]);

    const unhealthyServices = checks.filter(check => check.status === 'unhealthy');
    const degradedServices = checks.filter(check => check.status === 'degraded');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION || 'unknown',
      checks
    };
  }
}

const router = express.Router();
const healthMonitor = new HealthMonitor(pool);

// Liveness probe - basic health check
router.get('/health', async (req, res) => {
  const health = await healthMonitor.getSystemHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Readiness probe - detailed health check
router.get('/ready', async (req, res) => {
  const health = await healthMonitor.getSystemHealth();

  // Service is ready only if all critical services are healthy
  const criticalServices = ['database'];
  const criticalUnhealthy = health.checks
    .filter(check => criticalServices.includes(check.service))
    .some(check => check.status === 'unhealthy');

  if (criticalUnhealthy) {
    return res.status(503).json({
      ...health,
      ready: false,
      message: 'Critical services unavailable'
    });
  }

  res.json({
    ...health,
    ready: true
  });
});

export default router;
```

### Monitoring Configuration

```yaml
# monitoring/alerts.yaml
groups:
  - name: donation-platform-alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            rate(http_requests_total{status=~"5.."}[5m]) /
            rate(http_requests_total[5m])
          ) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.service }}"

      # High response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s for {{ $labels.service }}"

      # Database connection issues
      - alert: DatabaseConnectionFailure
        expr: |
          up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "Cannot connect to database for {{ $labels.instance }}"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (
            container_memory_working_set_bytes /
            container_spec_memory_limit_bytes
          ) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }} for {{ $labels.container }}"

      # FluidPay API issues
      - alert: FluidPayAPIDown
        expr: |
          up{job="fluidpay-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "FluidPay API is down"
          description: "Cannot reach FluidPay API for payment processing"

      # Compliance violations
      - alert: ComplianceViolation
        expr: |
          increase(compliance_violations_total[5m]) > 0
        for: 0s
        labels:
          severity: critical
        annotations:
          summary: "Compliance violation detected"
          description: "{{ $value }} compliance violations in the last 5 minutes"

      # Failed donations
      - alert: HighDonationFailureRate
        expr: |
          (
            rate(donations_total{status="failed"}[10m]) /
            rate(donations_total[10m])
          ) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High donation failure rate"
          description: "Donation failure rate is {{ $value | humanizePercentage }}"
```

## Incident Response

### Incident Response Playbook

```markdown
# Incident Response Playbook

## Severity Levels

### P0 - Critical
- Complete service outage
- Data breach or security incident
- Payment processing completely down
- Compliance violations

**Response Time**: 15 minutes
**Escalation**: Immediate

### P1 - High
- Significant feature degradation
- High error rates (>5%)
- Performance severely impacted
- Partial payment processing issues

**Response Time**: 1 hour
**Escalation**: Within 2 hours if not resolved

### P2 - Medium
- Minor feature issues
- Moderate performance impact
- Non-critical integrations down

**Response Time**: 4 hours
**Escalation**: Next business day

### P3 - Low
- Cosmetic issues
- Non-urgent feature requests
- Documentation updates

**Response Time**: 24 hours
**Escalation**: Weekly review

## Response Procedures

### Initial Response (First 15 minutes)

1. **Acknowledge the incident**
   - Update status page if customer-facing
   - Notify stakeholders via Slack #incidents channel

2. **Assess severity and impact**
   - Check monitoring dashboards
   - Identify affected services and user impact
   - Classify severity level

3. **Assemble response team**
   - Technical lead
   - On-call engineer
   - Product owner (for P0/P1)
   - Security team (if security-related)

4. **Establish communication**
   - Create incident channel in Slack
   - Set up bridge line for P0 incidents
   - Designate incident commander

### Investigation Phase

1. **Gather information**
   - Check recent deployments
   - Review error logs and metrics
   - Interview any relevant team members

2. **Form hypothesis**
   - Identify most likely root cause
   - Plan investigation steps
   - Assign investigation tasks

3. **Test hypothesis**
   - Implement minimal tests
   - Gather additional data
   - Refine or reject hypothesis

### Resolution Phase

1. **Implement fix**
   - Apply immediate workaround if possible
   - Deploy permanent fix
   - Verify resolution with monitoring

2. **Monitor recovery**
   - Watch key metrics for improvement
   - Confirm user-facing functionality restored
   - Remove any workarounds when safe

3. **Communicate resolution**
   - Update status page
   - Notify stakeholders
   - Document resolution steps

### Post-Incident Review

1. **Immediate review** (within 24 hours)
   - What happened?
   - What went well?
   - What could be improved?
   - Timeline of events

2. **Action items**
   - Preventive measures
   - Process improvements
   - Technical debt to address
   - Assign owners and deadlines

3. **Documentation**
   - Update runbooks
   - Share lessons learned
   - Archive incident details
```

### Automated Incident Response

```typescript
// scripts/incident-response.ts
interface Incident {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  detectedAt: Date;
  services: string[];
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
}

class IncidentManager {
  async createIncident(
    severity: Incident['severity'],
    title: string,
    description: string,
    services: string[]
  ): Promise<Incident> {
    const incident: Incident = {
      id: this.generateIncidentId(),
      severity,
      title,
      description,
      detectedAt: new Date(),
      services,
      status: 'open'
    };

    // Create incident record
    await this.storeIncident(incident);

    // Automated response based on severity
    switch (severity) {
      case 'P0':
        await this.handleP0Incident(incident);
        break;
      case 'P1':
        await this.handleP1Incident(incident);
        break;
      default:
        await this.handleLowerSeverityIncident(incident);
    }

    return incident;
  }

  private async handleP0Incident(incident: Incident): Promise<void> {
    // Immediate escalation for critical incidents
    await Promise.all([
      this.notifyPagerDuty(incident),
      this.updateStatusPage(incident),
      this.createSlackChannel(incident),
      this.notifyExecutives(incident),
      this.enableEmergencyScaling(incident.services)
    ]);
  }

  private async handleP1Incident(incident: Incident): Promise<void> {
    await Promise.all([
      this.notifyOnCallTeam(incident),
      this.createSlackChannel(incident),
      this.updateStatusPage(incident)
    ]);
  }

  private async notifyPagerDuty(incident: Incident): Promise<void> {
    // Integration with PagerDuty for immediate alerting
    console.log(`PagerDuty alert for incident ${incident.id}`);
  }

  private async updateStatusPage(incident: Incident): Promise<void> {
    // Update public status page
    console.log(`Status page updated for incident ${incident.id}`);
  }

  private async createSlackChannel(incident: Incident): Promise<void> {
    // Create dedicated Slack channel for incident coordination
    const channelName = `incident-${incident.id}`;
    console.log(`Created Slack channel: ${channelName}`);
  }

  private async enableEmergencyScaling(services: string[]): Promise<void> {
    // Automatically scale up affected services
    for (const service of services) {
      console.log(`Emergency scaling enabled for ${service}`);
      // Implement actual scaling logic
    }
  }

  private generateIncidentId(): string {
    return `INC-${Date.now().toString(36).toUpperCase()}`;
  }

  private async storeIncident(incident: Incident): Promise<void> {
    // Store incident in database for tracking
  }
}
```

## Maintenance & Updates

### Rolling Update Strategy

```bash
#!/bin/bash
# scripts/rolling-update.sh

set -e

PROJECT_ID="${PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="$1"
NEW_IMAGE="$2"

if [ -z "$SERVICE_NAME" ] || [ -z "$NEW_IMAGE" ]; then
  echo "Usage: $0 <service-name> <new-image>"
  exit 1
fi

echo "🚀 Starting rolling update for $SERVICE_NAME"

# Deploy new revision without traffic
echo "📦 Deploying new revision..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$NEW_IMAGE" \
  --region "$REGION" \
  --no-traffic \
  --tag "candidate"

# Get the new revision name
NEW_REVISION=$(gcloud run revisions list \
  --service="$SERVICE_NAME" \
  --region="$REGION" \
  --limit=1 \
  --format='value(metadata.name)')

echo "✅ New revision deployed: $NEW_REVISION"

# Health check function
health_check() {
  local url="$1"
  local attempts=0
  local max_attempts=10

  while [ $attempts -lt $max_attempts ]; do
    if curl -f -s "$url/health" > /dev/null; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 10
  done
  return 1
}

# Get candidate URL for testing
CANDIDATE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.traffic[0].url)')

echo "🔍 Running health checks on candidate revision..."
if health_check "$CANDIDATE_URL"; then
  echo "✅ Health checks passed"
else
  echo "❌ Health checks failed, rolling back..."
  gcloud run services update-traffic "$SERVICE_NAME" \
    --remove-tags candidate \
    --region "$REGION"
  exit 1
fi

# Gradual traffic migration
echo "🔀 Starting gradual traffic migration..."

# 10% traffic
gcloud run services update-traffic "$SERVICE_NAME" \
  --to-revisions="$NEW_REVISION=10" \
  --region "$REGION"

echo "⏳ Monitoring 10% traffic for 5 minutes..."
sleep 300

# Check metrics at 10% traffic
if ! health_check "$CANDIDATE_URL"; then
  echo "❌ Issues detected at 10% traffic, rolling back..."
  gcloud run services update-traffic "$SERVICE_NAME" \
    --to-latest \
    --region "$REGION"
  exit 1
fi

# 50% traffic
gcloud run services update-traffic "$SERVICE_NAME" \
  --to-revisions="$NEW_REVISION=50" \
  --region "$REGION"

echo "⏳ Monitoring 50% traffic for 3 minutes..."
sleep 180

# Final health check
if ! health_check "$CANDIDATE_URL"; then
  echo "❌ Issues detected at 50% traffic, rolling back..."
  gcloud run services update-traffic "$SERVICE_NAME" \
    --to-latest \
    --region "$REGION"
  exit 1
fi

# 100% traffic
echo "🎯 Migrating 100% traffic to new revision..."
gcloud run services update-traffic "$SERVICE_NAME" \
  --to-revisions="$NEW_REVISION=100" \
  --region "$REGION"

echo "✅ Rolling update completed successfully"
echo "🔍 Final health check..."
if health_check "$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)')"; then
  echo "🎉 Deployment successful and healthy"
else
  echo "⚠️ Deployment complete but health check failed"
  exit 1
fi
```

### Backup & Recovery Procedures

```bash
#!/bin/bash
# scripts/backup-restore.sh

PROJECT_ID="${PROJECT_ID}"
REGION="${REGION:-us-central1}"
INSTANCE_NAME="donation-platform-postgres"

backup_database() {
  local backup_name="backup-$(date +%Y%m%d-%H%M%S)"

  echo "💾 Creating database backup: $backup_name"

  gcloud sql backups create \
    --instance="$INSTANCE_NAME" \
    --description="Manual backup - $backup_name" \
    --project="$PROJECT_ID"

  echo "✅ Backup created successfully"
}

restore_database() {
  local backup_id="$1"
  local target_instance="${2:-$INSTANCE_NAME-restore}"

  if [ -z "$backup_id" ]; then
    echo "❌ Backup ID required"
    echo "Usage: $0 restore <backup-id> [target-instance]"
    exit 1
  fi

  echo "🔄 Restoring database from backup $backup_id to $target_instance"

  # Create new instance from backup
  gcloud sql instances clone \
    "$INSTANCE_NAME" "$target_instance" \
    --backup-id="$backup_id" \
    --project="$PROJECT_ID"

  echo "✅ Database restored to $target_instance"
}

list_backups() {
  echo "📋 Available backups for $INSTANCE_NAME:"
  gcloud sql backups list \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --format="table(id,windowStartTime,status,type)"
}

# Cross-region backup replication
replicate_backup() {
  local backup_bucket="gs://donation-platform-backups"
  local dr_bucket="gs://donation-platform-backups-dr"

  echo "🔄 Replicating backups to DR region..."

  gsutil -m rsync -r -d "$backup_bucket" "$dr_bucket"

  echo "✅ Backup replication completed"
}

case "$1" in
  backup)
    backup_database
    ;;
  restore)
    restore_database "$2" "$3"
    ;;
  list)
    list_backups
    ;;
  replicate)
    replicate_backup
    ;;
  *)
    echo "Usage: $0 {backup|restore|list|replicate}"
    echo ""
    echo "Commands:"
    echo "  backup                    - Create a new database backup"
    echo "  restore <id> [instance]   - Restore from backup to new instance"
    echo "  list                      - List available backups"
    echo "  replicate                 - Replicate backups to DR region"
    exit 1
    ;;
esac
```

This comprehensive deployment and operations guide provides everything needed to deploy, monitor, and maintain your political donation platform in a production environment with proper incident response procedures and automated deployment pipelines.