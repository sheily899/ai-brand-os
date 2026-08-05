---
name: plan-changelog-autoupdate
description: 修改 plan.md 或 todo.md 后必须自动更新修改历程文件
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

每次修改 `tasks/plan.md` 或 `tasks/todo.md` 后，必须在 `context/plan与todo修改历程.md` 末尾追加新的修改轮次记录。

记录格式（参考 R6、R7 的结构）：
1. `## RX：简短标题（日期）` — X 为递增序号
2. `### 为什么修改` — 触发原因
3. `### 如何修改` — 具体改动（用表格对比旧→新）
4. `### 影响的文件` — 文件清单
5. 更新时间戳和"当前 plan.md 最终结构"章节
6. 重新运行"最终全链路验证结果"

**Why:** 用户明确要求"以后如果我再次修改 plan，你都要自动更新"。这是强制性规则，不是可选建议。

**How to apply:** 每次对 tasks/plan.md 或 tasks/todo.md 的 Edit/Write 操作后，立即更新 changelog。不要等用户提醒。
