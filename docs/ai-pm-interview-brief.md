# AI Brand OS — 面试级项目分析报告

> 生成日期：2026-08-05
> 用途：AI 产品经理 / AI 解决方案 / AI 运营岗位面试准备
> 视角：资深 AI 产品经理面试官 + AI 解决方案架构师

---

## 项目规模速览

| 维度 | 数据 |
|------|------|
| 总代码量 | ~24,600 行 TypeScript（112 个源文件） |
| SPEC 文档 | 1,783 行完整产品规格 |
| 技术栈 | Next.js 14 + React 18 + PostgreSQL + DeepSeek + pgvector |
| 核心模块 | 14 个（workflow / stage / audit / memory / report / search / knowledge / schemas / db / editor / storage / utils / ai / components） |
| 测试/验证脚本 | 40+ 个独立测试脚本 |
| 记忆文档 | 15 篇项目记忆（E2E 测试、Token 优化、Cache 验证等） |

---

### 最重要的 10 个文件/目录及其重要性

| # | 文件/目录 | 重要性 |
|---|----------|--------|
| 1 | `SPEC.md` | 产品圣经：1783行完整产品规格，包含目标、工作流、架构、能力矩阵、成功标准 |
| 2 | `src/lib/stage/stage-engine.ts` | 核心编排器：1300行，协调 Consultation→Convergence→Normalization→Validation→Audit→Save 完整链路 |
| 3 | `src/lib/audit/audit-engine.ts` | 质量保障核心：三组件审计引擎（Rule Check + AI Quality Audit + Cross Stage），决定 advance/reoptimize/block |
| 4 | `src/lib/memory/decision-memory.ts` | 战略资产存储：940行，8个阶段的提取器+证据层级+上下文构建，是跨阶段连续性的关键 |
| 5 | `src/lib/workflow/workflow.ts` | 流程状态机：管理8阶段生命周期，9种状态，依赖检查和影响传播 |
| 6 | `src/lib/db/schema.ts` | 数据模型：6张核心表（project/stageRecord/knowledgeDocument/decisionMemoryEntry/tokenConsumption/stageFieldVersion） |
| 7 | `src/lib/ai/search/` | 搜索增强系统：8个文件，含搜索意图识别→博查API检索→URL排序→内容抓取→上下文注入→来源可信度评估 |
| 8 | `src/lib/schemas/` | 8个Zod Schema定义文件：每个阶段的结构化输出契约，是AI输出稳定性的基础 |
| 9 | `src/lib/report/assemble.ts` | 报告引擎：8阶段输出→9种ReportBlock→结构化品牌战略报告 |
| 10 | `src/lib/ai/provider/interface.ts` | LLM适配器接口：定义统一的Provider接口，支持DeepSeek并可切换到OpenAI/Anthropic |

---

# 第一层：产品理解

## 1. 一句话介绍

> **这是一个「AI原生的品牌战略咨询系统」，面向「0-3年新消费品牌创始人」，解决「缺少系统品牌方法论和连续战略推导能力」的问题，通过「八阶段结构化对话工作流+搜索增强+决策记忆+质量审计」的方式实现「将创始人的零散想法转化为有依据、可执行、可迭代的品牌战略决策」。**

## 2. 目标用户画像

### 用户画像
- **已在市场中的创始人**：有产品、有一定用户和收入，需要升级品牌但请不起咨询公司
- **准备进入市场的创始人**：正在验证品牌想法，需要方向判断
- 覆盖品类：食品、宠物、美妆、香薰、家居、玩具等实体消费品
- **共同特征**：有产品能力，但**没有完整的品牌团队**和**系统的品牌方法论**

### 使用场景
1. 创始人有一个模糊的品牌想法，不知道从何系统化
2. 已经做了产品但"说不清自己的品牌是什么"
3. 想做品牌升级但不知道从哪里切入
4. 想验证自己的品牌假设是否有逻辑支撑

### 用户痛点

| 痛点 | 传统方案为何无法解决 |
|------|-------------------|
| 品牌咨询太贵（数十万起步） | 传统咨询公司人力成本高，无法规模化 |
| ChatGPT只能单次问答 | 无上下文连续性，无法跨阶段推导 |
| 不知道如何系统思考品牌 | 没有结构化方法论引导 |
| 做完战略无法回溯修改 | 咨询报告是静态PDF，改了前面不知道后面影响 |
| 不确定AI输出靠不靠谱 | 没有质量审计和可编辑机制 |

## 3. 核心价值（非功能描述）

**用户为什么需要它？**
- 不是因为"AI能写品牌文案"，而是因为"AI能连续地、结构化地帮你完成品牌战略推导"——这是 ChatGPT 做不到的

**它替代了什么？**
- 替代了"请不起咨询公司→自己摸索→拍脑袋决策"的传统路径
- 不替代创始人的决策权，而是**提供有依据的选项和推导过程**

**它比 ChatGPT/普通软件强在哪里？**
- ChatGPT：单次对话，每次重新开始 → AI Brand OS：8阶段级联推导，前序结论影响后序判断
- 普通管理软件：数据记录工具 → AI Brand OS：AI主动引导咨询对话、搜索增强、质量审计
- 人类咨询顾问：贵、慢、不可规模化 → AI Brand OS：低成本、即时、可反复迭代

## 4. 完整用户流程

```
用户创建项目 → 输入品牌名+品类
        ↓
┌─ S1 用户访谈 ──────────────────────────────────────────────┐
│ 输入：无（冷启动）                                           │
│ AI主动提问（一次一问）→ 收集创始动机、观察、假设、约束          │
│ 用户多轮回答 → 用户确认完成                                   │
│ ↓ Convergence：非结构化对话 → FounderVision JSON             │
│ ↓ Normalization：纯正则修复                                  │
│ ↓ Schema Validation：Zod 校验（失败则重试，最多3次）           │
│ ↓ Stage Audit：Rule Check（字段完整性）                       │
│ ↓ Decision Memory 写入：提取 FounderVision → 战略资产         │
│ ↓ Quality Gate：Advance / Reoptimize / Block                │
│ 输出：FounderVision（原始信息，不做分析）                       │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S2 商业背景分析 ──────────────────────────────────────────┐
│ 输入：FounderVision (S1)                                    │
│ 自动触发：联网搜索行业数据（博查API）                          │
│ 注入：Decision Memory(S1) + Search Context                  │
│ AI 开场：总结已知信息 → 基于搜索发现提出第一个咨询问题          │
│ 用户多轮回答 → 用户确认完成                                   │
│ ↓ Convergence → BusinessContext JSON                       │
│ ↓ Stage Audit：Rule Check + AI Quality Audit（四维评分）      │
│   + Cross Stage Layer A（引用完整性）+ Layer B（语义连贯性）    │
│ ↓ Decision Memory 写入：facts(search_backed)/hypotheses      │
│ ↓ Quality Gate                                              │
│ 输出：BusinessContext（行业环境+核心挑战+战略方向假设）          │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S3 市场机会分析 ──────────────────────────────────────────┐
│ 输入：FounderVision + BusinessContext                       │
│ ⚡ 特殊路径：拆分收敛（Convergence A 搜索数据层 + B AI分析层）  │
│ 自动触发：联网搜索市场规模/趋势/供需数据                       │
│ 注入：Decision Memory(S1-S2) + Search Context              │
│ AI 开场：展示搜索覆盖情况 → 提出咨询问题                       │
│ 用户多轮回答 → 用户确认完成                                   │
│ ↓ Convergence A（搜索数据：市场规模/增长率/趋势/渠道）          │
│ ↓ Convergence B（AI分析：机会方向/体验缺口/品类判断）           │
│ ↓ 合并 → MarketInsights JSON                                │
│ ↓ A/B 各自独立校验（A失败不阻塞B，降级为warning）              │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│ ↓ Decision Memory 写入：facts(search_backed)/hypotheses      │
│ ↓ Quality Gate                                              │
│ 输出：MarketInsights（品类现状+体验缺口+机会方向）              │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S4 消费者洞察 ────────────────────────────────────────────┐
│ 输入：FounderVision + BusinessContext + MarketInsights      │
│ 注入：Decision Memory(S1-S3)                                │
│ AI 开场：总结前序已知 → 提出消费者相关咨询问题                  │
│ 用户多轮回答（用户描述目标消费者行为/场景/现有方案）             │
│ ↓ Convergence → ConsumerInsight JSON                        │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│ ↓ Decision Memory 写入：                                     │
│   - functionalNeed → confirmed_fact                         │
│   - identityNeed → hypothesis（AI推断，非创始人确认）          │
│ ↓ Quality Gate                                              │
│ 输出：ConsumerInsight（目标消费者+深层需求+现有方案不足）        │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S5 竞争判断 ──────────────────────────────────────────────┐
│ 输入：S1-S4 全部 + ConsumerInsight                          │
│ 自动触发：联网搜索竞品信息（品牌/定位/价格/用户评价）           │
│ 注入：Decision Memory(S1-S4) + Search Context              │
│ AI 开场：展示竞品搜索覆盖 → 提出竞争分析问题                   │
│ 用户多轮回答（用户补充竞品认知/差异化优势）                     │
│ ↓ Convergence → CompetitiveInsights JSON                    │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│ ↓ Decision Memory 写入：                                     │
│   - competitors[] → facts(search_backed)                    │
│   - competitiveGap.marketOpportunity → hypothesis（S6强制引用）│
│ ↓ Quality Gate                                              │
│ 输出：CompetitiveInsights（竞品格局+心智空位+竞争机会）         │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S6 品牌核心战略 ⚡战略枢纽 ─────────────────────────────────┐
│ 输入：S1-S5 全部（关键依赖：S4 identityNeed + S5 marketOpportunity）│
│ ⚡ 必须显式引用 S4 身份认同层判断 + S5 心智空位判断               │
│ 注入：Decision Memory(S1-S5)                                │
│ AI 开场：总结前序推导链 → 提出品牌战略核心问题                   │
│ 用户多轮回答 → 用户确认完成                                   │
│ ↓ Convergence → BrandStrategy JSON                          │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│   （严格检查：是否引用了S4/S5的关键判断，是否脱离前序独立生成）     │
│ ↓ Decision Memory 写入：                                     │
│   - positioning/valuePropositions → confirmed_decision       │
│   - brandStory.brandAction → confirmed_decision              │
│ ↓ Quality Gate                                              │
│ 输出：BrandStrategy（定位+价值主张+品牌故事+RTB）              │
│ ↓ 直接影响 S7 视觉方向 + S8 内容策略                          │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S7 视觉策略 ──────────────────────────────────────────────┐
│ 输入：S1-S6 全部 + BrandStrategy                            │
│ ⚡ 视觉风格必须能从 S6 的品牌定位中推导出来，不能凭空生造         │
│ 注入：Decision Memory(S1-S6)                                │
│ AI 开场：基于品牌定位 → 提出视觉方向咨询问题                    │
│ 用户多轮回答（用户分享视觉偏好/参考/禁忌）                      │
│ ↓ Convergence → VisualStrategy JSON                         │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│ ↓ Decision Memory 写入：coreConcept/keywords → decisions     │
│ ↓ Quality Gate                                              │
│ 输出：VisualStrategy（视觉核心概念+关键词+语言系统+视觉禁区）    │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ S8 内容规划 ──────────────────────────────────────────────┐
│ 输入：S1-S7 全部 + VisualStrategy                           │
│ ⚡ 内容方向必须服务于 S6 的品牌目标，不能为内容而内容            │
│ 自动触发：联网搜索（各平台内容趋势参考）                        │
│ 注入：Decision Memory(S1-S7) + Search Context              │
│ AI 开场：基于品牌战略+视觉策略 → 提出内容规划咨询问题            │
│ 用户多轮回答 → 用户确认完成                                   │
│ ↓ Convergence → ContentStrategy JSON                        │
│ ↓ Stage Audit：Rule + AI Quality + Cross Stage              │
│ ↓ Decision Memory 写入：coreDirection/themeDirections        │
│ ↓ Quality Gate                                              │
│ 输出：ContentStrategy（内容核心方向+价值体系+主题方向+渠道策略） │
└────────────────────────────────────────────────────────────┘
        ↓
┌─ 全阶段完成后 ──────────────────────────────────────────────┐
│ Final Audit：遍历完整决策依赖图 → 跨阶段引用完整性检查           │
│ Report Quality Check：去AI痕迹（绝对化词汇/第一人称/访谈痕迹）   │
│ Report Assemble：8阶段JSON → 9种ReportBlock → 结构化报告       │
│ → 网页预览（可在线编辑，useDocumentEditor）                     │
│ → PDF 导出（@react-pdf/renderer）                            │
│ → 用户可回退修改任一阶段 → 下游自动标记 invalidated              │
└────────────────────────────────────────────────────────────┘
```

---

# 第二层：AI 产品设计分析

## 1. AI 能力矩阵

| AI 能力 | 是否需要 AI | AI 带来的核心提升 |
|---------|------------|-----------------|
| **LLM 对话（Consultation）** | 必须 | 理解模糊表达、追问模糊词、根据前序阶段决策调整提问方向——非AI无法做到 |
| **结构化提取（Convergence）** | 必须 | 从非结构化对话中提取 Fact/Inference/Hypothesis 三层信息，传统NLP难以做到这种语义精度 |
| **搜索增强（Search Intent + URL Ranking + Source Credibility）** | 部分需要 | 搜索意图分类和来源可信度评估需要AI语义判断；URL爬取和排序可以纯代码 |
| **AI Quality Audit（四维质量评分）** | 必须 | 评估 Specificity/Differentiation/Evidence/Executability——这是品牌战略领域的专业判断，无法用规则实现 |
| **Cross Stage Semantic Check（Layer B）** | 必须 | 判断前后阶段是否存在语义断裂——需要理解品牌战略逻辑 |
| **Decision Memory（战略资产提取）** | 不需要 | 当前版本用纯代码的确定性提取器（hardcoded field mapping），不是AI提取 |
| **报告生成** | 不需要 | 当前版本用纯函数组装（assemble.ts），9种 ReportBlock 是基于规则映射 |
| **知识库检索（pgvector）** | 不需要 | 向量相似度搜索是纯数学计算 |

### 重要观察

**Decision Memory 的提取用的是确定性规则而非 AI**——这是一个精心的产品决策。每个阶段的结构化 JSON 都有明确的字段路径（如 `founderMotivation.content`），提取器直接按字段路径复制值。这保证了：
- 100% 确定性：同样的 JSON 永远产生同样的 Memory
- 零额外成本：不需额外 LLM 调用
- 可审计：每一条 Memory 都精确对应到一个 JSON 字段

## 2. AI 工作流深度分析

### 输入 → 处理 → 输出链路

```
原始输入（对话历史 + 搜索上下文 + Decision Memory）
        ↓
【Consultation Prompt】
  角色：品牌战略顾问
  规则：一次一问、追问模糊词、内部指令不可见
  Context：前序阶段Decision Memory + 搜索结果
  输出：对话回复（自然语言）
        ↓ （多轮循环，直到用户确认完成）
【Convergence Prompt】
  输入：完整对话历史 + 下一阶段可消费的格式要求
  规则：Fact/Inference/Hypothesis 三层分类
  输出：结构化 JSON（Zod Schema 约束）
        ↓
【Normalization】纯正则修复（括号、引号、破折号）
        ↓
【Schema Validation】Zod .parse()，失败则重试（最多3次）
        ↓
【Stage Audit】Rule Check → Cross Stage → AI Quality Audit
        ↓
【Decision Memory 写入】提取器按字段路径复制到决策库
        ↓
【Quality Gate】Advance / Reoptimize / Block
```

### Prompt 设计哲学

1. **双 Prompt 分离**：Consultation（引导对话）和 Convergence（结构化提取）职责严格分离，避免"边聊天边输出JSON"的冲突
2. **确认总结模板化**：每个阶段的确认总结有严格的模板格式（markdown表格+加粗标题），确保用户体验一致性
3. **一次一问铁律**：每条 AI 回复只能有一个问号，防止信息过载
4. **内部指令不可见**：框架术语不出现在用户对话中——这是用户视角的产品原则

### Context 管理策略

```
System Prompt 构成：
├── 角色设定（品牌战略顾问）
├── 阶段目标说明
├── 行为规则（一次一问、追问模糊词等）
├── Decision Memory Context（前序阶段战略资产，按 confirmed_fact/decision/hypothesis/unresolved 分类）
├── Search Context（仅搜索阶段，含搜索结果摘要+覆盖维度）
├── 退出条件检查清单（仅内部可见）
└── 确认总结模板（仅Convergence阶段）
```

### Memory 设计

这是整个系统最精妙的设计之一。Memory 不是聊天记录仓库，而是**战略资产存储**：

| 类型 | 含义 | 例子 |
|------|------|------|
| `confirmed_fact` | 已确认的事实 | "市场规模约500亿" |
| `confirmed_decision` | 已确认的决策 | "品牌定位为：xxx" |
| `hypothesis` | 待验证假设 | "用户的身份认同需求可能是…" |
| `unresolved_question` | 未解决问题 | "竞品A的用户留存数据未知" |

**证据层级**：`search_backed > search_snippet > ai_inferred`，每个 Memory 条目都标注证据来源，下游阶段可以据此调整引用策略。

### Evaluation 机制

三层质量保障：

1. **Rule Check（纯代码）**：字段完整性、逻辑冲突、字段一致性——确定性规则，零成本
2. **AI Quality Audit（LLM）**：四维评分（Specificity / Differentiation / Evidence / Executability），1-5分量表
3. **Cross Stage Check**：
   - Layer A（纯代码）：引用完整性检查，依赖图驱动
   - Layer B（LLM）：语义连贯性检查，复用在 AI Quality Audit 的同次调用中

---

# 第三层：产品架构分析

## 1. 前端

| 维度 | 选型 |
|------|------|
| 框架 | Next.js 14（App Router） |
| UI | React 18 + Tailwind CSS |
| 页面 | 项目列表 → 对话界面 → 阶段进度 → 报告预览 → PDF导出 |
| 特殊交互 | 可编辑报告（useDocumentEditor hook）、图片粘贴、文件上传 |

## 2. 后端

| 维度 | 选型 |
|------|------|
| API 层 | Next.js API Routes（session/stage/report） |
| 数据库 | Supabase PostgreSQL（含 pgvector） |
| ORM | Drizzle ORM |
| 文件存储 | Supabase Storage |
| 认证 | Supabase Auth（规划中） |

## 3. AI 层

| 维度 | 实现 |
|------|------|
| 模型 | DeepSeek（通过适配器模式，可切换到 OpenAI/Anthropic） |
| Provider 接口 | 统一 LLMProvider 接口：chatStream（流式）/ chat（非流式）/ chatSafe（容错） |
| Prompt 加载 | `loader.ts` 从 `/reference/` 目录动态加载 Consultation/Convergence Prompt |
| Token 追踪 | 全局 token-tracker，按 project/stage/callType 记录每次 LLM 调用的完整用量 |

## 4. 数据层

### 核心表设计

```
project
  ├── name, category, userId, context(jsonb)
  │
  ├── stage_record (1:N, unique(projectId, stageNumber))
  │     ├── consultationMessages(jsonb)
  │     ├── structuredOutput(jsonb)
  │     ├── auditResult(jsonb)
  │     ├── searchContext(text)
  │     ├── version(integer) ← 乐观锁
  │     └── status: draft|active|converging|waiting_confirm|completed|failed|blocked|invalidated|archived
  │
  ├── decision_memory_entry (1:N)
  │     ├── entryType: confirmed_fact|confirmed_decision|hypothesis|unresolved_question
  │     ├── evidenceLevel: search_backed|search_snippet|ai_inferred
  │     ├── fieldPath ← 可追溯到 JSON 字段
  │     └── previousVersionId ← 版本链
  │
  ├── stage_field_version (1:N) ← 字段编辑历史
  │
  ├── token_consumption (1:N) ← 完整 Token 用量记录
  │     ├── cacheCreationTokens, cacheReadTokens, billableTokens
  │     └── experimentGroup ← A/B 实验支持
  │
  └── knowledge_document (1:N) ← 知识库文档+向量
```

### 「体现产品经理技术理解能力的设计」

1. **`invalidated` 状态**：当用户回头修改上游阶段时，下游自动标记为 invalidated，不是删除——这体现了"可回溯编辑"的产品思维
2. **`fieldPath` 可追溯**：每个 Decision Memory 条目都能追溯到原始 JSON 字段路径——这是可审计性的基础设施
3. **`evidenceLevel` 三层证据**：不是简单的"有/无证据"，而是三级分层——决定了 AI 在下游阶段的引用策略
4. **`version` 乐观锁**：每个 stageRecord 有版本号，防止并发编辑冲突
5. **`circuitBreakerTriggered`**：当 AI 审计反复发现 data_gap 问题但搜索无果时，系统自动熔断，引导用户手动补充——这是生产级 AI 产品的关键设计

---

# 第四层：核心技术决策（面试重点）

## 决策 1：为什么不用 LangChain/Agent 框架？

| 维度 | 分析 |
|------|------|
| **背景** | LLM 应用开发通常用 LangChain/LlamaIndex 等框架 |
| **选择** | 完全自研，零框架依赖（只依赖 openai SDK 做 HTTP 调用） |
| **原因** | 品牌战略咨询的流程是**严格线性的 8 阶段工作流**，不是开放式的 Agent 自主决策。LangChain 的 Chain/Agent 抽象对这类固定流程增加复杂度而不增加价值 |
| **代价** | 需要自己实现重试、流式、容错、Token 追踪 |
| **未来** | 如果未来需要"Agent 自主判断是否需要重新搜索"或"多 Agent 交叉验证"，可以考虑引入 |

**面试要点**：这个选择体现了"为场景选择合适的复杂度"而非"追框架热点"

## 决策 2：为什么双 Prompt 分离（Consultation / Convergence）？

| 维度 | 分析 |
|------|------|
| **背景** | 一个 Prompt 既要聊天又要输出 JSON 会互相干扰 |
| **选择** | 严格分离：Consultation 负责对话引导（一次一问），Convergence 负责结构化提取 |
| **原因** | 对话时输出 JSON 会破坏用户体验；收束时需要系统性地扫描完整对话，这是两个完全不同的任务 |
| **代价** | 每个阶段多一次 LLM 调用 |
| **未来** | 已经是成熟方案，无需改变 |

## 决策 3：为什么 S3（市场机会分析）要拆分 Convergence？

| 维度 | 分析 |
|------|------|
| **背景** | S3 既需要搜索数据层（市场规模、趋势等客观数据），又需要 AI 分析层（机会判断、体验缺口等主观分析） |
| **选择** | S3 拆分 Convergence A（搜索数据）+ B（AI 分析），各自独立调用 LLM、独立校验 |
| **原因** | 1) 一个 Prompt 处理两种性质的内容容易混乱；2) A 失败不阻塞 B，容错性更强 |
| **代价** | S3 比其他阶段多一次 LLM 调用 |
| **未来** | 其他包含搜索的阶段（S2/S5）尚未拆分，可以观察效果后决定 |

## 决策 4：为什么 Decision Memory 用确定性提取器而非 AI 提取？

| 维度 | 分析 |
|------|------|
| **背景** | 每个阶段完成后需要将关键战略资产存入 Memory |
| **选择** | 每个阶段硬编码字段映射（如 `founderMotivation.content → confirmed_fact`），不是让 AI 读 JSON 再提取 |
| **原因** | 1) 确定性：不会丢字段；2) 零成本：不额外调用 LLM；3) 可追溯：每个条目精确对应 JSON 字段路径 |
| **代价** | Schema 变动时需要同步更新提取器代码；新增阶段时需要手写提取逻辑 |
| **未来** | 如果 Schema 频繁变动，可以考虑用 AI 辅助生成提取器代码（不是运行时 AI 提取） |

## 决策 5：为什么 Stage Audit 设计为三组件而非单组件？

| 维度 | 分析 |
|------|------|
| **背景** | 需要评估每个阶段的输出质量 |
| **选择** | Rule Check（纯代码）+ AI Quality Audit（LLM）+ Cross Stage Check（代码+LLM混合） |
| **原因** | 纯代码能做的事不让 LLM 做（成本、延迟、不稳定性）；LLM 只做代码做不了的语义判断 |
| **代价** | 三组件协调逻辑复杂，decision merge 需要小心设计 |
| **未来** | 可以增加规则库的丰富度，减少 LLM 调用的频率 |

## 决策 6：为什么设计 `circuitBreaker`（熔断机制）？

| 维度 | 分析 |
|------|------|
| **背景** | reoptimize 时如果问题全是 data_gap（数据缺失），AI 改写无法修复，反复重试浪费 Token |
| **选择** | 当全部问题都是 data_gap + 补充搜索无果 + 无 expression 问题可修复时，触发熔断，引导用户手动补充或接受现状 |
| **原因** | 防止 AI 陷入无效的改写循环——这是一个"知道自己不知道什么"的机制 |
| **代价** | 增加了 reoptimize 流程的复杂度 |
| **未来** | 可以扩展为更细粒度的熔断条件，如按维度分熔断 |

## 决策 7：为什么用 Zod Schema 而非 JSON Schema/TypeScript Interface？

| 维度 | 分析 |
|------|------|
| **背景** | 需要定义每个阶段的结构化输出格式，并做运行时校验 |
| **选择** | Zod（TypeScript-first schema validation library） |
| **原因** | 1) 运行时校验（TypeScript interface 编译后就没了）；2) 提供详细的错误信息用于重试反馈；3) 比 JSON Schema 更简洁 |
| **代价** | 需要学习 Zod DSL |
| **未来** | 可以考虑从 Zod Schema 自动生成 TypeScript 类型和文档 |

## 决策 8：为什么 Prompt Cache 验证花了 4 个 Hypothesis（H1-H4）？

| 维度 | 分析 |
|------|------|
| **背景** | DeepSeek 的 disk cache 可以节省 93-97% input token 费用 |
| **选择** | 分四个 Hypothesis 逐步验证：H1 基础命中 → H2 项目内复用 → H3 质量零影响（Frozen Input A/B对照） → H4 生产环境真实链路验证 |
| **原因** | 缓存可能改变模型行为（deterministic vs non-deterministic），需要从"能不能省"到"省了会不会变差"到"真实场景是否有效"逐层验证 |
| **代价** | 验证成本约 3-5 天工作时间 |
| **未来** | 已经验证完成，H4 结论：跨项目首次调用节省 69.6-76.4%，质量零影响 |

## 决策 9：为什么 Search Context 有 A/B 压缩实验？

| 维度 | 分析 |
|------|------|
| **背景** | 搜索上下文可能很长，注入到 system prompt 中消耗大量 token |
| **选择** | 设计 baseline 模式（原始搜索结果，3000字/来源，15000字上限）vs optimized 模式（压缩摘要，800字/来源，2500字上限）的 A/B 实验 |
| **原因** | 需要量化证明"压缩搜索结果不影响输出质量"才能正式上线 |
| **代价** | 需要设计完整的 A/B 实验框架和数据采集指标 |
| **未来** | 如果压缩不影响质量，可以节省大量 token 成本 |

## 决策 10：为什么不用 Supabase 的 `vector` 原生类型而用 `jsonb` 存 embedding？

| 维度 | 分析 |
|------|------|
| **背景** | pgvector 扩展提供原生 `vector(384)` 类型 |
| **选择** | MVP 阶段用 `jsonb` 存储 embedding（浮点数组），代码注释标注"正式环境替换" |
| **原因** | 减少 MVP 阶段的环境配置复杂度（不用手动 `CREATE EXTENSION vector`），先用 jsonb 跑通流程 |
| **代价** | jsonb 存储的向量检索性能不如原生 vector 类型 |
| **未来** | 正式环境迁移到 `vector(384)` |

---

# 第五层：AI 产品质量与商业价值

## 1. 最大风险分析

| 风险 | 严重程度 | 具体表现 |
|------|---------|---------|
| **幻觉** | 🔴 高 | 市场数据可能编造、竞品信息可能不准确 |
| **输出不稳定** | 🟡 中 | 同一输入可能产生不同的战略建议 |
| **用户不信任** | 🔴 高 | "AI 写的品牌战略靠谱吗？" |
| **成本过高** | 🟡 中 | 完整 8 阶段约 686K tokens |
| **流程完成率低** | 🟡 中 | 8 阶段太长，用户可能中途流失 |
| **搜索数据质量** | 🟡 中 | 博查 API 对某些细分品类覆盖不足 |

## 2. 已有的解决方案

| 风险 | 已有对策 |
|------|---------|
| 幻觉 | 搜索增强（search_backed 标记）、证据层级、`"搜索范围内未找到"` → 拒绝编造 |
| 输出不稳定 | Zod Schema 约束、确认总结模板、AI Quality Audit、Frozen Input A/B 测试 |
| 用户不信任 | 可编辑报告（用户可以手动修正）、推导链可见（Fact/Inference/Hypothesis）、Decision Memory 可追溯 |
| 成本过高 | Prompt Cache（节省 70%+ token）、Search Context 压缩 |
| 流程完成率 | 每阶段自动开场引导、阶段进度可视化 |
| 搜索数据质量 | 搜索意图分类、URL 可信度排序、全文抓取降级为摘要 |

## 3. 商业化需要增加的能力

1. **用户体系**：注册/登录（Supabase Auth 已规划）、项目权限
2. **数据闭环**：用户编辑行为追踪 → 反馈到 Prompt 优化
3. **付费体系**：免费体验 N 个阶段 → 付费解锁完整报告
4. **成本控制**：按套餐限制 Token 用量 / 阶段数
5. **企业部署**：多用户协作、品牌资产管理
6. **行业模板**：为不同品类预设品牌战略模板
7. **效果追踪**：品牌战略执行后的效果反馈（但 SPEC 明确说"不纳入"——这是一个值得讨论的产品决策）

---

# 第六层：面试模拟

## A. 3分钟项目介绍

> "我做的是一个叫 AI Brand OS 的项目——简单说，就是用 AI 帮新消费创业者做品牌战略咨询。
>
> **背景是这样的**：我观察到大量新消费创始人——做食品的、做宠物用品的、做美妆的——他们产品做得很好，但是一到'我这个品牌到底代表什么'这个问题就卡住了。请咨询公司？太贵，几十万起步。用 ChatGPT？每次对话都是独立的，它能给你一个答案，但没法帮你完成从'我是谁'到'我的品牌战略是什么'的连续推导。
>
> **所以我做了这个系统**：它是一个八阶段的品牌咨询工作流。从用户访谈开始，到商业背景分析、市场机会、消费者洞察、竞争判断，再到品牌核心战略、视觉策略、内容规划。每个阶段的结论会系统性地影响下一阶段——这不是八个独立的问题，而是一条推导链。
>
> **AI 的创新点在哪？** 三个关键设计：第一，我们不直接给答案，而是引导创始人自己推导——AI 一次只问一个问题，帮创始人把模糊的想法变清晰。第二，每个阶段的输出都要经过三层质量审计——结构检查、AI质量评分、跨阶段一致性检查——不通过就退回重做。第三，有一个叫 Decision Memory 的东西，只保存真正影响决策的战略资产，不是聊天记录——后续阶段引用前序决策时，能看到这个判断的来源和证据强度。
>
> **验证结果**：我们做了完整的 E2E 测试，5个真实品牌案例跑通了 S1 到 S8 的全链路。Token 消耗基线是 686K。通过 Prompt Cache，跨项目首次调用能节省 70%+ 的 token 费用，而且我们通过 A/B 对照实验验证了缓存不影响输出质量。
>
> **未来的方向**：一是把搜索上下文做智能压缩，进一步降低 token 成本；二是增加用户反馈闭环，让编辑行为反向优化 Prompt；三是考虑商业化——免费体验前几个阶段，付费解锁完整报告。"

## B. 20个高频追问

### Level 1：基础理解

**Q1: "这个项目到底是做什么的？"**
- 面试官意图：测试你是否能用一句话说清楚
- 优秀回答：先给一句话定义（参考第一层），然后给一个具体场景例子

**Q2: "和用 ChatGPT 聊品牌有什么区别？"**
- 面试官意图：测试你是否理解 AI 产品的差异化
- 优秀回答：三个维度——连续性（8阶段级联 vs 单次对话）、结构化（JSON Schema vs 纯文本）、质量保障（Audit vs 无校验）

**Q3: "用户为什么不用模板/问卷自己做？"**
- 面试官意图：测试你是否理解"AI vs 传统工具"的本质差异
- 优秀回答：模板只能填空，无法追问模糊表达、无法根据回答调整下一个问题、无法帮你发现"你没想到的问题"

**Q4: "一个典型的用户使用流程是怎样的？"**
- 面试官意图：测试你是否理解用户体验
- 优秀回答：从创建项目到获取 PDF 报告的完整路径，包括搜索、对话、确认、审计、报告

**Q5: "目前项目到了什么阶段？"**
- 面试官意图：判断你对项目成熟度的认知
- 优秀回答：MVP 已完成，通过了 5 个真实品牌案例的 E2E 测试，Token 基线和 Cache 验证已完成

### Level 2：产品设计

**Q6: "为什么设计成8个阶段？不是6个也不是10个？"**
- 面试官意图：测试你做产品决策的依据
- 优秀回答：这是基于品牌战略方法论的标准框架（从外部环境→用户→竞争→战略→执行），每个阶段有明确的输入输出和上下游依赖。不是随意切分的

**Q7: "用户在中途退出怎么办？"**
- 面试官意图：测试你是否考虑过用户体验的完整性
- 优秀回答：每个阶段的输出都持久化了，用户可以随时回来继续。但确实需要增加"断点续传"的显式引导和进度可视化

**Q8: "如果 AI 输出的品牌战略和创始人的直觉冲突怎么办？"**
- 面试官意图：测试你是否理解"AI辅助决策"的边界
- 优秀回答：这是设计哲学的核心——AI 提供选项和推导过程，决策权始终在创始人。系统设计了可编辑报告机制，用户可以修改任何 AI 输出。同时，修改上游阶段会自动触发下游的失效标记

**Q9: "你怎么衡量这个产品是否成功？"**
- 面试官意图：测试你是否定义了成功标准
- 优秀回答：SPEC 中定义了四个核心度量——流程完成率、决策增量（用户获得了之前没有的判断）、使用意愿（愿意用于实际品牌建设）、付费意愿

**Q10: "这个产品最大的设计缺陷是什么？"**
- 面试官意图：测试你的批判性思维
- 优秀回答：8 阶段对用户来说可能太长。但目前的策略是先做完整再优化，通过 E2E 验证确认了推导链的完整性后，再考虑是否合并/缩短某些阶段

### Level 3：AI 架构

**Q11: "为什么不用 LangChain？"**
- 面试官意图：测试你的技术决策能力
- 优秀回答：参考决策 1

**Q12: "如何保证 AI 输出的一致性？"**
- 面试官意图：测试你对 AI 产品稳定性的理解
- 优秀回答：四层保障——Zod Schema 约束结构、确认总结模板约束格式、AI Quality Audit 评估质量、Frozen Input A/B 测试验证一致性

**Q13: "Decision Memory 和普通对话历史有什么区别？"**
- 面试官意图：测试你是否理解 Memory 的设计哲学
- 优秀回答：对话历史是所有原始信息的存储，Decision Memory 是提炼后的战略资产。Memory 只存四类内容（facts/decisions/hypotheses/questions），有证据层级、有字段路径可追溯、有版本链——这些对话历史都不需要

**Q14: "688K tokens 跑完一个品牌，这个成本你怎么看？"**
- 面试官意图：测试你对 AI 成本的理解
- 优秀回答：按 DeepSeek 的价格，约 7 毛钱（人民币）。但这是 API 成本，不代表用户价值——品牌咨询的市场价格是数十万。同时，通过 Prompt Cache 已节省 70%，Search Context 压缩还在进行中

**Q15: "为什么 S6 叫战略枢纽？"**
- 面试官意图：测试你是否理解产品架构的核心设计
- 优秀回答：S6 是承上启下的关键节点——必须显式引用 S4 的消费者身份认同层判断和 S5 的竞争心智空位判断，不能脱离前序分析独立生成定位。同时 S6 的定位直接决定 S7 的视觉方向和 S8 的内容策略

### Level 4：压力面试

**Q16: "如果 DeepSeek 挂了，你的产品怎么办？"**
- 面试官意图：测试容灾意识
- 优秀回答：已设计 LLM Provider 适配器模式，接口抽象了 chat/chatStream/chatSafe 三个方法，理论上可切换到 OpenAI/Anthropic。但切换需要重新测试 Prompt 兼容性——不同模型对同一 Prompt 的响应质量不同

**Q17: "你怎么证明这个 AI 输出的质量比竞品好？"**
- 面试官意图：测试评估方法论
- 优秀回答：我们做了系统的质量评估——AI Quality Audit 四维评分、Cross Stage 一致性检查、Frozen Input A/B 对照实验（H3）、生产环境真实链路验证（H4）。但需要承认：目前缺少"与人类咨询顾问输出的对比评估"

**Q18: "如果用户说 'AI 写的品牌战略没有灵魂'，你怎么回应？"**
- 面试官意图：测试产品价值观
- 优秀回答：系统设计的核心原则是"帮用户做选择"而不是"替用户给答案"。创始人始终掌握决策权。如果用户觉得没有灵魂，可能是因为 AI 的表达能力有限——这正是设计"可编辑报告"和"确认总结模板"的原因：AI 提供骨架，创始人注入灵魂

**Q19: "这个项目技术含量在哪？不就是调 API 吗？"**
- 面试官意图：压力测试你的价值认知
- 优秀回答：调 API 不难，难的是——1) 让 8 个阶段的推导形成闭环的工程架构（状态机、依赖图、影响传播）；2) AI 输出质量的系统性保障（三层审计+熔断+重试）；3) 上下文管理（Decision Memory + Search Context 的预算控制）；4) 成本和质量的平衡（Prompt Cache + Search Context 压缩的验证方法论）

**Q20: "给你 100 万预算和 3 个月，你会做什么？"**
- 面试官意图：测试产品方向判断和优先级
- 优秀回答：1) 用户反馈闭环（编辑行为 → Prompt 优化），2) 搜索上下文智能压缩上线（降低 50% token 成本），3) 行业模板化（不同品类的预设 Prompt），4) 付费体系和用户系统，5) 10 个品牌的一对一深度用户测试

---

# 第七层：项目岗位匹配

## 1. AI 产品经理

| 维度 | 评价 |
|------|------|
| **匹配点** | 完整的产品思维（SPEC.md 1783行）、用户导向设计（一次一问、内部指令不可见）、质量保障体系设计、A/B 实验框架、E2E 测试方法、成本优化意识 |
| **缺口** | 缺少真实用户反馈数据、缺少竞品分析、缺少商业模式设计 |
| **面试关键词** | "从用户痛点到完整产品闭环"、"AI 输出质量的可控性设计"、"成本-质量权衡" |

## 2. AI 解决方案工程师

| 维度 | 评价 |
|------|------|
| **匹配点** | 完整的工程架构（14 个模块、20+ 技术决策）、LLM 适配器模式、多阶段工作流引擎、三层审计系统、Prompt 工程、Token 追踪、Cache 验证、A/B 实验 |
| **缺口** | 缺少容器化部署、缺少 CI/CD、缺少监控告警 |
| **面试关键词** | "为场景选择复杂度"、"确定性规则 + AI 判断的分层架构"、"Prompt Cache 验证方法论" |

## 3. AI 运营/增长岗位

| 维度 | 评价 |
|------|------|
| **匹配点** | 成本数据完善（Token 追踪精确到每次调用）、E2E 测试框架可转化为运营数据体系、可编辑报告的反馈闭环思路 |
| **缺口** | 没有真实用户运营数据、没有增长实验、没有留存/转化漏斗 |
| **面试关键词** | "用户行为数据采集设计"、"从 E2E 测试到运营指标"、"成本基线建立方法论" |

## 4. AI 应用创业方向

| 维度 | 评价 |
|------|------|
| **匹配点** | 清晰的 PMF 假设（新消费创始人×品牌战略咨询）、完整的 MVP 验证体系、可规模化的 AI 架构、清晰的竞争壁垒（连续推导+质量审计不是套壳） |
| **缺口** | 没有 GTM 策略、没有定价模型、没有真实用户验证 |
| **面试关键词** | "AI-native 不是套壳"、"咨询服务的 AI 化"、"从服务一个人到服务一万人的架构设计" |

---

## 总结：这个项目在面试中最强的三个故事

1. **"从模糊想法到结构化战略的完整 AI 工作流"** — 讲述 8 阶段级联推导、Decision Memory、Cross Stage Check 如何形成闭环
2. **"三层质量审计系统"** — 讲述 Rule Check + AI Quality Audit + Cross Stage Check 如何在成本和可靠性之间取得平衡
3. **"Prompt Cache 验证方法论"** — 讲述从 H1 到 H4 四个假设逐步验证，用 Frozen Input A/B 对照排除 confound，最终证明节省 70% token 且质量零影响——这体现了 AI 产品经理最稀缺的能力：知道如何"证明"AI 的能力
