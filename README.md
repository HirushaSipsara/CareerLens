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

## Next Steps

- Add Dockerfiles and `docker-compose.yml`
- Add deployment scripts
- Add Terraform for AWS infrastructure
- Add GitHub Actions CI/CD
- Add Prometheus and Grafana containers for monitoring

## Notes

- The frontend expects the backend at `http://localhost:5000` by default.
- You can override that with `NEXT_PUBLIC_API_BASE_URL` if needed.
- Do not commit `backend/.env`.
