# 单词记忆"上一个"按钮 + 内置词库分离 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为单词记忆模式增加历史回退功能，并将 data/ 目录 JSON 文件作为内置词库自动加载

**Architecture:** 纯前端 vanilla JS，IndexedDB 持久化。Memory 模块新增 history 栈跟踪答题历史，DB 层新增错误词递减方法，App 启动时 fetch 内置 JSON 入库

**Tech Stack:** Vanilla JS (IIFE modules), IndexedDB, HTML/CSS

---

### Task 1: DB 层改动 — 新增 decrementOrRemoveErrorWord + 修改 addModule 签名

**Files:**
- Modify: `js/db.js`

- [ ] **Step 1: 在 `upsertErrorWord` 之后新增 `decrementOrRemoveErrorWord` 方法**

在 `js/db.js` 的 `upsertErrorWord` 函数之后（约第 128 行后）插入：

```js
async function decrementOrRemoveErrorWord(word) {
  const existing = await promisify(tx('errorBook', 'readonly').get(word));
  if (!existing) return;
  if (existing.errorCount <= 1) {
    return promisify(tx('errorBook', 'readwrite').delete(word));
  }
  existing.errorCount -= 1;
  return promisify(tx('errorBook', 'readwrite').put(existing));
}
```

- [ ] **Step 2: 修改 `addModule` 签名，增加 `source` 参数**

将现有：
```js
async function addModule(name) {
  const store = tx('modules', 'readwrite');
  return promisify(store.put({ name, importedAt: Date.now() }));
}
```

改为：
```js
async function addModule(name, source = 'imported') {
  const store = tx('modules', 'readwrite');
  return promisify(store.put({ name, source, importedAt: Date.now() }));
}
```

- [ ] **Step 3: 在 return 对象中导出新方法**

在 `return` 对象中（约第 147 行），`upsertErrorWord` 之后加入：

```js
decrementOrRemoveErrorWord,
```

完整 return 块应变为：
```js
return {
  open,
  addWords, clearVocabulary, getVocabulary, getAllWords, getVocabularyCount, getTotalWordCount,
  getModules, addModule, removeModule,
  upsertErrorWord, decrementOrRemoveErrorWord, getErrorBook, clearErrorBook
};
```

---

### Task 2: Memory 模块改动 — history 栈 + goBack 函数

**Files:**
- Modify: `js/memory.js`

- [ ] **Step 1: 新增 `history` 状态变量**

在 `js/memory.js` 顶部，`let active = false;` 之后新增：

```js
let history = [];
```

- [ ] **Step 2: 修改 `answer` 函数，答题时记录历史**

将现有的 `answer` 函数中，`currentIndex++;` 之前插入 history.push：

```js
async function answer(isDunno) {
  if (!active) return;

  history.push({ index: currentIndex, action: isDunno ? 'dunno' : 'know' });

  if (isDunno) {
    const w = words[currentIndex];
    document.getElementById('memory-definition').textContent =
      w.definitions.join('；');
    document.getElementById('memory-definition').style.display = 'block';
    dunnoCount++;
    await DB.upsertErrorWord(w.word, w.definitions, w.module);
  }
  currentIndex++;
  if (isDunno) {
    setTimeout(() => showCurrentWord(), 1500);
  } else {
    showCurrentWord();
  }
}
```

- [ ] **Step 3: 新增 `goBack` 函数**

在 `answer` 函数之后，`finish` 函数之前插入：

```js
async function goBack() {
  if (history.length === 0) return;
  const last = history.pop();

  if (last.action === 'dunno') {
    dunnoCount--;
    await DB.decrementOrRemoveErrorWord(words[last.index].word);
  }

  currentIndex = last.index;
  showCurrentWord();
}
```

- [ ] **Step 4: 修改 `showCurrentWord`，控制"上一个"按钮状态**

在 `showCurrentWord` 函数中增加对 `#memory-prev` 的 disabled 控制：

```js
function showCurrentWord() {
  if (currentIndex >= words.length) {
    finish();
    return;
  }
  document.getElementById('memory-word').textContent = words[currentIndex].word;
  document.getElementById('memory-progress').textContent =
    `进度: ${currentIndex + 1} / ${words.length}`;
  document.getElementById('memory-definition').style.display = 'none';
  document.getElementById('memory-prev').disabled = history.length === 0;
}
```

- [ ] **Step 5: 修改 `init`，绑定"上一个"按钮事件**

在 `init` 函数中新增事件绑定：

```js
async function init() {
  await refreshModuleSelect();
  document.getElementById('memory-start').addEventListener('click', start);
  document.getElementById('memory-know').addEventListener('click', () => answer(false));
  document.getElementById('memory-dunno').addEventListener('click', () => answer(true));
  document.getElementById('memory-prev').addEventListener('click', goBack);

  document.querySelectorAll('.memory-count').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.memory-count').forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      document.getElementById('memory-count-custom').value = '';
    });
  });
}
```

- [ ] **Step 6: 修改 `start`，重置 history**

在 `start` 函数中重置 `history = []` 并禁用"上一个"按钮：

```js
async function start() {
  const moduleName = document.getElementById('memory-module').value;
  if (!moduleName) return;

  const allWords = await DB.getVocabulary(moduleName);
  if (allWords.length === 0) return;

  const count = Math.min(getSelectedCount(), allWords.length);
  const shuffled = allWords.sort(() => Math.random() - 0.5);
  words = shuffled.slice(0, count);
  currentIndex = 0;
  dunnoCount = 0;
  history = [];
  active = true;

  document.getElementById('memory-play-area').style.display = 'block';
  document.getElementById('memory-result').style.display = 'none';
  document.getElementById('memory-start').disabled = true;
  document.getElementById('memory-prev').disabled = true;
  showCurrentWord();
}
```

---

### Task 3: HTML 改动 — 添加"上一个"按钮

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在单词记忆 play area 中添加"上一个"按钮**

在 `#memory-play-area` 内的 `.btn-group` 中，"会"按钮之前插入：

将：
```html
<div class="btn-group" style="justify-content:center">
  <button class="btn btn--success" id="memory-know">会</button>
  <button class="btn btn--danger" id="memory-dunno">不会</button>
</div>
```

改为：
```html
<div class="btn-group" style="justify-content:center">
  <button class="btn" id="memory-prev" disabled>上一个</button>
  <button class="btn btn--success" id="memory-know">会</button>
  <button class="btn btn--danger" id="memory-dunno">不会</button>
</div>
```

---

### Task 4: App 模块改动 — 内置词库自动加载

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 新增 `BUILTIN_MODULES` 常量和 `loadBuiltinModules` 函数**

在 `App` IIFE 顶部、`let currentTab` 之后插入：

```js
const BUILTIN_MODULES = ['example', '考研高频单词'];

async function loadBuiltinModules() {
  const modules = await DB.getModules();
  const existingNames = new Set(modules.map(m => m.name));

  for (const name of BUILTIN_MODULES) {
    if (existingNames.has(name)) continue;

    try {
      const resp = await fetch(`data/${name}.json`);
      if (!resp.ok) {
        console.warn(`内置词库 "${name}" 加载失败: HTTP ${resp.status}`);
        continue;
      }
      const text = await resp.text();
      const result = Vocabulary.parseWordFile(text, name);
      if (!result.success) {
        console.warn(`内置词库 "${name}" 解析失败: ${result.error}`);
        continue;
      }
      await DB.addWords(result.words);
      await DB.addModule(name, 'builtin');
    } catch (err) {
      console.warn(`内置词库 "${name}" 加载异常:`, err);
    }
  }
}
```

- [ ] **Step 2: 修改 `init` 函数，在 DB 初始化后加载内置词库**

将 `init` 函数中：
```js
function init() {
  DB.open().then(() => {
    bindTabs();
    bindUpload();
    refreshModuleList();
    Memory.init();
    Quiz.init();
    ErrorBook.init();
  }).catch(err => {
```

改为：
```js
async function init() {
  try {
    await DB.open();
    await loadBuiltinModules();
    bindTabs();
    bindUpload();
    await refreshModuleList();
    Memory.init();
    Quiz.init();
    ErrorBook.init();
  } catch (err) {
```

注意：将 `.then().catch()` 链改为 `async/await` 风格。删除 `.then(() => {` 和 `.catch(err => {`，替换为 `try/catch`。

---

### Task 5: 验证测试

**Files:**
- 无新建，手动验证

- [ ] **Step 1: 手动验证 Feature 1 — "上一个"按钮**

操作步骤：
1. 打开 `index.html`（用 live server 或直接打开）
2. 选择词库（如"考研高频单词"），数量选 10，点"开始记忆"
3. 对第一个单词点"不会"→ 确认显示释义
4. 点"上一个"→ 回到该单词，确认释义隐藏，按钮可再选
5. 点"会"→ 进入下一个单词
6. 检查生词本 → 该单词不应出现（因为从"不会"改成了"会"）
7. 连续点"不会"×3 → 连续点"上一个"×3 → 确认能回退三步
8. 回到 index=0 时 → 确认"上一个"按钮 disabled

- [ ] **Step 2: 手动验证 Feature 2 — 内置词库加载**

操作步骤：
1. 打开浏览器开发者工具 → Application → IndexedDB → wordmemory
2. 清除 wordmemory 数据库
3. 刷新页面
4. 查看 modules store → 应有 `example` 和 `考研高频单词` 两条，`source` 均为 `builtin`
5. 查看 vocabulary store → 应有对应单词数据
6. 再次刷新 → 不应重复加载（console 无额外 fetch 日志）
7. 上传一个新 JSON 文件 → modules store 中新记录 `source` 为 `imported`

- [ ] **Step 3: 边界验证**

1. 在 data/ 目录新增一个 JSON 文件 → 启动后应自动加载
2. 删除 data/ 中某个 JSON → 已加载数据不受影响（刷新后数据仍存在）
3. 回退到倒数第二个词后，对最后两个词点"不会" → 应正常推进到 finish()
4. 回退后改"会"为"不会" → 检查生词本中该词出现
