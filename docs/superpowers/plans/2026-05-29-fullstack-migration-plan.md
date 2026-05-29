# WordMemory Full-Stack Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate wordmemory from browser-only IndexedDB app to Vue 3 + ThinkPHP 8 + MySQL full-stack with user auth, admin panel, and all existing features preserved.

**Architecture:** Vue 3 SPA frontend at `frontend/`, ThinkPHP 8 REST API at `backend/`, MySQL database. JWT auth. Admin panel at `/admin` route.

**Tech Stack:** Vue 3 + Vue Router + Pinia + Axios (frontend), ThinkPHP 8 + firebase/php-jwt (backend), MySQL 5.7+ (database), jsPDF + html2canvas (PDF export).

---

## Phase 1: Database & Project Scaffolding

### Task 1.1: Create Database Schema

**Files:**
- Create: `database/schema.sql`

```sql
CREATE DATABASE IF NOT EXISTS wordmemory DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wordmemory;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    file_name VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    word VARCHAR(200) NOT NULL,
    definitions TEXT NOT NULL COMMENT 'JSON array',
    INDEX idx_module (module_id),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_module (user_id, module_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    word_id INT NOT NULL,
    status TINYINT DEFAULT 0 COMMENT '0=not learned, 1=learned',
    learn_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    last_seen_at DATETIME,
    UNIQUE KEY uk_user_word (user_id, word_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_errors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    word_id INT NOT NULL,
    error_count INT DEFAULT 1,
    last_error_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_cleared TINYINT DEFAULT 0,
    UNIQUE KEY uk_user_error (user_id, word_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Default admin account (password: admin123, bcrypt hashed)
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@wordmemory.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
```

- [ ] Run: `mysql -u root -p < database/schema.sql`

### Task 1.2: Scaffold ThinkPHP 8 Backend

**Files:**
- Create: `backend/` (via composer)

```bash
cd d:/vibecoding/wordmemory
composer create-project topthink/think backend
cd backend
composer require firebase/php-jwt
```

- [ ] Verify: `php think run` starts server on port 8000

### Task 1.3: Scaffold Vue 3 Frontend

**Files:**
- Create: `frontend/` (via create-vue)

```bash
cd d:/vibecoding/wordmemory
npm create vue@latest frontend
# Select: Router (yes), Pinia (yes), others (no)
cd frontend
npm install
npm install axios jsPDF html2canvas
```

- [ ] Verify: `npm run dev` starts dev server

---

## Phase 2: Backend API

### Task 2.1: Configure Database Connection

**Files:**
- Modify: `backend/.env`

```
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_NAME=wordmemory
DB_USER=root
DB_PASS=
DB_PORT=3306
DB_CHARSET=utf8mb4
```

### Task 2.2: Create Models

**Files:**
- Create: `backend/app/model/User.php`
- Create: `backend/app/model/Module.php`
- Create: `backend/app/model/Word.php`
- Create: `backend/app/model/UserWord.php`
- Create: `backend/app/model/UserError.php`
- Create: `backend/app/model/UserModule.php`

Each model extends `think\Model` with `$name` and `$connection`:

```php
<?php
namespace app\model;

use think\Model;

class User extends Model
{
    protected $name = 'users';
    protected $autoWriteTimestamp = true;
    protected $createTime = 'created_at';
    protected $updateTime = 'updated_at';
}
```

All 6 models follow this pattern. Set `protected $name` to the table name.

### Task 2.3: Create JWT Middleware

**Files:**
- Create: `backend/app/middleware/JwtAuth.php`

```php
<?php
namespace app\middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use think\facade\Request;

class JwtAuth
{
    public function handle($request, \Closure $next)
    {
        $token = Request::header('Authorization');
        if (!$token || !str_starts_with($token, 'Bearer ')) {
            return json(['code' => 401, 'msg' => '未登录'])->code(401);
        }
        try {
            $token = substr($token, 7);
            $decoded = JWT::decode($token, new Key(config('jwt.key'), 'HS256'));
            $request->userId = $decoded->uid;
            $request->userRole = $decoded->role;
        } catch (\Exception $e) {
            return json(['code' => 401, 'msg' => 'Token 无效或已过期'])->code(401);
        }
        return $next($request);
    }
}
```

**Files:**
- Modify: `backend/config/jwt.php`

```php
<?php
return [
    'key' => 'wordmemory_jwt_secret_key_2026',
    'expire' => 7 * 24 * 3600, // 7 days
];
```

### Task 2.4: Create Auth Controller

**Files:**
- Create: `backend/app/controller/Auth.php`

```php
<?php
namespace app\controller;

use app\model\User;
use Firebase\JWT\JWT;
use think\facade\Request;

class Auth
{
    public function register()
    {
        $data = Request::only(['username', 'email', 'password']);
        if (empty($data['username']) || empty($data['email']) || empty($data['password'])) {
            return json(['code' => 400, 'msg' => '请填写完整信息']);
        }
        if (User::where('username', $data['username'])->find()) {
            return json(['code' => 400, 'msg' => '用户名已存在']);
        }
        if (User::where('email', $data['email'])->find()) {
            return json(['code' => 400, 'msg' => '邮箱已注册']);
        }
        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => password_hash($data['password'], PASSWORD_BCRYPT),
        ]);
        $token = $this->makeToken($user);
        return json(['code' => 0, 'data' => ['token' => $token, 'user' => $this->userInfo($user)]]);
    }

    public function login()
    {
        $data = Request::only(['username', 'password']);
        $user = User::where('username', $data['username'])->find();
        if (!$user || !password_verify($data['password'], $user->password)) {
            return json(['code' => 400, 'msg' => '用户名或密码错误']);
        }
        if ($user->status === 0) {
            return json(['code' => 403, 'msg' => '账号已被禁用']);
        }
        $token = $this->makeToken($user);
        return json(['code' => 0, 'data' => ['token' => $token, 'user' => $this->userInfo($user)]]);
    }

    public function changePassword()
    {
        $data = Request::only(['old_password', 'new_password']);
        $user = User::find(Request::instance()->userId);
        if (!password_verify($data['old_password'], $user->password)) {
            return json(['code' => 400, 'msg' => '原密码错误']);
        }
        $user->password = password_hash($data['new_password'], PASSWORD_BCRYPT);
        $user->save();
        return json(['code' => 0, 'msg' => '密码修改成功']);
    }

    private function makeToken($user)
    {
        $payload = [
            'uid' => $user->id,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + config('jwt.expire'),
        ];
        return JWT::encode($payload, config('jwt.key'), 'HS256');
    }

    private function userInfo($user)
    {
        return ['id' => $user->id, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role];
    }
}
```

### Task 2.5: Create Module & Word Controllers

**Files:**
- Create: `backend/app/controller/Module.php`
- Create: `backend/app/controller/Word.php`

`Module.php`:
```php
<?php
namespace app\controller;

use app\model\Module as ModuleModel;
use app\model\UserModule;
use think\facade\Request;

class Module
{
    public function index()
    {
        $modules = ModuleModel::select();
        return json(['code' => 0, 'data' => $modules]);
    }

    public function userModules()
    {
        $userId = Request::instance()->userId;
        $modules = UserModule::where('user_id', $userId)->with('module')->select();
        return json(['code' => 0, 'data' => $modules]);
    }

    public function import()
    {
        $userId = Request::instance()->userId;
        $moduleId = Request::param('module_id');
        $exists = UserModule::where('user_id', $userId)->where('module_id', $moduleId)->find();
        if ($exists) {
            return json(['code' => 400, 'msg' => '已导入该词库']);
        }
        UserModule::create(['user_id' => $userId, 'module_id' => $moduleId]);
        return json(['code' => 0, 'msg' => '导入成功']);
    }
}
```

`Word.php` — `getWords` with weighting algorithm:
```php
<?php
namespace app\controller;

use app\model\Word as WordModel;
use app\model\UserWord;
use app\model\UserError;
use think\facade\Request;

class Word
{
    public function getWords()
    {
        $moduleId = Request::param('module_id');
        $count = intval(Request::param('count', 10));
        $userId = Request::instance()->userId;

        // Get all words from module
        $allWords = WordModel::where('module_id', $moduleId)->select()->toArray();
        if (empty($allWords)) {
            return json(['code' => 0, 'data' => []]);
        }

        // Get user's mastered word IDs
        $masteredIds = UserWord::where('user_id', $userId)
            ->where('status', 1)->column('word_id');

        // Separate into unlearned and learned pools
        $unlearned = [];
        $learned = [];
        foreach ($allWords as $w) {
            if (in_array($w['id'], $masteredIds)) {
                $learned[] = $w;
            } else {
                $unlearned[] = $w;
            }
        }

        // 80% from unlearned, 20% from learned (review)
        shuffle($unlearned);
        shuffle($learned);
        $unlearnedCount = min(count($unlearned), intval($count * 0.8));
        $learnedCount = min(count($learned), $count - $unlearnedCount);
        $unlearnedCount = $count - $learnedCount; // fill remaining from unlearned

        $selected = array_merge(
            array_slice($unlearned, 0, $unlearnedCount),
            array_slice($learned, 0, $learnedCount)
        );
        shuffle($selected);

        return json(['code' => 0, 'data' => $selected]);
    }

    public function markLearned($id)
    {
        $userId = Request::instance()->userId;
        $status = Request::param('status', 0); // 1=会, 0=不会

        $uw = UserWord::where('user_id', $userId)->where('word_id', $id)->find();
        if ($uw) {
            $uw->learn_count += 1;
            if ($status == 1) $uw->correct_count += 1;
            $uw->status = $status;
            $uw->last_seen_at = date('Y-m-d H:i:s');
            $uw->save();
        } else {
            UserWord::create([
                'user_id' => $userId,
                'word_id' => $id,
                'status' => $status,
                'learn_count' => 1,
                'correct_count' => $status == 1 ? 1 : 0,
                'last_seen_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // If marked wrong, add to error book
        if ($status == 0) {
            $ue = UserError::where('user_id', $userId)->where('word_id', $id)->find();
            if ($ue && $ue->is_cleared == 0) {
                $ue->error_count += 1;
                $ue->last_error_time = date('Y-m-d H:i:s');
                $ue->save();
            } else {
                UserError::create([
                    'user_id' => $userId,
                    'word_id' => $id,
                    'error_count' => 1,
                    'last_error_time' => date('Y-m-d H:i:s'),
                    'is_cleared' => 0,
                ]);
            }
        }

        return json(['code' => 0, 'msg' => 'ok']);
    }
}
```

### Task 2.6: Create ErrorBook Controller

**Files:**
- Create: `backend/app/controller/ErrorBook.php`

```php
<?php
namespace app\controller;

use app\model\UserError;
use think\facade\Request;

class ErrorBook
{
    public function index()
    {
        $userId = Request::instance()->userId;
        $sort = Request::param('sort', 'last_error_time');
        $order = Request::param('order', 'desc');

        $data = UserError::where('user_id', $userId)
            ->where('is_cleared', 0)
            ->with('word')
            ->order($sort, $order)
            ->select()
            ->toArray();

        // Flatten word info
        $result = array_map(function ($item) {
            return [
                'word' => $item['word']['word'],
                'definitions' => json_decode($item['word']['definitions'], true),
                'module' => $item['word']['module_id'],
                'error_count' => $item['error_count'],
                'last_error_time' => $item['last_error_time'],
            ];
        }, $data);

        return json(['code' => 0, 'data' => $result]);
    }

    public function clear()
    {
        $userId = Request::instance()->userId;
        UserError::where('user_id', $userId)->update(['is_cleared' => 1]);
        return json(['code' => 0, 'msg' => '已清空']);
    }
}
```

Fix UserError model to include word relation:
```php
// In app/model/UserError.php, add:
public function word()
{
    return $this->belongsTo(Word::class, 'word_id', 'id');
}
```

### Task 2.7: Register Routes

**Files:**
- Modify: `backend/route/app.php`

```php
<?php
use think\facade\Route;

// Public
Route::post('/api/register', 'Auth/register');
Route::post('/api/login', 'Auth/login');
Route::post('/api/admin/login', 'Admin.Auth/login');

// User (requires JWT)
Route::group('/api', function () {
    Route::post('/change-password', 'Auth/changePassword');
    Route::get('/modules', 'Module/index');
    Route::get('/user/modules', 'Module/userModules');
    Route::post('/user/modules', 'Module/import');
    Route::get('/words', 'Word/getWords');
    Route::post('/words/<id>/learned', 'Word/markLearned');
    Route::get('/errors', 'ErrorBook/index');
    Route::delete('/errors', 'ErrorBook/clear');
})->middleware(\app\middleware\JwtAuth::class);

// Admin (requires JWT + admin role)
Route::group('/api/admin', function () {
    Route::get('/users', 'Admin.User/index');
    Route::put('/users/<id>', 'Admin.User/updateStatus');
    Route::delete('/users/<id>', 'Admin.User/delete');
    Route::get('/modules', 'Admin.Module/index');
    Route::post('/modules', 'Admin.Module/create');
    Route::put('/modules/<id>', 'Admin.Module/update');
    Route::delete('/modules/<id>', 'Admin.Module/delete');
    Route::post('/modules/<id>/words', 'Admin.Module/addWord');
    Route::put('/words/<id>', 'Admin.Module/updateWord');
    Route::delete('/words/<id>', 'Admin.Module/deleteWord');
    Route::get('/users/<id>/data', 'Admin.UserData/view');
})->middleware(\app\middleware\JwtAuth::class);
```

Also register app middleware for admin auth check. In `app/middleware.php`:

```php
<?php
return [
    \app\middleware\JwtAuth::class,
];
```

For admin routes, use a separate route group with an additional admin middleware check. Since ThinkPHP route groups support middleware chaining, create `AdminAuth.php`:

```php
<?php
namespace app\middleware;

use think\facade\Request;

class AdminAuth
{
    public function handle($request, \Closure $next)
    {
        if (($request->userRole ?? '') !== 'admin') {
            return json(['code' => 403, 'msg' => '无权限'])->code(403);
        }
        return $next($request);
    }
}
```

Admin routes use: `->middleware([\app\middleware\JwtAuth::class, \app\middleware\AdminAuth::class])`

### Task 2.8: Create Admin Controllers

**Files:**
- Create: `backend/app/controller/admin/Auth.php`
- Create: `backend/app/controller/admin/User.php`
- Create: `backend/app/controller/admin/Module.php`
- Create: `backend/app/controller/admin/UserData.php`

`Admin/Auth.php`:
```php
<?php
namespace app\controller\admin;

use app\model\User;
use Firebase\JWT\JWT;

class Auth
{
    public function login()
    {
        $data = request()->only(['username', 'password']);
        $user = User::where('username', $data['username'])->where('role', 'admin')->find();
        if (!$user || !password_verify($data['password'], $user->password)) {
            return json(['code' => 400, 'msg' => '账号或密码错误']);
        }
        $payload = ['uid' => $user->id, 'role' => $user->role, 'iat' => time(), 'exp' => time() + config('jwt.expire')];
        return json(['code' => 0, 'data' => ['token' => JWT::encode($payload, config('jwt.key'), 'HS256'), 'user' => ['id' => $user->id, 'username' => $user->username, 'role' => $user->role]]]);
    }
}
```

`Admin/User.php`:
```php
<?php
namespace app\controller\admin;

use app\model\User;
use think\facade\Request;

class User
{
    public function index()
    {
        $keyword = Request::param('keyword', '');
        $page = intval(Request::param('page', 1));
        $query = User::field('id,username,email,role,status,created_at');
        if ($keyword) {
            $query->where('username|email', 'like', "%{$keyword}%");
        }
        $data = $query->order('id desc')->page($page, 20)->select();
        $total = User::count();
        return json(['code' => 0, 'data' => ['list' => $data, 'total' => $total]]);
    }

    public function updateStatus($id)
    {
        $status = Request::param('status', 1);
        User::where('id', $id)->update(['status' => $status]);
        return json(['code' => 0, 'msg' => 'ok']);
    }

    public function delete($id)
    {
        if ($id == 1) return json(['code' => 400, 'msg' => '不能删除超级管理员']);
        User::destroy($id);
        return json(['code' => 0, 'msg' => '已删除']);
    }
}
```

`Admin/Module.php`:
```php
<?php
namespace app\controller\admin;

use app\model\Module as ModuleModel;
use app\model\Word;
use think\facade\Request;

class Module
{
    public function index()
    {
        $modules = ModuleModel::withCount('words')->select();
        return json(['code' => 0, 'data' => $modules]);
    }
    public function create()
    {
        $data = Request::only(['name']);
        $module = ModuleModel::create(['name' => $data['name']]);
        return json(['code' => 0, 'data' => $module]);
    }
    public function update($id)
    {
        $data = Request::only(['name']);
        ModuleModel::where('id', $id)->update(['name' => $data['name']]);
        return json(['code' => 0, 'msg' => 'ok']);
    }
    public function delete($id)
    {
        ModuleModel::destroy($id); // cascade deletes words
        return json(['code' => 0, 'msg' => '已删除']);
    }
    public function addWord($moduleId)
    {
        $data = Request::only(['word', 'definitions']);
        Word::create([
            'module_id' => $moduleId,
            'word' => $data['word'],
            'definitions' => json_encode($data['definitions'], JSON_UNESCAPED_UNICODE),
        ]);
        return json(['code' => 0, 'msg' => 'ok']);
    }
    public function updateWord($id)
    {
        $data = Request::only(['word', 'definitions']);
        Word::where('id', $id)->update([
            'word' => $data['word'],
            'definitions' => json_encode($data['definitions'], JSON_UNESCAPED_UNICODE),
        ]);
        return json(['code' => 0, 'msg' => 'ok']);
    }
    public function deleteWord($id)
    {
        Word::destroy($id);
        return json(['code' => 0, 'msg' => '已删除']);
    }
}
```

`Admin/UserData.php`:
```php
<?php
namespace app\controller\admin;

use app\model\UserModule;
use app\model\UserError;
use app\model\UserWord;

class UserData
{
    public function view($userId)
    {
        $modules = UserModule::where('user_id', $userId)->with('module')->select();
        $errorStats = UserError::where('user_id', $userId)->where('is_cleared', 0)->count();
        $learnedCount = UserWord::where('user_id', $userId)->where('status', 1)->count();
        $totalWords = UserWord::where('user_id', $userId)->count();
        return json(['code' => 0, 'data' => [
            'modules' => $modules,
            'error_count' => $errorStats,
            'learned_count' => $learnedCount,
            'total_learned' => $totalWords,
        ]]);
    }
}
```

### Task 2.9: Seed Word Data from JSON

**Files:**
- Create: `backend/app/command/SeedWords.php`

```php
<?php
namespace app\command;

use think\console\Command;
use think\console\Input;
use think\console\Output;
use app\model\Module;
use app\model\Word;

class SeedWords extends Command
{
    protected function configure()
    {
        $this->setName('seed:words')->setDescription('Import JSON word files into database');
    }

    protected function execute(Input $input, Output $output)
    {
        $files = glob('../data/*.json');
        foreach ($files as $file) {
            $name = basename($file, '.json');
            $data = json_decode(file_get_contents($file), true);
            if (!is_array($data)) continue;

            $module = Module::where('name', $name)->find();
            if (!$module) {
                // Read name from modules.json if available
                $moduleName = $name;
                $module = Module::create(['name' => $moduleName, 'file_name' => basename($file)]);
            }

            foreach ($data as $item) {
                if (empty($item['word']) || empty($item['definition'])) continue;
                Word::create([
                    'module_id' => $module->id,
                    'word' => $item['word'],
                    'definitions' => json_encode($item['definition'], JSON_UNESCAPED_UNICODE),
                ]);
            }
            $output->writeln("Seeded: {$module->name} (" . count($data) . " words)");
        }
    }
}
```

Register in `backend/config/console.php`:
```php
<?php
return [
    'commands' => [
        \app\command\SeedWords::class,
    ],
];
```

- [ ] Run: `php think seed:words`

---

## Phase 3: Vue Frontend

### Task 3.1: Set Up Project Structure

**Files:**
- Create: `frontend/src/api/`
- Create: `frontend/src/stores/`
- Create: `frontend/src/views/`
- Create: `frontend/src/router/index.js`

Directory layout:
```
frontend/src/
├── api/
│   ├── request.js       # Axios instance with interceptors
│   ├── auth.js          # login, register, changePassword
│   ├── modules.js       # getModules, importModule
│   ├── words.js         # getWords, markLearned
│   └── errors.js        # getErrors, clearErrors
├── stores/
│   ├── auth.js          # useAuthStore (Pinia)
│   └── modules.js       # useModuleStore (Pinia)
├── views/
│   ├── LoginPage.vue
│   ├── RegisterPage.vue
│   ├── MemoryPage.vue
│   ├── QuizPage.vue
│   ├── ErrorBookPage.vue
│   ├── SettingsPage.vue
│   └── admin/
│       ├── AdminLayout.vue
│       ├── AdminLogin.vue
│       ├── AdminUsers.vue
│       ├── AdminModules.vue
│       └── AdminUserData.vue
├── router/
│   └── index.js
├── App.vue
└── main.js
```

### Task 3.2: API Request Layer

**Files:**
- Create: `frontend/src/api/request.js`

```javascript
import axios from 'axios';

const request = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default request;
```

**Files:**
- Create: `frontend/src/api/auth.js`

```javascript
import request from './request';

export const login = (data) => request.post('/login', data);
export const register = (data) => request.post('/register', data);
export const changePassword = (data) => request.post('/change-password', data);
export const adminLogin = (data) => request.post('/admin/login', data);
```

**Files:**
- Create: `frontend/src/api/modules.js`

```javascript
import request from './request';

export const getModules = () => request.get('/modules');
export const getUserModules = () => request.get('/user/modules');
export const importModule = (moduleId) => request.post('/user/modules', { module_id: moduleId });
```

**Files:**
- Create: `frontend/src/api/words.js`

```javascript
import request from './request';

export const getWords = (params) => request.get('/words', { params });
export const markLearned = (wordId, status) => request.post(`/words/${wordId}/learned`, { status });
```

**Files:**
- Create: `frontend/src/api/errors.js`

```javascript
import request from './request';

export const getErrors = (params) => request.get('/errors', { params });
export const clearErrors = () => request.delete('/errors');
```

### Task 3.3: Pinia Stores

**Files:**
- Create: `frontend/src/stores/auth.js`

```javascript
import { defineStore } from 'pinia';
import { login as apiLogin, register as apiRegister, changePassword as apiChangePwd, adminLogin as apiAdminLogin } from '../api/auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || '',
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    async login(data) {
      const res = await apiLogin(data);
      this.token = res.data.token;
      this.user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    },
    async register(data) {
      const res = await apiRegister(data);
      this.token = res.data.token;
      this.user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    },
    async adminLogin(data) {
      const res = await apiAdminLogin(data);
      this.token = res.data.token;
      this.user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    },
    async changePassword(data) {
      await apiChangePwd(data);
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
```

**Files:**
- Create: `frontend/src/stores/modules.js`

```javascript
import { defineStore } from 'pinia';
import { getModules, getUserModules, importModule as apiImport } from '../api/modules';

export const useModuleStore = defineStore('modules', {
  state: () => ({
    allModules: [],
    userModules: [],
  }),
  actions: {
    async fetchAll() { const r = await getModules(); this.allModules = r.data; },
    async fetchUser() { const r = await getUserModules(); this.userModules = r.data; },
    async importModule(moduleId) { await apiImport(moduleId); await this.fetchUser(); },
  },
});
```

### Task 3.4: Router + Auth Guard

**Files:**
- Modify: `frontend/src/router/index.js`

```javascript
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginPage.vue'), meta: { guest: true } },
  { path: '/register', name: 'Register', component: () => import('../views/RegisterPage.vue'), meta: { guest: true } },
  { path: '/', redirect: '/memory' },
  { path: '/memory', name: 'Memory', component: () => import('../views/MemoryPage.vue'), meta: { auth: true } },
  { path: '/quiz', name: 'Quiz', component: () => import('../views/QuizPage.vue'), meta: { auth: true } },
  { path: '/errorbook', name: 'ErrorBook', component: () => import('../views/ErrorBookPage.vue'), meta: { auth: true } },
  { path: '/settings', name: 'Settings', component: () => import('../views/SettingsPage.vue'), meta: { auth: true } },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', redirect: '/admin/users' },
      { path: 'users', name: 'AdminUsers', component: () => import('../views/admin/AdminUsers.vue') },
      { path: 'modules', name: 'AdminModules', component: () => import('../views/admin/AdminModules.vue') },
      { path: 'users/:id/data', name: 'AdminUserData', component: () => import('../views/admin/AdminUserData.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (to.meta.auth && !token) return next('/login');
  if (to.meta.admin && (!token || user?.role !== 'admin')) return next('/login');
  if (to.meta.guest && token) return next('/memory');

  next();
});

export default router;
```

### Task 3.5: App.vue + Navigation

**Files:**
- Modify: `frontend/src/App.vue`

```vue
<template>
  <div id="app">
    <nav class="tabs" v-if="isLoggedIn && !isAdminRoute">
      <button class="tab" :class="{ 'tab--active': $route.path === '/memory' }" @click="$router.push('/memory')">单词记忆</button>
      <button class="tab" :class="{ 'tab--active': $route.path === '/quiz' }" @click="$router.push('/quiz')">单词抽查</button>
      <button class="tab" :class="{ 'tab--active': $route.path === '/errorbook' }" @click="$router.push('/errorbook')">生词本</button>
      <button class="tab" @click="$router.push('/settings')">设置</button>
    </nav>
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const auth = useAuthStore();
const isLoggedIn = computed(() => auth.isLoggedIn);
const isAdminRoute = computed(() => route.path.startsWith('/admin'));
</script>
```

### Task 3.6: Auth Pages (Login + Register)

**Files:**
- Create: `frontend/src/views/LoginPage.vue`
- Create: `frontend/src/views/RegisterPage.vue`

Both are simple forms with username/password fields. Login page template:

```vue
<template>
  <div class="app">
    <header class="header"><h1 class="header__title">wordMemory</h1></header>
    <div class="card" style="max-width:400px;margin:40px auto">
      <h2>登录</h2>
      <form @submit.prevent="handleLogin">
        <input v-model="username" class="input" placeholder="用户名" style="margin-bottom:12px" required />
        <input v-model="password" type="password" class="input" placeholder="密码" style="margin-bottom:12px" required />
        <div v-if="error" class="feedback feedback--wrong">{{ error }}</div>
        <button type="submit" class="btn btn--primary" style="width:100%;margin-top:12px">登录</button>
      </form>
      <p style="text-align:center;margin-top:16px">没有账号？<router-link to="/register">注册</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const username = ref('');
const password = ref('');
const error = ref('');

async function handleLogin() {
  error.value = '';
  try {
    const res = await auth.login({ username: username.value, password: password.value });
    // If admin, go to admin panel
    if (res?.data?.user?.role === 'admin' || auth.isAdmin) {
      router.push('/admin');
    } else {
      router.push('/memory');
    }
  } catch (e) {
    error.value = e.response?.data?.msg || '登录失败';
  }
}
</script>
```

Register page is similar but adds an `email` field.

### Task 3.7: Memory Page (Port from Existing)

**Files:**
- Create: `frontend/src/views/MemoryPage.vue`

Port the existing memory.js logic into Vue component. Key differences from old code:
- Replace `DB.getVocabulary()` → `getWords()` API
- Replace `DB.upsertErrorWord()` → `markLearned(wordId, 0)` API
- Replace `DB.getErrorBook()` → `getErrors()` API
- Replace `Quiz.checkAnswer()` → copy the function locally (it's pure logic)

The component structure mirrors the old `index.html` memory section with:
- Module selector (populated from `useModuleStore`)
- Count buttons (10/20/50 + custom)
- "开始记忆" button
- Word display + progress
- 会/不会/下一个 buttons
- Quiz interleaving area (copy logic from old memory.js)
- Result display

Core logic:
```vue
<script setup>
import { ref, computed } from 'vue';
import { getWords, markLearned } from '../api/words';
import { getErrors } from '../api/errors';
import { useModuleStore } from '../stores/modules';

const moduleStore = useModuleStore();
const words = ref([]);
const currentIndex = ref(0);
const dunnoCount = ref(0);
const active = ref(false);
const history = ref([]);
// ... quiz interleaving state variables (same as old memory.js)
const selectedModule = ref('');
const selectedCount = ref(10);
const inQuiz = ref(false);
const currentQuizWord = ref(null);
const quizPool = ref([]);
const quizPositions = ref([]);
const quizUsed = ref(new Set());

async function start() {
  const res = await getWords({ module_id: selectedModule.value, count: selectedCount.value });
  words.value = res.data;
  currentIndex.value = 0;
  dunnoCount.value = 0;
  history.value = [];
  active.value = true;
  // Build quiz pool from error book
  const errRes = await getErrors({ sort: 'error_count', order: 'desc' });
  const quizCount = Math.ceil(selectedCount.value / 5);
  const shuffled = errRes.data.sort(() => Math.random() - 0.5);
  quizPool.value = shuffled.slice(0, quizCount);
  quizUsed.value = new Set();
  quizPositions.value = Array.from({ length: quizPool.value.length }, () => Math.floor(Math.random() * words.value.length)).sort((a, b) => a - b);
  inQuiz.value = false;
}

// ... answer, nextWord, startQuiz, submitQuiz, forgotQuiz, goBack functions
// (Same logic as old memory.js, using API calls instead of DB)

function checkAnswer(input, definitions) {
  // Copy of Quiz.checkAnswer logic
  const norm = (s) => s.replace(/^[，。！？、,.!?\s]+/, '').replace(/[，。！？、,.!?\s]+$/, '').trim();
  const userNorm = norm(input);
  if (!userNorm) return false;
  for (const def of definitions) {
    const defNorm = norm(def);
    if (userNorm === defNorm) return true;
    if (userNorm.includes(defNorm) || defNorm.includes(userNorm)) return true;
    const setA = new Set([...userNorm]), setB = new Set([...defNorm]);
    let common = 0;
    for (const c of setA) { if (setB.has(c)) common++; }
    if (common / setA.size >= 0.5) return true;
  }
  return false;
}
</script>
```

The template mirrors the old HTML structure with Vue bindings:
- `v-if="active"` for play area visibility
- `{{ words[currentIndex]?.word }}` for word display
- `@click` handlers on buttons
- `v-show` for definition / quiz area / next button

### Task 3.8: Quiz, ErrorBook, Settings Pages

**Files:**
- Create: `frontend/src/views/QuizPage.vue`
- Create: `frontend/src/views/ErrorBookPage.vue`
- Create: `frontend/src/views/SettingsPage.vue`

Same pattern as MemoryPage — port old quiz.js, errorBook.js logic into Vue components using API calls.

**QuizPage** — Port quiz.js:
- Uses `getWords()` API (prioritizes error book words on backend)
- Same answer checking with `checkAnswer()`
- Tracks `wrongWords` array for end screen
- End screen with wrong words table + PDF export button (html2canvas)

**ErrorBookPage** — Port errorBook.js:
- Uses `getErrors()` API with sort/order params
- Table rendering with sortable headers
- Clear button → `clearErrors()` API
- PDF export → html2canvas (same pattern as old errorBook.js)

**SettingsPage:**
```vue
<template>
  <div class="card" style="max-width:400px;margin:20px auto">
    <h2>修改密码</h2>
    <form @submit.prevent="handleChange">
      <input v-model="oldPass" type="password" class="input" placeholder="原密码" style="margin-bottom:12px" required />
      <input v-model="newPass" type="password" class="input" placeholder="新密码" style="margin-bottom:12px" required />
      <div v-if="msg" class="feedback" :class="msgType === 'ok' ? 'feedback--correct' : 'feedback--wrong'">{{ msg }}</div>
      <button type="submit" class="btn btn--primary" style="width:100%;margin-top:12px">修改</button>
    </form>
    <button class="btn btn--danger" style="width:100%;margin-top:24px" @click="logout">退出登录</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
const router = useRouter();
const auth = useAuthStore();
const oldPass = ref('');
const newPass = ref('');
const msg = ref('');
const msgType = ref('');
async function handleChange() {
  try {
    await auth.changePassword({ old_password: oldPass.value, new_password: newPass.value });
    msg.value = '密码修改成功';
    msgType.value = 'ok';
  } catch (e) { msg.value = e.response?.data?.msg || '修改失败'; msgType.value = 'err'; }
}
function logout() { auth.logout(); router.push('/login'); }
</script>
```

### Task 3.9: Admin Pages

**Files:**
- Create: `frontend/src/views/admin/AdminLayout.vue`
- Create: `frontend/src/views/admin/AdminUsers.vue`
- Create: `frontend/src/views/admin/AdminModules.vue`
- Create: `frontend/src/views/admin/AdminUserData.vue`

**AdminLayout.vue:**
```vue
<template>
  <div class="app">
    <header class="header"><h1 class="header__title">wordMemory 后台管理</h1></header>
    <nav class="tabs">
      <button class="tab" :class="{ 'tab--active': $route.path === '/admin/users' }" @click="$router.push('/admin/users')">用户管理</button>
      <button class="tab" :class="{ 'tab--active': $route.path === '/admin/modules' }" @click="$router.push('/admin/modules')">词库管理</button>
      <button class="tab" @click="logout">退出</button>
    </nav>
    <router-view />
  </div>
</template>
```

**AdminUsers.vue** — User management table with:
- Search by username/email
- Paginated list
- Enable/Disable toggle button
- Delete button (with confirm)
- Click username → navigate to user data page

**AdminModules.vue** — Module management with:
- List modules with word count
- Create/rename/delete module
- Expand module to show words table
- Add/edit/delete individual words

**AdminUserData.vue** — View single user's:
- Imported modules
- Error book stats
- Memory progress stats

Admin API calls go through `request.js` with the same Bearer token.

### Task 3.10: Copy CSS from Old Project

**Files:**
- Modify: `frontend/src/assets/main.css`

Copy the entire `css/style.css` from the old project into `frontend/src/assets/main.css`. Import in `main.js`:
```javascript
import './assets/main.css';
```

---

## Phase 4: Integration & Verification

### Task 4.1: Configure CORS in ThinkPHP

**Files:**
- Modify: `backend/app/middleware.php`

Add CORS middleware or handle in `public/index.php`:

```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
```

### Task 4.2: Seed Database with Word Data

```bash
cd backend
php think seed:words
```

Verify: `mysql -u root -p -e "SELECT COUNT(*) FROM wordmemory.words;"`

### Task 4.3: End-to-End Smoke Test

- [ ] Start backend: `cd backend && php think run -p 8080`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Register a new user → verify token saved
- [ ] Import a module → verify words appear in memory
- [ ] Complete a memory session → verify words tracked
- [ ] Take a quiz → verify wrong words recorded
- [ ] Check error book → verify data persists
- [ ] Export PDF → verify Chinese text renders
- [ ] Login as admin → verify admin panel loads
- [ ] Admin: disable a user → verify user can't login
- [ ] Admin: add/delete words → verify changes reflected
