# Cloud SQL Module Variables

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for the database"
  type        = string
}

variable "instance_name" {
  description = "Name of the Cloud SQL instance"
  type        = string
}

variable "tier" {
  description = "The machine type for the database instance"
  type        = string
  default     = "db-custom-2-8192"  # 2 vCPU, 8GB RAM
}

variable "availability_type" {
  description = "Availability type for the database instance"
  type        = string
  default     = "REGIONAL"  # High availability
}

variable "disk_size" {
  description = "Initial disk size in GB"
  type        = number
  default     = 100
}

variable "max_disk_size" {
  description = "Maximum disk size for autoresize in GB"
  type        = number
  default     = 500
}

variable "network_id" {
  description = "The VPC network ID"
  type        = string
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "deletion_protection" {
  description = "Whether to enable deletion protection"
  type        = bool
  default     = true
}

variable "network_dependency" {
  description = "Dependency on network resources"
  type        = any
  default     = null
}

# Database passwords
variable "postgres_password" {
  description = "Password for the postgres user"
  type        = string
  sensitive   = true
}

variable "supabase_admin_password" {
  description = "Password for the supabase_admin user"
  type        = string
  sensitive   = true
}

variable "supabase_auth_admin_password" {
  description = "Password for the supabase_auth_admin user"
  type        = string
  sensitive   = true
}

variable "supabase_storage_admin_password" {
  description = "Password for the supabase_storage_admin user"
  type        = string
  sensitive   = true
}

# Database performance tuning
variable "max_connections" {
  description = "Maximum number of database connections"
  type        = string
  default     = "200"
}

variable "shared_buffers" {
  description = "Shared buffers setting"
  type        = string
  default     = "2GB"
}

variable "effective_cache_size" {
  description = "Effective cache size setting"
  type        = string
  default     = "6GB"
}

# Read replica configuration
variable "create_replica" {
  description = "Whether to create a read replica"
  type        = bool
  default     = false
}

variable "replica_region" {
  description = "Region for the read replica (defaults to main region)"
  type        = string
  default     = null
}

variable "replica_tier" {
  description = "Machine type for the read replica"
  type        = string
  default     = "db-custom-1-4096"  # Smaller than primary
}