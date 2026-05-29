# Memory "会" Definition + Quiz Wrong Words PDF + CJK Font Fix

**Date:** 2026-05-28
**Status:** approved

## Overview

Three changes:
1. Memory mode: clicking "会" shows definition for 2 seconds before auto-advancing
2. Quiz mode: end screen shows all wrong words with a PDF export button
3. Bug fix: PDF Chinese characters render as garbled text

---

## Feature 1: "会" Shows 2s Definition

**Current:** Click "会" → immediately advance to next word
**New:** Click "会" → show definition for 2 seconds → auto-advance

- During the 2 seconds: "会"/"不会" buttons hidden, "上一个" disabled
- "不会" behavior unchanged (manual "下一个" advance)

**Implementation:** Modify `answer(false)` in `js/memory.js` to display definition and set `setTimeout` for 2000ms before calling `maybeQuizOrAdvance()`.

---

## Feature 2: Quiz Wrong Words + PDF Export

### 2.1 Track Wrong Words

Add `wrongWords = []` state variable in `js/quiz.js`. On wrong answer or "忘了", push the word object (with definitions) to this array.

### 2.2 End Screen

In `js/quiz.js` `finish()`, render in `#quiz-result`:
- Summary line: "抽查完成！正确率 X / Y"
- Wrong words table: 单词, 释义, 你的回答 (if available)
- "导出PDF" button (hidden if 0 wrong words)

### 2.3 PDF Export

Same approach as error book PDF: jsPDF table with the wrong words list. File name: `抽查错词_YYYY-MM-DD.pdf`.

### 2.4 HTML Changes

Add `#quiz-wrong-table` and `#quiz-export-pdf` elements inside `#quiz-result` area (or render dynamically).

---

## Bug Fix: PDF Chinese Garbled Characters

**Root cause:** jsPDF default font (Helvetica) does not include CJK glyphs. Chinese characters render as empty boxes or garbled text.

**Solution:** Embed a CJK TTF font via base64 encoding.

- Add a lightweight Chinese font file to `fonts/` directory
- Create `js/fonts.js` — exports the base64-encoded font string
- In `errorBook.js` and `quiz.js` PDF functions:
  ```javascript
  doc.addFileToVFS('ChineseFont.ttf', chineseFontBase64);
  doc.addFont('ChineseFont.ttf', 'ChineseFont', 'normal');
  doc.setFont('ChineseFont');
  ```
- Apply the font before rendering any text, including autoTable body text via `styles.font: 'ChineseFont'`

**Font choice:** Use a compact open-source CJK font (e.g., subset of "WenQuanYi Micro Hei" or similar) that covers commonly used Chinese characters. Target size < 4MB when base64-encoded.

**Alternative fallback:** If font embedding proves too heavy, use html2canvas to render the table as an image and insert into PDF. This avoids font issues entirely at the cost of rasterized (non-selectable) text.

---

## Files Changed

| File | Change |
|------|--------|
| `js/memory.js` | `answer(false)` adds 2s delay with definition display |
| `js/quiz.js` | Track wrong words, render end screen with table + PDF export |
| `js/errorBook.js` | Add Chinese font registration before PDF generation |
| `js/fonts.js` | **New** — exports base64-encoded CJK font string |
| `index.html` | Load `fonts.js` script; optional quiz-result container |
| `fonts/` | **New directory** — contains the CJK TTF font file |

## Dependencies

- No new npm dependencies
- One new font file (~2-4MB when base64-encoded in `fonts.js`)
