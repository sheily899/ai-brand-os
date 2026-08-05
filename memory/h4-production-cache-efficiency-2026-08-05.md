---
name: h4-production-cache-efficiency-2026-08-05
description: H4 S8 Production Cache Efficiency Test — 真实生产链路(含Search Context+Decision Memory)，跨项目首次调用节省69.6%，质量零影响
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# H4 S8 Production Cache Efficiency Test

**日期**: 2026-08-05
**实验 ID**: f6d8cfff
**测试脚本**: `scripts/test-prompt-cache-h4.ts`
**报告**: `docs/prompt-cache-report-v2.md`

## 与 H2/H3 的关键区别

H2/H3 跳过了 consultation.ts 完整流程，没有注入 Search Context 和 Decision Memory。H4 使用 `loadPrompt()` + `buildMessages()` 完整生产链路，包含：
- Search Context (~1,482 chars 真实搜索结果模拟)
- Decision Memory (~1,180 chars S1-S7 战略资产)
- Conversation History (6 轮模拟对话 + 轮次信号)

## 核心结论: H4 ✅ PASS

### H4.1 Cache Efficiency: ✅ 69.6% 节省 (阈值 ≥30%)

### H4.2 Quality: ✅ Cold=Warm=73.0 (零方差)

## Token 组成 (生产环境)

| 组成 | 估算 Token | 可缓存 |
|------|-----------|--------|
| Stage Template + Search Protocol | ~6,756 | ✅ 固定前缀 |
| Search Context | ~741 | ❌ 每个项目不同 |
| Decision Memory | ~590 | ❌ 每个项目不同 |
| Conversation History | ~851 | ❌ 每轮递增 |
| User Message | ~135 | ❌ 每次不同 |
| **总计** | **~9,072** | **74.5% 固定** |

## 关键发现: 两种 Cache 场景

### 场景 1: 跨项目首次调用 (Warm-1) → 69.6% 节省
- cache_hit = 6,528 (template+protocol 固定前缀)
- billable = 2,852 (Search Context + Decision Memory + History，项目特定)
- **这是生产环境的真实节省比例**

### 场景 2: 同项目重复调用 (Warm-2~10) → 99.6% 节省
- cache_hit = 9,344 (几乎全部 prompt，因为 Warm-1 写入了完整缓存)
- billable = 36 (仅轮次信号变化)
- 同一用户在同一项目内多次 S8 咨询的场景

## 关键表述修正

❌ ~~"固定 Prompt 层可减少 90% 以上输入 token"~~ (仅适用于无搜索上下文的实验环境)

✅ "DeepSeek Prefix Cache 可以稳定缓存固定战略框架层。在真实 S8 生产流程中，跨项目首次调用的实际 input token 节省约为 **70%**。同项目内重复调用接近 100%。"

## H2/H3 → H4 演进

| 环境 | 实验 | 固定前缀占比 | Cache 节省 |
|------|------|-------------|-----------|
| 实验环境 | H2/H3 | ~96% | ~95% |
| 生产首次 | **H4 Warm-1** | **~74.5%** | **~69.6%** |
| 生产重复 | H4 Warm-2~10 | ~74.5% | ~99.6% |

## 风险

- S3 搜索量最大 (Phase 6.1: avg 15,586 tokens/call)，Search Context 可能 5,000-8,000 tokens → 实际节省可能仅 ~50%
- Prompt 模板更新会导致缓存前缀变化 → 需要重新预热
- S2/S3/S5 尚未验证，不能直接迁移 S8 结论

**How to apply:** H4 提供了生产环境的真实 cache 效率基线 (69.6%)。对外表述 cache 收益时应使用 70% 而非 95%。S3 需要单独验证（搜索上下文最大）。
