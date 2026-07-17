# CareerLens 🔍
> AI-powered career path recommender with a full production-grade DevOps pipeline

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/careerlens/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/careerlens/actions/workflows/deploy.yml)
![Docker](https://img.shields.io/badge/Docker-containerized-blue?logo=docker)
![Terraform](https://img.shields.io/badge/IaC-Terraform-purple?logo=terraform)
![AWS](https://img.shields.io/badge/Cloud-AWS%20EC2-orange?logo=amazon-aws)
![Prometheus](https://img.shields.io/badge/Monitoring-Prometheus%20%2B%20Grafana-red?logo=prometheus)

## What it does

CareerLens takes a user's CV text and current skills, sends them to an LLM (Gemma 4 via OpenRouter), and returns:
- **3 ranked career path recommendations** with match percentages
- **Skill gap analysis** with priority tags (High / Medium / Low)  
- **A 3-month learning roadmap** with weekly focus areas

The app itself is simple by design — the point is the infrastructure around it.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AWS EC2 (Ubuntu)                    │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐  │
│  │ React/nginx  │──────▶ │    Python Flask API      │  │
│  │  (port 80)   │        │      (port 5000)         │  │
│  └──────────────┘        └──────────┬───────────────┘  │
│                                     │                   │
│                           ┌─────────▼──────────┐       │
│                           │  OpenRouter API     │       │
│                           │  (Gemma 4 free)     │       │
│                           └────────────────────-┘       │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐  │
│  │   Grafana    │◀────── │      Prometheus          │  │
│  │  (port 3001) │        │  scrapes /metrics :9090  │  │
│  └──────────────┘        └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

GitHub push → GitHub Actions → Docker Hub → SSH deploy → EC2
Infrastructure provisioned with Terraform
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Tailwind CSS, nginx |
| Backend | Python, Flask, prometheus-client |
| AI | OpenRouter API (Gemma 4 — free tier) |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions (test → build → deploy) |
| Cloud | AWS EC2 (t2.micro, free tier) |
| Infrastructure as Code | Terraform |
| Monitoring | Prometheus + Grafana |
| Scripting | Bash (setup.sh, deploy.sh) |

---

## CI/CD Pipeline

Every `git push` to `main` triggers a 3-job pipeline:

```
[1] Test      →  pytest + flake8 lint
[2] Build     →  docker build → push to Docker Hub (tagged :latest + :sha)
[3] Deploy    →  SSH into EC2 → run deploy.sh → health check /health
```

Pull requests run jobs 1 and 2 only — deploy is gated to `main`.

---

## Monitoring

Prometheus scrapes `/metrics` every 15 seconds. Grafana dashboard shows:

- Total requests + success rate %
- Active requests (in-flight gauge)
- Estimated LLM tokens consumed
- Request rate over time (success vs error)
- Latency percentiles — p50 / p90 / p99
- Error rate time series

> Latency is tracked as a histogram rather than an average — because averages hide tail latency. A p99 of 25s while p50 is 2s signals a real problem that an average would mask.

---

## Screenshots

### Grafana Dashboard
![Grafana Dashboard](docs/screenshots/grafana.png)

### GitHub Actions Pipeline
![CI/CD Pipeline](docs/screenshots/pipeline.png)

### Prometheus Targets
![Prometheus](docs/screenshots/prometheus.png)

---

## Running locally

**Prerequisites:** Docker, Docker Compose, an OpenRouter API key (free at openrouter.ai)

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/careerlens.git
cd careerlens

# Add your API key
echo "OPENROUTER_API_KEY=your-key-here" > backend/.env

# Run everything
docker-compose up --build

# Open
# Frontend:   http://localhost
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001  (admin / admin)
```

---

## Provisioning infrastructure with Terraform

```bash
cd terraform/

# Configure your variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your key pair name and IP

terraform init
terraform plan
terraform apply

# Output includes EC2 IP, SSH command, and app URLs
```

---

## Project structure

```
careerlens/
├── frontend/                 # React app (nginx served)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/App.jsx
├── backend/                  # Flask API + Prometheus metrics
│   ├── Dockerfile
│   ├── app.py
│   ├── requirements.txt
│   └── tests/test_app.py
├── monitoring/               # Prometheus + Grafana config
│   ├── prometheus.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
├── terraform/                # IaC for AWS EC2 + security groups
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── scripts/                  # Bash automation
│   ├── setup.sh              # One-time server provisioning
│   └── deploy.sh             # Zero-touch deployment
├── .github/workflows/        # GitHub Actions CI/CD
│   └── deploy.yml
└── docker-compose.yml        # Local orchestration
```

---

## Key engineering decisions

**Why Terraform over manual EC2 setup?**
Infrastructure as code means the entire server is reproducible. `terraform destroy` + `terraform apply` gives a clean environment in under 2 minutes.

**Why nginx as a reverse proxy?**
React's `/analyze` fetch calls go to nginx, which proxies to Flask. No CORS issues, no hardcoded backend URLs, frontend and backend are decoupled.

**Why histogram for latency, not a gauge?**
Histograms let you calculate any percentile (p50/p90/p99) at query time. A gauge only stores the last value. Percentiles are the industry standard for latency SLOs.

**Why tag Docker images with git SHA?**
`latest` is convenient but not auditable. SHA tags let you trace any running container back to the exact commit that built it — critical for incident investigation.

---

## What I learned

- End-to-end container lifecycle: build → registry → deploy → run
- Writing idempotent Bash scripts (`set -euo pipefail`, existence checks)
- Prometheus data model: counters vs gauges vs histograms and when to use each
- Terraform state management and why `terraform.tfstate` must never be committed
- GitHub Actions job dependency chains and separating CI from CD

---

## Author

**Hirusha** — CS undergraduate, Sri Lanka  
Built as a portfolio project for SRE/DevOps internship applications.

GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)