terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Data: latest Ubuntu AMI from Canonical public parameters ──
data "aws_ssm_parameter" "ubuntu_ami" {
  name = var.ubuntu_ami_parameter
}

# ── Security Group ────────────────────────────────────────────
resource "aws_security_group" "careerlens_sg" {
  name        = "${var.project_name}-sg"
  description = "Security group for CareerLens EC2"

  # SSH — your IP only
  ingress {
    description = "SSH from my IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  # HTTP — frontend (public)
  ingress {
    description = "HTTP frontend"
    from_port   = var.frontend_port
    to_port     = var.frontend_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Flask API
  ingress {
    description = "Flask backend"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Prometheus
  ingress {
    description = "Prometheus"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Grafana
  ingress {
    description = "Grafana"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound allowed
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

# ── EC2 Instance ──────────────────────────────────────────────
resource "aws_instance" "careerlens" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.careerlens_sg.id]

  # Run setup.sh automatically on first boot
  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    apt-get install -y git curl
    git clone "${var.repo_url}" /home/ubuntu/careerlens
    chown -R ubuntu:ubuntu /home/ubuntu/careerlens
    REPO_URL="${var.repo_url}" APP_DIR="/home/ubuntu/careerlens" bash /home/ubuntu/careerlens/scripts/setup.sh
    bash /home/ubuntu/careerlens/scripts/deploy.sh
  EOF

  root_block_device {
    volume_size = 20 # GB — enough for Docker images
    volume_type = "gp3"
  }

  tags = {
    Name    = "${var.project_name}-server"
    Project = var.project_name
  }
}
