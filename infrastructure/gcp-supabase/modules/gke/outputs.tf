# GKE Module Outputs

output "cluster_id" {
  description = "The GKE cluster ID"
  value       = google_container_cluster.supabase.id
}

output "cluster_name" {
  description = "The GKE cluster name"
  value       = google_container_cluster.supabase.name
}

output "endpoint" {
  description = "The GKE cluster endpoint"
  value       = google_container_cluster.supabase.endpoint
  sensitive   = true
}

output "ca_certificate" {
  description = "The cluster CA certificate"
  value       = google_container_cluster.supabase.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "node_service_account_email" {
  description = "Email of the node service account"
  value       = google_service_account.gke_node_sa.email
}

output "cluster_location" {
  description = "The location of the GKE cluster"
  value       = google_container_cluster.supabase.location
}

output "system_node_pool_name" {
  description = "Name of the system node pool"
  value       = google_container_node_pool.system_pool.name
}

output "app_node_pool_name" {
  description = "Name of the application node pool"
  value       = google_container_node_pool.app_pool.name
}