# Memory Mode Refactor + PDF Export Design Spec

**Date:** 2026-05-28
**Status:** approved

## Overview

Two feature changes:
1. Rework word memory interaction (manual advance after "不会") and interleave quiz checks during memory sessions
2. Add PDF export to the error book page

---

## Feature 1: Memory Mode Refactor

### 1.1 "不会" Button Behavior Change

**Current:** Click "不会" → show definition → auto-advance after 1.5s
**New:** Click "不会" → show definition + reveal "下一个" button → user clicks "下一个" to advance

- "会" button: unchanged (direct advance)
- "上一个" button: unchanged (full rollback including error book decrement)

### 1.2 "下一个" Button

- Default hidden (`display: none`)
- Shown when user clicks "不会" (together with definition display)
- On click: hide definition, hide itself, advance `currentIndex`, call `showCurrentWord()`
- Placement: next to "会"/"不会"/"上一个" button group

### 1.3 Interleaved Quiz During Memory

**Quiz pool construction (done at session start):**
- Pool A: randomly pick `ceil(totalCount / 5)` words from the error book
- Pool B: words marked "不会" during the current session (added dynamically)
- Combined pool for random selection, no duplicates

**Insertion logic:**
- At session start, pre-compute random positions within `[1, totalCount]` for quiz insertions
- Number of quiz positions = size of quiz pool (each pool word gets one insertion)
- Positions are uniformly random — any word in the sequence may be followed by a quiz
- A quiz does NOT count toward the regular word progress (it's extra)
- Each pool word is used at most once per session

**Quiz interaction:**
- Show word text (same as quiz tab style)
- Input field for user to type definition
- Two buttons: "确定" (submit) and "忘了" (forgot)
- Same `checkAnswer()` logic from `quiz.js` for correctness checking
- **Correct:** show feedback, advance to next regular word
- **Wrong or "忘了":** call `DB.upsertErrorWord()` to update error book, show correct definition as feedback, advance

**UI:**
- New area `#memory-quiz-area` within the memory play area
- Hidden during regular word display, shown during quiz
- After quiz completes, hide and return to regular word display

### 1.4 State Machine

```
REGULAR_WORD → (会/不会/下一个) → [random check] → REGULAR_WORD or QUIZ
QUIZ → (确定/忘了) → REGULAR_WORD
```

### 1.5 Edge Cases

- Error book is empty at session start → quiz pool only grows from "不会" words marked during session
- User marks 0 words as "不会" → no quizzes fire (pool is empty)
- User navigates back with "上一个" through a quiz point → quiz re-triggers (consistent with re-showing)
- Session ends with remaining unused quiz pool words → silently discard

---

## Feature 2: Error Book PDF Export

### 2.1 Library

Use jsPDF (loaded via CDN in `index.html`):
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

### 2.2 Button

- Add "导出PDF" button in error book card header, next to "清空生词本"
- Button only visible/enabled when error book has data (matching "暂无数据" state)

### 2.3 PDF Content

Table with columns: 序号, 单词, 释义, 来源模块, 错误次数, 最后错误时间
- Same data as the on-screen table
- Default table style with borders
- A4 portrait, auto-pagination if content overflows

### 2.4 File Name

`生词本_YYYY-MM-DD.pdf` (current date)

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Add "下一个" button, quiz area in memory section; add jsPDF CDN script; add "导出PDF" button in error book section |
| `js/memory.js` | Refactor answer/dunno flow, add quiz interleaving logic, add quiz interaction handlers |
| `js/errorBook.js` | Add PDF export handler |

## Dependencies

- jsPDF v2.5.1 (CDN, no npm install needed)
- No other new dependencies
