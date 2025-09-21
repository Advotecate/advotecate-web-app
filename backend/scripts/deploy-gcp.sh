#!/bin/bash
# Advotecate Backend GCP Deployment Script
# Deploys Node.js backend to Google Kubernetes Engine

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_ROOT")"

# Default values
PROJECT_ID=""
REGION="us-central1"
CLUSTER_NAME="prod-supabase-cluster"
NAMESPACE="default"
IMAGE_TAG="latest"
SKIP_BUILD=false
SKIP_DEPLOY=false
DRY_RUN=false

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Advotecate backend to Google Kubernetes Engine

OPTIONS:
    -p, --project-id PROJECT_ID    GCP Project ID (required)
    -r, --region REGION           GCP Region (default: us-central1)
    -c, --cluster CLUSTER_NAME    GKE cluster name (default: prod-supabase-cluster)
    -n, --namespace NAMESPACE     Kubernetes namespace (default: default)
    -t, --tag IMAGE_TAG          Docker image tag (default: latest)
    --skip-build                 Skip Docker image build
    --skip-deploy                Skip Kubernetes deployment
    --dry-run                    Show what would be deployed without executing
    -h, --help                   Show this help message

EXAMPLES:
    $0 -p my-project-id
    $0 -p my-project-id -c staging-cluster -t v1.2.3
    $0 -p my-project-id --skip-build

REQUIREMENTS:
    - Google Cloud SDK (gcloud) installed and authenticated
    - Docker installed
    - kubectl installed
    - GKE cluster already deployed

EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi

    # Check docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again."
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

validate_gcp_auth() {
    log_info "Validating GCP authentication..."

    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        log_error "No active GCP authentication found"
        log_info "Please run: gcloud auth login"
        exit 1
    fi

    # Set project
    gcloud config set project "$PROJECT_ID"

    # Verify project exists and we have access
    if ! gcloud projects describe "$PROJECT_ID" &> /dev/null; then
        log_error "Cannot access project $PROJECT_ID"
        log_info "Please verify the project ID and your permissions"
        exit 1
    fi

    log_success "GCP authentication validated for project $PROJECT_ID"
}

configure_docker() {
    log_info "Configuring Docker for Container Registry..."

    # Configure Docker to use gcloud as a credential helper
    gcloud auth configure-docker --quiet

    log_success "Docker configured for Container Registry"
}

build_docker_image() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping Docker image build"
        return 0
    fi

    log_info "Building Docker image..."

    cd "$BACKEND_ROOT"

    # Build image with multiple tags
    local image_name="gcr.io/$PROJECT_ID/advotecate-backend"
    local commit_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    log_info "Building image: $image_name:$IMAGE_TAG"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would build: $image_name:$IMAGE_TAG"
        return 0
    fi

    docker build \
        -f Dockerfile.prod \
        -t "$image_name:$IMAGE_TAG" \
        -t "$image_name:$commit_sha" \
        -t "$image_name:latest" \
        .

    log_success "Docker image built successfully"
}

push_docker_image() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping Docker image push"
        return 0
    fi

    log_info "Pushing Docker image to Container Registry..."

    local image_name="gcr.io/$PROJECT_ID/advotecate-backend"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would push: $image_name:$IMAGE_TAG"
        return 0
    fi

    docker push "$image_name:$IMAGE_TAG"
    docker push "$image_name:latest"

    log_success "Docker image pushed successfully"
}

configure_kubectl() {
    log_info "Configuring kubectl..."

    # Get cluster credentials
    gcloud container clusters get-credentials "$CLUSTER_NAME" --region "$REGION" --project "$PROJECT_ID"

    # Verify connectivity
    kubectl cluster-info

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    log_success "kubectl configured successfully"
}

create_secrets() {
    log_info "Creating Kubernetes secrets..."

    # Check if secrets already exist
    if kubectl get secret backend-secrets -n "$NAMESPACE" &> /dev/null; then
        log_warning "Secret 'backend-secrets' already exists. Skipping creation."
        log_info "To update secrets, delete the existing secret first:"
        log_info "kubectl delete secret backend-secrets -n $NAMESPACE"
        return 0
    fi

    # Create secrets from environment variables or prompt
    cat << 'EOF' > /tmp/backend-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: NAMESPACE_PLACEHOLDER
type: Opaque
stringData:
  DATABASE_URL: "DATABASE_URL_PLACEHOLDER"
  SUPABASE_URL: "SUPABASE_URL_PLACEHOLDER"
  SUPABASE_SERVICE_KEY: "SUPABASE_SERVICE_KEY_PLACEHOLDER"
  FLUIDPAY_API_KEY: "FLUIDPAY_API_KEY_PLACEHOLDER"
  FLUIDPAY_API_SECRET: "FLUIDPAY_API_SECRET_PLACEHOLDER"
  FLUIDPAY_WEBHOOK_SECRET: "FLUIDPAY_WEBHOOK_SECRET_PLACEHOLDER"
  JWT_SECRET: "JWT_SECRET_PLACEHOLDER"
EOF

    # Replace namespace
    sed -i.bak "s/NAMESPACE_PLACEHOLDER/$NAMESPACE/g" /tmp/backend-secrets.yaml

    log_warning "Secret template created at /tmp/backend-secrets.yaml"
    log_info "Please edit the file with your actual secret values, then run:"
    log_info "kubectl apply -f /tmp/backend-secrets.yaml"
    log_info "After creating secrets, re-run this script to continue deployment"

    # Clean up
    rm -f /tmp/backend-secrets.yaml.bak

    exit 0
}

update_deployment_manifest() {
    log_info "Updating deployment manifest..."

    local manifest_file="$BACKEND_ROOT/gcp-deploy.yaml"
    local temp_manifest="/tmp/gcp-deploy-updated.yaml"

    # Copy original manifest
    cp "$manifest_file" "$temp_manifest"

    # Update placeholders
    sed -i.bak \
        -e "s/PROJECT_ID_PLACEHOLDER/$PROJECT_ID/g" \
        -e "s/IMAGE_TAG_PLACEHOLDER/$IMAGE_TAG/g" \
        -e "s/NAMESPACE_PLACEHOLDER/$NAMESPACE/g" \
        "$temp_manifest"

    # Clean up backup
    rm -f "$temp_manifest.bak"

    echo "$temp_manifest"
}

deploy_to_kubernetes() {
    if [[ "$SKIP_DEPLOY" == "true" ]]; then
        log_info "Skipping Kubernetes deployment"
        return 0
    fi

    log_info "Deploying to Kubernetes..."

    # Update deployment manifest
    local updated_manifest
    updated_manifest=$(update_deployment_manifest)

    # Apply manifest
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - would apply:"
        kubectl apply --dry-run=client -f "$updated_manifest"
    else
        kubectl apply -f "$updated_manifest"

        # Wait for deployment to be ready
        log_info "Waiting for deployment to be ready..."
        kubectl rollout status deployment/advotecate-backend -n "$NAMESPACE" --timeout=600s

        # Show deployment status
        kubectl get deployment,pods,svc -n "$NAMESPACE" -l app=advotecate-backend
    fi

    # Clean up temp file
    rm -f "$updated_manifest"

    log_success "Kubernetes deployment completed"
}

test_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - skipping deployment test"
        return 0
    fi

    log_info "Testing deployment..."

    # Get service info
    local service_ip
    service_ip=$(kubectl get svc advotecate-backend -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')

    if [[ -n "$service_ip" ]]; then
        log_info "Service IP: $service_ip"

        # Test health endpoint from within cluster
        kubectl run test-backend --image=curlimages/curl:latest --rm -i --restart=Never -- \
            curl -f "http://advotecate-backend.$NAMESPACE.svc.cluster.local:3000/health" || {
            log_warning "Health check failed - this might be expected if the service is still starting"
        }
    fi

    # Show logs
    log_info "Recent logs from backend pods:"
    kubectl logs -l app=advotecate-backend -n "$NAMESPACE" --tail=20

    log_success "Deployment test completed"
}

show_deployment_info() {
    log_success "Backend deployment completed successfully!"

    echo
    echo "=== Deployment Information ==="
    echo "Project ID: $PROJECT_ID"
    echo "Region: $REGION"
    echo "Cluster: $CLUSTER_NAME"
    echo "Namespace: $NAMESPACE"
    echo "Image: gcr.io/$PROJECT_ID/advotecate-backend:$IMAGE_TAG"
    echo

    if [[ "$DRY_RUN" == "false" ]]; then
        echo "=== Service Details ==="
        kubectl get deployment,svc,hpa -n "$NAMESPACE" -l app=advotecate-backend
        echo

        echo "=== Pod Status ==="
        kubectl get pods -n "$NAMESPACE" -l app=advotecate-backend
        echo

        # Get service endpoint
        local cluster_ip
        cluster_ip=$(kubectl get svc advotecate-backend -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

        if [[ -n "$cluster_ip" ]]; then
            echo "=== Service Endpoint ==="
            echo "Internal URL: http://advotecate-backend.$NAMESPACE.svc.cluster.local:3000"
            echo "Cluster IP: $cluster_ip:3000"
            echo
        fi
    fi

    echo "=== Useful Commands ==="
    echo "View logs: kubectl logs -f deployment/advotecate-backend -n $NAMESPACE"
    echo "Scale deployment: kubectl scale deployment advotecate-backend --replicas=N -n $NAMESPACE"
    echo "Port forward: kubectl port-forward svc/advotecate-backend 3000:3000 -n $NAMESPACE"
    echo "Delete deployment: kubectl delete -f $BACKEND_ROOT/gcp-deploy.yaml"
    echo

    echo "=== Next Steps ==="
    echo "1. Update KrakenD configuration to route to this backend service"
    echo "2. Test API endpoints through the gateway"
    echo "3. Set up monitoring and alerting"
    echo "4. Configure SSL certificates for external access"
    echo
}

cleanup_on_exit() {
    if [[ $? -ne 0 ]]; then
        log_error "Deployment failed!"
        echo
        echo "=== Troubleshooting ==="
        echo "1. Check pod status: kubectl get pods -n $NAMESPACE"
        echo "2. Check logs: kubectl logs -l app=advotecate-backend -n $NAMESPACE"
        echo "3. Check events: kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
        echo "4. Check secrets: kubectl get secret backend-secrets -n $NAMESPACE"
        echo
    fi

    # Clean up temp files
    rm -f /tmp/gcp-deploy-updated.yaml /tmp/backend-secrets.yaml
}

main() {
    trap cleanup_on_exit EXIT

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -c|--cluster)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$PROJECT_ID" ]]; then
        log_error "Project ID is required"
        show_usage
        exit 1
    fi

    # Start deployment
    log_info "Starting Advotecate backend deployment to GCP..."
    log_info "Project: $PROJECT_ID, Cluster: $CLUSTER_NAME, Namespace: $NAMESPACE"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual resources will be created"
    fi

    check_prerequisites
    validate_gcp_auth
    configure_docker
    build_docker_image
    push_docker_image
    configure_kubectl

    # Check if secrets exist, create template if not
    if ! kubectl get secret backend-secrets -n "$NAMESPACE" &> /dev/null; then
        create_secrets
    fi

    deploy_to_kubernetes
    test_deployment
    show_deployment_info
}

# Run main function
main "$@"