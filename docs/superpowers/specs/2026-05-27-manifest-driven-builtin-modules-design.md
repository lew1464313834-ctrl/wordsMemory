# Design: 清单文件驱动内置词库自动扫描

Date: 2026-05-27
Status: approved

## 需求

`data/` 目录中新增 JSON 文件后自动出现在词库列表，无需修改 JS 代码。文件名支持中英文。

## 方案

用 `data/modules.json` 作为清单文件，列出所有内置词库的文件名和显示名。应用启动时 fetch 清单，逐条加载。

### 清单格式

```json
[
  { "file": "example.json", "name": "example" },
  { "file": "kaoyan.json", "name": "考研高频单词" }
]
```

- `file`: JSON 文件名（建议 ASCII，避免 URL 编码问题）
- `name`: 模块显示名（支持中文）

### 数据流

```
App.init()
  → DB.open()
  → loadBuiltinModules()
    → fetch('data/modules.json')
    → 解析清单数组
    → DB.getModules() 获取已入库模块
    → 遍历清单，跳过已入库的
    → 逐条 fetch('data/<file>') → parse → DB.addWords() → DB.addModule(name, 'builtin')
  → bindTabs/bindUpload/refreshModuleList
  → 各模块 init()
```

### 文件改动

#### `js/app.js`

- 删除 `const BUILTIN_MODULES = {...}`
- 重写 `loadBuiltinModules()`：先 fetch `data/modules.json`，再按清单逐条加载

#### `data/modules.json`（新增）

- 词库清单文件

### 边界情况

| 场景 | 行为 |
|------|------|
| `modules.json` 不存在 | console.warn，无内置词库 |
| `modules.json` 格式错误 | console.warn，跳过 |
| 清单某条 file 不存在 | 跳过该条目，warn |
| 模块已入库 | 跳过（不改动已有数据） |
| 清单某条缺少 file 或 name 字段 | 跳过 |
| 新增词库：在 data/ 放 JSON + 更新清单 | 下次刷新自动加载 |