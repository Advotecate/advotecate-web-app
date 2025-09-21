#!/bin/bash
# Advotecate Frontend Vercel Deployment Script
# Deploys React/Next.js frontend to Vercel

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

# Default values
ENVIRONMENT="production"
PROJECT_NAME="advotecate-frontend"
TEAM=""
API_URL="https://api.advotecate.com"
SUPABASE_URL="https://api.advotecate.com"
DRY_RUN=false
AUTO_CONFIRM=false

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

Deploy Advotecate frontend to Vercel

OPTIONS:
    -e, --environment ENV         Environment (production, preview, development) (default: production)
    -p, --project PROJECT_NAME    Vercel project name (default: advotecate-frontend)
    -t, --team TEAM_SLUG         Vercel team slug (optional)
    -a, --api-url URL            Backend API URL (default: https://api.advotecate.com)
    -s, --supabase-url URL       Supabase URL (default: https://api.advotecate.com)
    -y, --yes                    Auto-confirm all prompts
    --dry-run                    Show what would be deployed without executing
    -h, --help                   Show this help message

EXAMPLES:
    $0
    $0 -e preview -p advotecate-staging
    $0 -t my-team -a https://staging-api.advotecate.com

REQUIREMENTS:
    - Vercel CLI installed (npm install -g vercel)
    - Authenticated with Vercel (vercel login)
    - Frontend directory with valid package.json

ENVIRONMENT VARIABLES:
    Set these in Vercel dashboard or via CLI:
    - NEXT_PUBLIC_API_URL
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY

EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        missing_tools+=("vercel (npm install -g vercel)")
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_tools+=("node.js")
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools:"
        printf '%s\n' "${missing_tools[@]}"
        exit 1
    fi

    # Check if logged in to Vercel
    if ! vercel whoami &> /dev/null; then
        log_error "Not authenticated with Vercel"
        log_info "Please run: vercel login"
        exit 1
    fi

    # Check if frontend directory exists
    if [[ ! -d "$PROJECT_ROOT/frontend" ]]; then
        log_warning "Frontend directory not found at $PROJECT_ROOT/frontend"
        log_info "Creating example frontend structure..."
        create_frontend_structure
    fi

    log_success "All prerequisites satisfied"
}

create_frontend_structure() {
    log_info "Creating frontend directory structure..."

    mkdir -p "$PROJECT_ROOT/frontend/src"
    mkdir -p "$PROJECT_ROOT/frontend/public"

    # Create basic package.json if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/frontend/package.json" ]]; then
        cat > "$PROJECT_ROOT/frontend/package.json" << 'EOF'
{
  "name": "advotecate-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "eslint": "^8.55.0",
    "eslint-config-next": "^14.0.0",
    "typescript": "^5.3.0"
  }
}
EOF
        log_info "Created frontend/package.json"
    fi

    # Create basic Next.js configuration
    if [[ ! -f "$PROJECT_ROOT/frontend/next.config.js" ]]; then
        cat > "$PROJECT_ROOT/frontend/next.config.js" << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
EOF
        log_info "Created frontend/next.config.js"
    fi

    # Create basic TypeScript configuration
    if [[ ! -f "$PROJECT_ROOT/frontend/tsconfig.json" ]]; then
        cat > "$PROJECT_ROOT/frontend/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
        log_info "Created frontend/tsconfig.json"
    fi

    # Create basic index page if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/frontend/src/pages/index.tsx" ]]; then
        mkdir -p "$PROJECT_ROOT/frontend/src/pages"
        cat > "$PROJECT_ROOT/frontend/src/pages/index.tsx" << 'EOF'
import { useEffect, useState } from 'react';

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>('checking...');

  useEffect(() => {
    // Test API connection
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then(res => res.json())
      .then(data => setApiStatus(data.status || 'connected'))
      .catch(() => setApiStatus('disconnected'));
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to Advotecate</h1>
      <p>Political donation platform</p>
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>System Status</h3>
        <p>API Status: <strong style={{ color: apiStatus === 'healthy' ? 'green' : 'red' }}>{apiStatus}</strong></p>
        <p>API URL: {process.env.NEXT_PUBLIC_API_URL}</p>
      </div>
    </div>
  );
}
EOF
        log_info "Created basic frontend/src/pages/index.tsx"
    fi

    log_success "Frontend structure created"
}

setup_environment_variables() {
    log_info "Setting up environment variables..."

    # Define environment variables
    local env_vars=(
        "NEXT_PUBLIC_API_URL=$API_URL"
        "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
        "NEXT_PUBLIC_APP_URL=https://${PROJECT_NAME}.vercel.app"
    )

    # Add optional environment variables with prompts
    local supabase_anon_key=""
    local fluidpay_public_key=""

    if [[ "$AUTO_CONFIRM" == "false" ]]; then
        echo
        read -p "Enter Supabase Anon Key (optional): " supabase_anon_key
        read -p "Enter FluidPay Public Key (optional): " fluidpay_public_key
    fi

    if [[ -n "$supabase_anon_key" ]]; then
        env_vars+=("NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_anon_key")
    fi

    if [[ -n "$fluidpay_public_key" ]]; then
        env_vars+=("NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY=$fluidpay_public_key")
    fi

    # Set environment variables in Vercel
    local team_flag=""
    if [[ -n "$TEAM" ]]; then
        team_flag="--scope $TEAM"
    fi

    if [[ "$DRY_RUN" == "false" ]]; then
        for env_var in "${env_vars[@]}"; do
            local key="${env_var%%=*}"
            local value="${env_var#*=}"

            if [[ -n "$value" ]]; then
                log_info "Setting environment variable: $key"
                vercel env add "$key" "$ENVIRONMENT" $team_flag <<< "$value" || {
                    log_warning "Failed to set $key (may already exist)"
                }
            fi
        done
    else
        log_info "Dry run mode - would set these environment variables:"
        printf '%s\n' "${env_vars[@]}"
    fi

    log_success "Environment variables configured"
}

install_dependencies() {
    log_info "Installing frontend dependencies..."

    cd "$PROJECT_ROOT/frontend"

    if [[ "$DRY_RUN" == "false" ]]; then
        npm install
    else
        log_info "Dry run mode - would run: npm install"
    fi

    cd "$PROJECT_ROOT"

    log_success "Dependencies installed"
}

build_frontend() {
    log_info "Building frontend..."

    cd "$PROJECT_ROOT/frontend"

    if [[ "$DRY_RUN" == "false" ]]; then
        # Set build environment variables
        export NEXT_PUBLIC_API_URL="$API_URL"
        export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"

        npm run build
    else
        log_info "Dry run mode - would run: npm run build"
    fi

    cd "$PROJECT_ROOT"

    log_success "Frontend built successfully"
}

deploy_to_vercel() {
    log_info "Deploying to Vercel..."

    cd "$PROJECT_ROOT"

    local deploy_args=()
    local team_flag=""

    if [[ -n "$TEAM" ]]; then
        team_flag="--scope $TEAM"
        deploy_args+=("$team_flag")
    fi

    # Set deployment target
    case "$ENVIRONMENT" in
        "production")
            deploy_args+=("--prod")
            ;;
        "preview"|"staging")
            deploy_args+=("--target preview")
            ;;
        "development")
            deploy_args+=("--target development")
            ;;
    esac

    # Auto-confirm if specified
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        deploy_args+=("--yes")
    fi

    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Running: vercel ${deploy_args[*]}"
        vercel "${deploy_args[@]}"
    else
        log_info "Dry run mode - would run: vercel ${deploy_args[*]}"
    fi

    log_success "Deployment completed"
}

show_deployment_info() {
    log_success "Frontend deployment completed successfully!"

    echo
    echo "=== Deployment Information ==="
    echo "Project: $PROJECT_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "API URL: $API_URL"
    echo "Supabase URL: $SUPABASE_URL"
    echo

    if [[ "$DRY_RUN" == "false" ]]; then
        echo "=== Deployment URLs ==="
        local base_url
        case "$ENVIRONMENT" in
            "production")
                base_url="https://${PROJECT_NAME}.vercel.app"
                ;;
            *)
                base_url="https://${PROJECT_NAME}-git-${ENVIRONMENT}.vercel.app"
                ;;
        esac

        echo "Frontend URL: $base_url"
        echo

        # Try to get actual deployment URL from Vercel
        if command -v vercel &> /dev/null; then
            echo "=== Recent Deployments ==="
            vercel list --limit 3 2>/dev/null || echo "Run 'vercel list' to see deployments"
        fi
    fi

    echo
    echo "=== Useful Commands ==="
    echo "View deployments: vercel list"
    echo "View logs: vercel logs"
    echo "Open dashboard: vercel"
    echo "Set environment variable: vercel env add KEY"
    echo "Remove deployment: vercel remove PROJECT_NAME"
    echo

    echo "=== Next Steps ==="
    echo "1. Verify the deployment is working correctly"
    echo "2. Test API connectivity from the frontend"
    echo "3. Configure custom domain (if needed)"
    echo "4. Set up monitoring and error tracking"
    echo "5. Configure analytics and performance monitoring"
    echo
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -p|--project)
                PROJECT_NAME="$2"
                shift 2
                ;;
            -t|--team)
                TEAM="$2"
                shift 2
                ;;
            -a|--api-url)
                API_URL="$2"
                shift 2
                ;;
            -s|--supabase-url)
                SUPABASE_URL="$2"
                shift 2
                ;;
            -y|--yes)
                AUTO_CONFIRM=true
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

    # Start deployment
    log_info "Starting Advotecate frontend deployment to Vercel..."
    log_info "Project: $PROJECT_NAME, Environment: $ENVIRONMENT"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual deployment will occur"
    fi

    check_prerequisites
    setup_environment_variables
    install_dependencies
    build_frontend
    deploy_to_vercel
    show_deployment_info
}

# Run main function
main "$@"