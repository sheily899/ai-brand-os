# Phase 6.3 Prompt 优化迭代实验方案

> 创建时间：2026-08-05 | 状态：待执行

---

## 1. 实验目标

建立 Prompt 优化闭环：

> 消耗分析 → 定位高成本 Prompt → 定向优化 → 质量回归 → 保留有效改动

验证两个核心假设：

- **H1**：Prompt 中存在冗余指令，可以减少 Token 消耗。
- **H2**：减少 Prompt Token 不会降低 AI 品牌咨询质量。

### 通过标准

- Token 消耗下降 ≥10% **或** 输出质量提升 ≥0.5 分
- 同时满足：
  - 任一质量维度下降 >0.3 分 → 回滚
  - 综合评分下降 >0.5 分 → 回滚

---

## 2. 优化对象选择

基于 Phase 6.1 Token 消耗分析，按成本排序：

| 优先级 | Prompt | 原因 | 优化方向 |
|--------|--------|------|----------|
| **P0** | S8 consultation | 平均 System Prompt 17,018 tokens，最高 | 删除重复内容、压缩规则 |
| **P0** | S3 consultation | 平均 System Prompt 14,342 tokens | 精简搜索分析规则 |
| **P1** | S2 consultation | 平均 System Prompt 13,453 tokens | 压缩商业分析框架 |
| **P2** | S5 consultation | 平均 System Prompt 9,159 tokens | 优化竞争分析模板 |
| P3 | 其他阶段 | 收益较低 | 暂不处理 |

---

## 3. Prompt 优化方法

每次只修改一个变量，避免无法归因。

### 优化类型 A：重复指令删除

优化前：
```
你需要作为品牌战略顾问进行分析。
你的角色是品牌战略顾问。
请从品牌战略角度思考。
```

优化后：
```
角色：品牌战略顾问。
```

验证：语义是否保持一致、Token 是否减少。

### 优化类型 B：规则合并

优化前：
```
不要提前结束阶段。
只有用户确认后才能结束。
必须等待用户确认。
不能自动进入下一阶段。
```

优化后：
```
阶段结束规则：仅在用户明确确认后结束当前阶段。
```

### 优化类型 C：结构压缩

优化前：
```
第一步：分析用户需求。
第二步：分析市场环境。
第三步：分析竞争关系。
第四步：提出策略建议。
```

优化后：
```
分析流程：需求 → 市场 → 竞争 → 策略。
```

### 优化类型 D：删除低价值说明

删除：
- LLM 自解释要求
- 重复角色描述
- 已由代码保证的约束

保留：
- 专业方法论
- 输出结构
- 质量标准

---

## 4. 实验流程

### Step 1：建立 Baseline

固定测试条件：
- 模型固定
- 用户输入固定
- DM Context 固定
- Search Context 固定

测试案例（3 个完整品牌案例）：

| 案例 | 类型 |
|------|------|
| Case A | 宠物消费品牌 |
| Case B | 美妆新品牌 |
| Case C | 生活方式品牌 |

运行 S1 → S8 全流程，记录 Token 和 Quality。

### Step 2：修改 Prompt

按优先级依次修改 S8 → S3 → S2 → S5 consultation prompt。

### Step 3：重新运行回归测试

比较 Token 和 Quality 变化。

---

## 5. 质量回归标准

采用已有 Audit System 四维评分：

| 维度 | 允许变化 |
|------|---------|
| Specificity | ≥ -0.3 |
| Differentiation | ≥ -0.3 |
| Actionability | ≥ -0.3 |
| Evidence | ≥ -0.3 |

综合：`New Score >= Old Score - 0.5`，否则回滚。

---

## 6. 实验记录格式

文件：`tests/quality/prompt-regression-log.md`

每条记录包含：
- Date, Prompt, Change description
- Before/After: Input Tokens, Quality
- Delta: Token%, Quality
- Result: PASS/FAIL
- Reason

---

## 7. 最终输出指标

### Prompt Optimization Report

| 阶段 | 优化前 Token | 优化后 Token | 下降 | 质量变化 | 结果 |
|------|-------------|-------------|------|---------|------|
| S8 | 17,018 | TBD | TBD% | TBD | TBD |
| S3 | 14,342 | TBD | TBD% | TBD | TBD |
| S2 | 13,453 | TBD | TBD% | TBD | TBD |
| S5 | 9,159 | TBD | TBD% | TBD | TBD |

最终结论：通过 Prompt 优化迭代，在保持 AI 品牌咨询质量稳定的情况下，实现平均 Token 消耗下降 ≥10%。

---

## 8. 面试表达

不要说："我们优化了 Prompt，省了 Token。"

应该说："我们建立了 Prompt Regression Pipeline，把 Prompt 修改当成工程实验。每次修改都通过固定案例、Token 对比和 Audit 四维质量评分验证，避免单纯压缩 Prompt 导致模型能力下降。"
