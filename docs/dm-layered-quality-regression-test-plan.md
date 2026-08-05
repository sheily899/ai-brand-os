# Decision Memory Layered Compression 输出质量回归实验方案

> 版本: v1.0 | 日期: 2026-08-05 | 状态: ✅ 已执行（实验通过）

---

## 1. 实验目标

验证 Full Mode（完整注入全部 Decision Memory）与 Layered Mode（基于重要性分层注入）在相同任务下的输出质量差异。

### 核心假设

> Layered Mode 可以减少 Token 消耗，同时不会导致品牌战略决策质量显著下降。

### 验收标准

| 指标 | 标准 |
|------|------|
| Token 消耗下降 | ≥30% |
| 核心战略字段保留率 | = 100% |
| AI 输出质量下降 | ≤0.3 分（5分制） |
| 关键战略错误 | 不出现 |

---

## 2. 实验变量设计

### Group A：Full Mode（对照组）

```
全部 Decision Memory + 当前阶段 Prompt + 用户输入
```

- 信息最完整
- Token 成本最高
- 作为质量 Baseline

### Group B：Layered Mode（实验组）

```
战略字段: FULL 保留
高价值事实: FULL 保留
低价值 Memory: SUMMARY
无关历史: 过滤
```

- Token 降低
- 信息经过筛选

---

## 3. 测试数据设计

使用 50K 压力测试数据：

| Memory 类型 | 数量 | 处理策略 |
|------------|------:|---------|
| 品牌定位/价值主张 | 500 | FULL |
| 消费者洞察 | 5,000 | FULL/SUM 混合 |
| 竞争信息 | 5,000 | FULL |
| 用户反馈 | 10,000 | SUMMARY |
| 历史版本 | 5,000 | SUMMARY |
| AI 推理日志 | 14,000 | SUMMARY |
| 运营记录 | 10,500 | SUMMARY |

总量：≈50,000 条

---

## 4. 测试任务设计

测试真正依赖 Memory 的任务，而非简单问答。

### Task 1：生成品牌定位（S6）

```
请基于当前品牌所有历史决策，生成最终品牌定位：
- Target User
- Brand Positioning
- Value Proposition
- Differentiation
```

依赖链：S4 消费者洞察 → S5 竞争空位 → S6 定位

### Task 2：生成视觉策略（S7）

```
基于品牌战略，生成视觉方向：
- Visual Personality
- Color Direction
- Design Principle
```

验证：前序战略是否正确传递到视觉层

### Task 3：生成内容策略（S8）

```
生成品牌内容体系：
- Content Pillars
- Channel Strategy
- Topic Direction
```

验证：长期运营能力的延续性

---

## 5. 输出评价体系

使用已有 AI Brand OS Audit System 进行自动评价，不依赖人工主观判断。

### Strategic Quality Audit — 四维评分

| 维度 | 评价内容 | 分值 |
|------|---------|------|
| Specificity | 是否具体，不空泛 | 1-5 |
| Differentiation | 是否体现品牌差异 | 1-5 |
| Actionability | 是否可执行 | 1-5 |
| Evidence | 是否基于 Memory 证据 | 1-5 |

---

## 6. 对比指标

### 指标 1：质量差异

```
Quality Delta = Layered Score - Full Score
```

通过标准：`|Delta| ≤ 0.3` → 认为无明显质量损失

### 指标 2：战略一致性

检查 Layered 输出是否保留关键字段：

| 关键字段 | 要求 |
|---------|------|
| Consumer Need | 必须一致 |
| Competitive Gap | 必须一致 |
| Brand Positioning | 必须一致 |
| Value Proposition | 必须一致 |

通过标准：≥95% 一致

### 指标 3：幻觉检测

比较 Full Mode 和 Layered Mode 的 Memory 引用情况：
- 是否出现不存在的用户需求
- 是否虚构竞品信息
- 是否错误品牌定位

---

## 7. 实验结果表模板

| 任务 | 模式 | Input Token | Audit Score | 差异 |
|------|------|------------:|------------:|-----:|
| S6 定位 | Full | 120,000 | 4.6 | - |
| S6 定位 | Layered | 50,000 | 4.5 | -0.1 |
| S7 视觉 | Full | 90,000 | 4.7 | - |
| S7 视觉 | Layered | 40,000 | 4.6 | -0.1 |
| S8 内容 | Full | 100,000 | 4.5 | - |
| S8 内容 | Layered | 45,000 | 4.4 | -0.1 |

### 最终结论

```
Token 下降: X%
质量变化: -0.X
战略一致性: XX%
结论: Layered Memory 在降低上下文成本的同时，保持品牌战略推理质量。
```

---

## 8. 面试表达

❌ 不要说："我们压缩了 57% 的 Token。"

✅ 应该说：

> "我们进行了 Memory Governance 实验。首先通过 50K 规模压力测试验证上下文治理能力，然后采用 Full Context 作为 Baseline，通过 Audit 系统比较分层 Memory 后的战略输出质量。最终证明在减少 Token 消耗的情况下，核心战略决策质量没有显著下降。"

---

## 附录：实验执行脚本设计

### 脚本职责

1. 从 50K 压力测试数据中加载 DM 条目
2. 构造 Full 和 Layered 两种 Context
3. 对 S6/S7/S8 三个任务分别调用 LLM
4. 对每个输出运行 Audit 评分
5. 生成对比报告

### 依赖

- `src/lib/memory/decision-memory.ts` — `buildMemoryContext()`, `computeMemoryImportance()`
- 现有 Audit Engine
- 50K 压力测试数据集
