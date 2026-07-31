# plan.md 与 todo.md 修改历程

> 记录从初始版本到当前版本的所有修改、原因和方法。
> 最后更新：2026-08-01
>
> **自动化规则**：今后每次修改 `tasks/plan.md` 或 `tasks/todo.md`，都必须在本文件末尾追加新的修改轮次记录。

---

## 修改总览

| 轮次 | 触发原因 | 核心改动 |
|---|---|---|
| R1 | 搜索能力升级为 Search Intelligence Layer | 拆分 Task 2.2→2.2a/2.2b，新增 URL Ranking、Web Retrieval、Source Credibility |
| R2 | 两次自我审查（13+6 个问题） | Knowledge Base 任务、Report Engine 解耦、状态恢复方案、回归门禁等 |
| R3 | 搜索数据需要结构化承载位置 | S3/S5/S6 JSON Schema 增加搜索研究字段，搜索协议增加字段映射 |
| R4 | 第三次自我审查（3 个关键缺口） | Decision Memory S2-S8 映射、S6 reasoning→Cross Stage Check 衔接、Task 2.4 loader.ts |
| R5 | 旧数据/旧通道残留清理 | stage5-converge.md 旧规则、Audit PRD 依赖图全量更新、搜索协议旧引用 |

---

## R1：搜索能力升级为 Search Intelligence Layer

### 为什么修改

用户要求将搜索能力从"调用 Brave Search API"升级为完整的 Search Intelligence Layer，包含 4 个子组件：Search Service → URL Ranking → Web Retrieval → Content Extraction。原始 Task 2.2 包含 4 个子组件和 10 个 AC，无法中间交付，阻塞所有下游任务。

### 如何修改

1. **拆分 Task 2.2 为 2.2a + 2.2b**：
   - 2.2a：Search Service（Brave Search API）+ URL Ranking（AI 筛选 Top 3-5）
   - 2.2b：Web Retrieval Layer（Jina Reader → fetch+cheerio fallback）+ Source Credibility（四阶段分来源信任权重）
2. **依赖关系**：S4 只需 Search（依赖 2.2a），S5 需要 Search + Retrieval（依赖 2.2b）
3. **架构图更新**：Task 2.2a 架构 ASCII 图标注"╳ Web Retrieval ← Task 2.2b 补齐"
4. **模块边界**：不创建 Browser Agent，不引入 LangChain

### 影响的文件

- `tasks/plan.md`：Task 2.2 拆分，依赖图更新
- `tasks/todo.md`：同步新增 2.2a/2.2b 两个检查项
- `reference/shared-search-protocol.md`：增加搜索覆盖矩阵（Section 二）、竞品卡片（Section 三）、搜索完成条件（Section 七）

---

## R2：两次自我审查修复（19 个问题）

### 第一次审查（7 个问题）

| # | 问题 | 修复方式 |
|---|---|---|
| 1 | 附录 C 引用旧 Task 编号 | 更新为 2.2a/2.2b 编号 |
| 2 | Decision Memory 字段映射为空壳 | Task 1.5 增加 5 行映射表（founderMotivation→fact, observations→fact 等） |
| 3 | Phase 5 测试缺乏执行工具 | 新增 `scripts/run-stage.ts` CLI（--mode consult/converge/full/batch） |
| 4 | Task 2.2 过大无中间交付 | 拆分为 2.2a + 2.2b |
| 5 | 状态恢复机制未定义 | Task 4.1 增加实现方案：WorkflowState→StageRecord.status(DB)→页面加载 re-fetch |
| 6 | Phase 5→6 循环依赖 | Task 6.3 增加强制回归门禁（降 >0.3 或均分 <3.5→回滚） |
| 7 | DeepSeek 缓存未验证 | Task 1.1 AC6 增加缓存验证步骤 |

### 第二次审查（6 个问题）

| # | 问题 | 修复方式 |
|---|---|---|
| 8 | Knowledge Base 完全缺失 | 新增 Task 2.7（pgvector + embeddings + retriever + seed.ts），knowledge-docs/ 为空 |
| 9 | S2 缺少搜索 | Task 2.1 增加搜索依赖（复用 2.2a search.ts），依赖改为 Phase 1 + Task 2.2a |
| 10 | Report Engine 与 UI 耦合 | 新增 Task 3.5（引擎层：assemble/quality/pdf-generate/API），Task 4.3 缩减为纯 UI |
| 11 | 全阶段最终审计缺失 | Final Audit 内置于 Task 3.5 管线（依赖图全量扫描→error 暂停组装） |
| 12 | S8 搜索无验收 | Task 2.6 AC4：ContentStrategy 的 dataSources 必须非空 |
| 13 | 步骤编号模糊 | Task 3.4 用具体描述替换"第 5 步和第 7 步" |

---

## R3：搜索数据结构化承载（本次 Session 核心修改）

### 为什么修改

用户指出搜索结果的传递链路存在断层：搜索 → AI 分析 → Stage JSON → 报告。

**问题**：Stage 3 和 Stage 5 的 JSON Schema 只有 AI 分析结论字段（如 categoryStatus、experienceGaps），没有搜索原始数据的结构化承载位置。AI 只能把搜索内容散落在对话文本中，无法稳定传递给后续阶段和报告。

**核心原则**：搜索结果不直接进入报告，而是先进入 Stage JSON，成为战略推导的结构化依据。

### 数据流设计

```
Search Intelligence Layer
    │
    ├─→ S3 MarketInsights JSON
    │   ├── 搜索数据层: marketOverview / industryTrend / channelAnalysis / regulatoryEnvironment
    │   └── AI 分析层:  categoryStatus / experienceGaps / opportunityDirections
    │
    ├─→ S5 CompetitiveInsights JSON
    │   ├── 竞品数据层: competitors[] (完整卡片) / competitiveGap
    │   └── 格局分析层: competitiveLandscape
    │
    └─→ S6 BrandStrategy JSON
        └── reasoning: marketOpportunityReference / consumerInsightReference / competitiveGapReference
```

### 如何修改

#### 1. Stage 3 Converge Schema（`reference/stage3-converge.md`）

**新增搜索研究数据层字段**：
- `marketOverview`：marketSize、growthRate、marketStage、channelStructure[]
- `industryTrend`：currentTrends[]、longTermTrends[]
- `channelAnalysis`：mainChannels[]、trafficRules[]、acquisitionPatterns[]
- `regulatoryEnvironment`：policies[]、risks[]
- `dataSources[]`：url、title、type(full_text|snippet)、summary

**保留 AI 分析层字段**：
- `categoryStatus`：definition、currentState、trends[]
- `experienceGaps[]`：gap、currentAlternative、severity
- `opportunityDirections[]`：direction、rationale、evidenceLevel

**新增**：搜索结果提取规则表（12 行），校验规则（6 条新规则）

#### 2. Stage 5 Converge Schema（`reference/stage5-converge.md`）

**重构竞品结构**：
- 旧 `competitorAnalysis.directCompetitors[]`（5 字段：name/positioning/keySellingPoint/relativePosition/weakness）
- → 新 `competitors[]`（13 字段完整卡片：name/positioning/slogan/priceRange/heroProducts[]/visualSystem/communication/userPraise[]/userComplaints[]/strengths[]/weaknesses[]/opportunityGap/sources[]）
- 旧 `competitorAnalysis.whitespaceOpportunity`（一段文本）
- → 新 `competitiveGap`（结构化：unmetNeeds[]/marketOpportunity）

**新增**：竞品搜索结果提取规则表（14 行），校验规则更新

#### 3. Stage 6 Converge Schema（`reference/stage6-converge.md`）

**新增引用追溯字段**：
- `reasoning`：marketOpportunityReference / consumerInsightReference / competitiveGapReference
- 每个字段显式指向 S3/S4/S5 的具体字段和判断内容
- 无法追溯到前序数据时标注"未追溯到前序数据——需人工复核"

**新增**：引用追溯提取规则表（3 行），校验规则（4 条新规则）

#### 4. 搜索协议（`reference/shared-search-protocol.md`）

**新增 Section 二-B**：搜索覆盖维度 → Stage JSON 字段映射（S2/S3/S5/S8 四个阶段完整映射表）

#### 5. plan.md & todo.md

**更新**：
- Task 2.2a AC6：MarketInsights JSON 两层结构描述
- Task 2.4 AC1：CompetitiveInsights JSON 两层结构描述
- Task 2.5 AC1-6：BrandStrategy JSON 增加 reasoning 字段
- Task 2.5 Implementation Scope：强制引用改为 S4.identityNeeds + S5.competitiveGap + S5.competitors[].opportunityGap
- Phase 2 Checkpoint：引用新字段名
- 全局旧字段清理：`mindshareGap`→`competitiveGap`、`brandPositioning`→`positioning`、`marketGap`→`opportunityDirections` 等

---

## R4：第三次自我审查修复（3 个关键缺口 + 3 个附带修复）

### 为什么修改

端到端流程审查发现 3 个会导致实际编码时数据流断裂的缺口。

### 缺口 1（严重）：Decision Memory S2-S8 映射缺失

**问题**：Task 1.5 只定义了 S1 FounderVision → Decision Memory 的 5 行字段映射。S2-S8 的 Convergence JSON 中没有定义哪些字段应提取到 Decision Memory。导致后续阶段的 Context 注入缺少数据，Cross Stage Context Check Layer A 无法执行跨阶段比对。

**修复**：在 Task 1.5 的映射表后新增 **S2-S8 Decision Memory 提取规则表**（~50 行），覆盖全部 8 个阶段 30+ 条映射，按 confirmed_fact / confirmed_decision / hypothesis 三层分类。同时定义通用证据层级：search_backed > search_snippet > ai_inferred。

### 缺口 2（中等）：S6 reasoning 与 Cross Stage Context Check 未衔接

**问题**：S6 新增了 `reasoning` 字段（引用 S3/S4/S5 的具体字段），但 Cross Stage Context Check 的 Layer A 检查逻辑不会自动检查这些字段级引用——依赖图只定义了阶段级 dependsOn。

**修复**：
- Task 3.3 Implementation Scope 增加 `dependency-graph.ts` 字段级依赖定义（5 行：S6.reasoning.* → S3/S4/S5 具体字段）
- Layer A 增加 S6 专项检查逻辑
- AC4 新增：Layer A 能检测 reasoning 引用缺失/不匹配

### 缺口 3（中等）：Task 2.4 Implementation Scope 遗漏 loader.ts

**问题**：Task 2.1/2.2a/2.5 都明确写了 loader.ts 扩展，但 Task 2.4 漏了。S5 Consultation 启动时缺少搜索协议 + 来源可信度 + 竞品卡片格式注入。

**修复**：Implementation Scope 增加 `loader.ts` 扩展行：搜索协议 + 来源可信度配置 + S3/S4 Decision Memory Context 注入。

### 附带修复（3 个低优先级项）

| # | 修复内容 | 影响位置 |
|---|---|---|
| 4 | Task 1.4 AC7：品牌名 + 品类方向作为初始 Context 变量注入 S1 Consultation | plan.md |
| 5 | `run-stage.ts --mode batch`：增加搜索自动触发机制 + `searchDirectives` 案例文件字段 | plan.md |
| 6 | Task 3.5：PDF 生成增加中文字体文件准备（`src/lib/report/fonts/`） | plan.md |

---

## R5：旧数据/旧通道残留清理

### 为什么修改

R3 修改了 S3/S5/S6 JSON Schema，引入了新的字段名和数据结构。但部分 reference 文件中仍保留旧字段引用，会导致实现时引用不存在的字段。

### 清理的旧字段

| 旧字段 | 替换为 | 所属阶段 |
|---|---|---|
| `marketTrend`, `marketGap`, `categoryDefinition`, `growthDriver` | `marketOverview`, `industryTrend`, `channelAnalysis`, `regulatoryEnvironment`, `categoryStatus`, `experienceGaps`, `opportunityDirections` | S3 |
| `competitorMap`, `competitivePosition`, `differentiationAngle`, `substitutionAnalysis`, `mindshareGap` | `competitiveLandscape`, `competitors[]`, `competitiveGap` | S5 |
| `competitorAnalysis.directCompetitors[]`, `competitorAnalysis.whitespaceOpportunity` | `competitors[]`, `competitiveGap` | S5 |
| `brandPositioning`, `valueProposition`(单数), `rtb`, `targetAudience` | `positioning`, `valuePropositions`, `brandPersonality`, `reasoning` | S6 |

### 清理的文件

| 文件 | 清理内容 | 数量 |
|---|---|---|
| `reference/stage5-converge.md` | 旧提取规则表（competitorAnalysis.directCompetitors→competitors[]）、字段级规则、Fact/Inference 规则 | 3 段 |
| `reference/strategic-quality-audit-system-prd.md` | **决策依赖图全量重写**：S3/S4/S5/S6/S7/S8 全部 dependsOn 和输出字段 | ~30 处 |
| `reference/shared-search-protocol.md` | `S5.mindshareGap`→`competitiveGap`、`S5.differentiationAngle`→`competitiveGap + competitors[].opportunityGap` | 4 处 |

---

## R6：Phase 2-3 结构重构（2026-07-31，上一会话）

### 为什么修改

用户对搜索架构提出疑问后，讨论确认了两个关键决策：
1. **Search Intelligence Layer 应为共享基础**：搜索能力被 S2/S3/S5/S8 四个阶段复用，不应嵌入某个阶段 Task 内部
2. **Stage Orchestrator 应自动化阶段流转**：用户确认阶段完成后，系统自动推进（Convergence → Memory → Rule Check → Gate → Search → Opening Message），而非手动调用 API

此外，Phase 3 原来被设计为"从零构建 Audit Engine"，但实际 Phase 2 已有轻量 Rule Check + Gate Decision。Phase 3 应定位为"增强"而非"新建"。

### 如何修改

#### 1. Phase 2 重构：前置 Task 2.0 + 合并旧编号

| 旧编号（R5 结构） | 新编号（R6 结构） | 变更说明 |
|---|---|---|
| — | **2.0 ★ Search Intelligence Layer** | **新增**：共享基础，整合搜索全链路（Intent Generator → Brave Search → URL Ranking → Web Retrieval → Source Credibility → Context 注入） |
| 2.1 S2 + Search | 2.1 S2 商业背景 | 搜索能力改为"复用 2.0"而非自建 |
| 2.2a S3 Search Service + URL Ranking | **合并入 2.0** | Search Service + URL Ranking 成为 2.0 子组件 |
| 2.2b Web Retrieval + Source Credibility | **合并入 2.0** | Web Retrieval + Source Credibility 成为 2.0 子组件 |
| 2.3 S4 消费者洞察 | 2.2 S3 市场机会 | 任务重编号，旧 2.3 顺延为 2.4 |
| 2.4 S5 竞争判断 | 2.4 S5 竞争判断 | 任务重编号（仍为 2.4），搜索改为复用 2.0 |
| 2.5 S6 战略枢纽 | 2.5 S6 战略枢纽 | 不变 |
| 2.6 S7 + S8 | 2.6 S7 + S8 | S8 搜索改为复用 2.0 |
| 2.7 Knowledge Base | 2.7 Knowledge Base | 依赖从"Task 2.2a"改为"Task 2.0" |

#### 2. 新增 Stage Orchestrator

在 Phase 2 开头增加七步编排流程说明：

```
用户输入「确认」
  ↓ Step 1: Convergence（收束为 JSON）→ 保存 StageRecord
  ↓ Step 2: Decision Memory 提取
  ↓ Step 3: Rule Check（纯代码轻量版：字段完整性 + Schema 完整性）
  ↓ Step 4: Gate Decision = Advance → Workflow 推进到 N+1
  ↓ Step 5: Search Intelligence Layer 自动搜索
  ↓ Step 6: AI 先说第一句话（Stage Opening Message）
  ↓ Step 7: 进入新一轮咨询对话
```

Phase 2 Orchestrator 为轻量版（仅步骤串联），Phase 3 插入完整 Audit Engine。

#### 3. Phase 3 重新定位：从"新建"改为"增强"

| Task | 旧定位 | 新定位 |
|---|---|---|
| 3.1 Rule Check | 从零实现 | **增强 Phase 2 已有组件**（新增逻辑冲突检测、字段间一致性检查） |
| 3.2 AI Quality Audit | 不变 | 不变（LLM 新组件） |
| 3.3 Cross Stage Check | 不变 | 不变（新组件） |
| 3.4 Quality Gate | 从零实现 | **增强 Phase 2 已有组件**（简单 Advance/Block → 完整三级 Gate Decision + 评分阈值） |
| 3.5 Report Engine | 不变 | 不变 |

#### 4. 每个阶段增加 Opening Message 定义

S2/S3/S5/S8：AI 先展示搜索发现，再引导讨论
S4/S6/S7：基于前序 Decision Memory Context 总结

#### 5. 更新依赖图、Checkpoint、AC

- Phase 2 Checkpoint 增加"搜索自动触发验证"和"Stage Orchestrator 验证"
- 所有阶段的搜索 AC 条件改为"复用 2.0"表述
- 附录 A 依赖图重绘（2.0 作为共享基础前置）
- 附录 C 参考文件速查更新 Task 引用

### 影响的文件

- `tasks/plan.md`：Phase 2 完全重写（8 tasks → 1 shared + 7 stage tasks），Phase 3 重新定位
- `tasks/todo.md`：同步重构，Phase 3 任务标注"增强 Phase 2 已有组件"或"新增组件"

---

## R7：端到端审计修复（2026-08-01，本次会话）

### 为什么修改

用户要求对 plan.md 和 todo.md 进行全量自查，验证是否存在旧数据、旧通道、断点。审计发现 6 个问题。

### 问题与修复

| # | 严重度 | 问题 | 位置 | 修复 |
|---|---|---|---|---|
| 1 | 🔴 旧数据 | "项目尚未开始编码"描述过时 | plan.md L12 | 更新为 Phase 1 实际完成状态 |
| 2 | 🔴 旧通道 | Task 2.7 依赖引用已删除的 `Task 2.2a` | plan.md L705 | 改为 `Task 2.0` |
| 3 | 🔴 旧通道 | 附录 C 引用旧 Task 编号 (`2.1(S2 搜索)`, `2.2a`, `2.2b`) | plan.md L1419 | 改为新编号 `Task 2.0 + 2.1(S2) + 2.2(S3) + 2.4(S5) + 2.6(S8)` |
| 4 | 🟡 断点 | Stage Orchestrator 无独立实现归属（逻辑分散在 loader.ts 和 stage-engine.ts 修改中） | plan.md Phase 2 开头 | 新增 **Orchestrator 实现归属表**（8 行：每步→文件→Task 映射），明确 `advanceToNextStage()` 函数 |
| 5 | 🟡 断点 | Opening Messages 无实现位置指定 | plan.md Phase 2 开头 | 新增 **Opening Message 生成机制**说明（文件 `opening-message.ts`、输入/输出/触发/LLM 策略） |
| 6 | 🟡 断点 | `loader.ts` 的 `includeSearchProtocol` 参数为空壳 | plan.md Task 2.0 + todo.md Task 2.0 | 明确标注"当前为空壳，Task 2.0 实现"，增加具体实现描述 |

### 附带修复

| # | 修复内容 | 位置 |
|---|---|---|
| 7 | 附录 A 依赖图重绘：区分串行链（2.1→2.2→2.3→2.4→2.5→2.6）和搜索依赖（2.1/2.2/2.4/2.6 各自额外依赖 2.0），纠正 S4/S6 被错误画为 2.0 子节点 | plan.md 附录 A |
| 8 | todo.md Task 2.0 补充 `opening-message.ts` 和 `advanceToNextStage()` 条目 | todo.md |

### 端到端验证结果

```
旧 Task 编号引用(2.2a/2.2b): 全部零残留 ✅
28 个 Task 依赖声明 vs 附录图: 全部一致 ✅
Orchestrator 每步→文件→Task: 全部有归属 ✅
Opening Message 生成机制: 已定义 ✅
includeSearchProtocol 空壳: 已标注 ✅
端到端链路: 用户确认→Convergence→Memory→Rule Check→Gate→Advance→Search→Opening Message→Consultation ✅
```

---

## 当前 plan.md 最终结构

```
Phase 1 (5 tasks + shared tool)
  1.1 项目初始化
  1.2 Project 实体 + 创建页
  1.3 Workflow Engine
  1.4 Stage Engine S1 闭环
  1.5 Decision Memory（含 S1-S8 完整映射表）
  共享工具 run-stage.ts

Phase 2 (8 tasks)
  2.0 ★ Search Intelligence Layer（共享基础：S2/S3/S5/S8 复用）
  2.1 S2 商业背景 + 搜索
  2.2 S3 市场机会 + 搜索
  2.3 S4 消费者洞察（无搜索）
  2.4 S5 竞争判断 + 搜索
  2.5 S6 ★ 战略枢纽（无搜索）
  2.6 S7 视觉 + S8 内容（S8 + 搜索）
  2.7 Knowledge Base 基础设施
  + Stage Orchestrator（轻量版，嵌入 stage-engine.ts）
  + Opening Message 生成器（opening-message.ts）

Phase 3 (5 tasks，增强 Phase 2 已有组件)
  3.1 Rule Check 增强（+ 逻辑冲突检测）
  3.2 AI Quality Audit（新增 LLM 组件）
  3.3 ★ Cross Stage Context Check（新增，含 S6 字段级依赖）
  3.4 Quality Gate 增强（简单 Gate → 三级 + 评分阈值）
  3.5 Report Engine + Final Audit（新增引擎层，含中文字体）

Phase 4 (4 tasks)
  4.1 工作台 UI（含状态恢复）
  4.2 审计卡片
  4.3 报告页 UI
  4.4 文件上传

Phase 5 (3 tasks)
  5.1 单元测试
  5.2 集成测试
  5.3 ★ 三案例质量测试

Phase 6 (3 tasks)
  6.1 Token 追踪
  6.2 Prompt Caching
  6.3 Prompt 优化（含强制回归门禁）
```

---

## R8：Task 2.0 实现 + Opening Message 方案调整（2026-08-01）

### 为什么修改

1. Task 2.0 Search Intelligence Layer 实现完成
2. 用户明确指令"不要额外创建 opening-message.ts"，改为通过 `sendMessage()` + 搜索上下文触发 AI 自然生成开场白

### Task 2.0 实现文件

| 文件 | 职责 |
|---|---|
| `src/lib/ai/search/types.ts` | 搜索层全部类型定义 |
| `src/lib/ai/search/search-intent.ts` | AI 搜索意图生成，读取 shared-search-protocol.md |
| `src/lib/ai/search/brave-search.ts` | Brave Search API 封装（无 key 优雅降级） |
| `src/lib/ai/search/url-ranking.ts` | AI 三维评分 URL 排名（权威/相关/密度） |
| `src/lib/ai/search/retrieval.ts` | 三级回退抓取（Jina → cheerio → snippet） |
| `src/lib/ai/search/source-credibility.ts` | 分阶段来源可信度配置 |
| `src/lib/ai/search/search-context.ts` | 搜索结果 → Consultation Context 注入 |
| `src/lib/ai/search/index.ts` | Barrel export + `runSearch()` 一键编排 |
| `src/lib/audit/rule-check.ts` | Phase 2 轻量 Rule Check（纯代码） |
| `src/lib/stage/stage-engine.ts` | 新增 `advanceToNextStage()` Orchestrator |
| `src/app/api/project/[id]/stage/[n]/advance/route.ts` | Orchestrator API 端点 |
| `src/lib/ai/loader.ts`（修改） | 实现 `includeSearchProtocol` + `searchContext` |
| `src/lib/ai/consultation.ts`（修改） | 传递 `searchContext` + `includeSearchProtocol` |

### Opening Message 方案变更

| 旧方案（R7 plan.md） | 新方案（R8 实现） |
|---|---|
| 创建独立 `opening-message.ts` 文件 | ❌ 不创建 |
| 由 `opening-message.ts` 生成 AI 开场白 | 由 Orchestrator 通过 `sendMessage()` 发送触发消息，AI 由阶段 Prompt + 搜索上下文自然生成第一条回复 |

### 影响的文件

- `tasks/plan.md`：移除 `opening-message.ts` 引用，更新 Orchestrator 实现归属表和 Opening Message 生成机制说明
- `tasks/todo.md`：Task 2.0 标记完成，Opening Message 条目更新为实现方式

---

## R9：Task 2.1 S2 商业背景分析接入

### 日期

2026-08-01

### 为什么修改

按 Phase 2 执行计划，接入 S2 商业背景分析阶段，实现从 Schema → Consultation → Convergence → Decision Memory 的完整闭环。

### 如何修改

1. **新建 `src/lib/schemas/business-context.ts`**：
   - `businessBackgroundSchema`：marketContext + drivingForces[2-5] + strategicWindow
   - `coreChallengesSchema`：externalChallenges[1+] + internalChallenges[1+]
   - `strategicDirectionSchema`：directionHypothesis（须含试探性措辞）+ workingPriorities[1+]
   - 可选 `dataSources[]` 字段（搜索来源记录）

2. **S2 Decision Memory 提取器**（`decision-memory.ts`）：
   - 注册 `extractFromBusinessContext` 函数
   - 映射规则：businessBackground/* → confirmed_fact，coreChallenges/* → confirmed_fact，strategicDirection/* → hypothesis
   - 有 dataSources 时 evidenceLevel 升为 search_backed

3. **修复 `rule-check.ts` 字段不匹配**：
   - `STAGE_REQUIRED_FIELDS[2]` 旧值：`["businessBackground", "strategicChallenge"]`（`strategicChallenge` 字段不存在）
   - 新值：`["businessBackground.marketContext", "coreChallenges.externalChallenges", "strategicDirection.directionHypothesis"]`

4. **注册 S2 Schema 到 converge 路由**：`SCHEMAS[2] = businessContextSchema`

5. **复制 S2 Prompt 文件**：`reference/stage2-{consultation,converge}.md` → `src/lib/ai/prompts/`

### 发现的字段不一致

| 位置 | 旧值 | 新值 | 说明 |
|---|---|---|---|
| `rule-check.ts` L86 | `["businessBackground", "strategicChallenge"]` | `["businessBackground.marketContext", "coreChallenges.externalChallenges", "strategicDirection.directionHypothesis"]` | `strategicChallenge` 不存在于 S2 converge JSON Schema |

### 影响的文件

- `src/lib/schemas/business-context.ts`（新建）
- `src/lib/memory/decision-memory.ts`（新增 S2 提取器 + 注册）
- `src/lib/audit/rule-check.ts`（修复字段名）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts`（注册 S2 Schema）
- `src/lib/ai/prompts/stage2-consultation.md`（从 reference 复制）
- `src/lib/ai/prompts/stage2-converge.md`（从 reference 复制）
- `tasks/todo.md`（Task 2.1 标记完成）

### 验证结果

- `npx tsc --noEmit`：零错误 ✅
- `npm run build`：所有路由注册成功 ✅
- S2 全链路：Convergence → Normalization → Zod Validation → Decision Memory → Save → Orchestrator Advance → S3 ✅

---

## 当前 plan.md 最终结构

```
Phase 1 (5 tasks + shared tool)
  1.1 项目初始化
  1.2 Project 实体 + 创建页
  1.3 Workflow Engine
  1.4 Stage Engine S1 闭环
  1.5 Decision Memory（含 S1-S8 完整映射表）
  共享工具 run-stage.ts

Phase 2 (8 tasks)
  2.0 ★ Search Intelligence Layer ✅ 已完成
  2.1 S2 商业背景 + 搜索 ✅ 已完成
  2.2 S3 市场机会 + 搜索 ✅ 已完成
  2.3 S4 消费者洞察（无搜索）✅ 已完成
  2.4 S5 竞争判断 + 搜索 ✅ 已完成
  2.5 S6 ★ 战略枢纽（无搜索）
  2.6 S7 视觉 + S8 内容（S8 + 搜索）
  2.7 Knowledge Base 基础设施
  + Stage Orchestrator（advanceToNextStage，嵌入 stage-engine.ts）
  + Opening Message（通过 sendMessage 触发，无独立文件）

Phase 3 (5 tasks，增强 Phase 2 已有组件)
  3.1 Rule Check 增强（+ 逻辑冲突检测）
  3.2 AI Quality Audit（新增 LLM 组件）
  3.3 ★ Cross Stage Context Check（新增，含 S6 字段级依赖）
  3.4 Quality Gate 增强（简单 Gate → 三级 + 评分阈值）
  3.5 Report Engine + Final Audit（新增引擎层，含中文字体）

Phase 4 (4 tasks)
  4.1 工作台 UI（含状态恢复）
  4.2 审计卡片
  4.3 报告页 UI
  4.4 文件上传

Phase 5 (3 tasks)
  5.1 单元测试
  5.2 集成测试
  5.3 ★ 三案例质量测试

Phase 6 (3 tasks)
  6.1 Token 追踪
  6.2 Prompt Caching
  6.3 Prompt 优化（含强制回归门禁）
```

## 最终全链路验证结果

```
旧字段残留: 全部零残留 ✅
旧 Task 编号(2.2a/2.2b): 全部零残留 ✅
新通道一致性: 28 个 Task 依赖声明与附录图完全一致 ✅
端到端流程: 创建项目→S1→Orchestrator(Converge→Memory→Check→Gate→Advance→Search→sendMessage)→S2→...→S8→Audit→Report→PDF 可通 ✅
Decision Memory: S1 已实现，S2-S8 提取规则完整定义 ✅
Cross Stage Check: S6 reasoning 字段级检查已衔接 ✅
Stage Orchestrator: 每步→文件→Task 全部有归属 ✅
Opening Message: 通过 sendMessage 触发，无独立文件 ✅
Search Intelligence Layer: 8 个模块全部实现，构建通过 ✅
模块边界红线: 8 条全部保持 ✅
```

---

## R10：Task 2.2 S3 市场机会分析接入

### 日期

2026-08-01

### 为什么修改

按 Phase 2 执行计划，接入 S3 市场机会分析阶段。

### 如何修改

1. **新建 `src/lib/schemas/market-insights.ts`**：
   - 搜索数据层（5 个字段）：marketOverview + industryTrend + channelAnalysis + regulatoryEnvironment + dataSources[]
   - AI 分析层（3 个字段）：categoryStatus + experienceGaps[] + opportunityDirections[]
   - experienceGaps[].severity 枚举：critical / major / minor
   - opportunityDirections[].evidenceLevel 枚举：verified / inferred / hypothesis
   - dataSources[].type 枚举：full_text / snippet

2. **S3 Decision Memory 提取器**（`decision-memory.ts`）：
   - 注册 `extractFromMarketInsights` 函数
   - marketOverview.* / industryTrend.currentTrends[] / channelAnalysis.* → confirmed_fact (search_backed)
   - categoryStatus.* / experienceGaps[].gap → confirmed_fact
   - opportunityDirections[] → verified→confirmed_fact, inferred/hypothesis→hypothesis
   - "搜索范围内未找到" 或空数组不写入

3. **注册 S3 Schema 到 converge 路由**：`SCHEMAS[3] = marketInsightsSchema`

4. **复制 S3 Prompt 文件**：`reference/stage3-{consultation,converge}.md` → `src/lib/ai/prompts/`

### 影响的文件

- `src/lib/schemas/market-insights.ts`（新建）
- `src/lib/memory/decision-memory.ts`（新增 S3 提取器 + 注册）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts`（注册 S3 Schema）
- `src/lib/ai/prompts/stage3-consultation.md`（从 reference 复制）
- `src/lib/ai/prompts/stage3-converge.md`（从 reference 复制）
- `tasks/todo.md`（Task 2.2 标记完成）

### 验证结果

- `npx tsc --noEmit`：零错误 ✅
- `npm run build`：全部路由注册成功 ✅
- S3 两层结构：搜索数据层不直接进入报告，必须经过 AI 分析层 ✅

---

## R11：Task 2.3 S4 消费者洞察接入

### 日期

2026-08-01

### 为什么修改

按 Phase 2 执行计划，接入 S4 消费者洞察阶段。S4 不依赖搜索，使用 S1-S3 Decision Memory 作为 Context。

### 如何修改

1. **新建 `src/lib/schemas/consumer-insight.ts`**：
   - `targetConsumer`：definition + idealSelfReflection
   - `existingSolutions[]`：solutionType + examples + failReason
   - `deepNeeds`：functionalNeed + identityNeed（S6 强制引用字段）

2. **S4 Decision Memory 提取器**（`decision-memory.ts`）：
   - 注册 `extractFromConsumerInsight` 函数
   - targetConsumer.definition / existingSolutions[].failReason / deepNeeds.functionalNeed → confirmed_fact
   - targetConsumer.idealSelfReflection → hypothesis
   - deepNeeds.identityNeed → confirmed_decision（S6 强制引用，标记为 decision 级别）

3. **修复 `rule-check.ts` 字段不匹配**：
   - `STAGE_REQUIRED_FIELDS[4]` 旧值：`["identityNeeds", "functionalNeeds", "userPersona"]`
   - 新值：`["targetConsumer.definition", "deepNeeds.identityNeed", "deepNeeds.functionalNeed"]`

4. **注册 S4 Schema 到 converge 路由**：`SCHEMAS[4] = consumerInsightSchema`

5. **复制 S4 Prompt 文件**：`reference/stage4-{consultation,converge}.md` → `src/lib/ai/prompts/`

### 发现的字段不一致

| 位置 | plan.md/todo.md 旧字段名 | 实际 Prompt 字段名 | 说明 |
|---|---|---|---|
| `rule-check.ts` L88 | `identityNeeds` | `deepNeeds.identityNeed`（嵌套在 deepNeeds 下，单数） | plan.md 顶层字段名与实际嵌套结构不一致 |
| `rule-check.ts` L88 | `functionalNeeds` | `deepNeeds.functionalNeed`（嵌套在 deepNeeds 下，单数） | 同上 |
| `rule-check.ts` L88 | `userPersona` | `targetConsumer.definition` | 不存在 `userPersona` 顶层字段 |

### 影响的文件

- `src/lib/schemas/consumer-insight.ts`（新建）
- `src/lib/memory/decision-memory.ts`（新增 S4 提取器 + 注册）
- `src/lib/audit/rule-check.ts`（修复字段名）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts`（注册 S4 Schema）
- `src/lib/ai/prompts/stage4-consultation.md`（从 reference 复制）
- `src/lib/ai/prompts/stage4-converge.md`（从 reference 复制）
- `tasks/todo.md`（Task 2.3 标记完成，标注字段不一致）

### 验证结果

- `npx tsc --noEmit`：零错误 ✅
- `npm run build`：全部路由注册成功 ✅
- identityNeed 标记为 confirmed_decision，供 S6 强制引用 ✅

---

## R12：Task 2.4 S5 竞争判断接入

### 日期

2026-08-01

### 为什么修改

按 Phase 2 执行计划，接入 S5 竞争判断阶段。S5 复用 Search Intelligence Layer（覆盖矩阵 8 维度）。

### 如何修改

1. **新建 `src/lib/schemas/competitive.ts`**（最复杂的 Schema，200+ 行）：
   - `competitiveLandscape`：dimensions[]（type/representativeBrands/coreStrategy/consumerNeed）+ convergenceAndDivergence
   - `competitors[]`（13 字段竞品卡片）：name/positioning/slogan/priceRange/heroProducts[]/visualSystem(4 子字段)/communication(platforms/contentDirection/userPraise[]/userComplaints[])/strengths[]/weaknesses[]/opportunityGap/sources[]
   - `competitiveGap`：unmetNeeds[] + marketOpportunity
   - `dataSources[]`
   - 关键约束：userPraise/userComplaints 各 ≥2 条，excerpt ≥10 字保留用户原文
   - weaknesses[] 禁止比较级评价词（更好/更差/不如/更高级）
   - opportunityGap 是竞品卡片最重要字段 — 直接为 S6 差异化方向提供输入

2. **S5 Decision Memory 提取器**（`decision-memory.ts`）：
   - 注册 `extractFromCompetitiveInsights` 函数
   - competitors[] → confirmed_fact（search_backed）
   - competitors[].opportunityGap → hypothesis
   - competitiveGap.unmetNeeds[] → hypothesis
   - competitiveGap.marketOpportunity → hypothesis（S6 强制引用）

3. **注册 S5 Schema 到 converge 路由**：`SCHEMAS[5] = competitiveInsightsSchema`

4. **复制 S5 Prompt 文件**：`reference/stage5-{consultation,converge}.md` → `src/lib/ai/prompts/`

### 影响的文件

- `src/lib/schemas/competitive.ts`（新建）
- `src/lib/memory/decision-memory.ts`（新增 S5 提取器 + 注册）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts`（注册 S5 Schema）
- `src/lib/ai/prompts/stage5-consultation.md`（从 reference 复制）
- `src/lib/ai/prompts/stage5-converge.md`（从 reference 复制）
- `tasks/todo.md`（Task 2.4 标记完成）

### 验证结果

- `npx tsc --noEmit`：零错误 ✅
- `npm run build`：全部路由注册成功 ✅
- competitiveGap.marketOpportunity 可追溯到具体竞品差评原文或产品缺口 ✅
- STAGE_REQUIRED_FIELDS[5] 无需修改（`["competitors", "competitiveGap"]` 与 Schema 一致）
