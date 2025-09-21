#!/bin/bash
set -e

echo "🗄️ Creating Simple PostgreSQL Database on GCP"
echo "=============================================="

PROJECT_ID="advotecate-dev"
REGION="us-central1"
DB_INSTANCE_NAME="advotecate-dev-postgres"
DB_NAME="advotecate_payments_dev"
DB_USER="advotecate_app_dev"

# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check current gcloud config
echo "🔍 Checking gcloud configuration..."
gcloud config list --format="table(section,property,value)"
echo ""

# First, let's enable required APIs
echo "🔧 Step 1: Enabling required APIs..."
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
gcloud services enable compute.googleapis.com --project=$PROJECT_ID
echo ""

echo "🔧 Step 2: Creating minimal Cloud SQL PostgreSQL instance..."

# Try the simplest possible configuration first
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet || {
    echo "⚠️  Instance creation failed, checking if it already exists..."
    if gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID >/dev/null 2>&1; then
        echo "✅ Instance $DB_INSTANCE_NAME already exists, continuing..."
    else
        echo "❌ Instance creation failed. Let's check what instances exist:"
        gcloud sql instances list --project=$PROJECT_ID
        echo ""
        echo "❌ Available tiers in region:"
        gcloud sql tiers list --filter="region:$REGION"
        exit 1
    fi
}

echo "🔐 Step 3: Creating application user..."
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE_NAME \
  --password="$DB_PASSWORD" \
  --project=$PROJECT_ID || echo "⚠️  User may already exist, continuing..."

echo "📊 Step 4: Creating payments database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME \
  --project=$PROJECT_ID || echo "⚠️  Database may already exist, continuing..."

echo "🔒 Step 5: Storing credentials in Secret Manager..."
echo -n "$DB_PASSWORD" | gcloud secrets create advotecate-dev-db-password \
  --data-file=- \
  --project=$PROJECT_ID || \
gcloud secrets versions add advotecate-dev-db-password \
  --data-file=<(echo -n "$DB_PASSWORD") \
  --project=$PROJECT_ID

echo "🌐 Step 6: Getting connection information..."
DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName)")
DB_IP=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)" || echo "No public IP")

echo ""
echo "✅ PostgreSQL database created successfully on GCP!"
echo "=================================================="
echo "Connection Details:"
echo "  Instance Name: $DB_INSTANCE_NAME"
echo "  Connection Name: $DB_CONNECTION_NAME"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: Stored in Secret Manager 'advotecate-dev-db-password'"
echo "  IP Address: $DB_IP"
echo ""
echo "🔗 Connection String:"
echo "postgresql://$DB_USER:[PASSWORD]@/$DB_NAME?host=/cloudsql/$DB_CONNECTION_NAME"
echo ""
echo "📥 To get password:"
echo "gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID"
echo ""
echo "🚀 Next: Apply the payments schema using Cloud SQL Proxy"