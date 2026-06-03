#!/usr/bin/env bash
# ============================================================
# WordMemory Docker Deploy (Linux / macOS)
# ============================================================
set -euo pipefail

echo "=============================================="
echo "  WordMemory Docker Deployment"
echo "=============================================="
echo ""

# Check dependencies
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "[ERR]  $1 not found. Please install Docker Desktop or Docker Engine first."
    exit 1
  fi
  echo "[OK]   $1"
}

echo "Checking dependencies..."
check_cmd docker
check_cmd docker

# Check for docker compose (v2 uses 'docker compose', v1 uses 'docker-compose')
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
  echo "[OK]   docker compose (v2)"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
  echo "[OK]   docker-compose (v1)"
else
  echo "[ERR]  docker compose not found"
  exit 1
fi
echo ""

# Setup .env
if [ ! -f .env ]; then
  echo "[INFO] Creating .env from .env.example..."
  cp .env.example .env
  echo ""
  echo "=============================================="
  echo "  ACTION REQUIRED"
  echo "=============================================="
  echo ""
  echo "Edit .env and set CLOUDFLARE_TUNNEL_TOKEN."
  echo ""
  echo "To get a token:"
  echo "  1. Go to https://one.dash.cloudflare.com/"
  echo "  2. Networks → Tunnels → Create Tunnel"
  echo "  3. Choose 'Docker', copy the token"
  echo "  4. In Cloudflare Tunnel settings, add Public Hostname:"
  echo "     your-domain.com → http://frontend:80"
  echo ""
  read -p "Press Enter after editing .env, or Ctrl+C to cancel..."
  echo ""
fi

# Check token
if grep -q "your-tunnel-token-here" .env 2>/dev/null; then
  echo "[WARN] CLOUDFLARE_TUNNEL_TOKEN still has placeholder value."
  echo "       The site will start but won't be accessible from the internet."
  echo ""
fi

# Build and start
echo "[INFO] Building and starting containers..."
$COMPOSE up -d --build

echo ""
echo "[INFO] Waiting for services to be ready..."
sleep 5

# Health check
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT:-80}/ 2>/dev/null | grep -q 200; then
  echo "[OK]   Frontend is responding"
else
  echo "[WARN] Frontend may still be starting up..."
fi

echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo ""
echo "  Local access:  http://localhost:${FRONTEND_PORT:-80}"
echo "  Internet:      https://your-domain.com (after Cloudflare setup)"
echo ""
echo "  Useful commands:"
echo "    $COMPOSE logs -f          View logs"
echo "    $COMPOSE down             Stop all services"
echo "    $COMPOSE up -d            Restart services"
echo "    $COMPOSE restart backend  Restart backend only"
echo ""
