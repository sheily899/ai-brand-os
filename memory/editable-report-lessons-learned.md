---
name: editable-report-lessons-learned
description: 可编辑报告系统开发全历程：需求定义、9 个踩坑记录、架构决策、可复用 checklist
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# 可编辑报告系统经验总结

完整文档见: `D:\brand-intelligence-os\docs\editable-report-lessons-learned.md`

## 核心需求

报告在 AI 生成后，用户可在网页上直接编辑任何文本：封面、执行摘要、章节标题、块标题、正文、卡片、标签、9 种表格单元格、品牌蓝图，以及表格行列的增删拖拽。

## 架构

DocumentEditorProvider (统一 Context) → EditableNode (唯一编辑入口) → applyMutation (乐观更新 + API 保存)，分两条保存路由：source 存在 → recordFieldEdit (版本管理)；source 不存在 → save-report-override (轻量)。

## 9 个踩坑记录

1. **乐观更新不生效** — renderTarget.itemPath 太粗糙（如 "rows"），被守卫跳过 → 改为精确到叶子节点（如 `rows[${ri}].cells.${col.key}`）
2. **空白单元格不可点击** — 空内容零宽 → `inline-block min-w-[2em]` + `&nbsp;`
3. **自动路由边界混乱** — source/onSave 同时存在 → source 优先，明确两条路由
4. **SupplyGap 硬编码列头** — 直接用 SUPPLYGAP_DEFAULT_COLS → 从 block.columnDefs 读取
5. **SupplyGap 列拖拽不生效** — 无本地 columns state，计算值每次渲染覆盖 → 新增 state + 内容指纹同步
6. **4.1/4.2 列删除不显示** — 全部列 protected:true → 只保留行标识列 protected
7. **applyColumnOrder 缺 supplyGap** → 新增 supplyGap 分支
8. **内容感知同步** — useEffect 依赖引用不稳定 → 内容指纹替代引用比较
9. **Stage 版本号冲突** — stage 级乐观锁并发编辑时 409 → 设计权衡，可接受

## 关键经验

- **精确 itemPath 是乐观更新的生命线**
- **拖拽排序必须用 state，不能用计算值**
- **渲染层不硬编码业务文案，columnDefs 是唯一来源**
- **新增 renderer 需检查所有 block.type 分支（组装、排序、验证、序列化）**

**Why:** 可编辑报告是整个产品中迭代轮次最多的功能模块，记录了从双系统到统一编辑器的完整演进过程。每个坑背后都有可复用的分析方法和解决模式。

**How to apply:** 新增 renderer 时对照 checklist 逐项检查；遇到编辑不生效问题优先检查 itemPath 精度和 state vs 计算值。
