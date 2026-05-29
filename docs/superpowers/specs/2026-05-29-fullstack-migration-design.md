# WordMemory Full-Stack Migration Spec

**Date:** 2026-05-29
**Status:** approved

## Overview

Migrate wordmemory from a browser-only app (IndexedDB + localStorage) to a full-stack architecture:
- **Frontend:** Vue 3 SPA with Vue Router + Axios + Pinia
- **Backend:** ThinkPHP 8 REST API with JWT authentication
- **Database:** MySQL for all persistent data

All existing features retained. Existing UI/interaction design preserved in Vue components.

---

## Architecture

```
┌──────────────┐     REST API (JSON)    ┌──────────────┐     ┌───────┐
│  Vue 3 SPA    │ ◄───────────────────► │  ThinkPHP 8   │ ◄──► │ MySQL │
│  :5173 (dev)  │   Bearer JWT Token    │  :8080        │     │       │
└──────────────┘                       └──────────────┘     └───────┘
```

- Frontend and backend are separate services (前后端分离)
- All API communication is JSON over HTTP
- JWT token stored in localStorage, sent via `Authorization: Bearer <token>`

---

## Database Design

### Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| username | VARCHAR(50) UNIQUE | |
| email | VARCHAR(100) UNIQUE | |
| password | VARCHAR(255) | bcrypt hashed |
| role | ENUM('user','admin') DEFAULT 'user' | user or admin |
| status | TINYINT DEFAULT 1 | 1=active, 0=disabled |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**modules** (词库模块)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(100) UNIQUE | e.g. "考研高频单词" |
| file_name | VARCHAR(200) | original JSON filename |
| created_at | DATETIME | |

**words**
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| module_id | INT FK → modules.id | |
| word | VARCHAR(200) | the English word |
| definitions | TEXT | JSON array of Chinese definitions |
| INDEX | (module_id) | |

**user_modules** (user imported modules)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| user_id | INT FK → users.id | |
| module_id | INT FK → modules.id | |
| imported_at | DATETIME | |
| UNIQUE | (user_id, module_id) | |

**user_words** (user word mastery progress)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| user_id | INT FK → users.id | |
| word_id | INT FK → words.id | |
| status | TINYINT | 0=not learned, 1=learned (marked "会") |
| learn_count | INT DEFAULT 0 | total times this word appeared in memory |
| correct_count | INT DEFAULT 0 | times user clicked "会" |
| last_seen_at | DATETIME | |
| UNIQUE | (user_id, word_id) | |

**user_errors** (生词本 / error book)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AUTO_INCREMENT | |
| user_id | INT FK → users.id | |
| word_id | INT FK → words.id | |
| error_count | INT DEFAULT 1 | number of times marked wrong |
| last_error_time | DATETIME | |
| is_cleared | TINYINT DEFAULT 0 | 1 = user "cleared" error book (soft delete) |
| UNIQUE | (user_id, word_id) | |

---

## API Design

All endpoints except `/api/register` and `/api/login` require `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/register` | `{username, email, password}` | `{token, user}` |
| POST | `/api/login` | `{username, password}` | `{token, user}` |
| POST | `/api/change-password` | `{old_password, new_password}` | `{message}` |

### Modules (词库)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/modules` | List all available modules |
| POST | `/api/user/modules` | `{module_id}` — user imports a module |
| GET | `/api/user/modules` | List user's imported modules |

### Words (单词)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/words?module_id=&count=&exclude_mastered=` | Get N words for memory session. `exclude_mastered` weights: mastered words have lower probability but still appear. |

### Memory Progress

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/words/{id}/learned` | `{status: 1\|0}` | Mark word as known (会) or not (不会). Updates user_words and user_errors. |

### Error Book (生词本)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/errors?sort=&order=` | Get user's error book (is_cleared=0) |
| DELETE | `/api/errors` | Soft-clear all errors (set is_cleared=1) |

### Admin API (require role=admin)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/admin/login` | `{username, password}` — admin login, returns token |
| GET | `/api/admin/users?page=&keyword=` | Paginated user list with search |
| PUT | `/api/admin/users/{id}` | Update user status (disable/enable) |
| DELETE | `/api/admin/users/{id}` | Delete user and all related data |
| GET | `/api/admin/modules` | List all modules |
| POST | `/api/admin/modules` | `{name, words[]}` — create module |
| PUT | `/api/admin/modules/{id}` | Update module name |
| DELETE | `/api/admin/modules/{id}` | Delete module and its words |
| POST | `/api/admin/modules/{id}/words` | `{word, definitions[]}` — add word |
| PUT | `/api/admin/words/{id}` | Update word + definitions |
| DELETE | `/api/admin/words/{id}` | Delete word |
| GET | `/api/admin/users/{id}/data` | View user's imported modules, error book stats, memory progress |

---

## Frontend (Vue 3)

### Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/login` | LoginPage | Login form |
| `/register` | RegisterPage | Register form |
| `/` | MainLayout | Requires auth |
| `/memory` | MemoryPage | Word memory mode (ported from current) |
| `/quiz` | QuizPage | Word quiz mode (ported from current) |
| `/errorbook` | ErrorBookPage | Error book (ported from current) |
| `/settings` | SettingsPage | Change password, etc. |
| `/admin/*` | AdminLayout | Requires admin role |

- Router guard: if no token → redirect `/login`
- After login → redirect to `/memory`

### State Management (Pinia)

| Store | Data |
|-------|------|
| `useAuthStore` | user, token, login(), logout(), register() |
| `useModuleStore` | modules, userModules, importModule() |
| `useMemoryStore` | current session words, progress |

### API Layer (Axios)

- Base URL: configurable (default `http://localhost:8080/api`)
- Interceptor: auto-attach Bearer token
- Response interceptor: 401 → redirect to login

### Component Migration

Existing vanilla JS UI logic ported to Vue components with same visual design:
- Memory card: word display, 会/不会/下一个 buttons, quiz interleaving
- Quiz card: input field, feedback, wrong words end screen
- Error book: sortable table, PDF export, clear button
- Upload: JSON file import → sends to backend API

### Word Selection Algorithm (user_words weighting)

When fetching words for a memory session:
1. Query words from module where user hasn't mastered (status=0), ordered randomly
2. Mix in a small ratio (e.g. 10-20%) of mastered words (status=1) for review
3. Error book words get priority in quiz mode

---

## Backend (ThinkPHP 8)

### Directory Structure

```
backend/
├── app/
│   ├── controller/
│   │   ├── Auth.php          # register, login, changePassword
│   │   ├── Module.php        # list, import
│   │   ├── Word.php          # getWords, markLearned
│   │   ├── ErrorBook.php     # index, clear
│   │   └── admin/
│   │       ├── User.php      # list, disable, delete
│   │       ├── Module.php    # CRUD modules + words
│   │       └── UserData.php  # view user-uploaded data
│   ├── model/
│   │   ├── User.php
│   │   ├── Module.php
│   │   ├── Word.php
│   │   ├── UserWord.php
│   │   └── UserError.php
│   └── middleware/
│       ├── JwtAuth.php       # JWT token verification (user)
│       └── AdminAuth.php     # JWT + role=admin check
├── config/
│   └── database.php
├── route/
│   └── app.php               # All API routes
└── public/
    └── index.php
```

### Authentication

- JWT via `firebase/php-jwt` composer package
- Token expiry: 7 days
- Password: bcrypt via PHP `password_hash()`

### Seed Data

- On first run, import `kaoyan.json` and `example.json` into `modules` + `words` tables
- Write a CLI command or migration script for this

### Default Admin Account

On database initialization, create default admin:

- **Admin panel path:** `/admin` (frontend route, redirects to admin login if not authenticated)
- **Admin login API:** `POST /api/admin/login`
- **Default account:** `admin` / `admin123` (prompt to change on first login)
- Only users with `role=admin` can access admin APIs and admin frontend pages

---

## Migration Summary

| Old (Browser-only) | New (Full-stack) |
|------|------|
| IndexedDB `vocabulary` store | MySQL `words` + `user_words` |
| IndexedDB `errorBook` store | MySQL `user_errors` |
| IndexedDB `modules` store | MySQL `modules` + `user_modules` |
| No auth | JWT login/register |
| JSON files for word bank | MySQL seeded from JSON |
| `fetch()` local files | Axios API calls |
| IIFE JS modules | Vue 3 SFC components |

---

## Files (New Repository Layout)

```
wordmemory/
├── frontend/              # Vue 3 project (create via `npm create vue@latest`)
│   └── src/
│       ├── views/
│       ├── api/
│       ├── stores/
│       └── router/
├── backend/               # ThinkPHP 8 (create via `composer create-project`)
│   └── app/
├── database/
│   └── schema.sql
└── data/                  # Original JSON word files (used for seeding)
    ├── kaoyan.json
    └── example.json
```

## Dependencies

**Backend:**
- PHP 8.1+
- Composer: `topthink/framework` (ThinkPHP 8), `firebase/php-jwt`
- MySQL 5.7+

**Frontend:**
- Vue 3, Vue Router 4, Pinia, Axios
- jsPDF + html2canvas (retained for PDF export)
