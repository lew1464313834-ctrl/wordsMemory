# Memory "会" 2s Definition + Quiz Wrong Words PDF + CJK Font Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Add 2s definition display on "会" click, quiz end screen with wrong words + PDF export, fix PDF Chinese garbled characters using html2canvas.

**Architecture:** Use html2canvas to render HTML tables as images for PDF export (avoids CJK font embedding). Modify memory.js answer(false) for delayed advance. Track wrong words in quiz.js and render end screen with export button.

**Tech Stack:** Vanilla JS, html2canvas CDN, jsPDF 2.5.1

---

### Task 1: Add html2canvas CDN

**Files:** Modify `index.html`

- [ ] Add html2canvas CDN after jsPDF scripts (line 126):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
```

---

### Task 2: Fix PDF Chinese garbled characters in errorBook.js

**Files:** Modify `js/errorBook.js`

- [ ] Replace `exportPDF()` function with html2canvas-based version:

```javascript
async function exportPDF() {
    const data = await DB.getErrorBook(sortBy, order);
    if (data.length === 0) return;

    // Build HTML table in a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px';
    container.style.fontFamily = '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    container.style.fontSize = '12px';
    container.style.color = '#333';
    container.style.background = '#fff';
    container.style.padding = '16px';
    
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    
    let html = '<h2 style="margin-bottom:12px">生词本</h2>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="background:#9B7ED8;color:#fff">';
    html += '<th style="padding:8px;border:1px solid #ddd">#</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">单词</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">释义</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">来源模块</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">错误次数</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">最后错误时间</th>';
    html += '</tr></thead><tbody>';
    
    data.forEach((item, i) => {
      html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f5f2fc') + '">';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + item.word + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + item.definitions.join('；') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (item.module || '-') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center">' + item.errorCount + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + formatTime(item.lastErrorTime) + '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    document.body.appendChild(container);
    
    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;
      const imgData = canvas.toDataURL('image/png');
      
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
      
      while (heightLeft > 0) {
        position = margin - (imgHeight - (pageHeight - margin * 2));
        doc.addPage();
        doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }
      
      doc.save(`生词本_${dateStr}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  }
```

---

### Task 3: Add quiz wrong words tracking + end screen + PDF export

**Files:** Modify `js/quiz.js`

- [ ] **Step 1: Add `wrongWords` state variable**

After `let active = false;` add:
```javascript
let wrongWords = [];
```

- [ ] **Step 2: Record wrong words in `submit()`**

After `await DB.upsertErrorWord(...)` in the error branch, add:
```javascript
wrongWords.push({ word: word.word, definitions: word.definitions, answer: input });
```

- [ ] **Step 3: Record wrong words in `forgot()`**

After `await DB.upsertErrorWord(...)`, add:
```javascript
wrongWords.push({ word: word.word, definitions: word.definitions, answer: '(忘了)' });
```

- [ ] **Step 4: Clear wrongWords in `start()`**

In `start()`, after `correctCount = 0;` add:
```javascript
wrongWords = [];
```

- [ ] **Step 5: Rewrite `finish()` to render wrong words table + PDF button**

Replace `finish()` function:

```javascript
function finish() {
    active = false;
    document.getElementById('quiz-play-area').style.display = 'none';
    document.getElementById('quiz-start').disabled = false;
    refreshState();
    const result = document.getElementById('quiz-result');
    result.style.display = 'block';
    
    const wrongCount = wrongWords.length;
    const total = words.length;
    const correct = total - wrongCount;
    
    let html = `<div class="feedback ${wrongCount === 0 ? 'feedback--correct' : 'feedback--wrong'}">
      抽查完成！正确率 ${correct} / ${total}</div>`;
    
    if (wrongCount > 0) {
      html += '<div style="margin-top:16px"><h3>错词列表</h3>';
      html += '<button class="btn btn--primary" id="quiz-export-pdf" style="margin:8px 0">导出PDF</button>';
      html += '<div class="table-wrap" style="margin-top:8px"><table class="table"><thead><tr>';
      html += '<th>单词</th><th>释义</th><th>你的回答</th>';
      html += '</tr></thead><tbody>';
      wrongWords.forEach(w => {
        html += '<tr><td style="font-weight:bold">' + w.word + '</td>';
        html += '<td>' + w.definitions.join('；') + '</td>';
        html += '<td style="color:var(--color-danger)">' + w.answer + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }
    
    result.innerHTML = html;
    
    if (wrongCount > 0) {
      document.getElementById('quiz-export-pdf').addEventListener('click', exportWrongWordsPDF);
    }
  }
```

- [ ] **Step 6: Add `exportWrongWordsPDF()` function**

Add before `return { init, refreshState, checkAnswer };`:

```javascript
async function exportWrongWordsPDF() {
    if (wrongWords.length === 0) return;
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '600px';
    container.style.fontFamily = '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    container.style.fontSize = '12px';
    container.style.color = '#333';
    container.style.background = '#fff';
    container.style.padding = '16px';
    
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    
    let html = '<h2 style="margin-bottom:12px">抽查错词</h2>';
    html += '<p style="margin-bottom:8px;color:#666">' + dateStr + '</p>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="background:#9B7ED8;color:#fff">';
    html += '<th style="padding:8px;border:1px solid #ddd">#</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">单词</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">释义</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">你的回答</th>';
    html += '</tr></thead><tbody>';
    
    wrongWords.forEach((w, i) => {
      html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f5f2fc') + '">';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + w.word + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + w.definitions.join('；') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;color:#D04A5A">' + w.answer + '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    document.body.appendChild(container);
    
    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;
      const imgData = canvas.toDataURL('image/png');
      
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
      
      while (heightLeft > 0) {
        position = margin - (imgHeight - (pageHeight - margin * 2));
        doc.addPage();
        doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }
      
      doc.save(`抽查错词_${dateStr}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  }
```

- [ ] **Step 7: Update return statement**

Change `return { init, refreshState, checkAnswer };` to:
```javascript
return { init, refreshState, checkAnswer };
```
(No change needed — exportWrongWordsPDF is internal)

---

### Task 4: Add 2s definition display on "会" click in memory.js

**Files:** Modify `js/memory.js`

- [ ] **Step 1: Modify `answer(false)` branch to show definition for 2 seconds**

In `answer()`, replace the `else` branch:

From:
```javascript
} else {
    currentIndex++;
    maybeQuizOrAdvance();
}
```

To:
```javascript
} else {
    const w = words[currentIndex];
    document.getElementById('memory-definition').textContent = w.definitions.join('；');
    document.getElementById('memory-definition').style.display = 'block';
    document.getElementById('memory-know').style.display = 'none';
    document.getElementById('memory-dunno').style.display = 'none';
    document.getElementById('memory-prev').disabled = true;
    currentIndex++;
    setTimeout(() => {
      document.getElementById('memory-definition').style.display = 'none';
      document.getElementById('memory-know').style.display = '';
      document.getElementById('memory-dunno').style.display = '';
      maybeQuizOrAdvance();
    }, 2000);
}
```

---

### Task 5: Verification

- [ ] Run all 23 tests: open `http://localhost:3001/test/test.html` → all pass
- [ ] Test memory "会" → definition shows 2s then auto-advances
- [ ] Test memory "不会" → unchanged behavior
- [ ] Test quiz end screen → wrong words table with PDF button
- [ ] Test quiz PDF export → downloads `抽查错词_YYYY-MM-DD.pdf` with Chinese text
- [ ] Test error book PDF export → downloads `生词本_YYYY-MM-DD.pdf` with Chinese text
