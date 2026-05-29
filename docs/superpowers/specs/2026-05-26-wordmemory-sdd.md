# wordMemory 软件详细设计文档 (SDD)

> 版本: 1.0 | 日期: 2026-05-26

## 一、项目概述

浏览器端原生单词记忆网站，零依赖、纯前端，所有数据通过 IndexedDB 本地持久化。

## 二、技术栈

| 项目 | 选择 |
|------|------|
| 语言 | 原生 JavaScript (ES6+) |
| 页面 | 原生 HTML5 |
| 样式 | 原生 CSS3 |
| 本地存储 | IndexedDB |
| 构建 | 无，直接打开 HTML |

## 三、项目架构

### 架构图

```
┌─────────────────────────────────────────┐
│              index.html                 │
│  ┌──────────┬──────────┬────────────┐  │
│  │ Tab: 记忆 │ Tab: 抽查 │ Tab: 生词本│  │
│  └──────────┴──────────┴────────────┘  │
├─────────────────────────────────────────┤
│              js/app.js                  │
│        (主入口/初始化/Tab切换)            │
├──────┬──────┬──────┬──────┬────────────┤
│db.js │vocab │memory│quiz  │errorBook   │
│ IDB  │.js   │.js   │.js   │.js         │
│ 封装  │词库  │记忆  │抽查  │生词本       │
│      │管理  │模块  │模块  │模块         │
├──────┴──────┴──────┴──────┴────────────┤
│          IndexedDB (wordmemory)         │
│  ┌──────────┬──────────┬────────────┐  │
│  │vocabulary│errorBook │  modules   │  │
│  └──────────┴──────────┴────────────┘  │
└─────────────────────────────────────────┘
```

### 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `js/app.js` | 初始化 DB，绑定 Tab 切换，协调各模块 |
| 数据层 | `js/db.js` | IndexedDB 封装：打开、CRUD、排序查询 |
| 词库管理 | `js/vocabulary.js` | JSON 上传、解析校验、写入 IndexedDB |
| 单词记忆 | `js/memory.js` | 随机抽词、会/不会判断、写入生词本 |
| 单词抽查 | `js/quiz.js` | 出题、释义校验（组合条件）、数量选择、忘了/确定 |
| 生词本 | `js/errorBook.js` | 列表渲染、排序、清空 |

## 四、文件目录结构

```
wordmemory/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── db.js
│   ├── vocabulary.js
│   ├── memory.js
│   ├── quiz.js
│   └── errorBook.js
└── data/
    └── example.json
```

## 五、存储方案

### 数据库

- **数据库名:** wordmemory
- **版本:** 1

### Object Store 定义

**vocabulary** — 所有单词的源词库
| 字段 | 类型 | 说明 |
|------|------|------|
| id | autoIncrement (主键) | 自增 ID |
| module | string | 所属词库名称 |
| word | string | 单词 |
| definitions | Array\<string\> | 释义列表（多个释义） |

**errorBook** — 生词本
| 字段 | 类型 | 说明 |
|------|------|------|
| word | string (主键) | 单词 |
| definitions | Array\<string\> | 释义列表 |
| module | string | 来源词库模块 |
| errorCount | number | 错误次数 |
| lastErrorTime | number | 最后错误时间戳 (ms) |

**modules** — 已导入的词库元数据
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string (主键) | 词库模块名 |
| importedAt | number | 导入时间戳 (ms) |

### JSON 词库文件格式

用户通过页面上传，格式要求：

```json
[
  { "word": "abandon", "definition": ["放弃", "抛弃", "遗弃"] },
  { "word": "abolish", "definition": ["废除", "废止"] }
]
```

- `word` 为字符串，`definition` 为字符串数组（至少 1 个元素）
- 上传时逐条校验，`word` 缺失或 `definition` 为空数组的记录跳过并提示用户

## 六、页面结构与交互流程

### 页面布局（Tab 切换）

```
┌─────────────────────────────────────┐
│  Tab 导航                           │
│  [单词记忆]  [单词抽查]  [生词本]    │
├─────────────────────────────────────┤
│  Tab 1: 单词记忆                     │
│  词库选择: [下拉列表]                │
│  数量选择: [10] [20] [50]           │
│  [开始记忆]                          │
│  当前单词: "abandon"                │
│  [会] [不会]                         │
│  进度: 3/10                          │
├─────────────────────────────────────┤
│  Tab 2: 单词抽查                     │
│  抽查数量: [滑块/输入] (0~N)        │
│  [开始抽查]                          │
│  单词: "abandon"                    │
│  输入释义: [____________]           │
│  [确定] [忘了]                       │
│  结果反馈 + 正确释义                 │
├─────────────────────────────────────┤
│  Tab 3: 生词本                       │
│  排序: [按错误次数] [按时间]         │
│  [清空生词本]                        │
│  表格: # | 单词 | 释义 | 次数 | 时间 │
│  错误次数显示: ≤3用●, >3用红色数字   │
│  时间列显示最后错误时间的格式化时间    │
└─────────────────────────────────────┘
```

### 各模块交互流程

**单词记忆流程：**
1. 选择词库 → 选择数量 → 点击"开始记忆"
2. 从所选词库中随机不重复抽取 N 个单词
3. 逐个展示单词，用户点击"会"→ 下一个；点击"不会"→ 显示释义，写入生词本（如已存在则 errorCount+1），进入下一个
4. 全部完成 → 显示本轮统计（不会数量）

**单词抽查流程：**
1. 进入抽查 Tab → 显示词库总词数 → 选择抽查数量（0 ~ 词汇库总数）
2. 选择数量 N，点击"开始抽查"
3. 随机抽 N 个单词（优先生词本取词，不足则从词库补足），逐个展示
4. 用户输入释义 → 点"确定"→ 多条件组合校验
5. 点"忘了"→ 直接显示正确释义，写入生词本
6. 错误 → 写入生词本（errorCount+1, lastErrorTime 更新）
7. 全部完成 → 显示本轮正确率统计

**释义校验规则（多条件组合）：**
用户输入与释义列表逐一比对，任意一条释义满足以下任一条件即为正确：
1. 标准化后完全相等（去空格、去首尾标点）
2. 用户输入包含该释义，或该释义包含用户输入
3. 字符重叠率 ≥ 50%（Jaccard：公共字符数 / 释义字符数）

**生词本流程：**
1. 加载生词本列表（默认按最后错误时间降序）
2. 支持按错误次数、时间排序（点击表头切换升降序），表格含模块列显示来源词库
3. 时间列显示格式化的最后错误时间（如 "2026-05-26 14:30"）
4. 错误次数显示：≤3 次用 ● 的数量表示（如 2 次 → ●●），>3 次用红色数字显示（如 **5**）
5. 点击清空 → 二次确认弹窗 → 删除所有记录

## 七、入参出参说明

### db.js — IndexedDB 封装

```js
// 打开/初始化数据库
DB.open(): Promise<IDBDatabase>

// 批量写入单词到 vocabulary
DB.addWords(words: Array<{word, definitions, module}>): Promise<void>

// 获取指定词库的所有单词
DB.getVocabulary(module: string): Promise<Array<{id, word, definitions}>>

// 获取所有词库单词
DB.getAllWords(): Promise<Array<{id, word, definitions, module}>>

// 获取所有已导入模块
DB.getModules(): Promise<Array<{name, importedAt}>>

// 添加模块记录
DB.addModule(name: string): Promise<void>

// 写入/更新生词本一条记录（已存在则合并 errorCount+1）
DB.upsertErrorWord(word: string, definitions: string[], module: string): Promise<void>

// 获取生词本全部记录，支持排序
DB.getErrorBook(sortBy: 'errorCount' | 'lastErrorTime', order: 'asc' | 'desc'): Promise<Array>

// 清空生词本
DB.clearErrorBook(): Promise<void>
```

### vocabulary.js — 词库管理

```js
// 解析上传的 JSON 文件，校验字段，返回 { valid, skipped, total }
parseWordFile(file: File): Promise<{words: Array, skipped: number, errors: string[]}>

// 导入词库到 IndexedDB
importWords(file: File): Promise<{moduleName: string, count: number}>
```

### memory.js — 单词记忆

```js
// 从指定词库随机不重复抽取 count 个单词
pickWords(module: string, count: number): Promise<Array<{id, word, definitions}>>

// 开始一轮记忆
startMemory(module: string, count: number): void
```

### quiz.js — 单词抽查

```js
// 随机抽取 N 个单词（优先生词本）
pickQuizWords(count: number): Promise<Array<{word, definitions}>>

// 校验用户释义
checkAnswer(input: string, definitions: string[]): boolean

// 开始一轮抽查
startQuiz(count: number): void
```

### errorBook.js — 生词本

```js
// 渲染生词本列表
renderErrorBook(sortBy: string, order: string): Promise<void>

// 清空生词本（含确认）
clearErrorBook(): Promise<void>
```

## 八、边界异常场景

| 场景 | 处理策略 |
|------|----------|
| 首次使用，无任何词库 | 记忆/抽查 Tab 显示"请先上传词库"提示，禁用操作按钮 |
| 上传的 JSON 文件为空数组 | 拒绝导入，提示"词库文件无数据" |
| 上传非 JSON 文件 | JSON.parse 失败，提示"文件格式错误，请上传 JSON 文件" |
| JSON 记录缺失 word 或 definitions 为空数组 | 逐条校验，不合法记录跳过，提示跳过条数 |
| 抽查数量选择 0 | "开始抽查"按钮置灰不可点击 |
| 记忆/抽查数量 > 词库总数 | 静默降级为词库全部数量 |
| 抽查时生词本为空 | 从全部词库随机抽取 |
| 生词本已存在该单词 | 合并：errorCount+1，更新 lastErrorTime |
| 重复上传同名词库 | 覆盖旧数据（删除旧模块记录，重新导入） |
| IndexedDB 不可用 | 页面加载时检测，不支持则提示"浏览器不支持 IndexedDB" |
| 清空生词本 | 弹窗二次确认，确认后删除 |

## 九、名词解释

- **词库模块**：一个 JSON 文件对应一个词库模块，模块名取自上传文件名（去 .json 扩展名）
- **生词本**：记忆模块中点击"不会"、抽查模块中回答错误或点击"忘了"的单词集合
- **标准化**：去除首尾空格、全角标点转半角、去除末尾标点符号
