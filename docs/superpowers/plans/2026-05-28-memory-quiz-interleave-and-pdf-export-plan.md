# Memory Mode Refactor + PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor memory mode to manual advance after "不会" with interleaved quiz checks, and add PDF export to the error book.

**Architecture:** Modify `memory.js` to support a two-mode state machine (regular word display vs quiz input), interleaving quiz words drawn from error book + in-session mistakes. Add jsPDF CDN library for client-side PDF generation in `errorBook.js`.

**Tech Stack:** Vanilla JS (IIFE modules), IndexedDB (via existing `DB` module), jsPDF 2.5.1 + autotable plugin (CDN), no new npm dependencies.

---

### Task 1: Update HTML with new UI elements and CDN scripts

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add jsPDF and autotable CDN scripts**

Add before the existing `<script>` tags (before `js/db.js`):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

- [ ] **Step 2: Add "下一个" button and quiz area to memory section**

In `#tab-memory`, replace the existing button group (lines 40-44: the `<div class="btn-group">` containing `#memory-prev`, `#memory-know`, `#memory-dunno`) and the definition div with:

```html
<div class="btn-group" style="justify-content:center" id="memory-regular-btns">
  <button class="btn" id="memory-prev" disabled>上一个</button>
  <button class="btn btn--success" id="memory-know">会</button>
  <button class="btn btn--danger" id="memory-dunno">不会</button>
  <button class="btn btn--primary" id="memory-next" style="display:none">下一个</button>
</div>
<div id="memory-quiz-area" style="display:none">
  <input type="text" class="input" id="memory-quiz-input" placeholder="输入释义..." autocomplete="off">
  <div class="btn-group" style="margin-top:12px; justify-content:center">
    <button class="btn btn--primary" id="memory-quiz-submit">确定</button>
    <button class="btn btn--danger" id="memory-quiz-forgot">忘了</button>
  </div>
  <div id="memory-quiz-feedback"></div>
</div>
<div id="memory-definition" style="display:none; text-align:center; margin-top:12px; color: var(--color-text-light);"></div>
```

- [ ] **Step 3: Add "导出PDF" button to error book section**

In `#tab-errorbook`, change the button group to include an export button:

```html
<div class="btn-group" style="margin:12px 0">
  <button class="btn btn--danger" id="errorbook-clear">清空生词本</button>
  <button class="btn btn--primary" id="errorbook-export" disabled>导出PDF</button>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add memory quiz area, next button, and PDF export UI elements"
```

---

### Task 2: Add CSS for new memory elements

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add styles for memory quiz area**

Append at end of `css/style.css`:

```css
/* === Memory Quiz Area === */
#memory-quiz-input {
  margin: 12px 0;
  font-size: 1rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "style: add memory quiz area styles"
```

---

### Task 3: Refactor memory.js — manual advance and quiz interleaving

**Files:**
- Modify: `js/memory.js` (full rewrite of module internals)

- [ ] **Step 1: Add new state variables**

After `let history = [];` (line 6), add:

```javascript
let quizPool = [];
let quizPositions = [];
let quizUsed = new Set();
let inQuiz = false;
let currentQuizWord = null;
```

- [ ] **Step 2: Rewrite `init()` to bind new event handlers**

Replace the existing `init()` function (lines 8-22) with:

```javascript
async function init() {
    await refreshModuleSelect();
    document.getElementById('memory-start').addEventListener('click', start);
    document.getElementById('memory-know').addEventListener('click', () => answer(false));
    document.getElementById('memory-dunno').addEventListener('click', () => answer(true));
    document.getElementById('memory-prev').addEventListener('click', goBack);
    document.getElementById('memory-next').addEventListener('click', nextWord);
    document.getElementById('memory-quiz-submit').addEventListener('click', submitQuiz);
    document.getElementById('memory-quiz-forgot').addEventListener('click', forgotQuiz);
    document.getElementById('memory-quiz-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inQuiz) submitQuiz();
    });

    document.querySelectorAll('.memory-count').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.memory-count').forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
        document.getElementById('memory-count-custom').value = '';
      });
    });
  }
```

- [ ] **Step 3: Rewrite `start()` to build quiz pool and positions**

Replace the existing `start()` function (lines 43-63) with:

```javascript
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

    const quizCount = Math.ceil(count / 5);
    const errorWords = await DB.getErrorBook('errorCount', 'desc');
    const shuffledErrors = errorWords.sort(() => Math.random() - 0.5);
    quizPool = shuffledErrors.slice(0, quizCount).map(e => ({
      word: e.word,
      definitions: e.definitions,
      module: e.module || ''
    }));
    quizUsed = new Set();

    quizPositions = [];
    for (let i = 0; i < quizPool.length; i++) {
      quizPositions.push(Math.floor(Math.random() * count));
    }
    quizPositions.sort((a, b) => a - b);

    inQuiz = false;
    currentQuizWord = null;

    document.getElementById('memory-play-area').style.display = 'block';
    document.getElementById('memory-result').style.display = 'none';
    document.getElementById('memory-start').disabled = true;
    document.getElementById('memory-prev').disabled = true;
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    showCurrentWord();
  }
```

- [ ] **Step 4: Rewrite `showCurrentWord()` to handle end-of-session**

Replace the existing `showCurrentWord()` function (lines 65-75) with:

```javascript
function showCurrentWord() {
    if (currentIndex >= words.length) {
      finish();
      return;
    }
    document.getElementById('memory-word').textContent = words[currentIndex].word;
    document.getElementById('memory-progress').textContent =
      `进度: ${currentIndex + 1} / ${words.length}`;
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-prev').disabled = history.length === 0;
    document.getElementById('memory-know').style.display = '';
    document.getElementById('memory-dunno').style.display = '';
  }
```

- [ ] **Step 5: Rewrite `answer()` to use manual advance**

Replace the existing `answer()` function (lines 77-96) with:

```javascript
async function answer(isDunno) {
    if (!active || inQuiz) return;

    history.push({ index: currentIndex, action: isDunno ? 'dunno' : 'know' });

    if (isDunno) {
      const w = words[currentIndex];
      document.getElementById('memory-definition').textContent =
        w.definitions.join('；');
      document.getElementById('memory-definition').style.display = 'block';
      document.getElementById('memory-next').style.display = 'inline-block';
      document.getElementById('memory-know').style.display = 'none';
      document.getElementById('memory-dunno').style.display = 'none';
      dunnoCount++;
      await DB.upsertErrorWord(w.word, w.definitions, w.module);
      addToQuizPool(w);
    } else {
      currentIndex++;
      maybeQuizOrAdvance();
    }
  }
```

- [ ] **Step 6: Add `nextWord()`, `addToQuizPool()`, `maybeQuizOrAdvance()`**

Add after the `answer()` function:

```javascript
async function nextWord() {
    if (!active || inQuiz) return;
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-know').style.display = '';
    document.getElementById('memory-dunno').style.display = '';
    currentIndex++;
    maybeQuizOrAdvance();
  }

  function addToQuizPool(word) {
    quizPool.push(word);
    if (currentIndex < words.length - 1) {
      const pos = Math.floor(Math.random() * (words.length - currentIndex - 1)) + currentIndex + 1;
      quizPositions.push(pos);
      quizPositions.sort((a, b) => a - b);
    }
  }

  function maybeQuizOrAdvance() {
    if (currentIndex >= words.length) {
      finish();
      return;
    }
    if (quizPositions.length > 0 && currentIndex === quizPositions[0] && quizPool.length > 0) {
      quizPositions.shift();
      startQuiz();
    } else {
      showCurrentWord();
    }
  }
```

- [ ] **Step 7: Add quiz interaction functions `startQuiz()`, `submitQuiz()`, `forgotQuiz()`**

Add after `maybeQuizOrAdvance()`:

```javascript
function startQuiz() {
    const available = quizPool.filter(w => !quizUsed.has(w.word));
    if (available.length === 0) {
      showCurrentWord();
      return;
    }
    inQuiz = true;
    currentQuizWord = available[Math.floor(Math.random() * available.length)];
    quizUsed.add(currentQuizWord.word);

    document.getElementById('memory-word').textContent = currentQuizWord.word;
    document.getElementById('memory-quiz-area').style.display = 'block';
    document.getElementById('memory-regular-btns').style.display = 'none';
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-prev').disabled = true;
    document.getElementById('memory-quiz-input').value = '';
    document.getElementById('memory-quiz-feedback').innerHTML = '';
    document.getElementById('memory-quiz-input').focus();
  }

  async function submitQuiz() {
    if (!inQuiz) return;
    const input = document.getElementById('memory-quiz-input').value;
    const isCorrect = Quiz.checkAnswer(input, currentQuizWord.definitions);
    const fb = document.getElementById('memory-quiz-feedback');

    if (isCorrect) {
      fb.innerHTML = `<div class="feedback feedback--correct">正确！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
    } else {
      fb.innerHTML = `<div class="feedback feedback--wrong">错误！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
      await DB.upsertErrorWord(currentQuizWord.word, currentQuizWord.definitions, currentQuizWord.module || '');
    }

    setTimeout(() => exitQuiz(), 1500);
  }

  async function forgotQuiz() {
    if (!inQuiz) return;
    document.getElementById('memory-quiz-feedback').innerHTML =
      `<div class="feedback feedback--wrong">${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
    await DB.upsertErrorWord(currentQuizWord.word, currentQuizWord.definitions, currentQuizWord.module || '');

    setTimeout(() => exitQuiz(), 1500);
  }

  function exitQuiz() {
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    document.getElementById('memory-quiz-feedback').innerHTML = '';
    inQuiz = false;
    currentQuizWord = null;
    showCurrentWord();
  }
```

- [ ] **Step 8: Update `goBack()` to handle quiz mode**

Replace the existing `goBack()` function (lines 98-109) with:

```javascript
async function goBack() {
    if (inQuiz) {
      document.getElementById('memory-quiz-area').style.display = 'none';
      document.getElementById('memory-regular-btns').style.display = '';
      document.getElementById('memory-quiz-feedback').innerHTML = '';
      inQuiz = false;
      currentQuizWord = null;
      showCurrentWord();
      return;
    }
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

- [ ] **Step 9: Update `finish()` to clean up quiz state**

Replace the existing `finish()` function (lines 111-121) with:

```javascript
function finish() {
    active = false;
    inQuiz = false;
    currentQuizWord = null;
    quizPool = [];
    quizPositions = [];
    quizUsed = new Set();
    document.getElementById('memory-play-area').style.display = 'none';
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    document.getElementById('memory-start').disabled = false;
    const result = document.getElementById('memory-result');
    result.style.display = 'block';
    result.innerHTML = `
      <div class="feedback feedback--correct">
        本轮完成！共 ${words.length} 个单词，不会 ${dunnoCount} 个
      </div>`;
  }
```

- [ ] **Step 10: Commit**

```bash
git add js/memory.js
git commit -m "feat: add manual advance and interleaved quiz to memory mode"
```

---

### Task 4: Add PDF export to errorBook.js

**Files:**
- Modify: `js/errorBook.js`

- [ ] **Step 1: Expose `formatTime` at module scope**

In `errorBook.js`, move `formatErrorCount` and `formatTime` out of `init()` and into the module closure (they're already at the module closure level based on the code). No change needed — they're already accessible within the IIFE.

- [ ] **Step 2: Add `exportPDF()` function and bind "导出PDF" button in `init()`**

In the `init()` function, add the export button binding after the clear button binding (after line 34). Then add `exportPDF()` function before the `return` statement:

In `init()`, add after `document.getElementById('errorbook-clear').addEventListener(...)`:

```javascript
document.getElementById('errorbook-export').addEventListener('click', exportPDF);
```

Add the `exportPDF` function before `return { init, render };`:

```javascript
async function exportPDF() {
    const data = await DB.getErrorBook(sortBy, order);
    if (data.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('生词本', 14, 20);

    const headers = [['序号', '单词', '释义', '来源模块', '错误次数', '最后错误时间']];
    const rows = data.map((item, i) => [
      String(i + 1),
      item.word,
      item.definitions.join('；'),
      item.module || '-',
      String(item.errorCount),
      formatTime(item.lastErrorTime)
    ]);

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 28,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [155, 126, 216], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 242, 252] }
    });

    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    doc.save(`生词本_${dateStr}.pdf`);
  }
```

- [ ] **Step 3: Update `render()` to toggle "导出PDF" button state**

In the `render()` function, add enabling/disabling of the export button:

After the `if (data.length === 0)` block (around line 55), add:

```javascript
document.getElementById('errorbook-export').disabled = data.length === 0;
```

Place it right after `empty.style.display = 'block';` (in the empty case) and `empty.style.display = 'none';` (in the non-empty case), so both branches update the button.

- [ ] **Step 4: Update the `return` statement to expose `exportPDF`**

Not needed — `exportPDF` is called via the event listener bound in `init()`. No public API change required.

- [ ] **Step 5: Commit**

```bash
git add js/errorBook.js
git commit -m "feat: add PDF export to error book"
```

---

### Task 5: Run existing tests to verify no regressions

**Files:**
- Test: `test/test.html`

- [ ] **Step 1: Verify test page loads correctly**

Open `test/test.html` via the local HTTP server (`http://localhost:3000/test/test.html`) and check that all existing tests pass. Or verify via headless check:

```bash
npx playwright test --headed 2>/dev/null || echo "Use browser at http://localhost:3000/test/test.html"
```

- [ ] **Step 2: Verify no console errors on main page**

Open `http://localhost:3000/` in browser, open DevTools console, and confirm:
- `data/modules.json` loads successfully
- `data/kaoyan.json` loads successfully
- "已导入词库: example、考研高频单词" is displayed
- No red errors in console

- [ ] **Step 3: Commit (if any fixes needed)**

```bash
git commit -m "test: verify regression test suite passes"
```

---

### Task 6: Manual verification checklist

- [ ] **Step 1: Test "不会" → "下一个" flow**

1. Open `http://localhost:3000/`
2. Select "考研高频单词", pick 10 words, click "开始记忆"
3. Click "不会" → verify: Chinese definition appears, "下一个" button appears, "会"/"不会" hidden
4. Click "下一个" → verify: definition hides, advances to next word, "会"/"不会" reappear

- [ ] **Step 2: Test "会" flow (unchanged)**

1. Click "会" → verify: immediately advances to next word

- [ ] **Step 3: Test "上一个" during regular words**

1. Click "上一个" → verify: goes back to previous word, re-shows it

- [ ] **Step 4: Test quiz interleaving**

1. Continue through memory session → verify: randomly, a quiz input appears (showing a word + input field)
2. Type correct answer → verify: "正确" feedback, auto-advances
3. Type wrong answer → verify: "错误" feedback with definition, auto-advances
4. Click "忘了" during quiz → verify: shows definition, auto-advances

- [ ] **Step 5: Test quiz updates error book**

1. After a quiz where you answered wrong, switch to "生词本" tab
2. Verify: the word appears with error count incremented

- [ ] **Step 6: Test "上一个" during quiz**

1. When a quiz is active, click "上一个" → verify: cancels quiz, returns to current regular word

- [ ] **Step 7: Test PDF export**

1. Go to "生词本" tab (needs at least one entry)
2. Click "导出PDF" → verify: PDF downloads with filename `生词本_YYYY-MM-DD.pdf`
3. Open PDF → verify: contains table with correct columns and data
4. Clear all entries → verify: "导出PDF" button is disabled
