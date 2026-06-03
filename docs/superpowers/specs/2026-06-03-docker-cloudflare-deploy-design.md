# Design Spec: Docker 容器化部署 + Cloudflare Tunnel

**日期:** 2026-06-03
**状态:** 设计已确认

---

## 概述

将 WordMemory 容器化，通过 Cloudflare Tunnel 实现互联网域名访问，支持一键部署。

## 架构

```
internet ──→ cloudflared (Tunnel) ──→ frontend-nginx (:80)
                                        ├─ /          → Vue 静态文件
                                        └─ /api/*     → backend:9000 (PHP-FPM)
                                                           │
                                                       mysql:3306
```

三个容器 + MySQL，通过 Docker Compose 编排。

## 文件清单

| 文件 | 用途 |
|------|------|
| `Dockerfile.backend` | PHP 8.3-FPM + Composer 依赖 + ThinkPHP 代码 |
| `Dockerfile.frontend` | 阶段1: Node 构建 Vue → 阶段2: Nginx 托管静态文件 + 反代 |
| `docker-compose.yml` | 4 个服务: mysql, backend, frontend, cloudflared |
| `nginx.conf` | SPA 路由 + /api 代理到 PHP-FPM |
| `.env.example` | 环境变量模板（CLOUDFLARE_TUNNEL_TOKEN 等） |
| `deploy.sh` | Linux/macOS 一键部署 |
| `deploy.ps1` | Windows 一键部署 |

## Dockerfile.backend

基于 `php:8.3-fpm-alpine`：
- 安装 `pdo_mysql` 扩展
- 复制 `backend/` 代码
- `composer install --no-dev`
- 暴露 9000（PHP-FPM）

```dockerfile
FROM php:8.3-fpm-alpine
RUN docker-php-ext-install pdo_mysql
COPY backend/ /var/www/html/
WORKDIR /var/www/html
RUN curl -sS https://getcomposer.org/installer | php && php composer.phar install --no-dev --optimize-autoloader
EXPOSE 9000
```

## Dockerfile.frontend

多阶段构建：
- 阶段1: `node:22-alpine` → `npm ci && npm run build` → 产出 `dist/`
- 阶段2: `nginx:alpine` → 复制 `dist/` + `nginx.conf`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## nginx.conf

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API proxy to PHP-FPM
    location /api/ {
        proxy_pass http://backend:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## docker-compose.yml

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-wordmemory}
      MYSQL_DATABASE: wordmemory
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: wordmemory
      DB_USER: root
      DB_PASS: ${MYSQL_ROOT_PASSWORD:-wordmemory}

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - frontend

volumes:
  mysql_data:
```

## 环境变量 (.env)

```bash
# Cloudflare Tunnel Token (在 Cloudflare Zero Trust 创建 Tunnel 后获取)
CLOUDFLARE_TUNNEL_TOKEN=your-token-here

# MySQL root 密码（可选，默认 wordmemory）
MYSQL_ROOT_PASSWORD=your-password-here
```

## 部署脚本

### deploy.sh（Linux/macOS）

1. 检查 Docker / Docker Compose 是否安装
2. 从 `.env.example` 复制 `.env`（如果不存在）
3. 提示用户填入 `CLOUDFLARE_TUNNEL_TOKEN`
4. `docker compose up -d --build`
5. 等待健康检查通过
6. 输出访问地址

### deploy.ps1（Windows）

同上，PowerShell 语法。

## Cloudflare 配置步骤（一次性）

1. 注册 Cloudflare，添加域名，改 NS 服务器
2. Cloudflare Zero Trust → Networks → Tunnels → Create Tunnel
3. 选择 Docker，复制 Tunnel Token
4. 在 Tunnel 的 Public Hostname 中配置：`你的域名` → `http://frontend:80`

## 验收标准

1. `docker compose up -d --build` 一次性启动所有服务
2. `curl http://localhost/api/modules` 返回 JSON
3. `curl http://localhost/` 返回 Vue 页面
4. Cloudflare Tunnel 连接后，`https://你的域名` 可访问
5. 数据重启不丢失（`docker compose down && up -d` 后数据还在）
6. `deploy.sh` 和 `deploy.ps1` 可在未配置环境中引导完成部署
