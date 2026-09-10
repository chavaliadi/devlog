# Dynamic lookup for the most recent official Ubuntu 24.04 LTS Noble AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099979779448"] # Canonical official account ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "devlog" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.public.id
  iam_instance_profile = aws_iam_instance_profile.ec2.name

  vpc_security_group_ids = [
    aws_security_group.host.id
  ]

  associate_public_ip_address = true

  # SSH keys are intentionally omitted.
  # Administrative access is provided exclusively via AWS Systems Manager Session Manager.
  # No key_name is defined and port 22 is not exposed.

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-${var.environment}-root-volume"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-host"
  }
}
