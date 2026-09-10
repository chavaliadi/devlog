resource "aws_security_group" "host" {
  name        = "${var.project_name}-${var.environment}-host-sg"
  description = "Security group for Devlog host"
  vpc_id      = aws_vpc.devlog.id

  # Inbound HTTP access for web traffic to Nginx
  ingress {
    description = "Allow inbound HTTP traffic to Nginx reverse proxy"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All other inbound ports remain closed:
  # SSH (port 22) is closed; administrative access is via AWS Systems Manager.
  # HTTPS (port 443) is closed; deferred to future TLS configuration phase.
  # Backend Express (port 5005) is closed; loopback only behind Nginx.
  # PostgreSQL (ports 5432 and 5435) is closed; loopback only on localhost.
  # Redis (port 6379) is closed; loopback only on localhost.

  # Outbound access allows the host to reach external services.
  # This includes operating system package updates, GitHub REST API calls for commit diffs,
  # and Groq AI completion requests.
  egress {
    description = "Allow all outbound internet traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-host-sg"
  }
}
