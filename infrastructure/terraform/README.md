# Devlog Terraform Infrastructure

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
IAM Role and Instance Profile
  ↓
EC2 Compute Instance
  ↓
AWS Systems Manager Access

This architecture keeps infrastructure costs near zero, avoids distributed job scheduling issues, and matches the local runtime behavior of Devlog.

## Current Resources Managed in this Stage

This stage provisions the network envelope, the IAM identity, and the EC2 compute instance:

* Dedicated AWS VPC with DNS support and DNS hostnames enabled
* One public subnet in a single Availability Zone
* Internet Gateway attached to the VPC
* Public route table routing all outbound traffic to the Internet Gateway
* Route table association for the public subnet
* Security Group foundation with outbound internet egress allowed and zero public ingress
* IAM Role for EC2 with an assume role policy allowing `ec2.amazonaws.com`
* AWS managed policy `AmazonSSMManagedInstanceCore` attached to the IAM role
* IAM Instance Profile connecting the role to the EC2 instance
* Dynamic lookup data source for the latest official Ubuntu 24.04 LTS Noble AMI
* EC2 compute instance placed in the public subnet with an encrypted gp3 root volume

## Compute and Security Architecture Details

### 1. IAM Role and Least Privilege
The EC2 instance is assigned an IAM role that grants only the permissions needed for AWS Systems Manager.
No broad administrative privileges, S3 access, or database policies are attached.
The instance receives temporary credentials automatically through metadata rotation.
No static credentials or access keys exist on the server.

### 2. AWS Systems Manager Management
Administrative access is handled through AWS Systems Manager Session Manager.
The managed policy `AmazonSSMManagedInstanceCore` allows the SSM agent running on Ubuntu to establish an outbound TLS connection with AWS Systems Manager endpoints.
Because the connection initiates from inside the instance out to AWS, no public inbound ports are required.

### 3. SSH Keys and Port 22
No SSH key pair is created in Terraform, and `key_name` is left undefined.
Inbound port 22 is completely closed in the security group.
This eliminates credential leak risks, removes the burden of managing SSH private keys, and protects the instance from automated brute force scans.
Administrators connect securely through the AWS Console or using the AWS CLI command:

```bash
aws ssm start-session --target <instance_id>
```

### 4. Dynamic Ubuntu AMI Selection
The configuration uses a Terraform data source to find the most recent official Canonical Ubuntu 24.04 LTS AMI in the configured region.
This avoids hardcoded AMI identifiers that break across regions or become obsolete when new patch images are released.

### 5. Instance Type and Storage
The instance type defaults to `t3.small`, which provides 2 vCPUs and 2 GB of memory to run Node.js, PostgreSQL, and Redis comfortably.
The instance type is fully configurable via the `instance_type` variable.
Operators should review account eligibility, region availability, and Free Tier or credit status before applying.
The root volume is an EBS gp3 volume defaulting to 20 GB, encrypted at rest, and set to delete on termination.

## Resources Intentionally Deferred

The following resources are intentionally not implemented in this stage:

* Devlog application deployment (scheduled for a subsequent deployment stage)
* Installation of Node.js, PostgreSQL, Redis, and Nginx on the compute host
* User data bootstrap scripts
* Open inbound ports for HTTP, HTTPS, or application traffic
* AWS RDS PostgreSQL (local database runs on the compute instance for the MVP)
* AWS ElastiCache Redis (local Redis runs on the compute instance for the MVP)
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
This stage defines the foundational networking, IAM, and compute resources in code.
No infrastructure has been deployed yet.
