# Supabase on Google Cloud Platform

Self-hosted Supabase deployment on Google Cloud Platform with KrakenD API Gateway, comprehensive monitoring, and enterprise-grade security.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Internet       │    │  KrakenD         │    │  Supabase Services  │
│  Users/Apps     │───▶│  API Gateway     │───▶│  - Auth (GoTrue)    │
│                 │    │  (Load Balancer) │    │  - REST (PostgREST) │
└─────────────────┘    └──────────────────┘    │  - Realtime         │
                                │               │  - Storage          │
                                │               │  - Kong Gateway     │
                                │               └─────────────────────┘
                                │
                                ▼               ┌─────────────────────┐
                       ┌──────────────────┐    │  Cloud SQL          │
                       │  GKE Cluster     │───▶│  PostgreSQL 15      │
                       │  - 2 Node Pools  │    │  - High Availability│
                       │  - Auto Scaling  │    │  - Automated Backup │
                       │  - Network Policies│   │  - SSL Required     │
                       └──────────────────┘    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Monitoring & Security                                                      │
│  - Prometheus + Grafana                                                     │
│  - Network Policies                                                         │
│  - Workload Identity                                                        │
│  - Pod Security Policies                                                    │
│  - SSL/TLS Everywhere                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Terraform >= 1.5 installed
- kubectl installed
- Docker installed
- A GCP project with billing enabled

### 1. Clone and Setup

```bash
cd infrastructure/gcp-supabase
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 2. Deploy Infrastructure

```bash
# Quick deployment
./scripts/deploy.sh -p YOUR_PROJECT_ID

# Custom deployment
./scripts/deploy.sh \
  -p YOUR_PROJECT_ID \
  -r us-west1 \
  -e staging \
  -d yourdomain.com
```

### 3. Access Your Services

After deployment, your services will be available at:

- **API Gateway**: `https://api.yourdomain.com`
- **Supabase Dashboard**: `https://supabase.yourdomain.com`
- **Monitoring**: `https://monitoring.yourdomain.com`

## 📋 Detailed Deployment Guide

### Configuration

#### 1. Terraform Variables

Create `terraform.tfvars`:

```hcl
project_id  = "your-gcp-project-id"
region      = "us-central1"
environment = "prod"

# Network Configuration
vpc_cidr = "10.0.0.0/16"

# GKE Configuration
gke_node_count     = 2
gke_max_node_count = 10
gke_machine_type   = "e2-standard-4"

# Database Configuration
cloudsql_tier              = "db-custom-4-16384"
cloudsql_availability_type = "REGIONAL"
cloudsql_disk_size         = 200

# Security
enable_private_nodes    = true
enable_network_policy   = true
enable_workload_identity = true

additional_labels = {
  team        = "platform"
  environment = "production"
}
```

#### 2. DNS Setup

Before deployment, ensure your domain is configured:

1. Point these DNS A records to your LoadBalancer IP (obtained after deployment):
   - `api.yourdomain.com`
   - `supabase.yourdomain.com`
   - `monitoring.yourdomain.com`

2. SSL certificates will be automatically provisioned by Google-managed certificates.

### Deployment Steps

#### 1. Infrastructure Deployment

```bash
# Initialize and deploy
./scripts/deploy.sh -p your-project-id -d yourdomain.com

# Or step by step:
terraform init
terraform plan
terraform apply
```

#### 2. Post-Deployment Configuration

The deployment script automatically:
- Configures kubectl with cluster credentials
- Updates Kubernetes manifests with actual values
- Deploys all services in the correct order
- Sets up monitoring and security policies

#### 3. Verification

```bash
# Check cluster status
kubectl get nodes

# Check all pods are running
kubectl get pods -A

# Check services
kubectl get svc -A

# Check ingress
kubectl get ingress -A
```

## 🔧 Configuration Details

### Supabase Services

#### Authentication (GoTrue)
- **Image**: `supabase/gotrue:v2.99.0`
- **Port**: 9999
- **Features**: JWT authentication, user management, social logins
- **Database**: Dedicated auth database connection

#### REST API (PostgREST)
- **Image**: `postgrest/postgrest:v11.2.0`
- **Port**: 3000
- **Features**: Auto-generated REST API from PostgreSQL schema
- **Security**: Row-level security, JWT validation

#### Realtime
- **Image**: `supabase/realtime:v2.25.35`
- **Port**: 4000
- **Features**: WebSocket connections, database change streams
- **Performance**: Connection limits, rate limiting

#### Storage
- **Image**: `supabase/storage-api:v0.43.11`
- **Port**: 5000
- **Backend**: Google Cloud Storage
- **Features**: File upload, image transformation, access control

### KrakenD API Gateway

KrakenD serves as the main API gateway with:

#### Features
- **Authentication**: JWT validation for protected endpoints
- **Rate Limiting**: Configurable per endpoint
- **CORS**: Configured for web applications
- **SSL/TLS**: Automatic HTTPS redirect
- **Monitoring**: Metrics endpoint for Prometheus

#### Endpoints
- `/auth/v1/*` - Authentication endpoints
- `/rest/v1/*` - Database REST API
- `/storage/v1/*` - File storage API
- `/realtime/v1/*` - WebSocket connections
- `/functions/v1/*` - Edge functions
- `/v1/donations` - Custom donation endpoints (FluidPay integration)
- `/v1/webhooks/*` - Webhook endpoints

### Database Configuration

#### Cloud SQL PostgreSQL
- **Version**: PostgreSQL 15
- **High Availability**: Regional deployment
- **Backup**: Automated daily backups with point-in-time recovery
- **Security**: Private IP only, SSL required
- **Performance**: Optimized for Supabase workloads

#### Users and Permissions
- `postgres` - Superuser for administration
- `supabase_admin` - Main application user
- `supabase_auth_admin` - Authentication service user
- `supabase_storage_admin` - Storage service user

### Security Configuration

#### Network Security
- **Private Cluster**: Nodes have no public IPs
- **Network Policies**: Restrict pod-to-pod communication
- **Firewall Rules**: Only necessary ports open
- **SSL/TLS**: Required for all connections

#### Identity and Access Management
- **Workload Identity**: Secure authentication to GCP services
- **Service Accounts**: Dedicated accounts for each component
- **Pod Security Policies**: Enforce security standards
- **Resource Quotas**: Prevent resource exhaustion

#### Monitoring and Alerting
- **Prometheus**: Metrics collection and storage
- **Grafana**: Dashboards and visualization
- **Alertmanager**: Alert routing and notification
- **Google Cloud Monitoring**: Infrastructure monitoring

## 🔍 Monitoring and Observability

### Prometheus Metrics

The deployment includes comprehensive metrics collection:

#### Application Metrics
- HTTP request duration and rate
- Database connection counts
- Authentication success/failure rates
- Storage upload/download metrics
- WebSocket connection counts

#### Infrastructure Metrics
- Kubernetes cluster health
- Node resource utilization
- Pod memory and CPU usage
- Network traffic and errors
- Storage utilization

#### Custom Alerts
- Service availability (99.9% SLA)
- High response times (>1s)
- Error rates (>5%)
- Database connection limits
- Resource usage thresholds

### Grafana Dashboards

Access Grafana at `https://monitoring.yourdomain.com`:
- **Supabase Overview** - High-level service health
- **API Performance** - Request rates and response times
- **Database Metrics** - PostgreSQL performance and health
- **Infrastructure** - Kubernetes cluster and node metrics
- **Security** - Authentication and authorization metrics

### Log Aggregation

Logs are automatically collected and sent to Google Cloud Logging:
- Application logs from all services
- Kubernetes events and pod logs
- Database audit logs
- Network flow logs
- Security event logs

## 🛠️ Operations and Maintenance

### Scaling

#### Horizontal Pod Autoscaling
Services automatically scale based on CPU and memory usage:

```bash
# Check current scaling
kubectl get hpa -A

# Manually scale if needed
kubectl scale deployment supabase-rest --replicas=5 -n supabase
```

#### Cluster Autoscaling
Node pools automatically scale from 2-10 nodes based on demand.

#### Database Scaling
Vertical scaling requires manual intervention:

```bash
# Update machine type in terraform.tfvars
cloudsql_tier = "db-custom-8-32768"  # 8 vCPU, 32GB RAM

# Apply changes
terraform apply
```

### Backup and Recovery

#### Database Backups
- **Automated Backups**: Daily at 2 AM UTC
- **Point-in-Time Recovery**: 7-day window
- **Backup Retention**: 30 days

#### Disaster Recovery
```bash
# Create manual backup
gcloud sql backups create --instance=INSTANCE_NAME --project=PROJECT_ID

# Restore from backup
gcloud sql backups restore BACKUP_ID --restore-instance=TARGET_INSTANCE
```

#### Configuration Backup
All Kubernetes configurations are in version control. Infrastructure state is stored in Google Cloud Storage.

### Updates and Upgrades

#### Application Updates
```bash
# Update Supabase service versions
kubectl set image deployment/supabase-auth gotrue=supabase/gotrue:v2.100.0 -n supabase

# Update KrakenD
kubectl set image deployment/krakend-gateway krakend=devopsfaith/krakend:2.5 -n krakend
```

#### Infrastructure Updates
```bash
# Update Terraform configuration
terraform plan
terraform apply

# Update GKE cluster
gcloud container clusters upgrade CLUSTER_NAME --master
```

### Troubleshooting

#### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod POD_NAME -n NAMESPACE
   kubectl logs POD_NAME -n NAMESPACE
   ```

2. **Database connection issues**
   ```bash
   # Test connection
   kubectl run -it --rm debug --image=postgres:15 --restart=Never -- psql -h DATABASE_IP -U postgres
   ```

3. **SSL certificate issues**
   ```bash
   # Check certificate status
   kubectl describe managedcertificate -A

   # Check ingress
   kubectl describe ingress -A
   ```

4. **Network connectivity**
   ```bash
   # Test service connectivity
   kubectl run -it --rm debug --image=busybox --restart=Never -- wget -qO- SERVICE_URL
   ```

#### Log Analysis
```bash
# View recent logs
kubectl logs -f deployment/krakend-gateway -n krakend

# Search logs in Cloud Logging
gcloud logging read "resource.type=k8s_container" --limit=100

# Monitor resources
kubectl top nodes
kubectl top pods -A
```

## 🔒 Security Best Practices

### Regular Security Tasks

#### 1. Security Updates
- Monitor CVE databases for container vulnerabilities
- Update base images regularly
- Apply GKE security patches

#### 2. Access Review
- Review IAM permissions quarterly
- Audit service account usage
- Check network policy effectiveness

#### 3. Certificate Management
- Monitor SSL certificate expiration
- Ensure automatic renewal is working
- Test certificate validation

#### 4. Backup Verification
```bash
# Test backup restoration process monthly
gcloud sql backups list --instance=INSTANCE_NAME
gcloud sql operations list --instance=INSTANCE_NAME
```

### Security Monitoring
- Failed authentication attempts
- Unusual API access patterns
- Resource usage anomalies
- Network policy violations

## 💰 Cost Optimization

### Current Resource Usage

Based on default configuration:
- **GKE Cluster**: ~$150-300/month
- **Cloud SQL**: ~$200-400/month
- **Load Balancer**: ~$20/month
- **Monitoring**: ~$50/month
- **Storage**: ~$10-50/month (depending on usage)

**Total estimated cost**: $400-800/month

### Cost Reduction Strategies

#### 1. Development Environment
```hcl
# In terraform.tfvars for dev
enable_cost_optimization = true
gke_preemptible = true
cloudsql_availability_type = "ZONAL"
cloudsql_tier = "db-custom-2-8192"
```

#### 2. Scheduled Scaling
```bash
# Scale down during off-hours (implement via CronJob)
kubectl scale deployment --all --replicas=1 -n supabase
```

#### 3. Resource Right-Sizing
Monitor actual usage and adjust:
```bash
# Check resource utilization
kubectl top pods -A --containers
kubectl describe nodes
```

## 📚 API Documentation

### Authentication Endpoints

All authentication is handled through KrakenD gateway:

#### User Registration
```bash
POST https://api.yourdomain.com/auth/v1/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### User Login
```bash
POST https://api.yourdomain.com/auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Database API

#### Create Record
```bash
POST https://api.yourdomain.com/rest/v1/donations
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "amount": 50.00,
  "donor_email": "donor@example.com",
  "campaign_id": "campaign-123"
}
```

#### Query Records
```bash
GET https://api.yourdomain.com/rest/v1/donations?select=*&amount=gte.25
Authorization: Bearer JWT_TOKEN
```

### Custom Endpoints

#### FluidPay Integration
```bash
# Create donation with FluidPay
POST https://api.yourdomain.com/v1/donations
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "amount": 100.00,
  "donor": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  },
  "payment_method": {
    "type": "credit_card",
    "card_number": "4111111111111111",
    "exp_month": "12",
    "exp_year": "2025",
    "cvv": "123"
  }
}
```

#### Webhook Endpoints
```bash
# FluidPay webhooks
POST https://api.yourdomain.com/v1/webhooks/fluidpay
Content-Type: application/json
X-FluidPay-Signature: signature_here

{
  "event": "payment.completed",
  "data": { ... }
}
```

## 🔄 CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy-supabase.yml`:

```yaml
name: Deploy Supabase Infrastructure

on:
  push:
    branches: [main]
    paths: ['infrastructure/gcp-supabase/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2
      with:
        terraform_version: 1.5.0

    - name: Authenticate to GCP
      uses: google-github-actions/auth@v1
      with:
        credentials_json: ${{ secrets.GCP_SA_KEY }}

    - name: Deploy Infrastructure
      run: |
        cd infrastructure/gcp-supabase
        ./scripts/deploy.sh -p ${{ secrets.GCP_PROJECT_ID }} --skip-kubernetes
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
deploy_supabase:
  image: google/cloud-sdk:alpine
  stage: deploy
  before_script:
    - apk add --no-cache terraform
    - echo "$GCP_SA_KEY" | gcloud auth activate-service-account --key-file=-
    - gcloud config set project $GCP_PROJECT_ID
  script:
    - cd infrastructure/gcp-supabase
    - ./scripts/deploy.sh -p $GCP_PROJECT_ID
  only:
    - main
```

## 🧪 Testing

### Infrastructure Testing

```bash
# Validate Terraform
terraform validate
terraform plan

# Test Kubernetes manifests
kubectl apply --dry-run=client -f k8s/

# Test deployment script
./scripts/deploy.sh -p test-project --dry-run
```

### Service Testing

```bash
# Health check endpoints
curl -k https://api.yourdomain.com/health

# Authentication test
curl -X POST https://api.yourdomain.com/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Database API test
curl https://api.yourdomain.com/rest/v1/donations \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run --vus 10 --duration 30s - <<EOF
import http from 'k6/http';
export default function () {
  http.get('https://api.yourdomain.com/health');
}
EOF
```

## 🆘 Support and Contributing

### Getting Help

1. **Documentation**: Check this README and inline comments
2. **Issues**: Search existing issues in the repository
3. **Community**: Join the Supabase Discord for community support
4. **Professional Support**: Contact for enterprise support options

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd infrastructure/gcp-supabase

# Install pre-commit hooks
pre-commit install

# Validate changes
terraform fmt
terraform validate
```

## 📄 License

This infrastructure code is provided under the MIT License. See LICENSE file for details.

---

## 📞 Emergency Contacts

### Incident Response

1. **Check service status**: `https://monitoring.yourdomain.com`
2. **Review alerts**: Check Grafana alerting
3. **Scale up if needed**: `kubectl scale deployment --replicas=X`
4. **Database issues**: Contact GCP support for Cloud SQL
5. **Network issues**: Check GKE cluster health

### Recovery Procedures

1. **Service Recovery**: Restart deployments
2. **Database Recovery**: Restore from backup
3. **Complete Recovery**: Run deployment script
4. **Rollback**: Use Terraform state or previous container versions

---

*This documentation is maintained as part of the Advotecate infrastructure. Last updated: $(date)*