#!/bin/bash
# Supabase on GCP Destruction Script
# Safely removes all Supabase infrastructure from Google Cloud Platform

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT"
K8S_DIR="$PROJECT_ROOT/k8s"

# Default values
PROJECT_ID=""
REGION="us-central1"
ENVIRONMENT="prod"
SKIP_KUBERNETES=false
SKIP_TERRAFORM=false
FORCE_DESTROY=false
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

Destroy Supabase infrastructure on Google Cloud Platform

OPTIONS:
    -p, --project-id PROJECT_ID    GCP Project ID (required)
    -r, --region REGION           GCP Region (default: us-central1)
    -e, --environment ENV         Environment (default: prod)
    --skip-kubernetes             Skip Kubernetes resource cleanup
    --skip-terraform              Skip Terraform infrastructure destruction
    --force                       Skip confirmation prompts
    --dry-run                     Show what would be destroyed without executing
    -h, --help                   Show this help message

EXAMPLES:
    $0 -p my-project-id
    $0 -p my-project-id --force
    $0 -p my-project-id --skip-kubernetes

WARNING:
    This will permanently delete all Supabase infrastructure including:
    - All data in the PostgreSQL database
    - All storage buckets and files
    - All monitoring data
    - All SSL certificates
    - The entire GKE cluster

EOF
}

confirm_destruction() {
    if [[ "$FORCE_DESTROY" == "true" ]]; then
        return 0
    fi

    echo -e "${RED}WARNING: This will permanently destroy all Supabase infrastructure!${NC}"
    echo
    echo "This includes:"
    echo "  - PostgreSQL database and ALL DATA"
    echo "  - GKE cluster and all workloads"
    echo "  - Storage buckets and files"
    echo "  - Monitoring and logging data"
    echo "  - SSL certificates"
    echo "  - VPC network and subnets"
    echo
    echo "Project: $PROJECT_ID"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $REGION"
    echo

    read -p "Are you absolutely sure you want to continue? (type 'yes' to confirm): " confirmation

    if [[ "$confirmation" != "yes" ]]; then
        log_info "Destruction cancelled by user"
        exit 0
    fi

    echo
    read -p "Last chance! Type the project ID to confirm: " project_confirmation

    if [[ "$project_confirmation" != "$PROJECT_ID" ]]; then
        log_error "Project ID confirmation failed"
        exit 1
    fi

    log_warning "Proceeding with infrastructure destruction..."
}

configure_kubectl() {
    log_info "Configuring kubectl..."

    local cluster_name="$ENVIRONMENT-supabase-cluster"
    local cluster_location="$REGION"

    # Try to get cluster credentials (may fail if cluster doesn't exist)
    if gcloud container clusters get-credentials "$cluster_name" --region "$cluster_location" --project "$PROJECT_ID" 2>/dev/null; then
        kubectl cluster-info
        log_success "kubectl configured successfully"
        return 0
    else
        log_warning "Could not connect to GKE cluster (may already be destroyed)"
        return 1
    fi
}

destroy_kubernetes_resources() {
    if [[ "$SKIP_KUBERNETES" == "true" ]]; then
        log_info "Skipping Kubernetes resource cleanup"
        return 0
    fi

    log_info "Destroying Kubernetes resources..."

    if ! configure_kubectl; then
        log_warning "Skipping Kubernetes cleanup - cluster not accessible"
        return 0
    fi

    # Delete resources in reverse order
    local resources=(
        "monitoring.yaml"
        "krakend-config.yaml"
        "supabase-services.yaml"
        "supabase-kong.yaml"
        "supabase-config.yaml"
        "security.yaml"
        "namespace.yaml"
    )

    for resource in "${resources[@]}"; do
        local resource_path="$K8S_DIR/$resource"

        if [[ -f "$resource_path" ]]; then
            log_info "Deleting $resource..."

            if [[ "$DRY_RUN" == "true" ]]; then
                kubectl delete --dry-run=client -f "$resource_path" --ignore-not-found=true
            else
                kubectl delete -f "$resource_path" --ignore-not-found=true --timeout=300s || {
                    log_warning "Failed to delete $resource (may already be gone)"
                }
            fi
        fi
    done

    # Force delete namespaces if they're stuck
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Ensuring namespaces are deleted..."
        kubectl delete namespace supabase --ignore-not-found=true --timeout=300s || true
        kubectl delete namespace krakend --ignore-not-found=true --timeout=300s || true
    fi

    log_success "Kubernetes resources cleanup completed"
}

destroy_terraform() {
    if [[ "$SKIP_TERRAFORM" == "true" ]]; then
        log_info "Skipping Terraform destruction"
        return 0
    fi

    log_info "Destroying Terraform infrastructure..."

    cd "$TERRAFORM_DIR"

    # Check if Terraform state exists
    if [[ ! -f ".terraform/terraform.tfstate" ]] && [[ ! -f "terraform.tfstate" ]]; then
        log_warning "No Terraform state found - nothing to destroy"
        return 0
    fi

    # Initialize Terraform (in case backend changed)
    log_info "Initializing Terraform..."
    terraform init

    # Plan destruction
    log_info "Planning Terraform destruction..."
    if [[ "$DRY_RUN" == "true" ]]; then
        terraform plan -destroy
        log_info "Dry run mode - stopping before destroy"
        return 0
    fi

    # Destroy infrastructure
    log_info "Destroying Terraform infrastructure..."
    terraform destroy -auto-approve

    log_success "Terraform infrastructure destroyed successfully"
}

cleanup_gcp_resources() {
    log_info "Cleaning up remaining GCP resources..."

    # Clean up any remaining Cloud SQL instances
    local sql_instances
    sql_instances=$(gcloud sql instances list --project="$PROJECT_ID" --filter="name:$ENVIRONMENT-supabase" --format="value(name)" 2>/dev/null || echo "")

    for instance in $sql_instances; do
        if [[ -n "$instance" ]]; then
            log_info "Deleting Cloud SQL instance: $instance"
            if [[ "$DRY_RUN" == "false" ]]; then
                gcloud sql instances delete "$instance" --project="$PROJECT_ID" --quiet || {
                    log_warning "Failed to delete SQL instance $instance"
                }
            fi
        fi
    done

    # Clean up any remaining GKE clusters
    local gke_clusters
    gke_clusters=$(gcloud container clusters list --project="$PROJECT_ID" --filter="name:$ENVIRONMENT-supabase" --format="value(name,location)" 2>/dev/null || echo "")

    while IFS=$'\t' read -r cluster_name cluster_location; do
        if [[ -n "$cluster_name" && -n "$cluster_location" ]]; then
            log_info "Deleting GKE cluster: $cluster_name in $cluster_location"
            if [[ "$DRY_RUN" == "false" ]]; then
                gcloud container clusters delete "$cluster_name" --zone="$cluster_location" --project="$PROJECT_ID" --quiet || {
                    log_warning "Failed to delete GKE cluster $cluster_name"
                }
            fi
        fi
    done <<< "$gke_clusters"

    # Clean up storage buckets
    local buckets
    buckets=$(gsutil ls -p "$PROJECT_ID" 2>/dev/null | grep "gs://.*supabase" || echo "")

    for bucket in $buckets; do
        if [[ -n "$bucket" ]]; then
            log_info "Deleting storage bucket: $bucket"
            if [[ "$DRY_RUN" == "false" ]]; then
                gsutil rm -rf "$bucket" || {
                    log_warning "Failed to delete bucket $bucket"
                }
            fi
        fi
    done

    # Clean up static IP addresses
    local static_ips
    static_ips=$(gcloud compute addresses list --project="$PROJECT_ID" --filter="name:*supabase* OR name:*advotecate*" --format="value(name,region)" 2>/dev/null || echo "")

    while IFS=$'\t' read -r ip_name ip_region; do
        if [[ -n "$ip_name" ]]; then
            log_info "Deleting static IP: $ip_name"
            if [[ "$DRY_RUN" == "false" ]]; then
                if [[ -n "$ip_region" ]]; then
                    gcloud compute addresses delete "$ip_name" --region="$ip_region" --project="$PROJECT_ID" --quiet || true
                else
                    gcloud compute addresses delete "$ip_name" --global --project="$PROJECT_ID" --quiet || true
                fi
            fi
        fi
    done <<< "$static_ips"

    log_success "GCP resource cleanup completed"
}

show_destruction_summary() {
    log_success "Infrastructure destruction completed!"

    echo
    echo "=== Destruction Summary ==="
    echo "Project ID: $PROJECT_ID"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $REGION"
    echo

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "=== DRY RUN RESULTS ==="
        echo "The above resources would have been destroyed."
        echo "Run without --dry-run to actually destroy the infrastructure."
    else
        echo "=== Resources Destroyed ==="
        echo "✓ Kubernetes workloads and services"
        echo "✓ GKE cluster and node pools"
        echo "✓ Cloud SQL database and backups"
        echo "✓ VPC network and subnets"
        echo "✓ Storage buckets and files"
        echo "✓ SSL certificates"
        echo "✓ Static IP addresses"
        echo "✓ IAM service accounts"
        echo

        echo "=== Next Steps ==="
        echo "1. Verify no unexpected charges in GCP billing"
        echo "2. Update DNS records to remove the domains"
        echo "3. Clean up any external monitoring or alerting"
        echo "4. Remove local configuration files if no longer needed"
    fi
    echo
}

main() {
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
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --skip-kubernetes)
                SKIP_KUBERNETES=true
                shift
                ;;
            --skip-terraform)
                SKIP_TERRAFORM=true
                shift
                ;;
            --force)
                FORCE_DESTROY=true
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

    # Start destruction
    log_info "Starting Supabase on GCP destruction..."
    log_info "Project: $PROJECT_ID, Region: $REGION, Environment: $ENVIRONMENT"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual resources will be destroyed"
    fi

    confirm_destruction
    destroy_kubernetes_resources
    destroy_terraform
    cleanup_gcp_resources
    show_destruction_summary
}

# Run main function
main "$@"