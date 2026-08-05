---
name: search-context-compression-ab-test-design
description: Search Context 压缩 A/B 实验 + 端到端验证测试设计文档 (2026-08-05)
metadata:
  type: project
  status: design-only
  created: 2026-08-05
---

# AI Brand OS Search Context Compression A/B + End-to-End Validation Test Prompt

## 角色

你是一名 AI 系统评估工程师，负责验证 AI Brand OS Search Intelligence Layer 优化方案的有效性。

本次实验目标：

1. 验证 Search Context Compression 是否显著降低 Token 消耗；
2. 验证压缩后的搜索上下文是否保持阶段生成质量；
3. 验证是否影响 Strategic Quality Audit、Converge 稳定性；
4. 验证局部搜索优化是否影响完整 S1→S8 品牌战略推导链路。

禁止预设结论，必须基于实验数据判断。

---

# 实验设计

采用两阶段实验：

## Phase 1：Search Context A/B Benchmark

目标：

验证搜索上下文压缩本身的收益和质量影响。

## Phase 2：End-to-End Pipeline Validation

目标：

验证搜索压缩不会破坏 AI Brand OS 的完整决策链。

---

# Phase 1：Search Context A/B 实验

## 实验组

### A 组：Baseline Search Context

使用当前生产策略：

* topK = 5
* 单来源最大内容 = 3000 chars
* 无全局 Search Context 上限

### B 组：Optimized Search Context

使用优化策略：

* topK = 3
* 单来源最大内容 = 800 chars
* 全局 Search Context 上限 = 2500 chars
* 保留：

  * 来源名称
  * URL
  * 核心发现
  * 必要证据

---

# 控制变量

以下必须完全一致：

## 模型

* 相同 LLM Provider
* 相同模型版本

## Prompt

保持：

* Consultation Prompt 一致
* Converge Prompt 一致
* Audit Prompt 一致

## 案例输入

A/B 使用完全相同：

* 品牌名称
* 品类
* 创始背景
* 产品方向
* 商业目标
* 用户画像

## 审计系统

保持：

* 相同评分规则
* 相同权重
* 相同 Quality Gate
* 相同 Reoptimize 逻辑

---

# 测试样本

准备至少 5 个品牌案例。

覆盖：

## 品类

* 美妆个护
* 宠物
* 食品饮料
* 家居生活
* 香氛或其他新消费领域

## 搜索难度

包含：

### 简单案例

市场资料丰富。

### 中等案例

细分类目信息有限。

### 困难案例

新兴市场、小众赛道。

---

# Phase 1 测试阶段

重点测试搜索阶段：

## S2 商业现状

验证：

* 行业背景搜索
* 市场信息提取
* 商业环境判断

## S3 市场机会

重点阶段。

验证：

* 市场趋势搜索
* 用户需求搜索
* 机会方向判断

作为最大搜索消耗阶段重点分析。

## S5 竞争判断

验证：

* 竞品信息搜索
* 竞争格局分析
* 差异化判断

## S8 内容策略

如果启用搜索：

验证：

* 内容趋势
* 渠道信息
* 用户表达方式

---

# Phase 1 执行流程

每个案例分别运行：

A 组：

S2/S3/S5/S8

↓

记录数据

B 组：

S2/S3/S5/S8

↓

记录数据

每个阶段执行完整流程：

S* Generate

↓

Quality Audit

↓

如果 Audit 不通过：

Smart Optimization

↓

AI Re-generate

↓

Re-Audit

禁止因为实验方便跳过优化循环。

---

# 数据采集指标

## 1. Token 压缩指标

记录：

| 指标                           | 说明              |
| ---------------------------- | --------------- |
| Search Context Before Tokens | 压缩前搜索上下文 Token  |
| Search Context After Tokens  | 压缩后搜索上下文 Token  |
| Total Prompt Before Tokens   | 完整 Prompt Token |
| Total Prompt After Tokens    | 完整 Prompt Token |
| Compression Rate             | 减少比例            |

计算：

Compression Rate =
(Before - After) / Before

---

# 2. 搜索质量指标

记录：

| 指标      | 说明          |
| ------- | ----------- |
| 搜索来源数量  | 实际使用来源      |
| 最终注入长度  | chars/token |
| 来源覆盖率   | 关键来源是否保留    |
| 关键事实保留率 | 重要信息是否丢失    |

---

# 3. AI 输出质量指标

记录：

## Audit Score

比较：

* Specificity
* Differentiation
* Actionability
* Evidence

输出：

A 平均分

B 平均分

差异。

---

## Quality Gate

统计：

* Advance 数量
* Reoptimize 数量
* Block 数量

---

## Converge 稳定性

记录：

* 成功率
* Retry 次数
* 平均生成次数

---

# Phase 2：End-to-End Validation

目的：

验证搜索压缩不会影响完整品牌战略链。

## 样本

选择 3-5 个代表案例。

## 流程

分别运行：

A：

S1 创始人诉求

↓

S2 商业现状

↓

S3 市场机会

↓

S4 消费者洞察

↓

S5 竞争判断

↓

S6 品牌核心战略

↓

S7 视觉策略

↓

S8 内容策略

B：

同样完整流程。

---

# Phase 2 重点比较

## S6 品牌核心战略

检查：

* positioning 是否一致
* value proposition 是否一致
* brand story 是否一致

## S7 视觉策略

检查：

* 是否仍符合品牌人格
* 是否保持战略来源

## S8 内容策略

检查：

* 内容方向是否一致
* 用户表达是否一致

---

# 实验规模

最低：

Phase 1：

5 个案例

×

4 个搜索阶段

×

A/B 两组

×

2 次重复

约：

80 次阶段实验。

Phase 2：

3-5 个案例

×

完整 S1-S8 流程。

---

# 成功标准

优化方案满足以下条件：

## Token

Search Context Token：

降低 ≥50%

## 质量

Audit Score：

平均下降 ≤5 分

## 稳定性

满足：

* Converge 成功率不下降
* Retry 次数不增加

## 全链路一致性

S6-S8：

无明显战略漂移。

---

# 最终实验报告格式

输出：

## 1. 背景

为什么需要 Search Context Compression。

## 2. 实验设计

说明：

* A/B方案
* 控制变量
* 样本规模

## 3. Phase 1 数据结果

包含：

| 指标            | Baseline A | Optimized B | 变化 |
| ------------- | ---------- | ----------- | -- |
| Search Tokens |            |             |    |
| Prompt Tokens |            |             |    |
| Audit Score   |            |             |    |
| Retry次数       |            |             |    |
| Converge成功率   |            |             |    |

## 4. Phase 2 全链路结果

包含：

| 阶段     | A结果 | B结果 | 是否一致 |
| ------ | --- | --- | ---- |
| S6战略策略 |     |     |      |
| S7视觉策略 |     |     |      |
| S8内容策略 |     |     |      |

## 5. 最终结论

必须回答：

1. Search Context 是否成功压缩？
2. Token 降低多少？
3. 是否影响 AI 决策质量？
4. 是否值得进入生产环境？

禁止使用：

"感觉有效"

必须引用实验数据。
