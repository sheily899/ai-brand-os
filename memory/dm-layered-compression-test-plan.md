---
name: dm-layered-compression-test-plan
description: Decision Memory 分层压缩机制测试方案 — 验证 layered mode 是否能在保持质量的前提下降低 Token
metadata:
  type: project
  created: 2026-08-05
  parent: token-optimization-five-opportunities-analysis
---

# Decision Memory 分层压缩机制测试方案

## 1. 测试目标

验证 Decision Memory 分层注入机制（Layered Memory Context）是否能够在保持战略质量的前提下降低 LLM 上下文 Token 消耗。

核心验证三个假设：

1. **重要信息保留假设**：高价值战略信息（核心定位、消费者洞察、竞争差异、品牌战略等）能够完整保留，不因压缩丢失。
2. **低价值信息压缩假设**：低重要性 Memory 条目能够通过摘要/截断减少上下文占用，降低 Token 消耗。
3. **质量无损假设**：Memory 压缩后，AI 咨询结果和 Strategic Quality Audit 评分不会出现明显下降。

---

## 2. 实验对象

选择完整 S1-S8 咨询流程作为测试对象。

重点测试阶段：

| 阶段 | 原因 |
|------|------|
| S3 市场机会 | 包含大量 search_backed 事实数据 |
| S4 消费者洞察 | 依赖用户洞察 Memory |
| S5 竞争判断 | 依赖竞品差异信息 |
| S6 品牌核心战略 | 依赖前序战略输入 |
| S8 内容策略 | 上下文依赖最高 |

---

## 3. 实验分组

### Control Group：Full Memory 模式

保持当前逻辑：所有 Memory 完整注入。

流程：Decision Memory → 完整序列化 → LLM Context

记录：Input Tokens / Output Tokens / Total Tokens / Cost / Quality Score

### Experiment Group：Layered Memory 模式

启用 `buildMemoryContext({ mode: "layered" })`

规则：

| 等级 | 处理方式 |
|------|---------|
| 高重要性 (score≥4) | 完整保留 (FULL) |
| 低重要性 (score<4) | 摘要/截断 (SUMMARY) |

---

## 4. 测试数据设计

由于当前真实项目 Memory 较小，无法体现压缩效果，需要增加模拟增长测试。

### Case A：当前真实数据

目的：验证逻辑正确性。预期：12 条 FULL / 33 条 SUMMARY。验证分类是否正确、核心字段是否完整。

### Case B：规模增长模拟

| 规模 | Memory 数量 | 模拟场景 |
|------|-----------|---------|
| Small | 50 条 | 当前项目 |
| Medium | 500 条 | 正常创业品牌运营半年 |
| Large | 5000 条 | 长期品牌运营数据 |

每组随机增加：用户观察、市场事实、内容反馈、历史讨论。

---

## 5. 测试指标

### 5.1 Token 压缩指标

Compression Rate = (Full Mode Tokens - Layered Mode Tokens) / Full Mode Tokens

| 规模 | 目标 |
|------|-----|
| 50 条 | 不要求 |
| 500 条 | ≥20% |
| 5000 条 | ≥50% |

### 5.2 重要信息保留率

Core Retention Rate = 保留的重要字段数量 / 原始重要字段数量。目标：≥95%

### 5.3 质量指标

接入 Strategic Quality Audit。比较四维评分：

| 维度 | 要求 |
|------|------|
| Specificity | 下降≤0.3 |
| Differentiation | 下降≤0.3 |
| Actionability | 下降≤0.3 |
| Evidence | 下降≤0.3 |

---

## 6. 自动化测试实现

新增 `src/tests/cost/memory-compression-test.ts`，包含：

- **Test 1**：重要性评分测试 — `computeMemoryImportance()` 不同 entryType/evidenceLevel/fieldPath 的 score 排序正确
- **Test 2**：分层分类测试 — `buildMemoryContext({ mode: "layered" })` 高价值 FULL / 低价值 SUMMARY
- **Test 3**：Token 消耗对比测试 — Full Mode vs Layered Mode，输出 `{ fullTokens, layeredTokens, compressionRate }`
- **Test 4**：质量回归测试 — 同一品牌案例分别运行 Full Memory 和 Layered Memory，比较 AuditResult

---

## 7. 测试通过标准

- **成本**：Token 下降 ≥20%（在 Medium/Large 数据规模），或 Cost 下降 ≥20%
- **质量**：任何 Audit 维度下降 ≤0.3
- **核心信息**：战略字段保留率 ≥95%

否则测试失败，需要调整 importance score 权重、SUMMARY_MAX_LENGTH 或 FULL/SUMMARY 阈值。

---

## 8. 最终输出报告

生成 `src/tests/cost/memory-compression-report.md`，结构：

1. Test Environment
2. Dataset Size
3. Full Mode Result
4. Layered Mode Result
5. Token Comparison
6. Cost Comparison
7. Quality Comparison
8. Core Memory Retention
9. Conclusion

最终结论需要回答：
1. Decision Memory 是否存在上下文膨胀风险？
2. 分层机制是否有效降低 Token？
3. 压缩是否影响品牌战略质量？
4. 是否可以默认开启 layered mode？

**Why:** 机会 1 的实现已完成但当前真实数据（50 条）压缩率 0%，因为低重要性条目本身就很短。需要构造大规模模拟数据来验证分层机制在 DM 膨胀场景下的实际效果，确保在切换到生产默认值之前有充分的定量证据。

**How to apply:** 先实现 Case B 的数据模拟器（生成 500/5000 条合成 DM 条目），再实现 4 个自动化测试，最后在 Medium/Large 数据集上运行对比实验。[[token-optimization-five-opportunities-analysis]]
