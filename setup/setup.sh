#!/usr/bin/env bash
# ============================================================
# WordMemory 一键启动脚本 (Linux / macOS / Git Bash)
# ============================================================
# 用法: bash setup/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# --------------- 颜色 ---------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

# --------------- 工具函数 ---------------
# 读取 .env 中的单个值
read_env() {
  local key="$1"
  local default="${2:-}"
  local file="$BACKEND_DIR/.env"
  if [[ -f "$file" ]]; then
    local val
    val=$(grep -oP "^\s*${key}\s*=\s*\K.*" "$file" 2>/dev/null | head -1 || echo "")
    if [[ -n "$val" ]]; then
      echo "$val"
      return
    fi
  fi
  echo "$default"
}

# 用 PHP 执行一段代码（不依赖 ThinkPHP 框架，手动 boot .env）
php_eval() {
  local code="$1"
  php -r "
    // Parse .env manually (avoid ThinkPHP env() dependency)
    \$env = [];
    \$envFile = '$BACKEND_DIR/.env';
    if (file_exists(\$envFile)) {
      foreach (file(\$envFile) as \$line) {
        if (preg_match('/^\s*([^#][^=]+)=(.*)/', \$line, \$m)) {
          \$env[trim(\$m[1])] = trim(\$m[2]);
        }
      }
    }
    // Expose env vars
    \$DB_HOST = \$env['DB_HOST'] ?? '127.0.0.1';
    \$DB_PORT = \$env['DB_PORT'] ?? '3306';
    \$DB_NAME = \$env['DB_NAME'] ?? 'wordmemory';
    \$DB_USER = \$env['DB_USER'] ?? 'root';
    \$DB_PASS = \$env['DB_PASS'] ?? '';
    ${code}
  "
}

# --------------- 检查依赖 ---------------
check_deps() {
  info "检查运行依赖…"
  local missing=()

  if ! command -v php &>/dev/null; then
    missing+=("php (>=8.0)")
  else
    local php_ver
    php_ver=$(php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;")
    local major="${php_ver%%.*}"
    if [[ "$major" -lt 8 ]]; then
      err "PHP 版本需要 >=8.0，当前: ${php_ver}"
      missing+=("php>=8.0")
    else
      ok "PHP ${php_ver}"
    fi
  fi

  if ! command -v composer &>/dev/null; then
    # Fallback: check for composer PHAR alongside PHP binary
    local php_dir
    php_dir=$(dirname "$(command -v php)" 2>/dev/null || true)
    if [[ -n "$php_dir" ]] && [[ -f "$php_dir/composer" ]]; then
      chmod +x "$php_dir/composer" 2>/dev/null || true
      ok "Composer 已安装 (PHAR)"
    else
      missing+=("composer")
    fi
  else
    ok "Composer 已安装"
  fi

  if ! command -v node &>/dev/null; then
    missing+=("node.js")
  else
    ok "Node.js $(node -v)"
  fi

  if ! command -v mysql &>/dev/null; then
    warn "未检测到 mysql 命令行工具，将使用 PHP PDO 连接数据库"
  else
    ok "MySQL client 已安装"
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    err "缺少以下依赖，请先安装："
    for m in "${missing[@]}"; do
      echo "    - ${m}"
    done
    echo ""
    exit 1
  fi
  echo ""
}

# --------------- 数据库连接检查 ---------------
check_mysql() {
  info "检查 MySQL 连接…"

  local result
  result=$(php_eval "
    try {
      \$pdo = new PDO(\"mysql:host=\$DB_HOST;port=\$DB_PORT;charset=utf8mb4\", \$DB_USER, \$DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      echo 'connected';
    } catch (Exception \$e) {
      echo \$e->getMessage();
    }
  " 2>&1) || true

  if [[ "$result" == "connected" ]]; then
    ok "MySQL 连接成功 (${DB_USER:-root}@${DB_HOST:-127.0.0.1}:${DB_PORT:-3306})"
    return 0
  else
    warn "MySQL 连接失败: ${result}"
    warn "将跳过数据库操作，仅启动服务（部分功能不可用）"
    return 1
  fi
}

# --------------- 创建数据库和表 ---------------
setup_database() {
  info "创建数据库…"

  local result
  result=$(php_eval "
    try {
      \$pdo = new PDO(\"mysql:host=\$DB_HOST;port=\$DB_PORT;charset=utf8mb4\", \$DB_USER, \$DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      \$pdo->exec(\"CREATE DATABASE IF NOT EXISTS \\\`\$DB_NAME\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci\");
      echo 'ok';
    } catch (Exception \$e) {
      echo \$e->getMessage();
    }
  " 2>&1) || true

  if [[ "$result" == "ok" ]]; then
    ok "数据库 '${DB_NAME:-wordmemory}' 已就绪"
  else
    err "创建数据库失败: ${result}"
    return 1
  fi
  echo ""
}

init_tables() {
  info "初始化数据表…"

  local result
  result=$(php_eval "
    try {
      \$pdo = new PDO(\"mysql:host=\$DB_HOST;port=\$DB_PORT;dbname=\$DB_NAME;charset=utf8mb4\", \$DB_USER, \$DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

      \$tables = [
        \"CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('user', 'admin') DEFAULT 'user',
          status TINYINT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB\",
        \"CREATE TABLE IF NOT EXISTS modules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          file_name VARCHAR(200),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB\",
        \"CREATE TABLE IF NOT EXISTS words (
          id INT AUTO_INCREMENT PRIMARY KEY,
          module_id INT NOT NULL,
          word VARCHAR(200) NOT NULL,
          phonetic VARCHAR(100) NULL,
          definitions TEXT NOT NULL COMMENT 'JSON array',
          INDEX idx_module (module_id),
          FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB\",
        \"CREATE TABLE IF NOT EXISTS user_modules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          module_id INT NOT NULL,
          imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_module (user_id, module_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB\",
        \"CREATE TABLE IF NOT EXISTS user_words (
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
        ) ENGINE=InnoDB\",
        \"CREATE TABLE IF NOT EXISTS user_errors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          word_id INT NOT NULL,
          error_count INT DEFAULT 1,
          last_error_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_cleared TINYINT DEFAULT 0,
          UNIQUE KEY uk_user_error (user_id, word_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
        ) ENGINE=InnoDB\",
      ];
      foreach (\$tables as \$sql) {
        \$pdo->exec(\$sql);
      }

      // Default admin account (password: admin123, bcrypt hashed)
      \$stmt = \$pdo->prepare(\"INSERT IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)\");
      \$stmt->execute(['admin', 'admin@wordmemory.local', '\$2y\$10\$GswzmnJiFBBicZ7hI7VDyu6SKWv9rp8fYEK09wD6f6PSXawvawkcK', 'admin']);

      echo 'ok';
    } catch (Exception \$e) {
      echo \$e->getMessage();
    }
  " 2>&1) || true

  if [[ "$result" == "ok" ]]; then
    ok "数据表已就绪"
  else
    err "数据表初始化失败: ${result}"
    return 1
  fi
  echo ""
}

# --------------- 安装依赖 ---------------
install_deps() {
  info "安装后端依赖 (Composer)…"
  cd "$BACKEND_DIR"
  if [[ -d vendor ]] && [[ -f composer.lock ]]; then
    ok "后端依赖已安装，跳过"
  else
    composer install --no-interaction --prefer-dist && ok "后端依赖安装完成"
  fi
  echo ""

  info "安装前端依赖 (npm)…"
  cd "$FRONTEND_DIR"
  if [[ -d node_modules ]]; then
    ok "前端依赖已安装，跳过"
  else
    npm install && ok "前端依赖安装完成"
  fi
  echo ""
}

# --------------- 导入词库数据 ---------------
seed_data() {
  info "导入词库数据…"

  local count
  count=$(php_eval "
    try {
      \$pdo = new PDO(\"mysql:host=\$DB_HOST;port=\$DB_PORT;dbname=\$DB_NAME;charset=utf8mb4\", \$DB_USER, \$DB_PASS);
      \$stmt = \$pdo->query('SELECT COUNT(*) FROM modules');
      echo \$stmt->fetchColumn();
    } catch (Exception \$e) {
      echo '0';
    }
  " 2>&1) || echo "0"

  if [[ "${count:-0}" -gt 0 ]]; then
    ok "词库数据已存在 (${count:-0} 个模块)，跳过"
  else
    cd "$BACKEND_DIR"
    php think seed:words 2>&1 && ok "词库数据导入完成" || warn "词库数据导入失败，可稍后手动执行: php think seed:words"
  fi
  echo ""
}

# --------------- 启动服务 ---------------
start_services() {
  echo "============================================"
  info "启动服务…"
  echo "============================================"
  echo ""

  info "启动后端 (PHP ThinkPHP, 端口 8080)…"
  cd "$BACKEND_DIR"
  php think run -p 8080 &
  BACKEND_PID=$!
  echo "  后端 PID: ${BACKEND_PID}"
  sleep 2

  info "启动前端 (Vite)…"
  cd "$FRONTEND_DIR"
  npm run dev &
  FRONTEND_PID=$!
  echo "  前端 PID: ${FRONTEND_PID}"

  echo ""
  echo "============================================"
  echo -e "  ${GREEN}✓ 服务已启动！${NC}"
  echo ""
  echo -e "  后端 API:  ${CYAN}http://localhost:8080${NC}"
  echo -e "  前端页面:  查看 Vite 输出中的地址"
  echo ""
  echo -e "  按 ${YELLOW}Ctrl+C${NC} 停止所有服务"
  echo "============================================"
  echo ""

  _cleaned=0
  cleanup() {
    if [[ $_cleaned -eq 1 ]]; then return; fi
    _cleaned=1
    echo ""
    info "正在停止服务…"
    kill ${BACKEND_PID:-} 2>/dev/null || true
    kill ${FRONTEND_PID:-} 2>/dev/null || true
    ok "服务已停止"
  }
  trap cleanup EXIT INT TERM

  wait
}

# --------------- 主流程 ---------------
main() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║      WordMemory 一键启动脚本             ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  # 读取配置
  DB_HOST=$(read_env "DB_HOST" "127.0.0.1")
  DB_PORT=$(read_env "DB_PORT" "3306")
  DB_NAME=$(read_env "DB_NAME" "wordmemory")
  DB_USER=$(read_env "DB_USER" "root")
  DB_PASS=$(read_env "DB_PASS" "")

  check_deps
  install_deps

  # 数据库步骤（MySQL 不可用时跳过）
  if check_mysql; then
    setup_database && init_tables && seed_data
  else
    echo ""
  fi

  start_services
}

main "$@"
