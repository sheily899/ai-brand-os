# AI Brand OS — 实现计划

> 基于 SPEC.md v7（1783 行）
> 目标：将项目拆解为可独立实现、可独立测试、可逐步交付的任务序列

---

## Context

AI Brand OS 是一个面向 0-3 年新消费品牌创始人的 AI 原生品牌战略伙伴产品。通过八阶段连续品牌咨询流程，将创始人的模糊想法转化为有依据、可执行、可迭代的品牌战略决策。

当前状态：SPEC.md v7 完成，16 个 Prompt 模板已就绪，Audit PRD 已完成，共享搜索协议已定义。**Phase 1 已完成**：项目初始化、Project CRUD、Workflow Engine（七状态状态机）、Stage Engine S1 闭环（Consultation SSE → Convergence → Zod Validation → Save）、Decision Memory（S1 提取器已注册，S2-S8 提取规则已定义）。Phase 2 待开始。

核心验证目标：**AI 是否能够通过连续八阶段品牌咨询流程，将创始人的模糊想法转化为有依据、可执行、可迭代的品牌战略决策。**

### 关键架构约束

- Workflow Engine 不调用 LLM，只管理状态转移
- Stage Engine 是唯一可调用 AI + Audit + Memory 层的模块
- Decision Memory 不保存聊天记录
- Cross Stage Context Check 复用 AI Quality Audit 同一次 LLM 调用
- 前端组件不直接调用 AI 层
- 数据模型以 Project 为核心，userId 预留但 MVP 为 null
- LLM 通过适配器模式，主模型 DeepSeek，可切换

---

## 阶段依赖总览

```
Phase 1: 基础设施 + S1 闭环验证
    │  Checkpoint: FounderVision 是否有战略价值？
    │
Phase 2: 八阶段战略链路
    │  重点验证 S1-S6 决策连续性
    │  Checkpoint: 战略推导是否成立？
    │
Phase 3: Audit Engine
    │  重点：跨阶段冲突检测
    │  Checkpoint: 能否发现明显战略错误？
    │
Phase 4: 完整产品体验
    │  重点：创建 → 咨询 → 审计 → 报告
    │  Checkpoint: 状态恢复 + 用户流程
    │
Phase 5: 质量验证
    │  三案例测试
    │  Checkpoint: 内容质量 + 稳定性
    │
Phase 6: 成本优化
    │  Token 分析 / 缓存策略 / Prompt 优化
    │  Checkpoint: 单次咨询成本可度量 + 优化机会已识别
```

---

## Phase 1：基础设施 + S1 闭环验证

**目标**：搭建完整技术栈，跑通从项目创建到 S1 结构化输出的完整链路。

**Checkpoint**：FounderVision JSON 是否具有战略价值（而非创始人原话复述）？

---

### Task 1.1：项目初始化与技术栈搭建

**Purpose**：建立项目骨架，确保所有技术选型正确集成。

**Implementation Scope**：

新建文件：
- `package.json`、`tsconfig.json`、`next.config.js`、`tailwind.config.ts`
- `src/app/layout.tsx`
- `src/lib/db/schema.ts`、`src/lib/db/index.ts`（Project 表 + StageRecord 表 + DecisionMemoryEntry 表）
- `src/lib/ai/provider/interface.ts`、`src/lib/ai/provider/deepseek.ts`
- 环境变量 `.env.local.example`
- `src/lib/utils/` 基础工具函数

不包含：
- 任何业务页面（Task 1.2 做）
- 任何 Engine 逻辑（Task 1.3+ 做）
- 认证系统

**Dependencies**：无

**Acceptance Criteria**：
1. `npm run dev` 可启动 Next.js 开发服务器
2. TypeScript strict mode 无报错，Tailwind CSS 正确编译
3. Drizzle ORM 可连接 Supabase PostgreSQL，`db push` 成功建表
4. DeepSeek API 适配器可成功发送请求并获得响应
5. `LLM_PROVIDER` 环境变量可切换 provider
6. **DeepSeek Prompt Cache 验证**：发两次相同 system prompt 的 API 请求（间隔 < 5 分钟），对比第二次请求的 `usage.prompt_tokens` 是否被计费
   - 若第二次 input token 计费显著减少或为 0 → 缓存生效，Task 6.2 方案可行
   - 若两次计费相同 → 缓存未生效或 DeepSeek 当前不支持，Task 6.2 调整为"手动前缀分离 + 客户端去重"方案
   - 结果记录在 `docs/deepseek-cache-verification.md`

**Testing Strategy**：
- 手动验证 dev server 启动 + DeepSeek API 连通性
- 验证 Drizzle schema 三张核心表（Project / StageRecord / DecisionMemoryEntry）正确创建

---

### Task 1.2：项目创建页与 Project 实体

**Purpose**：实现 SPEC 3.9.2 定义的项目创建页。用户输入品牌名称和品类方向，创建 Project 记录。

**Implementation Scope**：

新建/修改文件：
- `src/app/page.tsx` — 项目创建页
- `src/components/entry/BrandEntryForm.tsx` — 品牌名（必填）+ 品类方向（可选）
- `src/components/entry/ProjectHistory.tsx` — 历史项目列表（按 localStorage 匿名 ID 查询）
- `src/app/api/project/route.ts` — POST 创建项目
- `src/app/api/project/[id]/route.ts` — GET 项目详情
- `src/app/project/[id]/page.tsx` — 工作台占位页

不包含：
- 完整工作台 UI（Phase 4）
- 用户登录/注册
- 报告页

**Dependencies**：Task 1.1

**Acceptance Criteria**：
1. 访问 `/` 可看到项目创建表单，品牌名为必填，品类方向为可选（含"其他"选项）
2. 提交后 Project 写入 Supabase，userId 为 null
3. 创建成功后跳转 `/project/[id]`
4. 历史项目列表可显示已有项目，刷新后可通过 URL 恢复

**Testing Strategy**：
- 手动端到端测试：填写表单 → 创建 → 跳转 → 刷新恢复
- 验证 Supabase Project 记录字段完整性

---

### Task 1.3：Workflow Engine 基础能力

**Purpose**：实现 SPEC 3.4 定义的七状态状态机。严格限制：不调用 LLM，不判断内容质量。

**Implementation Scope**：

新建文件：
- `src/lib/workflow/workflow.ts` — 状态机核心逻辑
- `src/lib/workflow/router.ts` — 阶段路由判断
- `src/lib/memory/dependency-graph.ts` — 决策依赖图定义（dependsOn 关系）

状态机：INACTIVE → ACTIVE → CONVERGING → AUDITING → ADVANCED / REOPTIMIZE / BLOCKED

关键接口：`getCurrentState()` / `canEnterStage()` / `handleGateDecision()` / `advanceToNextStage()` / `getStageDependencies()`

不包含：
- 实际 AI 调用（Stage Engine 负责）
- 审计逻辑（Audit Engine 负责）
- 报告生成（Report Engine 负责）

**Dependencies**：Task 1.1（技术栈）、Task 1.2（Project 实体存在）

**Acceptance Criteria**：
1. 八个阶段的依赖关系正确（S1 无依赖，S6 依赖 S1-S5）
2. 状态转移正确：ACTIVE → CONVERGING → AUDITING → ADVANCED
3. 非法跳级被阻止（S2 未完成时不能进入 S3）
4. `handleGateDecision()` 正确处理 Advance/Reoptimize/Block 三种结果
5. Workflow Engine 代码中不包含任何 LLM 调用

**Testing Strategy**：
- 单元测试：所有状态转移路径 + dependsOn 验证 + 非法跳级拒绝 + Reoptimize 循环

---

### Task 1.4：Stage Engine 最小闭环（仅 S1）

**Purpose**：实现 SPEC 3.5 定义的单阶段完整流程。打通 Consultation → Convergence → Normalization → Schema Validation → Save StageRecord。仅实现 S1。

**Implementation Scope**：

新建文件：
- `src/lib/stage/stage-engine.ts` — 单阶段执行协调器
- `src/lib/ai/loader.ts` — Prompt 加载 & 变量注入 & Context 拼装
- `src/lib/ai/consultation.ts` — Consultation 调用管理（多轮对话，流式 SSE，一次一问）
- `src/lib/ai/convergence.ts` — Convergence 调用管理（单次结构化提取）
- `src/lib/stage/normalizer.ts` — Output Normalization（纯正则修复：括号/引号/破折号）
- `src/lib/stage/schema-validator.ts` — Schema Validation（Zod + 重试控制，最多 3 次）
- `src/lib/schemas/founder-vision.ts` — S1 输出 Zod Schema + TypeScript 类型
- `src/app/api/project/[id]/stage/[n]/message/route.ts` — POST 消息（流式 SSE）
- `src/app/api/project/[id]/stage/[n]/converge/route.ts` — POST 触发收束
- `src/app/api/project/[id]/stage/[n]/route.ts` — GET 阶段记录
- `src/lib/ai/prompts/stage1-consultation.md`（从 reference 复制）
- `src/lib/ai/prompts/stage1-converge.md`（从 reference 复制）

不包含：
- S2-S8 阶段（Phase 2）
- Audit Engine（Phase 3）
- Decision Memory 自动提取（Task 1.5 手动实现初版）
- 搜索功能（S3 接入时再做）

**Dependencies**：Task 1.3（Workflow Engine）

**Acceptance Criteria**：
1. 用户可在 S1 进行多轮对话，AI 每次只提出一个问题
2. 用户确认阶段完成后，调用 Convergence 输出 FounderVision JSON
3. Zod 校验通过后 StageRecord 正确保存；Zod 校验失败时正确重试（仅重生成违规字段，最多 3 次）
4. 流式响应（SSE）正常工作，用户看到逐字输出
5. Stage Engine 执行顺序正确：Consultation → Convergence → Normalization → Validation → Save
6. Consultation system prompt 注入了"一次一问"约束
7. S1 Consultation 首条系统消息注入 Project 元数据（品牌名 + 品类方向）作为初始 Context 变量

**Testing Strategy**：
- 集成测试：模拟 S1 完整对话 → 确认完成 → 验证 JSON 输出结构
- 单元测试：Schema Validation 拒绝非法 JSON、normalizer 正确修复标点
- 手动测试：通过 API 发送消息，观察流式响应和最终 StageRecord

---

### Task 1.5：Decision Memory 基础能力

**Purpose**：实现 SPEC 3.7 定义的战略资产存储。只保存 confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions，不保存聊天记录。

**Implementation Scope**：

新建文件：
- `src/lib/memory/decision-memory.ts` — 战略资产读写

关键类型：`ConfirmedFact`、`ConfirmedDecision`、`Hypothesis`、`UnresolvedQuestion`

MVP 初版策略：S1 完成时，由 Convergence 输出中提取 confirmedFacts（创始人明确陈述的事实）和 confirmedProblems（已确认的问题），写入 DecisionMemoryEntry。后续阶段 Consultation 启动时读取前序 Decision Memory 作为 Context。

**Convergence → Decision Memory 字段映射规则**：

| Convergence JSON 字段 | → | DecisionMemoryEntry 类型 | 提取规则 |
|---|---|---|---|
| `founderMotivation.content` | → | `confirmed_fact` | 直接映射，source 标注 `founder_statement` |
| `observations[].behavior` + `observations[].result` | → | `confirmed_fact` | 每条 observation 拆为独立 fact，field 路径标注 `observations[N].behavior/result` |
| `confirmedProblems[]` | → | `confirmed_fact` | 每条 problem 独立存储，evidenceLevel=1（创始人直接陈述） |
| `constraints.{budget,team,timeline}` | → | `confirmed_fact` | 仅非空字段写入，field 路径标注 `constraints.{subfield}` |
| Convergence 输出中未出现在以上映射中的字段 | → | 不写入 Memory | — |
| 用户对话中提及但未被 Convergence 字段覆盖的数值/事实 | → | 暂不处理 | MVP 只从结构化 JSON 提取，不做自由文本 NER |

**S2-S8 Decision Memory 提取规则（Phase 2 各 Task 实现时执行）**：

以下规则由 Phase 2 各 Task 在实现对应阶段时执行。提取逻辑内置在 `stage-engine.ts` 的 Convergence 后处理步骤中。
核心原则：**只有对后续阶段有战略影响的判断才写入 Memory**。搜索原始数据、中间推理、过渡性结论不写入。

| 阶段 | Convergence JSON 字段 | → | DecisionMemoryEntry 类型 | 提取规则 |
|---|---|---|---|---|
| **S2** | `businessBackground` | → | `confirmed_fact` | 商业背景核心事实（行业环境、发展阶段等客观描述），source 标注为 `s2_analysis` |
| S2 | `strategicChallenge` | → | `confirmed_fact` | 核心战略挑战，一条写入一条 fact |
| S2 | `businessModel` | → | `confirmed_fact` | 商业模式方向（如有明确确认） |
| S2 | `currentStage` | → | `confirmed_fact` | 品牌当前所处阶段（初创/增长/转型等） |
| **S3** | `marketOverview.marketSize` | → | `confirmed_fact` | 仅当有搜索数据支撑时写入（dataSources 中 type=full_text），否则不写入 |
| S3 | `marketOverview.marketStage` | → | `confirmed_fact` | 赛道发展阶段判断（萌芽期/增长期/成熟期/红海衰退期） |
| S3 | `marketOverview.growthRate` | → | `confirmed_fact` | 增长率数据，仅当有明确来源时写入 |
| S3 | `regulatoryEnvironment.risks[]` | → | `confirmed_fact` | 政策风险条目，每条独立写入 |
| S3 | `opportunityDirections[]`（evidenceLevel=verified/inferred） | → | `confirmed_fact` | 已验证或强推断的市场机会方向 |
| S3 | `opportunityDirections[]`（evidenceLevel=hypothesis） | → | `hypothesis` | 待验证的市场机会方向 |
| S3 | `experienceGaps[]`（severity=critical） | → | `confirmed_fact` | 核心体验缺口 |
| S3 | `categoryStatus.definition` | → | `confirmed_fact` | 品类边界定义 |
| **S4** | `identityNeeds[]` | → | `confirmed_decision` | **身份认同层判断——这是 S6 的强制引用来源**，每条独立存储 |
| S4 | `functionalNeeds[]` | → | `confirmed_fact` | 功能需求层判断 |
| S4 | `decisionMotive` | → | `confirmed_fact` | 消费决策驱动力 |
| S4 | `userPersona` | → | `confirmed_fact` | 核心用户画像描述 |
| S4 | `consumptionScenario` | → | `confirmed_fact` | 消费场景描述 |
| **S5** | `competitors[].name` + `competitors[].positioning` | → | `confirmed_fact` | 每个竞品的名称和定位，合并为一条 fact |
| S5 | `competitors[].priceRange` | → | `confirmed_fact` | 竞品价格带 |
| S5 | `competitors[].opportunityGap` | → | `hypothesis` | 竞品机会缺口——这是 S6 差异化方向的直接输入 |
| S5 | `competitiveGap.marketOpportunity` | → | `hypothesis` | 跨竞品全局市场空位——S6 的核心引用来源 |
| S5 | `competitiveGap.unmetNeeds[]` | → | `confirmed_fact` | 竞品未满足的消费者需求 |
| S5 | `competitiveLandscape.convergenceAndDivergence` | → | `confirmed_fact` | 品类趋同与分化判断 |
| **S6** | `positioning` | → | `confirmed_decision` | **品牌定位——这是最终战略决策** |
| S6 | `valuePropositions[]` | → | `confirmed_decision` | 三条价值主张各存储为一条 decision |
| S6 | `brandStory.struggleMoment` | → | `confirmed_fact` | 消费者困境（基于前序数据确认） |
| S6 | `brandPersonality[]` | → | `confirmed_decision` | 品牌人格特质 |
| S6 | `reasoning` 三个字段 | → | **不写入 Memory** | reasoning 是引用元数据，不是新事实/决策。Cross Stage Context Check 直接读取 S6 StageRecord |
| **S7** | `visualDirection` | → | `confirmed_decision` | 视觉方向决策 |
| S7 | `visualSystem.logo/concept` | → | `confirmed_decision` | 视觉系统关键决策 |
| **S8** | `contentPillars[]` | → | `confirmed_decision` | 内容支柱策略 |
| S8 | `platformStrategy` | → | `confirmed_decision` | 平台策略决策 |

**通用规则**：
- 所有含 `dataSources` 且 type=full_text 的字段 → evidenceLevel 标注为 `search_backed`
- 所有含 `dataSources` 但仅 type=snippet 的字段 → evidenceLevel 标注为 `search_snippet`
- 无 `dataSources` 的 AI 分析字段 → evidenceLevel 标注为 `ai_inferred`
- 字段值为 `"搜索范围内未找到"` 或空数组 → 不写入 Memory
- `hypothesis` 类型在后续阶段被验证后 → 由对应阶段的 Convergence 升级为 `confirmed_fact`（更新同一条记录）

不包含：
- 聊天记录存储（已有 StageRecord.consultationMessages）
- Cross Stage Context Check（Phase 3）
- 自动提取的 AI 调用（MVP 初版从 Convergence JSON 中按字段映射提取）

**Dependencies**：Task 1.4（StageRecord 存在）

**Acceptance Criteria**：
1. S1 完成后，能从 Convergence 输出中提取 confirmedFacts 并写入 DecisionMemoryEntry
2. 每条记录包含 stageSource 和 confirmedAt
3. Decision Memory 不保存完整聊天消息和 AI 中间推理过程
4. S2 启动 Consultation 时，可读取 S1 的 confirmedFacts 作为 Context

**Testing Strategy**：
- 单元测试：写入 → 读取 DecisionMemoryEntry
- 单元测试：验证不包含非战略资产字段
- 集成测试：S1 完成 → 提取 → S2 Consultation 读取到前序 Context

---

### Phase 1 Checkpoint

**验证动作**：运行 S1 完整流程 — 用户输入品牌名、完成 S1 多轮咨询、Convergence 输出 FounderVision JSON、Decision Memory 正确保存。

**通过标准**：
- FounderVision JSON 包含 founderMotivation、observations、confirmedProblems、constraints
- AI 在 Consultation 中每次只提一个问题
- 输出不是创始人原话的简单复述——observations 中的行为描述具有具体性和可分析性
- Decision Memory 中不包含聊天记录
- 整个流程可重复执行

---

### 共享工具：CLI 测试执行脚本 `scripts/run-stage.ts`

**Purpose**：在完整 UI（Phase 4）就绪之前，提供一个命令行工具来驱动单阶段/多阶段流程。Phase 2-3 的集成测试和 Phase 5 的三案例内容质量测试都依赖此工具。

**设计**：

```
npm run stage -- --project <id> --stage <n> --mode <consult|converge|full>
                                      --input <"用户消息文本" | @file.json>
                                      --output <result.json>
```

- `--mode consult`：发送一条消息到 Consultation → 流式输出 AI 回复到 stdout
- `--mode converge`：触发 Convergence → 输出 JSON 到 stdout 或 `--output` 文件
- `--mode full`：读取 `--input` 指定的 JSON 文件（含模拟多轮对话），自动按序调用 consult → converge，输出完整 StageResult JSON
- `--mode batch`：读取案例文件，自动运行 S1→S8 全流程。**搜索处理**：batch 模式下 AI 产生搜索意图时，自动触发 Search Intelligence Layer（无需用户交互）→ 搜索结果注入 Context → 继续对话。案例文件中可预置 `searchDirectives` 数组指定强制搜索节点（如 S3 市场分析前必须搜索"XX行业市场规模"）

**案例文件格式**（`src/tests/quality/cases/*.json`）：

```json
{
  "brandName": "宠物食品品牌",
  "category": "宠物食品",
  "searchDirectives": {
    "s2": ["宠物食品行业市场规模 趋势", "宠物食品行业政策监管"],
    "s3": ["宠物食品细分品类 增长", "宠物食品用户痛点 未满足需求"],
    "s5": ["竞品A 宠物食品 定位 价格", "竞品B 宠物食品 用户评价"],
    "s8": ["宠物食品 小红书内容趋势", "宠物食品品牌营销案例"]
  },
  "stages": {
    "s1": { "messages": ["用户第一轮回复", "用户第二轮回复", "..."] },
    "s2": { "messages": ["..."] }
  }
}
```

- `searchDirectives` 为可选字段——指定后 batch 模式在进入对应阶段前自动执行搜索，搜索结果注入该阶段 Consultation Context
- 不指定时，AI 在对话中自行判断是否需要搜索（与交互模式行为一致）

**实现文件**：
- `scripts/run-stage.ts` — CLI 入口（使用 `tsx` 直接执行）
- `scripts/case-runner.ts` — 批量案例执行器
- 添加到 `package.json` scripts

**增量构建**：
- Phase 1 完成后立即可用 `--mode consult` 和 `--mode converge`（单阶段手工测试）
- Phase 2 每接入一个阶段，`--mode full` 即可用于该阶段
- Phase 2 完成后 `--mode batch` 可用于 S1→S8 全自动运行

---

## Phase 2：八阶段战略链路

**目标**：按 S1 → S8 逐阶段接入，重点验证 S1-S6 的决策连续性和 Search Intelligence Layer。

**Checkpoint**：从 S1 创始人原话到 S6 品牌定位，推导链是否成立？搜索是否在每个需要外部信息的阶段自动触发且结果正确注入？

### 阶段间自动编排（Stage Orchestrator）

Phase 2 实现轻量版 Orchestrator，负责阶段确认后的自动流转：

```
用户输入「确认」
  ↓
Step 1: Convergence（收束为 JSON）→ 保存 StageRecord
  ↓
Step 2: Decision Memory 提取
  ↓
Step 3: Rule Check（纯代码轻量版：字段完整性 + Schema 完整性）
  ↓
Step 4: Gate Decision = Advance → Workflow 推进到 N+1
  ↓
Step 5: Search Intelligence Layer 自动搜索（Search Intent → Search API → URL Ranking → Web Retrieval）
  ↓
Step 6: AI 先说第一句话（Stage Opening Message，含搜索结果四段式呈现）
  ↓
Step 7: 进入新一轮咨询对话
```

Phase 2 的 Orchestrator 只串联步骤，不带 AI Quality Audit 和 Cross Stage Check。
Phase 3 将 Rule Check 增强为完整 Audit Engine（Rule + AI Quality + Cross Stage），插入 Step 3-4 之间。

每个阶段进入时 AI 自动开口，不等用户先说。S2/S3/S5/S8 的开场白包含搜索发现。
S4/S6/S7 的开场白基于前序阶段 Decision Memory Context 总结。

**Orchestrator 实现归属**：Orchestrator 不作为独立模块，其逻辑分布在以下位置：
| 步骤 | 实现位置 | 所属 Task |
|---|---|---|
| Step 1: Convergence → Save | `src/lib/stage/stage-engine.ts` → `runStage()`（已实现） | Task 1.4 |
| Step 2: Decision Memory 提取 | `src/lib/memory/decision-memory.ts` → `stageExtractors`（已实现） | Task 1.5 |
| Step 3: Rule Check | `src/lib/audit/rule-check.ts` → Phase 2 轻量版（仅字段完整性+Schema完整性） | Task 2.0（Phase 2 版）、Task 3.1（增强版） |
| Step 4: Gate Decision → Advance | `src/lib/workflow/workflow.ts` → `handleGateDecision()`（已实现） | Task 1.3 |
| Step 5: Search（自动） | `src/lib/ai/search.ts` + `search-intent.ts` + `retrieval.ts` + `source-credibility.ts`（新建） | Task 2.0 |
| Step 6: Opening Message | `src/lib/stage/opening-message.ts`（新建）→ 根据阶段+搜索结果+Decision Memory 生成开场白 | Task 2.0 |
| Step 7: 进入咨询 | `src/lib/ai/consultation.ts` → `streamConsultation()`（已实现） | Task 1.4 |
| 串联调度 | `src/lib/stage/stage-engine.ts` → 新增 `advanceToNextStage()` 函数，按序调用以上步骤 | Task 2.0 |

**Opening Message 生成机制**：
- 文件：`src/lib/stage/opening-message.ts`
- 输入：阶段编号 + 品牌名 + 品类 + Decision Memory Context + 搜索结果（S2/S3/S5/S8）
- 输出：首条 AI 消息文本（Markdown 格式，S2/S3/S5/S8 含搜索发现四段式）
- 触发：Orchestrator Step 6 调用 → 结果作为 Consultation 首条 assistant 消息注入对话历史
- 不发起独立 LLM 调用：Opening Message 由 `src/lib/ai/consultation.ts` 的 `streamConsultation()` 生成（作为首条系统指令的特殊响应），与后续咨询共享同一对话上下文

---

### Task 2.0 ★：Search Intelligence Layer（共享基础能力）

**Purpose**：建立 S2/S3/S5/S8 共享的搜索能力层。这是 Phase 2 的第一个 Task，所有需要搜索的阶段都复用此模块。不重复实现。

**架构**：

```
Stage Orchestrator（触发搜索）
    ↓
Search Intent Generator（根据阶段+品牌+品类+Context 生成搜索关键词）
    ↓
Brave Search API（搜索 → 返回 URL + title + snippet）
    ↓
URL Ranking（AI 筛选 Top 3-5：权威性/相关度/数据密度）
    ↓
Web Retrieval Layer
  ├── 第一层：Jina Reader（r.jina.ai → Markdown），超时 10s
  ├── 第二层：fetch + cheerio 提取正文（去导航/广告/脚本）
  └── 第三层：搜索摘要兜底（标注"全文抓取不可用，基于摘要判断"）
    ↓
Source Credibility（四阶段分来源信任权重）
    ↓
Search Context 注入 Consultation system prompt
```

**Implementation Scope**：

新建文件：
- `src/lib/ai/search.ts` — Brave Search API 封装 + 搜索协议接入 + 失败降级
- `src/lib/ai/search-intent.ts` — Search Intent Generator（阶段 → 搜索关键词）
- `src/lib/ai/url-ranking.ts` — URL 排名（权威性/相关度/数据密度 → Top 3-5）
- `src/lib/ai/retrieval.ts` — Web Retrieval Layer（Jina → fetch+cheerio → snippet 三级回退）
- `src/lib/ai/source-credibility.ts` — 分阶段来源信任权重配置
- `src/lib/ai/search-context.ts` — 搜索结果 → Consultation Context 注入器
- `src/lib/ai/prompts/shared-search-protocol.md`（从 reference 复制）

修改文件：
- `src/lib/ai/loader.ts` — 扩展：实现 `includeSearchProtocol` 参数（当前为空壳），需要搜索的阶段（S2/S3/S5/S8）拼接搜索协议 + Search Context。加载 `shared-search-protocol.md` 并注入为 system prompt 附加段落
- `src/lib/stage/stage-engine.ts` — 扩展：新增 `advanceToNextStage()` 函数，串联 Orchestrator 全部步骤（Convergence 后触发 Decision Memory → Rule Check → Gate → 推进 → Search → Opening Message）

**Search Coverage Matrix 驱动**：每个阶段调用搜索时，对照 `shared-search-protocol.md` 各阶段覆盖矩阵。缺哪补哪，未搜到的标注"搜索范围内未找到"。

**自动搜索触发**：由 Stage Orchestrator 在进入新阶段时自动调用。AI 不等用户说"帮我搜一下"——进入 S2/S3/S5/S8 时搜索自动执行。

**来源可信度策略**：

| 阶段 | 高信任来源 | 中等信任来源 | 低信任/不使用 |
|---|---|---|---|
| S2 | 行业报告、政策文件、统计数据 | 媒体报道、行业分析 | 自媒体、个人博客 |
| S3 | 行业报告、第三方监测数据、平台官方报告 | 媒体报道、竞品官网 | 个人推测、论坛 |
| S5 | 品牌官网、电商页面、用户评价原文 | 行业排名、媒体报道 | 营销软文 |
| S8 | 平台趋势报告、品牌官方账号 | 行业案例、第三方分析 | 水军/虚假互动 |

**Dependencies**：Phase 1 完整闭环

**Acceptance Criteria**：
1. Search Intent Generator 根据阶段+品牌+品类正确生成搜索关键词
2. Brave Search API 正确调用并返回结构化结果
3. URL Ranking 正确筛选 Top 3-5 高价值 URL
4. Jina Reader 成功抓取 → fallback → 降级三级回退正常
5. dataSources 区分标注"全文引用"vs"摘要引用"
6. 搜索失败时不阻塞流程（降级提示）
7. S2/S3/S5/S8 进入时可自动触发搜索，结果注入 Consultation Context
8. 搜索覆盖维度检查通过，缺失信息明确标记
9. 不创建 Browser Agent，不引入 LangChain

**Testing Strategy**：
- 单元测试：search.ts / search-intent.ts / url-ranking.ts / retrieval.ts / source-credibility.ts
- 集成测试：搜索触发 → URL Ranking → Web Retrieval → Context 注入 → AI 开场白
- 对照测试：有全文 vs 只有摘要，AI 输出质量应有显著差异

---

### Task 2.1：S2 商业背景分析接入

**Purpose**：接入 Stage 2，将 S1 的原始信息转化为商业背景判断。复用 Task 2.0 的 Search Intelligence Layer。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/business-context.ts` — S2 输出 Schema
- `src/lib/ai/prompts/stage2-consultation.md`、`stage2-converge.md`
- `src/lib/stage/stage-engine.ts` — 扩展：路由到 S2 Prompt 和 Schema

**Opening Message**：AI 先展示搜索发现（行业规模/趋势/政策环境），再引导用户讨论商业背景。格式遵循搜索协议四段式。

**Dependencies**：Task 2.0（Search Intelligence Layer 可用）

**Acceptance Criteria**：
1. S2 Consultation 使用 S1 Decision Memory Context
2. 进入 S2 时自动搜索（覆盖矩阵 8 维度：市场规模/增长趋势/生命周期/政策环境/消费趋势/渠道结构/平台生态/爆品路径）
3. AI 开场白包含搜索结果，不等用户先开口
4. S2 Convergence 输出 BusinessContext JSON
5. 搜索未覆盖维度标注"搜索范围内未找到"

**Testing Strategy**：
- 集成测试：S1→S2 完整链路 → 自动搜索 → AI 开场 → 对话 → Convergence

---

### Task 2.2：S3 市场机会分析接入

**Purpose**：接入 Stage 3，产出市场机会判断。复用 Task 2.0 Search Intelligence Layer（搜索 + Web Retrieval + Source Credibility）。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/market-insights.ts` — S3 输出 Schema（两层结构：搜索数据层 + AI 分析层）
- `src/lib/ai/prompts/stage3-consultation.md`、`stage3-converge.md`
- `src/lib/ai/loader.ts` — 扩展：S3 拼接搜索协议 + 来源可信度 + S1/S2 Decision Memory Context

**Opening Message**：AI 进入 S3 时自动搜索品类规模、增长趋势、渠道结构，开场白先展示搜索发现（市场全景概览），再引导用户讨论品类机会。

**Dependencies**：Task 2.1（S2 完成）、Task 2.0（Search Intelligence Layer）

**Acceptance Criteria**：
1. S3 Convergence 输出 MarketInsights JSON，包含两层结构：
   - **搜索数据层**：marketOverview（marketSize/growthRate/marketStage/channelStructure）、industryTrend（currentTrends/longTermTrends）、channelAnalysis（mainChannels/trafficRules/acquisitionPatterns）、regulatoryEnvironment（policies/risks）、dataSources
   - **AI 分析层**：categoryStatus（definition/currentState/trends）、experienceGaps（gap/currentAlternative/severity）、opportunityDirections（direction/rationale/evidenceLevel）
2. 进入 S3 时自动搜索，AI 开场白包含搜索发现
3. dataSources 区分标注"全文引用"vs"摘要引用"
4. 搜索数据层字段未搜到的标注"搜索范围内未找到"，不编造数据
5. 搜索失败时降级提示，不阻塞流程

**Testing Strategy**：
- 集成测试：S1→S3 完整链路，验证 MarketInsights JSON 两层结构完整
- 对照测试：有 Web Retrieval 全文 vs 只有搜索摘要，市场判断质量应有显著差异

---

### Task 2.3：S4 消费者洞察接入

**Purpose**：接入 Stage 4，产出身份认同层判断——这是 S6 的核心输入。本阶段不依赖搜索，但使用 S3/S5 的搜索数据作为交叉验证材料。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/consumer-insight.ts` — S4 输出 Schema
- `src/lib/ai/prompts/stage4-consultation.md`、`stage4-converge.md`

**Opening Message**：AI 基于前序阶段资产（S1-S3 Decision Memory），引导用户描述目标消费者画像和行为。

**Dependencies**：Task 2.2（S3 完成）

**Acceptance Criteria**：
1. S4 Convergence 输出 ConsumerInsight JSON：userPersona、decisionMotive、functionalNeeds、identityNeeds、behaviorPattern、consumptionScenario
2. identityNeeds 字段必须产出——这是 S6 的强制引用字段
3. 输出完成了"原始信息 → 行为事实 → 洞察"的推导（不直接复述创始人原话）
4. 进入 S4 时 AI 自动开口（基于前序 Context），不等用户先说

**Testing Strategy**：
- 集成测试：S1→S4 链路，验证 S4 正确消费前三阶段输出
- 内容检查：identityNeeds 是否具有战略价值（非空洞标签如"年轻人"）

---

### Task 2.4：S5 竞争判断接入

**Purpose**：接入 Stage 5，产出 competitiveGap + competitors[].opportunityGap——这是 S6 的核心输入。复用 Task 2.0 Search Intelligence Layer。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/competitive.ts` — S5 输出 Schema
- `src/lib/ai/prompts/stage5-consultation.md`、`stage5-converge.md`
- `src/lib/ai/retrieval.ts` — 扩展：S5 竞品采集专用抓取模式（竞品卡片格式化）
- `src/lib/ai/loader.ts` — 扩展：S5 拼接搜索协议（覆盖矩阵 + 竞品卡片格式）+ 来源可信度 + S3/S4 Decision Memory Context

**竞品信息采集四通道**（复用 2.0 Web Retrieval）：

| 采集通道 | 目标内容 |
|---|---|
| 品牌官网 | 品牌定位、产品体系、视觉风格 |
| 电商详情页 | 产品卖点、价格带、用户评价原文 |
| 社媒公开内容 | 小红书/抖音/微博内容 |
| 行业报道 | 市场地位、融资、增长数据 |

**Opening Message**：AI 进入 S5 时自动搜索竞品信息，先展示搜索发现（竞品格局概览），再引导用户讨论竞争判断。

**Dependencies**：Task 2.3（S4 完成）、Task 2.0（Search Intelligence Layer）

**Acceptance Criteria**：
1. S5 Convergence 输出 CompetitiveInsights JSON，包含竞品数据层（competitors[] 完整卡片）+ competitiveGap + competitiveLandscape
2. 至少 3 个竞品填写完整卡片，用户好评/差评含原文摘录（excerpt 字段）
3. competitiveGap 和 competitors[].opportunityGap 字段必须产出（S6 强制引用）
4. 进入 S5 时自动搜索，AI 开场白包含竞品搜索发现
5. opportunityGap 可追溯到具体差评原文或产品缺口

---

### Task 2.5 ★：S6 品牌核心战略接入（战略枢纽验证）

**Purpose**：接入 S6——整个工作流的战略枢纽。这是 Phase 2 的核心验证点。本阶段不依赖搜索，但依赖 S3/S4/S5 的完整结构化输出。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/brand-strategy.ts` — S6 输出 Schema
- `src/lib/ai/prompts/stage6-consultation.md`、`stage6-converge.md`
- `src/lib/ai/loader.ts` — 扩展：S6 Consultation 注入 S4.identityNeeds、S5.competitiveGap 和 S5.competitors[].opportunityGap 作为强制引用约束

**Opening Message**：AI 基于 S1-S5 全部 Decision Memory Context 总结，呈现战略推导的完整图景，引导创始人确认品牌核心方向。本阶段不自动搜索。

**Dependencies**：Task 2.4

**Acceptance Criteria**：
1. S6 Convergence 输出 BrandStrategy JSON：positioning、valuePropositions（functional/emotional/social 三层）、brandStory（struggleMoment/brandAction/brandRelationship）、brandPersonality（trait/dos/donts）、**reasoning**（marketOpportunityReference/consumerInsightReference/competitiveGapReference）
2. `reasoning.marketOpportunityReference` 显式引用 S3 MarketInsights 中具体的市场机会方向或市场缺口判断
3. `reasoning.consumerInsightReference` 显式引用 S4 ConsumerInsight 中具体的身份认同需求
4. `reasoning.competitiveGapReference` 显式引用 S5 CompetitiveInsights 中具体的竞争空位或竞品 opportunityGap
5. S6 定位不是脱离 S1-S5 独立生造的——推导链通过 reasoning 字段可追溯
6. 若 S6 定位与 S4/S5 判断存在矛盾，标记为待验证而非静默忽略
7. 进入 S6 时 AI 自动开口（基于前序资产总结），不等用户先说

**Testing Strategy**：
- 集成测试：S1→S6 完整链路
- **对照测试**：去掉 S4/S5 Context 的 S6 输出 vs 有完整 Context 的 S6 输出，应有显著差异
- 人工检查：S6 `positioning` 的每一句能否通过 `reasoning` 字段追溯到具体前序判断

---

### Task 2.6：S7 视觉策略 + S8 内容规划接入

**Purpose**：接入最后两个执行层阶段，验证视觉策略可追溯到品牌战略，内容策略服务于品牌目标。S8 复用 Task 2.0 Search Intelligence Layer 采集内容趋势和品牌案例。

**Implementation Scope**：

新建/修改文件：
- `src/lib/schemas/visual-strategy.ts`、`src/lib/schemas/content-strategy.ts`
- `src/lib/ai/prompts/stage7-consultation.md`、`stage7-converge.md`
- `src/lib/ai/prompts/stage8-consultation.md`、`stage8-converge.md`

**Opening Message**：S7 基于 S6 战略总结引导视觉方向讨论；S8 先自动搜索内容趋势和平台生态，AI 开场白包含搜索发现。

**Dependencies**：Task 2.5、Task 2.0（S8 复用搜索）

**Acceptance Criteria**：
1. S7 visualDirection 可追溯到 S6.positioning
2. S8 contentPillars 服务于 S6 的品牌目标
3. S7/S8 不做"为设计而设计"、"为内容而内容"
4. 进入 S7 和 S8 时 AI 自动开口，不等用户先说
5. S8 自动搜索内容趋势，dataSources 非空
4. **S8 搜索验证**：S8 Consultation 可触发联网搜索（按搜索覆盖矩阵 Section 二 S8 的 7 个维度），ContentStrategy 的 dataSources 中包含搜索来源引用

**Testing Strategy**：
- 集成测试：S1→S8 完整八阶段链路
- 内容检查：逐条追问 S7/S8 决策"依据来自哪个前序阶段？"
- S8 搜索验证：确认 ContentStrategy JSON 的 dataSources 非空

---

### Phase 2 Checkpoint

**验证动作**：运行 S1→S6 完整流程（至少 2 个案例），收集 S1-S6 全部输出。

**通过标准**：
- **搜索自动触发验证（新增）**：
  - 进入 S2/S3/S5/S8 时，AI 自动搜索，不等用户触发
  - 搜索结果正确注入 Consultation Context
  - AI 开场白包含搜索发现（四段式展示）
- **Stage Orchestrator 验证（新增）**：
  - 用户输入「确认」→ 自动 Convergence → Rule Check → Advance → 搜索 → 开场白
  - 阶段间流转无需手动调用 API
- **Search Intelligence Layer 验证**：
  - S3：至少一次成功抓取行业报告/权威来源全文 → AI 基于正文做市场判断
  - S5：至少 3 个竞品卡片基于官网/电商原文（非搜索摘要）填写
  - dataSources 区分"全文引用"和"摘要引用"
  - 搜索覆盖维度核心字段无遗漏，缺失维度已显式标记
- **S6 推导链验证（核心）**：S6 的 positioning 可通过 `reasoning` 字段逐句追溯到具体前序字段
- 对照测试：有 Context 的 S6 输出 vs 无 Context 的 S6 输出存在显著差异
- 所有阶段的 Schema Validation 通过
- S2-S8 的 AI 开场白（Opening Message）正确触发

### Task 2.7：Knowledge Base 基础设施

**Purpose**：搭建 pgvector 知识库管道——文档向量化、语义检索、种子脚本。MVP 阶段仅建基础设施，不做数据播种（待品牌案例文档准备完成后通过 `seed.ts` 手动导入）。

**Implementation Scope**：

新建文件：
- `src/lib/knowledge/embeddings.ts` — 文档向量化（调用 DeepSeek embedding API → pgvector 存储）
- `src/lib/knowledge/retriever.ts` — 语义检索（hybrid search：向量相似度 + 关键词匹配）
- `src/lib/knowledge/seed.ts` — 知识库播种脚本（读取 `knowledge-docs/` 目录下的 Markdown 文件 → chunk → embedding → 写入 pgvector）
- `src/lib/db/schema.ts` — KnowledgeDoc 表（追加：id, content, embedding, metadata, createdAt）

检索接口：
```typescript
interface KnowledgeRetriever {
  search(query: string, stage: number, topK: number): Promise<KnowledgeDoc[]>
}
```

- Stage Engine Consultation 启动时，根据当前阶段目标检索相关知识库文档 → 注入 Context
- 例如：S6 品牌战略阶段，检索历史品牌案例中的定位方法论文档

不包含：
- 品牌案例文档内容（`knowledge-docs/` 目录为空，待后续手动填充）
- 知识库自动更新/行业数据订阅（未来扩展）
- 用户自定义知识库

**Dependencies**：Task 2.0（Search Intelligence Layer 可用，embedding 和 search 共享 DeepSeek API 适配器）

**Acceptance Criteria**：
1. DeepSeek embedding API 可成功生成向量
2. pgvector 扩展在 Supabase 中正确启用
3. `seed.ts` 可将 Markdown 文档自动 chunk → embedding → 写入 KnowledgeDoc 表
4. `retriever.ts` 可按 query 检索 Top-K 相关文档
5. Stage Engine Consultation 在启动时可注入相关知识库文档作为 Context
6. 无种子数据时（`knowledge-docs/` 为空），检索返回空数组，不阻塞流程

**Testing Strategy**：
- 单元测试：embeddings.ts 生成向量维度正确（DeepSeek 默认 1024 维）
- 单元测试：retriever.ts 空库查询返回空数组
- 集成测试：手动放入 1 篇测试文档 → seed → 语义检索 → 验证召回

---

## Phase 3：Audit Engine

**目标**：实现三组件 Stage Audit Engine。重点验证跨阶段冲突检测能力。

**Checkpoint**：故意在 S2 和 S6 之间制造数据矛盾，Audit Engine 能否发现？

---

### Task 3.1：Rule Check 增强（增强 Phase 2 已有组件）

**Purpose**：在 Phase 2 轻量 Rule Check（字段完整性 + Schema 完整性）基础上，增加逻辑冲突检测和字段间一致性检查。纯代码，不使用 LLM。

**Phase 2 已有**：字段完整性检查、Schema 完整性检查（已集成在 Stage Orchestrator 的 Step 3）。

**Phase 3 新增**：

修改文件：
- `src/lib/audit/rule-check.ts` — 扩展：在 Phase 2 版本上追加逻辑冲突检测
- `src/lib/audit/audit-engine.ts` — Stage Audit Engine 入口（三组件协调）

新增检查项：
1. 基础逻辑冲突（如品牌同时定位"高端奢侈"和"性价比之王"且未解释）
2. 字段间一致性（如 targetAudience 与 userPersona 的年龄范围矛盾）
3. 跨字段矛盾（如 S3 标注"红海衰退期"但 S6 定位"高增长赛道"）

不包含：
- 任何 LLM 调用
- 战略质量判断（AI Quality Audit）
- 跨阶段检查（Cross Stage Context Check）

**Dependencies**：Phase 2（所有 Stage Schema 已定义 + 轻量 Rule Check 已运行）

**Acceptance Criteria**：
1. 在 Phase 2 已有检查基础上，能检测基础逻辑冲突 → RuleIssue
2. 能检测字段间一致性矛盾 → RuleIssue
3. 不误报——不把正常数据差异标记为冲突
4. 代码中不包含 LLM 调用
5. 向后兼容：Phase 2 已有的检查项不受影响

**Testing Strategy**：
- 单元测试：逻辑冲突检测、字段间一致性检测、正常差异不误报
- 回归测试：Phase 2 已有检查项全部通过

---

### Task 3.2：AI Quality Audit 实现

**Purpose**：LLM 驱动的四维质量评估。每阶段不同权重和门禁阈值。

**Implementation Scope**：

新建文件：
- `src/lib/audit/ai-quality.ts` — AI Quality Audit 核心逻辑（LLM 调用）
- 修改 `src/lib/audit/audit-engine.ts` — 加入 AI Quality Audit 组件

四维：Specificity / Differentiation / Evidence / Executability
- S1 权重侧重 Specificity
- S6 权重侧重 Differentiation 和 Evidence

不包含：
- Cross Stage Context Check（Task 3.3）
- Quality Gate 与 Workflow 集成（Task 3.4）

**Dependencies**：Task 3.1

**Acceptance Criteria**：
1. 每次阶段 Convergence 完成后调用 AI Quality Audit
2. 输出四维评分（每维 1-5 分）+ 加权综合分 + 问题列表 + 优化建议
3. 每阶段独立的 Block 阈值和 Reoptimize 阈值
4. AuditResult 正确返回

**Testing Strategy**：
- 单元测试：不同质量输入 → 验证评分差异方向正确
- 集成测试：在 Stage Engine 中插入 Audit → 验证 AuditResult 返回
- 内容测试：用 Phase 2 输出跑 Audit → 评分与人工判断一致性

---

### Task 3.3：Cross Stage Context Check 实现 ★

**Purpose**：Phase 3 的核心。Layer A 纯代码比对跨阶段事实冲突，Layer B 复用 AI Quality Audit 同次调用检测语义断裂。

**Implementation Scope**：

新建/修改文件：
- `src/lib/audit/cross-stage.ts` — 跨阶段检查协调
- 修改 `src/lib/memory/dependency-graph.ts` — **扩展：增加字段级依赖定义**。在现有阶段级 dependsOn 基础上，为 S6 增加字段级引用对：
  ```
  S6.reasoning.marketOpportunityReference → S3.opportunityDirections[].direction
  S6.reasoning.marketOpportunityReference → S3.marketOverview
  S6.reasoning.consumerInsightReference   → S4.identityNeeds[]
  S6.reasoning.competitiveGapReference    → S5.competitiveGap
  S6.reasoning.competitiveGapReference    → S5.competitors[].opportunityGap
  ```
  字段级依赖定义使 Layer A 能精确检查"reasoning 引用的内容是否与前序阶段实际输出一致"，
  而非仅检查阶段级别的宏观一致性
- 修改 `src/lib/audit/ai-quality.ts` — system prompt 末尾按条件追加 Strategic Continuity Check 段落
- 修改 `src/lib/audit/audit-engine.ts` — 加入 Cross Stage Context Check 组件

Layer A（Fact Reference Check，纯代码）：
- 对当前阶段 dependsOn 列表中的每个依赖字段，比对前序阶段值 vs 当前阶段引用
- 只检查字面冲突（S2 品类=宠物食品，S6 品类=美妆 → 冲突）
- 不检查文案差异（"快速增长" vs "高速增长" → 不管）
- **S6 专项检查**：当检查 S6 时，Layer A 额外读取 `reasoning` 字段中的三个引用，
  逐一验证引用的前序字段值是否与 S6 positioning/valuePropositions 中的实际使用一致
  - 例如：`reasoning.marketOpportunityReference` 声称引用 S3.opportunityDirections[0].direction="高端宠物食品市场存在空白"，
    Layer A 验证该字段在 S3 StageRecord 中确实存在且值匹配
  - 如果 S6 reasoning 引用的 S3/S4/S5 字段不存在或值不匹配 → 输出 FactReferenceIssue（severity: error）

Layer B（Strategic Continuity Check，LLM）：
- 触发条件：Rule Check 通过 + AI Audit ≥ Reoptimize 阈值
- 复用 AI Quality Audit 同次调用，作为 system prompt 末尾附加段落
- 检查：推导链连续、上游约束未被忽略、上游洞察未被不当抽象
- 门禁：不单独阻止阶段推进（只作为参考）

**Dependencies**：Task 3.1、3.2

**Acceptance Criteria**：
1. Layer A 能发现 S2 品类=X、S6 品类=Y 的事实冲突
2. Layer A 不把文案差异误判为冲突
3. Layer A 检查范围严格由决策依赖图决定（含 S6 字段级依赖），不基于关键词匹配
4. **S6 reasoning 专项验证**：Layer A 能检测 S6.reasoning 中引用的前序字段是否存在且值匹配；若 reasoning 声称引用了 S3 某字段但该字段实际不存在或内容不符 → 输出 FactReferenceIssue
5. **Layer B 不发起独立的第二次 LLM 调用**（代码审查可验证）
6. Layer B 仅在 Rule + AI Audit 达标时触发
7. Layer B 发现不单独构成门禁

**Testing Strategy**：
- 单元测试 Layer A：构造冲突 → 检测到；构造文案差异 → 不误报
- 集成测试 Layer B：S1→S6 完整流程 → 验证语义断裂检测
- **代码审查**：验证 AI Quality Audit 调用次数 = 阶段数（非 2× 阶段数）

---

### Task 3.4：Quality Gate 增强（增强 Phase 2 已有组件）

**Purpose**：将 Phase 2 的简单 Advance/Block 升级为完整三级 Gate Decision（Advance/Reoptimize/Block），并接入完整 Audit Engine（Rule Check + AI Quality Audit + Cross Stage Check）的联合输出。

**Phase 2 已有**：简单 Advance/Block（基于轻量 Rule Check），已接入 Stage Orchestrator Step 3-4。

**Phase 3 增强**：

修改文件：
- `src/lib/audit/audit-engine.ts` — 三组件协调 → 输出完整 GateDecision（含评分和具体问题）
- `src/lib/stage/stage-engine.ts` — 替换 Phase 2 轻量 Rule Check → 调用完整 Audit Engine
- 在 Orchestrator 流程中：Rule Check → AI Quality Audit → Cross Stage Check → Gate Decision

Gate Decision 规则：
- Block ← Rule Check error 级 / AI Audit < Block 阈值
- Reoptimize ← AI Audit 在 Reoptimize 区间 / Fact Reference Check error 级
- Advance ← 全部通过

**Dependencies**：Task 3.3

**Acceptance Criteria**：
1. 完整 Audit Engine 返回 GateDecision → Orchestrator 正确执行
2. Advance → 允许进入下一阶段（触发搜索→开场白→咨询）
3. Reoptimize → 回到 ACTIVE（AI 优化/手动调整/保持当前）
4. Block → 回到 ACTIVE（必须手动修复，不提供"保持当前"）
5. 审计结果写入 StageRecord.auditResult
6. Phase 2 的简单 Advance/Block 逻辑被完整替代，不共存
7. 评分阈值可配置（不同阶段不同 Block/Reoptimize 门槛）

**Testing Strategy**：
- 单元测试：三组件联合输出的 GateDecision 正确性
- 集成测试：制造不同严重程度的违规 → 验证 Reoptimize vs Block 判断正确
- 集成测试：Reoptimize → 重新 Consultation → 再次 Audit

---

### Phase 3 Checkpoint

**验证动作**：用 Phase 2 输出跑 Audit Engine，并故意制造一个跨阶段矛盾（如修改 S2 的品类定义，让 S6 的品牌定位与 S2 冲突）。

**通过标准**：
- Rule Check 能发现至少一类结构性错误
- AI Quality Audit 四维评分与人工判断偏差 < 1 分
- **Cross Stage Context Check（核心）**：能发现 S2/S6 等关键阶段的引用缺失和事实冲突
- Layer B 不产生独立 LLM 调用（代码审查确认）
- Quality Gate 正确驱动阶段推进/回退

### Task 3.5：Report Engine + Final Audit

**Purpose**：实现 SPEC 3.8 定义的 Report Engine——八阶段输出组装为品牌战略报告。内置全阶段完成后的 Final Audit（全量扫描完整决策依赖图的 Fact Reference Check）。Report Engine 作为独立引擎，Phase 4 的 UI 层只负责展示。

**管线**：

```
全部 8 个阶段 Advanced
        ↓
Final Audit（遍历完整依赖图，仅执行 Layer A Fact Reference Check）
  捕获：后期阶段更新后早期阶段引用断裂 / 用户修改 S3 但 S5/S6 未重跑
  error 级引用缺失 → 暂停报告组装，提示用户处理
        ↓
Report Quality Check（违规检测 + 术语一致性扫描）
  违规检测：绝对化词汇 / 过大词汇 / 第一人称 / 口语连接词 / 访谈痕迹
  未通过 → 重新调用对应阶段 Convergence（仅重生成违规字段），最多 3 次
        ↓
Report Assemble
  八阶段结构化输出 → 七个报告章节 + Decision Memory → 决策依据来源标注
```

**Implementation Scope**：

新建文件：
- `src/lib/report/assemble.ts` — 八阶段输出 + Decision Memory → ReportContent JSON
- `src/lib/report/quality.ts` — 报告质量检查（违规检测 + 术语一致性）
- `src/lib/report/pdf-generate.ts` — @react-pdf/renderer PDF 组件
- `src/lib/report/fonts/` — 中文字体文件（如 Noto Sans SC，需在 PDF 组件中注册）。@react-pdf/renderer 默认不包含中文字体，必须手动注册否则中文渲染为空白
- `src/app/api/project/[id]/report/route.ts` — GET 报告
- `src/app/api/project/[id]/report/assemble/route.ts` — POST 触发组装（含 Final Audit）
- `src/app/api/project/[id]/report/pdf/route.ts` — GET 导出 PDF

不包含：
- 报告 UI 组件（ReportView / ReportChapter / ReportEditor / PdfExport —— Task 4.3）
- 报告在线编辑 API（Task 4.3）

**Dependencies**：Phase 3 Audit Engine 完成（Final Audit 复用 audit-engine 的 Fact Reference Check 逻辑）

**Acceptance Criteria**：
1. 全部 8 阶段 Advanced 后可调用 assemble API 生成 ReportContent
2. ReportContent 包含七个章节，每章标注 sourceStage
3. Final Audit 在组装前自动执行，遍历完整决策依赖图
4. Final Audit 发现 error 级引用缺失时暂停组装，返回问题列表
5. Report Quality Check 正确检测违规词汇（绝对化/过大/第一人称/口语/访谈痕迹）
6. PDF 导出成功（分页、页眉页脚、中文渲染正常）
7. Report Engine 可通过 `run-stage.ts --mode assemble` 独立测试（不依赖 UI）

**Testing Strategy**：
- 单元测试：assemble.ts——Phase 2 八阶段输出 → 验证报告结构
- 单元测试：quality.ts——构造违规文本 → 验证检测
- 集成测试：S1→S8 完整流程 + Final Audit + assemble
- 手动测试：PDF 导出、排版、中文渲染

---

## Phase 4：完整产品体验

**目标**：实现 SPEC 3.9 定义的三页面完整 UI。重点验证状态恢复和完整用户流程。

**Checkpoint**：用户中途关闭浏览器，重新打开后能否恢复到之前的状态继续咨询？

---

### Task 4.1：品牌咨询工作台实现

**Purpose**：实现 SPEC 3.9.3 定义的工作台——三区域布局（阶段导航侧边栏 + 主对话区 + 顶部栏）。

**Implementation Scope**：

新建文件：
- `src/app/project/[id]/page.tsx` — 工作台页面（替换占位页）
- `src/components/workspace/WorkspaceLayout.tsx` — 三区域布局容器
- `src/components/workspace/StageSidebar.tsx` — 阶段导航（S1-S8 + ✓/●/🔒 状态）
- `src/components/workspace/TopBar.tsx` — 顶部栏（品牌名、进度条、返回、报告入口）
- `src/components/workspace/ChatView.tsx` — 主对话容器
- `src/components/workspace/MessageBubble.tsx` — 消息气泡（Markdown 渲染）
- `src/components/workspace/InputArea.tsx` — 输入区（文本 + 附件按钮 + 搜索按钮）
- `src/components/workspace/StageSummary.tsx` — 阶段小结卡片
- `src/components/workspace/SearchResult.tsx` — 搜索发现三段式展示

不包含：
- 审计卡片（Task 4.2）
- 报告页（Task 4.3）
- 文件上传/粘贴（Task 4.4）

**Dependencies**：Phase 3（Audit 可用，工作台需要展示审计结果）

**Acceptance Criteria**：
1. 侧边栏正确显示 S1-S8 状态标识
2. 已完成阶段点击可查看阶段小结（只读），未完成阶段不可进入
3. 对话区正确渲染 Markdown + 搜索结果三段式
4. 顶部栏显示品牌名、当前阶段、进度条
5. 输入区发送消息 → SSE 流式显示回复
6. 用户确认阶段完成后可触发收束
7. **状态恢复**：刷新页面/重新打开浏览器 → 恢复到当前阶段和对话历史
   - **实现方案**：WorkflowState 在每次状态变更时持久化到 StageRecord.status 字段（数据库级别，非 localStorage）
   - **恢复流程**：页面加载 → `GET /api/project/[id]` 返回 `currentStage` + `stageSubState` → 侧边栏定位到正确阶段 → `GET /api/project/[id]/stage/[n]` 回读 `consultationMessages` 渲染对话历史
   - **流式消息中断恢复**：SSE 断开时，已接收的消息片段已写入 StageRecord.consultationMessages，刷新后完整渲染
   - 不使用 localStorage 存储对话内容（数据量大且不可靠），对话历史以数据库为准

**Testing Strategy**：
- 手动端到端测试：完整 S1 流程 UI 交互
- 状态恢复测试：S1 进行中 → 关闭浏览器 → 重新打开 → 验证状态恢复
- 验证 Markdown 渲染（标题、列表、加粗、链接）

---

### Task 4.2：审计卡片 UI 组件

**Purpose**：实现嵌入对话流的审计卡片——Advance / Reoptimize / Block 三态。

**Implementation Scope**：

新建文件：
- `src/components/audit/AdvanceCard.tsx` — ✅ 通过卡片
- `src/components/audit/ReoptimizeCard.tsx` — ⚠ 优化卡片（阶段+跨阶段问题合并）
- `src/components/audit/BlockCard.tsx` — ⛔ 阻断卡片
- `src/components/audit/AuditDetail.tsx` — 审计详情展开层（默认折叠）

按钮："智能优化" / "手动调整" / "保持当前决策"

**Dependencies**：Task 4.1 + Phase 3（Audit Engine 已运行）

**Acceptance Criteria**：
1. Advance 卡片显示简洁通过信息（不展示评分分数）
2. Reoptimize 卡片合并阶段和跨阶段问题，按严重程度排序
3. Block 卡片阻止"保持当前决策"
4. 审计详情默认折叠，点击展开
5. 三个按钮交互正确

**Testing Strategy**：
- 组件测试：三种卡片状态渲染
- 交互测试：Reoptimize → 智能优化 → Stage Engine 重新运行
- 交互测试：Block → "保持当前决策"不可用

---

### Task 4.3：品牌战略报告页 UI

**Purpose**：实现 SPEC 3.9.4 定义的报告页面——八章节折叠阅读、在线编辑。底层的 Report Engine（assemble / quality / pdf-generate / Final Audit）已在 Task 3.5 完成，本 Task 只做表现层。

**Implementation Scope**：

新建文件：
- `src/app/project/[id]/report/page.tsx` — 报告页
- `src/components/report/ReportView.tsx` — 折叠阅读主视图
- `src/components/report/ReportChapter.tsx` — 单章展开/折叠
- `src/components/report/ReportEditor.tsx` — 章节在线编辑器（富文本）
- `src/components/report/PdfExport.tsx` — PDF 导出按钮（调用 Task 3.5 的 pdf-generate API）
- `src/app/api/project/[id]/report/chapter/[n]/route.ts` — PUT 编辑章节

**Dependencies**：Task 4.1（工作台已搭建）、Task 3.5（Report Engine 可用）

**Acceptance Criteria**：
1. 全部 8 阶段完成后，顶部"报告 ↗"按钮高亮可点击
2. 八章节折叠阅读，点击展开查看
3. 每章在线编辑（富文本），保留 AI 原始版本
4. **报告不展示**：四维评分、审计历史、对话过程
5. 点击"导出 PDF"调用 Report Engine API → 下载 PDF
6. 返回工作台修改阶段后，报告可重新组装（version +1）

**Testing Strategy**：
- 组件测试：章节折叠/展开/编辑
- 手动测试：完整报告页 UI 交互 + PDF 下载

---

### Task 4.4：文件上传与图片粘贴

**Purpose**：实现附件上传和图片粘贴能力。

**Implementation Scope**：

新建文件：
- `src/components/upload/FileUploader.tsx` — 拖拽/点击上传
- `src/components/upload/PasteHandler.tsx` — Ctrl+V 粘贴监听
- `src/lib/storage/upload.ts` — Supabase Storage 上传管理
- `src/app/api/upload/route.ts` — POST 文件上传

**Dependencies**：Task 4.1（输入区已搭建）

**Acceptance Criteria**：
1. 拖拽/点击上传 PDF、图片
2. Ctrl+V 粘贴剪贴板图片
3. 上传文件存于 Supabase Storage，对话中正确预览
4. 超限（>10MB）提示，上传失败友好错误提示

**Testing Strategy**：
- 手动测试：上传/粘贴 → 验证存储 → 验证预览
- 组件测试：PasteHandler 事件捕获

---

### Phase 4 Checkpoint

**验证动作**：完成一次完整的用户旅程——创建项目 → S1-S8 咨询（含搜索） → 审计反馈 → 报告查看 → PDF 导出。中途关闭浏览器 → 重新打开 → 验证恢复。

**通过标准**：
- 全流程 UI 操作无报错
- 侧边栏状态 + 对话历史在刷新后正确恢复
- 审计卡片正确嵌入对话流
- 报告页不包含审计元数据
- PDF 导出成功，结构完整

---

## Phase 5：质量验证

**目标**：用三案例测试覆盖内容质量和系统稳定性。

**Checkpoint**：三案例是否达到五维质量门槛？系统在异常场景下是否稳定？

---

### Task 5.1：单元测试覆盖

**Purpose**：覆盖所有核心引擎模块的单元测试。

**Implementation Scope**：

新建文件：
- `src/tests/unit/workflow/` — 状态机、依赖验证
- `src/tests/unit/stage/` — Stage Engine 调用链、normalizer、schema-validator
- `src/tests/unit/audit/` — Rule Check、Fact Reference Check
- `src/tests/unit/memory/` — Decision Memory 读写、依赖图
- `src/tests/unit/report/` — 报告组装、质量检查
- `src/tests/unit/ai/` — Prompt 加载、Provider 切换

框架：Vitest。覆盖率目标：引擎层 >80%，AI 层 >60%。

**Dependencies**：Phase 4（所有模块已实现）

**Acceptance Criteria**：
1. Workflow：所有状态转移 + dependsOn 验证 + 非法跳级
2. Stage：Consultation→Convergence→Normalization→Validation 调用链 + 错误恢复
3. Schema：合法/非法 JSON 校验
4. Audit：Rule Check 各检查项 + Fact Reference Check 冲突/非冲突
5. Memory：读写 DecisionMemoryEntry
6. AI：Prompt 加载、变量替换、Provider 切换

**Testing Strategy**：
- `npm test` 全部通过，CI 集成

---

### Task 5.2：集成测试 + 异常测试覆盖

**Purpose**：覆盖跨模块集成场景和异常恢复。

**Implementation Scope**：

新建文件：
- `src/tests/integration/` — 集成测试

正常场景：
1. S1→S8 完整流程（数据传递 + Decision Memory 消费 + 阶段推进）
2. 中断恢复
3. 回退修改（S3 修改 → S4-S6 依赖更新）
4. Reoptimize 循环

异常场景：
5. LLM 超时 → 重试 + 友好提示
6. Search API 失败 → 降级不阻塞
7. Convergence 格式错误 → 重试 + 标记待人工复核
8. DB 连接失败 → 错误恢复

**Dependencies**：Task 5.1

**Acceptance Criteria**：
- S1→S8 完整流程通过
- 中断恢复通过
- 四种异常场景均有测试且通过

**Testing Strategy**：
- Vitest + MSW 模拟 LLM/Search API
- 异常测试使用 MSW 模拟超时/错误响应

---

### Task 5.3：内容质量测试（三案例）★

**Purpose**：Phase 5 的核心。用三个真实案例验证内容质量是否达到品牌咨询交付标准。

三个测试案例：
1. **案例 A**：宠物食品品牌，已有产品（月销 10 万），需要品牌升级
2. **案例 B**：香薰品牌，产品开发中，需要验证品牌方向
3. **案例 C**：家居品牌，从代工转型自有品牌

五维评审（SPEC 5.2）：战略准确性 / 逻辑连续性 / 洞察深度 / 商业可执行性 / 语言质量

**Implementation Scope**：

新建文件：
- `src/tests/quality/cases/case-a-pet-food.md`
- `src/tests/quality/cases/case-b-aroma.md`
- `src/tests/quality/cases/case-c-home.md`
- `src/tests/quality/evaluation-template.md`

**Dependencies**：Phase 4（全流程可用）

**Acceptance Criteria**：
1. 三个案例均完成 S1→S8 完整流程
2. 任一维度均分 < 3 分 → 该阶段 Prompt 需重新优化
3. 至少 2 个案例全维度均分 ≥ 3.5 分
4. 任一案例出现"0-1 分"维度 → 该维度对应阶段需重新设计
5. AI Brand OS 在"逻辑连续性"维度上明显优于 ChatGPT 单次问答对照

**Testing Strategy**：
- 两人独立人工评审，取均分
- 对照测试：同一案例输入 ChatGPT → 对比"连续推导价值"
- 记录评审结果 → 输出 Prompt 优化建议清单（输入 Phase 6）

---

### Phase 5 Checkpoint

**验证动作**：运行完整测试套件 + 三案例人工评审。

**通过标准**：
- 单元测试全部通过，引擎层覆盖率 >80%
- 集成测试全部通过（含异常场景）
- **至少 2 个案例全维度均分 ≥ 3.5 分**
- 对照测试中连续推导价值明显优于 ChatGPT 对照组
- 输出 Prompt 优化建议清单（>0 条）

---

## Phase 6：成本优化

**目标**：建立 Token 消耗可观测性，实施缓存策略降低重复成本，基于 Phase 5 发现优化 Prompt。

**Checkpoint**：单次八阶段咨询的实际 token 成本是多少？优化后降低了多少？

---

### Task 6.1：Token 消耗追踪与分析

**Purpose**：建立每次 LLM 调用的 token 消耗记录，支持按阶段/按调用类型/按模型维度的成本分析。

**Implementation Scope**：

新建/修改文件：
- `src/lib/db/schema.ts` — TokenConsumption 表（追加）
- 修改 `src/lib/ai/provider/interface.ts` — LLM 调用返回 inputTokens/outputTokens
- 修改 `src/lib/ai/consultation.ts`、`convergence.ts`、`src/lib/audit/ai-quality.ts` — 记录每次消耗
- `src/lib/cost/analysis.ts` — 成本分析工具（按阶段汇总、识别高消耗阶段）

不包含：
- 用户端余额/收费 UI
- 在线支付

**Dependencies**：Phase 5（所有模块稳定）

**Acceptance Criteria**：
1. 每次 LLM 调用写入 TokenConsumption 记录（projectId、stageNumber、callType、modelName、inputTokens、outputTokens）
2. 可按阶段查询 token 消耗汇总
3. 可按调用类型（consultation/convergence/ai_quality_audit）查询消耗分布
4. 能回答"哪个阶段 token 消耗最高？"（识别优化优先级）
5. 能回答"system prompt vs 对话内容的 token 占比？"（识别缓存机会）

**Testing Strategy**：
- 单元测试：模拟调用 → 验证记录正确写入
- 集成测试：完整八阶段流程 → 汇总消耗 → 与 SPEC 预估值对比（偏差 < 50%）
- 手动分析：输出各阶段 token 消耗分布报告

---

### Task 6.2：Prompt Caching 策略

**Purpose**：利用 DeepSeek prompt caching 降低八阶段重复 system prompt 的 input token 成本。

**Implementation Scope**：

修改文件：
- `src/lib/ai/loader.ts` — Prompt 组装时分离 cacheable 部分（system prompt 固定前缀 + 搜索协议）和 dynamic 部分（前序阶段 Context + 对话历史）
- `src/lib/ai/provider/deepseek.ts` — 启用 prompt caching（DeepSeek 自动缓存重复前缀，无需额外 API）

策略：
- 八阶段的 system prompt 公共前缀（角色定义、核心原则、一次一问规则）→ 天然可缓存
- 共享搜索协议 → 在 S2/S3/S5/S8 中可缓存
- Decision Memory Context → 动态部分，不可缓存但体积可控

不包含：
- 自建缓存层（DeepSeek 服务端自动缓存，无需客户端实现）
- 跨 provider 缓存（当前仅 DeepSeek）

**Dependencies**：Task 6.1（有消耗数据才能评估缓存效果）

**Acceptance Criteria**：
1. System prompt 公共部分与动态部分正确分离
2. 缓存启用后，相同 session 内连续阶段调用的 input token 成本降低（通过 TokenConsumption 对比验证）
3. 不影响 Consultation 和 Convergence 的输出质量

**Testing Strategy**：
- A/B 对比：同一案例，缓存启用 vs 不启用 → 对比 TokenConsumption 的 inputTokens
- 质量验证：缓存启用后的输出与不启用时对比，质量无明显下降

---

### Task 6.3：Prompt 优化迭代

**Purpose**：基于 Phase 5 内容质量测试发现的问题，针对性优化消耗高或质量低的阶段 Prompt。

**Implementation Scope**：

修改文件：
- `src/lib/ai/prompts/stage{n}-{consultation|converge}.md` — 针对性修改

优化方向（基于 Phase 5 数据驱动）：
1. **高消耗阶段**（Task 6.1 识别）：精简 system prompt，减少不必要的示例和重复约束
2. **低质量阶段**（Phase 5 评审识别）：调整追问策略、增加具体化约束、强化推导链要求
3. **低效调用**：分析 Consultation 轮次与信息获取效率，优化"一次一问"的追问深度

不包含：
- Prompt 完全重写（只做基于数据的迭代优化）
- 新增 Prompt 类型

**Dependencies**：Task 5.3（内容质量评审结果）、Task 6.1（Token 消耗数据）

**Acceptance Criteria**：
1. 优化后至少 1 个案例在低分维度上提升 ≥ 0.5 分
2. 优化后 token 消耗最高的阶段降低 ≥ 10% input tokens（同等咨询深度下）
3. 优化不引入回归——已有通过案例的评分不下降
4. **强制回归门禁**：Prompt 优化后必须重跑 Phase 5.3 三案例完整 S1→S8 流程
   - 任一案例任一维度评分下降 > 0.3 分 → 回滚该 Prompt 修改，标记为"优化失败"
   - 任一案例全维度均分降至 < 3.5 分 → 回滚全部本批次 Prompt 修改
   - 回归结果记录在 `src/tests/quality/regression-log.md`

**Testing Strategy**：
- 用 Phase 5 三案例重新运行优化后的 Prompt（通过 `npm run stage -- --mode batch`）
- 对比优化前后的五维评分和 token 消耗
- 回归结果写入 `regression-log.md`，作为 Phase 6 Checkpoint 的交付物之一

---

### Phase 6 Checkpoint

**验证动作**：运行完整八阶段流程，收集优化前后的 Token 消耗和内容质量对比数据。

**通过标准**：
- 单次八阶段咨询的完整 token 消耗数据可查询
- 各阶段消耗分布清晰，优化优先级明确
- Prompt caching 使相邻阶段的 system prompt input token 降低
- 至少 1 个阶段的 Prompt 优化产生了可度量的改进（token ↓ 或质量 ↑）
- 优化不引入质量回归

---

## 附录 A：任务依赖图

```
Phase 1: 基础设施 + S1 闭环
  1.1 项目初始化
    ├── 1.2 Project 实体 + 创建页
    └── 1.3 Workflow Engine
          └── 1.4 Stage Engine S1 闭环
                └── 1.5 Decision Memory
                      │
Phase 2: 八阶段战略链路          │
  2.0 ★ Search Intelligence Layer ←┘ [共享基础：S2/S3/S5/S8 的搜索能力由此层提供]
    │                 │
    │   [串行链]       │  [搜索依赖：2.1/2.2/2.4/2.6 各自额外依赖 2.0]
    ▼                 ▼
  2.1 S2 + 搜索 ──→ 2.2 S3 + 搜索 ──→ 2.3 S4（无搜索）──→ 2.4 S5 + 搜索 ──→ 2.5 S6 ★ 战略枢纽 ──→ 2.6 S7 + S8（S8 + 搜索）
    │                 │                 │                 │                 │                      │
    └─── 复用 2.0 ────┘                 │                 └─── 复用 2.0 ────┘                      │
                                        └─── S4 不搜索 ──┘        └─── S6 不搜索 ──┘              └─── S8 复用 2.0 ──┘
                                                      │
  2.7 Knowledge Base ←────────────────────────────────┘ [依赖 2.0，独立于串行链]
    │
Phase 3: Audit Engine + Report    │
  3.1 Rule Check 增强 ←───────────┘ [依赖 Phase 2 所有 Stage Schema]
    └── 3.2 AI Quality Audit
          └── 3.3 Cross Stage ★
                └── 3.4 Quality Gate
                      └── 3.5 Report Engine + Final Audit
                            │
Phase 4: 完整产品体验            │
  4.1 工作台 UI ←────────────────┘
    ├── 4.2 审计卡片
    ├── 4.3 报告页 UI
    └── 4.4 文件上传
          │
Phase 5: 质量验证                │
  5.1 单元测试 ←─────────────────┘
    └── 5.2 集成测试
          │
  5.3 三案例质量测试 ★ ←───────── [依赖 Phase 4 全流程可用，可与 5.1/5.2 并行]
    │
Phase 6: 成本优化                │
  6.1 Token 追踪分析 ←───────────┘ [依赖 Phase 5 模块稳定]
    ├── 6.2 Prompt Caching
    └── 6.3 Prompt 优化（数据驱动）[依赖 5.3 评审结果 + 6.1 消耗数据]
```

★ = 该 Phase 的核心验证任务

**依赖说明**：
- `A ──→ B`：B 依赖 A 完成（串行）
- `A ── B` 同行：A 和 B 同一 Task
- `←` 虚线：跨 Phase 依赖

---

## 附录 B：模块边界红线

| # | 红线 | 来源 |
|---|---|---|
| 1 | Workflow Engine 不调用 LLM | SPEC 3.4 |
| 2 | Decision Memory 不保存聊天记录 | SPEC 3.7 |
| 3 | Strategic Continuity Check 不发起独立 LLM 调用 | SPEC 3.6 |
| 4 | 前端组件不直接调用 AI 层 | SPEC 4.3 |
| 5 | Cross Stage Context Check 只检查依赖图中定义的边上 | Audit PRD 04.A |
| 6 | Audit Engine 不关心当前是哪个阶段——所有阶段使用同一个 Engine | SPEC 3.6 |
| 7 | Report 不展示审计评分和审计历史 | SPEC 3.9.4 |
| 8 | 不提前实现 User 表——userId 保持 null | SPEC 4.5 |

---

## 附录 C：参考文件速查

| 文件 | 路径 | 何时查阅 |
|---|---|---|
| SPEC.md | `D:/brand-intelligence-os/SPEC.md` | 所有实现的总入口 |
| Audit PRD | `reference/strategic-quality-audit-system-prd.md` | Phase 3 实现审计时 |
| 共享搜索协议(已增强) | `reference/shared-search-protocol.md` | Task 2.0（Search Intelligence Layer 核心）+ Task 2.1(S2) + Task 2.2(S3) + Task 2.4(S5) + Task 2.6(S8) |
| 16 个 Prompt 模板 | `reference/stage{n}-{consultation\|converge}.md` | 每个阶段接入时 |
| 架构迁移指南 | `reference/00-architecture-migration-guide.md` | 理解旧→新架构变化 |
| 设计决策日志 | `context/SPEC修改历程与设计决策.md` | 面试准备、设计回溯 |
