# Cloud SQL Module Outputs

output "instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "instance_connection_name" {
  description = "Connection name for the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip_address" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "database_name" {
  description = "Name of the main Supabase database"
  value       = google_sql_database.supabase.name
}

output "postgres_user" {
  description = "PostgreSQL superuser name"
  value       = google_sql_user.postgres_user.name
}

output "supabase_admin_user" {
  description = "Supabase admin user name"
  value       = google_sql_user.supabase_admin.name
}

output "supabase_auth_admin_user" {
  description = "Supabase auth admin user name"
  value       = google_sql_user.supabase_auth_admin.name
}

output "supabase_storage_admin_user" {
  description = "Supabase storage admin user name"
  value       = google_sql_user.supabase_storage_admin.name
}

output "client_cert_pem" {
  description = "Client certificate in PEM format"
  value       = google_sql_ssl_cert.supabase_client_cert.cert
  sensitive   = true
}

output "client_key_pem" {
  description = "Client private key in PEM format"
  value       = google_sql_ssl_cert.supabase_client_cert.private_key
  sensitive   = true
}

output "server_ca_cert_pem" {
  description = "Server CA certificate in PEM format"
  value       = google_sql_ssl_cert.supabase_client_cert.server_ca_cert
  sensitive   = true
}

output "replica_instance_name" {
  description = "Name of the read replica instance"
  value       = var.create_replica ? google_sql_database_instance.postgres_replica[0].name : null
}

output "replica_connection_name" {
  description = "Connection name for the read replica"
  value       = var.create_replica ? google_sql_database_instance.postgres_replica[0].connection_name : null
}