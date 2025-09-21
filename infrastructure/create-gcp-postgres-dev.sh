#!/bin/bash
set -e

echo "🗄️ Creating PostgreSQL Database on GCP (Dev Environment)"
echo "========================================================"

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

echo "🔧 Step 1: Creating Cloud SQL PostgreSQL instance..."

# Create Cloud SQL instance with private IP only (no public IP to avoid org policy)
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
  --network=default \
  --project=$PROJECT_ID || {
    echo "⚠️  Instance creation failed, checking if it already exists..."
    if gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID >/dev/null 2>&1; then
        echo "✅ Instance $DB_INSTANCE_NAME already exists, continuing..."
    else
        echo "❌ Failed to create instance and it doesn't exist. Exiting."
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
DB_IP=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)" || echo "Private IP only")

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
echo "🔗 Connection String (for Cloud Run/GKE):"
echo "postgresql://$DB_USER:[PASSWORD]@/$DB_NAME?host=/cloudsql/$DB_CONNECTION_NAME"
echo ""
echo "📥 To get password:"
echo "gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID"
echo ""
echo "🚀 Next: Apply the payments schema to this database"