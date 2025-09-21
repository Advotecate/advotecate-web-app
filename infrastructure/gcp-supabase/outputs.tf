# Main Infrastructure Outputs

# Network outputs
output "vpc_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.vpc.name
}

output "gke_subnet_id" {
  description = "ID of the GKE subnet"
  value       = google_compute_subnetwork.gke_subnet.id
}

output "nat_ip" {
  description = "External IP address of the Cloud NAT"
  value       = google_compute_router_nat.nat.*.nat_ip_allocate_option
}

# GKE outputs
output "gke_cluster_name" {
  description = "Name of the GKE cluster"
  value       = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  description = "Endpoint for the GKE cluster"
  value       = module.gke.endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "CA certificate for the GKE cluster"
  value       = module.gke.ca_certificate
  sensitive   = true
}

output "gke_cluster_location" {
  description = "Location of the GKE cluster"
  value       = module.gke.cluster_location
}

output "gke_node_service_account" {
  description = "Service account used by GKE nodes"
  value       = module.gke.node_service_account_email
}

# Cloud SQL outputs
output "cloudsql_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = module.cloudsql.instance_name
}

output "cloudsql_connection_name" {
  description = "Connection name for the Cloud SQL instance"
  value       = module.cloudsql.instance_connection_name
}

output "cloudsql_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = module.cloudsql.private_ip_address
}

output "cloudsql_database_name" {
  description = "Name of the Supabase database"
  value       = module.cloudsql.database_name
}

# Database users
output "postgres_user" {
  description = "PostgreSQL superuser name"
  value       = module.cloudsql.postgres_user
}

output "supabase_admin_user" {
  description = "Supabase admin user name"
  value       = module.cloudsql.supabase_admin_user
}

# Secret Manager outputs
output "postgres_password_secret" {
  description = "Secret Manager secret name for postgres password"
  value       = google_secret_manager_secret.postgres_password.secret_id
}

output "jwt_secret_name" {
  description = "Secret Manager secret name for JWT secret"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}

output "anon_key_secret" {
  description = "Secret Manager secret name for anon key"
  value       = google_secret_manager_secret.anon_key.secret_id
}

output "service_key_secret" {
  description = "Secret Manager secret name for service key"
  value       = google_secret_manager_secret.service_key.secret_id
}

# SSL certificates
output "cloudsql_client_cert" {
  description = "Client certificate for Cloud SQL SSL connection"
  value       = module.cloudsql.client_cert_pem
  sensitive   = true
}

output "cloudsql_client_key" {
  description = "Client private key for Cloud SQL SSL connection"
  value       = module.cloudsql.client_key_pem
  sensitive   = true
}

output "cloudsql_server_ca_cert" {
  description = "Server CA certificate for Cloud SQL SSL connection"
  value       = module.cloudsql.server_ca_cert_pem
  sensitive   = true
}

# Project information
output "project_id" {
  description = "GCP project ID"
  value       = local.project_id
}

output "region" {
  description = "GCP region"
  value       = local.region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# Connection strings for applications
output "database_url" {
  description = "Database connection URL for applications"
  value       = "postgresql://${module.cloudsql.postgres_user}@${module.cloudsql.private_ip_address}:5432/${module.cloudsql.database_name}?sslmode=require"
  sensitive   = true
}

output "supabase_database_url" {
  description = "Supabase database connection URL"
  value       = "postgresql://${module.cloudsql.supabase_admin_user}@${module.cloudsql.private_ip_address}:5432/${module.cloudsql.database_name}?sslmode=require"
  sensitive   = true
}