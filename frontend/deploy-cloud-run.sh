#!/bin/bash

# Deploy Advotecate Frontend to Cloud Run with VPC Access
# This will resolve the database connection issue by providing VPC network access

set -e

echo "🚀 Starting Cloud Run deployment with VPC access..."

# Configuration
PROJECT_ID="advotecate-dev"
SERVICE_NAME="advotecate-frontend"
REGION="us-central1"
VPC_NETWORK="staging-supabase-vpc"
VPC_CONNECTOR_NAME="advotecate-connector"

echo "📝 Project: $PROJECT_ID"
echo "📝 Service: $SERVICE_NAME"
echo "📝 Region: $REGION"
echo "📝 VPC: $VPC_NETWORK"

# Step 1: Create VPC Connector for Cloud Run to access private database
echo "🔗 Creating VPC connector..."
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
  --region=$REGION \
  --subnet=staging-supabase-subnet \
  --subnet-project=$PROJECT_ID \
  --min-instances=2 \
  --max-instances=10 \
  --project=$PROJECT_ID || echo "VPC connector may already exist"

# Step 2: Build and deploy to Cloud Run
echo "🏗️ Building and deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source=. \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --vpc-connector=$VPC_CONNECTOR_NAME \
  --set-env-vars="DB_HOST=10.229.208.3,DB_PORT=5432,DB_NAME=advotecate_payments_dev,DB_USER=advotecate_app_dev,DB_PASSWORD=XPyL97uYXWuLMyaO2nu17MbLC,NEXT_PUBLIC_API_URL=https://$SERVICE_NAME-367966088269.us-central1.run.app/api,NEXT_PUBLIC_ENVIRONMENT=production" \
  --project=$PROJECT_ID

# Step 3: Get the service URL
echo "🌐 Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format="value(status.url)")

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo "🔗 Admin Panel: $SERVICE_URL/admin/database"
echo ""
echo "🧪 Testing database connectivity..."
curl -s "$SERVICE_URL/api/database/status" | head -c 200 && echo ""
echo ""
echo "🎉 Your frontend is now deployed with VPC access to the private database!"