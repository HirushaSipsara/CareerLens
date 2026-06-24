#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/careerlens}"
REPO_URL="${REPO_URL:-https://github.com/HirushaSipsara/CareerLens}"
ENV_FILE="$APP_DIR/backend/.env"

echo "========================================="
echo "  CareerLens - Server Setup Script"
echo "========================================="

echo "[1/6] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "[2/6] Installing Docker prerequisites..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

if ! command -v docker >/dev/null 2>&1; then
  echo "  Installing Docker Engine..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "  Docker is already installed."
fi

sudo usermod -aG docker "$USER" || true

echo "[3/6] Verifying Docker Compose..."
if docker compose version >/dev/null 2>&1; then
  echo "  Docker Compose plugin is available."
else
  echo "  Docker Compose plugin was not detected."
  exit 1
fi

echo "[4/6] Checking repository checkout..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo already exists - skipping clone."
elif [ -d "$APP_DIR" ]; then
  echo "  $APP_DIR exists but is not a git repo."
  exit 1
else
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "[5/6] Setting up backend environment file..."
mkdir -p "$(dirname "$ENV_FILE")"
if [ -f "$ENV_FILE" ]; then
  echo "  .env already exists - skipping."
else
  cat > "$ENV_FILE" <<'EOF'
OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY_HERE
EOF
  chmod 600 "$ENV_FILE" || true
  echo "  Created $ENV_FILE"
fi

echo "[6/6] Finalizing..."
echo ""
echo "========================================="
echo "  Setup complete."
echo "  Next:"
echo "    cd $APP_DIR"
echo "    bash scripts/deploy.sh"
echo "========================================="
