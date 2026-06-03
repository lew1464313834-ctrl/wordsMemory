# WordMemory

一个基于 Vue 3 + ThinkPHP 8 + MySQL 的单词记忆 Web 应用，支持单词记忆、抽查、错题本、手机浏览器访问。

## 功能

- **单词记忆** — 选词库 → 看单词 → 点"会/不会" → 穿插错词抽查
- **单词抽查** — 写释义模式，错词导出 PDF
- **生词本** — 记录所有错误单词，可清空
- **进度追踪** — 词库选择显示已学/总量，记忆卡片显示进度条百分比
- **音标支持** — 数据含 `Phonetic` 字段时自动显示 IPA 音标
- **手机适配** — 响应式 CSS，手机浏览器可直接使用
- **管理后台** — 用户管理、词库管理、用户数据查看

## 快速启动

### 前置条件

- PHP 8.0+
- Node.js
- Composer
- MySQL 8.0+

### 一键启动

```bash
# Windows PowerShell
.\setup\setup.ps1

# Linux / macOS / Git Bash
bash setup/setup.sh
```

脚本会自动检查依赖、安装 Composer/npm 包、创建数据库和表、导入词库、启动前后端服务。

### 手动启动

```bash
# 1. 安装依赖
cd backend && composer install
cd ../frontend && npm install

# 2. 启动 MySQL（确保运行在 127.0.0.1:3306）

# 3. 创建数据库和表
mysql -u root -e "CREATE DATABASE IF NOT EXISTS wordmemory CHARACTER SET utf8mb4"
# 表由 setup 脚本或 php think seed:words 自动创建

# 4. 导入词库数据
cd backend && php think seed:words

# 5. 启动后端 (端口 8080)
cd backend/public && php -S 0.0.0.0:8080 router.php

# 6. 启动前端 (端口 9999)
cd frontend && npm run dev
```

浏览器访问 `http://localhost:9999`，手机访问 `http://<电脑IP>:9999`。

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123` |

> ⚠️ **首次登录后请立即修改管理员密码！** 进入设置页面或执行：
> ```sql
> mysql -u root wordmemory -e "UPDATE users SET password='<bcrypt-hash>' WHERE username='admin';"
> ```

管理员可访问 `/admin` 管理后台。

## 使用指南

### 首次使用

1. 注册账号或使用管理员登录
2. 进入"单词记忆"，先点"设置"导入想学的词库
3. 回到"单词记忆"，选词库、选数量，点"开始记忆"
4. 看单词 → 点"会"或"不会"，不会的单词进入错词本
5. 穿插抽查：输入中文释义，验证记忆效果

### 手机使用

电脑和手机连同一 WiFi，手机浏览器访问 `http://<电脑IP>:9999`（IP 可通过 `ipconfig` 查看）。

## 添加新词库

### 1. 准备 JSON 数据文件

在 `data/` 目录下创建 `.json` 文件，格式如下：

```json
[
  {
    "word": "example",
    "definition": ["例子", "范例"],
    "Phonetic": "/ɪɡˈzæmpəl/"
  },
  {
    "word": "vocabulary",
    "definition": ["词汇", "词汇量"]
  }
]
```

- `word` — 单词（必填）
- `definition` — 释义数组，支持多条释义（必填）
- `Phonetic` — IPA 音标（可选，没有则不显示）

### 2. 注册词库名称

编辑 `data/modules.json`，添加一条记录：

```json
[
  { "file": "your_file.json", "name": "你的词库显示名" }
]
```

### 3. 导入数据库

```bash
cd backend && php think seed:words
```

导入后在"单词记忆"下拉框即可看到新词库。如果词库已存在，需先删除数据库中的模块再重新导入：

```bash
mysql -u root wordmemory -e "DELETE FROM modules WHERE file_name='your_file.json'"
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 (Composition API), Pinia, Vue Router, Axios, Vite |
| 后端 | ThinkPHP 8, PHP 8.3, JWT 认证 |
| 数据库 | MySQL 8.4 |
| UI | 毛玻璃设计风格, CSS 自定义属性, 响应式 @media |

## 项目结构

```
wordmemory/
├── backend/                 # ThinkPHP 8 后端
│   ├── app/
│   │   ├── controller/      # Auth, Module, Word, ErrorBook, Admin
│   │   ├── model/           # User, Module, Word, UserWord, UserError, UserModule
│   │   ├── middleware/      # JwtAuth, AdminAuth
│   │   └── command/         # SeedWords — 词库导入命令
│   ├── config/              # database, jwt, app
│   └── route/app.php        # API 路由定义
├── frontend/                # Vue 3 前端
│   └── src/
│       ├── api/             # request.js (Axios), auth, modules, words, errors
│       ├── stores/          # Pinia: auth, modules
│       ├── router/          # 路由 + 导航守卫
│       └── views/           # MemoryPage, QuizPage, ErrorBookPage, SettingsPage, admin/
├── data/                    # 词库 JSON 文件
│   ├── modules.json         # 词库名映射
│   └── *.json               # 单词数据
├── database/schema.sql      # 数据库表结构
├── setup/                   # 一键启动脚本 (setup.sh, setup.ps1)
└── docs/superpowers/        # 设计文档和实现计划
```
