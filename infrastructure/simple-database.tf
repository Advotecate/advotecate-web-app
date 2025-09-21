# Simple PostgreSQL Database for Advotecate Payments
# This creates a basic Cloud SQL instance for the payments schema

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

provider "google" {
  project = "advotecate-dev"
  region  = "us-central1"
}

# Generate a random password for the database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store the password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "advotecate-db-password"

  replication {
    auto {
    }
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Create the Cloud SQL instance
resource "google_sql_database_instance" "advotecate_db" {
  name             = "advotecate-payments-db"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier              = "db-f1-micro"  # Small instance for MVP
    availability_type = "ZONAL"       # Single zone for cost savings
    disk_type         = "PD_SSD"
    disk_size         = 20

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = "us-central1"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled       = true
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"  # Allow all IPs (for MVP - restrict this later)
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }
  }

  deletion_protection = false  # Allow deletion for MVP testing
}

# Create the main database
resource "google_sql_database" "payments_db" {
  name     = "advotecate_payments"
  instance = google_sql_database_instance.advotecate_db.name
}

# Create the postgres user
resource "google_sql_user" "postgres_user" {
  name     = "postgres"
  instance = google_sql_database_instance.advotecate_db.name
  password = random_password.db_password.result
}

# Create an application user
resource "google_sql_user" "app_user" {
  name     = "advotecate_app"
  instance = google_sql_database_instance.advotecate_db.name
  password = random_password.db_password.result
}

# Output the connection details
output "database_connection_name" {
  value = google_sql_database_instance.advotecate_db.connection_name
}

output "database_ip" {
  value = google_sql_database_instance.advotecate_db.public_ip_address
}

output "database_name" {
  value = google_sql_database.payments_db.name
}

output "database_user" {
  value = google_sql_user.app_user.name
}

output "password_secret_name" {
  value = google_secret_manager_secret.db_password.secret_id
  description = "Secret Manager secret containing the database password"
}