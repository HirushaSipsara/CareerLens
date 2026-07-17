# CareerLens

CareerLens is a full-stack career assistant and resume optimizer.

## Project Structure

```text
CareerLens/
├── frontend/             # React + Vite frontend
│   ├── src/              # App source files
│   ├── Dockerfile        # Frontend Docker config
│   └── package.json      # Dependencies and scripts
│
├── backend/              # FastAPI Python backend
│   ├── app/              # Backend application logic
│   ├── Dockerfile        # Backend Docker config
│   ├── requirements.txt  # Python requirements
│   └── .env.example      # Env vars layout
│
├── infrastructure/       # IaC and deployment scripts
│   ├── terraform/        # Terraform configs
│   └── scripts/          # Helper setup scripts
│
├── monitoring/           # Service observability
│   ├── prometheus/       # Prometheus config
│   └── grafana/          # Grafana dashboards
│
├── docker-compose.yml    # Development environment orchestration
├── .github/              # CI/CD Workflows
│   └── workflows/
└── .gitignore            # Git ignore definitions
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for local frontend development)
- Python 3.12 (for local backend development)

### Running locally with Docker Compose

To start all services:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
