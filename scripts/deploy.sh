#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/careerlens}"
MAX_RETRIES="${MAX_RETRIES:-10}"
RETRY_DELAY="${RETRY_DELAY:-3}"
BACKEND_IMAGE="${BACKEND_IMAGE:-}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
DOCKER_PASSWORD="${DOCKER_PASSWORD:-}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"

compose() {
  if sudo -E docker compose version >/dev/null 2>&1; then
    sudo -E docker compose "$@"
  else
    sudo -E docker-compose "$@"
  fi
}

echo "========================================="
echo "  CareerLens - Deploy Script"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Repository not found at $APP_DIR"
  exit 1
fi

echo "[1/4] Pulling latest code from main..."
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main
echo "  Git SHA: $(git rev-parse --short HEAD)"

if [ -n "$BACKEND_IMAGE" ] && [ -n "$FRONTEND_IMAGE" ]; then
  # Write real backend .env (overrides placeholder from setup.sh)
  if [ -n "$OPENROUTER_API_KEY" ]; then
    echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" > "$APP_DIR/backend/.env"
    chmod 600 "$APP_DIR/backend/.env"
    echo "  Written backend/.env with real API key."
  fi
  echo "[2/4] Logging in to Docker Hub and pulling release images..."
  echo "$DOCKER_PASSWORD" | sudo -E docker login -u "$DOCKER_USERNAME" --password-stdin
  compose pull backend frontend
  echo "  Backend image:  $BACKEND_IMAGE"
  echo "  Frontend image: $FRONTEND_IMAGE"
  echo "[3/4] Starting containers from pulled images..."
  compose up -d --remove-orphans
else
  echo "[2/4] Rebuilding containers from source..."
  compose up -d --build --remove-orphans
fi

echo "[3/4] Waiting for backend health..."
attempt=1
until curl -sf http://localhost:5000/health >/dev/null; do
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "  Health check failed after $MAX_RETRIES attempts."
    echo "  Check backend logs with: docker compose logs -f backend"
    exit 1
  fi

  echo "  Waiting for backend... (attempt $attempt/$MAX_RETRIES)"
  attempt=$((attempt + 1))
  sleep "$RETRY_DELAY"
done

echo "[4/4] Deployment successful."
echo "  Backend:    http://localhost:5000/health"
echo "  Frontend:   http://localhost:8088"
echo "  Prometheus:  http://localhost:9090"
echo "  Grafana:     http://localhost:3001"
