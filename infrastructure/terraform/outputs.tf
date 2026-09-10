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
