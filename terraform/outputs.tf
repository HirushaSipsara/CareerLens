output "instance_public_ip" {
  description = "Public IP of the CareerLens EC2 instance"
  value       = aws_instance.careerlens.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.careerlens.id
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.careerlens.public_ip}"
}

output "app_url" {
  description = "CareerLens frontend URL"
  value       = "http://${aws_instance.careerlens.public_ip}:${var.frontend_port}"
}

output "grafana_url" {
  description = "Grafana dashboard URL"
  value       = "http://${aws_instance.careerlens.public_ip}:3001"
}
