# Design Spec: 词库命名、音标显示、手机适配

**日期:** 2026-06-02
**状态:** 设计已确认

---

## 概述

三个独立但可并行实现的需求：
1. 词库选择时显示名以 `data/modules.json` 为准
2. 单词记忆/抽查页面显示音标（如果数据中有 Phonetic 字段）
3. 前端 CSS 适配手机浏览器（基于屏幕宽度 @media）

---

## 需求 1：词库命名从 modules.json 读取

### 当前问题

`SeedWords.php` 用文件名（去掉 .json）作为模块名：
- `kaoyan.json` → 模块名 `kaoyan`
- `kaoyan_5500.json` → 模块名 `kaoyan_5500`

但 `data/modules.json` 定义了更好的显示名：
```json
[
  { "file": "example.json", "name": "example" },
  { "file": "kaoyan.json", "name": "考研高频单词" },
  { "file": "kaoyan_5500.json", "name": "考研英语单词5500" }
]
```

### 方案

修改 `backend/app/command/SeedWords.php`：
- 导入前读取 `data/modules.json`，构建 `file → display_name` 映射
- `Module::create()` 时优先使用映射后的中文名
- 如果 `modules.json` 中没有对应条目，回退到文件名

### 改动清单

| 文件 | 改动 |
|------|------|
| `backend/app/command/SeedWords.php` | ~6 行：读取 modules.json，查找映射，赋值 name |

### 伪代码

```
$nameMap = [];
if (file_exists('../data/modules.json')) {
    $modulesJson = json_decode(file_get_contents('../data/modules.json'), true);
    foreach ($modulesJson as $m) {
        $nameMap[$m['file']] = $m['name'];
    }
}
// ...
$moduleName = $nameMap[basename($file)] ?? $name;
```

---

## 需求 2：音标显示（Phonetic）

### 数据现状

- `example.json`、`kaoyan_5500.json` 有 `"Phonetic": "/dju:/"` 字段
- `kaoyan.json` 没有
- 当前 `SeedWords.php` 写入 words 表时忽略 Phonetic 字段

### 方案

**后端：**
1. `words` 表新增 `phonetic VARCHAR(100) NULL` 列
2. `SeedWords.php` 写入时包含 `phonetic` 字段
3. API 响应自动包含 `phonetic`（ThinkPHP 模型自动序列化）
4. `schema.sql` 同步更新

**前端 MemoryPage.vue + QuizPage.vue：**
1. 单词大字下方，进度条上方，插入音标行
2. `v-if="currentWord?.phonetic"` 有值才渲染，无值不占空间
3. CSS 样式：灰色、1.1rem、斜体、`font-family: 'Georgia', 'Times New Roman', serif`（IPA 音标渲染好）

### 改动清单

| 文件 | 改动 |
|------|------|
| `database/schema.sql` | words 表加 `phonetic VARCHAR(100) NULL` |
| `backend/app/command/SeedWords.php` | 写入时包含 `phonetic` 字段 |
| `setup/setup.sh` | words 建表语句加 `phonetic` 列 |
| `setup/setup.ps1` | words 建表语句加 `phonetic` 列 |
| `frontend/src/views/MemoryPage.vue` | 模板加音标行 `v-if="currentWord?.phonetic"` |
| `frontend/src/views/QuizPage.vue` | 模板加音标行 `v-if="words[currentIndex]?.phonetic"` |
| `frontend/src/assets/main.css` | 加 `.word-phonetic` 样式 |

### 伪代码（Vue 模板）

```
<div id="memory-word">{{ currentWord?.word }}</div>
<div class="word-phonetic" v-if="currentWord?.phonetic">{{ currentWord.phonetic }}</div>
<div class="progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>
```

### CSS

```css
.word-phonetic {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  font-style: italic;
  text-align: center;
  margin-top: 4px;
  margin-bottom: 8px;
}
```

**注意：** 已有数据库需手动执行 `ALTER TABLE words ADD COLUMN phonetic VARCHAR(100) NULL AFTER word;`

---

## 需求 3：手机浏览器适配（CSS @media）

### 当前状态

- `index.html` 已有 `<meta name="viewport">` ✅
- CSS 仅 `@media (max-width: 480px)` 做了最小适配
- 核心页面（MemoryPage、QuizPage、ErrorBookPage）在手机上体验欠佳

### 方案

基于屏幕宽度（不做 UA 检测），在 `main.css` 中扩展 `@media` 规则。

### 断点设计

| 断点 | 目标设备 |
|------|---------|
| `max-width: 768px` | 平板竖屏 + 小屏笔记本 |
| `max-width: 480px` | 手机（含大屏手机竖屏） |

### 768px 断点规则

```css
@media (max-width: 768px) {
  .app {
    max-width: 100%;
    padding: 16px 16px 48px;
  }
  .card {
    padding: 20px 18px;
  }
  .tabs {
    gap: 4px;
    padding: 4px;
  }
  .tab {
    font-size: 0.88rem;
    padding: 10px 4px;
  }
  .header__title {
    font-size: 1.7rem;
  }
  #memory-word, #quiz-word {
    font-size: 1.8rem !important;
  }
  .btn {
    padding: 10px 16px;
  }
}
```

### 480px 断点规则（扩展现有）

```css
@media (max-width: 480px) {
  .app {
    padding: 12px 10px 60px;
  }
  .card {
    padding: 16px 12px;
    margin-bottom: 14px;
    border-radius: var(--radius);
  }
  .header__title {
    font-size: 1.4rem;
  }
  .tabs {
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius);
  }
  .tab {
    font-size: 0.78rem;
    padding: 9px 2px;
  }
  #memory-word, #quiz-word {
    font-size: 1.5rem !important;
  }
  .word-phonetic {
    font-size: 0.95rem;
  }
  .btn-group {
    flex-direction: column;
    gap: 8px;
  }
  .btn-group .btn {
    width: 100%;
  }
  .select, .input {
    font-size: 16px; /* 防止 iOS 自动缩放 */
  }
  .table th, .table td {
    padding: 8px 8px;
    font-size: 0.8rem;
  }
  .progress {
    font-size: 0.8rem;
    padding: 4px 12px;
  }
  .slider-wrap {
    flex-direction: column;
    gap: 8px;
  }
  /* 隐藏装饰 blob，节省移动端渲染 */
  body::before, body::after {
    display: none;
  }
}
```

### 改动清单

| 文件 | 改动 |
|------|------|
| `frontend/src/assets/main.css` | 扩展 @media 部分，新增 768px 断点，完善 480px 断点 |

---

## 影响范围总览

| 层级 | 文件 | 改动类型 |
|------|------|---------|
| 数据库 | `database/schema.sql` | 加列 |
| 数据库 | 生产库 `words` 表 | ALTER TABLE（手动） |
| 后端 | `app/command/SeedWords.php` | ~8 行改动 |
| 脚本 | `setup/setup.sh` | 建表语句加列 |
| 脚本 | `setup/setup.ps1` | 建表语句加列 |
| 前端 | `views/MemoryPage.vue` | 模板加音标行 |
| 前端 | `views/QuizPage.vue` | 模板加音标行 |
| 前端 | `assets/main.css` | 扩展 @media 规则 + 新样式 |

---

## 非目标（明确不做）

- 不修改 Module 后端 API 接口（命名在 seed 阶段解决）
- 不做 JS UA 检测
- 不修改管理后台 admin 页面移动端适配
- 不修改 `example.json` / `kaoyan.json` 数据文件本身

---

## 验收标准

1. 重新执行 `php think seed:words` 后，模块列表显示中文名而非文件名
2. 单词记忆页面，`example` 和 `kaoyan_5500` 词库的单词下方显示 `/xxx/` 格式音标
3. 单词抽查页面同上
4. `kaoyan` 词库（无 Phonetic）的单词不显示音标，无多余空白
5. Chrome DevTools 切换到 iPhone SE / Pixel 5 模拟，所有核心页面不出现横向滚动条
6. 手机端按钮不被截断，输入框不触发 iOS 自动缩放
