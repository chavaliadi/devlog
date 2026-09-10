output "vpc_id" {
  description = "Identifier of the Devlog VPC"
  value       = aws_vpc.devlog.id
}

output "vpc_cidr" {
  description = "IPv4 CIDR block assigned to the Devlog VPC"
  value       = aws_vpc.devlog.cidr_block
}

output "public_subnet_id" {
  description = "Identifier of the public subnet"
  value       = aws_subnet.public.id
}

output "public_subnet_cidr" {
  description = "IPv4 CIDR block assigned to the public subnet"
  value       = aws_subnet.public.cidr_block
}

output "internet_gateway_id" {
  description = "Identifier of the Internet Gateway attached to the Devlog VPC"
  value       = aws_internet_gateway.devlog.id
}

output "public_route_table_id" {
  description = "Identifier of the public route table"
  value       = aws_route_table.public.id
}

output "security_group_id" {
  description = "Identifier of the foundational security group"
  value       = aws_security_group.host.id
}

output "ec2_instance_id" {
  description = "Identifier of the Devlog compute instance"
  value       = aws_instance.devlog.id
}

output "ec2_private_ip" {
  description = "Private IPv4 address of the Devlog compute instance"
  value       = aws_instance.devlog.private_ip
}

output "ec2_public_ip" {
  description = "Public IPv4 address of the Devlog compute instance"
  value       = aws_instance.devlog.public_ip
}

output "iam_role_name" {
  description = "Name of the IAM role attached to the EC2 instance"
  value       = aws_iam_role.ec2.name
}

output "iam_role_arn" {
  description = "Amazon Resource Name of the IAM role attached to the EC2 instance"
  value       = aws_iam_role.ec2.arn
}

output "iam_instance_profile_name" {
  description = "Name of the IAM instance profile attached to the EC2 instance"
  value       = aws_iam_instance_profile.ec2.name
}

output "application_url" {
  description = "Public HTTP entry point URL for the Devlog application"
  value       = "http://${aws_instance.devlog.public_ip}"
}

