# ============================================================
# WordMemory Docker Deploy (Windows PowerShell)
# ============================================================
$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host "  WordMemory Docker Deployment"
Write-Host "=============================================="
Write-Host ""

# Check dependencies
Write-Host "Checking dependencies..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERR]   Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "[OK]    docker" -ForegroundColor Green

# Check for docker compose
$composeCmd = $null
if (docker compose version 2>$null) {
    $composeCmd = "docker compose"
    Write-Host "[OK]    docker compose (v2)" -ForegroundColor Green
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
    Write-Host "[OK]    docker-compose (v1)" -ForegroundColor Green
} else {
    Write-Host "[ERR]   docker compose not found" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Setup .env
if (-not (Test-Path ".env")) {
    Write-Host "[INFO]  Creating .env from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host ""
    Write-Host "=============================================="
    Write-Host "  ACTION REQUIRED"
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "Edit .env and set CLOUDFLARE_TUNNEL_TOKEN."
    Write-Host ""
    Write-Host "To get a token:"
    Write-Host "  1. Go to https://one.dash.cloudflare.com/"
    Write-Host "  2. Networks -> Tunnels -> Create Tunnel"
    Write-Host "  3. Choose 'Docker', copy the token"
    Write-Host "  4. In Cloudflare Tunnel settings, add Public Hostname:"
    Write-Host "     your-domain.com -> http://frontend:80"
    Write-Host ""
    Write-Host "Press Enter after editing .env, or Ctrl+C to cancel..."
    Read-Host
    Write-Host ""
}

# Check token
$envContent = Get-Content .env -Raw
if ($envContent -match "your-tunnel-token-here") {
    Write-Host "[WARN]  CLOUDFLARE_TUNNEL_TOKEN still has placeholder value." -ForegroundColor Yellow
    Write-Host "        The site will start but won't be accessible from the internet."
    Write-Host ""
}

# Build and start
Write-Host "[INFO]  Building and starting containers..." -ForegroundColor Cyan
Invoke-Expression "$composeCmd up -d --build"

Write-Host ""
Write-Host "[INFO]  Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Health check
try {
    $port = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "80" }
    $response = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK]    Frontend is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN]  Frontend may still be starting up..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Deployment Complete!"
Write-Host "=============================================="
Write-Host ""
Write-Host "  Local access:  http://localhost:$port"
Write-Host "  Internet:      https://your-domain.com (after Cloudflare setup)"
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    $composeCmd logs -f          View logs"
Write-Host "    $composeCmd down             Stop all services"
Write-Host "    $composeCmd up -d            Restart services"
Write-Host "    $composeCmd restart backend  Restart backend only"
Write-Host ""
