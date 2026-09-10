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

This architecture avoids distributed job scheduling issues and matches the local runtime behavior of Devlog.

## Current Managed Resources

This configuration manages exactly 10 AWS resources across the network, security, IAM, and compute layers:

### Networking and Security (6 resources)
1. `aws_vpc.devlog` (dedicated VPC with DNS support and hostnames enabled)
2. `aws_subnet.public` (public subnet in one Availability Zone)
3. `aws_internet_gateway.devlog` (Internet Gateway attached to the VPC)
4. `aws_route_table.public` (public route table routing outbound traffic to the Internet Gateway)
5. `aws_route_table_association.public` (subnet association with the public route table)
6. `aws_security_group.host` (firewall boundary allowing inbound HTTP traffic on TCP port 80 to Nginx, outbound egress allowed, and all other inbound ports closed)

### IAM and Management (3 resources)
7. `aws_iam_role.ec2` (IAM role allowing the EC2 service to assume it)
8. `aws_iam_role_policy_attachment.ssm_core` (attaches the AWS managed policy AmazonSSMManagedInstanceCore)
9. `aws_iam_instance_profile.ec2` (instance profile delivering IAM credentials to the compute instance)

### Compute (1 resource)
10. `aws_instance.devlog` (single EC2 compute host with an encrypted gp3 root volume)

### Read Only Data Sources (1 data source)
* `data.aws_ami.ubuntu` (dynamic lookup for the most recent official Canonical Ubuntu 24.04 LTS AMI)

Note that data sources query existing AWS information and are not managed resources created by Terraform.

## Network and Security Architecture Details

### 1. Internet Gateway and Public Subnet
The Internet Gateway provides direct routing between instances in the VPC and the public internet.
It is an internet target in the public route table for `0.0.0.0/0`.
Instances in the public subnet receive a public IPv4 address and can initiate outbound connections to the internet.
Public subnet placement does not mean unrestricted inbound access.
All inbound network traffic must pass through the security group.

### 2. Inbound Security Boundary
The security group allows exactly one public inbound entry point:
* Inbound TCP port 80 from `0.0.0.0/0` routed to Nginx.

All other ports remain strictly closed:
* SSH (port 22): Closed. Administrative access is performed exclusively through AWS Systems Manager Session Manager.
* HTTPS (port 443): Closed. Deferred to a future TLS certificate and domain management phase.
* Backend Express (port 5005): Closed. Accessible only locally on loopback via Nginx reverse proxy.
* PostgreSQL (port 5432 and alternate 5435): Closed. Accessible only locally on loopback.
* Redis (port 6379): Closed. Accessible only locally on loopback.

HTTP is intentionally used only for this infrastructure stage.
HTTPS and TLS will be added later as a separate phase.

Application traffic flows through Nginx as the single public gateway:

```
Public Internet
      │
      │ HTTP port 80
      ▼
   Nginx :80
      │
      ├── React Static Files (/opt/devlog/app/frontend/dist)
      │
      └── Express :5005 (127.0.0.1:5005)
                │
                ├── PostgreSQL localhost:5432
                └── Redis localhost:6379
```

### 3. AWS Systems Manager Administrative Access
Administrative access is performed through AWS Systems Manager Session Manager.
The SSM agent running on Ubuntu initiates an outbound HTTPS connection over port 443 to regional AWS Systems Manager endpoints.
Because the session starts outbound from the instance to AWS, no public inbound ports or SSH keys are needed.
Administrators connect securely through the AWS Management Console or via the AWS CLI:

```bash
aws ssm start-session --target <instance_id>
```

### 4. IAM Role Scoping
The EC2 role is scoped to the AWS managed permissions required for Systems Manager operation and does not include broad administrative permissions.
The instance profile supplies temporary, automatically rotated credentials through the instance metadata service.
No static AWS keys or passwords are stored on disk.

### 5. Dynamic Ubuntu AMI Selection
The configuration queries the official Canonical owner account (`099979779448`) for the latest Ubuntu 24.04 LTS Noble AMI.
This eliminates hardcoded AMI IDs that fail across different regions or become obsolete after security updates.

## Cost Safety and Sizing Strategy

### Cost Safety Notice
Terraform does not guarantee cost free infrastructure.
AWS pricing, account eligibility, and promotional credits must be verified by the operator prior to running `terraform apply`.
This project minimizes fixed expenses by intentionally omitting costly infrastructure components that are unnecessary for the single host MVP:

* No AWS NAT Gateway (avoids fixed hourly charges)
* No AWS Application Load Balancer (avoids fixed hourly charges)
* No AWS RDS managed database (runs locally on compute for the MVP)
* No AWS ElastiCache managed Redis cluster (runs locally on compute for the MVP)
* No AWS ECS or EKS container orchestrators

### Instance Type Selection
The default instance type in `variables.tf` is `t2.micro` (1 vCPU, 1 GB RAM).
This default is selected for initial cost safety, as `t2.micro` is widely eligible for the AWS Free Tier on eligible accounts.
When running the full Devlog stack with Node.js, PostgreSQL, and Redis under active load, operators can change the instance type to `t3.small` (2 vCPUs, 2 GB RAM) by setting `instance_type = "t3.small"` in `terraform.tfvars`.
Always verify regional instance availability and pricing for your specific AWS account.

### Root Storage Allocation
The root storage volume is configured as a 20 GB gp3 EBS block device, encrypted at rest, with deletion enabled on instance termination.

## Terraform Outputs

The configuration exports the following deployment values:
* `vpc_id`: Devlog VPC identifier.
* `vpc_cidr`: Devlog VPC IPv4 CIDR block.
* `public_subnet_id`: Public subnet identifier.
* `public_subnet_cidr`: Public subnet IPv4 CIDR block.
* `internet_gateway_id`: Attached Internet Gateway identifier.
* `public_route_table_id`: Public route table identifier.
* `security_group_id`: Security group identifier.
* `ec2_instance_id`: EC2 compute instance identifier.
* `ec2_private_ip`: Private IPv4 address of the EC2 instance.
* `ec2_public_ip`: Public IPv4 address of the EC2 instance.
* `application_url`: Public HTTP entry point (`http://<public_ip>`).
* `iam_role_name`: IAM role name attached to the EC2 instance.
* `iam_role_arn`: IAM role ARN attached to the EC2 instance.
* `iam_instance_profile_name`: IAM instance profile name.

## Resources Intentionally Deferred

The following items belong to subsequent deployment stages and are not implemented here:

* HTTPS and TLS certificates (deferred to a dedicated TLS phase)
* Application Load Balancer and Route53 DNS automation
* Managed database or cache services
* Multi host clustering or autoscaling

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

Create an execution plan to preview resource changes:

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
This stage defines the foundational networking, IAM, compute, and public HTTP security group rule in code.
No infrastructure has been deployed yet.
