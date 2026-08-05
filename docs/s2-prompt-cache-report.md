# S2 Business Background — H1-H4 Complete Validation Report

> **日期**: 2026-08-05 | **实验 ID**: 1d5408e5 | **模型**: deepseek-chat
> **阶段**: S2 品牌背景与战略方向 | **品牌**: 慢象咖啡 (精品咖啡)
> **链路**: loadPrompt() → buildMessages() → provider.chat()

---

## H1: System Prompt 结构验证

| 指标 | 值 | 状态 |
|------|-----|------|
| Stage Template | 13,769 bytes | — |
| Search Protocol | 20,295 bytes | — |
| **Cacheable Prefix** | **34,064 bytes (~33KB)** | ✅ ≥25KB |

---

## H2: Token Cache 验证

| Trial | Prompt | Cache Hit | Cache Miss | Billable |
|-------|--------|-----------|------------|----------|
| Cold-1 | 10,078 | 0 | 10,078 | 10,078 |
| Cold-2 | 10,077 | 0 | 10,077 | 10,077 |
| Cold-3 | 10,078 | 0 | 10,078 | 10,078 |
| Cold-4 | 10,080 | 0 | 10,080 | 10,080 |
| Cold-5 | 10,079 | 0 | 10,079 | 10,079 |
| Warm-1 ⬅跨项目首次 | 10,059 | 7,680 | 2,379 | 2,379 |
| Warm-2 | 10,059 | 9,984 | 75 | 75 |
| Warm-3 | 10,059 | 9,984 | 75 | 75 |
| Warm-4 | 10,059 | 9,984 | 75 | 75 |
| Warm-5 | 10,059 | 9,984 | 75 | 75 |
| Warm-6 | 10,059 | 9,984 | 75 | 75 |
| Warm-7 | 10,059 | 9,984 | 75 | 75 |
| Warm-8 | 10,059 | 9,984 | 75 | 75 |
| Warm-9 | 10,059 | 9,984 | 75 | 75 |
| Warm-10 | 10,059 | 9,984 | 75 | 75 |

**H2: ✅ PASS** — Warm 全部 cache_hit>0，固定前缀被 DeepSeek disk cache 命中。

---

## H4: Production Cache Efficiency

### Token 组成

| 组件 | 估算 Token | 可缓存 |
|------|-----------|--------|
| Stage Template + Search Protocol | 7,878 | ✅ 是 |
| Search Context (动态) | 565 | ❌ 否 |
| Decision Memory S1 (动态) | 268 | ❌ 否 |
| Conversation History (动态) | 985 | ❌ 否 |
| Current User Message (动态) | 84 | ❌ 否 |
| **总计** | **9,780** | |
| **固定前缀 (可缓存)** | **7,878** | |
| **动态内容 (不可缓存)** | **1,902** | |

| 指标 | 值 |
|------|-----|
| 固定前缀占比 | 80.6% |
| 动态内容占比 | 19.4% |
| **跨项目首次节省** | **76.4%** |
| 同项目重复节省 | ~99% |

### 成本估算

| 场景 | 值 |
|------|-----|
| Cold billable | 10078 |
| Warm billable (跨项目首次) | 2,379 |
| 单次节省 | 7699 tokens |
| 年度节省 (50次/天) | 140,514,050 tokens ($19.67) |

### H4: ✅ PASS (76.4% ≥ 30%)

---

## H3: Quality Validation (Frozen Input, N=5 each)

| Trial | Specificity | Differentiation | Evidence | Executability | Total |
|-------|------------|-----------------|----------|---------------|-------|
| Q-Cold-1 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-2 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-3 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Cold-4 | 4.0 | 4.0 | 3.0 | 4.0 | 75 |
| Q-Cold-5 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Warm-1 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Warm-2 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Warm-3 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Warm-4 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |
| Q-Warm-5 | 5.0 | 4.0 | 4.0 | 5.0 | 93 |

### 统计对比

| Group | Specificity | Differentiation | Evidence | Executability | Total |
|-------|------------|-----------------|----------|---------------|-------|
| Quality-Cold | 4.4 | 3.6 | 3.4 | 4.4 | 81 |
| Quality-Warm | 5.0 | 4.0 | 4.0 | 5.0 | 93 |

### H3 结论

Quality comparison: Δ needs ≥-0.3 per dimension. See audit data above.

---

## Summary

| # | 标准 | 条件 | 实际 | 结果 |
|---|------|------|------|------|
| H1 | Prefix size | ≥25KB | 34,064 bytes | ✅ |
| H2 | Cache hit | Warm >0 | cache_hit=7,680 | ✅ |
| H3 | Quality | Δ≥-0.3 | See audit | 见审计 |
| H4 | Efficiency | 节省≥30% | 76.4% | ✅ |

### 🏁 S2 结论: DeepSeek Prefix Cache 在 S2 生产流程中节省 76.4% input token，固定前缀占比 80.6%。

---

## S2/S3/S5/S8 交叉对比

| 阶段 | 固定前缀占比 | 生产节省 | DM规模 | Search Context |
|------|------------|---------|--------|---------------|
| S2 | 80.6% | 76.4% | S1 | ~565 tokens |
| S3 | 77.1% | 72.9% | S1-S2 | ~765 tokens |
| S5 | TBD | TBD | S1-S4 | TBD |
| S8 | 74.5% | 69.6% | S1-S7 | ~741 tokens |
