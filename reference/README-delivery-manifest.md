# 交付清单与工程接入说明

## 16 个文件清单

| Stage | Consultation | Convergence | 对应报告章节 |
|---|---|---|---|
| 1 用户访谈 | stage1-consultation.md | stage1-converge.md | 无独立章节,信息供下游引用 |
| 2 品牌背景与战略方向 | stage2-consultation.md | stage2-converge.md | 01 |
| 3 市场机会 | stage3-consultation.md | stage3-converge.md | 02 |
| 4 消费者洞察 | stage4-consultation.md | stage4-converge.md | 03 |
| 5 竞争判断 | stage5-consultation.md | stage5-converge.md | 04 |
| 6 品牌核心战略 | stage6-consultation.md | stage6-converge.md | 05 |
| 7 视觉策略 | stage7-consultation.md | stage7-converge.md | 06 |
| 8 内容策略 | stage8-consultation.md | stage8-converge.md | 07 |

建议存放路径:`src/lib/ai/prompts/`,与你现有的 `loader.ts` 机制保持一致,
文件命名已直接对齐,可直接放入替换。

## 架构已更新:移除独立 translator.ts,语言标准内嵌进 Convergence

经确认,不再使用独立的 translator.ts 作为 AI 转换层,原因是每多一次
AI 调用,就多一次"看起来在优化语言、实际在引入新走样"的风险——
上一版报告里出现的语法断裂问题(如"有 待 验 证 存 在 一 个 市 场 空
白"),正是这类问题的真实案例。

域风格指南的内容没有被丢弃,而是拆解后直接合并进对应 Stage 的
Convergence Prompt 里(新增"Output Language Standard"章节),
同时在合并过程中剔除了"结构性矛盾""战略窗口""供需错配""认知资产"
这类对独立创始人来说过重、容易把基于有限证据的判断包装成确定
结论的词汇,替换为更平实、分量匹配证据强度的表达。

更新后的架构:

```
Stage 1-8 Convergence(提取信息 + 直接产出报告级语言，语言标准已内嵌)
        ↓
cleaner.ts
├── 安全自动修复层：括号/引号/破折号/感叹号/省略号（纯正则，无损）
└── 违规检测层：绝对化词汇/过大词汇/第一人称/口语连接词/访谈痕迹
      检测未通过 → 携带具体违规位置，重新调用同一 Stage 的
      Convergence Prompt 只重新生成违规字段，最多重试 3 次，
      3 次仍未通过则标记待人工复核，不阻塞流程
        ↓
consistency-check.ts(七章节间术语一致性扫描)
        ↓
report/assemble.ts → PDF
```

这个架构下,`¥0` 额外 API 成本的诉求得以保留——cleaner.ts 的机械
修复和检测部分是纯正则,不产生额外 API 调用;唯一的额外 API 成本
来自触发重试时对同一 Stage Convergence Prompt 的重新调用,而这属于
"确保质量的必要重试",不是新增的独立转换层。

## 工程改动清单(需要你确认后再动手)

1. **Zod schema**:新增 `BusinessContext`(Stage 2)、`ConsumerInsight`
   (Stage 4)两个类型;原 `MarketInsights` 中的 `targetAudienceDraft`
   字段迁移到 `ConsumerInsight`
2. **workflow.ts**:阶段依赖链从原来的顺序改为 Stage 1-8 共 8 步,
   且每步内部拆分成 Consultation 和 Convergence 两次独立调用——
   这意味着单个阶段的完成,现在对应两次 AI 调用而非一次,`route.ts`
   的流式响应逻辑需要相应调整,建议先确认调用时序方案(是用户确认
   Consultation 总结后立即触发 Convergence,还是有额外的中间步骤)
3. **decision-memory.ts**:决策点需要按新的 8 阶段重新分配归属
4. **router.ts**:需要区分当前处于某阶段的 Consultation 还是
   Convergence 子状态

## 建议的验证顺序

不要一次性把 8 个阶段全部接入生产。建议先只接入 Stage 1 → Stage 2
两步,验证:
1. Consultation 确认后触发 Convergence 的调用时序是否顺畅
2. Convergence 输出的 JSON 是否真的做到了"归纳而非摘录"——用一份
   包含"猫玩几秒就不玩了"这类具体原话的真实 Stage 1 数据跑一遍
   Stage 2,检查 `businessContext.businessBackground` 字段是否已经
   是归纳后的商业语言,而不是原话的直接搬运
3. 验证通过后再批量接入剩余 6 个阶段

## 一处需要你注意的设计取舍

Stage 6(品牌核心战略)是本次重构中我完全基于域风格指南和其余阶段
写作规范重新设计的,你上传的文件列表中提到了 `stage4-strategy.md`
但其内容没有出现在本次对话的文档中。建议你拿这次设计的 Stage 6
和你原有的 `stage4-strategy.md` 做一次逐条比对,看是否有你原来已经
验证过、但这次重新设计时遗漏的有效追问逻辑或挑战规则,如有请补充
进来,而不是完全推翻重来。
