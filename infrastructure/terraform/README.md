# Devlog Terraform Network Foundation

## Purpose of the Infrastructure Layer

This directory contains the Terraform configuration for the Devlog cloud infrastructure.
The infrastructure layer provisions the required AWS foundation while keeping Devlog business logic independent from cloud provider details.
Application code, Prisma models, and background queue workers remain completely untouched.

## Current MVP Architecture

The approved minimum viable product architecture is a single host architecture.
The target flow is:

Terraform
  ↓
AWS VPC
  ↓
Public Subnet
  ↓
Internet Gateway
  ↓
Public Route Table
  ↓
Security Boundary
  ↓
Future EC2 Compute

This architecture keeps infrastructure costs near zero, avoids distributed job scheduling issues, and matches the local runtime behavior of Devlog.

## Current Resources Managed in this Stage

This foundational stage provisions the network envelope and initial security boundary only:

* Dedicated AWS VPC with DNS support and DNS hostnames enabled
* One public subnet in a single Availability Zone
* Internet Gateway attached to the VPC
* Public route table routing all outbound traffic to the Internet Gateway
* Route table association for the public subnet
* Security Group foundation with outbound internet egress allowed and zero public ingress

## Resources Intentionally Deferred

The following resources are intentionally not implemented in this stage:

* EC2 compute instance and Elastic IP (scheduled for the next compute stage)
* User data bootstrap scripts
* Open inbound ports or public service access
* AWS Systems Manager instance profile
* AWS RDS PostgreSQL (local database on compute instance for MVP)
* AWS ElastiCache Redis (local Redis on compute instance for MVP)
* AWS Application Load Balancer
* AWS NAT Gateway
* AWS ECS, EKS, or Kubernetes

## Prerequisites

Before running Terraform commands, ensure the following tools are installed:

* Terraform CLI version 1.5.0 or higher
* AWS CLI version 2.x

## AWS Credential Strategy

This configuration relies on standard AWS credential resolution.
Do not hardcode access keys or secret keys in any Terraform file.
Credentials can be provided through:

* AWS environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
* Named AWS CLI profiles (`AWS_PROFILE`)
* AWS SSO credentials generated via `aws sso login`
* IAM roles when running within an automated pipeline

## Usage Commands

### 1. Initialize Working Directory

Download required provider plugins and prepare local state:

```bash
terraform init
```

### 2. Format Code

Enforce standard Terraform formatting across all configuration files:

```bash
terraform fmt
```

### 3. Validate Configuration

Validate configuration syntax and internal consistency:

```bash
terraform validate
```

### 4. Review Execution Plan

Create a speculative execution plan to preview resource changes:

```bash
terraform plan
```

To supply custom values, copy `terraform.tfvars.example` to `terraform.tfvars` and edit values:

```bash
cp terraform.tfvars.example terraform.tfvars
terraform plan -var-file=terraform.tfvars
```

## Important Deployment Notice

`terraform apply` must only be run after careful manual review.
This stage defines the foundational networking resources in code.
No infrastructure has been deployed yet.
