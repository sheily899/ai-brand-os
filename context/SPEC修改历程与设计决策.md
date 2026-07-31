# SPEC.md 修改历程与设计决策

> 文档版本：v7
> 最终行数：1783 行
> 修改跨度：2026-07-31（同一天内七轮迭代）

---

## 修改总览

| 轮次 | 改动范围 | 触发原因 | 核心决策 |
|---|---|---|---|
| v1 | 初始创建（536 行） | 11 轮产品访谈完成 | 建立六大板块框架 |
| v2 | 技术栈重写 | "免费 + 面试可解释 + 企业级"约束 | DeepSeek 替代 Claude 为主模型 |
| v3 | PDF + 知识库升级 | 用户要求 MVP 必须包含 | 从"未来扩展"改为"必须" |
| v4 | 审计系统架构重构 | 审计 PRD 跨阶段设计问题 | 三组件 Stage Audit Engine |
| v5 | 核心模块边界冻结 | 防止后续模块膨胀和职责混乱 | 五引擎架构 + 模块间通信规则 |
| v6 | Credits 系统 | 商业模式（按次付费）需要技术基础 | Token 消耗追踪层 |
| v7 | 三页面 + Project 数据模型 | 明确前端 UI 和数据结构 | 从 Session 中心 → Project 中心 |

---

## v1：初始创建（536 行）

### 触发
11 轮产品访谈完成。用户给出了清晰的：目标用户、核心痛点、AI 角色、
MVP 范围、成功标准、不做的事、现有资产、最大风险。

### 内容
按用户要求的六大框架生成：
1. 目标（Objectives）
2. 核心工作流结构（Core Workflow）—— 八阶段双 Prompt 体系
3. 系统架构（System Architecture）—— 外部能力依赖表
4. 代码风格与项目结构约定
5. 测试策略（Testing Strategy）—— 工程质量 + 内容质量双轨
6. 边界（Boundaries）—— MVP 不包含的 14 项

### 关键设计
- 双 Prompt 体系：Consultation（多轮咨询）+ Convergence（结构化收束）
- 阶段间数据流：S1 → S2 → S3 → S4 → S5 → S6（战略枢纽）→ S7 → S8
- S6 承接 S1-S5 并影响 S7-S8 的枢纽位置
- 技术栈初版：Next.js + TypeScript + Anthropic Claude + Vercel + Supabase

---

## v2：技术栈重写（536 → 599 行）

### 触发
用户提出三条约束：
1. **最终为了面试** —— 技术栈选择必须能解释"为什么"
2. **免费** —— 除了 LLM API 调用，其余不产生费用
3. **接近企业落地水准** —— 代码组织、类型安全、错误处理达到生产标准

### 改动
**LLM 从 Claude → DeepSeek：**
- 价格：Claude 的 1/50
- 月均费用从 ~¥50-200 降为 ~¥5-30
- API 格式与 OpenAI 完全兼容，切换成本为零

**技术栈表完全重写：**
- 每个选型从"原因"改为"面试级理由"——具体的技术判断而非"因为流行"
- 新增"费用概览"子表：全部项目 ¥0（除 LLM API）
- 新增"适配器模式"设计：`interface.ts → deepseek.ts / openai.ts / anthropic.ts`

**面试级理由示例：**
- 为什么 PostgreSQL 不是 MongoDB → ACID 保证阶段推进原子性，JSONB 兼顾灵活性
- 为什么 Drizzle 不是 Prisma → 无代码生成步骤，冷启动友好，bundle 小 100 倍
- 为什么 pgvector 不是 Pinecone → 与业务数据同实例，避免双数据库同步

### 新增
- 3.4 咨询界面交互设计（Claude Code/ChatGPT 风格）
- 文件上传 + 图片粘贴 + 联网搜索的交互规范
- ASCII 界面布局图

---

## v3：PDF + 知识库升级

### 触发
用户要求：
- PDF 导出和知识库从"未来扩展"改为 MVP **必须**
- 咨询界面参考 Claude Code、ChatGPT（附件上传、粘贴图片、联网搜索）

### 改动
**3.1 外部能力依赖表：**
- PDF 导出：~~未来扩展~~ → **必须**，使用 @react-pdf/renderer（纯客户端，零服务器成本）
- 知识库：~~未来扩展~~ → **必须**，使用 pgvector on Supabase（免费层内置）
- 界面交互设计扩展为完整章节，包含文件上传规范、图片粘贴规范、联网搜索交互三段式展示

---

## v4：审计系统架构重构（599 → 697 行）

### 触发
用户提供审计 PRD，指出跨阶段审计设计存在根本性问题：不应作为独立模块，
不应等全部阶段结束后统一扫描。

### 改动
**PRD 重构（独立文件）：**
- 新增 04.A 决策依赖图（S1-S8 完整 dependsOn 关系）
- 新增 04.B Cross Stage Context Check 详细设计
  - Layer 1：引用完整性检查（纯代码比对，有依赖即触发）
  - Layer 2：语义断裂检查（LLM，复用 AI Quality Audit 同次调用，质量达标才触发）
- 门禁规则：Layer 1 error → 强制至少 Reoptimize；Layer 2 → 不单独构成门禁
- UI 部分更新：不新增界面元素，跨阶段问题并入现有三状态卡片
- 按钮文案改为 "智能优化 / 手动调整 / 保持当前决策"

---

## v5：核心模块边界冻结（697 → 1275 行）

### 触发
用户要求：在写代码之前冻结模块职责，避免后续出现业务逻辑耦合、
模块无限膨胀。具体要求：
1. 重新定义 Workflow Engine 边界（只回答"现在允许用户做什么"）
2. 增加 Stage Engine 概念（封装 Consultation → Convergence → Validation → Audit → Save）
3. 按审计 PRD 重新设计 Stage Audit Engine（三组件）
4. 跨阶段审计目标改为"只检查高价值冲突"，不检查所有问题
5. 跨阶段检查分为 Fact Reference Check + Strategic Continuity Check
6. Decision Memory 不是聊天记录仓库
7. 数据处理管线重新设计

### 改动

**3.2 MVP 架构总览完全重写：**
旧架构：
```
workflow.ts（什么都管）
  → consultation.ts / convergence.ts（直接暴露）
  → cleaner.ts（机械+语义混在一起）
  → decision-memory.ts（放在 workflow 子目录）
  → report-assemble.ts
```

新架构：
```
Workflow Engine（只管状态转移）
  → Stage Engine（单阶段完整流程）
      → AI 层（Consultation + Convergence）
      → Output Normalization（纯正则）
      → Schema Validation（Zod + 重试）
      → Stage Audit Engine（三组件）
      → Decision Memory（战略资产存储）
  → Report Engine（全阶段完成后触发）
```

**3.3 数据处理管线完全重写：**
- 拆分为"单阶段处理管线" + "全阶段完成后补充管线"
- cleaner.ts 拆分为 normalizer.ts（机械修复）+ report-quality.ts（违规检测）
- 新增"与旧管线的关键区别"表

**新增六个核心引擎详细设计：**
- 3.4 Workflow Engine — 七状态状态机 + 接口定义
- 3.5 Stage Engine — 六步执行流程 + 明确的"不负责"列表
- 3.6 Stage Audit Engine — 三组件架构 ASCII 图 + Cross Stage 检查范围示例
- 3.7 Decision Memory — 保存/不保存边界 + confirmedFact/Decision/Hypothesis/UnresolvedQuestion 四类实体
- 3.8 Report Engine — 完整管线 + 接口定义

**4.2 文件组织重新设计：**
- `lib/workflow/decision-memory.ts` → `lib/memory/decision-memory.ts`（Decision Memory 不是 Workflow 子模块）
- `lib/output/cleaner.ts` → `lib/stage/normalizer.ts` + `lib/report/quality.ts`
- 新增 `lib/stage/`、`lib/audit/`、`lib/memory/`、`lib/report/` 独立目录
- 新增"目录结构关键变化"对照表

**4.3 模块职责表重写：**
- 按六层组织：引擎层 / AI 层 / 审计层 / 数据层 / 基础设施层 / 表现层
- 每个模块明确"负责"和"不负责"
- 新增"模块间通信规则"：Component → API → Workflow → Stage → AI/Audit/Memory

**3.1 能力矩阵扩展：**
- 拆分为"外部服务依赖"（LLM、存储、认证等）+ "系统级能力"（五个引擎）
- 每个能力标注 MVP 状态（必须/未来扩展/不纳入）

---

## v6：Credits 系统（1275 → 1429 行）

### 触发
用户讨论商业模式，要求增加 token 消耗追踪层和用户余额管理。
这是按次付费商业模式的技术基础，也是面试加分项。

### 改动
**新增 3.10 Credits & Token 消耗追踪系统：**

- **面试加分逻辑**："为什么选 DeepSeek → 1/50 价格 → ¥9.9 单次报告 → 5000x 价格优势"
- **数据模型**：CreditAccount / TokenConsumption / CreditPurchase
- **Token → Credit 换算**：一次完整八阶段咨询成本 ~¥0.5，售价 ¥9.9
- **费用控制机制**：预估 → 预留 → 结算 → 余额不足拦截 → 消耗透明
- **与 Stage Engine 集成**：`reserveCredits()` 在 Consultation 前，`settleCredits()` 在 Audit 后
- **MVP 范围**：追踪 + 余额管理 + 免费额度 + 拦截逻辑为必须；在线支付为未来扩展

---

## v7：三页面 + Project 数据模型（1429 → 1783 行）

### 触发
用户明确前端三个页面及其职责，要求数据模型以 Project 为核心，
MVP 不包含登录但预留 User 关联。

### 改动

**3.9 前端页面架构完全重写（原为单页面"咨询界面"）：**

| 旧设计 | 新设计 |
|---|---|
| 一个"会话页"包揽全部 | 三个独立页面，各司其职 |
| Session（会话）为中心 | Project（项目）为中心 |
| 路由 `/session/[id]` | 路由 `/project/[id]` |

三个页面各含：定位说明、设计原则、完整 ASCII 界面布局、关键交互列表、
MVP 范围标注。

**页面间导航关系明确定义：**
```
项目创建页 (/) → 工作台 (/project/[id]) → 报告页 (/project/[id]/report)
                                                  ↓
                                            可随时返回工作台修改
```

**4.5 数据模型规范完全重写：**

旧：
```
Session → StageRecord → Report（三个实体，无 User 概念）
```

新：
```
Project（核心实体，userId 可选）
  ├── StageRecord × 8
  ├── DecisionMemoryEntry × N
  └── Report × 1
```

关键设计：
- `Project.userId` 字段已预留，MVP 时为 `null`
- 未来加 User 表只需三行 SQL，已有表结构不需要改动
- 实体关系图（ASCII）展示完整关联
- DecisionMemoryEntry 从"嵌入 StageRecord"变为独立表
- Report 增加 `chapters` 数组结构，每章标记 `sourceStage`

**4.6 API 端点完全重写：**
- 路径从 `/api/session/` → `/api/project/`
- 新增端点：report assemble、chapter edit、pdf export
- 每个端点标注 Method + Path + 说明

**4.2 文件组织更新：**
- `app/` 目录改为 `/`、`/project/[id]`、`/project/[id]/report` 三页面
- `api/` 目录改为 project 中心的全嵌套路由
- `components/` 按页面组织：`entry/`、`workspace/`、`report/`、`audit/`、`upload/`、`ui/`

---

## 设计决策日志

以下记录 SPEC 演进中的关键决策及其原因，供面试时引用。

### 决策 1：为什么八阶段比六阶段好？
**原因**：旧版六阶段把"收集信息"和"提炼战略"压缩在一起。Stage 1 收集了创始人原话，
但从来没有一个阶段对原话做战略抽象。新版拆出 Stage 2（商业背景分析）
和 Stage 4（消费者洞察），让每一步推导都可追溯、可验证。

### 决策 2：为什么双 Prompt 而不是一个 Prompt？
**原因**：Consultation 和 Convergence 的目标冲突——
Consultation 需要一次一问、开放式探索，Convergence 需要读完整对话、
输出严格 JSON。放在同一个 Prompt 里，LLM 会在"该追问还是该输出"之间摇摆。

### 决策 3：为什么 DeepSeek 而不是 Claude？
**原因**：三个约束同时满足——
(1) 价格 1/50，月费从 ¥200 降到 ¥30；
(2) API 与 OpenAI 兼容，适配器模式一天内可切换；
(3) 中文品牌咨询场景下质量不降。

### 决策 4：为什么 Stage Audit Engine 是三组件而不是两个？
**原因**：Rule Check（纯代码）和 AI Quality Audit（LLM）解决的是阶段内质量，
但品牌咨询的核心风险是跨阶段逻辑断裂——S4 说用户要"省时"，S6 品牌定位却围绕
"仪式感"，且不解释为什么。Cross Stage Context Check 专门解决这个问题。

### 决策 5：为什么 Strategic Continuity Check 必须复用 AI Quality Audit 的同一次 LLM 调用？
**原因**：每多一次 LLM 调用 = 多一次延迟 + 多一次成本 + 多一次引入新走样的风险。
把跨阶段语义检查作为 AI Quality Audit system prompt 的可选附加段落，
不额外消耗 token 用于独立的 API 调用。

### 决策 6：为什么 Decision Memory 不是聊天记录仓库？
**原因**：聊天记录 = 大量噪音（闲聊、试探性问题、被推翻的中间结论）。
Decision Memory 只保存"影响未来阶段的战略资产"（confirmedFacts / confirmedDecisions /
hypotheses / unresolvedQuestions），让 Cross Stage Context Check 有明确的检查目标，
而不是在数万字的对话记录中做模糊匹配。

### 决策 7：为什么以 Project 为中心而不是 Session？
**原因**：Session 暗示"一次对话"。Project 暗示"一个品牌资产"。
品牌战略不是一次性对话产物——用户会回来修改、迭代、导出。
Project 模型天然支持历史项目管理、报告版本管理、未来 User 关联。

### 决策 8：为什么数据模型预留 userId 但 MVP 不加 User 表？
**原因**：MVP 验证的是"AI 品牌咨询流程是否有价值"，不是"用户愿不愿意注册"。
但如果在 StageRecord 中硬编码了用户信息，未来加 User 表时就需要迁移已有数据。
预留 `project.userId`（nullable）是最小成本的未来兼容设计。

### 决策 9：为什么 Credits 系统在商业模式验证之前就设计？
**原因**：Token 消耗追踪不是"支付功能"——它是成本核算的基础设施。
有了它，才能回答"一次咨询的实际成本是多少"、"定价 ¥9.9 是否可持续"、
"哪些阶段的 token 消耗最高，是否需要优化 Prompt 长度"。
即使 MVP 不收费，追踪层也必须在第一天就存在。

### 决策 10：为什么 Workflow Engine 不能调用 LLM？
**原因**：职责耦合是产品死亡的主要原因。如果 Workflow 既管流程又调 LLM，
未来任何一个改动（换模型、改 Prompt、加审计规则、调阶段顺序）都需要改动
Workflow 代码。把 AI 调用隔离在 Stage Engine 内，Workflow 只通过接口获取
Quality Gate Decision，两个模块可以独立演进。

---

## 最终架构快照

```
1783 行 SPEC.md

六大板块：
  1. 目标 — 问题、用户、差异化、验证假设、成功标准
  2. 核心工作流 — 八阶段、双 Prompt、数据流、S6 枢纽、核心原则
  3. 系统架构 — 能力矩阵、五引擎架构、数据管线、三页面、Credits
  4. 代码风格 — 技术栈、文件组织、模块职责（六层）、数据模型、API、命名、错误处理
  5. 测试策略 — 工程质量（单元/集成/异常）+ 内容质量（3 案例 × 5 维度 × 对照测试）
  6. 边界 — MVP 不包含 13 项 + 核心验证假设

参考文件：
  - reference/ — 16 个 Prompt 模板 + 审计 PRD + 搜索协议 + 架构迁移指南
  - context/关键对话.docx — 产品方向 11 轮访谈 + 架构总结
```

---

## 一句话总结

SPEC.md 从一份"访谈后生成的概要"（536 行），经过七轮迭代，
演变为一份**可冻结模块边界、可指导工程实现、可支撑面试答辩**
的完整架构规格文档（1783 行）。

每一次修改都不是"加内容"，而是**收窄职责、明确边界、消除耦合隐患**。
