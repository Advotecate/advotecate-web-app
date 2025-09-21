# Main Infrastructure Variables

variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string
  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID cannot be empty."
  }
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
  validation {
    condition = contains([
      "us-central1", "us-east1", "us-east4", "us-west1", "us-west2", "us-west3", "us-west4",
      "europe-north1", "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6",
      "asia-east1", "asia-east2", "asia-northeast1", "asia-south1", "asia-southeast1", "australia-southeast1"
    ], var.region)
    error_message = "Region must be a valid GCP region."
  }
}

variable "zone" {
  description = "The GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "Environment must start with a letter and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "enable_apis" {
  description = "Whether to enable required GCP APIs automatically"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Whether to enable deletion protection on critical resources"
  type        = bool
  default     = true
}

# Networking variables
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid CIDR block."
  }
}

variable "enable_private_google_access" {
  description = "Enable private Google access for subnets"
  type        = bool
  default     = true
}

variable "enable_nat_gateway" {
  description = "Enable Cloud NAT for outbound internet access"
  type        = bool
  default     = true
}

# GKE variables
variable "gke_node_count" {
  description = "Initial number of nodes for GKE node pools"
  type        = number
  default     = 2
  validation {
    condition     = var.gke_node_count >= 1 && var.gke_node_count <= 100
    error_message = "GKE node count must be between 1 and 100."
  }
}

variable "gke_max_node_count" {
  description = "Maximum number of nodes for GKE autoscaling"
  type        = number
  default     = 10
  validation {
    condition     = var.gke_max_node_count >= 1 && var.gke_max_node_count <= 100
    error_message = "GKE max node count must be between 1 and 100."
  }
}

variable "gke_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-standard-4"
}

variable "gke_disk_size" {
  description = "Disk size for GKE nodes in GB"
  type        = number
  default     = 100
  validation {
    condition     = var.gke_disk_size >= 10 && var.gke_disk_size <= 1000
    error_message = "GKE disk size must be between 10 and 1000 GB."
  }
}

variable "gke_preemptible" {
  description = "Use preemptible instances for GKE nodes"
  type        = bool
  default     = false
}

# Cloud SQL variables
variable "cloudsql_tier" {
  description = "Machine type for Cloud SQL instance"
  type        = string
  default     = "db-custom-4-16384"
}

variable "cloudsql_disk_size" {
  description = "Initial disk size for Cloud SQL in GB"
  type        = number
  default     = 200
  validation {
    condition     = var.cloudsql_disk_size >= 10 && var.cloudsql_disk_size <= 30720
    error_message = "Cloud SQL disk size must be between 10 and 30720 GB."
  }
}

variable "cloudsql_availability_type" {
  description = "Availability type for Cloud SQL (ZONAL or REGIONAL)"
  type        = string
  default     = "REGIONAL"
  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.cloudsql_availability_type)
    error_message = "Cloud SQL availability type must be either ZONAL or REGIONAL."
  }
}

variable "cloudsql_backup_enabled" {
  description = "Enable automated backups for Cloud SQL"
  type        = bool
  default     = true
}

variable "cloudsql_point_in_time_recovery" {
  description = "Enable point-in-time recovery for Cloud SQL"
  type        = bool
  default     = true
}

# Security variables
variable "enable_binary_authorization" {
  description = "Enable Binary Authorization for GKE"
  type        = bool
  default     = true
}

variable "enable_network_policy" {
  description = "Enable network policy for GKE"
  type        = bool
  default     = true
}

variable "enable_private_nodes" {
  description = "Enable private nodes for GKE"
  type        = bool
  default     = true
}

variable "enable_workload_identity" {
  description = "Enable Workload Identity for GKE"
  type        = bool
  default     = true
}

# Monitoring and logging
variable "enable_logging" {
  description = "Enable Google Cloud Logging"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable Google Cloud Monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
  validation {
    condition     = var.log_retention_days >= 1 && var.log_retention_days <= 3653
    error_message = "Log retention days must be between 1 and 3653."
  }
}

# Resource labels
variable "additional_labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([
      for k, v in var.additional_labels : can(regex("^[a-z0-9_-]+$", k))
    ])
    error_message = "Label keys must contain only lowercase letters, numbers, underscores, and hyphens."
  }
}

# Cost optimization
variable "enable_cost_optimization" {
  description = "Enable cost optimization features (preemptible instances, etc.)"
  type        = bool
  default     = false
}

variable "schedule_downscaling" {
  description = "Enable scheduled downscaling for non-production environments"
  type        = bool
  default     = false
}