# CareerLens

CareerLens is a modern, AI-powered web application that turns raw CV text and current skills into actionable tech career guidance.

The application workflow is:
1. The user pastes their CV text and list of skills into the frontend interface.
2. The frontend sends this data to a Flask backend API endpoint (`/analyze`).
3. The backend calls the OpenRouter API (utilizing free tier Gemma models with structured output) to generate career recommendations.
4. The backend returns a structured JSON response containing ranked career paths, identified skill gaps, and a 3-month action plan/roadmap.

---

## Architecture & Tech Stack

CareerLens is built as a multi-container Dockerized application:

*   **Frontend**: Next.js (React, TypeScript, Tailwind CSS) static export served via **Nginx** (configured as a reverse proxy for API routing to the backend).
*   **Backend**: Flask (Python) with `Flask-CORS`, `requests`, and `prometheus-client`.
*   **Observability**: **Prometheus** for scraping metrics and **Grafana** for dashboard visualization.
*   **Infrastructure**: **AWS EC2** provisioned via **Terraform**.
*   **CI/CD**: **GitHub Actions** for building, pushing to Docker Hub, and deploying automatically over SSH.

---

## Repository Layout

```text
CareerLens/
├── .github/workflows/
│   └── deploy.yml          # CI/CD deployment workflow
├── backend/
│   ├── app.py              # Flask backend source code
│   ├── Dockerfile
│   └── .dockerignore       # Prevents local .env from baking into image
├── frontend/
│   ├── src/                # Next.js frontend pages & components
│   ├── public/
│   ├── nginx.conf          # Nginx configuration for proxying /analyze to Flask
│   └── Dockerfile
├── monitoring/
│   └── prometheus.yml      # Prometheus scraper configuration
├── scripts/
│   ├── setup.sh            # One-time host setup script (Docker installation, folder creation)
│   └── deploy.sh           # Main deployment runner script called by GHA/manually
├── terraform/
│   ├── main.tf             # Terraform resources (EC2, Security Groups)
│   ├── variables.tf
│   └── outputs.tf
├── docker-compose.yml      # Orchestrates all containers (frontend, backend, prometheus, grafana)
└── README.md
```

---

## Live Deployment Status & Monitoring

The application is deployed on AWS EC2 and is accessible via the following public endpoints:

*   **Frontend Web App**: [http://54.90.112.75:8088](http://54.90.112.75:8088)
*   **Backend API Health**: [http://54.90.112.75:5000/health](http://54.90.112.75:5000/health)
*   **Prometheus Dashboard**: [http://54.90.112.75:9090](http://54.90.112.75:9090)
*   **Grafana Dashboards**: [http://54.90.112.75:3001](http://54.90.112.75:3001) *(Credentials: admin / admin)*

---

## How to Run Locally

### Method 1: Docker Compose (Recommended)

To run the entire system locally with single-command orchestration:

```powershell
docker compose up --build
```

This will boot all 4 services:
*   Frontend: `http://localhost:8088`
*   Backend API: `http://localhost:5000` (Health at `http://localhost:5000/health`)
*   Prometheus: `http://localhost:9090`
*   Grafana: `http://localhost:3001`

> [!NOTE]
> Ensure you create a local `backend/.env` file with your `OPENROUTER_API_KEY` before running `docker compose up`.

### Method 2: Manual Run

#### 1. Backend Setup
Create `backend/.env`:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Install dependencies and run:
```powershell
cd backend
python -m pip install -r requirements.txt
python -m flask --app app run --host 0.0.0.0 --port 5000 --no-reload
```

#### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```
Visit `http://127.0.0.1:3000` to interact with the UI.

---

## Terraform Infrastructure Setup

The Terraform configuration lives in `terraform/` and provisions:
*   **EC2 Instance**: `t3.micro` on Ubuntu, with `20GB` gp3 root volume.
*   **Security Group**: Configured with public ports for SSH (22), Frontend (8088), Flask Backend (5000), Prometheus (9090), and Grafana (3001).

### Key Terraform Implementation Details
*   **SSH Access**: Ingress port 22 is open to `0.0.0.0/0`. This is required to allow GitHub Actions runner environments (which have dynamic IPs) to connect to the host for deployment.
*   **Lifecycle Ignore**: The EC2 resource block includes:
    ```hcl
    lifecycle {
      ignore_changes = [user_data]
    }
    ```
    This prevents Terraform from trying to recreate or restart the EC2 instance whenever changes to the boot-time shell script are detected. This is essential since the AWS IAM user permissions in this environment are constrained and lack `ec2:StopInstances` / `ec2:StartInstances`.

### Provisioning Commands
Configure `terraform/terraform.tfvars` with your variables (`key_name`, `repo_url`), then execute:
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

---

## CI/CD Deployment Pipeline

The workflow in `.github/workflows/deploy.yml` automates the builds and deploys upon pushing to the `main` branch.

### Deployment Workflow Steps:
1. **Build**: Compiles the backend and frontend Docker images.
2. **Push**: Uploads the tagged images (`latest` and the commit `SHA`) to Docker Hub.
3. **SSH Deploy**: Connects to the EC2 host via SSH to trigger `scripts/deploy.sh` with the relevant environmental context.

### Required GitHub Secrets
You must configure the following repository secrets under **Settings ➔ Secrets and variables ➔ Actions**:

| Secret | Description |
| :--- | :--- |
| `DOCKER_USERNAME` | Docker Hub username. |
| `DOCKER_PASSWORD` | Docker Hub password/token for pushing images. |
| `EC2_HOST` | The public IP of the target EC2 instance (`54.90.112.75`). |
| `EC2_SSH_KEY` | Private PEM key content for ssh authentication as `ubuntu`. |
| `OPENROUTER_API_KEY` | API key used by the Flask backend container to access OpenRouter models. |

---

## Essential Operations & Gotchas

> [!WARNING]
> If you are debugging deployments or updating deployment files, be aware of the following lessons learned from setting up this pipeline:

### 1. Bash Self-Modification Race (Git Pull Bug)
When executing deployment commands remotely via an SSH action runner, **never** load the `deploy.sh` script first and run `git pull` from inside it. If bash reads and compiles a script file and the file is overwritten on disk by `git pull` during runtime, bash will experience syntax or logical issues. 
*   *Fix*: The workflow checks out the repository, pulls the latest code to disk *before* executing the deploy script, or performs `git fetch origin main && git reset --hard origin/main` in the SSH command block directly before calling `bash scripts/deploy.sh`.

### 2. Preserving Environment Variables under Sudo (`sudo -E`)
Docker commands on the EC2 host require superuser privileges. However, executing `sudo docker compose` clears the shell environment variables passed from the GitHub Actions runner (like `BACKEND_IMAGE`, `FRONTEND_IMAGE`, etc.).
*   *Fix*: Always use `sudo -E docker compose` to preserve environment variables for the Docker daemon during commands like `pull` and `up`.

### 3. Docker Compose Environment Reloads (`--force-recreate`)
Docker Compose reads env files (e.g. `backend/.env`) at startup. When GHA updates the server's `backend/.env` file with a new `OPENROUTER_API_KEY`, Docker Compose does not automatically reload it if the backend container is already running.
*   *Fix*: The deploy script uses `docker compose up -d --force-recreate` to ensure the container is terminated, recreated, and loaded with the freshly written `.env` configurations.

### 4. Vercel Analytics Removal
Next.js `@vercel/analytics` was removed. In a self-hosted Nginx container environment, loading external vercel-specific packages results in incorrect resource routing, causing script load syntax errors (`Uncaught SyntaxError: expected expression, got '<'`) when served outside Vercel.
