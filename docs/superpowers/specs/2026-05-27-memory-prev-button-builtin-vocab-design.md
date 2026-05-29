# Design: 单词记忆"上一个"按钮 + 内置词库分离

Date: 2026-05-27
Status: approved

## Feature 1: 单词记忆"上一个"按钮

### 需求

单词记忆模式中增加"上一个"按钮，防止点错。支持双向撤销和连续回退。

### 行为规格

- 用户可连续点击"上一个"回退到本轮已作答的任意单词
- 回退后重新作答：
  - "不会"→"会"：从生词本减少错误次数（减到 0 则删除）
  - "会"→"不会"：加入生词本
- 第一个单词时（无历史），按钮 disabled

### 数据模型

Memory 模块新增：

```
history: [{ index: number, action: 'know' | 'dunno' }]
```

### 数据流

```
正常答题:
  点"会"/"不会" → history.push({index, action})
    → 若 action='dunno': DB.upsertErrorWord()
    → currentIndex++
    → 显示下一个单词

回退:
  点"上一个" → history.pop()
    → 若 popped.action='dunno': DB.decrementOrRemoveErrorWord()
    → currentIndex = popped.index
    → 重新显示该单词（未作答状态）
```

### 文件改动

#### `js/db.js`

新增方法：

```js
async function decrementOrRemoveErrorWord(word)
```

- 读取 errorBook 中该 word 记录
- errorCount > 1: 减 1 后 put
- errorCount <= 1: delete 该记录
- 不存在: no-op

导出新增此方法。

#### `js/memory.js`

新增状态: `let history = [];`

修改 `answer(isDunno)`:
- 在 currentIndex++ 前: `history.push({ index: currentIndex, action: isDunno ? 'dunno' : 'know' });`

新增 `goBack()`:
- 如果 history.length === 0，return
- pop 最后一条记录
- 若 action === 'dunno': await DB.decrementOrRemoveErrorWord(words[currentIndex].word)
- currentIndex = popped.index
- showCurrentWord()

修改 `showCurrentWord()`:
- currentIndex >= words.length 时 finish()
- 根据 history.length === 0 控制"上一个"按钮 disabled 状态

修改 `init()`:
- 绑定 `#memory-prev` click → goBack()
- 初始状态下按钮 disabled

修改 `start()`:
- history = []
- 初始状态下按钮 disabled

#### `index.html`

在 `#memory-play-area` 中，"会"/"不会"按钮前增加：

```html
<button class="btn" id="memory-prev" disabled>上一个</button>
```

### 边界情况

| 场景 | 行为 |
|------|------|
| 第一个单词，点"上一个" | 按钮 disabled，无操作 |
| 回退到 index=0 后 | 按钮 disabled |
| 回退后重新选相同答案 | 正常 push，DB 操作幂等 |
| 回退后选不同答案 | 旧答案先被撤销（DB），新答案正常执行 |
| 连续回退多次 | 栈逐次弹出，每次撤销一次 DB 操作 |
| 回退到最后一词后继续点"会"/"不会" | 正常推进到 finish() |

---

## Feature 2: 内置词库与导入词库分离

### 需求

`data/` 目录下的 JSON 文件作为内置词库，启动时自动加载。用户上传的词库作为导入词库。存储层区分，UI 层不区分。

### 存储设计

`modules` object store 记录新增 `source` 字段：

```json
{ "name": "考研高频单词", "source": "builtin", "importedAt": 1716812345678 }
{ "name": "我的单词本", "source": "imported", "importedAt": 1716898765432 }
```

IndexedDB schema 无需变更（schema-less，字段可选）。

### 数据流

```
App.init()
  → DB.open()
  → loadBuiltinModules()
    → DB.getModules() 获取已存在模块名
    → 遍历 BUILTIN_MODULES
    → 若模块不存在: fetch(data/<name>.json) → parse → DB.addWords() → DB.addModule(name, 'builtin')
  → bindTabs/bindUpload/refreshModuleList
  → 各模块 init()
```

### 文件改动

#### `js/app.js`

新增常量：
```js
const BUILTIN_MODULES = ['example', '考研高频单词'];
```

新增函数 `loadBuiltinModules()`:
- 获取已存在的 modules 列表
- 对每个 BUILTIN_MODULES 中未加载的模块：fetch → parse → 入库
- parseWordFile 通过 `Vocabulary` 模块暴露

在 `init()` 中，`DB.open()` 之后插入 `await loadBuiltinModules();`

#### `js/db.js`

修改 `addModule` 签名：
```js
async function addModule(name, source = 'imported') {
  return promisify(tx('modules', 'readwrite').put({ name, source, importedAt: Date.now() }));
}
```

#### `js/vocabulary.js`

`parseWordFile` 已存在，无需改动。

### 边界情况

| 场景 | 行为 |
|------|------|
| fetch 内置 JSON 失败 | 跳过该模块，console.warn |
| 内置 JSON 格式不正确 | 跳过该模块 |
| 内置模块已被导入覆盖 | 已存在则跳过，不覆盖（保留用户数据） |
| 用户上传同名模块 | 覆盖该模块数据，source 变为 'imported'（现有 clearVocabulary + removeModule 逻辑已处理） |

---

## 变更文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `js/db.js` | 修改 | 新增 `decrementOrRemoveErrorWord`，修改 `addModule` 签名 |
| `js/memory.js` | 修改 | 新增 history 栈、goBack 函数、绑定"上一个"按钮 |
| `js/app.js` | 修改 | 新增 BUILTIN_MODULES、loadBuiltinModules、调整 init 流程 |
| `index.html` | 修改 | 新增"上一个"按钮 |
| `css/style.css` | 无需改动 | 现有 .btn 样式可复用 |
