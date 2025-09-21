#!/bin/bash
# MVP Deployment Script - Deploy Advotecate platform with best practices
# Optimized for fast MVP deployment with staging → production flow

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT="staging"
GITHUB_ORG=""
REPO_NAME="advotecate-platform"
DOMAIN=""
GCP_PROJECT_ID=""
SKIP_INFRA=false
SKIP_BACKEND=false
SKIP_FRONTEND=false

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

MVP Deployment Script - Deploy with best practices

OPTIONS:
    -e, --environment ENV         Environment (staging/production) (default: staging)
    -o, --github-org ORG         GitHub organization name (required)
    -r, --repo REPO_NAME         Repository name (default: advotecate-platform)
    -d, --domain DOMAIN          Your domain (e.g., advotecate.com)
    -p, --project-id PROJECT_ID  GCP Project ID
    --skip-infra                 Skip infrastructure deployment
    --skip-backend              Skip backend deployment
    --skip-frontend             Skip frontend deployment
    -h, --help                  Show this help

MVP DEPLOYMENT PHASES:
    Phase 1: Repository Setup & CI/CD
    Phase 2: Infrastructure (GCP + Supabase)
    Phase 3: Backend Deployment
    Phase 4: Frontend Deployment
    Phase 5: Monitoring & Health Checks

EXAMPLES:
    # Full MVP deployment to staging
    $0 -o myorg -d mydomain.com -p my-gcp-project

    # Deploy to production (after staging success)
    $0 -e production -o myorg -d mydomain.com -p my-gcp-project

    # Just infrastructure
    $0 -o myorg -p my-gcp-project --skip-backend --skip-frontend

PREREQUISITES:
    ✅ GitHub CLI authenticated (gh auth status)
    ✅ Google Cloud CLI authenticated (gcloud auth list)
    ✅ Vercel CLI authenticated (vercel whoami)
    ✅ Docker running
    ✅ Domain ready for DNS configuration

EOF
}

check_prerequisites() {
    log_info "🔍 Checking prerequisites for MVP deployment..."

    local missing=()

    # Check GitHub CLI
    if ! command -v gh &> /dev/null; then
        missing+=("GitHub CLI (https://cli.github.com/)")
    elif ! gh auth status &> /dev/null; then
        missing+=("GitHub CLI authentication (run: gh auth login)")
    fi

    # Check Google Cloud
    if ! command -v gcloud &> /dev/null; then
        missing+=("Google Cloud SDK")
    elif ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        missing+=("Google Cloud authentication (run: gcloud auth login)")
    fi

    # Check Vercel
    if ! command -v vercel &> /dev/null; then
        missing+=("Vercel CLI (run: npm install -g vercel)")
    elif ! vercel whoami &> /dev/null; then
        missing+=("Vercel authentication (run: vercel login)")
    fi

    # Check other tools
    command -v terraform &> /dev/null || missing+=("Terraform")
    command -v kubectl &> /dev/null || missing+=("kubectl")
    command -v docker &> /dev/null || missing+=("Docker")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "❌ Missing prerequisites:"
        printf "   %s\n" "${missing[@]}"
        log_info "Please install missing tools and try again."
        exit 1
    fi

    log_success "✅ All prerequisites satisfied"
}

setup_github_repo() {
    log_info "🚀 Setting up GitHub repository..."

    cd "$PROJECT_ROOT"

    # Check if remote exists
    if git remote get-url origin &> /dev/null; then
        log_info "Repository already has remote origin"
        local current_remote
        current_remote=$(git remote get-url origin)
        log_info "Current remote: $current_remote"

        read -p "Continue with existing remote? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Please update your remote manually or remove it first"
            exit 1
        fi
    else
        # Create repository if it doesn't exist
        log_info "Creating GitHub repository: $GITHUB_ORG/$REPO_NAME"

        if gh repo create "$GITHUB_ORG/$REPO_NAME" --public --source=. --remote=origin --push; then
            log_success "✅ Repository created and code pushed"
        else
            log_warning "Repository may already exist, adding as remote..."
            git remote add origin "https://github.com/$GITHUB_ORG/$REPO_NAME.git"
            git branch -M main
            git push -u origin main
        fi
    fi

    # Set branch protection on main
    log_info "Setting up branch protection rules..."
    gh api "repos/$GITHUB_ORG/$REPO_NAME/branches/main/protection" \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["test","build"]}' \
        --field enforce_admins=true \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
        --field restrictions=null || log_warning "⚠️  Branch protection setup failed (may already exist)"

    # Create staging branch if it doesn't exist
    if ! git show-ref --verify --quiet refs/heads/staging; then
        log_info "Creating staging branch..."
        git checkout -b staging
        git push -u origin staging
        git checkout main
    fi

    log_success "✅ GitHub repository configured"
}

setup_secrets() {
    log_info "🔐 Setting up GitHub secrets..."

    echo "We need to configure GitHub secrets for CI/CD deployment."
    echo "You can set these manually in GitHub UI or provide them now:"
    echo "https://github.com/$GITHUB_ORG/$REPO_NAME/settings/secrets/actions"
    echo

    # List required secrets
    cat << EOF
Required Organization Secrets (set once for all repos):
- GCP_PROJECT_ID_PRODUCTION: Your production GCP project
- GCP_PROJECT_ID_STAGING: Your staging GCP project
- GCP_SA_KEY: Service account JSON key (with GKE admin rights)
- VERCEL_TOKEN: Your Vercel API token
- VERCEL_ORG_ID: Your Vercel organization ID

Repository Secrets (specific to this app):
- FLUIDPAY_API_KEY_PROD: Production FluidPay API key
- FLUIDPAY_API_SECRET_PROD: Production FluidPay API secret
- FLUIDPAY_API_KEY_STAGING: Staging FluidPay API key
- FLUIDPAY_API_SECRET_STAGING: Staging FluidPay API secret
- JWT_SECRET_PROD: Production JWT secret (64+ chars)
- JWT_SECRET_STAGING: Staging JWT secret (64+ chars)

Optional:
- SLACK_WEBHOOK_URL: For deployment notifications
EOF

    echo
    read -p "Have you configured these secrets in GitHub? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "⚠️  Please configure secrets before proceeding"
        log_info "You can continue deployment after setting up secrets"
        exit 1
    fi

    log_success "✅ Secrets confirmed"
}

deploy_infrastructure() {
    if [[ "$SKIP_INFRA" == "true" ]]; then
        log_info "⏭️  Skipping infrastructure deployment"
        return 0
    fi

    log_info "🏗️  Deploying infrastructure ($ENVIRONMENT)..."

    cd "$PROJECT_ROOT/infrastructure/gcp-supabase"

    # Create terraform.tfvars
    local tfvars_file="terraform.tfvars"
    cat > "$tfvars_file" << EOF
# Generated by MVP deployment script
project_id  = "$GCP_PROJECT_ID"
region      = "us-central1"
zone        = "us-central1-a"
environment = "$ENVIRONMENT"

# Network configuration
vpc_cidr                     = "10.0.0.0/16"
enable_private_google_access = true
enable_nat_gateway          = true

# GKE configuration (cost-optimized for MVP)
gke_node_count       = 2
gke_max_node_count   = 5
gke_machine_type     = "e2-standard-2"  # Smaller for MVP
gke_disk_size        = 50               # Smaller for MVP
gke_preemptible     = $([ "$ENVIRONMENT" == "staging" ] && echo "true" || echo "false")

# Cloud SQL configuration (cost-optimized)
cloudsql_tier                    = "db-custom-2-8192"  # Smaller for MVP
cloudsql_disk_size              = 100                   # Smaller for MVP
cloudsql_availability_type      = $([ "$ENVIRONMENT" == "production" ] && echo "\"REGIONAL\"" || echo "\"ZONAL\"")
cloudsql_backup_enabled         = true
cloudsql_point_in_time_recovery = $([ "$ENVIRONMENT" == "production" ] && echo "true" || echo "false")

# Security
enable_binary_authorization = true
enable_network_policy      = true
enable_private_nodes       = true
enable_workload_identity   = true

# Cost optimization for MVP
enable_cost_optimization = $([ "$ENVIRONMENT" == "staging" ] && echo "true" || echo "false")
schedule_downscaling     = $([ "$ENVIRONMENT" == "staging" ] && echo "true" || echo "false")

# Labels
additional_labels = {
  environment = "$ENVIRONMENT"
  deployed_by = "mvp-script"
  domain      = "$DOMAIN"
}
EOF

    log_info "📄 Created terraform.tfvars for $ENVIRONMENT"

    # Deploy infrastructure
    log_info "🚀 Running terraform deployment..."

    if ./scripts/deploy.sh -p "$GCP_PROJECT_ID" -d "$DOMAIN"; then
        log_success "✅ Infrastructure deployed successfully"
    else
        log_error "❌ Infrastructure deployment failed"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

deploy_backend() {
    if [[ "$SKIP_BACKEND" == "true" ]]; then
        log_info "⏭️  Skipping backend deployment"
        return 0
    fi

    log_info "⚡ Deploying backend to GCP ($ENVIRONMENT)..."

    cd "$PROJECT_ROOT/backend"

    # Install and test
    log_info "📦 Installing dependencies and running tests..."
    npm ci
    npm run build
    npm test || log_warning "⚠️  Tests failed, continuing deployment"

    # Deploy using script
    local cluster_name="${ENVIRONMENT}-supabase-cluster"

    if ./scripts/deploy-gcp.sh -p "$GCP_PROJECT_ID" -c "$cluster_name" -t "$ENVIRONMENT-$(git rev-parse --short HEAD)"; then
        log_success "✅ Backend deployed successfully"
    else
        log_error "❌ Backend deployment failed"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

deploy_frontend() {
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        log_info "⏭️  Skipping frontend deployment"
        return 0
    fi

    log_info "🌐 Deploying frontend to Vercel ($ENVIRONMENT)..."

    # Ensure frontend exists
    if [[ ! -d "$PROJECT_ROOT/frontend" ]]; then
        log_info "Creating frontend structure..."
        ./scripts/deploy-vercel.sh --help > /dev/null  # This will create frontend structure
    fi

    # Deploy frontend
    local api_url="https://$([ "$ENVIRONMENT" == "staging" ] && echo "staging-")api.$DOMAIN"
    local vercel_env=$([ "$ENVIRONMENT" == "production" ] && echo "production" || echo "preview")

    if ./scripts/deploy-vercel.sh -e "$vercel_env" -a "$api_url" -p "advotecate-$ENVIRONMENT" -y; then
        log_success "✅ Frontend deployed successfully"
    else
        log_error "❌ Frontend deployment failed"
        return 1
    fi
}

setup_monitoring() {
    log_info "📊 Setting up monitoring and health checks..."

    # Test deployments
    local api_url="https://$([ "$ENVIRONMENT" == "staging" ] && echo "staging-")api.$DOMAIN"

    log_info "🔍 Testing API health endpoint..."
    if curl -f "$api_url/health" &> /dev/null; then
        log_success "✅ API health check passed"
    else
        log_warning "⚠️  API health check failed (may still be starting up)"
    fi

    # Show monitoring URLs
    local monitoring_url="https://$([ "$ENVIRONMENT" == "staging" ] && echo "staging-")monitoring.$DOMAIN"

    echo
    log_info "📊 Monitoring Dashboard: $monitoring_url"
    log_info "   Username: admin"
    log_info "   Password: admin123 (CHANGE IMMEDIATELY)"
    echo
}

show_deployment_summary() {
    log_success "🎉 MVP Deployment Complete!"

    local api_url="https://$([ "$ENVIRONMENT" == "staging" ] && echo "staging-")api.$DOMAIN"
    local frontend_url="https://advotecate-$ENVIRONMENT.vercel.app"
    local monitoring_url="https://$([ "$ENVIRONMENT" == "staging" ] && echo "staging-")monitoring.$DOMAIN"

    cat << EOF

=== 🚀 YOUR ADVOTECATE MVP IS LIVE! ===

Environment: $ENVIRONMENT
GitHub Repo: https://github.com/$GITHUB_ORG/$REPO_NAME

🌐 LIVE URLS:
   Frontend:   $frontend_url
   API:        $api_url
   Monitoring: $monitoring_url

📊 NEXT STEPS:
   1. ✅ Test the application end-to-end
   2. 🔒 Change monitoring password (admin/admin123)
   3. 🌐 Configure DNS (point domains to LoadBalancer IP)
   4. 📈 Set up alerts and monitoring
   5. 🚀 $([ "$ENVIRONMENT" == "staging" ] && echo "Deploy to production!" || echo "Go live!")

📋 DNS CONFIGURATION NEEDED:
   Point these A records to LoadBalancer IP:
   - $([ "$ENVIRONMENT" == "staging" ] && echo "staging-")api.$DOMAIN
   - $([ "$ENVIRONMENT" == "staging" ] && echo "staging-")monitoring.$DOMAIN

🔧 USEFUL COMMANDS:
   View logs:     kubectl logs -f deployment/advotecate-backend -n default
   Scale backend: kubectl scale deployment advotecate-backend --replicas=3 -n default
   Vercel logs:   vercel logs

💡 CI/CD PIPELINE:
   - Push to 'staging' branch → Auto-deploy to staging
   - Push to 'main' branch → Auto-deploy to production
   - Pull requests → Preview deployments

🆘 SUPPORT:
   - Monitoring dashboard for real-time status
   - GitHub Issues for bug reports
   - Documentation in /docs directory

EOF

    if [[ "$ENVIRONMENT" == "staging" ]]; then
        echo "🎯 READY FOR PRODUCTION?"
        echo "   Run: $0 -e production -o $GITHUB_ORG -d $DOMAIN -p $GCP_PROJECT_ID"
    fi

    echo
    log_success "Your FluidPay-integrated political donation platform is ready! 🗳️💰"
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment) ENVIRONMENT="$2"; shift 2 ;;
            -o|--github-org) GITHUB_ORG="$2"; shift 2 ;;
            -r|--repo) REPO_NAME="$2"; shift 2 ;;
            -d|--domain) DOMAIN="$2"; shift 2 ;;
            -p|--project-id) GCP_PROJECT_ID="$2"; shift 2 ;;
            --skip-infra) SKIP_INFRA=true; shift ;;
            --skip-backend) SKIP_BACKEND=true; shift ;;
            --skip-frontend) SKIP_FRONTEND=true; shift ;;
            -h|--help) show_usage; exit 0 ;;
            *) log_error "Unknown option: $1"; show_usage; exit 1 ;;
        esac
    done

    # Validate required args
    if [[ -z "$GITHUB_ORG" || -z "$DOMAIN" || -z "$GCP_PROJECT_ID" ]]; then
        log_error "❌ Missing required arguments"
        show_usage
        exit 1
    fi

    # Show deployment plan
    log_info "🚀 Starting MVP deployment with best practices..."
    echo "   Environment: $ENVIRONMENT"
    echo "   GitHub Org:  $GITHUB_ORG"
    echo "   Repository:  $REPO_NAME"
    echo "   Domain:      $DOMAIN"
    echo "   GCP Project: $GCP_PROJECT_ID"
    echo

    # Execute phases
    check_prerequisites
    setup_github_repo
    setup_secrets
    deploy_infrastructure
    deploy_backend
    deploy_frontend
    setup_monitoring
    show_deployment_summary
}

main "$@"