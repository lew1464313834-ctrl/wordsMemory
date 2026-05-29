# wordMemory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-side word memorization app with vocabulary management, memory mode, quiz mode, and error book — all persisted in IndexedDB.

**Architecture:** Vanilla JS with ES6 modules wrapped in IIFEs. Each JS file handles one concern (`db.js` for storage, `vocabulary.js` for import, `memory.js`/`quiz.js`/`errorBook.js` for UI modules). `app.js` orchestrates initialization and tab switching. All IndexedDB operations are async (Promise-based).

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+), IndexedDB. Zero dependencies, zero build tools.

**Testing approach:** Pure logic functions (checkAnswer, parseWordFile) are tested via browser console assertions. DOM and IndexedDB-dependent modules verified via manual browser testing with test checklist per task.

---

### Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `data/example.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p css js data
```

- [ ] **Step 2: Write index.html skeleton**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>wordMemory - 单词记忆</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <h1 class="header__title">wordMemory</h1>
    </header>
    <nav class="tabs">
      <button class="tab tab--active" data-tab="memory">单词记忆</button>
      <button class="tab" data-tab="quiz">单词抽查</button>
      <button class="tab" data-tab="errorbook">生词本</button>
    </nav>
    <main class="main">
      <section class="tab-content" id="tab-memory">
        <!-- Task 5 -->
      </section>
      <section class="tab-content tab-content--hidden" id="tab-quiz">
        <!-- Task 6 -->
      </section>
      <section class="tab-content tab-content--hidden" id="tab-errorbook">
        <!-- Task 7 -->
      </section>
    </main>
    <!-- 词库上传区（全局） -->
    <section class="upload-section" id="upload-section">
      <label class="upload-label">
        导入词库
        <input type="file" id="upload-input" accept=".json" class="upload-input">
      </label>
      <span class="upload-status" id="upload-status"></span>
    </section>
    <!-- 词库列表 -->
    <section class="module-list" id="module-list"></section>
  </div>
  <script src="js/db.js"></script>
  <script src="js/vocabulary.js"></script>
  <script src="js/memory.js"></script>
  <script src="js/quiz.js"></script>
  <script src="js/errorBook.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write base CSS (variables, reset, layout, tabs)**

```css
/* === Reset & Variables === */
:root {
  --color-primary: #4a90d9;
  --color-danger: #e74c3c;
  --color-success: #27ae60;
  --color-bg: #f5f6fa;
  --color-card: #ffffff;
  --color-text: #2c3e50;
  --color-text-light: #7f8c8d;
  --color-border: #e0e0e0;
  --radius: 8px;
  --shadow: 0 2px 8px rgba(0,0,0,0.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

.app { max-width: 720px; margin: 0 auto; padding: 20px; }

/* === Header === */
.header { text-align: center; margin-bottom: 20px; }
.header__title { font-size: 1.8rem; }

/* === Tabs === */
.tabs { display: flex; gap: 4px; margin-bottom: 20px; }
.tab {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  cursor: pointer;
  font-size: 0.95rem;
  border-radius: var(--radius);
  transition: all 0.2s;
}
.tab--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

/* === Tab Content === */
.tab-content--hidden { display: none; }

/* === Card === */
.card { background: var(--color-card); border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; margin-bottom: 16px; }

/* === Buttons === */
.btn {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-card);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn--primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn--primary:hover { opacity: 0.9; }
.btn--danger { background: var(--color-danger); color: #fff; border-color: var(--color-danger); }
.btn--danger:hover { opacity: 0.9; }
.btn--success { background: var(--color-success); color: #fff; border-color: var(--color-success); }
.btn--success:hover { opacity: 0.9; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-group .btn--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

/* === Form === */
.select, .input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--color-card);
}
.input { width: 100%; }

/* === Upload === */
.upload-section { margin-top: 20px; text-align: center; }
.upload-label {
  display: inline-block;
  padding: 8px 20px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-light);
}
.upload-label:hover { border-color: var(--color-primary); color: var(--color-primary); }
.upload-input { display: none; }
.upload-status { display: block; margin-top: 8px; font-size: 0.85rem; }

/* === Module list === */
.module-list { margin-top: 12px; text-align: center; font-size: 0.85rem; color: var(--color-text-light); }

/* === Table === */
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.table th, .table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
.table th { cursor: pointer; user-select: none; font-weight: 600; white-space: nowrap; }
.table th:hover { color: var(--color-primary); }
.table__sort-icon { font-size: 0.75rem; margin-left: 4px; }

/* === Feedback === */
.feedback { padding: 12px; border-radius: var(--radius); margin-top: 12px; font-size: 0.95rem; }
.feedback--correct { background: #eafaf1; color: var(--color-success); }
.feedback--wrong { background: #fdedec; color: var(--color-danger); }

/* === Error dots === */
.error-dots { color: #e67e22; letter-spacing: 2px; }
.error-number { color: var(--color-danger); font-weight: bold; }

/* === Progress === */
.progress { text-align: center; font-size: 0.85rem; color: var(--color-text-light); margin: 12px 0; }

/* === Empty state === */
.empty { text-align: center; padding: 40px; color: var(--color-text-light); }

/* === Slider === */
.slider-wrap { display: flex; align-items: center; gap: 12px; }
.slider { flex: 1; }
.slider-value { min-width: 40px; text-align: center; font-weight: 600; }
```

- [ ] **Step 4: Write example.json**

```json
[
  { "word": "abandon", "definition": ["放弃", "抛弃"] },
  { "word": "abolish", "definition": ["废除", "废止"] },
  { "word": "abrupt", "definition": ["突然的", "唐突的"] },
  { "word": "abstract", "definition": ["抽象的", "摘要"] },
  { "word": "abundant", "definition": ["丰富的", "充裕的"] }
]
```

- [ ] **Step 5: Verify** — Open `index.html` in browser. Page loads with title, tabs, upload area. No errors in console.

---

### Task 2: IndexedDB Layer (db.js)

**Files:**
- Create: `js/db.js`

- [ ] **Step 1: Write db.js**

```js
const DB = (() => {
  const DB_NAME = 'wordmemory';
  const DB_VERSION = 1;

  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('vocabulary')) {
          const store = db.createObjectStore('vocabulary', { keyPath: 'id', autoIncrement: true });
          store.createIndex('module', 'module', { unique: false });
        }
        if (!db.objectStoreNames.contains('errorBook')) {
          db.createObjectStore('errorBook', { keyPath: 'word' });
        }
        if (!db.objectStoreNames.contains('modules')) {
          db.createObjectStore('modules', { keyPath: 'name' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(storeName, mode) {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- vocabulary ---

  async function clearVocabulary(moduleName) {
    const store = tx('vocabulary', 'readwrite');
    const index = store.index('module');
    const keys = await promisify(index.getAllKeys(moduleName));
    await Promise.all(keys.map(k => promisify(store.delete(k))));
  }

  async function addWords(words) {
    const store = tx('vocabulary', 'readwrite');
    await Promise.all(words.map(w => promisify(store.add(w))));
  }

  async function getVocabulary(moduleName) {
    const store = tx('vocabulary', 'readonly');
    const index = store.index('module');
    return promisify(index.getAll(moduleName));
  }

  async function getAllWords() {
    const store = tx('vocabulary', 'readonly');
    return promisify(store.getAll());
  }

  async function getVocabularyCount(moduleName) {
    const store = tx('vocabulary', 'readonly');
    const index = store.index('module');
    return promisify(index.count(moduleName));
  }

  async function getTotalWordCount() {
    const store = tx('vocabulary', 'readonly');
    return promisify(store.count());
  }

  // --- modules ---

  async function getModules() {
    const store = tx('modules', 'readonly');
    return promisify(store.getAll());
  }

  async function addModule(name) {
    const store = tx('modules', 'readwrite');
    return promisify(store.put({ name, importedAt: Date.now() }));
  }

  async function removeModule(name) {
    const store = tx('modules', 'readwrite');
    return promisify(store.delete(name));
  }

  // --- errorBook ---

  async function upsertErrorWord(word, definitions, moduleName) {
    const store = tx('errorBook', 'readwrite');
    const existing = await promisify(store.get(word));
    if (existing) {
      existing.errorCount += 1;
      existing.lastErrorTime = Date.now();
      return promisify(store.put(existing));
    }
    return promisify(store.put({
      word,
      definitions,
      module: moduleName,
      errorCount: 1,
      lastErrorTime: Date.now()
    }));
  }

  async function getErrorBook(sortBy, order) {
    const store = tx('errorBook', 'readonly');
    const all = await promisify(store.getAll());
    const dir = order === 'asc' ? 1 : -1;
    all.sort((a, b) => {
      if (sortBy === 'errorCount') return (a.errorCount - b.errorCount) * dir;
      return (a.lastErrorTime - b.lastErrorTime) * dir;
    });
    return all;
  }

  async function clearErrorBook() {
    const store = tx('errorBook', 'readwrite');
    return promisify(store.clear());
  }

  return {
    open,
    addWords, clearVocabulary, getVocabulary, getAllWords, getVocabularyCount, getTotalWordCount,
    getModules, addModule, removeModule,
    upsertErrorWord, getErrorBook, clearErrorBook
  };
})();
```

- [ ] **Step 2: Verify** — Open `index.html` in browser console, run:

```js
await DB.open();
// Check that the database was created
console.log('DB opened successfully');
// Should not throw
```

- [ ] **Step 3: Verify IndexedDB stores exist** — In DevTools > Application > IndexedDB > wordmemory, confirm `vocabulary`, `errorBook`, `modules` stores are present.

- [ ] **Step 4: Commit**

```bash
git add js/db.js
git commit -m "feat: add IndexedDB layer with vocabulary, errorBook, modules stores"
```

---

### Task 3: Vocabulary Management (vocabulary.js)

**Files:**
- Create: `js/vocabulary.js`

- [ ] **Step 1: Write vocabulary.js**

```js
const Vocabulary = (() => {

  function parseWordFile(jsonText, moduleName) {
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      return { success: false, error: '文件格式错误，请上传 JSON 文件', words: [], skipped: 0 };
    }
    if (!Array.isArray(data)) {
      return { success: false, error: 'JSON 文件内容必须是一个数组', words: [], skipped: 0 };
    }
    if (data.length === 0) {
      return { success: false, error: '词库文件无数据', words: [], skipped: 0 };
    }

    const words = [];
    let skipped = 0;

    for (const item of data) {
      if (!item.word || typeof item.word !== 'string') { skipped++; continue; }
      if (!Array.isArray(item.definition) || item.definition.length === 0) { skipped++; continue; }
      words.push({
        word: item.word.trim(),
        definitions: item.definition.map(d => String(d).trim()),
        module: moduleName
      });
    }

    if (words.length === 0) {
      return { success: false, error: '文件中没有合法的单词记录', words: [], skipped };
    }

    return { success: true, words, skipped, total: data.length };
  }

  async function importWords(file) {
    const moduleName = file.name.replace(/\.json$/i, '');
    const text = await file.text();
    const result = parseWordFile(text, moduleName);

    if (!result.success) {
      return result;
    }

    await DB.open();
    await DB.clearVocabulary(moduleName);
    await DB.removeModule(moduleName);
    await DB.addWords(result.words);
    await DB.addModule(moduleName);

    return result;
  }

  return { parseWordFile, importWords };
})();
```

- [ ] **Step 2: Test parseWordFile in browser console**

```js
// Valid data
const r1 = Vocabulary.parseWordFile('[{"word":"test","definition":["测试"]}]', 'test');
console.assert(r1.success === true, 'valid parse should succeed');
console.assert(r1.words.length === 1, 'should have 1 word');
console.assert(r1.skipped === 0, 'should skip 0');

// Empty array
const r2 = Vocabulary.parseWordFile('[]', 'empty');
console.assert(r2.success === false, 'empty array should fail');
console.assert(r2.error === '词库文件无数据', 'correct error message');

// Missing word
const r3 = Vocabulary.parseWordFile('[{"definition":["test"]}]', 'bad');
console.assert(r3.skipped === 1, 'should skip record without word');

// Missing definition
const r4 = Vocabulary.parseWordFile('[{"word":"test","definition":[]}]', 'bad2');
console.assert(r4.skipped === 1, 'should skip record with empty definition');

// Not JSON
const r5 = Vocabulary.parseWordFile('not json', 'bad3');
console.assert(r5.success === false, 'invalid JSON should fail');
console.assert(r5.error === '文件格式错误，请上传 JSON 文件', 'correct error');

// Not array
const r6 = Vocabulary.parseWordFile('{"word":"test"}', 'bad4');
console.assert(r6.success === false, 'object should fail');

console.log('All parseWordFile tests passed');
```

- [ ] **Step 3: Test importWords in browser console**

```js
await DB.open();
// Create a test File from example JSON
const text = '[{"word":"hello","definition":["你好"]},{"word":"world","definition":["世界"]}]';
const blob = new Blob([text], {type:'application/json'});
const file = new File([blob], 'test-import.json', {type:'application/json'});
const result = await Vocabulary.importWords(file);
console.assert(result.success === true, 'import should succeed');
console.assert(result.words.length === 2, 'should import 2 words');

// Check modules
const modules = await DB.getModules();
console.assert(modules.some(m => m.name === 'test-import'), 'module should be registered');

// Check vocabulary
const words = await DB.getVocabulary('test-import');
console.assert(words.length === 2, 'should have 2 words in vocabulary');
console.assert(words[0].definitions[0] === '你好', 'definitions should be stored');

console.log('All importWords tests passed');
```

- [ ] **Step 4: Commit**

```bash
git add js/vocabulary.js
git commit -m "feat: add vocabulary management with JSON parse and IndexedDB import"
```

---

### Task 4: App Shell (app.js)

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Write app.js**

```js
const App = (() => {
  let currentTab = 'memory';

  function init() {
    DB.open().then(() => {
      bindTabs();
      bindUpload();
      refreshModuleList();
      Memory.init();
      Quiz.init();
      ErrorBook.init();
    }).catch(err => {
      document.body.innerHTML = '<div class="empty">浏览器不支持 IndexedDB，请使用现代浏览器打开</div>';
      console.error('IndexedDB init failed:', err);
    });
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('tab--active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('tab-content--hidden', c.id !== 'tab-' + name));
    currentTab = name;
    if (name === 'errorbook') ErrorBook.render();
    if (name === 'quiz') Quiz.refreshState();
  }

  function bindUpload() {
    const input = document.getElementById('upload-input');
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('upload-status');
      status.textContent = '导入中...';
      try {
        const result = await Vocabulary.importWords(file);
        if (result.success) {
          let msg = `成功导入 ${result.words.length} 个单词 (${result.total} 条中跳过 ${result.skipped} 条)`;
          status.textContent = msg;
        } else {
          status.textContent = result.error;
        }
        refreshModuleList();
        e.target.value = '';
      } catch (err) {
        status.textContent = '导入失败: ' + err.message;
      }
    });
  }

  async function refreshModuleList() {
    const modules = await DB.getModules();
    const el = document.getElementById('module-list');
    if (modules.length === 0) {
      el.innerHTML = '<span>暂无词库，请上传 JSON 文件</span>';
    } else {
      const names = modules.map(m => m.name).join('、');
      el.innerHTML = '<span>已导入词库: ' + names + '</span>';
    }
  }

  return { init, switchTab, refreshModuleList };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
```

- [ ] **Step 2: Verify** — Open `index.html`. Console shows no errors. Tabs switch correctly. Upload area shows "暂无词库".

- [ ] **Step 3: Test upload flow** — Upload `data/example.json` via the upload input. Status shows success message. Module list updates.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: add app shell with tab switching and upload binding"
```

---

### Task 5: Word Memory Module (memory.js)

**Files:**
- Create: `js/memory.js`
- Modify: `index.html` — fill `#tab-memory` content

- [ ] **Step 1: Update index.html tab-memory section**

Replace `<!-- Task 5 -->` in `#tab-memory` with:

```html
<div class="card">
  <h2>单词记忆</h2>
  <div class="btn-group" style="margin:12px 0">
    <label>词库：</label>
    <select id="memory-module" class="select"></select>
  </div>
  <div class="btn-group" style="margin:12px 0">
    <label>数量：</label>
    <button class="btn memory-count" data-count="10">10</button>
    <button class="btn memory-count" data-count="20">20</button>
    <button class="btn memory-count" data-count="50">50</button>
    <input type="number" id="memory-count-custom" class="input" style="width:80px" placeholder="自定义" min="1">
  </div>
  <button class="btn btn--primary" id="memory-start">开始记忆</button>
  <div id="memory-play-area" style="display:none">
    <div class="progress"><span id="memory-progress"></span></div>
    <div style="text-align:center; margin:24px 0">
      <div style="font-size:2rem; font-weight:bold" id="memory-word"></div>
    </div>
    <div class="btn-group" style="justify-content:center">
      <button class="btn btn--success" id="memory-know">会</button>
      <button class="btn btn--danger" id="memory-dunno">不会</button>
    </div>
    <div id="memory-definition" style="display:none; text-align:center; margin-top:12px; color: var(--color-text-light);"></div>
  </div>
  <div id="memory-result" style="display:none; text-align:center"></div>
</div>
```

- [ ] **Step 2: Write memory.js**

```js
const Memory = (() => {
  let words = [];
  let currentIndex = 0;
  let dunnoCount = 0;
  let active = false;

  async function init() {
    await refreshModuleSelect();
    document.getElementById('memory-start').addEventListener('click', start);
    document.getElementById('memory-know').addEventListener('click', () => answer(false));
    document.getElementById('memory-dunno').addEventListener('click', () => answer(true));

    document.querySelectorAll('.memory-count').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.memory-count').forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
        document.getElementById('memory-count-custom').value = '';
      });
    });
  }

  async function refreshModuleSelect() {
    const modules = await DB.getModules();
    const select = document.getElementById('memory-module');
    select.innerHTML = modules.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    if (modules.length === 0) {
      select.innerHTML = '<option value="">请先上传词库</option>';
      document.getElementById('memory-start').disabled = true;
    } else {
      document.getElementById('memory-start').disabled = false;
    }
  }

  function getSelectedCount() {
    const custom = parseInt(document.getElementById('memory-count-custom').value, 10);
    if (!isNaN(custom) && custom > 0) return custom;
    const active = document.querySelector('.memory-count.btn--active');
    return active ? parseInt(active.dataset.count, 10) : 10;
  }

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
    active = true;

    document.getElementById('memory-play-area').style.display = 'block';
    document.getElementById('memory-result').style.display = 'none';
    document.getElementById('memory-start').disabled = true;
    showCurrentWord();
  }

  function showCurrentWord() {
    if (currentIndex >= words.length) {
      finish();
      return;
    }
    document.getElementById('memory-word').textContent = words[currentIndex].word;
    document.getElementById('memory-progress').textContent =
      `进度: ${currentIndex + 1} / ${words.length}`;
    document.getElementById('memory-definition').style.display = 'none';
  }

  async function answer(isDunno) {
    if (!active) return;
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

  function finish() {
    active = false;
    document.getElementById('memory-play-area').style.display = 'none';
    document.getElementById('memory-start').disabled = false;
    const result = document.getElementById('memory-result');
    result.style.display = 'block';
    result.innerHTML = `
      <div class="feedback feedback--correct">
        本轮完成！共 ${words.length} 个单词，不会 ${dunnoCount} 个
      </div>`;
  }

  return { init, refreshModuleSelect };
})();
```

- [ ] **Step 3: Verify manually** — Upload example.json, then:
  - Select module in memory tab → click "开始记忆"
  - Verify first word appears with progress "1/N"
  - Click "会" → next word appears
  - Click "不会" → definition shows for 1.5s, then next word
  - Complete all → see result summary

- [ ] **Step 4: Verify skip logic** — Choose count > vocabulary size → should use all words without error.

- [ ] **Step 5: Commit**

```bash
git add js/memory.js index.html
git commit -m "feat: add word memory module with know/don't-know flow"
```

---

### Task 6: Word Quiz Module (quiz.js)

**Files:**
- Create: `js/quiz.js`
- Modify: `index.html` — fill `#tab-quiz` content

- [ ] **Step 1: Update index.html tab-quiz section**

Replace `<!-- Task 6 -->` in `#tab-quiz` with:

```html
<div class="card">
  <h2>单词抽查</h2>
  <div class="slider-wrap" style="margin:12px 0">
    <label>抽查数量：</label>
    <input type="range" id="quiz-count-slider" class="slider" min="0" max="10" value="5">
    <span class="slider-value" id="quiz-count-display">5</span>
    <span style="font-size:0.8rem;color:var(--color-text-light)">(共 <span id="quiz-total-words">0</span> 词)</span>
  </div>
  <button class="btn btn--primary" id="quiz-start">开始抽查</button>
  <div id="quiz-play-area" style="display:none">
    <div class="progress"><span id="quiz-progress"></span></div>
    <div style="text-align:center; margin:24px 0">
      <div style="font-size:2rem; font-weight:bold" id="quiz-word"></div>
    </div>
    <div>
      <input type="text" class="input" id="quiz-input" placeholder="输入释义..." autocomplete="off">
    </div>
    <div class="btn-group" style="margin-top:12px; justify-content:center">
      <button class="btn btn--primary" id="quiz-submit">确定</button>
      <button class="btn btn--danger" id="quiz-forgot">忘了</button>
    </div>
    <div id="quiz-feedback"></div>
  </div>
  <div id="quiz-result" style="display:none; text-align:center"></div>
</div>
```

- [ ] **Step 2: Write quiz.js with checkAnswer utility**

```js
const Quiz = (() => {
  let words = [];
  let currentIndex = 0;
  let correctCount = 0;
  let active = false;

  function normalize(str) {
    return str.replace(/^[，。！？、,.!?\s]+/, '').replace(/[，。！？、,.!?\s]+$/, '').trim();
  }

  function charOverlap(a, b) {
    const setA = new Set([...a]);
    const setB = new Set([...b]);
    let common = 0;
    for (const c of setA) {
      if (setB.has(c)) common++;
    }
    return common / setA.size;
  }

  function checkAnswer(input, definitions) {
    const userNorm = normalize(input);
    if (!userNorm) return false;

    for (const def of definitions) {
      const defNorm = normalize(def);
      // Rule 1: exact match after normalization
      if (userNorm === defNorm) return true;
      // Rule 2: contains or is contained
      if (userNorm.includes(defNorm) || defNorm.includes(userNorm)) return true;
      // Rule 3: char overlap >= 50%
      if (charOverlap(userNorm, defNorm) >= 0.5) return true;
    }
    return false;
  }

  async function init() {
    document.getElementById('quiz-start').addEventListener('click', start);
    document.getElementById('quiz-submit').addEventListener('click', submit);
    document.getElementById('quiz-forgot').addEventListener('click', forgot);

    const slider = document.getElementById('quiz-count-slider');
    const display = document.getElementById('quiz-count-display');
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
      document.getElementById('quiz-start').disabled = parseInt(slider.value) === 0;
    });

    document.getElementById('quiz-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && active) submit();
    });
  }

  async function refreshState() {
    const total = await DB.getTotalWordCount();
    document.getElementById('quiz-total-words').textContent = total;
    const slider = document.getElementById('quiz-count-slider');
    slider.max = total;
    if (parseInt(slider.value) > total) slider.value = total;
    if (total === 0) {
      document.getElementById('quiz-start').disabled = true;
    } else {
      document.getElementById('quiz-start').disabled = parseInt(slider.value) === 0;
    }
    document.getElementById('quiz-count-display').textContent = slider.value;
  }

  async function start() {
    const count = parseInt(document.getElementById('quiz-count-slider').value);
    if (count === 0) return;

    await DB.open();
    const errorWords = await DB.getErrorBook('errorCount', 'desc');
    const allWords = await DB.getAllWords();

    // Prioritize error words
    const picked = [];
    const usedWords = new Set();

    for (const ew of errorWords) {
      if (picked.length >= count) break;
      if (!usedWords.has(ew.word)) {
        picked.push(ew);
        usedWords.add(ew.word);
      }
    }

    // Fill remaining from vocabulary
    const remaining = allWords.filter(w => !usedWords.has(w.word));
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    for (const w of shuffled) {
      if (picked.length >= count) break;
      picked.push(w);
    }

    words = picked.slice(0, count);
    currentIndex = 0;
    correctCount = 0;
    active = true;

    document.getElementById('quiz-play-area').style.display = 'block';
    document.getElementById('quiz-result').style.display = 'none';
    document.getElementById('quiz-start').disabled = true;
    showCurrentWord();
  }

  function showCurrentWord() {
    if (currentIndex >= words.length) { finish(); return; }
    document.getElementById('quiz-word').textContent = words[currentIndex].word;
    document.getElementById('quiz-progress').textContent =
      `进度: ${currentIndex + 1} / ${words.length}`;
    document.getElementById('quiz-input').value = '';
    document.getElementById('quiz-feedback').innerHTML = '';
    document.getElementById('quiz-input').focus();
  }

  async function submit() {
    if (!active) return;
    const input = document.getElementById('quiz-input').value;
    const word = words[currentIndex];
    const isCorrect = checkAnswer(input, word.definitions);
    const fb = document.getElementById('quiz-feedback');

    if (isCorrect) {
      correctCount++;
      fb.innerHTML = `<div class="feedback feedback--correct">正确！${word.word}: ${word.definitions.join('；')}</div>`;
    } else {
      fb.innerHTML = `<div class="feedback feedback--wrong">错误！${word.word}: ${word.definitions.join('；')}</div>`;
      await DB.upsertErrorWord(word.word, word.definitions, word.module || '');
    }

    currentIndex++;
    setTimeout(() => showCurrentWord(), 1500);
  }

  async function forgot() {
    if (!active) return;
    const word = words[currentIndex];
    document.getElementById('quiz-feedback').innerHTML =
      `<div class="feedback feedback--wrong">${word.word}: ${word.definitions.join('；')}</div>`;
    await DB.upsertErrorWord(word.word, word.definitions, word.module || '');
    currentIndex++;
    setTimeout(() => showCurrentWord(), 1500);
  }

  function finish() {
    active = false;
    document.getElementById('quiz-play-area').style.display = 'none';
    document.getElementById('quiz-start').disabled = false;
    refreshState();
    const result = document.getElementById('quiz-result');
    result.style.display = 'block';
    result.innerHTML = `
      <div class="feedback ${correctCount === words.length ? 'feedback--correct' : 'feedback--wrong'}">
        抽查完成！正确率 ${correctCount} / ${words.length}
      </div>`;
  }

  return { init, refreshState, checkAnswer };
})();
```

- [ ] **Step 3: Test checkAnswer in browser console**

```js
// Exact match
console.assert(Quiz.checkAnswer('放弃', ['放弃', '抛弃']) === true, 'exact match');
// Contains
console.assert(Quiz.checkAnswer('放弃它', ['放弃', '抛弃']) === true, 'input contains def');
console.assert(Quiz.checkAnswer('弃', ['放弃']) === true, 'def contains input');
// Normalized match
console.assert(Quiz.checkAnswer('  放弃  ', ['放弃', '抛弃']) === true, 'normalized match');
// Overlap >= 50%
console.assert(Quiz.checkAnswer('放手', ['放弃']) === true, 'overlap match');
// Wrong answer
console.assert(Quiz.checkAnswer('帮助', ['放弃', '抛弃']) === false, 'wrong answer');
// Empty input
console.assert(Quiz.checkAnswer('', ['放弃']) === false, 'empty input');

console.log('All checkAnswer tests passed');
```

- [ ] **Step 4: Verify manually** — Upload example.json, then:
  - Go to quiz tab → see word count, slider
  - Select 3 words → "开始抽查"
  - Type correct answer → see green "正确"
  - Type wrong answer → see red "错误" with correct definition
  - Click "忘了" → see definition directly
  - Complete all → see accuracy summary
  - Slider at 0 → start button disabled

- [ ] **Step 5: Commit**

```bash
git add js/quiz.js index.html
git commit -m "feat: add word quiz module with multi-condition answer checking"
```

---

### Task 7: Error Book Module (errorBook.js)

**Files:**
- Create: `js/errorBook.js`
- Modify: `index.html` — fill `#tab-errorbook` content

- [ ] **Step 1: Update index.html tab-errorbook section**

Replace `<!-- Task 7 -->` in `#tab-errorbook` with:

```html
<div class="card">
  <h2>生词本</h2>
  <div class="btn-group" style="margin:12px 0">
    <button class="btn btn--danger" id="errorbook-clear">清空生词本</button>
  </div>
  <div class="table-wrap">
    <table class="table" id="errorbook-table">
      <thead>
        <tr>
          <th>#</th>
          <th>单词</th>
          <th>释义</th>
          <th>来源模块</th>
          <th data-sort="errorCount">错误次数 <span class="table__sort-icon"></span></th>
          <th data-sort="lastErrorTime">最后错误时间 <span class="table__sort-icon">▼</span></th>
        </tr>
      </thead>
      <tbody id="errorbook-tbody"></tbody>
    </table>
  </div>
  <div class="empty" id="errorbook-empty" style="display:none">生词本暂无数据</div>
</div>
```

- [ ] **Step 2: Write errorBook.js**

```js
const ErrorBook = (() => {
  let sortBy = 'lastErrorTime';
  let order = 'desc';

  function formatErrorCount(count) {
    if (count <= 3) {
      return '<span class="error-dots">' + '●'.repeat(count) + '</span>';
    }
    return '<span class="error-number">' + count + '</span>';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function init() {
    document.querySelectorAll('#errorbook-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortBy === col) {
          order = order === 'asc' ? 'desc' : 'asc';
        } else {
          sortBy = col;
          order = 'desc';
        }
        render();
      });
    });

    document.getElementById('errorbook-clear').addEventListener('click', async () => {
      if (confirm('确认清空所有生词？')) {
        await DB.clearErrorBook();
        render();
      }
    });
  }

  async function render() {
    const data = await DB.getErrorBook(sortBy, order);
    const tbody = document.getElementById('errorbook-tbody');
    const empty = document.getElementById('errorbook-empty');

    // Update sort indicators
    document.querySelectorAll('#errorbook-table th[data-sort] .table__sort-icon').forEach(el => {
      el.textContent = '';
    });
    const activeTh = document.querySelector(`#errorbook-table th[data-sort="${sortBy}"] .table__sort-icon`);
    if (activeTh) {
      activeTh.textContent = order === 'asc' ? '▲' : '▼';
    }

    if (data.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.word}</td>
        <td>${item.definitions.join('；')}</td>
        <td>${item.module || '-'}</td>
        <td>${formatErrorCount(item.errorCount)}</td>
        <td>${formatTime(item.lastErrorTime)}</td>
      </tr>
    `).join('');
  }

  return { init, render };
})();
```

- [ ] **Step 3: Verify manually** — Upload example.json, then:
  - In memory tab, click "不会" on a few words
  - In quiz tab, answer wrong or click "忘了"
  - Switch to error book tab → see all error words with count/time
  - Error count ≤ 3 shows dots (●●), >3 shows red number
  - Click "错误次数" header → sort by count (toggle asc/desc)
  - Click "最后错误时间" header → sort by time (toggle asc/desc)
  - Click "清空生词本" → confirm → table clears, shows "暂无数据"

- [ ] **Step 4: Commit**

```bash
git add js/errorBook.js index.html
git commit -m "feat: add error book module with sort, visual dots, and clear"
```

---

### Task 8: Integration & Polish

**Files:**
- Modify: `css/style.css` — add any missing styles
- Modify: `js/app.js` — ensure refreshModuleList is called from all modules

- [ ] **Step 1: Update app.js to refresh module list after import triggers memory module refresh**

The `refreshModuleList` function already exists. Ensure `Memory.refreshModuleSelect()` is called after import. Update `refreshModuleList` in app.js:

```js
async function refreshModuleList() {
  const modules = await DB.getModules();
  const el = document.getElementById('module-list');
  if (modules.length === 0) {
    el.innerHTML = '<span>暂无词库，请上传 JSON 文件</span>';
  } else {
    const names = modules.map(m => m.name).join('、');
    el.innerHTML = '<span>已导入词库: ' + names + '</span>';
  }
  // Also refresh memory module's dropdown
  if (Memory.refreshModuleSelect) await Memory.refreshModuleSelect();
  if (Quiz.refreshState) await Quiz.refreshState();
}
```

- [ ] **Step 2: Full integration test**

Follow this script manually:
1. Open `index.html` — see upload prompt, tabs, empty modules list
2. Upload `example.json` — see success message, module list updates
3. **Memory tab**: select module, count 3, start → click "会"/"不会" through all 3 → see result
4. **Quiz tab**: set count to 3, start → answer one correctly, one wrong, one "忘了" → see accuracy
5. **Error book tab**: see words from steps 3-4 with dot counts, sort by count/time, verify time display
6. Clear error book, confirm it's empty
7. Quick memory round with 0 mistakes, verify error book stays empty
8. Refresh page — all data persists, error book still has entries (if not cleared)
9. Upload a second JSON with different module name — both modules appear in dropdown
10. Test edge case: upload empty array → error message

- [ ] **Step 3: Verify no console errors** — Open DevTools console, go through all flows, verify zero errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate all modules, add refresh hooks, polish styles"
```

---
