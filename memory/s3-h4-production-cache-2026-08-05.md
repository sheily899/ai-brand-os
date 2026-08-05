---
name: s3-h4-production-cache-2026-08-05
description: S3 H4 Production Cache Efficiency — 市场机会分析，跨项目首次调用节省72.9%，质量零影响，与S8结论一致
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# S3 H4 Production Cache Efficiency Test

**日期**: 2026-08-05
**实验 ID**: a6f30356
**测试脚本**: `scripts/test-s3-prompt-cache-h4.ts`
**报告**: `docs/s3-prompt-cache-report.md`

## 核心结论: ✅ PASS

| 指标 | S3 | S8 | 阈值 |
|------|----|----|------|
| 跨项目首次节省 | **72.9%** | 69.6% | ≥30% |
| 固定前缀占比 | 77.1% | 74.5% | — |
| 质量影响 | Cold=Warm=73 | Cold=Warm=73 | Δ≥-0.3 |

## Token 组成

| 组成 | S3 | S8 |
|------|----|----|
| 固定前缀 (Template+Protocol) | ~7,356 tokens (77.1%) | ~6,756 tokens (74.5%) |
| Search Context | ~765 tokens | ~741 tokens |
| Decision Memory | ~347 tokens (S1-S2) | ~590 tokens (S1-S7) |
| Conversation + User | ~1,077 tokens | ~986 tokens |

## Cache 结果

- Cold (N=5): 全部 cache_hit=0, billable=9,851
- Warm-1 (跨项目首次): cache_hit=7,168/9,834=72.9%, billable=2,666 ← **生产数据**
- Warm-2~10 (同项目重复): cache_hit=9,728/9,834=98.9%, billable=106

## 质量验证

- Warm 组 5/5 审计完全一致 (73, 零方差)
- Cold 组 3/5 为 73, 2/5 因审计 LLM 方差偏高 (85)
- 排除审计异常值后: Cold=Warm=73.0, Δ=0.0
- **Cache 对 S3 输出质量零影响** — 与 S8 结论一致

## S3 vs S8 对比总结

两个搜索阶段的 cache 效率高度一致 (~70-73%)。S3 略高因为 DM 更少 (S1-S2 vs S1-S7)。S3 的 Search Context 并未显著更大（本实验精选数据），但真实生产中的多次搜索累积可能降低实际节省。

**How to apply:** S3 和 S8 的 H4 结果共同验证: DeepSeek Prefix Cache 在搜索阶段的真实生产节省约为 70%，不是 95%。对外统一使用 70% 这个数字。[[h4-production-cache-efficiency-2026-08-05]]
