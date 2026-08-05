---
name: prompt-cache-experiment-2026-08-05
description: DeepSeek Prompt Cache 验证实验 V2（修正版）— 真正冷启动验证，95% billable token 节省，全10轮质量审计通过
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# Prompt Cache 验证实验 V2（修正版）

**日期**: 2026-08-05
**实验 ID**: 649d77fe
**测试脚本**: `scripts/test-prompt-cache-v2.ts`
**报告**: `docs/prompt-cache-report-v2.md`

## V1 三个异常及根因

| # | 异常 | 根因 |
|---|------|------|
| 1 | R1 "cold" 显示 98% cache_hit | Phase 6.1 测试预热了 DeepSeek disk cache，且 cache 是 prefix-based（跨 session 持久化）。V2 初版 UUID 加在末尾仍不行，改为加在**开头**才实现真 cold |
| 2 | System Prompt 报告 ~13KB vs 预期 ~28KB | 单位混淆：JS `.length` = UTF-16 chars (13,511)，实际 bytes = 28,405 (~28KB)。文件与 loader.ts 生产逻辑完全一致，未遗漏搜索协议 |
| 3 | H3 质量评分全 N/A | V1 访问 `auditResult.scores`（不存在），正确字段是 `auditResult.dimensionScores`。且只审计了 R1/R10 |

## 修正后实验结果

### Token & Cache（真正冷启动）

| Round | Prompt | Cache Hit | Billable | Sav% |
|-------|--------|-----------|----------|------|
| R1 (true cold) | 6,677 | **0** | 6,677 | — |
| R2 (warm) | 6,762 | 6,528 | 234 | 96% |
| R3-R10 (warm) | 6,871-8,249 | 6,656-7,936 | 215-618 | 91-97% |

### AI Quality Audit（全部 10 轮）

| Round | Spec | Diff | Evid | Exec | Total |
|-------|------|------|------|------|-------|
| R1 | 1.0 | 1.0 | 1.0 | 1.0 | 20 |
| R2 | 1.0 | 1.0 | 1.0 | 1.0 | 20 |
| R3 | 2.0 | 3.0 | 2.0 | 3.0 | 52 |
| R4-R5 | 3.0 | 4.0 | 3.0 | 3.0 | 63 |
| R6-R10 | 4.0 | 4.0 | 3.0 | 4.0 | 76 |

注：R1-R2 得分低是因为 AI 在提问阶段（咨询首轮），尚未产出战略内容。R3→R10 评分随对话深度持续上升。无任何轮次任一维度相对 R1 下降超过 0.3。

### 三个假设结论

| 假设 | 结论 | 数据 |
|------|------|------|
| H1: System Prompt 前缀适合缓存 | ✅ PASS | ~28KB (~6,700 tokens) 固定前缀，loadPrompt() 生产组装，10 轮完全一致 |
| H2: Cache 降低 billable token ≥10% | ✅ PASS | 95% 节省（6,677 → 331 avg），远超 10% 阈值 |
| H3: 质量不下降（Δ≤0.3） | ✅ PASS | 全10轮审计，无任何维度下降；质量随对话深度单调上升 |

## DeepSeek Disk Cache 行为特征

- **Prefix-based**: 前缀匹配，修改开头才能改变缓存命中
- **跨 session 持久化**: TTL 远超 5 分钟，一次调用后前缀永久缓存
- **自动粒度**: ~6,500-9,000 tokens 前缀自动识别
- **生产利好**: 首次部署后模板即永久缓存，所有用户受益

## 经济估算（修正）

- 单次 S8 consultation cold: 6,677 billable tokens
- 单次 S8 consultation warm: ~331 billable tokens
- 节省: 95%
- 年节省（50次/天 S8）: ~$31 (DeepSeek $0.27/1M input tokens)
- 全搜索阶段（S2/S3/S5/S8）扩展: ~$124/年

## 代码变更

同 V1（无新增变更）:
- `src/lib/ai/provider/interface.ts`: TokenUsage +cache 字段
- `src/lib/ai/provider/deepseek.ts`: 提取 cache 字段
- `src/lib/db/schema.ts`: token_consumption +5 列
- `src/lib/ai/token-tracker.ts`: billableTokens 计算
- `scripts/test-prompt-cache-v2.ts`: 修正版实验脚本

## V2 关键修正

1. Cold start marker 从**末尾**移到**开头**（DeepSeek prefix-based cache 的关键认知）
2. 使用 `loadPrompt()` 替代手工拼接（确保与生产完全一致）
3. 访问 `dimensionScores` 替代 `scores`
4. 审计全部 10 轮，而非仅 R1/R10

**Why:** V1 因缓存污染、单位混淆、字段名错误三个问题导致结论虽然巧合正确（缓存确实有效），但实验数据不可靠。V2 在真正冷启动条件下验证了所有三个假设，结论与 V1 方向一致但数据更准确。

**How to apply:** 参见 [[prompt-cache-experiment-2026-08-05]] 的下一步建议。注意：年节省仅 ~$31-124，优先解决 LLM 超时保护、S6 审计校准、Layer B 触发验证等可靠性问题后再投入 Prompt Cache 集成。
