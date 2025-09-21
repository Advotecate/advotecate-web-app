# Supabase on GCP - Main Infrastructure Configuration
# Self-hosted Supabase deployment using Terraform

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "gcs" {
    bucket = "advotecate-terraform-state"
    prefix = "supabase-infrastructure"
  }
}

# Local variables
locals {
  project_id = var.project_id
  region     = var.region
  zone       = var.zone

  # Naming convention
  name_prefix = "${var.environment}-supabase"

  # Network configuration
  vpc_cidr = "10.0.0.0/16"
  subnet_cidrs = {
    gke     = "10.0.1.0/24"
    cloudsql = "10.0.2.0/24"
    private  = "10.0.3.0/24"
  }

  # Common labels
  labels = {
    project     = "advotecate"
    component   = "supabase"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Configure providers
provider "google" {
  project = local.project_id
  region  = local.region
  zone    = local.zone
}

data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${module.gke.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(module.gke.ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.gke.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(module.gke.ca_certificate)
  }
}

# Random passwords
resource "random_password" "postgres_password" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "anon_key" {
  length  = 64
  special = false
}

resource "random_password" "service_key" {
  length  = 64
  special = false
}

# Enable required GCP APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com"
  ])

  project = local.project_id
  service = each.value

  disable_on_destroy = false
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required_apis]
}

# Subnet for GKE
resource "google_compute_subnetwork" "gke_subnet" {
  name          = "${local.name_prefix}-gke-subnet"
  network       = google_compute_network.vpc.id
  ip_cidr_range = local.subnet_cidrs.gke
  region        = local.region

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }

  private_ip_google_access = true
}

# Private service networking for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "${local.name_prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "router" {
  name    = "${local.name_prefix}-router"
  region  = local.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${local.name_prefix}-nat"
  router                            = google_compute_router.router.name
  region                            = local.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [local.vpc_cidr]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${local.name_prefix}-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh-allowed"]
}

# Secret Manager for sensitive data
resource "google_secret_manager_secret" "postgres_password" {
  secret_id = "${local.name_prefix}-postgres-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "postgres_password" {
  secret      = google_secret_manager_secret.postgres_password.id
  secret_data = random_password.postgres_password.result
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.name_prefix}-jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "google_secret_manager_secret" "anon_key" {
  secret_id = "${local.name_prefix}-anon-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "anon_key" {
  secret      = google_secret_manager_secret.anon_key.id
  secret_data = random_password.anon_key.result
}

resource "google_secret_manager_secret" "service_key" {
  secret_id = "${local.name_prefix}-service-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "service_key" {
  secret      = google_secret_manager_secret.service_key.id
  secret_data = random_password.service_key.result
}

# Additional random passwords for Cloud SQL users
resource "random_password" "supabase_admin_password" {
  length  = 32
  special = true
}

resource "random_password" "supabase_auth_admin_password" {
  length  = 32
  special = true
}

resource "random_password" "supabase_storage_admin_password" {
  length  = 32
  special = true
}

# GKE cluster module
module "gke" {
  source = "./modules/gke"

  project_id    = local.project_id
  region        = local.region
  cluster_name  = "${local.name_prefix}-cluster"
  network_id    = google_compute_network.vpc.id
  subnet_id     = google_compute_subnetwork.gke_subnet.id
  name_prefix   = local.name_prefix
  labels        = local.labels

  node_service_account = null  # Will be created in the module
  network_dependency   = google_service_networking_connection.private_vpc_connection
}

# Cloud SQL PostgreSQL module
module "cloudsql" {
  source = "./modules/cloudsql"

  project_id     = local.project_id
  region         = local.region
  instance_name  = "${local.name_prefix}-postgres"
  network_id     = google_compute_network.vpc.id
  labels         = local.labels

  # Database passwords
  postgres_password                   = random_password.postgres_password.result
  supabase_admin_password            = random_password.supabase_admin_password.result
  supabase_auth_admin_password       = random_password.supabase_auth_admin_password.result
  supabase_storage_admin_password    = random_password.supabase_storage_admin_password.result

  # Performance tuning for Supabase workload
  tier               = "db-custom-4-16384"  # 4 vCPU, 16GB RAM
  disk_size         = 200
  max_disk_size     = 1000
  max_connections   = "400"
  shared_buffers    = "4GB"
  effective_cache_size = "12GB"

  # High availability
  availability_type = "REGIONAL"
  create_replica   = false  # Can be enabled later

  network_dependency = google_service_networking_connection.private_vpc_connection
}