# ============================================================
# WordMemory One-Click Setup (Windows PowerShell)
# ============================================================
# Usage: .\setup.ps1
# If blocked by execution policy:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir  = Split-Path -Parent $ScriptDir
$BackendDir  = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

# --------------- Helpers ---------------
function Info  { Write-Host "[INFO]  " -ForegroundColor Cyan    -NoNewline; Write-Host $args }
function OK     { Write-Host "[OK]    " -ForegroundColor Green   -NoNewline; Write-Host $args }
function Warn   { Write-Host "[WARN]  " -ForegroundColor Yellow  -NoNewline; Write-Host $args }
function Err    { Write-Host "[ERR]   " -ForegroundColor Red     -NoNewline; Write-Host $args }

# Parse .env file, return hashtable
function Read-DotEnv {
  $envFile = Join-Path $BackendDir ".env"
  $ht = @{}
  if (Test-Path $envFile) {
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
      if ($_ -match '^\s*([^#][^=]+)=(.*)') {
        $ht[$Matches[1].Trim()] = $Matches[2].Trim()
      }
    }
  }
  return $ht
}

# Run a PHP snippet with .env loaded (avoids ThinkPHP env() dependency)
function Invoke-PhpEval {
  param([string]$Code)
  $env = Read-DotEnv
  $DB_HOST = if ($env.DB_HOST) { $env.DB_HOST } else { "127.0.0.1" }
  $DB_PORT = if ($env.DB_PORT) { $env.DB_PORT } else { "3306" }
  $DB_NAME = if ($env.DB_NAME) { $env.DB_NAME } else { "wordmemory" }
  $DB_USER = if ($env.DB_USER) { $env.DB_USER } else { "root" }
  $DB_PASS = if ($env.DB_PASS) { $env.DB_PASS } else { "" }

  $fullCode = @"
\$DB_HOST = '$DB_HOST';
\$DB_PORT = '$DB_PORT';
\$DB_NAME = '$DB_NAME';
\$DB_USER = '$DB_USER';
\$DB_PASS = '$DB_PASS';
$Code
"@
  # Use temp file to avoid quoting/encoding issues
  $tmpFile = [System.IO.Path]::GetTempFileName() + ".php"
  Set-Content $tmpFile -Value $fullCode -Encoding UTF8
  $result = php -f $tmpFile 2>&1 | Out-String
  Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
  return $result.Trim()
}

# --------------- Check Dependencies ---------------
function Check-Deps {
  Info "Checking dependencies..."

  $missing = @()

  # PHP >= 8.0
  $php = Get-Command php -ErrorAction SilentlyContinue
  if (-not $php) {
    $missing += "PHP (>=8.0)"
  } else {
    try {
      $phpVer = php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"
      $major = [int]($phpVer -replace '\..*', '')
      if ($major -lt 8) {
        Err "PHP version >=8.0 required, current: $phpVer"
        $missing += "PHP>=8.0"
      } else {
        OK "PHP $phpVer"
      }
    } catch {
      Warn "Cannot detect PHP version"
    }
  }

  # Composer — check .bat/.exe first, then fallback to PHAR
  $composerFound = $false
  if (Get-Command composer -ErrorAction SilentlyContinue) {
    $composerFound = $true
    OK "Composer installed"
  } else {
    # Fallback: composer may be installed as an extensionless PHAR file,
    # which PowerShell's Get-Command won't find (PATHEXT only matches .exe/.bat/.cmd/etc.)
    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    if ($phpCmd) {
      $phpDir = Split-Path $phpCmd.Source -Parent
      $composerPhar = Join-Path $phpDir "composer"
      $composerBat  = Join-Path $phpDir "composer.bat"
      if (Test-Path $composerPhar) {
        # Auto-create composer.bat wrapper so cmd/pwsh can invoke it
        if (-not (Test-Path $composerBat)) {
          "@echo off`r`nphp `"%~dp0composer`" %*" | Out-File -FilePath $composerBat -Encoding ASCII
        }
        $composerFound = $true
        OK "Composer installed (PHAR + auto-wrapper)"
      }
    }
    if (-not $composerFound) {
      $missing += "Composer"
    }
  }

  # Node.js
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $missing += "Node.js"
  } else {
    OK "Node.js $(node -v)"
  }

  # MySQL client
  if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
    Warn "mysql CLI not found, will use PHP PDO for DB operations"
  } else {
    OK "MySQL client installed"
  }

  if ($missing.Count -gt 0) {
    Write-Host ""
    Err "Missing dependencies:"
    foreach ($m in $missing) {
      Write-Host "    - $m"
    }
    Write-Host ""
    exit 1
  }
  Write-Host ""
}

# --------------- Check MySQL ---------------
function Check-MySQL {
  Info "Checking MySQL connection..."

  $result = Invoke-PhpEval -Code @'
try {
  $pdo = new PDO("mysql:host=$DB_HOST;port=$DB_PORT;charset=utf8mb4", $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  echo 'connected';
} catch (Exception $e) {
  echo $e->getMessage();
}
'@

  if ($result -eq "connected") {
    $env = Read-DotEnv
    $h = if ($env.DB_HOST) { $env.DB_HOST } else { "127.0.0.1" }
    $p = if ($env.DB_PORT) { $env.DB_PORT } else { "3306" }
    OK "MySQL connected ($($env.DB_USER)@${h}:$p)"
    return $true
  } else {
    Warn "MySQL connection failed: $result"
    Warn "Will skip database steps (some features may not work)"
    return $false
  }
}

# --------------- Create Database ---------------
function Setup-Database {
  Info "Creating database..."

  $result = Invoke-PhpEval -Code @'
try {
  $pdo = new PDO("mysql:host=$DB_HOST;port=$DB_PORT;charset=utf8mb4", $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $pdo->exec("CREATE DATABASE IF NOT EXISTS `$DB_NAME` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  echo 'ok';
} catch (Exception $e) {
  echo $e->getMessage();
}
'@

  if ($result -eq "ok") {
    $env = Read-DotEnv
    OK "Database '$($env.DB_NAME)' ready"
  } else {
    Err "Failed to create database: $result"
    return $false
  }
  Write-Host ""
  return $true
}

# --------------- Init Tables ---------------
function Init-Tables {
  Info "Initializing database tables..."

  $result = Invoke-PhpEval -Code @'
try {
  $pdo = new PDO("mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

  $tables = [
    "CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      file_name VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS words (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_id INT NOT NULL,
      word VARCHAR(200) NOT NULL,
      phonetic VARCHAR(100) NULL,
      definitions TEXT NOT NULL COMMENT 'JSON array',
      INDEX idx_module (module_id),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS user_modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      module_id INT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_module (user_id, module_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS user_words (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      status TINYINT DEFAULT 0 COMMENT '0=not learned, 1=learned',
      learn_count INT DEFAULT 0,
      correct_count INT DEFAULT 0,
      last_seen_at DATETIME NULL,
      UNIQUE KEY uk_user_word (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS user_errors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      word_id INT NOT NULL,
      error_count INT DEFAULT 1,
      last_error_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_cleared TINYINT DEFAULT 0,
      UNIQUE KEY uk_user_error (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    ) ENGINE=InnoDB",
  ];
  foreach ($tables as $sql) {
    $pdo->exec($sql);
  }

  // Default admin account (password: admin123, bcrypt hashed)
  $stmt = $pdo->prepare(\"INSERT IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)\");
  $stmt->execute(['admin', 'admin@wordmemory.local', '\$2y\$10\$GswzmnJiFBBicZ7hI7VDyu6SKWv9rp8fYEK09wD6f6PSXawvawkcK', 'admin']);

  echo 'ok';
} catch (Exception $e) {
  echo $e->getMessage();
}
'@

  if ($result -eq "ok") {
    OK "Database tables ready"
  } else {
    Err "Failed to create tables: $result"
    return $false
  }
  Write-Host ""
  return $true
}

# --------------- Install Dependencies ---------------
function Install-Deps {
  Info "Installing backend deps (Composer)..."
  Push-Location $BackendDir
  if ((Test-Path "vendor") -and (Test-Path "composer.lock")) {
    OK "Backend deps already installed, skipping"
  } else {
    composer install --no-interaction --prefer-dist
    if ($LASTEXITCODE -ne 0) { throw "Composer install failed" }
    OK "Backend deps installed"
  }
  Pop-Location
  Write-Host ""

  Info "Installing frontend deps (npm)..."
  Push-Location $FrontendDir
  if (Test-Path "node_modules") {
    OK "Frontend deps already installed, skipping"
  } else {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    OK "Frontend deps installed"
  }
  Pop-Location
  Write-Host ""
}

# --------------- Seed Word Data ---------------
function Seed-Data {
  Info "Seeding word data..."

  $count = Invoke-PhpEval -Code @'
try {
  $pdo = new PDO("mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS);
  $stmt = $pdo->query('SELECT COUNT(*) FROM modules');
  echo $stmt->fetchColumn();
} catch (Exception $e) {
  echo '0';
}
'@

  if ([int]$count -gt 0) {
    OK "Word data already exists ($count modules), skipping"
  } else {
    Push-Location $BackendDir
    php think seed:words
    if ($LASTEXITCODE -eq 0) {
      OK "Word data seeded"
    } else {
      Warn "Seed failed. You can run manually: php think seed:words"
    }
    Pop-Location
  }
  Write-Host ""
}

# --------------- Start Services ---------------
function Start-Services {
  Write-Host "============================================"
  Info "Starting services..."
  Write-Host "============================================"
  Write-Host ""

  # Backend
  $phpExe = (Get-Command php -ErrorAction SilentlyContinue).Source
  if (-not $phpExe) { $phpExe = "php" }
  Info "Starting backend (PHP ThinkPHP, port 8080)..."
  $backendProc = Start-Process -FilePath $phpExe `
    -ArgumentList "think", "run", "-p", "8080" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Normal
  OK "Backend PID: $($backendProc.Id)"

  Start-Sleep -Seconds 2

  # Frontend
  Info "Starting frontend (Vite)..."
  $frontendProc = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory $FrontendDir `
    -PassThru `
    -WindowStyle Normal
  OK "Frontend PID: $($frontendProc.Id)"

  Write-Host ""
  Write-Host "============================================"
  Write-Host "   Services started!" -ForegroundColor Green
  Write-Host ""
  Write-Host "   Backend API: http://localhost:8080" -ForegroundColor Cyan
  Write-Host "   Frontend:    Check the Vite output window" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "   Press any key to stop all services..." -ForegroundColor Yellow
  Write-Host "============================================"
  Write-Host ""

  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

  Info "Stopping services..."
  if (-not $backendProc.HasExited)  { $backendProc.Kill() }
  if (-not $frontendProc.HasExited) { $frontendProc.Kill() }
  OK "Services stopped"
}

# --------------- Main ---------------
function Main {
  Write-Host ""
  Write-Host "=============================================="
  Write-Host "   WordMemory One-Click Setup"
  Write-Host "=============================================="
  Write-Host ""

  Check-Deps
  Install-Deps

  if (Check-MySQL) {
    $dbOk = Setup-Database
    if ($dbOk) {
      $tblOk = Init-Tables
      if ($tblOk) { Seed-Data }
    }
  } else {
    Write-Host ""
  }

  Start-Services
}

Main



