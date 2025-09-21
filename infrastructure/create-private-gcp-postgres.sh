#!/bin/bash
set -e

echo "🗄️ Creating Private PostgreSQL Database on GCP"
echo "=============================================="

PROJECT_ID="advotecate-dev"
REGION="us-central1"
DB_INSTANCE_NAME="advotecate-dev-postgres"
DB_NAME="advotecate_payments_dev"
DB_USER="advotecate_app_dev"
VPC_NETWORK="staging-supabase-vpc"

# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  VPC Network: $VPC_NETWORK"
echo ""

echo "🔍 Checking existing VPC setup..."
gcloud compute networks describe $VPC_NETWORK --project=$PROJECT_ID

echo ""
echo "🔧 Step 1: Creating private Cloud SQL PostgreSQL instance..."

# Create Cloud SQL instance using the existing VPC network
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=20GB \
  --backup-start-time=02:00 \
  --maintenance-release-channel=production \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=06 \
  --no-assign-ip \
  --network="projects/$PROJECT_ID/global/networks/$VPC_NETWORK" \
  --project=$PROJECT_ID \
  --quiet || {
    echo "⚠️  Instance creation failed, checking if it already exists..."
    if gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID >/dev/null 2>&1; then
        echo "✅ Instance $DB_INSTANCE_NAME already exists, continuing..."
    else
        echo "❌ Failed to create instance. Checking service networking..."
        gcloud services list --enabled --filter="servicenetworking.googleapis.com" --project=$PROJECT_ID
        echo ""
        echo "❌ Checking private service connection..."
        gcloud services vpc-peerings list --network=$VPC_NETWORK --project=$PROJECT_ID
        exit 1
    fi
}

echo "🔐 Step 2: Creating application user..."
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE_NAME \
  --password="$DB_PASSWORD" \
  --project=$PROJECT_ID || echo "⚠️  User may already exist, continuing..."

echo "📊 Step 3: Creating payments database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME \
  --project=$PROJECT_ID || echo "⚠️  Database may already exist, continuing..."

echo "🔒 Step 4: Storing credentials in Secret Manager..."
echo -n "$DB_PASSWORD" | gcloud secrets create advotecate-dev-db-password \
  --data-file=- \
  --project=$PROJECT_ID || \
gcloud secrets versions add advotecate-dev-db-password \
  --data-file=<(echo -n "$DB_PASSWORD") \
  --project=$PROJECT_ID

echo "🌐 Step 5: Getting connection information..."
DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName)")
DB_IP=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")

echo ""
echo "✅ Private PostgreSQL database created successfully on GCP!"
echo "========================================================"
echo "Connection Details:"
echo "  Instance Name: $DB_INSTANCE_NAME"
echo "  Connection Name: $DB_CONNECTION_NAME"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: Stored in Secret Manager 'advotecate-dev-db-password'"
echo "  Private IP: $DB_IP"
echo "  VPC Network: $VPC_NETWORK"
echo ""
echo "🔗 Connection String (for Cloud Run/GKE):"
echo "postgresql://$DB_USER:[PASSWORD]@$DB_IP:5432/$DB_NAME"
echo ""
echo "📥 To get password:"
echo "gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID"
echo ""
echo "🚀 Next: Apply the payments schema using Cloud SQL Proxy or from a GKE pod"