#!/bin/bash
set -e

echo "🗄️ Deploying Simple PostgreSQL Database on GCP..."
echo "==================================================="

PROJECT_ID="advotecate-dev"
REGION="us-central1"
DB_INSTANCE_NAME="advotecate-dev-db"
DB_NAME="advotecate_payments_dev"

# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "📦 Creating Cloud SQL PostgreSQL instance (basic configuration)..."

# Create a basic Cloud SQL instance without VPC requirements
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=20GB \
  --backup \
  --authorized-networks=0.0.0.0/0 \
  --project=$PROJECT_ID || echo "Instance may already exist, continuing..."

echo "🔐 Setting postgres password..."
gcloud sql users set-password postgres \
  --instance=$DB_INSTANCE_NAME \
  --password="$DB_PASSWORD" \
  --project=$PROJECT_ID

echo "📊 Creating payments database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME \
  --project=$PROJECT_ID || echo "Database may already exist, continuing..."

echo "🔒 Storing credentials in Secret Manager..."
echo -n "$DB_PASSWORD" | gcloud secrets create advotecate-dev-db-password --data-file=- --project=$PROJECT_ID || \
gcloud secrets versions add advotecate-dev-db-password --data-file=<(echo -n "$DB_PASSWORD") --project=$PROJECT_ID

# Get the public IP (since we're not using VPC)
DB_IP=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")

echo ""
echo "✅ Database deployed successfully!"
echo "=================================="
echo "Instance Name: $DB_INSTANCE_NAME"
echo "Database Name: $DB_NAME"
echo "Public IP: $DB_IP"
echo "Username: postgres"
echo "Password: Stored in Secret Manager 'advotecate-dev-db-password'"
echo ""
echo "🔗 Connection String:"
echo "postgresql://postgres:[PASSWORD]@$DB_IP:5432/$DB_NAME"
echo ""
echo "📥 To get password:"
echo "gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID"
echo ""
echo "🚀 Next: Connect Supabase to this database"