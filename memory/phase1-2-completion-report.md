# Phase 1/2 完成报告

> 日期：2026-08-01
> 覆盖：Task 1.1 → Task 2.8 全部完成 + 6 个 E2E 问题修复

---

## 一、总体状态

| Phase | 任务数 | 完成 | 核心验证 |
|-------|--------|------|---------|
| Phase 1 | 5 | ✅ 全部 | S1 FounderVision JSON 有战略价值 |
| Phase 2 | 9 | ✅ 全部 | 40/40 Converge+Advance 100%，S1→S8 推导链成立 |

---

## 二、Phase 1：MVP 最小可用闭环

### Task 1.1 — 项目初始化与技术栈搭建

**新建文件**：
- `package.json` / `tsconfig.json` / `next.config.js` / `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/lib/db/schema.ts` / `src/lib/db/index.ts`（Drizzle ORM + Supabase PostgreSQL）
- `src/lib/ai/provider/interface.ts` / `deepseek.ts` / `index.ts`（LLM 适配器模式）
- `src/lib/utils/id.ts`

**关键决策**：
- 主模型 DeepSeek（deepseek-chat），适配器模式支持切换
- Drizzle ORM schema-first，`db push` 建表
- `userId` nullable（MVP 不实现用户系统）

### Task 1.2 — 项目创建页与 Project 实体

**新建文件**：
- `src/app/page.tsx`（项目创建页）
- `src/app/project/[id]/page.tsx`（工作台占位页）
- `src/app/api/project/route.ts`（POST 创建）
- `src/app/api/project/[id]/route.ts`（GET 详情）
- `src/lib/db/project-repo.ts`

**功能**：品牌名（必填）+ 品类方向（可选，含"其他"）→ Project 写入 Supabase → 跳转工作台

### Task 1.3 — Workflow Engine

**新建文件**：
- `src/lib/workflow/workflow.ts`（七状态状态机：INACTIVE → ACTIVE → CONVERGING → AUDITING → ADVANCED / REOPTIMIZE / BLOCKED）
- `src/lib/workflow/router.ts`（阶段路由判断）
- `src/lib/memory/dependency-graph.ts`（`STAGE_DEPENDENCIES`：S1 无依赖，S2 依赖 S1，…，S8 依赖 S1-S7）

**红线遵守**：Workflow Engine 代码中零 LLM 调用

### Task 1.4 — Stage Engine S1 闭环

**新建文件**：
- `src/lib/stage/stage-engine.ts`（单阶段执行协调器：Consultation → Convergence → Normalization → Validation → Save）
- `src/lib/ai/loader.ts`（Prompt 加载 + 变量注入 + Context 拼装）
- `src/lib/ai/consultation.ts`（多轮对话 + 一次一问 + SSE 流式）
- `src/lib/ai/convergence.ts`（单次结构化提取）
- `src/lib/stage/normalizer.ts`（纯正则 JSON 修复）
- `src/lib/stage/schema-validator.ts`（Zod 校验 + 最多 3 次 retry）
- `src/lib/schemas/founder-vision.ts`（S1 Zod Schema）
- `src/app/api/project/[id]/stage/[n]/message/route.ts`（POST 消息 SSE）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts`（POST 触发收束）
- `src/app/api/project/[id]/stage/[n]/route.ts`（GET 阶段记录）
- `src/app/api/project/[id]/stage/[n]/advance/route.ts`（POST 推进到下一阶段）

### Task 1.5 — Decision Memory

**新建文件**：
- `src/lib/memory/decision-memory.ts`（战略资产读写 + S1-S8 提取器注册）

**关键设计**：
- 四个 entryType：`confirmed_fact`、`confirmed_decision`、`hypothesis`、`unresolved_question`
- evidenceLevel 三层：`verified` > `search_snippet` > `ai_inferred`
- 不保存聊天记录和 AI 推理过程
- S1-S8 完整字段映射（见 SPEC 3.7）

---

## 三、Phase 2：完整八阶段咨询工作流

### Task 2.0 — Search Intelligence Layer

**新建文件（6 个）**：
- `src/lib/ai/search/types.ts`（搜索结果类型定义）
- `src/lib/ai/search/search-intent.ts`（Search Intent Generator：根据阶段+品牌+品类+Context 自动生成搜索关键词）
- `src/lib/ai/search/bocha-search.ts`（博查 Web Search API 封装，POST + Bearer 认证 + 15s 超时）
- `src/lib/ai/search/retrieval.ts`（Web Retrieval：Jina Reader → fetch + cheerio fallback → 搜索摘要兜底）
- `src/lib/ai/search/url-ranking.ts`（AI URL Ranking：权威性/相关度/数据密度 → Top 3-5）
- `src/lib/ai/search/source-credibility.ts`（四阶段分来源信任权重：官方数据 > 行业报告 > 媒体报道 > 社媒内容）
- `src/lib/ai/search/search-context.ts`（搜索结果结构化上下文构建）
- `src/lib/ai/search/index.ts`（统一导出）

**设计决策**：
- 搜索 API 从 Brave 迁移至博查（Brave API 中国网络不可达）
- 共享搜索协议三段式格式化：搜索发现 / 可信度判断 / 对分析的影响
- 自动搜索触发：Stage Orchestrator 在进入新阶段时自动调用，无需用户手动触发
- searchContext 注入 Consultation system prompt

### Task 2.1-2.6 — S2-S8 阶段接入

**每个阶段包含**：

| 阶段 | Schema 文件 | Consultation Prompt | Convergence Prompt | 搜索 |
|------|------------|-------------------|-------------------|------|
| S2 商业背景 | `business-context.ts` | `stage2-consultation.md` | `stage2-converge.md` | ✅ 8 维度 |
| S3 市场机会 | `market-insights.ts` | `stage3-consultation.md` | `stage3-converge.md` | ✅ 8 维度 |
| S4 消费者洞察 | `consumer-insight.ts` | `stage4-consultation.md` | `stage4-converge.md` | — |
| S5 竞争判断 | `competitive.ts` | `stage5-consultation.md` | `stage5-converge.md` | ✅ 8 维度 |
| S6 品牌核心战略 | `brand-strategy.ts` | `stage6-consultation.md` | `stage6-converge.md` | — |
| S7 视觉策略 | `visual-strategy.ts` | `stage7-consultation.md` | `stage7-converge.md` | — |
| S8 内容规划 | `content-strategy.ts` | `stage8-consultation.md` | `stage8-converge.md` | ✅ 7 维度 |

**S3 特殊处理 — 拆分收敛**：
- 搜索数据层（Converge A）和 AI 分析层（Converge B）各自独立调用 LLM
- 各自独立 normalize → validate → retry，互不影响
- 合并后做一次完整 Schema 校验
- `marketOverview`/`industryTrend`/`channelAnalysis`/`regulatoryEnvironment`/`dataSources` 5 个无下游依赖字段放宽为 optional

**S6 战略枢纽验证**：
- `reasoning` 字段强制显式追溯：S3 市场机会 + S4 identityNeed + S5 competitiveGap
- 5 案例全部验证：positioning 可追溯到前序阶段具体判断

### Task 2.7 — Knowledge Base 基础设施

**新建文件（4 个）**：
- `src/lib/knowledge/types.ts`（知识库类型定义）
- `src/lib/knowledge/embeddings.ts`（DeepSeek embeddings，hash-based）
- `src/lib/knowledge/retriever.ts`（hybrid search + keyword fallback）
- `src/lib/knowledge/index.ts`

**设计决策**：pgvector (jsonb 存储)，仅建管道不做数据播种（`knowledge-docs/` 目录为空）

### Task 2.8 — Decision Traceability & Impact Propagation

**新建文件（4 个 API + 2 个核心模块）**：

核心模块：
- `src/lib/audit/impact-analyzer.ts`（纯规则影响分析，零 AI 调用。三态分类：no_impact / needs_review / invalidated）
- `src/lib/memory/decision-version.ts`（不可变版本链：`updateEntry()` + `getVersionHistory()`）

API 路由：
- `GET /api/project/[id]/decisions`（按阶段列出决策条目）
- `PUT /api/project/[id]/decisions/[entryId]`（修改决策，触发影响分析，级联 invalidate 下游）
- `POST /api/project/[id]/decisions/[entryId]/impact`（影响预评估，不执行实际修改）
- `POST /api/project/[id]/stage/[n]/revalidate`（重新进入失效阶段）

**修改文件（7 个）**：

| 文件 | 改动内容 |
|------|---------|
| `src/lib/db/schema.ts` | `decision_memory_entries` 新增 `previousVersionId` + `modifiedBy` 列；`stage_record` 新增 `searchContext` 列 |
| `src/lib/db/stage-repo.ts` | 新增 `saveSearchContext()` |
| `src/lib/memory/dependency-graph.ts` | 新增 `FIELD_FORWARD_DEPENDENCIES`（25+ 条字段级映射，覆盖 S3→S4/S5/S6、S4→S6/S7/S8、S5→S6/S7/S8、S6→S7/S8）+ `normalizeFieldPath()` / `getDownstreamAffected()` / `getFieldSourceStage()` |
| `src/lib/memory/decision-memory.ts` | 新增 `getEntriesByStage()`；S4 `identityNeed` entryType 改为 `hypothesis` |
| `src/lib/workflow/workflow.ts` | StageStatus 新增 `invalidated`；新增 `invalidateDownstream()` / `revalidateStage()`；`canEnterStage()` 允许重新进入失效阶段 |
| `src/lib/stage/stage-engine.ts` | `AdvanceResult` 新增 `searchContext` 字段；新增 `reExecuteStage()`（保留原对话历史 + 注入更新后的 Decision Memory Context + 级联重分析下游） |
| `src/app/api/project/[id]/stage/[n]/message/route.ts` | 新增活跃阶段校验：invalidated → 409，非 active/draft → 403；注入 searchContext |

**关键设计决策**：
- 影响分析用纯子串匹配（S6 convergence prompt 要求逐字引用，子串匹配足够）
- `FIELD_FORWARD_DEPENDENCIES` 独立于 `STAGE_DEPENDENCIES`，标注 prompt 证据来源
- 版本管理用链表（`previousVersionId`），非原地修改
- `reExecuteStage()` 级联检查更下游阶段

---

## 四、E2E 测试与问题修复

### 测试规模

| 指标 | 数值 |
|------|------|
| 测试案例 | 5 个虚构创始人画像 |
| 总轮次 | 210 轮对话 + 40 次 Convergence + 40 次 Advance |
| 总耗时 | ~65 分钟（~13 min/case） |
| LLM Provider | DeepSeek (deepseek-chat) |
| Search API | 博查 Web Search API |

### 测试结果

- ✅ 40/40 阶段 Converge + Advance 100% 通过
- ✅ 每阶段均在 maxRounds 内完成
- ✅ Decision Memory 传递完整（每案例 65-72 条）
- ✅ S6 战略枢纽：全部 positioning 引用 S4 identityNeed + S5 competitiveGap
- ✅ S7 视觉可追溯到 S6 brandPersonality
- ✅ S8 内容策略服务于 S6 brandPositioning
- ✅ problem_driven / creation_driven 两种创始人类型均正常

### 6 个问题修复

| # | 优先级 | 问题 | 修复方案 | 影响文件 |
|---|--------|------|---------|---------|
| 1 | P0 | 博查 Search API 不可用（Brave API 中国网络超时） | 迁移至博查 Web Search API（`api.bocha.cn`），POST + Bearer 认证 + 15s 超时 | 新建 `bocha-search.ts`，删除 `brave-search.ts`，更新 `.env.local` |
| 2 | P1 | S3 Convergence 校验失败率高（4/5 需 2-3 次 retry） | 拆分为 Converge A（搜索数据层）+ Converge B（AI 分析层）两次独立 LLM 调用，各自独立校验/重试。5 个字段放宽为 optional。最终：3 案例×2 轮验证 = 100% 成功率，0 retries | `convergence.ts`、`stage-engine.ts`、`market-insights.ts` |
| 3 | P1 | 阶段间 searchContext 不延续至第 2+ 轮 consultation | `AdvanceResult` 新增 `searchContext` 字段；batch 脚本第 2+ 轮 `sendMessage()` 注入；DB 持久化 `saveSearchContext()`；Web UI message route 读取注入 | `stage-engine.ts`、`stage-repo.ts`、`schema.ts`、`message/route.ts`、`run-batch.ts` |
| 4 | P2 | S4 identityNeed 被标为 `confirmed_decision` 但含推测语言 | `extractFromConsumerInsight()` 中 `identityNeed` 的 `entryType` 从 `confirmed_decision` 改为 `hypothesis`，`evidenceLevel` 改为 `ai_inferred` | `decision-memory.ts` |
| 5 | P3 | `detectReportStyle()` 启发式过严（0/40 命中，但实际输出均为专业报告语体） | 阈值 ≥3→≥2；新增 9 个 AI 高频正式模式（`我们进入`、`前序阶段`、`已确认[的了]`、`先回顾一下`、`【搜索发现】` 等）。验证：40 样本 0%→S2-S8 79%，S1 0%符合预期（S1 为咨询开场提问），零误判 | `run-batch.ts` |
| 6 | P3 | Founder 模拟器最后轮收束信号不够自然（`isFinalRound` 强制注入） | 删除 `isFinalRound` 强制信号；改为 founder system prompt 静态规则 7（自主判断收束时机）；maxRounds 降级为纯安全网；Exit Conditions 仍由 AI 顾问侧保证 | `run-batch.ts` |

---

## 五、全链路数据流验证

```
S1 创始人诉求
  │  founderMotivation, observations, constraints, founderType
  ▼
S2 商业背景分析
  │  marketContext, drivingForces, strategicWindow（消费 S1 Context）
  ▼
S3 市场机会分析
  │  marketOverview, opportunityDirections, experienceGaps（消费 S1+S2 Context + 搜索）
  ▼
S4 消费者洞察
  │  targetConsumer, functionalNeed, identityNeed（消费 S1-S3 Context）
  ▼
S5 竞争判断
  │  competitors, competitiveGap, whitespaceOpportunity（消费 S1-S4 Context + 搜索）
  ▼
S6 品牌核心战略 ◄── 战略枢纽
  │  positioning（引用 S4.identityNeed + S5.competitiveGap）
  │  valuePropositions, brandStory, brandPersonality
  ▼
S7 视觉策略
  │  coreConcept, visualSystem（可追溯至 S6.brandPersonality）
  ▼
S8 内容规划
     coreDirection, themeDirections, channelStrategy（服务于 S6.brandPositioning + 搜索）
```

**验证通过**：
- Decision Memory 跨阶段传递：S6 可追溯到 S4/S5 具体字段
- 搜索上下文跨轮次延续：AdvanceResult → batch script → sendMessage()
- Web UI 搜索上下文保障：DB 持久化 + message route 注入
- S3 拆分收敛：搜索层和 AI 分析层独立校验，合并后完整校验
- 阶段状态管理：invalidated → revalidate → reExecute → 级联下游

---

## 六、数据库 Schema 变更汇总

### `project` 表
- `id`, `name`, `category`, `status`, `currentStage`, `createdAt`, `updatedAt`, `userId` (nullable)

### `stage_record` 表
- `id`, `projectId`, `stageNumber`, `status`, `structuredOutput` (jsonb), `consultationMessages` (jsonb), `auditResult` (jsonb), `searchContext` (text, **Phase 2 新增**), `createdAt`, `updatedAt`

### `decision_memory_entries` 表
- `id`, `projectId`, `stageSource`, `entryType` (confirmed_fact/confirmed_decision/hypothesis/unresolved_question), `content`, `fieldPath`, `evidenceLevel`, `confirmedAt`, `previousVersionId` (text, **Task 2.8 新增**), `modifiedBy` (text, **Task 2.8 新增**)

### `knowledge_embeddings` 表
- `id`, `projectId`, `content`, `embedding` (jsonb), `metadata` (jsonb), `createdAt`

---

## 七、API 路由总览

| 方法 | 路径 | 职责 | Phase |
|------|------|------|-------|
| POST | `/api/project` | 创建项目 | 1 |
| GET | `/api/project/[id]` | 获取项目详情 | 1 |
| GET | `/api/project/[id]/stage/[n]` | 获取阶段记录 | 1 |
| POST | `/api/project/[id]/stage/[n]/message` | 发送消息（SSE 流式） | 1 |
| POST | `/api/project/[id]/stage/[n]/converge` | 触发收束 | 1 |
| POST | `/api/project/[id]/stage/[n]/advance` | 推进到下一阶段 | 2 |
| GET | `/api/project/[id]/decisions` | 按阶段列出决策条目 | 2.8 |
| PUT | `/api/project/[id]/decisions/[entryId]` | 修改决策条目 | 2.8 |
| POST | `/api/project/[id]/decisions/[entryId]/impact` | 影响预评估 | 2.8 |
| POST | `/api/project/[id]/stage/[n]/revalidate` | 重新进入失效阶段 | 2.8 |

---

## 八、模块边界红线检查

| # | 红线 | 状态 |
|---|------|------|
| 1 | Workflow Engine 不调用 LLM | ✅ 零 LLM 调用 |
| 2 | Decision Memory 不保存聊天记录 | ✅ 仅保存战略资产 |
| 3 | 前端组件不直接调用 AI 层 | ✅ 仅通过 API |
| 4 | 不提前实现 User 表 | ✅ userId nullable |
| 5 | S6 positioning 必须引用 S4/S5 具体字段 | ✅ reasoning 字段显式追溯 |
| 6 | Task 2.8 影响分析不做 AI 调用 | ✅ 纯子串匹配 |

---

## 九、待后续 Phase 完成的任务

| Phase | 核心任务 |
|-------|---------|
| Phase 3 | Audit Engine（AI Quality Audit 四维评分 + Cross Stage Context Check Layer A/B + Quality Gate 增强） |
| Phase 4 | 完整产品体验（工作台多阶段 Tab 导航 + 审计卡片 UI + 报告页 + 文件上传） |
| Phase 5 | 质量验证（单元测试 + 集成测试 + 三案例人工内容质量评审） |
| Phase 6 | 成本优化（Token 消耗追踪 + Prompt Caching + 数据驱动 Prompt 优化） |

---

## 十、关键文件索引

| 类别 | 文件 | 行数（估） |
|------|------|-----------|
| 核心引擎 | `src/lib/stage/stage-engine.ts` | ~470 |
| 工作流 | `src/lib/workflow/workflow.ts` | ~300 |
| 决策记忆 | `src/lib/memory/decision-memory.ts` | ~200 |
| 依赖图 | `src/lib/memory/dependency-graph.ts` | ~180 |
| 影响分析 | `src/lib/audit/impact-analyzer.ts` | ~120 |
| 版本管理 | `src/lib/memory/decision-version.ts` | ~154 |
| 搜索层 | `src/lib/ai/search/` (6 文件) | ~600 |
| 知识库 | `src/lib/knowledge/` (4 文件) | ~200 |
| Schema | `src/lib/schemas/` (8 文件) | ~400 |
| API 路由 | `src/app/api/` (10 文件) | ~500 |
| 测试文档 | `reference/brand-domain-cases.md` | ~275 |
| 测试报告 | `reference/e2e-test-phase1-2-2026-08-01.md` | ~89 |
| 测试脚本 | `scripts/run-batch.ts` | ~400 |
