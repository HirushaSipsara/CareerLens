#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/careerlens}"
MAX_RETRIES="${MAX_RETRIES:-10}"
RETRY_DELAY="${RETRY_DELAY:-3}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
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

echo "[2/4] Rebuilding containers..."
compose up -d --build --remove-orphans

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
