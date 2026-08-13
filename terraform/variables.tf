variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"  # Mumbai — closest to Sri Lanka, lowest latency
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"  # Free tier eligible
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