# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

WordMemory is a vocabulary memorization SPA with a **Vue 3 frontend** (port 9999, Vite), **ThinkPHP 8 backend** (port 8080), and **MySQL 8.4** database.

```
browser → localhost:9999 (Vite dev server, proxies /api → backend)
              ↓
         localhost:8080 (PHP built-in server, ThinkPHP 8)
              ↓
         MySQL 8.4 (wordmemory database, root/no-password)
```

### Backend (`backend/`)

- **Framework:** ThinkPHP 8, PHP 8.3
- **Entry point:** `backend/public/index.php` → `router.php` (for PHP built-in dev server)
- **Routes:** `backend/route/app.php` — public routes + JWT-protected user routes + admin routes
- **Auth:** JWT (`firebase/php-jwt`), 7-day expiry. Middleware: `JwtAuth` (injects `Request->userId`), `AdminAuth` (checks `role === 'admin'`)
- **Models:** `users`, `modules`, `words`, `user_words`, `user_errors`, `user_modules`
- **Seed command:** `php think seed:words` — imports JSON files from `data/*.json` into `modules` + `words` tables. Reads `data/modules.json` for display names. Handles optional `Phonetic` field.
- **API response format:** `{ code: 0, data: ... }` on success, `{ code: 400, msg: "..." }` on error. HTTP status is always 200 — the `code` field distinguishes success from error.

### Frontend (`frontend/`)

- **Stack:** Vue 3 (Composition API, `<script setup>`), Pinia, Vue Router, Axios, Vite
- **Dev server:** Vite on port 9999 with `host: '0.0.0.0'` (accessible from LAN/mobile) and proxy `/api` → `localhost:8080`
- **API client:** `src/api/request.js` — Axios instance with `baseURL: '/api'` (relative, relies on Vite proxy). Response interceptor rejects on `code !== 0`, unwraps `res.data` on success
- **Auth:** JWT stored in localStorage. `JwtAuth` middleware injects `userId` via token
- **Router:** `src/router/index.js` — auth guard via `meta.auth`, admin guard via `meta.admin`
- **Pages:** Memory (flashcard learning), Quiz (write-in testing), ErrorBook (review mistakes), Settings, Admin (user/module management)
- **CSS:** Glassmorphism design system (`main.css`) with CSS custom properties, 768px/480px `@media` breakpoints for mobile

### Database

- **Connection:** `127.0.0.1:3306`, user `root`, no password, database `wordmemory`
- **Schema:** `database/schema.sql` — authoritative table definitions
- **Setup scripts:** `setup/setup.sh` (bash) and `setup/setup.ps1` (PowerShell) — one-click init that creates tables, seeds data, and starts both servers

## Commands

```bash
# Backend
cd backend && php think run -p 8080          # Start PHP dev server (ThinkPHP built-in)
php think seed:words                          # Re-import all word data from data/*.json

# Frontend
cd frontend && npm run dev                    # Start Vite dev server (runs on port 9999)
cd frontend && npx vitest run                 # Run 40 unit tests
cd frontend && npx vite build                 # Production build

# Database (MySQL must be running on port 3306)
mysql -u root wordmemory                      # Connect to database
mysql -u root -e "SHOW TABLES FROM wordmemory"

# One-click setup
bash setup/setup.sh                           # Full setup: deps → DB → seed → start services
```

## Key Patterns & Gotchas

### API calls: code !== 0 vs HTTP status

The backend always returns HTTP 200. The `code` field (not HTTP status) determines success:
- `code: 0` = success, `data` contains the payload
- `code: 400` = error, `msg` contains the error message

The frontend interceptor (`request.js`) rejects promises on `code !== 0` so callers can use try/catch with `e.response.data.msg`.

### JWT userId injection

`JwtAuth` middleware decodes the JWT and sets `Request->userId`. All authenticated controllers read it via `Request::instance()->userId`. The `GET /api/modules` endpoint uses `$userId ?? 0` to work for unauthenticated requests too.

### Module progress data

`GET /api/modules` returns `words_count` (via `withCount('words')`) and `learned_count` (subquery on `user_words` where `status=1`). The frontend uses these for the progress bar and dropdown display.

### User words schema

The `user_words` table has no `module_id` column (removed to match `schema.sql`). Module association lives in `user_modules`. Progress tracking uses `user_words.status=1` for learned, `user_words.learn_count` and `correct_count` for statistics.

### Composer on Windows

Composer may be installed as an extensionless PHAR file. The setup scripts include a fallback: if `command -v composer` (bash) or `Get-Command composer` (PowerShell) fails, they check for a `composer` PHAR alongside the PHP binary and auto-create a `.bat` wrapper.

### PHP extensions

Requires `pdo_mysql`. If not loaded, create `php.ini` alongside `php` binary pointing `extension_dir` to the WinGet PHP ext directory and enabling `extension=pdo_mysql`.
