variable "aws_region" {
  type        = string
  description = "AWS region for all provisioned resources"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Project name identifier used for naming and tagging"
  default     = "devlog"
}

variable "environment" {
  type        = string
  description = "Deployment environment name such as dev, staging, or prod"
  default     = "dev"
}

variable "vpc_cidr" {
  type        = string
  description = "IPv4 CIDR block for the dedicated Devlog VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  type        = string
  description = "IPv4 CIDR block for the single public subnet"
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  type        = string
  description = "AWS Availability Zone for the public subnet"
  default     = "us-east-1a"
}
