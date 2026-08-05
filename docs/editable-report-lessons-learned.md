# 可编辑报告系统：需求、踩坑与经验总结

> 文档版本: 2026-08-04  
> 覆盖范围: DocumentEditorProvider → EditableNode → ReportBlockRenderer (9 种 renderer) → assemble.ts → API 路由

---

## 一、需求定义：可编辑报告到底要做什么

### 1.1 核心能力

品牌咨询报告在 AI 自动生成后，用户需要能够**在网页上直接修改任何文本内容**，包括：

| 编辑对象 | 示例 | 编辑方式 |
|---------|------|---------|
| 封面文字 | 品牌名、日期、"CONFIDENTIAL" | 点击 → 内联编辑 |
| 执行摘要 | 5 个字段的 label + text | 点击 → 内联编辑 |
| 章节标题/副标题 | "第一章 商业背景" | 点击 → 内联编辑 |
| 块标题 | "1.1 商业背景"（26 个子标题） | 点击 → 内联编辑 |
| 正文段落 | narrative block segments | 点击 → 内联编辑 |
| 卡片内容 | cards block title/description | 点击 → 内联编辑 |
| 标签组 | tags block 每个 tag | 点击 → 内联编辑 |
| 表格单元格 | comparison/landscape/supplyGap/matrix/decisionDimension | 点击 → 内联编辑 |
| 品牌蓝图 | 6 字段 + 标题 + 页脚 | 点击 → 内联编辑 |
| 表格行列 | 添加/删除/拖拽排序 | 按钮 + DnD |
| 表格列头 | 列增删、拖拽重排 | 按钮 + DnD |

### 1.2 关键设计要求

1. **乐观更新** — 编辑后 UI 立即反映新值，不等待 API 返回
2. **保存失败回滚** — API 失败时回退到旧值，显示 "⚠ 重试"
3. **两套保存路由** — 实质性内容（来自 S1-S8 阶段数据）走版本管理 API；展示层内容（标题、标签）走轻量 override API
4. **保存状态指示器** — ✓ 已保存 / ⟳ 保存中 / ⚠ 保存失败 [重试]
5. **恢复 AI 原始值** — 用户可一键恢复 AI 生成的原始内容
6. **打印友好** — 编辑 UI（按钮、hover 效果）在打印时隐藏

---

## 二、架构演进：从双系统到统一编辑器

### 2.1 最初的架构问题

早期系统存在两套并行的编辑机制：

```
旧架构（双系统）:
├── EditableText + useReportOverrides    → 展示层内容（标题、封面等）
│   └── save-report-override API        → 写入 project.context.reportOverrides
└── EditPanel + sourceFields             → 实质性内容（阶段数据）
    └── recordFieldEdit API              → 写入 stage record（版本管理）
```

**问题**：两套组件、两套状态管理、两套 API、两套保存逻辑，维护成本高，新 renderer 接入时需同时理解两套机制。

### 2.2 统一方案：DocumentEditorProvider

```
新架构（统一系统）:
└── DocumentEditorProvider (Context)
    ├── applyMutation(mutation, renderTarget) → 乐观更新 + API 保存
    ├── nodeStatus → 每个节点的保存状态
    ├── restoreOriginal / retryMutation
    └── EditableNode (唯一的编辑入口)
        ├── source 存在 → 自动路由到 recordFieldEdit (版本管理)
        └── source 不存在 → 使用 onSave 回调 (轻量 override)
```

**核心类型**：

```typescript
// 渲染目标 — 告诉乐观更新器在 ReportContent 树的哪个位置应用变更
interface RenderTarget {
  blockId?: string;       // block.id（在 ReportContent 中唯一定位 block）
  itemPath?: string;      // block 内的数据路径，如 "rows[0].cells.positioning"
  sectionPath?: string;   // 顶层数据路径，如 "cover.brandName"
}

// 一次编辑操作
interface Mutation {
  nodeId?: string;
  type: "update" | "insert" | "delete";
  fieldPath: string;      // 后端数据路径
  newValue?: any;
  previousValue?: any;
  stage?: number;         // 1-8 = 实质性内容，0/undefined = 展示层
}
```

---

## 三、踩坑全记录

### 坑 #1：乐观更新不生效 — renderTarget 路径太粗糙

**现象**：编辑表格单元格后，UI 不更新，需要手动刷新页面才能看到新值。

**根因**：`RenderTarget.itemPath` 使用了粗粒度路径（如 `"rows"`），而乐观更新守卫检测到 `newValue` 是字符串但目标位置是数组，跳过了更新。

```typescript
// ❌ 错误：itemPath 指向整个 rows 数组
renderTarget: { blockId: block.id, itemPath: "rows" }

// ✅ 正确：itemPath 精确到具体单元格
renderTarget: { blockId: block.id, itemPath: `rows[${ri}].cells.${col.key}` }
```

**守卫逻辑**（`useDocumentEditor.tsx:91-98`）：
```typescript
if (typeof newValue === "string" && (Array.isArray(existing) || ...)) {
  // 跳过乐观更新，仅靠后端保存
  return clone;
}
```

**修复**：为所有 9 种 renderer 逐个设置精确 `itemPath`：

| Renderer | 编辑对象 | itemPath |
|----------|---------|----------|
| Narrative | segment text | `segments[${i}].text` |
| Cards | title | `items[${i}].title` |
| Cards | description | `items[${i}].description` |
| Tags | tag | `tags[${i}]` |
| Comparison | cell | `rows[${ri}].cells.${col.key}` |
| Landscape | std field | `rows[${ri}].${fieldMap[col.key]}` |
| Landscape | extra field | `rows[${ri}].extra.${col.key}` |
| SupplyGap | base col | `rows[${ri}].${col.key}` |
| SupplyGap | extra col | `rows[${ri}].extra.${col.key}` |
| Matrix | dim name | `dimensions[${ri}]` |
| Matrix | cell | `cells.${ri}.${origIdx}` |
| DecisionDimension | cell | `rows[${ri}].${col.key}` |

**可复用经验**：
- 乐观更新路径必须精确到**叶子节点**，不能用容器路径
- 在添加新 renderer 时，编写 checklist：每个 `EditableNode` 的 `renderTarget` 是否精确到标量值？

---

### 坑 #2：空白单元格不可点击

**现象**：表格中空白/空字符串的单元格无法点击进入编辑模式。

**根因**：空白内容的 `Tag` 元素没有可见尺寸（`displayContent` 为空字符串），hover 区域为零像素，用户无法点击。

**分析过程**：
1. 确认 `formatDisplay("", "text")` 返回 `""`（空字符串）
2. 确认 `Tag` 组件在内容为空时渲染为 `<span></span>`（零宽）
3. 确认 hover 样式虽然存在但无法触发

**修复**（`EditableNode.tsx:257`）：
```tsx
// 当内容为空时，用 &nbsp; 占位 + inline-block + 最小宽度
const isEmpty = !displayContent;
<Tag className={`
  ${isEmpty ? "inline-block min-w-[2em]" : ""}
  ${className}
`}>
  {displayContent || " "}
</Tag>
```

**可复用经验**：
- 可编辑节点必须保证即使在空内容时也有**可点击区域**
- `min-w-[2em]` + `&nbsp;` + `inline-block` 是处理空内容三位一体的方案
- 每个新 renderer 接入时应检查：空白单元格能否点击？

---

### 坑 #3：Save 路径自动路由的边界混乱

**现象**：开发环境中出现 "source 和 onSave 同时存在" 的警告，且保存可能走了错误的路由。

**根因**：`EditableNode` 需要根据是否有 `source` prop 自动判断走哪条保存路径，但调用方不清楚规则。

**两条路径**：
```
source 存在 + stage ≥ 1 → recordFieldEdit (版本管理 API)
  路径: POST /api/project/[id]/stage/[n]/edit
  特征: 乐观锁、版本号追踪、影响分析

source 不存在 → save-report-override (轻量 API)
  路径: POST /api/project/[id] { action: "save-report-override" }
  特征: 无版本管理、直接写 context
```

**修复**（`EditableNode.tsx:132-157`）：
```typescript
if (hasAutoRoute && editor) {
  // 实质性内容 → applyMutation（内部走 recordFieldEdit）
  await editor.applyMutation(mutation, renderTarget);
} else if (onSave) {
  // 展示层内容 → onSave 回调
  await onSave(trimmed);
}
```

**可复用经验**：
- 自动路由的判断条件必须**单一且明确**：`source` 存在 = 实质性内容，否则 = 展示层
- 不要在同一个 EditableNode 同时提供 `source` 和 `onSave`，`source` 优先级更高
- 在 Provider 外使用 EditableNode 时（如 section 组件），只能使用 `onSave` 模式

---

### 坑 #4：SupplyGap 所有表格显示相同硬编码列头

**现象**：2.2, 3.2, 5.2, 6.3, 7.3, 7.4 所有 SupplyGap 表格列头都显示 "维度 / 当前市场提供 / 用户仍未满足"，而它们应该有各自的列头标签。

**根因**：SupplyGap renderer 直接使用 `SUPPLYGAP_DEFAULT_COLS` 常量渲染列头，完全忽略了 `block.columnDefs` 中的自定义标签。

```typescript
// ❌ 旧代码：所有 SupplyGap 表格都用同一套硬编码列头
const SUPPLYGAP_DEFAULT_COLS = [
  { key: "dimension", label: "维度", protected: true },
  { key: "currentMarket", label: "当前市场提供", protected: false },
  { key: "unmetNeed", label: "用户仍未满足", protected: false },
];
```

**分析**：`assemble.ts` 中各 block 都正确设置了 `columnDefs`，问题纯粹在渲染层。

**修复策略**：
1. `baseColumns` 从 `block.columnDefs` 读取 label，fallback 到 `SUPPLYGAP_DEFAULT_COLS`
2. 各 block 的 `columnDefs` 在 `assemble.ts` 中已经配置了正确的 label 映射

**各 block 实际使用的列标签**：

| Block | 列1 (protected) | 列2 | 列3 |
|-------|:---:|------|------|
| 2.2 (S3 市场机会) | 维度 | 当前市场提供 | 用户仍未满足 |
| 3.2 (S4 消费者) | 解决路径 | 采用方式 | 尚未满足 |
| 5.2 (S6 品牌战略) | 价值层 | 价值主张 | 战略推导 |
| 6.3 (S7 视觉) | 维度 | 选择与感知调性 | 排除项 |
| 7.3 (S8 内容主题) | 内容栏目 | 核心目的 | 主题方向 |
| 7.4 (S8 渠道) | 平台 | 内容形式 | 表达重点 |

**可复用经验**：
- 渲染层**永远不要硬编码业务文案**，必须从数据模型读取
- `columnDefs` 是列配置的单一真实来源，renderer 只负责渲染
- 当多个实例显示相同内容时，第一反应应该是：是否忽略了数据中的差异化配置？

---

### 坑 #5：SupplyGap 列拖拽不生效

**现象**：Comparison 和 Landscape renderer 列拖拽正常，但 SupplyGap 列拖拽完全无效。

**根因**：SupplyGap 的列数组是**计算值**（`allColumns = [...baseColumns, ...displayExtraCols]`），每次渲染重新计算。drag & drop 修改的顺序在下次渲染时被重新计算覆盖。

Comparison/Landscape 之所以正常，是因为它们使用了 `useState` 管理的 `columns` state：
```typescript
const [columns, setColumns] = useState(allColumns);
// drop handler: setColumns(nc) → 触发 re-render，保留拖拽顺序
```

**修复**：
1. 新增 `columns` state：`const [columns, setColumns] = useState(allColumns)`
2. 使用**内容指纹**（content fingerprint）而非引用比较来检测数据变化：
   ```typescript
   const _colVer = useRef(0);
   useEffect(() => {
     const ver = (block.columnDefs?.length ?? 0) * 1000
               + (block.columns?.length ?? 0) * 100
               + extraKeys.length;
     if (ver !== _colVer.current) {
       _colVer.current = ver;
       setColumns(allColumns);
     }
   }, [block.columnDefs, block.columns, extraKeys.length]);
   ```
3. 渲染循环中的 `allColumns.map(...)` 全部替换为 `columns.map(...)`
4. 添加 `makeColHandlers` 和 `canDragCols`，drop 时操作 `columns` state

**为什么不用引用比较**？因为 `allColumns` 是 `useMemo`-like 的计算值，即使数据相同，每次渲染也可能产生新引用。内容指纹通过哈希列数据的组合来检测"真正的变化"。

**可复用经验**：
- 任何需要**用户交互改变顺序**的场景（拖拽排序、手动排序），必须使用 **state** 而非计算值
- 计算值 = 只读显示；state = 可交互
- 内容感知同步（content fingerprint）是 useEffect 依赖数组中处理引用不稳定数据的通用模式
- 参考实现模式：Comparison/Landscape renderer 的 content-aware sync 是标准模板

---

### 坑 #6：4.1/4.2 列删除按钮不显示

**现象**：4.1（竞争方向 Landscape）和 4.2（竞品对比 Comparison）的列头没有 ✕ 删除按钮。

**根因**：所有列的 `protected: true` 导致删除按钮被条件渲染隐藏。

```typescript
// ❌ 旧代码：assemble.ts buildChapter04
{ key: "competitionType", label: "竞争类型", protected: true },
{ key: "representativeBrands", label: "代表品牌", protected: true },  // 应改为 false
{ key: "coreStrategy", label: "核心打法", protected: true },          // 应改为 false
{ key: "consumerNeed", label: "用户需求", protected: true },          // 应改为 false
```

`protected: true` 的设计意图是保护**行标识列**（如"品牌"、"竞争类型"），防止用户误删导致行数据丢失标识。但之前误将所有列都标为 `protected`。

**修复**（`assemble.ts`）：

| Block | protected: true (保留) | protected: false (修改后) |
|-------|:---:|------|
| 4.1 竞争方向 | 竞争类型 | 代表品牌、核心打法、用户需求 |
| 4.2 竞品分析 | 品牌 | 定位、核心卖点、优势、短板、可突破空间 |

**可复用经验**：
- `protected: true` 只应用于**行标识列**（删除会导致行失去语义的列）
- 每新增一个表格 block 时，检查：哪些列 `protected: true`？为什么？
- 在 PR review 时把 `protected` 作为 checklist 项

---

### 坑 #7：`applyColumnOrder` 缺少 supplyGap 处理

**现象**：列拖拽后刷新页面，SupplyGap 列顺序恢复原样。Comparison/Landscape 正常。

**根因**：`assemble.ts` 的 `applyColumnOrder` 函数只处理了 `comparison`、`landscape`、`matrix` 三种类型，缺少 `supplyGap` 分支。

```typescript
// ❌ 旧代码：只处理三种类型
if (block.type === "comparison" || block.type === "landscape") { ... }
if (block.type === "matrix") { ... }
// supplyGap 被跳过，直接返回原 block
```

**修复**：在 comparison/landscape 和 matrix 之间插入 supplyGap 分支：
```typescript
if (block.type === "supplyGap") {
  if (!block.columns || block.columns.length === 0) return block;
  const colMap = new Map(block.columns.map((c) => [c.key, c]));
  const ordered = [];
  for (const key of order) {
    const match = colMap.get(key);
    if (match) { ordered.push(match); colMap.delete(key); }
  }
  for (const remaining of colMap.values()) ordered.push(remaining);
  return { ...block, columns: ordered };
}
```

**可复用经验**：
- 当新增一个 renderer 类型时，检查所有对 `block.type` 做 switch/if-else 的地方，确保新类型被覆盖
- 典型的"遗漏点"：组装函数、排序函数、验证函数、序列化函数
- 可以用 Grep 搜索 `block.type ===` 找到所有需要更新的位置

---

### 坑 #8：内容感知同步的引用不稳定性

**现象**：`useEffect` 依赖 `block.columns` 但 columns 是内联构建的数组，每次渲染引用都不同，导致无限循环或状态抖动。

**根因**：React 的 `useEffect` 依赖数组使用 `Object.is` 比较，内联构建的数组每次都产生新引用。

**解决方案 — 内容指纹模式**：
```typescript
const _ch = useRef(0);
useEffect(() => {
  // 用数据内容的哈希代替引用比较
  const h = allColumns.length
          + allColumns.reduce((s, c, i) => s + (c.key ?? "").length * (i + 1), 0);
  if (h !== _ch.current) {
    _ch.current = h;
    setColumns(allColumns);
  }
}, [block.columns, block.customColumns]);
// 注意：依赖数组里仍然是 block.columns，但通过指纹比较避免了不必要的 setState
```

这个模式在 Comparison、Landscape、SupplyGap、Matrix 四个 renderer 中都有使用。

**为什么不用 `useMemo`**？
- `useMemo` 解决的是计算缓存问题，不是"用户拖拽后的顺序保持"问题
- 拖拽后的新顺序必须保存在 state 中，否则下次渲染会被 `useMemo` 的结果覆盖

**可复用经验**：
- 当 `useEffect` 的依赖是每次渲染都重建的数组/对象时，用内容指纹替代引用比较
- 指纹算法不需要完美哈希，只要能区分"数据变了"和"数据没变"即可
- 常见指纹：`length * 1000 + keys.join("|").length` 或 `JSON.stringify(x).length`

---

### 坑 #9：Stage 版本号和乐观锁冲突

**现象**：编辑保存后出现 "数据已被其他操作修改，请刷新页面"（409 Conflict）。

**根因**：`DocumentEditorProvider` 使用 `stageVersions[stage]` 作为乐观锁版本号。当同一 stage 的多个字段被快速编辑时，前一个保存更新了服务端版本号，导致后一个请求携带了过时的版本号。

**流程**：
```
1. 编辑字段 A → applyMutation → POST stage/3/edit (version=5)
2. 编辑字段 B → applyMutation → POST stage/3/edit (version=5)
   ↑ 此时 A 的保存已把服务端版本更新为 6，B 的 version=5 触发 409
```

**当前状态**：这是一个已知的**设计权衡**，不是 bug。原因是：
- 将版本号提升到**字段级别**会大幅增加复杂度
- 同一 stage 的并发编辑在实际使用中很少见
- 409 时提供清晰的错误提示和重试机制

**可复用经验**：
- 乐观锁粒度（stage 级 vs field 级）是性能、复杂度和用户体验的三角权衡
- 如果未来并发编辑频繁触发 409，可以引入**请求队列**（同一 stage 的编辑串行化）或**字段级版本号**

---

## 四、架构决策回顾

### 4.1 为什么需要 `RenderTarget` 这个中间层？

`EditableNode` 接收两个路径概念：
- `source.fieldPath` → 后端数据路径（如 `"existingSolutions[0].solutionType"`）
- `renderTarget.itemPath` → 前端 ReportContent 树中的位置（如 `"rows[0].dimension"`）

这两个路径**不一定相同**，因为：
1. 后端 StageRecord 的数据结构和前端 ReportContent 的 Block 结构是**独立演化**的
2. 同一个后端字段可能映射到报告中多个位置
3. 展示层内容没有后端路径，但仍有前端位置

### 4.2 为什么乐观更新用 `structuredClone`？

```typescript
const clone = structuredClone(report);
// ... 修改 clone ...
setReport(clone);
```

- `structuredClone` 是深层拷贝，确保修改不会意外影响原对象
- React 的 `setState` 需要新引用才能触发 re-render
- 代价是性能开销，但报告数据量通常在 KB 级别，可接受

### 4.3 为什么分两条保存路由？

| | 实质性内容 | 展示层内容 |
|---|---|---|
| API | `POST /stage/[n]/edit` | `POST /project/[id]` |
| 版本管理 | 有（乐观锁） | 无 |
| 回滚 | 支持（previousValue） | 不支持 |
| 影响分析 | 支持 | 不支持 |
| 示例 | 正文段落、表格数据 | 标题、标签、封面文字 |

原因：实质性内容来自 AI 生成，需要版本追踪和回滚；展示层内容是用户手动调整的元数据，轻量保存即可。

---

## 五、可复用开发 Checklist

在新增一个 report block renderer 时，按以下清单逐项检查：

### 编辑能力
- [ ] 所有文本内容用 `EditableNode` 包裹
- [ ] `renderTarget.itemPath` 精确到标量叶子节点（不是数组/对象）
- [ ] `source.fieldPath` 正确映射到后端数据路径
- [ ] 空白/空值的单元格可点击（`min-w-[2em]` + `&nbsp;`）
- [ ] `nodeId` 在页面内唯一（格式：`${block.id}:cell:${ri}:${col.key}`）

### 表格列管理
- [ ] 列头从 `block.columnDefs` 读取，不硬编码
- [ ] `protected: true` 只用于行标识列（通常只有 1 列）
- [ ] 有本地 `columns` state（支持拖拽重排）
- [ ] 使用内容指纹进行 content-aware sync
- [ ] `handleDeleteColumn` 检查 `protected`
- [ ] `handleAddColumn` 正确更新 `columns` state 和行数据

### 拖拽
- [ ] `canDragCols` = `!!onColumnReorder && columns.length > 1`
- [ ] `canDragRows` = `!!onRowReorder && localRows.length > 1`
- [ ] `makeColHandlers` / `makeRowHandlers` 使用 state（不是计算值）
- [ ] drop 后调用 `onColumnReorder(blockId, keys)` 持久化

### 持久化
- [ ] `applyColumnOrder` 函数支持新 block type
- [ ] `applyRowOrder` 函数支持新 block type（如适用）
- [ ] `assemble.ts` 中 customization 应用覆盖新 type

### 打印
- [ ] 编辑 UI 元素（+/- 按钮、✕ 按钮、拖拽手柄）有 `print:hidden`
- [ ] hover 效果有 `print:hover:bg-transparent print:hover:ring-0`

---

## 六、关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/editor/types.ts` | Mutation, RenderTarget, NodeSaveState 类型定义 |
| `src/lib/editor/useDocumentEditor.tsx` | DocumentEditorProvider: 乐观更新、API 保存、状态管理 |
| `src/components/report/EditableNode.tsx` | 统一内联编辑器：自动路由、保存状态指示器 |
| `src/components/report/ReportBlockRenderer.tsx` | 9 种 renderer：分发器 + 各表格编辑逻辑 |
| `src/lib/report/assemble.ts` | 报告组装：block 生成、columnDefs 配置、行列排序应用 |
| `src/app/project/[id]/report/page.tsx` | 报告页面：Provider 包裹、customization 持久化 |

---

## 七、总结

整个可编辑报告系统的开发遵循了一个核心模式：

```
发现问题 → 追查根因 → 最小修复 → 泛化到同类组件 → 沉淀为 checklist
```

最关键的三条经验：

1. **精确的 itemPath 是乐观更新的生命线** — 路径粗糙会导致更新被跳过、数据被破坏
2. **拖拽排序必须用 state，不能用计算值** — 否则排序结果会在下次渲染时丢失
3. **渲染层不硬编码业务文案** — columnDefs 是唯一真实来源，renderer 只负责渲染
