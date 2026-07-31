# 8 阶段重构:架构说明与迁移指南

> 更新说明:本文档最初按"单 Prompt 内联输出 JSON"的旧架构撰写。
> 经确认,最终架构改为**双 Prompt 体系**——每个阶段拆成 Consultation
> (多轮探索式访谈,不输出 JSON)和 Convergence(独立调用,读取完整对话
> 记录,只输出结构化 JSON)两个独立 Prompt。7 个报告章节对应 Stage 2-8,
> Stage 1 用户访谈不单独成章,但其原始信息会被 Stage 2-8 的 Consultation
> 和 Convergence 两侧共同引用。实际交付的 16 个文件见本目录清单。

## 为什么要拆成 8 个阶段,而不是 6 个

原有六阶段最根本的问题是:**"收集信息"和"提炼战略"这两件事,在 Stage 1 和 Stage 2
里被压缩成了一步**。Stage 1 收集了创始人原话("猫玩几秒就不玩了""觉得不可爱"),
但从来没有一个阶段真正对这些原话做"这意味着什么商业背景""这意味着什么消费者动机"
这样的战略抽象——直接从"创始人说了什么"跳到了"市场机会是什么",中间缺了一层。

新架构把这层缺失的分析动作,拆成了两个独立、显式、可验证的阶段:

- **Stage 2 商业背景分析(新增)**:把 Stage 1 里的 `founderMotivation`、
  `confirmedProblems`、`constraints` 这些原始信息,提炼成结构化的行业环境判断、
  创业动机分析、战略挑战定义——对应域风格指南 `01-business-background.md`
- **Stage 4 消费者洞察(新增,从原 Stage 2 市场分析中独立出来)**:把原来只有
  一句话带过的 `targetAudienceDraft`,升级为决策动机、行为模式、
  功能层+身份认同层的深度需求分析——对应域风格指南 `03-consumer-insight.md`

## 完整数据流

```
Stage 1 用户访谈
  输出: FounderVision(原始信息,不做分析)
        ↓
Stage 2 商业背景分析(新增)
  输入: FounderVision
  输出: BusinessContext ——→ 对应报告 01 品牌背景与战略方向
        ↓
Stage 3 市场机会分析(原 Stage 2,收窄范围)
  输入: FounderVision + BusinessContext
  输出: MarketInsights ——→ 对应报告 02 市场机会
        ↓
Stage 4 消费者洞察(新增)
  输入: FounderVision + BusinessContext + MarketInsights
  输出: ConsumerInsight ——→ 对应报告 03 消费者洞察
        ↓
Stage 5 竞争判断(原 Stage 3)
  输入: 以上全部 + ConsumerInsight
  输出: CompetitiveInsights ——→ 对应报告 04 竞争判断
        ↓
Stage 6 品牌核心战略(原 Stage 4,本次基于域风格指南重新构建)
  输入: 以上全部
  输出: BrandStrategy ——→ 对应报告 05 品牌核心战略
        ↓
Stage 7 视觉策略(原 Stage 5)
  输入: 以上全部
  输出: VisualStrategy ——→ 对应报告 06 视觉策略
        ↓
Stage 8 内容规划(原 Stage 6)
  输入: 以上全部
  输出: ContentStrategy ——→ 对应报告 07 内容策略
```

## 核心原则的延续与新增

以下原有六阶段中已经验证有效的铁律,在新八阶段中原样保留,不做改动:

- **一次一问**:每条回复只能有一个"？"
- **内部指令不可见**:框架术语、退出条件、检查清单不出现在对话中
- **信息证据分层**:Fact / Inference / Hypothesis 三层必须严格区分,
  且贯穿全部 8 个阶段,不只是 Stage 1-3 的专利
- **追问模糊词**:遇到"好看""专业""年轻人"等模糊词必须追问,
  两次追问后仍模糊则标记为待验证,不再纠缠
- **退出机制表格 + 退出模板 + JSON 输出**的三段式结构

新增的原则(专门针对这次重构要解决的问题):

- **禁止跳级引用原始口述**:任何分析类阶段(Stage 2、4、5、6)在输出结论时,
  不能直接把创始人或用户的原话作为战略结论呈现,必须先完成
  "原始信息 → 行为事实 → 洞察 → 结论"的推导链,并在 JSON 中明确记录
  这条推导链的中间步骤,而不只是记录最终结论——这样翻译层拿到的
  就已经是分析后的战略语言,而不是需要翻译层自己去"美化"的原始口述
- **上游阶段的核心判断须作为下游阶段的强制输入**:比如 Stage 6
  品牌定位阶段,必须显式引用 Stage 4 消费者洞察中的身份认同层判断
  和 Stage 5 竞争判断中的心智空位判断,不能脱离这两个阶段独立生造定位

## 与域风格指南的对应关系(不需要大改域风格指南的原因)

你之前确认域风格指南基本不会大改,这是合理的——因为域风格指南解决的是
"这句话该用什么语域",而这次重构解决的是"这句话在进入翻译层之前,
战略内容本身是否已经正确"。两者分工不同,互不冲突:

| 新阶段 | 输出类型 | 对应域风格指南 |
|---|---|---|
| Stage 2 商业背景分析 | BusinessContext | 01-business-background.md |
| Stage 3 市场机会分析 | MarketInsights | 02-market-opportunity.md |
| Stage 4 消费者洞察 | ConsumerInsight | 03-consumer-insight.md |
| Stage 5 竞争判断 | CompetitiveInsights | 04-competitive-judgment.md |
| Stage 6 品牌核心战略 | BrandStrategy | 05-brand-strategy.md |
| Stage 7 视觉策略 | VisualStrategy | 06-visual-strategy.md |
| Stage 8 内容规划 | ContentStrategy | 07-content-strategy.md |

## 需要你确认的工程改动

这次重构不是纯 prompt 层面的调整,涉及以下代码改动,建议你在接入 AI 生成
prompt 之前先确认方案:

1. **Zod schema 需要新增两个类型**:`BusinessContext`(Stage 2)、
   `ConsumerInsight`(Stage 4),并从原 `MarketInsights` 中移除
   `targetAudienceDraft` 字段(迁移到新的 `ConsumerInsight` 中)
2. **workflow.ts 的阶段依赖链需要更新**为 8 阶段顺序,原本 4 个阶段的
   `stageOrder` 需要改为 8 个
3. **decision-memory.ts 的决策点定义**需要拆分或新增,原来归属
   "品牌策略阶段"的决策点,现在有一部分应该归属新的 Stage 2 和 Stage 4
4. **router.ts 的阶段判断逻辑**需要识别新的阶段数量

以上属于代码架构改动,建议先用一个试点(比如只跑通 Stage 1→2→3 三个阶段)
验证数据流通顺,再批量迁移剩余阶段。
