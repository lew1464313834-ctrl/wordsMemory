# Design Spec: 单词记忆词库进度显示

**日期:** 2026-06-02
**状态:** 设计已确认

---

## 概述

单词记忆页面词库选择下拉框中，已导入的词库显示记忆进度，格式 `已学/总量`（如 `5/5500`）。未导入的不显示进度。

---

## 后端

### 修改 `GET /api/modules`

文件：`backend/app/controller/Module.php` — `index()` 方法

当前返回：
```json
{ "id": 3, "name": "考研英语单词5500", "file_name": "kaoyan_5500.json", "created_at": "..." }
```

增强为：
```json
{ "id": 3, "name": "考研英语单词5500", ..., "words_count": 5489, "learned_count": 5 }
```

实现：
- `withCount('words')` 获取每个模块的单词总量
- 子查询统计 `user_words` 中 `status=1` 的记录数作为 `learned_count`
- `learned_count` 基于 `Request::instance()->userId`

### 改动清单

| 文件 | 改动 |
|------|------|
| `backend/app/controller/Module.php` | `index()` 方法增加 words_count + learned_count |

---

## 前端

### 修改 MemoryPage.vue 下拉框模板

文件：`frontend/src/views/MemoryPage.vue` — 第 8 行附近

当前：
```html
<option v-for="m in availableModules" :key="m.id" :value="m.id">{{ m.name }}</option>
```

改为：
```html
<option v-for="m in availableModules" :key="m.id" :value="m.id">
  {{ m.name }}{{ m.learned_count > 0 ? ` — ${m.learned_count}/${m.words_count}` : '' }}
</option>
```

- `learned_count > 0` 时才显示 `/` 格式进度
- 未导入的词库 `learned_count = 0`，不显示

### 改动清单

| 文件 | 改动 |
|------|------|
| `frontend/src/views/MemoryPage.vue` | `<option>` 模板加进度字符串 |

---

## 验收标准

1. 导入并学习过词库后，下拉框显示 `考研英语单词5500 — 5/5489`
2. 未导入的词库不显示进度（只显示名称）
3. 未登录用户不报错（learned_count = 0）
4. 桌面端和手机端都正确显示
