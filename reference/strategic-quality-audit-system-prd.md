# Strategic Quality Audit System PRD

AI Brand OS 战略质量审计系统产品需求文档

---

## 01 产品背景与目标

### 1.1 产品背景

AI Brand OS 当前已经具备：

- AI 品牌咨询工作流
- 8 Stage 品牌战略生成流程
- Decision Memory 决策记忆系统
- Workflow Engine 阶段流转系统
- Report Generation 报告生成系统

当前系统能够完成：

```
用户输入
  ↓
AI 分析
  ↓
阶段输出
  ↓
品牌战略报告
```

但是随着 AI 咨询流程复杂化，出现新的质量问题：

**问题 1：AI 输出质量无法稳定控制**

当前：AI 完成 Stage 后直接进入下一阶段。

导致：
- 市场机会未充分分析
- 消费者洞察不具体
- 品牌定位提前生成
- 视觉策略脱离战略

典型问题：

```
Market Opportunity
       ↓
Brand Positioning
跳跃。
```

**问题 2：规则检查与战略判断混淆**

当前质量检查同时承担：
- JSON 检查
- 字段检查
- 内容质量判断
- 战略合理性判断

导致无法区分：

| 问题 | 类型 |
|------|------|
| 字段为空 | Rule Engine |
| 战略无依据 | AI Audit |
| JSON错误 | Rule Engine |
| 定位不差异化 | AI Audit |

**问题 3：单一评分模型无法适配不同 Stage**

不同阶段目标不同。

例如：

S1 用户访谈：
- 核心：理解创业者和用户问题
- 不是：市场验证。

而 S7 视觉策略：
- 核心：视觉差异化和执行能力
- 不是：市场规模。

因此统一评分模型会导致：
- S1 被低估
- S7 被错误评价

### 1.2 产品目标

建立一个面向品牌战略生成过程的多阶段 AI 战略质量评估系统。

实现：

**目标 1**：判断当前 Stage 输出是否符合阶段目标。

**目标 2**：判断战略推导是否成立。

即：
```
Evidence → Insight → Opportunity → Decision
```

**目标 3**：判断是否具备进入下一 Stage 条件。

**目标 4**：提供可执行优化建议。

形成闭环：

```
Generate → Audit → Optimize → Generate Again
```

---

## 02 系统整体架构

### 2.1 核心设计原则

**跨阶段审计不是独立模块。** 它不是等全部阶段结束后统一扫描一次的独立系统，
而是 Stage Audit Engine 内部的第三个组成部分，与 Rule Check、AI Quality Audit
三者并列，在**每个阶段完成时**运行。

### 2.2 Stage Audit Engine 三组件架构

```
                    Stage AI Agent
                          |
                          ↓
                   Stage Output
                          |
                          ↓
              ┌─────────────────────────────────────┐
              │       Stage Audit Engine             │
              │  （每个阶段完成时触发，非全部结束后）    │
              │                                      │
              │  ┌───────────┐  ┌──────────────┐    │
              │  │Rule Check │  │AI Quality    │    │
              │  │(代码比对)  │  │Audit (LLM)   │    │
              │  │           │  │              │    │
              │  │Schema校验  │  │四维评分模型   │    │
              │  │字段完整性  │  │战略合理性判断  │    │
              │  │基础逻辑    │  │阶段适配判断   │    │
              │  └─────┬─────┘  └──────┬───────┘    │
              │        │               │             │
              │        │    ┌──────────▼───────────┐ │
              │        │    │Cross Stage Context    │ │
              │        │    │Check（跨阶段上下文检查）│ │
              │        │    │                       │ │
              │        │    │Layer 1: 引用完整性检查  │ │
              │        │    │ → 纯代码比对，不用 LLM  │ │
              │        │    │ → 只要当前阶段在依赖图  │ │
              │        │    │   中存在前序依赖就触发  │ │
              │        │    │                       │ │
              │        │    │Layer 2: 语义断裂检查    │ │
              │        │    │ → 需要 LLM 判断        │ │
              │        │    │ → 仅在阶段 Rule + AI   │ │
              │        │    │   已达 Reoptimize 门槛  │ │
              │        │    │   以上时才触发          │ │
              │        │    │ → 作为 AI Quality      │ │
              │        │    │   Audit 同一次调用的    │ │
              │        │    │   可选附加段落          │ │
              │        └────┴───────────────────────┘ │
              └─────────────────┬───────────────────┘
                                ↓
                         Quality Gate
                    ┌───────┬───────┬───────┐
                    ↓       ↓       ↓       ↓
                Advance  Reoptimize  Block
                                ↓
                         Workflow Engine
```

### 2.3 三组件职责边界

| 组件 | 技术实现 | 触发条件 | 输出 |
|---|---|---|---|
| **Rule Check** | 纯代码比对，不用 LLM | 每次阶段完成时 | 规则违规列表（error/warning/info） |
| **AI Quality Audit** | LLM 调用 | 每次阶段完成时 | 四维评分 + 战略问题列表 + 优化建议 |
| **Cross Stage Context Check** | Layer 1: 代码比对；Layer 2: LLM（复用 AI Quality Audit 调用）| Layer 1 在每次阶段完成时（有依赖则触发）；Layer 2 仅在阶段质量达标时触发 | 引用断裂列表 + 语义断裂列表 |

### 2.4 触发时机（关键设计）

跨阶段检查有**两种**触发时机，不是只有一种：

**每阶段完成时（主要触发）：**
每个阶段 Convergence 输出后，Stage Audit Engine 运行：
1. Rule Check → 2. AI Quality Audit → 3. Cross Stage Context Check（Layer 1 必跑，Layer 2 条件触发）

**全阶段完成后、报告组装前（补充触发）：**
全部 8 个阶段完成、报告组装之前，仍执行一次独立的全量扫描——
遍历完整决策依赖图，检查所有跨阶段引用链。这是补充检查，不是唯一的检查时机。

---

## 03 Rule Engine 设计

### 3.1 产品定位

Rule Engine 负责：判断输出是否违反确定性规则。

特点：
- deterministic
- low cost
- fast

不使用 LLM。

### 3.2 检查范围

**A. Schema 检查**

包括：
- JSON格式
- 字段缺失
- 数据类型

**B. 完整性检查**

例如：marketOpportunity 缺少 market_gap

**C. 基础逻辑检查**

例如字段冲突：targetAudience 同时出现"年轻女性"和"男性用户"

### 3.3 输出结构

```json
{
  "type": "rule_issue",
  "severity": "error | warning | info",
  "field": "",
  "message": "",
  "suggestion": ""
}
```

---

## 04 AI Audit Engine 设计

### 4.1 产品定位

AI Audit Engine 不负责：
- ❌ 格式检查
- ❌ 字段检查
- ❌ JSON验证

负责：
- ✅ 战略质量判断
- ✅ 推理链判断
- ✅ 阶段适配判断
- ✅ 证据合理性判断

### 4.2 一级评价模型

所有 Stage 统一四个维度：

| 维度 | 英文 | 说明 |
|------|------|------|
| 具体度 | Specificity | 是否具体到场景、人群、行为 |
| 差异化 | Differentiation | 是否形成独特判断 |
| 可执行性 | Actionability | 是否指导行动 |
| 证据支撑 | Evidence | 是否有合理依据 |

---

## 04.A 决策依赖图（Decision Dependency Graph）

### 4A.1 为什么需要依赖图

跨阶段上下文检查的范围**严格由决策依赖图决定**，不允许使用关键词匹配或
独立定义检测规则。依赖图定义了"哪些上游阶段的哪些决策字段是下游阶段的
强制输入"。只有图中存在 `dependsOn` 关系的字段才纳入跨阶段检查范围。

### 4A.2 完整依赖图

```
S1 用户访谈
  输出字段:
    - founderMotivation     → 被 S2, S3, S4, S6 依赖
    - observations          → 被 S2, S4 依赖
    - confirmedProblems     → 被 S2, S3, S6 依赖
    - constraints           → 被 S2, S6 依赖

S2 商业背景分析
  dependsOn: [S1.founderMotivation, S1.observations, S1.confirmedProblems, S1.constraints]
  输出字段:
    - businessBackground    → 被 S3, S6 依赖
    - strategicChallenge    → 被 S3, S4, S6 依赖
    - businessModel         → 被 S3 依赖
    - currentStage          → 被 S3 依赖

S3 市场机会分析
  dependsOn: [S1.founderMotivation, S1.confirmedProblems, S2.businessBackground, S2.strategicChallenge, S2.businessModel, S2.currentStage]
  输出字段:
    - marketOverview        → 被 S4, S5, S6 依赖（marketSize/growthRate/marketStage/channelStructure）
    - industryTrend         → 被 S4, S5 依赖（currentTrends/longTermTrends）
    - channelAnalysis       → 被 S5, S6 依赖（mainChannels/trafficRules/acquisitionPatterns）
	    - regulatoryEnvironment → 被 S6 依赖（policies/risks）
	    - categoryStatus        → 被 S4, S5, S6 依赖（definition/currentState/trends）
	    - experienceGaps        → 被 S4, S6 依赖（gap/currentAlternative/severity）
	    - opportunityDirections → 被 S5, S6 依赖（direction/rationale/evidenceLevel）

S4 消费者洞察
  dependsOn: [S1.founderMotivation, S1.observations, S2.strategicChallenge, S3.marketOverview, S3.industryTrend, S3.opportunityDirections, S3.categoryStatus, S3.experienceGaps]
  输出字段:
    - userPersona           → 被 S6 依赖
    - decisionMotive        → 被 S5, S6 依赖
    - functionalNeeds       → 被 S5, S6 依赖
    - identityNeeds         → 被 S6 依赖（S6 必须显式引用此字段）
    - behaviorPattern       → 被 S5, S6, S8 依赖
    - consumptionScenario   → 被 S6, S8 依赖

S5 竞争判断
  dependsOn: [S3.marketOverview, S3.industryTrend, S3.opportunityDirections, S3.categoryStatus, S3.experienceGaps, S3.channelAnalysis, S4.decisionMotive, S4.functionalNeeds, S4.behaviorPattern]
  输出字段:
    - competitiveLandscape  → 被 S6, S7 依赖（dimensions/convergenceAndDivergence）
    - competitors[]         → 被 S6, S7 依赖（positioning/priceRange/heroProducts/visualSystem/communication/strengths/weaknesses/opportunityGap）
    - competitiveGap       → 被 S6 依赖（S6 必须显式引用此字段：competitiveGap + competitors[].opportunityGap）

S6 品牌核心战略（战略枢纽）
  dependsOn: [以上全部]
  强制引用约束:
    - 必须显式引用 S4.identityNeeds（身份认同层判断）
    - 必须显式引用 S5.competitiveGap 和 S5.competitors[].opportunityGap（竞争空位判断）
    - 品牌定位不能脱离 S3.opportunityDirections 和 S5.competitiveGap 独立生造
  输出字段:
    - positioning           → 被 S7, S8 依赖
    - valuePropositions     → 被 S7, S8 依赖（functional/emotional/social 三层）
    - brandStory            → 被 S7, S8 依赖（struggleMoment/brandAction/brandRelationship）
    - brandPersonality      → 被 S7, S8 依赖（trait/dos/donts）
    - reasoning             → 被 Audit 依赖（marketOpportunityReference/consumerInsightReference/competitiveGapReference）

S7 视觉策略
  dependsOn: [S5.competitiveLandscape, S5.competitors[], S6.positioning, S6.valuePropositions, S6.brandStory, S6.brandPersonality]
  输出字段:
    - visualDirection       → 被 S8 依赖
    - designPrinciples      → 被 S8 依赖
    - colorSystem           → 被 S8 依赖
    - imageryStyle          → 被 S8 依赖

S8 内容规划
  dependsOn: [S4.behaviorPattern, S4.consumptionScenario, S6.positioning, S6.valuePropositions, S6.brandStory, S6.brandPersonality, S7.visualDirection, S7.designPrinciples, S7.colorSystem, S7.imageryStyle]
  输出字段：
    - contentStrategy
    - contentPillars
    - audienceEngagement
```

### 4A.3 依赖图的使用方式

- **Cross Stage Context Check 的检查范围**：仅检查依赖图中定义了 `dependsOn` 关系的字段。
  不存在于依赖图中的字段对，即使名称相似，也不做跨阶段检查。
- **禁止关键词匹配**：不因"S5 输出中提到某个词、S6 没提到这个词"而报问题。
  只检查依赖图中明确定义的字段引用关系。
- **禁止独立定义检测规则**：每条跨阶段检测规则必须对应依赖图中的一条 `dependsOn` 边，
  不允许在依赖图之外单独维护一份检测规则。

---

## 04.B Cross Stage Context Check 详细设计

### 4B.1 Layer 1：引用完整性检查（Reference Integrity Check）

**技术实现**：纯代码比对，不使用 LLM。

**触发条件**：只要当前阶段在决策依赖图中存在 `dependsOn` 关系就触发。
不等待阶段质量达标——即使 Rule Check 发现字段缺失、AI Audit 评分低，
引用完整性检查仍然运行。

**检查逻辑**：

```
对于当前阶段 dependsOn 列表中的每个依赖项（例如 S4 依赖 S1.founderMotivation）：
  1. 检查 S1.founderMotivation 是否在数据库中已存在
  2. 检查当前阶段 Convergence 输出 JSON 的 dataSources 数组中
     是否包含对 S1.founderMotivation 的引用记录
  3. 如果依赖字段存在但当前阶段未引用 → 引用缺失
  4. 如果依赖字段本身不存在（上游阶段未产出）→ 标记为上游缺失，非当前阶段问题
```

**输出格式**：

```json
{
  "type": "reference_integrity",
  "issues": [
    {
      "severity": "error",
      "currentStage": "S6",
      "missingReference": "S4.identityNeeds",
      "message": "S6 品牌定位未引用 S4 身份认同层判断，但决策依赖图要求此引用",
      "dependencyPath": "S4.identityNeeds → S6.positioning (via reasoning.consumerInsightReference)"
    }
  ]
}
```

### 4B.2 Layer 2：语义断裂检查（Semantic Break Check）

**技术实现**：需要 LLM 判断。

**触发条件（严格）**：
- 仅在阶段级 Rule Check + AI Quality Audit 评分达到 **Reoptimize 门槛以上**
  （即分数 ≥ Reoptimize 阈值下限）时才触发
- 如果阶段评分连 Reoptimize 都没达到（即 Block 状态），跳过语义断裂检查——
  此时阶段本身质量问题还没解决，检查跨阶段语义断裂没有意义

**调用约束（关键）**：
- **不能发起第二次独立 LLM 调用**
- 必须作为 AI Quality Audit **同一次调用的可选附加段落**
- 在 AI Quality Audit 的 system prompt 末尾，根据当前阶段的 `dependsOn`
  动态拼接一段"跨阶段语义连贯性检查"的 instruction
- AI Quality Audit 的 JSON 输出中增加一个可选字段 `crossStageSemantics`，
  仅当该阶段存在 `dependsOn` 且阶段质量达标时，才要求 LLM 填充此字段

**检查逻辑（由 LLM 在 AI Quality Audit 同一次调用中执行）**：

```
给定：
  - 当前阶段的 Convergence 输出（待检查的 JSON）
  - dependsOn 列表对应的上游阶段关键字段内容
  - 依赖图中定义的强制引用约束（如 S6 必须引用 S4.identityNeeds）

LLM 判断以下问题：
  1. 当前阶段的结论是否与上游的核心判断存在逻辑矛盾？
     例如：S4 说用户核心需求是"省时"，S6 的品牌定位却围绕"仪式感"展开，
     且没有解释这个转变的依据
  2. 当前阶段是否将上游的具体洞察做了不当抽象或曲解？
     例如：S4 说"用户在深夜使用"，S6 将其直接等同于"用户需要放松"，
     但未说明这个推导的依据
  3. 上游的关键约束或限制条件在当前阶段是否被忽略？
     例如：S2 说"预算仅够覆盖一线城市"，S6 的品牌扩张路径却直接假设全国市场

注意：语义断裂检查不判断"结论是否正确"，只判断"结论是否与上游判断存在
未解释的跳跃或矛盾"。如果当前阶段提供了合理的依据来解释这个跳跃，
则不算语义断裂。
```

**输出格式**（嵌入在 AI Quality Audit 的返回 JSON 中）：

```json
{
  "crossStageSemantics": {
    "hasIssues": true,
    "issues": [
      {
        "type": "semantic_break",
        "severity": "warning",
        "currentStageField": "positioning",
        "upstreamField": "S4.identityNeeds",
        "description": "S4 结论用户身份认同为'高效育儿者'，S6 品牌定位为'陪伴式成长'，两者之间缺少推导依据",
        "gapDetail": "从'高效'到'陪伴'的转变没有解释，可能改变了品牌方向但未说明原因"
      }
    ]
  }
}
```

### 4B.3 门禁规则

| 检查类型 | 门禁行为 |
|---|---|
| Layer 1 引用缺失（severity: error） | **强制触发至少 Reoptimize**。即使阶段评分达到 Advance 阈值，存在引用缺失也必须回退优化 |
| Layer 1 引用缺失（severity: warning） | 不触发硬门禁，记录在 Audit Result 的 issues 列表中 |
| Layer 2 语义断裂 | **不单独构成门禁**。语义断裂问题仅作为阶段级评分的参考依据之一，反映在四维评分中 Evidence 维度的扣分上；不会因为语义断裂就单独触发 Reoptimize 或 Block |

### 4B.4 全阶段完成后的全量扫描

触发时机：全部 8 个阶段完成、报告组装之前。

这是一个独立的全量扫描——遍历完整决策依赖图的每一条边，执行 Layer 1 引用完整性检查。
由于每个阶段完成时已经跑过一轮，这次全量扫描主要捕获：
- 后期阶段更新后，早期阶段引用路径断裂
- 用户在 S8 完成后回头修改了 S3 的决策，但 S5、S6 未重新运行

全量扫描的结果在报告组装前的 Quality Gate 中展示，如果存在 error 级别的引用缺失，
报告组装暂停并提示用户处理。

### 设计原则

所有 Stage 使用统一一级评价模型：

| 维度 | 英文 | 作用 |
|------|------|------|
| 具体度 | Specificity | 判断是否具体明确 |
| 差异化 | Differentiation | 判断是否形成独特判断 |
| 可执行性 | Actionability | 判断是否指导下一步行动 |
| 证据支撑 | Evidence | 判断依据是否合理 |

但是不同 Stage：
- 权重不同
- 二阶指标不同
- 证据要求不同
- 门禁阈值不同

---

### S1 用户访谈 User Interview

**Stage Objective**

目标：从创业者输入中提取：
- 创业背景
- 初始想法
- 用户问题
- 商业假设

核心问题：为什么做这个品牌？目前知道什么？不知道什么？

**四维权重**

| 维度 | 权重 | 说明 |
|------|------|------|
| Specificity 具体度 | 35% | 需要具体到经历、场景、问题 |
| Differentiation 差异化 | 15% | 此阶段不要求品牌定位 |
| Actionability 可执行性 | 30% | 是否支持后续研究 |
| Evidence 证据 | 20% | 允许主观经验输入 |

**二阶指标体系**

Specificity 指标：
- 创业背景明确度 — 为什么开始这个项目
- 个人动机明确度 — 创业者真实驱动力
- 用户问题具体度 — 是否描述真实问题
- 使用场景明确度 — 问题发生在哪里

Differentiation 指标：
- 创业者独特优势 — 资源、经验、能力
- 已有认知差异 — 不同于普通创业想法
- 初始品牌假设 — 是否形成初步判断

Actionability 指标：
- 研究方向明确 — 下一步需要验证什么
- 关键问题提取 — 是否形成待解决问题
- 信息完整度 — 支持下一阶段分析

**Evidence**

允许：

| Evidence Level | 类型 |
|----------------|------|
| Level 1 | 创始人经历 |
| Level 2 | 用户反馈 |
| Level 4 | 已有销售数据 |

非必要：Level 3 市场报告

**门禁阈值**

| Decision | Score |
|----------|-------|
| Advance | ≥70 |
| Reoptimize | 50-69 |
| Block | <50 |

---

### S2 商业背景与战略方向 Business Context

**Stage Objective**

明确：
- 商业模式
- 产品基础
- 当前阶段
- 战略挑战

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 30% |
| Differentiation | 20% |
| Actionability | 35% |
| Evidence | 15% |

**二阶指标**

Specificity 指标：
- 商业模式明确度 — 如何赚钱
- 产品定义明确度 — 卖什么
- 目标市场范围 — 服务谁
- 当前阶段明确度 — 探索/验证/增长

Differentiation 指标：
- 资源优势
- 能力优势
- 创业机会特殊性

Actionability 指标：
- 战略问题定义
- 目标明确性
- 下一步决策方向

**Evidence**

允许：
- 产品资料
- 用户反馈
- 当前经营数据

不要求：市场规模数据

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥75 |
| Reoptimize | 55-74 |
| Block | <55 |

---

### S3 市场机会 Market Opportunity

**Stage Objective**

判断：市场是否存在进入机会。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 25% |
| Differentiation | 25% |
| Actionability | 20% |
| Evidence | 30% |

**二阶指标**

Specificity 指标：
- 市场范围明确
- 品类边界明确
- 消费需求明确
- 增长趋势明确

Differentiation 指标：
- 市场空白发现
- 竞争缺口
- 新机会判断
- 机会独特性

Actionability 指标：
- 是否影响品牌定位
- 是否指导用户选择
- 是否支持产品方向

**Evidence**

优先：

| Level | 类型 |
|-------|------|
| Level 3 | 行业数据 |
| Level 3 | 消费趋势 |
| Level 2 | 用户反馈 |

允许：创始观察作为 Hypothesis

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥75 |
| Reoptimize | 55-74 |
| Block | <55 |

---

### S4 消费者洞察 Consumer Insight

**Stage Objective**

找到：消费者为什么购买。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 35% |
| Differentiation | 25% |
| Actionability | 20% |
| Evidence | 20% |

**二阶指标**

Specificity 指标：
- 用户画像明确
- 生活场景明确
- 触发事件明确
- 情绪需求明确
- 消费行为描述

Differentiation 指标：
- 独特心理洞察
- 未满足需求
- 潜在消费机会

Actionability 指标：
- 影响产品设计
- 影响品牌表达
- 影响传播策略

**Evidence**

允许：
- 用户访谈
- 用户评论
- 创始观察
- 市场数据

要求：必须区分：

```
Fact → Inference → Hypothesis
```

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥75 |
| Reoptimize | 55-74 |
| Block | <55 |

---

### S5 竞争判断 Competitive Landscape

**Stage Objective**

找到：竞争位置和品牌机会。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 25% |
| Differentiation | 35% |
| Actionability | 25% |
| Evidence | 15% |

**二阶指标**

Specificity 指标：
- 竞品选择准确
- 竞争分类合理
- 比较维度清晰

Differentiation 指标：
- 竞争模式识别
- 品牌空位
- 替代关系分析
- 差异机会

Actionability 指标：
- 指导定位
- 指导视觉
- 指导内容

**Evidence**

允许：
- 产品分析
- 用户评价
- 品牌资料

**门禁**：Advance ≥75

---

### S6 品牌核心战略 Brand Core Strategy

**Stage Objective**

形成：品牌定位系统。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 30% |
| Differentiation | 30% |
| Actionability | 30% |
| Evidence | 10% |

**二阶指标**

Specificity 指标：
- 目标用户明确
- 品类明确
- 价值主张明确
- 使用场景明确

Differentiation 指标：
- 定位独特性
- 品牌核心冲突
- 竞争替代能力
- 品牌记忆点

Actionability 指标：
- 产品指导
- 视觉指导
- 内容指导
- 增长指导

**Evidence**

要求：来自 S1-S5 累计依据

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥80 |
| Reoptimize | 60-79 |
| Block | <60 |

---

### S7 视觉策略 Visual Strategy

**Stage Objective**

战略转译为视觉系统。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 25% |
| Differentiation | 35% |
| Actionability | 30% |
| Evidence | 10% |

**二阶指标**

Specificity 指标：
- 视觉关键词
- 色彩方向
- 字体方向
- 图形语言
- 摄影语言

Differentiation 指标：
- 区别竞品视觉
- 符合品牌人格
- 形成视觉资产
- 建立识别系统

Actionability 指标：
- 设计可执行
- 系统可延展
- 适配传播场景

**Evidence**

依据：
- 品牌战略
- 消费者洞察
- 竞争视觉分析

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥80 |
| Reoptimize | 60-79 |
| Block | <60 |

---

### S8 内容规划 Content Strategy

**Stage Objective**

建立长期内容资产。

**四维权重**

| 维度 | 权重 |
|------|------|
| Specificity | 25% |
| Differentiation | 25% |
| Actionability | 40% |
| Evidence | 10% |

**二阶指标**

Specificity 指标：
- 内容主题明确
- 用户场景明确
- 平台明确
- 表达形式明确

Differentiation 指标：
- 内容角度独特
- 品牌表达一致
- 内容资产价值

Actionability 指标：
- 内容支柱
- 选题体系
- 发布节奏
- 渠道策略
- 长期资产规划

**Evidence**

依据：
- 消费者洞察
- 品牌战略
- 用户行为反馈

**门禁**

| Decision | Score |
|----------|-------|
| Advance | ≥80 |
| Reoptimize | 60-79 |
| Block | <60 |

---

### 8 Stage Audit Config 总览

| Stage | 核心评价重点 | 最高权重维度 |
|-------|-------------|-------------|
| S1 用户访谈 | 理解创业者 | Specificity 35% |
| S2 商业背景 | 战略问题定义 | Actionability 35% |
| S3 市场机会 | 机会真实性 | Evidence 30% |
| S4 消费者洞察 | 用户理解深度 | Specificity 35% |
| S5 竞争判断 | 差异机会 | Differentiation 35% |
| S6 品牌战略 | 战略完整性 | 四维均衡 |
| S7 视觉策略 | 视觉差异化 | Differentiation 35% |
| S8 内容规划 | 执行体系 | Actionability 40% |

---

## 06（原编号 07）Evidence Framework

### 6.1 核心原则

不是：所有阶段都要求外部数据。

而是：不同阶段接受不同证据。

### Evidence Level

| Level | 名称 | 类型 | 适用于 |
|-------|------|------|--------|
| Level 0 | 无依据 | — | — |
| Level 1 | Founder Evidence | 创始经历、创业观察 | S1 |
| Level 2 | User Evidence | 用户访谈、用户反馈 | S1-S4 |
| Level 3 | Market Evidence | 行业报告、市场趋势 | S2-S5 |
| Level 4 | Validation Evidence | 销售数据、实验结果 | S6-S8 |

---

## 07（原编号 08）AI 评分模型

### 7.1 单维评分

每个维度：1-5 分。

输出：

```json
{
  "dimension": "specificity",
  "score": 4,
  "weight": 0.35,
  "reason": "",
  "evidence_used": "",
  "improvement": ""
}
```

### 7.2 综合计算

```
Final Score = Σ (Dimension Score × Stage Weight)
```

---

## 08（原编号 09）Quality Gate

### 8.1 决策原则

不是：分数决定一切。

而是：

```
Rule Result + AI Score + Cross Stage Context → Decision
```

### 8.2 三态模型（含跨阶段门禁规则）

**Advance**

条件：
- 无严重 Rule Error
- 无 Layer 1 引用缺失（severity: error 级别）
- AI 评分达到阶段 Advance 阈值

结果：进入下一 Stage。

**Reoptimize**

触发条件（满足任一）：
- Rule Check 发现中等严重度问题
- Layer 1 引用缺失（severity: error）→ **强制至少 Reoptimize**
- AI 评分处于 Reoptimize 区间
- AI 评分达到 Advance 但存在 error 级引用缺失 → 仍需 Reoptimize

触发：AI 优化循环。

**Block**

触发条件（满足任一）：
- Rule Check 发现核心字段缺失或 JSON 结构错误
- AI 评分低于 Block 阈值（阶段本身质量问题严重）
- 注意：Layer 2 语义断裂**不单独触发 Block**，仅作为评分参考

结果：停止流程，必须人工修改后重新 Audit。

### 8.3 跨阶段问题的门禁行为总结

| 检查结果 | 门禁行为 |
|---|---|
| Rule Check error | 强制 Block（核心字段缺失/JSON 错误）或 Reoptimize（中等严重度） |
| AI Quality Audit 评分 | 按阶段阈值判断 Advance / Reoptimize / Block |
| Layer 1 引用缺失 (error) | 强制至少 Reoptimize，即使 AI 评分已达 Advance |
| Layer 1 引用缺失 (warning) | 不触发硬门禁，记录在 issues 列表 |
| Layer 2 语义断裂 | **不单独构成门禁**，仅作为 Evidence 维度的扣分参考 |
| 全量扫描 引用缺失 (error) | 报告组装暂停，提示用户处理 |

---

## 09（原编号 10）Reoptimization Loop

流程：

```
AI Audit → Optimization Feedback → Stage AI Agent → New Output → Audit Again
```

防止无限循环。

配置：`MAX_REOPTIMIZE_COUNT = 3`

---

## 10（原编号 11）数据结构设计

### Stage Audit Config

```json
{
  "stageId": "S4",
  "dimensionWeights": {
    "specificity": 35,
    "differentiation": 25,
    "actionability": 20,
    "evidence": 20
  },
  "secondaryMetrics": [],
  "allowedEvidence": [],
  "threshold": 75
}
```

### Audit Result

```json
{
  "stageId": "",
  "score": 0,
  "dimensionScores": {},
  "issues": [],
  "evidenceAssessment": {},
  "decision": "advance"
}
```

---

## 11（原编号 12）测试方案

### 11.1 Rule Engine Test

验证：schema、field、conflict

### 11.2 Stage Audit Test

覆盖 S1-S8，测试：
- 正常案例
- 低质量案例
- 越界案例

### 11.3 Human Calibration

指标：
- AI vs 人工评分差异
- MAE
- Correlation
- Stage Accuracy

---

## 12（原编号 13）版本规划

### V2.0

完成：
- ✅ Rule / AI 分离
- ✅ 四维评分模型
- ✅ Stage 权重
- ✅ Evidence Framework
- ✅ Quality Gate
- ✅ Audit Engine（动态 Prompt + 证据检测）
- ✅ StageNav 审计状态
- ✅ 三状态 Audit Card（Advance / Reoptimize / Block）
- ✅ Audit 触发反馈 + Loading 状态
- ✅ 三个用户操作（AI 优化 / 人工修改 / 保持当前判断）

### V2.1

完成：
- ✅ 人工校准 — CalibrationService + 持久化存储 + 统计报告
- ✅ 阈值调整 — ThresholdTuner + 自动调优脚本 + 备份机制
- ✅ Prompt 优化 — promptVersion v2 系统 + 二阶指标逐项评分 + 校准上下文注入

### V2.2

完成：
- 自动学习人工反馈
- 权重动态优化

---

## 13 Audit Experience Design（审计 UI 需求）

### 13.1 产品定位

**背景**

AI Brand OS 已具备：

- Stage 工作流
- AI 品牌战略生成
- Decision Memory
- Strategic Quality Audit System（含 Stage Audit Engine 三组件）
- Quality Gate

审计系统能够判断：

- 当前 Stage 输出质量（Rule + AI Audit）
- 跨阶段引用完整性（Cross Stage Context Check Layer 1）
- 跨阶段语义连贯性（Cross Stage Context Check Layer 2）
- 是否具备进入下一阶段条件
- 是否需要优化

### 13.2 设计目标

建立一个**面向品牌决策流程的轻量化 AI 审计反馈界面**。

**目标 1**：让用户快速理解当前阶段状态。用户无需阅读复杂指标。

**目标 2**：将 AI 审计结果转化为行动建议。从"评分低"变成"哪里需要优化，如何处理"。

**目标 3**：保留创始人最终决策权。AI 提供建议，创始人可以：接受、修改、坚持当前判断。

**目标 4**：**不新增界面元素。** 跨阶段问题并入现有 Reoptimize/Advance 卡片的问题列表展示。
不展示"哪里做得好"，继续复用「智能优化 / 手动调整 / 保持当前决策」三个按钮。

---

### 13.3 Audit UI 触发机制

**原则**：Audit 不通过固定按钮触发。AI Brand OS 是对话式 Agent，因此用户自然语言确认阶段完成时触发。

**用户触发示例**：

| 用户输入 | 系统行为 |
|---------|---------|
| "可以了" | 识别 Stage Completion Intent |
| "确认这个方向" | 触发 Stage Output → Stage Audit Engine（三组件） → Quality Gate → Audit UI |
| "继续下一步" | 同上 |
| "进入消费者洞察吧" | 同上 |
| "这个方案没问题" | 同上 |

---

### 13.4 整体交互流程

```
用户与 Stage Agent 对话
        ↓
AI 生成阶段结论
        ↓
用户确认阶段完成
        ↓
触发 Stage Audit Engine（每次阶段完成时）
  ├── Rule Check（代码比对）
  ├── AI Quality Audit（LLM 调用）
  └── Cross Stage Context Check
       ├── Layer 1: 引用完整性检查（代码比对，有依赖即触发）
       └── Layer 2: 语义断裂检查（LLM，同一调用附加段落，质量达标才触发）
        ↓
Quality Gate 判断
  （Rule + AI Score + Cross Stage Context → Decision）
        ↓
    ┌───────┬───────┬───────┐
    ↓       ↓       ↓       ↓
Advance  Reoptimize  Block
    ↓       ↓       ↓       ↓
用户选择下一步动作
```

---

### 13.5 Audit UI 信息架构

**核心原则：用户端只展示三层**

| 层级 | 内容 | 示例 |
|------|------|------|
| 第一层 | 结果状态 | ✅ 已通过 / ⚠ 需优化 / ⛔ 已阻断 |
| 第二层 | 关键原因（含跨阶段问题） | "市场机会定义清晰" / "未引用 S4 消费者身份认同判断" |
| 第三层 | 下一步操作 | [进入下一阶段] / [AI 自动优化] / [返回修改] |

**不展示**：
- ❌ "哪里做得好"（用户不需要被表扬）
- ❌ 权重、二阶指标、Evidence Level、完整评分过程（均在高级展开层可选查看）
- ❌ 独立的跨阶段审计卡片或面板

**跨阶段问题的展示方式**：跨阶段问题（Layer 1 引用缺失、Layer 2 语义断裂）不另建 UI，
直接并入现有 Advance / Reoptimize / Block 三状态卡片的"关键原因 / 问题列表"中，
与其他问题使用相同格式展示。

---

### 13.6 Audit Loading 状态

使用场景：用户确认阶段后。

**展示内容**：

```
正在进行战略质量检查...

当前阶段：市场机会分析

正在评估：
✓ 阶段输出完整性
✓ 战略推导合理性
✓ 跨阶段上下文连贯性
```

**设计要求**：避免"AI 正在思考"。改为展示审计目的——让用户知道系统在检查什么。

---

### 13.7 Audit Result 三状态设计

#### A. Advance（阶段通过）

使用场景：`GateDecision = advance`

展示位置：
1. **ChatPanel** — 主要展示位置
2. **StageNav** — 状态标识（如 "S3 市场机会 ✓ 已通过"）
3. **Report 页面** — 顶部状态 Banner

**UI 结构**：

```
┌──────────────────────────────────┐
│  ✅ 阶段已通过                     │
│                                  │
│  市场机会分析具备进入消费者洞察      │
│  阶段的基础。                      │
│                                  │
│  关键依据：                        │
│  ✓ 市场机会定义清晰                 │
│  ✓ 用户需求方向明确                 │
│  ✓ 具备合理证据支持                 │
│                                  │
│  [进入下一阶段]                     │
└──────────────────────────────────┘
```

**展示内容**：
- 必须：当前状态、一句话总结、2-3 个通过原因、下一步操作
- 不展示：四维评分、权重、详细审计指标、"哪里做得好"

**跨阶段结果融入**：如果当前阶段通过了全部检查（包括 Layer 1 引用完整性通过），
在"关键依据"中增加一条"✓ 跨阶段引用完整"。不单独展示引用检查详情。

#### B. Reoptimize（需要优化）

使用场景：`GateDecision = reoptimize`

展示位置：
1. **ChatPanel** — 核心展示位置
2. **StageNav** — 状态："S3 ⚠ 优化中"

**UI 结构**：

```
┌──────────────────────────────────┐
│  ⚠ 当前阶段建议优化                 │
│                                  │
│  AI 发现：                        │
│  1. 市场机会范围较宽                │
│  2. 竞争差异依据不足                │
│  3. 未引用 S1 中已确认的用户问题     │  ← 跨阶段 Layer 1 问题，同一格式
│                                  │
│  建议：                            │
│  补充用户需求和竞争分析。            │
│  将品牌定位与 S4 消费者身份认同      │  ← 跨阶段 Layer 2 问题，同一格式
│  判断建立关联。                     │
│                                  │
│  请选择下一步：                     │
│  [智能优化] [手动调整] [保持当前决策]   │
└──────────────────────────────────┘
```

**问题列表规则（含跨阶段问题合并）**：
- Top 问题最多展示 **5 个**（阶段级 + 跨阶段合并）
- 阶段级问题按 AI 评分中的 severity 排序
- 跨阶段问题与阶段级问题**使用完全相同的展示格式**（编号 + 描述），不区分来源
- 不展示"以下问题来自阶段审计 / 以下问题来自跨阶段检查"的分类标签

**三个操作说明**：

| 操作 | 按钮文案 | 流程 |
|------|---------|------|
| **智能优化** | 智能优化 | Audit Feedback → Stage Agent 优化 → 重新生成 Stage Output → 重新 Audit（含跨阶段） |
| **手动调整** | 手动调整 | 返回当前 Stage → 用户修改 → 重新确认 → 重新 Audit |
| **保持当前决策** | 保持当前决策 | Founder Override：记录 stageId + reason + timestamp，允许继续流程 |

注意：按钮文案从原来的"AI 自动优化 / 我来修改 / 保持当前判断"改为
「智能优化 / 手动调整 / 保持当前决策」，更贴近创始人日常用语。

#### C. Block（阻断）

使用场景：`GateDecision = block`

展示位置：
1. **ChatPanel** — 强提示
2. **StageNav** — 状态："S3 🔒 已阻断"

**UI 结构**：

```
┌──────────────────────────────────┐
│  ⛔ 当前阶段无法继续                │
│                                  │
│  原因：                            │
│  缺少市场机会验证依据。              │
│  S4 消费者洞察的 identityNeeds     │  ← 如有跨阶段引用缺失，与阶段问题合并
│  字段未被当前阶段引用。              │     展示，不区分来源
│                                  │
│  需要补充：                        │
│  • 市场范围                        │
│  • 用户需求                        │
│  • 竞争分析                        │
│                                  │
│  [返回修改]                        │
└──────────────────────────────────┘
```

**展示内容**：
- 必须：阻断原因、缺失内容、修改入口
- 不展示：复杂评分、大量解释

---

### 13.8 StageNav 审计状态展示

**状态类型**：

| 状态 | 标识 | 含义 |
|------|------|------|
| Passed | ✓ | 已通过审计（含引用完整性检查通过） |
| Reoptimizing | ⚠ | 优化中 |
| Blocked | 🔒 | 阻断 |
| Locked | 🔒 | 未开放（依赖阶段未完成） |

---

### 13.9 Audit Detail 展开层（非默认）

高级用户可查看。默认折叠，手动展开。仅展示阶段级审计详情，
跨阶段检查详情（Layer 1 引用完整性扫描结果、Layer 2 语义断裂详情）
可在同层展开，不作为独立面板。

**包含内容**：

**战略质量评分（四维）**：

| 维度 | 评分 |
|------|------|
| Specificity 具体度 | ████░ 4/5 |
| Differentiation 差异化 | ███░░ 3/5 |
| Actionability 可执行性 | ████░ 4/5 |
| Evidence 证据支撑 | ██░░░ 2/5 |

**跨阶段引用检查**（仅在存在 dependsOn 的阶段展示）：

```
引用完整性：
✓ S1.founderMotivation → 已引用
✓ S3.opportunityDirections → 已引用
✗ S4.identityNeeds → 未引用（依赖图要求 S6 必须引用）
```

**Reoptimization History**：

```
优化记录：
Round 1 → 62 分
Round 2 → 74 分
Round 3 → ✅ 通过
```

---

### 13.10 与现有组件映射

| 组件 | 调整方向 |
|------|---------|
| `QualityPanel.tsx` | 从"评分展示"改为"决策反馈展示" |
| `ChatPanel.tsx` | 接入三状态 Audit Card，跨阶段问题合并展示 |
| `StageNav.tsx` | 增加门禁状态标识 |
| `project/page.tsx` | 消费新版 `AuditResult`（含 `crossStageContext` 字段） |
| `report/page.tsx` | 仅展示最终状态 |
| `useChat.ts` | 新增 `stage_blocked` / `stage_reoptimize` SSE 事件处理 |

**不新增的组件**：
- ❌ 独立跨阶段审计面板
- ❌ 跨阶段问题独立卡片
- ❌ "哪里做得好"展示区块

---

### 13.11 MVP UI 范围

**第一阶段必须实现**：

- ✅ Audit 触发反馈（含跨阶段检查）
- ✅ Loading 状态
- ✅ Advance 卡片（含跨阶段引用检查通过标识）
- ✅ Reoptimize 卡片（阶段问题 + 跨阶段问题合并展示，最多 5 条）
- ✅ Block 卡片
- ✅ 三个用户操作（智能优化 / 手动调整 / 保持当前决策）
- ✅ StageNav 状态

**后续优化（暂不实现）**：

- 完整审计报告页
- 雷达图
- 复杂历史趋势
- 人工校准界面

---

### 13.12 最终设计原则总结

> AI Brand OS Audit UI 不应该成为"AI 给品牌方案打分的工具"。
>
> 而应该成为"AI 帮助创始人在品牌决策节点判断'是否继续、如何优化、是否坚持'的决策反馈系统"。

用户最终只需要看到三个问题：

1. **现在状态是什么？**
2. **为什么？**（含跨阶段引用问题，但不区分来源）
3. **下一步怎么做？**

其余复杂审计逻辑（包括跨阶段上下文检查的 Layer 1/Layer 2 细节）
由系统内部完成，不在 UI 上暴露独立模块。

---

## 14 结论

这个版本的 Strategic Quality Audit System 将 AI Brand OS 从：

**单维度质量检查（Rule + AI 评分）**

升级为：

```
每个阶段完成时：
  Rule Check → AI Quality Audit → Cross Stage Context Check
                                    ├── Layer 1: 引用完整性（代码比对）
                                    └── Layer 2: 语义断裂（LLM 同调用附加段落）

全部阶段完成后：
  全量依赖图遍历扫描 → 报告组装前的最终 Quality Gate
```

关键架构决策：
1. **跨阶段审计不是独立模块**，是 Stage Audit Engine 的第三个组件，与 Rule Check / AI Quality Audit 并列
2. **检查范围严格由决策依赖图决定**，不使用关键词匹配或独立检测规则
3. **Layer 2 语义断裂不发起第二次 LLM 调用**，作为 AI Quality Audit 同一次调用的可选附加段落
4. **前端不新增界面元素**，跨阶段问题并入现有 Reoptimize/Advance 卡片

形成真正的 **AI Native Brand Consulting Workflow with Cross-Stage Strategic Integrity**。
