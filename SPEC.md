# Brand Intelligence OS — 规格文档

> 版本：MVP v1.0
> 最后更新：2026-07-31
> 状态：Spec 完成，待进入实现阶段

---

## 1. 目标（Objectives）

### 1.1 产品要解决什么问题

新消费品牌创始人（0-3 年）缺少系统的品牌战略方法。他们的痛点不是"找不到信息"，
而是**不知道如何在不确定中做品牌决策**——不知道自己的品牌应该代表什么、
为什么用户会选择自己、如何把零散想法整理成可执行的品牌战略。

传统品牌咨询成本太高（数十万起步），而普通 AI（ChatGPT 等）只能提供
单次问答，无法提供**连续的战略推导**：每次对话独立，前一轮的分析无法
系统性地影响后一轮的判断。

### 1.2 目标用户

0-3 年新消费品牌创始人，覆盖食品、宠物、美妆、香薰、家居、玩具等实体消费品类。

包含两类：
- **已在市场中的创始人**：有产品、有一定用户和收入，需要升级品牌
- **准备进入市场的创始人**：正在验证品牌想法，需要方向判断

共同特征：有产品能力，但**没有完整的品牌团队**和**系统的品牌方法论**。

### 1.3 核心区别：AI Brand OS vs 普通 AI 工具

| 维度 | 普通 ChatGPT | AI Brand OS |
|---|---|---|
| 交互模式 | 单次问答，无上下文连续性 | 八阶段连续对话，上下文跨阶段传递 |
| 推导链路 | 直接给出建议，无推导过程 | 商业背景 → 市场 → 消费者 → 竞争 → 战略，环环相扣 |
| 输出产物 | 文本建议 | 有推导过程、有决策依据的结构化品牌战略报告 |
| 决策角色 | 替用户"给答案" | 帮用户"做选择"——推演方向、提出选项，决策权归创始人 |
| 可迭代性 | 每次重新提问 | 平台保留完整推导过程，可回溯修改任一阶段 |

**一句话定义**：AI Brand OS 是一个面向新消费创业者的 AI 原生品牌战略伙伴，
通过连续的品牌咨询流程，将创始人的零散想法转化为有依据、可执行、可迭代的品牌战略决策。

### 1.4 MVP 验证目标

验证一个核心假设：**AI 是否能够通过结构化品牌咨询流程，帮助创业者完成
从模糊想法到清晰品牌战略的推导，并提供普通 ChatGPT 无法提供的"连续战略推导价值"。**

### 1.5 MVP 成功标准

**正向信号（表明方向正确）：**
- 用户完成主要流程后，明确认为自己对品牌方向更清晰（定位、目标用户、差异化方向）
- 用户获得的判断是"之前没有的"——不是已有认知的复述
- 用户愿意把输出结果用于后续设计、内容或产品决策
- 用户主动询问"怎么付费"

**负向信号（表明需要调整）：**
- 用户觉得"AI 写得挺专业，但没帮到我做选择"——输出和普通 ChatGPT 拉不开差距
- 用户在早期阶段大量流失，流程长度成为障碍
- AI 输出"看起来都对"但缺乏有依据的战略判断——只是信息总结而非决策支持

**核心度量：**
- 流程完成率：完成全部 8 个阶段的用户比例
- 决策增量：用户自评"获得了之前没有的判断"的比例
- 使用意愿：愿意把报告用于实际品牌建设的比例
- 付费意愿：完成体验后询问付费的比例

---

## 2. 核心工作流结构（Core Workflow）

### 2.1 八阶段概述

产品采用八阶段品牌咨询工作流。每个阶段包含两类 Prompt：**Consultation Prompt**
（多轮咨询，收集信息、引导思考）和 **Convergence Prompt**（收束总结，输出结构化数据）。

| 阶段 | 名称 | 职责 | 输出类型 | 对应报告章节 |
|---|---|---|---|---|
| S1 | 用户访谈 | 收集创始人原始诉求、动机、观察、假设 | FounderVision（原始信息） | 无独立章节 |
| S2 | 商业背景分析 | 行业环境判断、创业动机分析、战略挑战定义 | BusinessContext | 01 品牌背景与战略方向 |
| S3 | 市场机会分析 | 品类规模、趋势、供需缺口、细分机会 | MarketInsights | 02 市场机会 |
| S4 | 消费者洞察 | 决策动机、行为模式、功能层+身份认同层需求 | ConsumerInsight | 03 消费者洞察 |
| S5 | 竞争判断 | 竞品定位、市场格局、心智空位 | CompetitiveInsights | 04 竞争判断 |
| S6 | 品牌核心战略 | 品牌定位、价值主张、品牌故事、RTB（战略枢纽） | BrandStrategy | 05 品牌核心战略 |
| S7 | 视觉策略 | 视觉方向、设计原则、风格建议 | VisualStrategy | 06 视觉策略 |
| S8 | 内容规划 | 内容策略、内容方向、内容资产体系 | ContentStrategy | 07 内容策略 |

### 2.2 双 Prompt 体系

每个阶段包含两类独立 Prompt，职责严格分离：

**Consultation Prompt（阶段咨询）：**
- 根据当前阶段目标向用户提问（一次一问）
- 收集必要信息，引导用户完成思考
- 结合上下文和搜索结果进行分析
- 引导用户进入"确认总结"环节
- **不直接生成最终阶段结果**

**Convergence Prompt（阶段收束）：**
- 读取该阶段完整对话记录
- 提取关键事实、洞察和决策（Fact / Inference / Hypothesis 三层分类）
- 输出结构化 JSON
- 语言标准（域风格指南）已内嵌
- 生成下一阶段可消费的输入

**调用时序**：Consultation（多轮对话 → 用户确认总结）→ 触发 Convergence（单次调用 →
输出结构化 JSON）→ 进入下一阶段 Consultation。

### 2.3 阶段间数据流

```
S1 用户访谈
  输出: FounderVision（原始信息，不做分析）
        ↓
S2 商业背景分析
  输入: FounderVision
  输出: BusinessContext
        ↓
S3 市场机会分析
  输入: FounderVision + BusinessContext
  输出: MarketInsights
        ↓
S4 消费者洞察
  输入: FounderVision + BusinessContext + MarketInsights
  输出: ConsumerInsight
        ↓
S5 竞争判断
  输入: 以上全部 + ConsumerInsight
  输出: CompetitiveInsights
        ↓
S6 品牌核心战略（战略枢纽）
  输入: 以上全部
  输出: BrandStrategy
        ↓
S7 视觉策略
  输入: 以上全部 + BrandStrategy
  输出: VisualStrategy
        ↓
S8 内容规划
  输入: 以上全部 + VisualStrategy
  输出: ContentStrategy
```

### 2.4 S6 品牌核心战略——战略枢纽

S6 是整个工作流的核心承转节点：

**承接 S1-S5：**
- 必须显式引用 S4 消费者洞察中的**身份认同层判断**
- 必须显式引用 S5 竞争判断中的**心智空位判断**
- 不能脱离 S2-S5 的分析独立生造定位
- 如 S6 推导出的定位与 S4/S5 的判断矛盾，必须标记为待验证

**影响 S7-S8：**
- S6 的品牌定位和价值主张直接决定 S7 的视觉方向选择
- S6 的品牌故事和 RTB 直接决定 S8 的内容策略
- S7 的视觉风格必须能从 S6 的品牌定位中推导出来，不能凭空生造
- S8 的内容方向必须服务于 S6 的品牌目标，不能为内容而内容

### 2.5 核心原则

以下原则贯穿全部 8 个阶段，从旧版继承并验证有效：

- **一次一问**：每条回复只能有一个"？"
- **内部指令不可见**：框架术语、退出条件、检查清单不出现在对话中
- **信息证据分层**：Fact / Inference / Hypothesis 三层严格区分
- **追问模糊词**：遇到"好看""专业""年轻人"等模糊词必须追问，两次追问后仍模糊则标记为待验证
- **退出机制表格 + 退出模板 + JSON 输出**三段式结构

MVP 阶段新增原则：

- **禁止跳级引用原始口述**：分析类阶段（S2、S4、S5、S6）不能直接把创始人原话
  作为战略结论呈现，必须完成"原始信息 → 行为事实 → 洞察 → 结论"的推导链
- **上游核心判断作为下游强制输入**：每个阶段必须显式引用前序阶段的特定判断，
  不能脱离上游独立生成

---

## 3. 系统架构（System Architecture）

### 3.1 能力矩阵（MVP vs 未来扩展）

#### 外部服务依赖

| 能力 | 用途 | MVP 状态 | 说明 |
|---|---|---|---|
| LLM API（DeepSeek） | Consultation 对话推理 + Convergence 结构化提取 + AI Quality Audit | **必须** | 核心引擎；适配器模式下可切换至 OpenAI/Anthropic |
| 联网检索（博查 Web Search） | 市场数据、竞品信息、行业趋势获取（S2/S3/S5/S8） | **必须** | 国内节点部署，响应快速，兼容 Bing 格式 |
| 数据库（Supabase PostgreSQL） | Session / StageRecord / DecisionMemoryEntry / Report 持久化 | **必须** | 免费层 500MB，含 pgvector |
| 文件存储（Supabase Storage） | 用户上传的 PDF、图片、文档 | **必须** | 免费层 50MB |
| 向量检索（pgvector） | 知识库语义检索 | **必须** | Supabase 免费层内置 |
| 认证（Supabase Auth） | 用户登录/注册 | **必须** | 免费层 50,000 MAU |
| PDF 导出（@react-pdf/renderer） | 品牌战略报告 → PDF 下载 | **必须** | 纯客户端渲染，开源 |

#### 系统级能力

| 能力 | 用途 | MVP 状态 | 说明 |
|---|---|---|---|
| Workflow Engine | 阶段状态机、阶段路由、依赖关系管理 | **必须** | 控制"允许用户做什么" |
| Stage Engine | 单阶段完整流程协调（Consultation → Audit → Save） | **必须** | 封装 16 个 Prompt 的调用链路 |
| Stage Audit Engine（三组件） | Rule Check + AI Quality Audit + Cross Stage Context Check | **必须** | 每个阶段完成时运行 |
| Decision Memory | 战略资产存储（confirmedFacts/decisions/hypotheses/unresolvedQuestions） | **必须** | 不是聊天记录仓库 |
| 决策依赖图 | 跨阶段检查范围定义（dependsOn 关系） | **必须** | 无依赖图 = 无跨阶段检查依据 |
| Report Engine | 八阶段输出组装 + 报告质量检查 + PDF 导出 | **必须** | 全阶段完成后由 Workflow Engine 触发 |
| 知识库（手动播种） | 品牌案例、方法论文档向量化存储 | **必须** | MVP 手动播种，不做自动更新 |
| 多 Agent 协作 | 并行分析、交叉验证 | **未来扩展** | MVP 为单 Agent 线性推进 |
| 知识库自动更新 | 行业数据订阅、案例库自动扩充 | **未来扩展** | MVP 手动维护 |
| 电商/社媒 API 接入 | 数据同步、实时监控 | **不纳入** | 长期也不做 |
| 自动 A/B 测试 / 效果归因 | 品牌方案效果追踪 | **不纳入** | 品牌决策工具，不是广告投放工具 |

### 3.2 MVP 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                       前端（Web UI）                          │
│  对话界面 + 附件上传 + 图片粘贴 + 联网搜索                       │
│  阶段进度 + 阶段小结卡片 + 报告预览 + 在线编辑 + PDF导出         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      API 层（路由）                            │
│  session route  │  stage route  │  report route               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Workflow Engine                            │
│                                                               │
│  只回答一个问题："现在系统允许用户做什么？"                       │
│                                                               │
│  负责：当前阶段状态 │ 阶段生命周期 │ 阶段进入条件 │ 阶段依赖关系    │
│  不负责：AI 调用 │ 内容质量判断 │ 决策内容生成 │ 审计              │
│                                                               │
│  workflow.ts — 阶段状态机 & 阶段路由                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Stage Engine                              │
│                                                               │
│  负责执行单个阶段的完整流程:                                     │
│                                                               │
│  Stage Consultation → Stage Convergence → Output Normalization │
│      → Schema Validation → Stage Audit → Decision Memory Save  │
│                                                               │
│  stage-engine.ts — 单阶段执行协调器                              │
│  consultation.ts — Consultation Prompt 调用管理                 │
│  convergence.ts — Convergence Prompt 调用管理                   │
│  normalizer.ts  — 输出标准化（原 cleaner.ts 的机械修复部分）      │
│  schema-validator.ts — Zod Schema 校验 & 重试控制               │
│  search.ts      — 联网检索（遵循搜索协议）                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Stage Audit Engine                          │
│                                                               │
│  每个阶段完成时触发，三个组件按序运行:                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Rule Check（纯代码比对）                             │    │
│  │    阶段结构检查 │ 必填字段检查 │ Schema 完整性检查         │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 2. AI Quality Audit（LLM 调用）                        │    │
│  │    四维质量评估: Specificity │ Differentiation │         │    │
│  │    Evidence │ Executability                            │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 3. Cross Stage Context Check                           │    │
│  │    Layer A: Fact Reference Check（纯代码比对）           │    │
│  │      检查前后阶段关键事实是否冲突，不调用 LLM              │    │
│  │    Layer B: Strategic Continuity Check（LLM 辅助）       │    │
│  │      仅在 Rule + AI Audit 达标后触发                     │    │
│  │      复用 AI Quality Audit 同一次调用，不发起独立请求      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  输出 → Quality Gate Decision: Advance / Reoptimize / Block   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Decision Memory                             │
│                                                               │
│  保存影响未来阶段的战略资产，不是聊天记录仓库:                      │
│                                                               │
│  confirmedFacts │ confirmedDecisions │ hypotheses │             │
│  unresolvedQuestions                                           │
│                                                               │
│  不保存：每轮聊天 │ 临时 AI 建议 │ 未确认内容                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Report Engine                              │
│                                                               │
│  report-assemble.ts — 八阶段输出 → 品牌战略报告                  │
│  report-quality.ts  — 输出质量检测（原 cleaner.ts 的违规检测部分）│
│  pdf-generate.ts    — @react-pdf/renderer PDF 导出             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     外部服务                                   │
│  LLM API (DeepSeek) │ Search API (博查) │ Supabase (DB/Auth) │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 数据处理管线

#### 单阶段处理管线（每个阶段完成时）

```
Stage Consultation（多轮对话，一次一问）
        ↓ 用户确认阶段完成
Stage Convergence（结构化提取 + 语言标准内嵌）
        ↓ 输出原始 JSON
Output Normalization（原 cleaner.ts 机械修复层——纯正则，无损）
  ├── 括号/引号/破折号/感叹号/省略号自动修复
  └── 不在此层做语义判断
        ↓
Schema Validation（Zod .parse()）
  通过 → 进入 Audit
  失败 → 重新调用 Convergence（仅重生成违规字段），最多 3 次
  3 次未通过 → 标记待人工复核，不阻塞流程
        ↓
Stage Audit Engine ──────────────────────┐
  ├── Rule Check（纯代码）                 │
  │   阶段结构 / 必填字段 / Schema 完整性    │
  │                                      │
  ├── AI Quality Audit（LLM 调用）         │
  │   四维质量评估                          │
  │                                      │
  └── Cross Stage Context Check           │
       ├── Fact Reference Check（纯代码）   │
       │   有依赖即触发，不等质量达标          │
       └── Strategic Continuity Check      │
           Rule + AI 达标才触发             │
           复用 AI Quality Audit 同次调用   │
  ───────────────────────────────────────┘
        ↓
Quality Gate Decision：Advance / Reoptimize / Block
        ↓
Decision Memory 写入
  confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions
        ↓
Workflow Advance（可进入下一阶段）
```

#### 全阶段完成后的补充管线

```
全部 8 个阶段完成
        ↓
Final Audit（遍历完整决策依赖图）
  仅执行 Fact Reference Check —— 捕获：
  - 后期阶段更新后，早期阶段引用路径断裂
  - 用户回头修改了 S3 的决策，但 S5/S6 未重新运行
        ↓
Report Quality Check（原 cleaner.ts 违规检测层 + 术语一致性扫描）
  违规检测：绝对化词汇 / 过大词汇 / 第一人称 / 口语连接词 / 访谈痕迹
  未通过 → 重新调用对应阶段 Convergence（仅重生成违规字段），最多 3 次
  3 次未通过 → 标记待人工复核
        ↓
Report Assemble → 网页报告 + PDF 导出
```

#### 与旧管线的关键区别

| 旧设计 | 新设计 |
|---|---|
| consultation / convergence 直接暴露给 workflow | Stage Engine 封装完整单阶段流程 |
| cleaner.ts 包揽机械修复 + 语义检测 | 拆分为 normalizer.ts（机械修复）+ report-quality.ts（违规检测） |
| 跨阶段检查在全部阶段结束后统一扫描 | 跨阶段检查在每个阶段完成时运行一次 + 全阶段结束后补充扫描一次 |
| decision-memory 保存对话记录 | Decision Memory 只保存战略资产（confirmedFacts/decisions/hypotheses/unresolvedQuestions） |
| 质量检查与流程引擎耦合 | Stage Audit Engine 独立组件，通过 Quality Gate 与 Workflow 交互 |

### 3.4 Workflow Engine 详细设计

#### 职责边界（铁律）

Workflow Engine **只回答一个问题**："现在系统允许用户做什么？"

| 负责 | 不负责 |
|---|---|
| 当前处于哪个阶段（S1-S8） | AI 调用（交给 Stage Engine） |
| 阶段生命周期（in_progress → converged → audited → advanced） | 内容质量判断（交给 Stage Audit Engine） |
| 阶段进入条件（前序阶段是否 Advanced） | 决策内容生成（交给 Stage Engine） |
| 阶段依赖关系（dependsOn 链） | 审计逻辑（交给 Stage Audit Engine） |
| 下一阶段路由 | 报告生成（交给 Report Engine） |
| Quality Gate 结果后的流程调度 | 用户权限（交给 Auth 层） |

**Workflow 不做的事**：它不调用 LLM、不读取阶段输出内容、不判断战略质量。
它只根据 Quality Gate 的输出（Advance/Reoptimize/Block）执行状态转移。

#### 状态机

```
                     ┌──────────┐
           START →   │ INACTIVE │
                     └─────┬────┘
                           │ 用户进入阶段
                     ┌─────▼────┐
                     │  ACTIVE  │ ← Consultation 进行中
                     └─────┬────┘
                           │ 用户确认完成
                     ┌─────▼──────┐
                     │ CONVERGING │ ← Convergence 执行中
                     └─────┬──────┘
                           │ Convergence 完成
                     ┌─────▼──────┐
                     │  AUDITING  │ ← Stage Audit Engine 运行中
                     └─────┬──────┘
                           │ Quality Gate 判断
              ┌────────────┼────────────┐
              ↓            ↓            ↓
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ ADVANCED │ │REOPTIMIZE│ │ BLOCKED  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │            │
             ↓             ↓            ↓
       进入下一阶段   重新 ACTIVE    返回 ACTIVE
                   （AI 优化/手动） （必须手动修复）
```

#### 接口定义

```typescript
interface WorkflowState {
  sessionId: string
  currentStage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  stageStatus: 'inactive' | 'active' | 'converging' | 'auditing' | 'advanced' | 'reoptimizing' | 'blocked'
  completedStages: number[]           // 已通过审计的阶段列表
  dependsOn: number[]                 // 当前阶段的依赖阶段列表
  canAdvance: boolean                 // Quality Gate 通过为 true
}

interface WorkflowEngine {
  getCurrentState(sessionId: string): Promise<WorkflowState>
  canEnterStage(sessionId: string, stage: number): boolean
  handleGateDecision(sessionId: string, decision: GateDecision): Promise<void>
  advanceToNextStage(sessionId: string): Promise<void>
  getStageDependencies(stage: number): number[]
}
```

---

### 3.5 Stage Engine 详细设计

#### 定位

Stage Engine 执行**单个阶段**的完整流程。它不是 consultation / convergence 的简单封装——
它负责协调 Consultation → Convergence → Normalization → Validation → Audit → Save 的完整链路。

#### 单阶段执行流程

```
Stage Engine.execute(stage N)
│
├── 1. Consultation（多轮对话，一次一问）
│     读取前序阶段的 Decision Memory → 拼装 Context → 启动 Consultation Prompt
│     用户多轮交互 → 用户确认阶段完成
│
├── 2. Convergence（单次调用）
│     读取完整对话记录 → 调用 Convergence Prompt → 输出结构化 JSON
│
├── 3. Output Normalization（纯正则）
│     括号/引号/破折号修复 → 输出标准化的 JSON 字符串
│
├── 4. Schema Validation（Zod .parse()）
│     通过 → 继续
│     失败 → 重试 Convergence（仅重生成违规字段），最多 3 次
│
├── 5. Stage Audit（调用 Stage Audit Engine）
│     Rule Check → AI Quality Audit → Cross Stage Context Check
│     返回 Quality Gate Decision + Audit Report
│
├── 6. Decision Memory 写入
│     提取：confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions
│     写入决策记忆库
│
└── 7. 返回结果给 Workflow Engine
      Gate Decision: Advance / Reoptimize / Block
```

#### 接口定义

```typescript
interface StageResult {
  stageNumber: number
  consultationMessages: Message[]
  convergenceOutput: StageOutput                // Zod 校验后的结构化输出
  auditResult: AuditResult
  gateDecision: 'advance' | 'reoptimize' | 'block'
  decisionMemoryDelta: DecisionMemoryEntry[]     // 本阶段新增的战略资产
}

interface StageEngine {
  execute(sessionId: string, stage: number): Promise<StageResult>
  reoptimize(sessionId: string, stage: number, feedback: AuditFeedback): Promise<StageResult>
  getContext(sessionId: string, stage: number): Promise<StageContext>
}
```

#### 不负责的事项

- ❌ 阶段间依赖判断（Workflow Engine 管）
- ❌ 全局流程控制（Workflow Engine 管）
- ❌ 报告生成（Report Engine 管）
- ❌ 用户权限（Auth 层管）

---

### 3.6 Stage Audit Engine 详细设计

#### 定位

Stage Audit Engine 在每个阶段完成时运行。它不关心当前是哪个阶段——
所有 8 个阶段使用同一个 Engine，但每个阶段的评分权重和门禁阈值不同
（参见 `strategic-quality-audit-system-prd.md` 第 05 章）。

#### 三组件架构

```
┌─────────────────────────────────────────────────────┐
│                Stage Audit Engine                     │
│                                                       │
│  输入: StageOutput + DecisionMemory（前序阶段）         │
│  输出: AuditResult + GateDecision                     │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │ 1. Rule Check（纯代码，不调用 LLM）             │     │
│  │                                              │     │
│  │  阶段结构完整性                                │     │
│  │  必填字段非空                                  │     │
│  │  Schema 完整性（与 Zod Schema 不同的逻辑检查）   │     │
│  │  字段间基础逻辑冲突（如"高端"+"低价"同时出现）    │     │
│  │                                              │     │
│  │  输出: RuleCheckResult { issues: RuleIssue[] }│     │
│  └────────────────────┬────────────────────────┘     │
│                       │                               │
│  ┌────────────────────▼────────────────────────┐     │
│  │ 2. AI Quality Audit（LLM 调用）               │     │
│  │                                              │     │
│  │  四维质量评估:                                 │     │
│  │    Specificity    — 是否具体到场景/人群/行为    │     │
│  │    Differentiation — 是否形成独特判断          │     │
│  │    Evidence       — 是否有合理依据            │     │
│  │    Executability  — 是否指导下一步行动         │     │
│  │                                              │     │
│  │  每个维度 1-5 分，按阶段权重加权                │     │
│  │                                              │     │
│  │  输出: AIQualityResult { scores, issues,      │     │
│  │         crossStageContinuity? }   ← 可选字段   │     │
│  └────────────────────┬────────────────────────┘     │
│                       │                               │
│  ┌────────────────────▼────────────────────────┐     │
│  │ 3. Cross Stage Context Check                │     │
│  │                                              │     │
│  │  Layer A: Fact Reference Check（纯代码）       │     │
│  │    触发: 只要当前阶段在依赖图中存在 dependsOn     │     │
│  │    检查: 前后阶段关键事实是否字面冲突             │     │
│  │    例如: S2 确认品类=宠物食品，S6 却说美妆         │     │
│  │    不检查: 文案表达差异、普通语言变化             │     │
│  │    输出: crossStageReferenceIssues            │     │
│  │                                              │     │
│  │  Layer B: Strategic Continuity Check（LLM）   │     │
│  │    触发条件（两个必须同时满足）:                  │     │
│  │      ① Rule Check 通过（无 error）              │     │
│  │      ② AI Quality Audit 达到 Reoptimize 门槛+  │     │
│  │    调用方式:                                   │     │
│  │      复用 AI Quality Audit 同一次 LLM 调用       │     │
│  │      作为 AI Quality Audit system prompt 的     │     │
│  │      可选附加段落，不发起第二次独立 LLM 调用       │     │
│  │    检查: 推导链是否连续，战略是否有依据地演进      │     │
│  │    输出: crossStageFindings（仅作参考）          │     │
│  │    门禁: 不单独阻止阶段推进                      │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
│  Gate Decision 规则:                                  │
│    Block     ← Rule Check 发现核心字段缺失/逻辑错误      │
│    Block     ← AI Audit 评分 < Block 阈值              │
│    Reoptimize ← AI Audit 评分在 Reoptimize 区间         │
│    Reoptimize ← Fact Reference Check 发现 error 级冲突 │
│    Advance   ← 全部通过                                │
│    (Strategic Continuity findings 不单独构成门禁)       │
└─────────────────────────────────────────────────────┘
```

#### Cross Stage Context Check 检查范围

**严格由决策依赖图决定**。不根据关键词匹配或独立规则来判断"是否该检查"。

具体依赖图定义参见 `strategic-quality-audit-system-prd.md` 第 04.A 章。
检查范围 = 当前阶段 `dependsOn` 列表中的每一条边。

**Fact Reference Check 检查什么：**
- S2 确认品类 = X，S6 品牌定位却说品类 = Y → **冲突**
- S4 确认用户画像 = 一线城市年轻女性，S6 目标受众却说 = 中年男性 → **冲突**
- S3 确认市场规模 = 100 亿，S5 竞品分析引用的市场规模 = 500 亿，且未解释差异来源 → **冲突**

**Fact Reference Check 不检查什么：**
- "S3 的措辞是 '快速增长'，S6 的措辞是 '高速增长'" → 文案差异，不管
- "S4 说用户在意价格，S6 说用户对价格敏感" → 同义表达，不管
- "AI 认为 S6 的差异化不够强" → 战略质量判断，交给 AI Quality Audit，不属于 Fact Reference Check

#### 接口定义

```typescript
interface StageAuditEngine {
  audit(stageOutput: StageOutput, decisionMemory: DecisionMemory, stage: number): Promise<AuditResult>
}

interface AuditResult {
  ruleCheck: RuleCheckResult
  aiQuality: AIQualityResult
  crossStageContext: {
    referenceIssues: ReferenceIssue[]     // Layer A 输出
    continuityFindings?: ContinuityFinding[] // Layer B 输出（可选）
  }
  gateDecision: 'advance' | 'reoptimize' | 'block'
  compositeScore: number                  // 加权综合分
}
```

---

### 3.7 Decision Memory 详细设计

#### 定位

Decision Memory 不是聊天记录仓库。它是**影响未来阶段的战略资产存储**。

#### 数据边界（铁律）

| 保存 | 不保存 |
|---|---|
| confirmedFacts — 用户确认过的事实（如"品牌品类=宠物食品""当前月销=10万"） | 每轮聊天消息 |
| confirmedDecisions — 用户确认过的决策（如"目标受众=一线城市年轻养宠女性"） | 临时 AI 建议（用户未确认的） |
| hypotheses — 用户提出但未验证的假设 | 未确认内容 |
| unresolvedQuestions — 阶段结束时仍未解决的关键问题 | AI 中间推理过程 |
| 每条记录的 stageSource（来源阶段）和 confirmedAt（确认时间） | — |

#### 数据结构

```typescript
interface DecisionMemory {
  sessionId: string
  entries: DecisionMemoryEntry[]
}

type DecisionMemoryEntry =
  | ConfirmedFact
  | ConfirmedDecision
  | Hypothesis
  | UnresolvedQuestion

interface ConfirmedFact {
  type: 'confirmed_fact'
  id: string
  field: string                    // 对应阶段 Schema 中的字段路径，如 "businessContext.category"
  value: string                    // 确认的事实值
  stageSource: number              // 来源阶段
  confirmedAt: string              // ISO timestamp
  evidenceLevel: 1 | 2 | 3 | 4    // 参见 Evidence Framework
}

interface ConfirmedDecision {
  type: 'confirmed_decision'
  id: string
  field: string                    // 如 "brandStrategy.positioning"
  value: string
  rationale: string                // 为什么做这个决策
  dependedBy: number[]             // 哪些后续阶段依赖此决策
  stageSource: number
  confirmedAt: string
}

interface Hypothesis {
  type: 'hypothesis'
  id: string
  description: string
  proposedBy: number               // 哪个阶段提出的
  validationStatus: 'unverified' | 'partially_validated' | 'rejected'
  stageSource: number
}

interface UnresolvedQuestion {
  type: 'unresolved_question'
  id: string
  question: string
  raisedInStage: number
  blockingStage: number | null     // null = 不阻塞任何阶段，非 null = 阻塞特定阶段
}
```

#### Decision Memory 的消费方式

- **Stage Engine 在启动 Consultation 时**：读取前序阶段的 `confirmedFacts` + `confirmedDecisions`，
  作为 Context 注入 Consultation system prompt，保证 AI "知道"之前确认了什么
- **Cross Stage Context Check 的 Fact Reference Check**：遍历 dependsOn 列表，
  比对当前阶段输出与 Decision Memory 中前序阶段的 confirmedFacts/confirmedDecisions
- **Report Engine**：读取完整 Decision Memory，在报告中标注"关键决策依据来源"

---

### 3.8 Report Engine 详细设计

#### 定位

Report Engine 负责将八个阶段的输出 + Decision Memory 组装为最终品牌战略报告。

#### 管线

```
全部 8 个阶段 Advanced
        ↓
Final Audit（遍历完整依赖图，Fact Reference Check）
        ↓
Report Quality Check
  ├── 违规检测: 绝对化词汇 / 过大词汇 / 第一人称 / 口语连接词 / 访谈痕迹
  └── 跨章节术语一致性扫描
        ↓
Report Assemble
  ├── 8 个阶段结构化输出 → 七个报告章节
  ├── Decision Memory → 报告中标注决策依据来源
  └── 输出: 网页版报告（可编辑）
        ↓
PDF Export（@react-pdf/renderer）
```

#### 接口定义

```typescript
interface ReportEngine {
  assemble(sessionId: string): Promise<Report>
  generatePdf(report: Report): Promise<Buffer>
  qualityCheck(report: Report): Promise<QualityCheckResult>
}
```

---

### 3.9 前端页面架构（三页面设计）

AI Brand OS 的 MVP 前端由三个页面组成，分别对应品牌咨询的三个阶段：
创建 → 咨询 → 交付。

#### 3.9.1 页面总览

```
┌──────────────────────────────────────────────────────────────┐
│                        页面路由                                │
│                                                               │
│  /                           → 项目创建页（首次入口）            │
│  /project/[id]               → 品牌咨询工作台（核心页面）         │
│  /project/[id]/report        → 品牌战略报告页（交付物）           │
└──────────────────────────────────────────────────────────────┘
```

| 页面 | 路由 | 目标 | 用户问题 |
|---|---|---|---|
| **项目创建页** | `/` | 创建品牌咨询项目 | "我要开始做品牌咨询" |
| **品牌咨询工作台** | `/project/[id]` | 完成八阶段品牌咨询流程 | "帮我理清品牌战略" |
| **品牌战略报告页** | `/project/[id]/report` | 查看/编辑/导出最终报告 | "我的品牌方案是什么" |

---

#### 3.9.2 页面 1：项目创建页（Brand Project Entry）

**定位**：用户进入 AI Brand OS 的第一步。

**设计原则**：
- 极简——不要求填写复杂表单，品牌咨询的核心信息在 S1 对话中收集
- 低摩擦——用户输入品牌名 + 选择品类方向即可开始
- 不做注册/登录——MVP 直接进入，Project 记录在本地/匿名会话中

**界面结构**：

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              AI Brand OS                              │
│        面向新消费创业者的品牌战略伙伴                      │
│                                                      │
│         ┌────────────────────────────────┐           │
│         │  我的品牌叫                     │           │
│         │  [________________]            │           │
│         │                                │           │
│         │  我们主要做                     │           │
│         │  [________________]            │           │
│         │  （品类/方向，可选）              │           │
│         │                                │           │
│         │  ┌────────────────────────┐    │           │
│         │  │     开始品牌咨询     →  │    │           │
│         │  └────────────────────────┘    │           │
│         └────────────────────────────────┘           │
│                                                      │
│         已有项目？继续之前的咨询 →                       │
│         • 宠物食品品牌 · 上次: 7月30日                  │
│         • 香薰品牌 · 上次: 7月28日                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**关键交互**：
- 品牌名称为必填，品类方向为可选（可在 S1 对话中自然引出）
- 点击"开始品牌咨询"→ 创建 Project 记录 → 跳转 `/project/[id]` → 自动开启 S1 Consultation
- 下方列表展示本地已有的历史 Project（localStorage/Supabase），支持恢复未完成的咨询
- 不做注册/登录强要求，但后端 Project 记录预留 `userId` 字段

---

#### 3.9.3 页面 2：品牌咨询工作台（Brand Workspace）

**定位**：八阶段品牌咨询流程的核心交互页面。这是整个 AI Brand OS 的"主战场"。

**设计原则**：
- 阶段导航始终可见，但不抢占对话注意力
- AI 对话是主要交互方式（一次一问）
- 审计结果以卡片形式嵌入对话流，不打断咨询节奏
- 每个阶段结束时展示结构化总结卡片

**界面结构**：

```
┌──────────────────────────────────────────────────────────────────┐
│  顶部栏                                                           │
│  [← 返回]  宠物食品品牌  ·  S3 市场机会分析  ·  [进度: ▮▮▮▯▯▯▯▯]  [报告 ↗] │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                    │
│  阶段导航     │              主对话区                               │
│  (侧边栏)    │                                                    │
│              │  ┌────────────────────────────────────────────┐   │
│  ✓ S1 用户访谈│  │ AI: 根据你之前的描述，宠物食品行业有几个      │   │
│              │  │ 关键趋势值得关注...                           │   │
│  ✓ S2 商业背景│  │                                             │   │
│              │  │ 【搜索发现】                                  │   │
│  ● S3 市场机会│  │ 名称: 中国宠物食品市场趋势 2024               │   │
│    当前阶段   │  │ 关键信息: 年复合增长率 18%，高端化趋势明显    │   │
│              │  │ 来源: 艾瑞咨询                                │   │
│    S4 消费者  │  │                                             │   │
│    S5 竞争    │  │ 【可信度判断】                                │   │
│    S6 品牌战略│  │ 已确认: ... 待验证: ...                       │   │
│    S7 视觉    │  │                                             │   │
│    S8 内容    │  │ 【对本阶段分析的影响】                         │   │
│              │  │ 支持了你之前提到的"高端化机会"判断              │   │
│              │  └────────────────────────────────────────────┘   │
│              │                                                    │
│              │  ┌────────────────────────────────────────────┐   │
│              │  │ ⚠ 阶段建议优化                              │   │
│              │  │ 1. 市场机会范围较宽                          │   │
│              │  │ 2. 未引用 S2 确认的商业模式约束               │   │
│              │  │ [智能优化] [手动调整] [保持当前决策]           │   │
│              │  └────────────────────────────────────────────┘   │
│              │                                                    │
│              │  ┌────────────────────────────────────────────┐   │
│              │  │ 📋 S3 阶段小结                               │   │
│              │  │ 市场规模: 中国宠物食品 540 亿元（2024）       │   │
│              │  │ 关键机会: 功能性细分（肠道健康/毛发护理）     │   │
│              │  │ 待验证: 二三线城市高端粮渗透率               │   │
│              │  └────────────────────────────────────────────┘   │
│              │                                                    │
│              │  ┌────────────────────────────────────────────┐   │
│              │  │ 💬 输入框                          📎 🔍    │   │
│              │  └────────────────────────────────────────────┘   │
└──────────────┴───────────────────────────────────────────────────┘
```

**核心区域说明**：

| 区域 | 位置 | 内容 |
|---|---|---|
| **阶段导航侧边栏** | 左侧固定 | S1-S8 列表，已完成 ✓ / 当前 ● / 未开放 🔒 状态标识 |
| **主对话区** | 中央滚动区 | AI 对话消息（Markdown 渲染）、搜索发现三段式展示、文件/图片预览 |
| **审计卡片** | 对话流内嵌 | Advance / Reoptimize / Block 三态卡片，跨阶段问题与阶段问题合并展示 |
| **阶段小结卡片** | 阶段结束时 | 该阶段关键结论的结构化摘要，可折叠 |
| **顶部栏** | 顶部固定 | 品牌名、当前阶段、进度条、返回按钮、报告入口 |
| **输入区** | 底部固定 | 文本输入、附件上传按钮、联网搜索按钮 |

**阶段导航侧边栏详细交互**：

```
S1 用户访谈            ← 点击可查看已完成阶段的小结
  └─ ✓ 已通过         状态标签

S2 商业背景分析
  └─ ✓ 已通过

S3 市场机会分析
  └─ ● 进行中         当前阶段，高亮

S4 消费者洞察
  └─ 🔒 待解锁        依赖 S3 完成

S5 / S6 / S7 / S8 同 S4
```

- 已完成阶段：点击 → 在主对话区顶部展示该阶段小结卡片（只读回顾）
- 当前阶段：高亮，侧边栏显示进度动画
- 未解锁阶段：灰色，hover 提示"请先完成 X 阶段"
- 不展示分数——状态标识已经传达了必要信息

---

#### 3.9.4 页面 3：品牌战略报告页（Brand Strategy Report）

**定位**：最终交付物——展示、编辑、导出品牌战略报告。

**设计原则**：
- 报告是资产，不是聊天记录——突出八个章节的结构
- 可在线编辑——每章支持点击编辑
- 不与咨询工作台混淆——报告页是"阅读/编辑"模式，不是"对话"模式

**界面结构**：

```
┌──────────────────────────────────────────────────────────────┐
│  顶部栏                                                       │
│  [← 返回工作台]  宠物食品品牌 · 品牌战略报告  [编辑] [导出 PDF]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│                       品牌战略报告                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  01  品牌背景与战略方向                           [展开]  │ │
│  │  商业背景分析结论、创业动机、战略挑战定义                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  02  市场机会                                         [展开]  │ │
│  │  品类规模、市场趋势、供需缺口、细分机遇                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  03  消费者洞察                                       [展开]  │ │
│  │  决策动机、行为模式、功能需求、身份认同需求                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  04  竞争判断                                         [展开]  │ │
│  │  竞品格局、竞争位置、品牌空位、差异化机会                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  05  品牌核心战略                           ← 当前查看    │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ 品牌定位                                           │    │ │
│  │  │ 专为一线城市年轻养宠女性打造的                        │    │ │
│  │  │ 功能性宠物食品品牌。我们相信科学喂养                    │    │ │
│  │  │ ...                      [点击编辑]                 │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────┐    │ │
│  │  │ 价值主张                                           │    │ │
│  │  │ ...                                               │    │ │
│  │  └──────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  06  视觉策略                                       [展开]  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  07  内容策略                                       [展开]  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  08  增长衡量                                       [展开]  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**关键交互**：
- 默认全部章节折叠，点击展开查看完整内容
- 每章内容支持**在线编辑**（点击 → 变为富文本编辑器 → 保存 → 更新报告内容）
- "导出 PDF"按钮 → 调用 `@react-pdf/renderer` 生成 PDF 下载
- 报告顶部标注"基于八个阶段品牌咨询流程推导"，强调过程可追溯性
- 编辑时保留原始 AI 生成版本（version history），用户修改不覆盖 AI 版本

**报告不展示的内容**：
- ❌ 四维评分分数
- ❌ 审计历史
- ❌ 对话过程
- 报告是最终交付物，不是复盘工具

---

#### 3.9.5 页面间导航关系

```
项目创建页 (/)
  │ 创建 Project → 跳转
  ↓
品牌咨询工作台 (/project/[id])
  │ 全部 8 阶段完成 → "查看报告"按钮激活
  ↓
品牌战略报告页 (/project/[id]/report)
  │ 点击"返回工作台" → 回到工作台（可回溯修改阶段）
```

- 用户在工作台完成全部 8 阶段后，顶部栏"报告 ↗"按钮高亮可点击
- 报告页可随时返回工作台——修改某个阶段的决策后，报告自动重新组装
- 工作台顶部栏始终显示进度（如 "S3/8"）

---

#### 3.9.6 MVP 范围（前端）

| 页面/组件 | MVP 状态 |
|---|---|
| 项目创建页 | **必须** |
| 品牌咨询工作台（含三区域布局） | **必须** |
| 阶段导航侧边栏 | **必须** |
| AI 对话区（Markdown 渲染） | **必须** |
| 搜索发现三段式展示 | **必须** |
| 审计卡片（Advance/Reoptimize/Block） | **必须** |
| 阶段小结卡片 | **必须** |
| 品牌战略报告页（折叠阅读 + 在线编辑） | **必须** |
| PDF 导出 | **必须** |
| 文件上传/图片粘贴 | **必须** |
| 用户登录/注册 | 不包含（未来扩展） |
| 团队协作 | 不包含 |
| 移动端适配 | 不包含（MVP 仅桌面 Web） |
| Dashboard 统计面板 | 不包含 |
| 支付集成 | 不包含（MVP 免费试用） |

---

### 3.10 Credits & Token 消耗追踪系统

#### 定位

Credits 系统提供按次付费能力——用户购买品牌报告额度，系统追踪每次咨询
的 token 消耗并折算为 credit 扣减。这是商业模式（按次付费 → 订阅制）的技术基础。

#### 面试加分逻辑

面试官问"为什么选 DeepSeek？"的标准回答路径：

> 价格只有 Claude 的 1/50，意味着单位咨询成本极低。一次完整的八阶段品牌咨询，
> 用 Claude 需要 ~¥15 的 token 成本，用 DeepSeek 只需要 ~¥0.3。
> 低成本直接转化为产品竞争力：我可以把单次品牌报告定价做到 ¥9.9-49，
> 而不是 ¥299-999。低门槛让更多小型创业者愿意尝试。

#### 核心数据模型

```typescript
// 用户余额
interface CreditAccount {
  userId: string
  totalCredits: number        // 总购买额度（1 credit ≈ ¥0.01）
  usedCredits: number         // 已消费额度
  freeCredits: number         // 赠送额度（新用户赠送，如 500 credits = ¥5）
  reservedCredits: number     // 预留额度（正在进行的会话）
  availableCredits: number    // 可用额度 = total + free - used - reserved
  createdAt: string
  updatedAt: string
}

// Token 消耗记录 — 每次 AI 调用的原子记账
interface TokenConsumption {
  id: string
  sessionId: string
  stageNumber: number
  callType: 'consultation' | 'convergence' | 'ai_quality_audit' | 'search'
  modelName: string           // deepseek-chat / deepseek-reasoner
  inputTokens: number
  outputTokens: number
  costInCredits: number       // 按 DeepSeek ¥2/百万 token → 1 credit ≈ 0.01 token 成本
  timestamp: string
}

// 用户购买记录
interface CreditPurchase {
  id: string
  userId: string
  amount: number              // 人民币金额（分）
  credits: number             // 对应额度
  packageType: 'single' | 'pack_3' | 'pack_5'  // 单次 / 3次包 / 5次包
  status: 'paid' | 'refunded'
  purchasedAt: string
}
```

#### Token → Credit 换算规则

```
DeepSeek V3 定价:
  input:  ¥1 / 百万 token
  output: ¥2 / 百万 token

换算: 1 credit = ¥0.01 (1 分钱)

一次品牌咨询 (完整 8 阶段) 预估:
  - 16 次 Prompt 调用 (8 consultation + 8 convergence)
  - 每次 ~8K input + 2K output
  - 总计 ~160K tokens
  - 费用 ~¥0.24 → 即 24 credits

加上 AI Quality Audit (每阶段 1 次 = 8 次):
  - 总计 ~300K tokens
  - 总费用 ~¥0.45 → 即 45 credits

单次完整咨询的合理定价:
  - 成本: ~¥0.5 (LLM API)
  - 售价: ¥9.9 (~990 credits) — 约 20x 毛利率
  - 对比传统品牌咨询 ¥50,000+，价格优势 5000x
```

#### 费用控制机制

| 机制 | 说明 |
|---|---|
| **每阶段费用预估** | Stage Engine 在启动 Consultation 前预估本阶段 token 消耗，与用户余额比对 |
| **余额不足拦截** | 当 availableCredits < 预估消耗 × 1.2（安全边际），暂停对话并提示充值 |
| **预留机制** | 阶段开始前 reserve 预估额度，阶段完成后结算实际消耗，释放差额 |
| **免费额度** | 新用户赠送 500 credits（≈ ¥5），支持完成 1-2 次完整咨询试用 |
| **消耗透明** | 每个阶段完成后展示本阶段 token 消耗，不以黑盒方式收费 |
| **Prompt Caching 优化** | 八阶段重复的 system prompt 利用 DeepSeek prompt caching，降低 input token 成本 |

#### 计费时机

```
阶段开始 → reserve(预估额度)
         → Consultation（多轮对话，逐轮累加 token）
         → Convergence（单次调用）
         → AI Quality Audit（单次调用）
         → 结算：实际消耗 = sum(所有 LLM 调用 token) → 释放预留差额
         → 写入 TokenConsumption 记录
```

#### 接口定义

```typescript
interface CreditService {
  getBalance(userId: string): Promise<CreditAccount>
  reserveCredits(userId: string, sessionId: string, estimatedCost: number): Promise<boolean>
  settleCredits(userId: string, sessionId: string, actualCost: number): Promise<void>
  purchaseCredits(userId: string, package: CreditPackage): Promise<CreditPurchase>
  getConsumptionHistory(userId: string): Promise<TokenConsumption[]>
}

type CreditPackage = {
  type: 'single' | 'pack_3' | 'pack_5'
  credits: number
  priceYuan: number
  label: string         // 如 "单次品牌报告" "3次创业顾问包"
}
```

#### 与核心引擎的集成

```
Stage Engine.execute()
  │
  ├── 1. CreditService.reserveCredits(预估)  ← 新增
  │     余额不足 → 抛 CreditsInsufficientError → 前端提示充值
  │
  ├── 2. Consultation（多轮 LLM 调用，逐轮记录 token）
  ├── 3. Convergence（单次 LLM 调用）
  ├── 4. AI Quality Audit（单次 LLM 调用）
  │
  ├── 5. CreditService.settleCredits(实际)    ← 新增
  │     写入 TokenConsumption 记录
  │
  └── 6. 返回阶段结果（含本阶段 token 消耗摘要）
```

#### MVP 范围

| 能力 | MVP 状态 | 说明 |
|---|---|---|
| Token 消耗追踪 | **必须** | 每次 LLM 调用的 input/output token 记录 |
| Credit 余额管理 | **必须** | 用户余额查询、预留、结算 |
| 新用户免费额度 | **必须** | 500 credits 赠送 |
| 余额不足拦截 | **必须** | 预估消耗超过可用额度时暂停 |
| 在线支付集成 | 未来扩展 | MVP 手动充值（开发阶段免费） |
| 订阅制计费 | 未来扩展 | 先验证按次付费，再迭代订阅 |
| 消耗统计面板 | 未来扩展 | 用户端 dashboard |

---

## 4. 代码风格与项目结构约定

### 4.1 技术栈约定

#### 技术选型原则

每条选型必须满足三个约束：
1. **零费用**（除 LLM API 调用外，全部使用免费层级或开源方案）
2. **面试可解释**（面试官问"为什么选这个"时，有清晰的技术理由，不是"因为流行"）
3. **企业级质量**（代码组织、类型安全、错误处理、测试覆盖达到生产标准）

#### 选型表

| 层 | 选型 | 免费方案 | 面试级理由 |
|---|---|---|---|
| 前端框架 | Next.js 14+ (App Router) | 开源，MIT 协议 | 全栈框架消除前后端分离的胶水代码；App Router 支持 React Server Components，报告页可 SSR 直接渲染，对话页保持客户端交互；API Routes 与前端共享 TypeScript 类型，避免接口契约不一致 |
| 语言 | TypeScript (strict mode) | 开源 | strict 模式下编译期拦截空值、未定义属性、隐式 any；与 Zod schema 配合实现"校验通过 = 类型确定"，无需手动维护两套类型定义 |
| AI SDK | Vercel AI SDK + OpenAI SDK | 开源 | AI SDK 封装流式响应(SSE)、自动重试、tool use 状态机；OpenAI SDK 兼容 DeepSeek API（DeepSeek 与 OpenAI API 格式完全兼容），无需额外 SDK；避免手动处理 stream chunk 拼接和错误恢复 |
| 样式 | Tailwind CSS | 开源 | 原子化 CSS 避免样式命名冲突和死代码累积；JIT 编译仅输出使用到的 class；与 React 组件共置样式，删组件时样式同步删除 |
| 数据校验 | Zod | 开源 | 八个阶段的 Convergence 输出各有一套严格 Schema；Zod 的 `.parse()` 在运行时校验 AI 输出的 JSON 结构完整性；校验失败的字段可精确定位并触发重新生成 |
| 关系数据库 | PostgreSQL (via Supabase) | Supabase 免费层：500MB 数据库、5GB 带宽 | Session → StageRecord → Report 三层实体间有严格的外键依赖；JSONB 列可存储各阶段的结构化输出，同时保留 SQL 查询能力做跨阶段检索；PostgreSQL 的 ACID 保证阶段推进原子性——Convergence 写入成功才推进阶段，失败则回滚 |
| ORM | Drizzle ORM | 开源 | 类型安全的查询构建器，编译期发现字段名拼写错误；schema 定义即 TypeScript 类型源，不需要 Prisma 那样的代码生成步骤；bundle 体积远小于 Prisma（~10KB vs ~1MB+），对冷启动友好 |
| 向量数据库 | pgvector (Supabase 扩展) | Supabase 免费层内置 | 知识库的核心——品牌案例、方法论文档、行业报告需要语义检索；pgvector 与业务数据存在同一个 PostgreSQL 实例，避免 Supabase + Pinecone 双数据库的同步复杂度和额外费用；免费层支持 200K 向量维度 |
| 文件存储 | Supabase Storage | 免费层：50MB 存储 | 用户上传的 PDF、图片、文档存储；与 Supabase Auth 集成的行级安全策略（RLS）控制文件访问权限 |
| 认证 | Supabase Auth | 免费层：50,000 MAU | 内置邮箱/密码 + OAuth 登录；Row Level Security 直接作用在 PostgreSQL 表上，认证与授权无需独立后端服务 |
| LLM | DeepSeek (主) / 可切换至 Claude、OpenAI 等 | DeepSeek API 按量付费，¥1-2/百万 token | DeepSeek V3 推理能力接近 Claude Sonnet 级别，API 价格仅为 Claude 的 1/50-1/70；API 格式与 OpenAI 完全兼容，通过适配器模式一天内可切换至任何 OpenAI-compatible 或 Anthropic provider；八阶段重复 system prompt 可通过 prompt caching 进一步降本 |
| 联网搜索 | 博查 Web Search API | 国内节点，按量付费 ¥0.036/次 | 覆盖 S2/S3/S5/S8 四个阶段的联网检索需求；返回结构化搜索结果，可按 `shared-search-protocol.md` 格式重新组织展示；响应兼容 Bing 格式 |
| PDF 生成 | @react-pdf/renderer | 开源 | 纯客户端 PDF 渲染，不消耗服务器资源；React 组件描述 PDF 布局，与报告页共享组件逻辑；输出真实 PDF（非截图），可控字体/分页/页眉页脚 |
| 部署 | Vercel (Hobby) | 免费层：100GB 带宽、100GB-hours 函数执行 | 与 Next.js 原生 Git 集成，push 即部署；免费层对 MVP 的 10 人内测绰绰有余；后续如需扩容，一键升级至 Pro（$20/月），无架构迁移成本 |

#### 费用概览

| 项目 | MVP 月费用 | 说明 |
|---|---|---|
| Vercel 部署 | **¥0** | Hobby 层，10 人内测完全够用 |
| Supabase 数据库 | **¥0** | 500MB 数据库 + 5GB 带宽 + pgvector |
| Supabase Auth | **¥0** | 50,000 MAU 以内免费 |
| Supabase Storage | **¥0** | 50MB 以内免费 |
| 博查 Web Search API | **¥0** | 2,000 次/月，MVP 测试够用 |
| LLM API (DeepSeek) | **~¥5-30/月** | 假设 50 次完整八阶段咨询/月，每次约 100K token，按 DeepSeek V3 价格 ¥2/百万 token 计算约 ¥10/月；prompt caching 可进一步降低 system prompt 重复输入成本 |
| **合计（除 LLM 外）** | **¥0** | — |
| **全部合计** | **~¥5-30/月** | 一杯咖啡的预算跑一个月 |

#### 适配器模式（LLM Provider 切换）

```
src/lib/ai/
├── provider/
│   ├── interface.ts       # LLMProvider 接口定义
│   ├── deepseek.ts        # DeepSeek 实现（主，OpenAI-compatible）
│   ├── openai.ts          # OpenAI 实现（备，同 OpenAI-compatible 基类）
│   └── anthropic.ts       # Anthropic 实现（备，非 OpenAI 格式需独立适配）
│
// 调用方只依赖接口，不依赖具体实现
// 通过环境变量 LLM_PROVIDER=deepseek|openai|anthropic 切换
// DeepSeek 和 OpenAI 共享 OpenAI-compatible 的基类，减少重复代码
```

选型理由（面试时可直接引用）：
- **为什么 DeepSeek 是主模型**：用 Claude Sonnet 1/50 的价格获得接近 Sonnet 级别的推理能力；API 格式与 OpenAI 完全兼容，切换成本为零；中文品牌咨询场景下，DeepSeek 的中文理解和生成质量不低于国际模型
- **为什么还要保留切换能力**：演示**依赖倒置原则**和**策略模式**的理解；单测时注入 mock provider 不消耗 API 费用；DeepSeek 服务不可用时，改环境变量 `LLM_PROVIDER=openai` 即可切走，零代码改动；面试官追问"如果 DeepSeek 涨价怎么办"时——换回环境变量值，一分钟切回 OpenAI 或 Anthropic

### 4.2 文件组织

```
src/
├── app/                        # Next.js App Router 页面
│   ├── page.tsx                # 页面 1: 项目创建页 (/)
│   ├── project/
│   │   └── [id]/
│   │       ├── page.tsx        # 页面 2: 品牌咨询工作台 (/project/[id])
│   │       └── report/
│   │           └── page.tsx    # 页面 3: 品牌战略报告页 (/project/[id]/report)
│   └── api/
│       ├── project/            # Project CRUD
│       │   ├── route.ts        #   POST /api/project, GET /api/project
│       │   └── [id]/
│       │       ├── route.ts    #   GET / DELETE /api/project/[id]
│       │       ├── stage/
│       │       │   └── [n]/
│       │       │       ├── message/route.ts  # POST 消息（流式）
│       │       │       ├── converge/route.ts # POST 触发收束
│       │       │       └── route.ts          # GET 阶段记录
│       │       └── report/
│       │           ├── route.ts              # GET 报告
│       │           ├── assemble/route.ts     # POST 组装报告
│       │           ├── chapter/[n]/route.ts  # PUT 编辑章节
│       │           └── pdf/route.ts          # GET 导出 PDF
│       ├── upload/             # 文件上传
│       └── search/             # 联网检索
│
├── lib/
│   ├── ai/
│   │   ├── prompts/            # 16 个 Prompt 模板（.md 文件）
│   │   │   ├── stage1-consultation.md
│   │   │   ├── stage1-converge.md
│   │   │   ├── ...             # stage2-8
│   │   │   └── shared-search-protocol.md
│   │   ├── provider/
│   │   │   ├── interface.ts    # LLMProvider 接口定义
│   │   │   ├── deepseek.ts     # DeepSeek 实现（主，OpenAI-compatible）
│   │   │   ├── openai.ts       # OpenAI 实现（备）
│   │   │   └── anthropic.ts    # Anthropic 实现（备）
│   │   ├── loader.ts           # Prompt 加载 & 变量注入 & Context 拼装
│   │   ├── consultation.ts     # Consultation 调用管理（多轮对话）
│   │   ├── convergence.ts      # Convergence 调用管理（单次结构化提取）
│   │   └── search.ts           # 联网检索实现（博查 Web Search API）
│   │
│   ├── workflow/
│   │   ├── workflow.ts         # Workflow Engine — 阶段状态机 & 路由
│   │   └── router.ts           # 阶段路由 & 子状态判断
│   │                            # 注意: decision-memory.ts 从此目录移出
│   │
│   ├── stage/
│   │   ├── stage-engine.ts     # Stage Engine — 单阶段执行协调器
│   │   ├── normalizer.ts       # Output Normalization（纯正则修复）
│   │   └── schema-validator.ts # Schema Validation（Zod + 重试控制）
│   │
│   ├── audit/
│   │   ├── audit-engine.ts     # Stage Audit Engine 入口（三组件协调）
│   │   ├── rule-check.ts       # Rule Check（纯代码比对）
│   │   ├── ai-quality.ts       # AI Quality Audit（LLM 调用，含 Strategic Continuity 附加段落）
│   │   └── cross-stage.ts      # Cross Stage Context Check
│   │                            #   ├── Layer A: fact-reference-check.ts（纯代码）
│   │                            #   └── Layer B: strategic-continuity.ts（LLM，复用 ai-quality 调用）
│   │
│   ├── memory/
│   │   ├── decision-memory.ts  # Decision Memory — 战略资产读写
│   │   └── dependency-graph.ts # 决策依赖图定义（dependsOn 关系）
│   │
│   ├── report/
│   │   ├── assemble.ts         # Report Assemble — 八阶段输出 → 报告
│   │   ├── quality.ts          # Report Quality Check（违规检测 + 术语一致性）
│   │   └── pdf-generate.ts     # PDF 导出（@react-pdf/renderer）
│   │
│   ├── schemas/
│   │   ├── founder-vision.ts   # Stage 1 输出 Schema
│   │   ├── business-context.ts # Stage 2 输出 Schema
│   │   ├── market-insights.ts  # Stage 3 输出 Schema
│   │   ├── consumer-insight.ts # Stage 4 输出 Schema
│   │   ├── competitive.ts      # Stage 5 输出 Schema
│   │   ├── brand-strategy.ts   # Stage 6 输出 Schema
│   │   ├── visual-strategy.ts  # Stage 7 输出 Schema
│   │   └── content-strategy.ts # Stage 8 输出 Schema
│   │
│   ├── knowledge/
│   │   ├── embeddings.ts       # 文档向量化 & pgvector 存储
│   │   ├── retriever.ts        # 语义检索（hybrid search: 向量 + 关键词）
│   │   └── seed.ts             # 知识库初始化脚本
│   │
│   ├── auth/
│   │   ├── client.ts           # Supabase Auth 客户端
│   │   └── middleware.ts       # 路由保护中间件
│   │
│   ├── storage/
│   │   └── upload.ts           # Supabase Storage 文件上传管理
│   │
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema 定义
│   │   │                        #   Session / StageRecord / DecisionMemoryEntry / Report
│   │   └── index.ts            # DB 连接 & 导出
│   │
│   └── utils/                  # 通用工具（格式化、日期处理等）
│
├── components/                 # React 组件（按页面组织）
│   ├── entry/                  # 页面 1: 项目创建页
│   │   ├── BrandEntryForm.tsx  # 品牌名称 + 品类输入 + 创建按钮
│   │   └── ProjectHistory.tsx  # 历史项目列表（继续之前的咨询）
│   ├── workspace/              # 页面 2: 品牌咨询工作台
│   │   ├── WorkspaceLayout.tsx # 三区域布局容器（侧边栏 + 对话 + 顶部栏）
│   │   ├── StageSidebar.tsx    # 阶段导航侧边栏
│   │   ├── TopBar.tsx          # 顶部栏（品牌名、进度、返回、报告入口）
│   │   ├── ChatView.tsx        # 主对话容器
│   │   ├── MessageBubble.tsx   # 消息气泡（Markdown 渲染）
│   │   ├── StageSummary.tsx    # 阶段小结卡片
│   │   ├── SearchResult.tsx    # 搜索发现三段式展示
│   │   └── InputArea.tsx       # 输入区（文本 + 附件 + 搜索按钮）
│   ├── audit/                  # 审计 UI（对话流内嵌，不新增独立面板）
│   │   ├── AdvanceCard.tsx     # ✅ 通过卡片
│   │   ├── ReoptimizeCard.tsx  # ⚠ 优化卡片（阶段+跨阶段问题合并）
│   │   ├── BlockCard.tsx       # ⛔ 阻断卡片
│   │   └── AuditDetail.tsx     # 审计详情展开层（默认折叠）
│   ├── report/                 # 页面 3: 品牌战略报告页
│   │   ├── ReportView.tsx      # 报告折叠阅读主视图
│   │   ├── ReportChapter.tsx   # 单个章节展开/折叠组件
│   │   ├── ReportEditor.tsx    # 章节在线编辑器（富文本）
│   │   └── PdfExport.tsx       # PDF 导出按钮 & 进度
│   ├── upload/                 # 上传组件（跨页面复用）
│   │   ├── FileUploader.tsx    # 拖拽/点击上传
│   │   └── PasteHandler.tsx    # Ctrl+V 粘贴监听
│   └── ui/                     # 通用 UI 组件（按钮、输入框、模态框等）
│
└── tests/
    ├── unit/
    │   ├── workflow/           # Workflow 状态机、阶段路由
    │   ├── stage/              # Stage Engine、normalizer、schema-validator
    │   ├── audit/              # Rule Check、Cross Stage（Layer A 单元）
    │   ├── memory/             # Decision Memory 读写、依赖图
    │   ├── report/             # 报告组装、质量检查、PDF 生成
    │   ├── ai/                 # Prompt 加载、Provider 切换
    │   └── knowledge/          # embedding、retriever
    └── quality/                # 内容质量测试用例
        └── cases/              # 3 个测试品牌案例
```

#### 目录结构关键变化（与旧版对比）

| 旧路径 | 新路径 | 变化原因 |
|---|---|---|
| `lib/workflow/decision-memory.ts` | `lib/memory/decision-memory.ts` | Decision Memory 不是 Workflow 的子模块——它是独立的数据层 |
| `lib/output/cleaner.ts` | `lib/stage/normalizer.ts` + `lib/report/quality.ts` | 机械修复（normalizer）在 Stage Engine 内运行；违规检测（quality）在报告生成前运行 |
| `lib/output/consistency.ts` | `lib/report/quality.ts` 的一部分 | 术语一致性检查是报告质量检查的一部分 |
| `lib/output/assemble.ts` | `lib/report/assemble.ts` | 语义更明确——它是 Report Engine 的核心 |
| — | `lib/stage/stage-engine.ts` | **新增**：单阶段执行协调器 |
| — | `lib/audit/` | **新增**：Stage Audit Engine（三个组件独立文件） |
| — | `lib/memory/dependency-graph.ts` | **新增**：决策依赖图独立维护 |
| `lib/workflow/workflow.ts` | `lib/workflow/workflow.ts` | 职责缩小——不再包含 AI 调用、审计、决策记忆逻辑 |

### 4.3 模块职责划分

**铁律**：每个模块只做一件事。模块间通过明确的接口通信，不允许跨层直接调用（如 UI 层不能直接调用 LLM API）。

#### 引擎层（Engine Layer）—— 核心业务逻辑

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Workflow Engine** | `lib/workflow/workflow.ts` | 阶段状态机、阶段生命周期、阶段进入/完成条件、依赖关系查询、Quality Gate 后的流程调度 | ❌ AI 调用 ❌ 内容质量判断 ❌ 决策生成 ❌ 审计 ❌ 报告生成 |
| **Stage Engine** | `lib/stage/stage-engine.ts` | 单阶段完整流程协调：Consultation → Convergence → Normalization → Validation → Audit → Save | ❌ 全局流程控制 ❌ 阶段间依赖判断 ❌ 报告生成 ❌ 用户权限 |
| **Stage Audit Engine** | `lib/audit/audit-engine.ts` | 三组件协调（Rule Check → AI Quality Audit → Cross Stage Context Check），输出 Quality Gate Decision | ❌ 阶段流程控制 ❌ 报告生成 ❌ 用户交互 |
| **Report Engine** | `lib/report/assemble.ts` | 八阶段输出 + Decision Memory → 品牌战略报告；最终审计；报告质量检查；PDF 导出 | ❌ 阶段流程控制 ❌ AI 咨询调用 ❌ 审计 |

#### AI 层（AI Layer）—— LLM 调用和 Prompt 管理

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Prompt Loader** | `lib/ai/loader.ts` | Prompt 模板加载、变量替换、Context 拼装、搜索协议拼接 | ❌ 业务流程判断 |
| **Provider** | `lib/ai/provider/` | LLM Provider 抽象（DeepSeek 主 / OpenAI + Anthropic 备），统一接口 | ❌ Prompt 内容管理 |
| **Consultation** | `lib/ai/consultation.ts` | 多轮对话管理：发送消息、流式响应、历史上下文维护 | ❌ 结构化提取（交给 Convergence） |
| **Convergence** | `lib/ai/convergence.ts` | 单次结构化提取调用：读取完整对话 → 输出 JSON | ❌ 多轮对话管理 |
| **Search** | `lib/ai/search.ts` | 联网检索（博查 Web Search API），按搜索协议格式化结果 | ❌ 搜索结果战略判断 |

#### 审计层（Audit Layer）—— 质量保证

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Rule Check** | `lib/audit/rule-check.ts` | 纯代码比对：阶段结构完整性、必填字段、Schema 完整性、基础逻辑冲突 | ❌ LLM 调用 ❌ 战略质量判断 |
| **AI Quality Audit** | `lib/audit/ai-quality.ts` | LLM 调用：四维质量评估 + Strategic Continuity Check 附加段落（条件触发） | ❌ 纯代码检查 ❌ 流程控制 |
| **Cross Stage Context** | `lib/audit/cross-stage.ts` | Layer A: Fact Reference Check（纯代码）+ Layer B: Strategic Continuity Check 触发判断 | ❌ 独立 LLM 调用（Layer B 复用 AI Quality Audit 同次调用） |
| **Schema Validator** | `lib/stage/schema-validator.ts` | Zod .parse() 校验 + 重试控制（仅重生成违规字段，最多 3 次） | ❌ 语义质量判断 |

#### 数据层（Data Layer）—— 持久化和数据管理

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Decision Memory** | `lib/memory/decision-memory.ts` | 战略资产读写：confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions | ❌ 聊天记录存储 ❌ 临时内容保存 ❌ AI 调用 |
| **Dependency Graph** | `lib/memory/dependency-graph.ts` | 决策依赖图定义和维护：dependsOn 关系、强制引用约束 | ❌ 运行时检查逻辑 |
| **Database** | `lib/db/` | Drizzle schema、DB 连接、Session / StageRecord / DecisionMemoryEntry / Report 的 CRUD | ❌ 业务逻辑 ❌ AI 调用 |
| **Knowledge Base** | `lib/knowledge/` | 文档向量化、语义检索、知识库播种（品牌案例、方法论文档） | ❌ 业务流程判断 |
| **Schemas** | `lib/schemas/` | 8 个阶段输出的 Zod schema 和 TypeScript 类型定义 | ❌ 运行时逻辑 ❌ AI 调用 |

#### 基础设施层（Infrastructure Layer）

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Auth** | `lib/auth/` | Supabase Auth 客户端、登录/注册、路由保护中间件 | ❌ 权限业务逻辑（MVP 仅个人使用） |
| **Storage** | `lib/storage/` | 文件上传/下载、格式校验、大小限制 | ❌ 文件内容分析 |
| **PDF Export** | `lib/report/pdf-generate.ts` | @react-pdf/renderer 组件 → PDF 下载 | ❌ 报告内容计算 |
| **Output Normalizer** | `lib/stage/normalizer.ts` | 纯正则修复（括号/引号/破折号），无损 | ❌ 语义判断 ❌ 违规检测 |

#### 表现层（Presentation Layer）

| 模块 | 文件 | 职责 | 不负责 |
|---|---|---|---|
| **Components** | `components/` | UI 渲染、用户交互、视觉呈现 | ❌ 直接调用 LLM API ❌ 直接写数据库 ❌ 业务逻辑判断 |

#### 模块间通信规则

```
Components → API Routes → Workflow Engine → Stage Engine → AI / Audit / Memory
                                                    ↓
                                              Report Engine
```

- **前端组件**不能直接调用 `lib/ai/`、`lib/audit/`、`lib/memory/`
- **Workflow Engine**不能直接调用 `lib/ai/`（委托 Stage Engine）
- **Stage Engine**是唯一可以直接调用 AI 层 + Audit 层 + Memory 层的模块
- **Report Engine**在全部阶段完成后由 Workflow Engine 触发，不参与阶段流程
- 跨层调用通过接口（TypeScript interface）而非直接 import 具体实现

### 4.4 Prompt 管理方式

- 16 个 Prompt 模板以 Markdown 文件形式存储在 `src/lib/ai/prompts/`
- `loader.ts` 负责：读取模板文件 → 替换变量（品牌名、前序阶段输出等）→ 拼装 system prompt
- 共享搜索协议 `shared-search-protocol.md` 在 S2/S3/S5/S8 的 Consultation 和
  Convergence 中动态拼接到阶段专属 Prompt 后
- Prompt 版本纳入 git 管理

### 4.5 数据模型规范

#### 设计原则

- **Project 是核心实体**——一切数据围绕品牌咨询项目组织
- **User 为可选关联**——MVP 阶段不需要登录，但数据模型预留 `userId` 字段。
  未来增加 User 表后，只需建立 `User → Project` 的外键关联即可实现
  用户管理、历史项目管理和商业化扩展
- **不做物理删除**——Project 和 StageRecord 使用软删除（`deletedAt`），
  保留数据用于未来分析和回溯

#### 实体关系图

```
┌──────────┐       ┌─────────────────┐       ┌──────────────────┐
│   User   │       │    Project       │       │  StageRecord      │
│ (未来扩展)│ 1──N  │  (核心实体)       │ 1──N  │  (每阶段一条)       │
│          │       │                  │       │                   │
│ id       │       │ id               │       │ id                │
│ email    │       │ userId (可选FK)   │       │ projectId (FK)    │
│ name     │       │ brandName        │       │ stageNumber (1-8) │
│ ...      │       │ category         │       │ consultationMsgs  │
└──────────┘       │ currentStage     │       │ convergenceOutput │
                   │ status           │       │ auditResult       │
                   │ createdAt        │       │ status            │
                   │ updatedAt        │       │ createdAt         │
                   └────────┬─────────┘       └──────────────────┘
                            │
                   ┌────────┴─────────┐
                   │                  │
          ┌────────▼───────┐  ┌───────▼──────────┐
          │ DecisionMemory │  │     Report        │
          │  Entry (多条)   │  │   (一条/Project)   │
          │                 │  │                   │
          │ id              │  │ id                │
          │ projectId (FK)  │  │ projectId (FK)    │
          │ entryType       │  │ content (JSON)    │
          │ field           │  │ version           │
          │ value           │  │ createdAt         │
          │ stageSource     │  │ updatedAt         │
          │ confirmedAt     │  └───────────────────┘
          └─────────────────┘
```

#### 核心实体

```typescript
// ========== Project（核心实体）==========

interface Project {
  id: string                          // UUID，创建时生成
  userId: string | null               // MVP 为 null，未来关联 User
  brandName: string                   // 品牌名称（项目创建页必填）
  category: string | null             // 品类/方向（可选，S1 中可细化）
  currentStage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  stageSubState: 'consultation' | 'converging' | 'auditing' | 'complete'
  status: 'active' | 'completed' | 'archived'
  createdAt: string                   // ISO datetime
  updatedAt: string
  completedAt: string | null          // 全部 8 阶段完成时间
  deletedAt: string | null            // 软删除
}

// ========== StageRecord（每阶段一条记录）==========

interface StageRecord {
  id: string
  projectId: string                   // FK → Project
  stageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  consultationMessages: Message[]     // 完整对话记录（JSON）
  convergenceOutput: StageOutput      // 结构化输出（Zod 校验后，JSON）
  auditResult: AuditResult | null     // Stage Audit Engine 输出
  gateDecision: 'advance' | 'reoptimize' | 'block' | null
  reoptimizeCount: number             // 本阶段重试次数（默认 0）
  status: 'active' | 'converging' | 'auditing' | 'advanced' | 'reoptimizing' | 'blocked'
  createdAt: string
  updatedAt: string
}

// ========== DecisionMemoryEntry（战略资产）==========

interface DecisionMemoryEntry {
  id: string
  projectId: string                   // FK → Project
  entryType: 'confirmed_fact' | 'confirmed_decision' | 'hypothesis' | 'unresolved_question'
  field: string                       // 对应阶段 Schema 字段路径，如 "brandStrategy.positioning"
  value: string
  stageSource: number                 // 来源阶段
  dependedBy: number[]                // 哪些后续阶段依赖此项
  confirmedAt: string | null          // 确认时间（hypothesis/unresolved 为 null）
  evidenceLevel: 1 | 2 | 3 | 4 | null
  createdAt: string
}

// ========== Report（最终报告）==========

interface Report {
  id: string
  projectId: string                   // FK → Project（一个 Project 对应一份 Report）
  content: ReportContent              // 组装后的完整报告结构（JSON）
  version: number                     // 每次重新组装 +1
  createdAt: string
  updatedAt: string
}

interface ReportContent {
  title: string                       // 如 "宠物食品品牌战略报告"
  brandName: string
  generatedAt: string
  chapters: [
    { number: 1, title: '品牌背景与战略方向', sourceStage: 2, sections: ReportSection[] },
    { number: 2, title: '市场机会', sourceStage: 3, sections: ReportSection[] },
    { number: 3, title: '消费者洞察', sourceStage: 4, sections: ReportSection[] },
    { number: 4, title: '竞争判断', sourceStage: 5, sections: ReportSection[] },
    { number: 5, title: '品牌核心战略', sourceStage: 6, sections: ReportSection[] },
    { number: 6, title: '视觉策略', sourceStage: 7, sections: ReportSection[] },
    { number: 7, title: '内容策略', sourceStage: 8, sections: ReportSection[] },
    { number: 8, title: '增长衡量', sourceStage: 8, sections: ReportSection[] },
  ]
  decisionAnchors: DecisionMemoryEntry[]  // 报告中标注的决策依据来源
}
```

#### MVP 阶段的数据简化

| 实体 | MVP 行为 |
|---|---|
| `User` | **不创建**。`Project.userId` 为 `null`。Project 通过 localStorage 的匿名 ID 关联 |
| `Project` | 创建、更新、软删除。通过 API 读写 |
| `StageRecord` | 每个阶段完成时写入。支持更新（Reoptimize 时覆盖） |
| `DecisionMemoryEntry` | 每个阶段完成时提取并写入。全阶段完成后供 Report 引用 |
| `Report` | 全阶段完成后组装并写入。支持重新组装（version +1） |
| `CreditAccount / TokenConsumption` | API 层记录，UI 不展示（MVP 阶段不收费） |

#### 未来扩展路径

当产品需要增加用户体系时：

```
1. 创建 User 表（id, email, name, createdAt）
2. Project.userId 改为必填（NOT NULL）
3. 添加 Project → User 的外键约束
4. 项目创建页接入 Supabase Auth（登录/注册）
5. 首页改为"我的项目列表"（按 userId 查询 Project）
6. CreditAccount.userId 关联至 User
```

不需要改动已有的 Project / StageRecord / DecisionMemory / Report 表结构。

### 4.6 API 设计原则

- RESTful 风格，JSON 请求/响应
- 所有 API 返回统一格式：`{ success: boolean, data?: T, error?: string }`
- 阶段推进 API 为异步（Consultation 流式 + Convergence 同步）
- Conversation 端点使用 Server-Sent Events (SSE) 流式传输
- **以 Project 为核心**：API 路径为 `/api/project/[id]/...`

关键端点：

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/project` | 创建新品牌咨询项目 |
| GET | `/api/project/[id]` | 获取项目状态（含当前阶段、进度） |
| GET | `/api/project` | 获取项目列表（按匿名 ID 查询历史项目） |
| DELETE | `/api/project/[id]` | 软删除项目 |
| POST | `/api/project/[id]/stage/[n]/message` | 发送消息（Consultation 流式） |
| POST | `/api/project/[id]/stage/[n]/converge` | 触发阶段收束 |
| GET | `/api/project/[id]/stage/[n]` | 获取阶段记录（含审计结果） |
| GET | `/api/project/[id]/report` | 获取报告 |
| POST | `/api/project/[id]/report/assemble` | 手动触发报告组装 |
| PUT | `/api/project/[id]/report/chapter/[n]` | 编辑报告章节内容 |
| GET | `/api/project/[id]/report/pdf` | 导出 PDF |
| POST | `/api/session/[id]/stage/[n]/message` | 发送消息（Consultation 流式） |
| POST | `/api/session/[id]/stage/[n]/converge` | 触发收束 |
| GET | `/api/session/[id]/report` | 获取报告 |

### 4.7 命名规范

- **文件/目录**：kebab-case（`decision-memory.ts`、`brand-strategy.ts`）
- **函数/变量**：camelCase（`getSessionContext`、`currentStage`）
- **类型/接口**：PascalCase（`BusinessContext`、`StageRecord`）
- **常量**：UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- **数据库表**：snake_case（`stage_records`）
- **Prompt 文件**：`stage{n}-{consultation|converge}.md`

### 4.8 错误处理规范

- AI 调用失败：最多重试 3 次，指数退避；3 次失败后返回友好错误信息，不丢失已收集的对话
- Convergence 输出校验失败：重新调用 Convergence（仅重生成违规字段），最多 3 次；
  3 次未通过标记待人工复核，**不阻塞流程**
- 联网检索失败：降级——告知用户"当前无法获取实时数据，基于已有信息继续分析"
- 会话数据丢失：自动从持久化存储恢复；不可恢复时提供"新开会话"选项
- 所有错误必须记录日志，包含：时间戳、会话 ID、阶段、错误类型、用户可见信息摘要

---

## 5. 测试策略（Testing Strategy）

### 5.1 软件工程质量测试

#### 单元测试

| 测试对象 | 验证内容 |
|---|---|
| `loader.ts` | Prompt 模板正确加载、变量正确替换、搜索协议正确拼接 |
| `workflow.ts` | 阶段顺序正确、依赖链正确传递、阶段/子状态切换正确 |
| `cleaner.ts` | 正则修复正确性、违规检测准确性 |
| Zod Schemas | 合法 JSON 通过校验、非法 JSON 被拒绝、边界值处理 |
| API 路由 | 请求参数校验、响应格式、错误码正确 |

#### 集成测试

| 场景 | 验证内容 |
|---|---|
| 完整流程 | S1 → S8 全链路跑通，阶段间数据正确传递 |
| 数据持久化 | 对话记录正确保存和读取、结构化输出正确持久化 |
| 中断恢复 | 中途断开会话后可以恢复并继续 |
| 回退修改 | 修改 S3 的输出后，S4-S6 的依赖数据正确更新 |

#### 异常测试

| 场景 | 验证内容 |
|---|---|
| LLM 超时 | 重试逻辑正确触发，用户收到友好提示 |
| 联网检索失败 | 降级逻辑正确，不阻塞流程 |
| Convergence 输出格式错误 | 重试逻辑正确，违规字段正确重新生成 |
| 并发请求 | 同一会话并发写操作不导致数据损坏 |

### 5.2 内容质量测试

#### 测试案例设计

选取 3 个真实/模拟的品牌案例，覆盖不同行业和阶段：

1. **案例 A**：宠物食品品牌，已有产品（月销 10 万），需要品牌升级
2. **案例 B**：香薰品牌，产品开发中，需要验证品牌方向
3. **案例 C**：家居品牌，从代工转型自有品牌

每个案例运行完整 8 阶段流程，收集输出。

#### 人工评审维度（5 分制）

| 维度 | 4-5 分（合格） | 2-3 分（需改进） | 0-1 分（不合格） |
|---|---|---|---|
| **战略准确性** | 定位和差异化有充分证据支持 | 部分结论有依据，部分悬空 | 结论无依据或与上游分析矛盾 |
| **逻辑连续性** | 前后阶段推导链完整，可追溯 | 大部分有推导，关键节点断裂 | 阶段间结论矛盾或无关联 |
| **洞察深度** | 提供创始人未明确意识到的判断 | 有效总结但无新增判断 | 仅复述创始人已知信息 |
| **商业可执行性** | 输出可直接指导后续视觉/内容决策 | 方向正确但缺少具体落脚点 | 建议空洞，无法执行 |
| **语言质量** | 无 AI 痕迹，语域匹配品牌场景 | 偶有口语连接词或过大词汇 | 明显 AI 生成痕迹或语法错误 |

#### 质量门槛

- 任一维度均分 < 3 分 → 该阶段 Prompt 需重新优化
- 3 个案例中的 2 个需达到全维度均分 ≥ 3.5 分 → MVP 内容质量达标
- 任一案例出现"0-1 分"维度 → 该维度对应阶段需重新设计

#### 对照测试

将 AI Brand OS 输出与以下对照对比：
- 同一案例的 ChatGPT 直接问答输出（单轮和多轮）
- 公开品牌咨询方法论框架下的"标准答案"

---

## 6. 边界（Boundaries）

### 6.1 MVP 明确不包含

| 不包含项 | 说明 |
|---|---|
| 品牌命名和 slogan 生成 | 属于创意执行层，非战略判断 |
| Logo、包装、视觉设计文件 | 只输出视觉策略方向和设计原则 |
| 完整内容日历、每周发布计划 | 只建立内容策略、方向和长期内容资产体系 |
| 用户调研工具、问卷系统、NPS 分析 | 可提供访谈框架和分析方法，不内置调研工具 |
| 财务模型、定价策略、供应链分析 | 属于商业运营层 |
| 竞品数据爬取/社媒监控 | 只通过联网检索获取公开信息 |
| 多人协作、权限管理、团队工作流 | MVP 只面向创始人个人使用 |
| 电商/社媒后台 API 接入 | 不做实时数据同步 |
| 知识库自动更新/行业数据订阅 | MVP 知识库为手动播种（品牌案例、方法论文档），不做自动更新 |
| 多 Agent 协作、自动无限优化循环 | 单 Agent 线性推进 |
| 自动化 A/B 测试、效果归因 | 品牌决策工具，不是广告投放工具 |
| 语音/录音分析 | MVP 仅支持文本输入 |
| 移动端 App | MVP 为 Web 应用 |
| 复杂版本管理、自动回溯 | 支持回到之前阶段修改，但不做完整版本树 |

### 6.2 MVP 核心目标

验证一个假设：

**"AI 是否能够通过连续品牌咨询流程，帮助创业者完成从模糊想法到清晰品牌战略的推导。"**

所有功能决定都应回溯到这个问题：**这个功能是否在帮助验证这个假设？** 如果不是，砍掉。

---

## 附录 A：参考文件索引

| 文件 | 路径 | 说明 |
|---|---|---|
| 架构迁移指南 | `reference/00-architecture-migration-guide.md` | 双 Prompt 体系架构说明 |
| 交付清单 | `reference/README-delivery-manifest.md` | 工程改动清单 & 验证顺序 |
| 共享搜索协议 | `reference/shared-search-protocol.md` | 搜索来源、展示格式、证据分层 |
| 16 个 Prompt | `reference/stage{n}-{consultation\|converge}.md` | 八个阶段的 Consultation 和 Convergence |
| 访谈记录 | `context/关键对话.docx` | 产品方向 11 轮追问完整记录 |

---

## 附录 B：工程启动建议（验证顺序）

按 `README-delivery-manifest.md` 的建议：

1. 先跑通 Stage 1 → Stage 2 两步，验证：
   - Consultation 确认后触发 Convergence 的调用时序
   - Convergence 输出 JSON 是否做到"归纳而非摘录"
2. 通过后批量接入剩余 6 个阶段
3. 接入 cleaner.ts → consistency check → report assemble
