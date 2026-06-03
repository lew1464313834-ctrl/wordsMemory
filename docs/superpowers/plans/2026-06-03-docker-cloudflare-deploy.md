# Docker + Cloudflare Tunnel Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Containerized deployment with one-command startup, Cloudflare Tunnel for public internet access via custom domain.

**Architecture:** 4 Docker Compose services (mysql, backend PHP-FPM, frontend Nginx + static files, cloudflared). Nginx handles both SPA static serving and `/api` reverse proxy.

**Tech Stack:** Docker, Docker Compose, PHP 8.3-FPM Alpine, Nginx Alpine, MySQL 8.4, Cloudflare cloudflared

---

### Task 1: Dockerfile.backend — PHP-FPM container

**Files:**
- Create: `Dockerfile.backend`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create backend .dockerignore**

Only needed to exclude the vendor dir from the COPY (we'll run composer install in the container).

```
vendor/
runtime/
.env
```

- [ ] **Step 2: Create Dockerfile.backend**

```dockerfile
FROM php:8.3-fpm-alpine

RUN apk add --no-cache curl && \
    docker-php-ext-install pdo_mysql

COPY backend/ /var/www/html/
WORKDIR /var/www/html

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer && \
    composer install --no-dev --no-interaction --optimize-autoloader && \
    rm /usr/local/bin/composer

EXPOSE 9000
CMD ["php-fpm"]
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile.backend backend/.dockerignore
git commit -m "feat: add Dockerfile for PHP-FPM backend"
```

---

### Task 2: Dockerfile.frontend + nginx.conf — Nginx static + reverse proxy

**Files:**
- Create: `Dockerfile.frontend`
- Create: `nginx.conf`

- [ ] **Step 1: Create Dockerfile.frontend**

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

- [ ] **Step 2: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback for Vue Router (history mode)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy to PHP-FPM backend
    location /api/ {
        proxy_pass http://backend:9000/index.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note: PHP-FPM on port 9000 serves via FastCGI, not HTTP. The Nginx → PHP-FPM proxy should use FastCGI, not `proxy_pass`. But for the PHP built-in dev server approach, we need an HTTP server. Since ThinkPHP's `php think run` starts a dev HTTP server on 8080, we need the backend to start that instead of FPM.

Actually — let's reconsider. The backend should start with `php think run -p 9000` (ThinkPHP built-in HTTP server) instead of FPM. This avoids the FastCGI complexity. Let me update:

Actually wait, let me use a simpler approach. The Dockerfile.backend should start ThinkPHP's built-in server on port 9000. Then nginx uses `proxy_pass http://backend:9000;`.

