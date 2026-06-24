# CareerLens

CareerLens is a simple AI-powered web app that helps a user turn raw CV text and current skills into practical tech career guidance.

The flow is:
1. Paste CV text and a skills list in the frontend.
2. Send that data to a Flask backend.
3. Call OpenRouter with a Gemma 4 free model.
4. Return structured JSON with ranked career paths, skill gaps, and a 3-month roadmap.

## What is built so far

- React / Next.js frontend for CV and skills input
- Flask backend with `/analyze`, `/health`, and `/metrics`
- OpenRouter integration with a Gemma 4 free model fallback
- Prometheus metrics for request count and latency
- Basic project hygiene, including `.env` handling and ignore rules

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Flask, Flask-CORS, Requests, python-dotenv
- Observability: `prometheus_client`
- AI provider: OpenRouter

## Repository Layout

```text
CareerLens/
  frontend/   Next.js app
  backend/    Flask API
  README.md
```

## How to run locally

### Docker Compose

```powershell
cd F:\Projects\CareerLens
docker compose up --build
```

Open:

```text
http://localhost:8088
```

Supporting services:

- `http://localhost:5000/health`
- `http://localhost:9090`
- `http://localhost:3001`

### Frontend

```powershell
cd F:\Projects\CareerLens\frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

### Backend

Create `backend/.env`:

```env
OPENROUTER_API_KEY=your_key_here
```

Then run:

```powershell
cd F:\Projects\CareerLens\backend
python -m pip install --user -r requirements.txt
python -m flask --app app run --host 0.0.0.0 --port 5000 --no-reload
```

## API Endpoints

- `GET /health` - liveness check
- `GET /metrics` - Prometheus metrics
- `POST /analyze` - accepts `cv_text` and `skills`, returns career guidance JSON

Example payload:

```json
{
  "cv_text": "3rd year CS student...",
  "skills": "React, Java, Spring Boot, PostgreSQL"
}
```

## Current Status

- Day 1-2 frontend is in place
- Day 3-4 backend is implemented and working locally
- The backend is returning structured analysis JSON from OpenRouter
- Prometheus metrics are exposed for later monitoring work

## Automation Scripts

- `scripts/setup.sh` prepares a fresh Ubuntu EC2 instance with Docker, Compose, Git, the repo checkout, and the backend `.env` file.
- `scripts/deploy.sh` pulls the latest `main` branch and either rebuilds locally or pulls released Docker Hub images, depending on the environment.

Typical EC2 flow:

```bash
chmod +x scripts/setup.sh scripts/deploy.sh
bash scripts/setup.sh
bash scripts/deploy.sh
```

## Terraform

The Terraform config lives in `terraform/` and provisions:

- one EC2 instance
- one security group
- public ports for the frontend, backend, Prometheus, and Grafana
- the EC2 AMI is resolved from Canonical's public SSM parameter for Ubuntu

Set these in `terraform/terraform.tfvars` before applying:

- `key_name`
- `my_ip`
- `repo_url`

Then run:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Your AWS IAM user also needs `ssm:GetParameter` so Terraform can read the public Ubuntu AMI parameter.

The frontend is exposed on the public port defined in Terraform, which matches the Docker Compose setup.

## Next Steps

- Add Prometheus and Grafana containers for monitoring

## CI/CD

The GitHub Actions workflow lives in `.github/workflows/deploy.yml`.

It:

- builds the backend and frontend Docker images
- pushes both images to Docker Hub
- SSHes into the EC2 instance
- runs `scripts/deploy.sh`

Set these GitHub secrets before enabling the workflow:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `EC2_HOST`
- `EC2_SSH_KEY`

For the EC2 deploy, the workflow passes these image names into the server:

- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`

## Notes

- The frontend uses the same origin by default so the Nginx container can proxy `/analyze` to the backend.
- You can still override the backend target with `NEXT_PUBLIC_API_BASE_URL` for direct frontend runs.
- Do not commit `backend/.env`.
