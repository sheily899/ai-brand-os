---
name: token-optimization-five-opportunities-analysis
description: 五条 token 优化机会的四步重新校准分析：机会5改为确定性规则、测试集缺口、机会4逐条审查、机会1/5兼容性与实施顺序。后续修正：FIELD_FORWARD_DEPENDENCIES 与 Memory Layer Rules 职责分离，机会5被机会1吸收。
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# Token 压缩五条优化机会 — 重新校准分析 (2026-08-05)

## 背景

基于 H4 实验的 token 组成数据，提出了五条优化机会。用户要求按四步框架重新分析。

## 第一步：机会 5（DM 惰性加载）— 方向证伪，被机会 1 吸收

### 原始思路（已证伪）

基于 `dependency-graph.ts` 中 `FIELD_FORWARD_DEPENDENCIES` 过滤"S8 不需要 S1-S3 的 DM 条目"。

### 为什么方向有问题

1. **Consultation 确实需要全量前序上下文**。S2 的 consultation prompt 明确要求"不要重复询问 Stage 1 已经明确的信息"。让 AI 知道过去发生了什么，是避免冗余对话的前置条件。
2. **S7/S8 的 converge 虽然只需要 S6**（converge prompt 的 Input Description 明确声明只接收 S6），但 consultation 需要感知全部前序。收敛是一回事，咨询是另一回事。
3. **FIELD_FORWARD_DEPENDENCIES 不应承担两个职责**。它描述的是 converge 层面的字段引用关系，不应同时决定 consultation 层面的上下文注入策略。

### 修正结论

机会 5 缩水为机会 1 内部的一个组件。不是"不注入某些阶段"，而是"注入摘要还是原文"——由条目自身属性决定，不由 converge 引用关系间接推导。

---

## 第二步：机会 1/3/4 的回归测试要求

### 当前测试集缺口

`brand-domain-cases.md` 的 44 项验证标准覆盖了 Schema 完整性，但**缺失以下已知修复场景的检查点**：

| # | 已知修复 | 测试集覆盖 | 压缩风险 |
|----|---------|----------|---------|
| 1 | 禁止二选一句式（"是 A 还是 B"） | ❌ | 高 |
| 2 | 创始人类型判断流程（不能二选一确认） | ❌ | 高 |
| 3 | 追问三层递进规则（事实→原因→意义） | ❌ | 中 |
| 4 | 非诱导规则（不预设痛点/心理） | ❌ | 高 |
| 5 | 否定回答后关闭追问路径 | ❌ | 高 |

### 需要补充的检查点

S1 补充: 1.6(二选一禁止), 1.7(创始人类型判断方式), 1.8(三层递进), 1.9(非诱导句式), 1.10(否定关闭)
S2 补充: 2.7(二选一禁止)
S3 补充: 3.x(二选一禁止) — 全 8 阶段审查发现 S3 consultation template 缺少此规则
S5 补充: 5.x(二选一禁止) — 全 8 阶段审查发现 S5 consultation template 缺少此规则

### 判断

⚠️ 实施任何压缩/摘要前，必须先补充测试集检查点并跑通完整基线。

---

## 第三步：机会 4（Template 去冗余）— 风险上调为最高审查

### 跨阶段重复模块

- 禁止二选一句式：S1/S2 各自维护 → 可提取共享（逐字搬运，不改写）
- 追问约束/非诱导规则：仅 S1 有 → 建议共享给 S2-S8，但**逐字保留**
- Exploration Framework：仅 S1 → 不可精简
- 阶段退出机制：S1-S8 全部 8 个阶段各自维护（~20 行/阶段，合计 ~160 行）→ 可提取共享
- 收尾语硬约束：S1-S8 全部 8 个阶段各自维护（~6 行/阶段，合计 ~48 行）→ 可提取共享
- 符号禁止规则：S1-S8 全部 8 个阶段各自维护（~3 行/阶段，合计 ~24 行）→ 可提取共享（S6/S7/S8 额外禁止 `*`，需参数化）

### 不可精简的内容（触碰已知规则）

- S1 "第一步先判断创始人类型"(stage1-consultation.md:127-135)：同时承载"何时判断"+"如何判断合规"两个功能，精简任何子句可能导致二选一确认回退
- S1 非诱导四条子规则(stage1-consultation.md:84-95)：逐字保留，不得改写
- S1 禁止假设性提问(stage1-consultation.md:57-67)：三层递进+跨话题计数(stage1-consultation.md:97-112)：不得精简防跨话题规避
- S2 Boundary "产品细节禁止包装为战略结论"(stage2-consultation.md:300-306)：漏掉则 S2 输出被 S6 误用
- S2 竞争推理类问题禁止(stage2-consultation.md:322-329)：漏掉则 S2 替 S5 下判断
- S3/S5 **缺少**二选一禁止规则（需补充，非保护对象）
- S4 "禁止使用搜索工具"(stage4-consultation.md:92-93)：架构级约束，不是措辞偏好
- S6 "禁止重新收集信息"(stage6-consultation.md:248)：防止 S6 不必要轮次增加
- S6 输出质量标准（22 个禁用词 + 6 种禁用句式）(stage6-consultation.md:124-145)：核心防线
- S6 品类锚定原则(stage6-consultation.md:148-149)：防止脱离品类泛化为"生活方式品牌"
- S7 "视觉判断必须追溯至 S6"(stage7-consultation.md:22-27)：架构级约束
- S7 视觉语言系统五类形态(stage7-consultation.md:85-129)：五类缺一不可
- S8 "品牌调性偏好是已确认约束"(stage8-consultation.md:55-56)：S8 特有硬约束

### 可安全操作

- 提取"禁止二选一"为共享片段（逐字搬运到 loader 层统一注入）
- 提取"阶段退出机制"为共享片段（逐字搬运）
- 提取"收尾语硬约束"为共享片段
- 删除各 converge template 中重复的 JSON 输出格式说明（提取共享）
- 不可改写任何已知修复相关措辞

---

## 第四步：机会 1 与机会 5 的合并方案

### 两链分离原则

核心架构决策：**FIELD_FORWARD_DEPENDENCIES 是 converge 的审计工具，不是 consultation 的压缩工具。**

```
决策链 1：带不带（Semantic Dependency）
  职责：这个阶段和前序阶段是否存在语义关联
  工具：不需要工具——consultation 总是需要全量前序上下文
  结论：all prior DM → 全部注入（保证 AI 知道过去发生了什么）

决策链 2：带多少（Memory Importance Score）
  职责：这个 DM 条目以 summary 还是 fullContent 形式注入
  工具：Memory Importance Score = 条目自身确定性属性加权求和
  评分规则（不使用任何新增元数据字段，所有信号来自现有字段）：
    entryType:
      confirmed_decision         → +3
      confirmed_fact             → +2
      hypothesis                 → 0
      unresolved_question        → 0
    evidenceLevel:
      search_backed              → +2
      search_snippet             → +1
      ai_inferred                → 0
    fieldPath 命中 CORE_STRATEGIC_FIELDS → +2
    contentLength > 阈值                  → +1（弱加分，长不一定重要）
  阈值：≥4 → injectFullContent，否则 summary only
  长度仅为弱加分项（+1），短文本如果是 confirmed_decision + 战略字段（3+2=5≥4）
  仍然触发 fullContent；长文本如果不是关键条目（2+0+0+1=3<4）不会浪费 token
```

### 冲突已不存在

机会 5 被吸收后，不再存在"先过滤阶段再压缩条目"的顺序冲突。实现变为单一路径：

```
buildMemoryContext(projectId, targetStage, { mode: "layered" })
  → 查询全部前序 DM（stageSource < targetStage）
  → 每条注入 summary（始终）
  → injectFullContent 由 Memory Layer Rules（条目属性）决定
  → AI 在 consultation 中不需要知道自己看到的是摘要还是原文
```

### 数据结构

```typescript
// DM 条目现有字段（无需新增列，所有信号来自已有数据）
// entryType: "confirmed_decision" | "confirmed_fact" | "hypothesis" | "unresolved_question"
// evidenceLevel: "search_backed" | "search_snippet" | "ai_inferred"
// fieldPath: 如 "deepNeeds.identityNeed", "founderMotivation.content"
// content: 原始全文
// stageSource: 来源阶段

// 新增：可配置的战略字段列表（集中维护，不散落在评分代码中）
const CORE_STRATEGIC_FIELDS = [
  // S1 创始层
  "founderMotivation.content",
  // S4 消费者深层需求
  "deepNeeds.identityNeed",
  "deepNeeds.functionalNeed",
  // S5 竞争锚点
  "whitespaceOpportunity",
  // S6 战略枢纽
  "positioning",
  "brandStory.struggleMoment",
  "brandStory.brandAction",
  "brandStory.brandRelationship",
  // S7 视觉核心
  "coreConcept",
  // S8 内容核心
  "coreDirection",
];

// 评分函数（纯确定性，不调用 AI）
function computeMemoryImportance(entry: DecisionMemoryEntry): number {
  let score = 0;
  // entryType
  if (entry.entryType === "confirmed_decision") score += 3;
  else if (entry.entryType === "confirmed_fact") score += 2;
  // evidenceLevel
  if (entry.evidenceLevel === "search_backed") score += 2;
  else if (entry.evidenceLevel === "search_snippet") score += 1;
  // fieldPath 战略锚点
  if (CORE_STRATEGIC_FIELDS.some(f => entry.fieldPath.includes(f))) score += 2;
  // 长度弱信号
  if (entry.content.length > LENGTH_THRESHOLD) score += 1;
  return score;
}

// injectFullContent = computeMemoryImportance(entry) >= 4
```

### 评分验证

| DM 条目 | entryType | evidenceLevel | fieldPath | 长度 | 得分 | 结果 |
|---------|-----------|---------------|-----------|------|------|------|
| S6 positioning | confirmed_decision +3 | ai_inferred 0 | 战略 +2 | 超 +1 | **6** | fullContent |
| S4 identityNeed | confirmed_decision +3 | ai_inferred 0 | 战略 +2 | 超 +1 | **6** | fullContent |
| S1 founderMotivation | confirmed_fact +2 | ai_inferred 0 | 战略 +2 | 超 +1 | **5** | fullContent |
| S5 竞品弱点（搜索来源，长） | confirmed_fact +2 | search_backed +2 | 非战略 0 | 超 +1 | **5** | fullContent |
| S3 机会方向（短） | hypothesis 0 | search_backed +2 | 非战略 0 | 未超 0 | **2** | summary |
| S1 普通观察 | confirmed_fact +2 | ai_inferred 0 | 非战略 0 | 未超 0 | **2** | summary |
| S6 brandPersonality trait | confirmed_decision +3 | ai_inferred 0 | 非战略 0 | 未超 0 | **3** | summary |

阈值 ≥4 的边界效果：
- 4 分意味着至少满足 confirmed_decision + 任一加分项，或 confirmed_fact + search_backed + 长度
- 3 分的 case（如 S6 brandPersonality trait）summary 确实足够——它是一个 confirmed_decision 但通常只有一句话
- 短文本战略字段（如一句 positioning 定义）可以通过 confirmed_decision(3) + 战略字段(2) = 5 ≥ 4 触发 fullContent，不需要长度加分
- 长文本非关键条目（如 2+0+0+1=3 < 4）不会被注入全文，避免浪费 token

### Memory Layer Rules 阈值校准

> ⚠️ **"内容长度阈值"待人工校准，非最终值。** 原始分析中出现的 "100 chars" 为占位猜测值，无任何数据支撑。实际阈值应通过以下方法确定：
> 1. 从 5 个已有 E2E 案例的 DM 条目中提取 `entryType === "confirmed_decision"` 的全部条目
> 2. 统计其 content 字段的字符长度分布（预期自然分群为短/中/长三类）
> 3. 人工标注每条"仅 summary 是否足够"，找到从"足够"反转到"不够"的信息密度拐点
> 4. 交叉验证 `search_backed` 类型条目作为校准参照
> 5. 输出带置信区间的推荐阈值范围，而非单一魔法数字

---

## 机会 2：Search Context 截断 — 确认配置

### 架构原则

搜索层负责"找证据"，不是把网页搬进上下文。AI 真正需要的是经过压缩后的证据片段，不是原始资料。建立 **检索→排序→摘要→受控注入** 的 Memory/Search Layer。

### 确认阈值

| 参数 | 文件/位置 | 当前值 | 新值 | 依据 |
|------|----------|--------|------|------|
| topK（URL 抓取数量） | `src/lib/ai/search/index.ts:178` | 5 | **3** | AI 回复通常只引用 2-3 个来源 |
| maxCharsPerSource（单条内容上限） | `src/lib/ai/search/search-context.ts:43` | 3,000 | **800** | 实测 AI 只引用前 200-600 chars 的 bullet points |
| maxTotalSearchChars（全局上限） | 新增于 `search-context.ts` | 无 | **2,500** | 3×800 + 覆盖状态块缓冲，防止异常膨胀 |

保留：source title、URL、summary/关键发现、覆盖状态块（共享搜索协议强制要求）。
不注入：完整抓取内容尾部、重复信息、原始 HTML。

### 预期效果

- 最坏情况：15,000 chars → 2,500 chars（-83%）
- Token 节省：~6,250 tokens/搜索阶段（S2/S3/S5/S8）
- 风险：低（AI 回复中从未引用过 800 chars 之后的内容）

---

## 最终优先级

| 机会 | 优先级 | 前置工作 | 风险 |
|------|---------|---------|------|
| 2. Search Context 截断 | **P0** | 补充测试集 + 回归 | 低 |
| 1. DM 双层结构（含原机会 5） | **P1** | 补充测试集 + 回归 + Memory Layer Rules 阈值校准 | 中 |
| 3. 对话历史滚动摘要 | **P1** | 补充测试集 + 回归 | 中 |
| 4. Template 去冗余 | **P2** | 逐条 line-by-line 审查（已完成全 8 阶段审查）| **最高** |

## 关键依赖

- `src/lib/memory/dependency-graph.ts` — FIELD_FORWARD_DEPENDENCIES (已有 25 个字段条目，仅用于 Cross Stage Context Check 审计，不参与 DM 注入决策)
- `src/lib/memory/decision-memory.ts` — buildMemoryContext() (需增加 mode 参数和 Memory Layer Rules)
- `src/lib/ai/loader.ts` — loadPrompt() (DM 注入点)
- `reference/brand-domain-cases.md` — 测试集 (需补充 8 个检查点：S1 5个 + S2 1个 + S3 1个 + S5 1个)

**Why:** 这是 H4 实验发现"生产节省约 70%"后的自然下一步：不能只依赖 DeepSeek cache，需要从我们自己的 prompt 工程中挤水分。核心原则：让 AI 永远知道过去发生了什么（全量注入），但默认只看到压缩后的战略记忆（摘要），需要时再展开原始信息（Memory Layer Rules 驱动的 fullContent 注入）。FIELD_FORWARD_DEPENDENCIES 专门做 converge 审计，不参与 consultation 压缩——两个决策链职责分离。

**How to apply:** 机会 2 优先实施（改 Search Layer 的 maxResults + 摘要截断长度）。实施前先向 brand-domain-cases.md 补充 8 个检查点并跑通基线。[[h4-production-cache-efficiency-2026-08-05]] [[s2-h4-production-cache-2026-08-05]] [[s3-h4-production-cache-2026-08-05]] [[s5-h4-production-cache-2026-08-05]]
