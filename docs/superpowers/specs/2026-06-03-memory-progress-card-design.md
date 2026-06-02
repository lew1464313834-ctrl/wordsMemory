# Design Spec: 单词记忆模块进度卡片

**日期:** 2026-06-03
**状态:** 设计已确认

---

## 概述

单词记忆页面，选词库后在下拉框下方、数量按钮上方，显示一块进度区域：已学数量、进度条、百分比。

---

## 前端

### MemoryPage.vue — 模板

文件：`frontend/src/views/MemoryPage.vue`

在 `<select>` 下拉框和数量 `<div class="btn-group">` 之间插入进度块：

```html
<div v-if="selectedModule && currentProgress" class="memory-progress-card">
  <div class="memory-progress-text">已学 {{ currentProgress.learned }} / {{ currentProgress.total }}</div>
  <div class="memory-progress-bar">
    <div class="memory-progress-fill" :style="{ width: currentProgress.percent + '%' }"></div>
  </div>
  <div class="memory-progress-pct">{{ currentProgress.percent }}%</div>
</div>
```

### MemoryPage.vue — computed

新增计算属性，从已选模块提取进度：

```js
const currentProgress = computed(() => {
  const m = availableModules.value.find(m => m.id == selectedModule.value)
  if (!m || !m.words_count) return null
  return {
    learned: m.learned_count || 0,
    total: m.words_count,
    percent: Math.round((m.learned_count || 0) / m.words_count * 100)
  }
})
```

- 没选词库 → `null` → 不渲染
- `learned_count = 0` → `0%` 也显示（让用户知道还没开始）

### CSS — 进度卡片样式

```css
.memory-progress-card {
  text-align: center;
  padding: 12px 16px;
  margin: 10px 0;
  background: rgba(155, 126, 216, 0.06);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(155, 126, 216, 0.12);
}
.memory-progress-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.memory-progress-bar {
  height: 8px;
  border-radius: 4px;
  background: rgba(155, 126, 216, 0.15);
  overflow: hidden;
  margin-bottom: 6px;
}
.memory-progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(135deg, #9B7ED8, #7C5CBF);
  transition: width 0.4s ease;
}
.memory-progress-pct {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}
```

### 手机端适配

在 `@media (max-width: 480px)` 中追加：

```css
.memory-progress-card {
  padding: 10px 12px;
}
```

---

## 改动清单

| 文件 | 改动 |
|------|------|
| `frontend/src/views/MemoryPage.vue` | 模板加进度块 + 1 个 computed |
| `frontend/src/assets/main.css` | 加 `.memory-progress-*` 样式 |

---

## 验收标准

1. 打开页面 → 不显示进度（未选词库）
2. 选 `example — 5/5` → 显示 `已学 5 / 5` + 满条 + `100%`
3. 选 `考研英语单词5500`（0/5489）→ 显示 `已学 0 / 5489` + 空条 + `0%`
4. 切换词库 → 进度实时更新
5. 手机端不超出屏幕
