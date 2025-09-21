# GKE Module Variables

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for the cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
}

variable "network_id" {
  description = "The VPC network ID"
  type        = string
}

variable "subnet_id" {
  description = "The subnet ID for the cluster"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "node_service_account" {
  description = "Service account for GKE nodes"
  type        = string
  default     = null
}

variable "encryption_key" {
  description = "KMS key for cluster encryption"
  type        = string
  default     = null
}

variable "network_dependency" {
  description = "Dependency on network resources"
  type        = any
  default     = null
}