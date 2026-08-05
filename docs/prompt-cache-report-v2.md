# H4 S8 Production Cache Efficiency Report

> **日期**: 2026-08-05
> **实验 ID**: f6d8cfff
> **模型**: deepseek-chat
> **阶段**: S8 内容策略 (Consultation + Convergence)
> **品牌案例**: 慢象咖啡 (精品咖啡)
> **链路**: loadPrompt() → buildMessages() → provider.chat() (完整生产链路)

---

## 1. 实验设计

### 与 H2/H3 的关键区别

| 维度 | H2/H3 | H4 (本实验) |
|------|-------|-----------|
| System Prompt | 仅模板 + 搜索协议 | 模板 + 协议 + Search Context + Decision Memory |
| Search Context | ❌ 不包含 | ✅ 真实搜索结果模拟 (~1,482 chars) |
| Decision Memory | ❌ 不包含 | ✅ S1-S7 战略资产 (~1,180 chars) |
| Conversation History | ❌ 无历史 | ✅ 6 轮模拟对话 + 轮次信号 |
| 调用方式 | provider.chat() 直调 | buildMessages() 完整构造 (匹配 consultation.ts) |
| 轮次信号 | ❌ 无 | ✅ `> 当前为本阶段第 N 轮对话` |
| 接近生产程度 | 30% | **90%** |

### 为什么 H4 更接近生产？

H2/H3 的 system prompt 只包含固定前缀（模板 + 搜索协议），跳过了 consultation.ts 中注入的动态上下文。在生产中，`loadPrompt()` 还会追加:

1. **Search Context** — Search Intelligence Layer 的搜索结果
2. **Decision Memory** — S1-S7 的战略资产积累
3. **Conversation History** — 前序轮次的对话

这些动态内容位于缓存前缀之后，不同项目/用户的 Search Context 和 Decision Memory 各不相同。

### 实验分组

| 组别 | N | System Prompt | 目的 |
|------|---|--------------|------|
| Cold | 5 | 唯一 UUID 前缀 | 模拟"缓存完全未命中"（baseline） |
| Warm | 10 | 完全相同的生产 prompt | 模拟"生产用户连续调用" |
| Quality-Cold | 5 | 唯一 UUID 前缀 + Frozen Input | 质量 baseline |
| Quality-Warm | 5 | 相同生产 converge prompt + Frozen Input | 验证 cache 不影响质量 |

### Warm 组内部有两种场景

| 场景 | 对应 Trial | 生产含义 |
|------|-----------|---------|
| **跨项目首次调用** | Warm-1 | 新用户第一次 S8 咨询。固定前缀被历史系统调用缓存，但 Search Context + Decision Memory 是全新的 |
| **同项目重复调用** | Warm-2~10 | 同一用户在同一项目内多次 S8 咨询。Search Context + Decision Memory 也被 Warm-1 写入了缓存 |

---

## 2. Token 组成分析

### 完整 Prompt 拆解（字符级测量）

| 组成 | 字符数 | 估算 Token | 可缓存? | 生产场景 |
|------|--------|-----------|---------|---------|
| Stage Template (S8 consultation) + Search Protocol | 13,511 | ~6,756 | ✅ 是 | 所有项目共享 |
| Search Context | 1,482 | ~741 | ❌ 否 | 每个项目不同 |
| Decision Memory | 1,180 | ~590 | ❌ 否 | 每个项目不同 |
| Conversation History | 1,701 | ~851 | ❌ 否 | 每轮递增 |
| Current User Message + Round Signal | 269 | ~135 | ❌ 否 | 每次不同 |
| **总计** | **18,143** | **~9,072** | | |

### 关键比例

| 指标 | H2/H3 (实验) | H4 (生产) |
|------|-------------|----------|
| 固定前缀占比 | ~96% | **74.5%** |
| 动态内容占比 | ~4% | **25.5%** |
| 理论最大 Cache 节省 | ~96% | **~74.5%** |

> **核心发现**: 在生产环境中，约 1/4 的 prompt token 是项目特定的动态内容（Search Context + Decision Memory + History），无法被跨项目缓存。因此实际 cache 节省不可能达到 H2/H3 的 95%+ 水平。

---

## 3. Cache 实验结果

### Cold Group (N=5) — Baseline（缓存完全未命中）

| Trial | Prompt | Cache Hit | Cache Miss | Billable | Latency |
|-------|--------|-----------|------------|----------|---------|
| Cold-1 | 9,399 | 0 | 9,399 | 9,399 | 9,690ms |
| Cold-2 | 9,396 | 0 | 9,396 | 9,396 | 7,274ms |
| Cold-3 | 9,397 | 0 | 9,397 | 9,397 | 21,685ms |
| Cold-4 | 9,396 | 0 | 9,396 | 9,396 | 10,359ms |
| Cold-5 | 9,398 | 0 | 9,398 | 9,398 | 21,870ms |

**Cold stats**: billable = 9,397 ± 1, range [9,396, 9,399]
✅ 所有 Cold 调用 cache_hit=0（唯一前缀标记生效）

### Warm Group (N=10) — 分场景分析

| Trial | Prompt | Cache Hit | Cache Miss | Billable | Hit Rate | 场景 |
|-------|--------|-----------|------------|----------|----------|------|
| Warm-1 | 9,380 | 6,528 | 2,852 | 2,852 | 69.6% | **跨项目首次调用** |
| Warm-2 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-3 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-4 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-5 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-6 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-7 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-8 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-9 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |
| Warm-10 | 9,380 | 9,344 | 36 | 36 | 99.6% | 同项目重复调用 |

### 关键分析：Warm-1 揭示的真实生产数据

```
Warm-1: cache_hit = 6,528
        ├── 固定前缀 (Template + Protocol): ~6,528 tokens → ✅ 缓存命中（历史系统调用预热）
        └── 动态内容 (Search Context 1,482 + Decision Memory 1,180 + History 1,701 + User 269)
            = ~2,852 tokens → ❌ 全新内容，未命中缓存，billable
```

**Warm-1 的 69.6% hit rate 就是生产环境的真实 cache 效率。**

固定前缀 6,528 tokens 被 DeepSeek disk cache 命中（因为 H2/H3 等历史实验已用过相同的 S8 consultation 模板+协议），但项目特定的 Search Context 和 Decision Memory 是第一次出现，必须按 billable 计费。

### Warm-2~10：为什么显示 99.6%？

Warm-2 到 Warm-10 的 cache_hit = 9,344 tokens（几乎全部 prompt），因为：
- Warm-1 将**完整 prompt**（包括 Search Context + Decision Memory）写入了 DeepSeek disk cache
- Warm-2~10 使用了**完全相同的** Search Context 和 Decision Memory
- 只有轮次信号 `> 当前为本阶段第 4 轮对话` 不同（~36 tokens 的差异）

这在生产中对应"同一用户在同一项目内连续多轮 S8 咨询"场景，此时几乎所有内容都被缓存。

### 两个场景的 Cache 节省对比

| 场景 | Billable (Cold baseline: 9,397) | 节省比例 | 生产对应 |
|------|-------------------------------|---------|---------|
| 跨项目首次 S8 调用 | 2,852 (Warm-1) | **69.6%** | 新用户/新项目首次进入 S8 |
| 同项目重复 S8 调用 | 36 (Warm-2~10) | **99.6%** | 同一项目内的后续 S8 轮次 |
| **H4.1 判断基线** | **2,852** | **69.6%** | — |

---

## 4. 实际成本收益

### H4.1 判断

| 指标 | 值 | 阈值 | 结果 |
|------|-----|------|------|
| 跨项目首次调用节省 | **69.6%** | ≥30% | ✅ **PASS** |
| 同项目重复调用节省 | 99.6% | ≥30% | ✅ PASS |

**H4.1: ✅ PASS** — 在生产环境中，即使注入 Search Context 和 Decision Memory 后，DeepSeek Prefix Cache 仍可节省 **69.6%** 的 input token 成本，远超 30% 阈值。

### 单次 S8 Consultation 成本

| 场景 | Billable Input | 节省 vs Cold | 成本 (@$0.14/1M tokens) |
|------|---------------|-------------|------------------------|
| Cold (无缓存) | 9,397 | — | $0.00132 |
| Warm (跨项目首次) | 2,852 | 6,545 tokens (69.6%) | $0.00040 |
| Warm (同项目重复) | 36 | 9,361 tokens (99.6%) | $0.00001 |

### 规模化估算（基于跨项目首次调用场景）

| 场景 | 估算值 |
|------|--------|
| 单次 S8 节省 | 6,545 billable input tokens |
| 每天 50 次 S8 调用 (不同项目) | 327,250 tokens/天 |
| **年度估算 (365天)** | **~119M tokens/年** |
| 年度成本节省 | **~$16.74/年** |

> **注意**: 
> 1. 这是仅 S8 阶段的节省，且假设每次都是"新项目首次调用"（最保守估计）
> 2. 同一项目内的重复调用节省接近 100%，实际混合场景的节省会更高
> 3. S2/S3/S5 搜索阶段具有相同的 prompt 结构，全阶段合计节省将数倍于此
> 4. DeepSeek 当前定价极低 ($0.14/1M input)，token 节省的经济价值主要体现在规模化后

---

## 5. 质量验证

### 实验方法

Frozen Input + A/B 对照：Cold (N=5) vs Warm (N=5)，使用 S8 converge 模板 + 相同 S1-S7 战略上下文 + 固定用户任务。temperature=0, seed=42。

### AI Quality Audit 结果

| Trial | Specificity | Differentiation | Evidence | Executability | Total |
|-------|------------|-----------------|----------|---------------|-------|
| Q-Cold-1 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-2 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-3 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-4 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Cold-5 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Warm-1 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Warm-2* | 3.0 | 3.0 | 3.0 | 3.0 | 60 |
| Q-Warm-3 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Warm-4 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |
| Q-Warm-5 | 4.0 | 3.0 | 3.0 | 4.0 | 73 |

> \* Q-Warm-2 的 audit 结果 (60) 是 **测量误差**，非真实质量差异。原因是 AI Quality Audit 的 JSON 响应被截断（response length 限制），导致解析失败后 fallback 评分。排除此异常点后，Cold 和 Warm 评分完全相同。

### 四维评分统计（排除异常值）

| Dimension | Cold (mean ± std) | Warm (mean ± std, excl Q-Warm-2) | Δ | Pass |
|-----------|-------------------|--------------------------------|----|------|
| Specificity | 4.0 ± 0.0 | 4.0 ± 0.0 | 0.0 | ✅ |
| Differentiation | 3.0 ± 0.0 | 3.0 ± 0.0 | 0.0 | ✅ |
| Evidence | 3.0 ± 0.0 | 3.0 ± 0.0 | 0.0 | ✅ |
| Executability | 4.0 ± 0.0 | 4.0 ± 0.0 | 0.0 | ✅ |
| **Total** | **73.0 ± 0.0** | **73.0 ± 0.0** | **0.0** | ✅ |

### 结构完整性

> **方法说明**: Quality Validation 使用 S8 converge 模板，输出为 JSON 格式（非 markdown）。结构检查的 markdown 正则模式不适用于 JSON 输出，此项不纳入 H4 判断。实际的 JSON 结构校验由 Zod schema 在生产 flow 中完成。H3 V2 实验已验证 Cold/Warm 组的输出在内容结构上完全一致 (20/20)。

### H4.2 质量验证结论

| 标准 | 条件 | 结果 |
|------|------|------|
| Quality | Δ ≥ -0.3 (所有维度) | ✅ 排除异常值后 Cold=Warm=73.0 |
| Stability | cold_var=0.0, warm_var(excl)=0.0 | ✅ 零方差 |

**H4.2: ✅ PASS** — Cache 不影响生产环境下的输出质量。

---

## 6. 综合结论

### H4 通过标准检查

| # | 标准 | 条件 | 实际 | 结果 |
|---|------|------|------|------|
| H4.1 | Cache Efficiency | 生产节省 ≥ 30% | **69.6%** | ✅ |
| H4.2 | Quality | Cold≈Warm (Δ≥-0.3) | 73.0=73.0 | ✅ |
| — | Fixed prefix stability | Cold cache_hit=0, Warm prefix hit | ✅ | ✅ |

### 🏁 H4 最终结论: ✅ PASS

**DeepSeek Prefix Cache 可以稳定缓存 AI Brand OS 固定战略框架层。在真实 S8 生产流程中：**

1. **固定前缀命中率**: 100%（Warm 1-10 全部命中），证明 template + search protocol 组成的固定前缀被 DeepSeek disk cache 稳定缓存
2. **实际 token 节省**: **69.6%**（跨项目首次调用），远高于 30% 阈值
3. **动态上下文占比**: 25.5%（Search Context + Decision Memory + History），这部分不可跨项目缓存
4. **输出质量**: Cache 不影响输出质量（Cold=Warm=73.0，零方差）

### 实验环境 vs 生产环境 完整对比

| 环境 | 实验 | System Prompt 组成 | 固定前缀占比 | Cache 节省 |
|------|------|-------------------|-------------|-----------|
| 纯固定 | H2/H3 | 模板 + 协议 | ~96% | **~95%** |
| 生产首次 | **H4 Warm-1** | **模板 + 协议 + Search + Memory + History** | **~74.5%** | **~69.6%** |
| 生产重复 | H4 Warm-2~10 | 同上（完全相同） | — | ~99.6% |

### 关键表述修正

> ❌ ~~"固定 Prompt 层可减少 90% 以上输入 token"~~
>
> ✅ **"DeepSeek Prefix Cache 可以稳定缓存 AI Brand OS 固定战略框架层（模板+搜索协议）。在真实 S8 生产流程中，由于搜索上下文和 Decision Memory 属于项目特定的动态输入（占总 prompt 约 25%），跨项目首次调用的实际 input token 节省约为 70%。同项目内的重复调用节省接近 100%。"**

---

## 7. 风险说明与后续验证

### 不能直接认为所有阶段收益相同

| 阶段 | 搜索协议 | Search Context 规模 | 固定前缀占比(估) | 预计节省 | 验证状态 |
|------|---------|-------------------|----------------|---------|---------|
| S2 商业背景 | ✅ | 中（行业报告） | ~70% | ~65-70% | ❌ 待测 |
| S3 市场机会 | ✅ | **大**（趋势+消费者数据，最多） | **~50-60%** | **~50-60%** | ❌ 待测 |
| S5 竞争判断 | ✅ | 中（竞品分析） | ~65-70% | ~60-65% | ❌ 待测 |
| S8 内容策略 | ✅ | 中（内容趋势+案例） | ~74.5% | **69.6%** | ✅ 已验证 |

### S3 特别风险

S3 市场机会分析是搜索量最大的阶段（Phase 6.1 数据: avg 15,586 tokens/call，其中 Search Context 可能占 5,000-8,000 tokens）。Search Context 越大，固定前缀占比越低，实际 cache 节省比例可能下降至 50% 左右。需要在 S3 上单独验证。

### 缓存失效场景

1. **Prompt 模板更新**: 任何对 stage template 或 search protocol 的修改都会导致缓存前缀变化 → 所有用户需要重新预热
2. **DeepSeek 服务端策略变化**: disk cache TTL 和容量由 DeepSeek 控制
3. **跨用户 Search Context 差异**: 不同项目/用户的搜索结果不同，这部分天然不可跨项目缓存

---

## 8. 建议

1. **保持 Prompt 稳定性**: 固定框架层（模板 + 搜索协议）的修改应作为 breaking change 管理，每次修改后需要重新预热
2. **考虑 Search Context 缩减**: 搜索结果按相关性排序，只注入 Top-N 最相关结果，可减少动态 token 占比 → 提高缓存效率
3. **Decision Memory 优化**: 对 S1-S7 战略资产做定期压缩（只保留 confirmed facts，去除详细描述），减少不可缓存 token
4. **尽快验证 S2/S3/S5**: S3 的 Search Context 最大，实际节省可能最低，是验证优先级的重点
5. **跨项目缓存预热策略**: 系统启动时或 Prompt 更新后，用一次模拟调用预热固定前缀，确保所有用户首次调用即可享受缓存

---

## 附录：实验原始数据

### 所有 LLM 调用汇总 (35 calls)

| Phase | Calls | Total Prompt | Total Billable | Avg Cache Hit |
|-------|-------|-------------|----------------|---------------|
| Cold (consultation) | 5 | 46,986 | 46,986 | 0 |
| Warm (consultation) | 10 | 93,800 | 3,176 | 90,624 |
| Quality Cold (convergence) | 5 | 48,018 | 48,018 | 0 |
| Quality Warm (convergence) | 5 | 47,935 | 3,261 | 44,672 |
| AI Quality Audits | 10 | ~35,982 | ~7,938 | 28,160 |
| **总计** | **35** | **~272,721** | **~109,379** | **~163,456** |
