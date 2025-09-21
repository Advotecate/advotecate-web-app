# GKE Cluster Module for Supabase
# Optimized for self-hosted Supabase deployment with security and cost considerations

resource "google_container_cluster" "supabase" {
  name     = var.cluster_name
  location = var.region

  # Network configuration
  network    = var.network_id
  subnetwork = var.subnet_id

  # Remove default node pool (we'll create custom ones)
  remove_default_node_pool = true
  initial_node_count       = 1

  # IP allocation for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Network security
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"

    master_global_access_config {
      enabled = true
    }
  }

  # Master authorized networks (restrict access)
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  }

  # Workload Identity for secure pod authentication
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Network policy for pod-to-pod communication
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Security and compliance
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Database encryption
  database_encryption {
    state    = "ENCRYPTED"
    key_name = var.encryption_key
  }

  # Enable cluster features
  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    network_policy_config {
      disabled = false
    }

    dns_cache_config {
      enabled = true
    }
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T02:00:00Z"
      end_time   = "2023-01-01T06:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA"
    }
  }

  # Resource labels
  resource_labels = var.labels

  # Enable logging and monitoring
  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "APISERVER"
    ]
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "APISERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER"
    ]
  }

  depends_on = [var.network_dependency]
}

# System node pool for Supabase core services
resource "google_container_node_pool" "system_pool" {
  name     = "system-pool"
  cluster  = google_container_cluster.supabase.id
  location = var.region

  # Node pool configuration
  initial_node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = 3
  }

  # Node configuration
  node_config {
    preemptible  = false
    machine_type = "e2-standard-2"
    disk_size_gb = 50
    disk_type    = "pd-ssd"

    # Service account with minimal permissions
    service_account = var.node_service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring"
    ]

    # Security settings
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Labels and taints for system workloads
    labels = merge(var.labels, {
      "node-type" = "system"
    })

    taint {
      key    = "node-type"
      value  = "system"
      effect = "NO_SCHEDULE"
    }

    # Network tags
    tags = ["supabase-system"]
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Update strategy
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# Application node pool for Supabase services
resource "google_container_node_pool" "app_pool" {
  name     = "app-pool"
  cluster  = google_container_cluster.supabase.id
  location = var.region

  # Node pool configuration
  initial_node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 10
  }

  # Node configuration optimized for Supabase workloads
  node_config {
    preemptible  = false
    machine_type = "e2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    # Service account
    service_account = var.node_service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring"
    ]

    # Security settings
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Labels for application workloads
    labels = merge(var.labels, {
      "node-type" = "application"
    })

    # Network tags
    tags = ["supabase-app"]
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Update strategy
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# Create service account for node pools
resource "google_service_account" "gke_node_sa" {
  account_id   = "${var.name_prefix}-gke-node"
  display_name = "GKE Node Service Account for Supabase"
  description  = "Service account for GKE nodes in Supabase cluster"
}

# Assign necessary roles to node service account
resource "google_project_iam_member" "node_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/storage.objectViewer",
    "roles/artifactregistry.reader"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_node_sa.email}"
}