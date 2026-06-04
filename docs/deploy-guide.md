# WordMemory 部署与维护指南

## 目录

- [架构概览](#架构概览)
- [日常管理命令](#日常管理命令)
- [代码更新流程](#代码更新流程)
- [数据备份与恢复](#数据备份与恢复)
- [调试与排查](#调试与排查)
- [环境变量说明](#环境变量说明)

---

## 架构概览

```
互联网 → Cloudflare Tunnel (cloudflared) → Nginx :80
                                              ├─ /       → Vue SPA 静态文件
                                              └─ /api/*  → PHP :9000
                                                              │
                                                          MySQL :3306
```

四个 Docker 容器通过 `docker-compose.yml` 编排，容器间通过服务名通信。

---

## 日常管理命令

所有命令在项目根目录 `/home/lu/wordsMemory` 下执行。

### 服务控制

```bash
# 启动所有服务（首次构建或强制重建）
docker compose up -d --build

# 启动所有服务（不重建，使用已有镜像）
docker compose up -d

# 停止所有服务
docker compose down

# 重启某个服务
docker compose restart backend
docker compose restart frontend
docker compose restart cloudflared

# 查看所有容器状态
docker compose ps
```

### 日志查看

```bash
# 查看所有服务日志（实时刷新）
docker compose logs -f

# 只看某个服务的日志
docker compose logs -f backend
docker compose logs -f cloudflared

# 查看最近 50 行
docker compose logs --tail 50 backend
```

### 进入容器调试

```bash
# 进入后端容器
docker compose exec backend sh

# 进入数据库
docker compose exec mysql mysql -u root -p wordmemory
# 密码见 .env 中的 MYSQL_ROOT_PASSWORD
```

---

## 代码更新流程

### 仅前端代码更新

```bash
# 拉取最新代码
git pull

# 重新构建并重启前端（后端不受影响）
docker compose up -d --build frontend
```

### 仅后端代码更新

```bash
git pull

# 重新构建并重启后端
docker compose up -d --build backend

# 如果有新的词库数据，重新导入
docker compose exec backend php think seed:words
```

### 前后端都更新

```bash
git pull

# 重建所有本地镜像并重启
docker compose up -d --build
```

### Dockerfile 或依赖更新（package.json / composer.json 变更）

```bash
git pull

# 强制无缓存重建（确保全新依赖）
docker compose build --no-cache
docker compose up -d
```

### 汇总：更新一行命令

```bash
git pull && docker compose up -d --build
```

> 首次构建较慢（需安装依赖），后续构建会利用 Docker 缓存，通常 30 秒内完成。

---

## 数据备份与恢复

数据库数据存储在 Docker Volume 中，`docker compose down` 不会删除。

### 备份数据库

```bash
# 导出 SQL 到文件
docker compose exec mysql mysqldump -u root -p wordmemory > backup_$(date +%Y%m%d).sql
# 提示输入密码（见 .env 中 MYSQL_ROOT_PASSWORD）
```

### 恢复数据库

```bash
# 先清空旧数据
docker compose down -v   # ⚠️ 会删除所有数据！先确保有备份

# 重新启动
docker compose up -d

# 导入备份
docker compose exec -T mysql mysql -u root -p wordmemory < backup_20260604.sql
```

### 仅停止服务不删数据

```bash
docker compose down          # 数据保留
docker compose up -d         # 重新启动，数据还在
```

---

## 调试与排查

### 检查服务是否运行

```bash
docker compose ps
# 所有服务 STATUS 应该是 Up 或 Up (healthy)
```

### 检查 Cloudflare Tunnel 是否连接

```bash
docker compose logs cloudflared | grep "Registered tunnel"
# 看到 "Registered tunnel connection" 说明已连接
```

### 本地测试（不经过域名）

```bash
# 测试前端页面
curl -s http://localhost/ | head

# 测试后端 API（会返回 401 未登录，说明后端正常）
curl -s http://localhost/api/modules
```

### 后端 .env 有问题时

```bash
# 手动触发 .env 生成和数据库导入
docker compose exec backend sh -c "envsubst < /var/www/html/.env.docker > /var/www/html/.env && php think seed:words"
```

### 完全重置

```bash
# 停止并删除所有容器、网络、数据卷
docker compose down -v

# 重新构建并启动
docker compose up -d --build
```

---

## 环境变量说明

`.env` 文件位于项目根目录：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 令牌（必填） | 无 |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | `wordmemory` |
| `JWT_KEY` | JWT 签名密钥（生产环境请更换） | `change-me-in-production` |
| `FRONTEND_PORT` | 前端对外端口 | `80` |

修改 `.env` 后需要重启服务：

```bash
docker compose up -d
```

---

## 常见问题

**Q: 修改了前端代码但网页没变化？**

A: 可能是 Docker 使用了缓存。执行 `docker compose up -d --build frontend` 强制重建。

**Q: Cloudflare Tunnel 连不上？**

A: 先看日志 `docker compose logs cloudflared`。国内 QUIC 常不通，已强制使用 HTTP/2。如果 `Registered tunnel connection` 出现说明连接正常；域名访问不了需检查 Cloudflare 后台 Public Hostname 配置。

**Q: 端口 80 被占用？**

A: 修改 `.env` 中 `FRONTEND_PORT=8080`，然后 `docker compose up -d`。

**Q: 如何升级到新版本？**

A: 拉取 `main` 库并停止、删除、重新构建、重新启动容器，具体方法见下方。确保先拉取最新代码，然后重新构建，不要只挂载新代码到已有容器上。

> **重要：** 更新代码时，务必使用 `git pull` 拉取最新代码后，执行 `docker compose up -d --build` 重建容器。不要只把代码复制到容器内，因为容器重启后会恢复为镜像中的旧代码。
