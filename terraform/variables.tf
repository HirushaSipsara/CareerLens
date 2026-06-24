variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-east-1" # Mumbai — closest to Sri Lanka, lowest latency
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free tier eligible
}

variable "frontend_port" {
  description = "Public port exposed by the frontend container"
  type        = number
  default     = 8088
}

variable "key_name" {
  description = "Name of your AWS key pair (for SSH access)"
  type        = string
}

variable "my_ip" {
  description = "Your local IP address for SSH access (format: x.x.x.x/32)"
  type        = string
}

variable "project_name" {
  description = "Project tag applied to all resources"
  type        = string
  default     = "careerlens"
}

variable "ubuntu_ami_parameter" {
  description = "Public SSM parameter that stores the latest Ubuntu AMI ID"
  type        = string
  default     = "/aws/service/canonical/ubuntu/server/noble/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

variable "repo_url" {
  description = "Git repository URL for the CareerLens app"
  type        = string
}
