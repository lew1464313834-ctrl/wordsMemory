# 清单文件驱动内置词库 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 data/modules.json 清单替代硬编码 BUILTIN_MODULES，新增词库只需改清单不用改 JS

**Architecture:** 启动时 fetch `data/modules.json` 获取 `[{file, name}]` 清单，按清单逐条加载词库

**Tech Stack:** Vanilla JS, IndexedDB

---

### Task 1: 创建清单文件

**Files:**
- Create: `data/modules.json`

- [ ] **Step 1: 写入 modules.json**

```json
[
  { "file": "example.json", "name": "example" },
  { "file": "kaoyan.json", "name": "考研高频单词" }
]
```

---

### Task 2: 改造 loadBuiltinModules

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 删除 BUILTIN_MODULES 常量，重写 loadBuiltinModules**

将：
```js
  const BUILTIN_MODULES = {
    'example': 'example.json',
    '考研高频单词': 'kaoyan.json'
  };

  async function loadBuiltinModules() {
    const modules = await DB.getModules();
    const existingNames = new Set(modules.map(m => m.name));

    for (const [name, filename] of Object.entries(BUILTIN_MODULES)) {
      if (existingNames.has(name)) continue;

      try {
        const resp = await fetch(`data/${filename}`);
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

改为：
```js
  async function loadBuiltinModules() {
    let manifest;
    try {
      const resp = await fetch('data/modules.json');
      if (!resp.ok) {
        console.warn(`内置词库清单加载失败: HTTP ${resp.status}`);
        return;
      }
      manifest = await resp.json();
    } catch (err) {
      console.warn('内置词库清单加载异常:', err);
      return;
    }

    if (!Array.isArray(manifest)) return;

    const modules = await DB.getModules();
    const existingNames = new Set(modules.map(m => m.name));

    for (const entry of manifest) {
      if (!entry.file || !entry.name) continue;
      if (existingNames.has(entry.name)) continue;

      try {
        const resp = await fetch(`data/${entry.file}`);
        if (!resp.ok) {
          console.warn(`内置词库 "${entry.name}" 加载失败: HTTP ${resp.status}`);
          continue;
        }
        const text = await resp.text();
        const result = Vocabulary.parseWordFile(text, entry.name);
        if (!result.success) {
          console.warn(`内置词库 "${entry.name}" 解析失败: ${result.error}`);
          continue;
        }
        await DB.addWords(result.words);
        await DB.addModule(entry.name, 'builtin');
      } catch (err) {
        console.warn(`内置词库 "${entry.name}" 加载异常:`, err);
      }
    }
  }
```

---

### Task 3: 验证

- [ ] **Step 1: 启动 HTTP 服务，打开页面，确认词库列表包含 example 和 考研高频单词**
- [ ] **Step 2: 新增一个测试 JSON 到 data/，更新 modules.json，刷新确认新词库出现**
- [ ] **Step 3: 删除 modules.json，刷新确认无内置词库（不报错，可手动上传）**
