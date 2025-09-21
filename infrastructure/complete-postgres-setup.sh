#!/bin/bash
set -e

echo "🔧 Completing PostgreSQL Database Setup"
echo "======================================="

PROJECT_ID="advotecate-dev"
DB_INSTANCE_NAME="advotecate-dev-postgres"
DB_NAME="advotecate_payments_dev"
DB_USER="advotecate_app_dev"

# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

echo "⏳ Step 1: Waiting for instance to be ready..."
while true; do
    STATUS=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
    if [ "$STATUS" = "RUNNABLE" ]; then
        echo "✅ Instance is ready!"
        break
    elif [ "$STATUS" = "NOT_FOUND" ]; then
        echo "❌ Instance not found. Please run create-private-gcp-postgres.sh first"
        exit 1
    else
        echo "⏳ Instance status: $STATUS - waiting..."
        sleep 30
    fi
done

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
echo "✅ PostgreSQL database setup complete on GCP!"
echo "=============================================="
echo "Connection Details:"
echo "  Instance Name: $DB_INSTANCE_NAME"
echo "  Connection Name: $DB_CONNECTION_NAME"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: Stored in Secret Manager 'advotecate-dev-db-password'"
echo "  Private IP: $DB_IP"
echo ""
echo "🔗 Connection String:"
echo "postgresql://$DB_USER:[PASSWORD]@$DB_IP:5432/$DB_NAME"
echo ""
echo "📥 To get password:"
echo "PASSWORD=\$(gcloud secrets versions access latest --secret='advotecate-dev-db-password' --project=$PROJECT_ID)"
echo ""
echo "🚀 Next: Apply payments schema to the database"
echo "Run: ./apply-payments-to-gcp.sh"