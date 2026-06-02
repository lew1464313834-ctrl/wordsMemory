# Memory Progress Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show memorization progress (e.g., `5/5489`) next to module names in the Memory page dropdown.

**Architecture:** Enhance `GET /api/modules` to return `words_count` and `learned_count`, then render progress in the `<option>` template.

**Tech Stack:** PHP 8.3 (ThinkPHP 8), Vue 3

---

### Task 1: Backend — add words_count + learned_count to /api/modules

**Files:**
- Modify: `backend/app/controller/Module.php:10-14`

- [ ] **Step 1: Read current Module.php index() method**

```bash
cat backend/app/controller/Module.php
```

Current:
```php
public function index()
{
    $modules = ModuleModel::select();
    return json(['code' => 0, 'data' => $modules]);
}
```

- [ ] **Step 2: Replace index() with enhanced version**

```php
public function index()
{
    $userId = Request::instance()->userId ?? 0;
    $modules = ModuleModel::withCount('words')
        ->select()
        ->each(function ($m) use ($userId) {
            $learned = \think\facade\Db::table('user_words')
                ->where('user_id', $userId)
                ->where('status', 1)
                ->whereIn('word_id', function ($q) use ($m) {
                    $q->table('words')->where('module_id', $m->id)->field('id');
                })
                ->count();
            $m->learned_count = $learned;
        });
    return json(['code' => 0, 'data' => $modules]);
}
```

- [ ] **Step 3: Syntax check and test**

```bash
php -l backend/app/controller/Module.php
curl -s http://localhost:8080/api/modules -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Expected: each module object has `words_count` and `learned_count` fields.

- [ ] **Step 4: Commit**

```bash
git add backend/app/controller/Module.php
git commit -m "feat: add words_count and learned_count to GET /api/modules"
```

---

### Task 2: Frontend — show progress in MemoryPage dropdown

**Files:**
- Modify: `frontend/src/views/MemoryPage.vue:8`

- [ ] **Step 1: Read current option template**

Current (line 8):
```html
<option v-for="m in availableModules" :key="m.id" :value="m.id">{{ m.name }}</option>
```

- [ ] **Step 2: Replace with progress display**

```html
<option v-for="m in availableModules" :key="m.id" :value="m.id">
  {{ m.name }}{{ m.learned_count > 0 ? ` — ${m.learned_count}/${m.words_count}` : '' }}
</option>
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx vite build --mode development 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/MemoryPage.vue
git commit -m "feat: show memorization progress in module selector"
```

---

## Task Summary

| # | Task | Files | Deps |
|---|------|-------|------|
| 1 | Backend: words_count + learned_count | `Module.php` | None |
| 2 | Frontend: progress display | `MemoryPage.vue` | Task 1 |

---

## Verification

- [ ] `GET /api/modules` returns `words_count` (e.g., 5489) and `learned_count` (e.g., 5)
- [ ] Memory page dropdown shows `考研英语单词5500 — 5/5489` for imported+learned modules
- [ ] Unlearned modules show only name, no progress text
- [ ] `npx vitest run` — 40 tests pass
