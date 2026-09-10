resource "aws_security_group" "host" {
  name        = "${var.project_name}-${var.environment}-host-sg"
  description = "Security group foundation for Devlog host"
  vpc_id      = aws_vpc.devlog.id

  # Inbound rules are intentionally omitted in this foundational stage.
  # Security principle: Nothing should be publicly reachable through this group yet.
  # Application ports (5005), database ports (5432/5435), and Redis (6379) remain closed.
  # Inbound access via AWS Systems Manager Session Manager or restricted ports will be
  # introduced alongside compute in the subsequent stage.

  # Outbound access allows the future host to reach external services.
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
