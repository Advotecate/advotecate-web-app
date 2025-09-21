# Cloud SQL PostgreSQL Module for Supabase
# Optimized for Supabase backend with high availability and security

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "postgres" {
  name             = var.instance_name
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  # Instance settings
  settings {
    tier                        = var.tier
    availability_type          = var.availability_type
    disk_type                  = "PD_SSD"
    disk_size                  = var.disk_size
    disk_autoresize           = true
    disk_autoresize_limit     = var.max_disk_size

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # IP configuration for private networking
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    # Database flags for Supabase optimization
    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements,pg_cron,pgaudit,uuid-ossp"
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    database_flags {
      name  = "shared_buffers"
      value = var.shared_buffers
    }

    database_flags {
      name  = "effective_cache_size"
      value = var.effective_cache_size
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM
      update_track = "stable"
    }

    # User labels
    user_labels = var.labels

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  # Deletion protection
  deletion_protection = var.deletion_protection

  depends_on = [var.network_dependency]
}

# Create main database for Supabase
resource "google_sql_database" "supabase" {
  name     = "supabase"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id

  # Use UTF8 collation for proper international support
  charset   = "UTF8"
  collation = "en_US.UTF8"
}

# Create additional databases
resource "google_sql_database" "postgres_db" {
  name     = "postgres"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

# Create PostgreSQL users
resource "google_sql_user" "postgres_user" {
  name     = "postgres"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
  password = var.postgres_password

  # Grant superuser privileges
  type = "BUILT_IN"
}

resource "google_sql_user" "supabase_admin" {
  name     = "supabase_admin"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
  password = var.supabase_admin_password

  type = "BUILT_IN"
}

resource "google_sql_user" "supabase_auth_admin" {
  name     = "supabase_auth_admin"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
  password = var.supabase_auth_admin_password

  type = "BUILT_IN"
}

resource "google_sql_user" "supabase_storage_admin" {
  name     = "supabase_storage_admin"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
  password = var.supabase_storage_admin_password

  type = "BUILT_IN"
}

# SSL Certificate for secure connections
resource "google_sql_ssl_cert" "supabase_client_cert" {
  common_name = "supabase-client"
  instance    = google_sql_database_instance.postgres.name
  project     = var.project_id
}

# Read replica for read workloads (optional)
resource "google_sql_database_instance" "postgres_replica" {
  count = var.create_replica ? 1 : 0

  name                 = "${var.instance_name}-replica"
  database_version     = "POSTGRES_15"
  region              = var.replica_region != null ? var.replica_region : var.region
  project             = var.project_id
  master_instance_name = google_sql_database_instance.postgres.name

  replica_configuration {
    failover_target = false
  }

  settings {
    tier              = var.replica_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    user_labels = merge(var.labels, {
      "replica" = "true"
    })

    insights_config {
      query_insights_enabled = true
    }
  }

  deletion_protection = var.deletion_protection
}