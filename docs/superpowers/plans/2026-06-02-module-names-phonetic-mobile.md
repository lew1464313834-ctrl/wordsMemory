# Module Names, Phonetic Display & Mobile Responsive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display module names from `modules.json`, show phonetic symbols under words, and make core pages mobile-responsive via CSS `@media`.

**Architecture:** Five independent tasks: (1) update DB schema + setup scripts with `phonetic` column, (2) patch `SeedWords.php` for both module-name mapping and phonetic import, (3–4) add phonetic display to Memory and Quiz Vue views, (5) extend `main.css` with phonetic styles + `@media` breakpoints at 768px and 480px.

**Tech Stack:** PHP 8.3 (ThinkPHP 8), MySQL 8.4, Vue 3 (Composition API), CSS `@media` queries

---

### Task 1: Database — add `phonetic` column to words table

**Files:**
- Modify: `database/schema.sql:22-29`
- Modify: `setup/setup.sh:~198-203`
- Modify: `setup/setup.ps1:~215-221`
- SQL: Production DB ALTER TABLE

- [ ] **Step 1: Update `database/schema.sql` — add phonetic column**

Replace lines 22-29 (the `words` table definition):

```sql
CREATE TABLE words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    word VARCHAR(200) NOT NULL,
    phonetic VARCHAR(100) NULL,
    definitions TEXT NOT NULL COMMENT 'JSON array',
    INDEX idx_module (module_id),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

- [ ] **Step 2: Update `setup/setup.sh` — add phonetic to words table**

Replace the words CREATE TABLE entry (lines ~197-203) — insert `phonetic VARCHAR(100) NULL,` between `word` and `definitions`:

```
        \"CREATE TABLE IF NOT EXISTS words (
          id INT AUTO_INCREMENT PRIMARY KEY,
          module_id INT NOT NULL,
          word VARCHAR(200) NOT NULL,
          phonetic VARCHAR(100) NULL,
          definitions TEXT NOT NULL COMMENT 'JSON array',
          INDEX idx_module (module_id),
          FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB\",
```

- [ ] **Step 3: Update `setup/setup.ps1` — add phonetic to words table**

Replace the words CREATE TABLE entry (lines ~215-221) — insert `phonetic VARCHAR(100) NULL,` between `word` and `definitions`:

```
    "CREATE TABLE IF NOT EXISTS words (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_id INT NOT NULL,
      word VARCHAR(200) NOT NULL,
      phonetic VARCHAR(100) NULL,
      definitions TEXT NOT NULL COMMENT 'JSON array',
      INDEX idx_module (module_id),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    ) ENGINE=InnoDB",
```

- [ ] **Step 4: Run ALTER TABLE on production database**

```bash
mysql -u root wordmemory -e "ALTER TABLE words ADD COLUMN phonetic VARCHAR(100) NULL AFTER word;"
```

Expected: `Query OK, 6805 rows affected`

- [ ] **Step 5: Verify schema**

```bash
mysql -u root wordmemory -e "SHOW COLUMNS FROM words;"
```

Expected: column list includes `phonetic | varchar(100) | YES | | NULL |`

- [ ] **Step 6: Commit**

```bash
git add database/schema.sql setup/setup.sh setup/setup.ps1
git commit -m "feat: add phonetic column to words table"
```

---

### Task 2: SeedWords command — module names + phonetic import

**Files:**
- Modify: `backend/app/command/SeedWords.php:17-42`

- [ ] **Step 1: Read current SeedWords.php**

File is at `backend/app/command/SeedWords.php`. The `execute()` method currently:
1. Globs `../data/*.json`
2. Uses `basename($file, '.json')` as module name
3. Creates Module with that name
4. Inserts only `word` + `definitions` per word

- [ ] **Step 2: Add modules.json name mapping and phonetic support**

Replace the entire `execute()` method body:

```php
protected function execute(Input $input, Output $output)
{
    // Build file → display-name map from modules.json
    $nameMap = [];
    $modulesJsonPath = '../data/modules.json';
    if (file_exists($modulesJsonPath)) {
        $modulesData = json_decode(file_get_contents($modulesJsonPath), true);
        if (is_array($modulesData)) {
            foreach ($modulesData as $m) {
                if (!empty($m['file']) && !empty($m['name'])) {
                    $nameMap[$m['file']] = $m['name'];
                }
            }
        }
    }

    $files = glob('../data/*.json');
    foreach ($files as $file) {
        $fileName = basename($file);
        // Skip modules.json itself
        if ($fileName === 'modules.json') continue;

        $name = basename($file, '.json');
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) continue;

        $module = Module::where('name', $name)->find();
        if (!$module) {
            // Use display name from modules.json, fallback to filename
            $moduleName = $nameMap[$fileName] ?? $name;
            $module = Module::create(['name' => $moduleName, 'file_name' => $fileName]);
        }

        $count = 0;
        foreach ($data as $item) {
            if (empty($item['word']) || empty($item['definition'])) continue;
            Word::create([
                'module_id'   => $module->id,
                'word'        => $item['word'],
                'phonetic'    => $item['Phonetic'] ?? null,
                'definitions' => json_encode($item['definition'], JSON_UNESCAPED_UNICODE),
            ]);
            $count++;
        }
        $output->writeln("Seeded: {$module->name} (" . $count . " words)");
    }
}
```

- [ ] **Step 3: Syntax check**

```bash
php -l backend/app/command/SeedWords.php
```

Expected: `No syntax errors detected`

- [ ] **Step 4: Test — re-seed with fresh data**

```bash
# Clear module 1 (example) and re-seed
mysql -u root wordmemory -e "DELETE FROM words WHERE module_id=1; DELETE FROM modules WHERE id=1;"
cd backend && php think seed:words
```

Expected output:
```
Seeded: example (5 words)
Seeded: 考研高频单词 (1311 words)
Seeded: 考研英语单词5500 (5489 words)
```

Note: if modules already exist they won't be renamed — to fully test, drop and recreate the database.

- [ ] **Step 5: Verify module names**

```bash
mysql -u root wordmemory -e "SELECT id, name, file_name FROM modules;"
```

Expected: `kaoyan` → `考研高频单词`, `kaoyan_5500` → `考研英语单词5500`

- [ ] **Step 6: Verify phonetic data**

```bash
mysql -u root wordmemory -e "SELECT word, phonetic FROM words WHERE module_id=(SELECT id FROM modules WHERE file_name='example.json') LIMIT 3;"
```

Expected: rows show `abandon | /ə'bændən/`, etc.

- [ ] **Step 7: Commit**

```bash
git add backend/app/command/SeedWords.php
git commit -m "feat: use modules.json display names and import phonetic field"
```

---

### Task 3: MemoryPage.vue — add phonetic display

**Files:**
- Modify: `frontend/src/views/MemoryPage.vue:23-29`

- [ ] **Step 1: Read current MemoryPage.vue**

The word display area is at lines 23-29:
```html
<div id="memory-play-area" v-if="active" style="display:block" class="card">
  <div id="memory-word">{{ currentWord?.word }}</div>
  <div class="progress" id="memory-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>
  <div id="memory-definition" v-show="showDefinition" style="display:none">
    {{ currentWord?.definitions?.join('；') }}
  </div>
```

- [ ] **Step 2: Insert phonetic line between word and progress**

Replace lines 23-29:

```html
<div id="memory-play-area" v-if="active" style="display:block" class="card">
  <div id="memory-word">{{ currentWord?.word }}</div>
  <div class="word-phonetic" v-if="currentWord?.phonetic">{{ currentWord.phonetic }}</div>
  <div class="progress" id="memory-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>

  <div id="memory-definition" v-show="showDefinition" style="display:none">
    {{ currentWord?.definitions?.join('；') }}
  </div>
```

Add one line: `<div class="word-phonetic" v-if="currentWord?.phonetic">{{ currentWord.phonetic }}</div>` between `#memory-word` and `.progress`.

- [ ] **Step 3: Verify template syntax**

```bash
cd frontend && npx vue-tsc --noEmit src/views/MemoryPage.vue 2>&1 || echo "Check done (type errors in existing code expected)"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/MemoryPage.vue
git commit -m "feat: show phonetic in memory page"
```

---

### Task 4: QuizPage.vue — add phonetic display

**Files:**
- Modify: `frontend/src/views/QuizPage.vue:15-17`

- [ ] **Step 1: Read current QuizPage.vue**

The quiz play area is at lines 15-17:
```html
<div id="quiz-play-area" v-if="active" style="display:block" class="card">
  <div id="quiz-word">{{ words[currentIndex]?.word }}</div>
  <div class="progress" id="quiz-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>
```

- [ ] **Step 2: Insert phonetic line between word and progress**

Replace lines 15-17:

```html
<div id="quiz-play-area" v-if="active" style="display:block" class="card">
  <div id="quiz-word">{{ words[currentIndex]?.word }}</div>
  <div class="word-phonetic" v-if="words[currentIndex]?.phonetic">{{ words[currentIndex].phonetic }}</div>
  <div class="progress" id="quiz-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/QuizPage.vue
git commit -m "feat: show phonetic in quiz page"
```

---

### Task 5: CSS — phonetic style + mobile responsive @media

**Files:**
- Modify: `frontend/src/assets/main.css:506-520`

- [ ] **Step 1: Add `.word-phonetic` style**

Insert after the `#memory-definition` rule (after line 456):

```css
/* === Word Phonetic === */
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

- [ ] **Step 2: Replace existing `@media (max-width: 480px)` block**

Find the existing block at lines 513-520 and replace the entire `/* === Responsive === */` section (from line 506 onward):

```css
/* === Responsive === */

/* Tablet / small laptop */
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
  .btn-group {
    gap: 8px;
  }
}

/* Phone */
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
    font-size: 16px; /* prevent iOS zoom */
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
  .feedback {
    font-size: 0.85rem;
    padding: 10px 14px;
  }
  /* Hide decorative blobs on mobile to save rendering */
  body::before, body::after {
    display: none;
  }
}
```

Note: the old `#memory-quiz-input` standalone rule at line 508 is no longer needed — the `.input` rule handles the base styling.

- [ ] **Step 3: Verify CSS builds**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` with no CSS errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/assets/main.css
git commit -m "feat: add phonetic style and mobile responsive @media breakpoints"
```

---

## Task Summary

| # | Task | Files | Dependencies |
|---|------|-------|-------------|
| 1 | DB schema — phonetic column | `schema.sql`, `setup.sh`, `setup.ps1`, ALTER TABLE | None |
| 2 | SeedWords — names + phonetic | `SeedWords.php` | None |
| 3 | MemoryPage — phonetic display | `MemoryPage.vue` | Task 2 (for data) |
| 4 | QuizPage — phonetic display | `QuizPage.vue` | Task 2 (for data) |
| 5 | CSS — phonetic + mobile | `main.css` | None |

Tasks 1, 2, and 5 can run in parallel. Tasks 3 and 4 can run in parallel after Task 2.

---

## Verification Checklist (post-implementation)

- [ ] `php think seed:words` outputs Chinese module names for mapped entries
- [ ] `GET /api/modules` returns `"name":"考研高频单词"` for the kaoyan module
- [ ] Memory page: example words show `/ə'bændən/`-style phonetic between word and progress
- [ ] Quiz page: same phonetic display works
- [ ] kaoyan module words (no Phonetic in data) show no phonetic line, no extra whitespace
- [ ] Chrome DevTools → iPhone SE: no horizontal scrollbar on Memory/Quiz/ErrorBook pages
- [ ] Chrome DevTools → iPhone SE: buttons are full-width, inputs are ≥16px font-size
- [ ] Desktop layout unchanged (720px max-width still applies)
