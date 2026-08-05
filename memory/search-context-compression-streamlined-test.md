---
name: search-context-compression-streamlined-test
description: Search Context 压缩精简验证方案 (2026-08-05) — 3案例×S3/S5×A/B×2次 + 1案例 E2E，验证工程优化无质量损失
metadata:
  type: project
  status: design-only
  created: 2026-08-05
  parent: search-context-compression-ab-test-design
---

# Search Context 压缩 — 精简验证方案

## 设计原则

目标不是发表论文证明搜索压缩算法的泛化能力，而是**验证一次工程优化（search context 压缩）没有造成质量损失**。

实验设计遵循"先针对高风险搜索阶段做 A/B Benchmark，再通过 E2E 验证阶段间决策传递稳定"的逻辑——既有数据支撑，也有完整叙事。

---

## 案例选择

### Case 1：慢象咖啡（精品咖啡 / 食品新消费）

| 维度 | 说明 |
|------|------|
| **为什么选** | 已有 2026-08-01 全链路基线 + 2026-08-05 O2 定向验证数据，可以前后对比 |
| **主要验证** | 优化前后是否退化 |
| **搜索难度** | 中等——品类边界清晰，市场数据量适中 |
| **基线参考** | S1-S8 全链路通过，S3 retry ×2；O2 验证 S2 3/3 通过，S3 Converge 0 retry（vs 基线 2 retry） |
| **创始人类型** | problem_driven |

### Case 2：素然研究所（功效护肤 / 美妆个护）

> ✅ 画像已补充至 `brand-domain-cases.md` 画像 6（2026-08-05）

| 维度 | 说明 |
|------|------|
| **为什么选** | 高竞争、高市场噪声——成分党、KOL 测评、竞品笔记充斥搜索结果，"屏障修复""精简护肤""功效成分"三个趋势方向搜索结果极易膨胀 |
| **主要验证** | 压缩后是否丢失关键市场信息（竞品多、趋势多、信噪比低） |
| **搜索难度** | 中等-高——信息量大但信噪比低，搜索词与多品类交叉 |
| **创始人** | 苏蔓，32 岁，前欧莱雅配方工程师，creation_driven（与 Case 1 problem_driven 互补） |
| **品类特征** | 功效护肤赛道，小红书/抖音 KOL 内容密度极高，搜索结果中营销内容占比大，对截断敏感 |

### Case 3：毛孩子美容馆（宠物服务 / 小众垂类）

| 维度 | 说明 |
|------|------|
| **为什么选** | 小众垂类、信息稀疏——搜索结果少但需要判断机会 |
| **主要验证** | 压缩是否导致信息不足 |
| **搜索难度** | 高——宠物服务品类信息稀疏，S3 在基线中 retry ×3（所有案例中最多） |
| **基线参考** | S1-S8 全链路通过，S3 retry ×3，宠物服务品类 Schema 适配度最低 |
| **创始人类型** | problem_driven |

---

## 测试设计

### Phase 1：A/B Benchmark（24 次实验）

```
3 cases × 2 stages (S3, S5) × 2 groups (A/B) × 2 repetitions = 24
```

#### 为什么只测 S3 和 S5

| 阶段 | 搜索特征 | 代表场景 |
|------|---------|---------|
| **S3 市场机会** | 搜索量最大、信息密度最高，4-6 个搜索维度同时展开 | "市场数据理解" |
| **S5 竞争判断** | 竞品数据理解，需要区分竞品差异、定位空位 | "竞品数据理解" |

S2（商业背景）和 S8（内容策略）的搜索量远小于 S3/S5——如果 S3（最大消耗阶段）在截断后质量不退化，S2/S8 在统计上不太可能反向恶化。

#### 实验组配置

| 参数 | A 组（Baseline） | B 组（Optimized） |
|------|-----------------|-------------------|
| topK | 5 | **3** |
| 单条内容上限 | 3,000 chars | **800 chars** |
| 全局上限 | 无 | **2,500 chars** |
| 来源名称/URL/核心发现 | ✅ | ✅（保留） |

#### 控制变量

- 相同模型（deepseek-chat）
- 相同 Consultation/Converge/Audit Prompt
- 相同案例输入（品牌名、品类、创始背景）
- 相同 Quality Gate 阈值和 Reoptimize 逻辑

#### 每个实验的执行流程

```
S* Consultation（含搜索）
  → Convergence
  → Quality Audit
  → 如果 Reoptimize: Smart Optimization → Re-generate → Re-Audit
  → 记录结果
```

不跳过优化循环。

### Phase 2：E2E 验证（1 次完整 S1→S8）

```
1 case（慢象咖啡） × S1→S8 全链路 × B 组 only
```

#### 为什么只跑 B 组

慢象咖啡已有完整的 A 组（Baseline）全链路数据（2026-08-01 E2E）。只需要跑一次 B 组（压缩后）全链路，与基线比较：

- S6 positioning / valuePropositions / brandStory 是否一致
- S7 视觉方向是否仍符合品牌人格，是否保持战略来源
- S8 内容方向是否一致，用户表达是否一致
- 是否存在战略漂移

#### 为什么选慢象咖啡

- 已有完整基线（唯一一个在 2026-08-01 和 2026-08-05 都有详细数据的案例）
- Phase 1 已经在它身上跑了 A/B，数据连贯
- problem_driven 类型，覆盖最常见创始人类型

---

## 数据采集

### 每个实验记录

| 指标 | 说明 |
|------|------|
| Search Context chars | 注入 consultation 的搜索上下文长度 |
| Search Context tokens | 搜索上下文的 token 数 |
| Total Prompt tokens | consultation + converge 总 input |
| Audit Score | Specificity / Differentiation / Actionability / Evidence 四维 |
| Quality Gate | Advance / Reoptimize / Block |
| Converge retry 次数 | 收敛重试次数 |
| 来源数量 | 实际使用的搜索来源数 |
| 关键事实保留 | 人工抽查：压缩后关键市场信息是否仍在 |

### Phase 2 额外记录

| 指标 | 说明 |
|------|------|
| S6-S8 战略一致性 | 与基线比较 positioning/brandStory 是否漂移 |
| 阶段间引用 | 后续阶段是否仍能引用前序搜索发现 |
| 全链路 token 总量 | S1→S8 B 组总 token vs A 组基线 |

---

## 成功标准

| 维度 | 标准 | 判断方式 |
|------|------|---------|
| **Token 压缩** | Search Context 长度降低 ≥50% | 直接比较 chars |
| **Audit 分数** | B 组平均分 vs A 组下降 ≤5 分 | 四维加权总分比较 |
| **Converge 稳定性** | Retry 次数不增加（允许 ±1 的波动） | 比较 retry 分布 |
| **关键信息保留** | S3/S5 结构化输出中搜索来源引用数不显著减少 | 比较 evidenceLevel="search_backed" 的字段数 |
| **全链路一致性** | S6-S8 输出与基线无战略漂移 | 人工比较 Phase 2 vs 基线 |

---

## 执行顺序

```
1. ✅ 新建 Case 2 美妆/个护画像 → 已补充 素然研究所（画像 6，2026-08-05）
2. ✅ 修复 batch 脚本 reoptimize 循环处理 → 已添加 reOptimizeStage() 循环（max 3 次，含熔断检测）
3. Phase 1: 3 cases × S3/S5 × A/B × 2 次 = 24 次实验
4. 分析 Phase 1 数据，确认 S3/S5 无退化后才进入 Phase 2
5. Phase 2: 慢象咖啡 S1→S8 B 组全链路
6. 撰写最终报告
```

---

## 预计耗时

| 步骤 | 耗时 |
|------|------|
| 新建 Case 2 画像 | 0.5h |
| 修 batch 脚本 | 1-2h |
| Phase 1（24 次 × ~15min） | ~6h wall-clock |
| Phase 1 数据分析 | 1-2h |
| Phase 2（1 次 S1→S8 × ~2h） | ~2h |
| Phase 2 数据分析 + 报告 | 2-3h |
| **总计** | **12-16h**（1.5-2 个日历日） |

vs 完整版 80 次实验的 45-64h，精简版保留了核心验证能力，去掉了边际收益递减的重复。

---

## 叙事结构（面试/汇报用）

```
1. 背景：H4 实验发现 prompt cache 节省 70%，但仍有 30% 是每次变化的搜索上下文
2. 假设：搜索上下文 90% 是冗余信息——AI 实际只引用前 200-600 chars
3. 方案：topK 5→3 + 800/2500 chars 截断，建立"检索→排序→摘要→受控注入"管道
4. 验证策略：
   - Phase 1: 3 案例覆盖"高噪声"和"稀疏"两类搜索场景
   - 重点测 S3（市场数据理解）和 S5（竞品数据理解）
   - Phase 2: E2E 验证压缩后的上下文仍支撑完整战略闭环
5. 结论：token 降低 X%，Audit 分数下降 Y 分（≤5），无战略漂移
```

---

## 与原完整方案的定位关系

- **原方案**（`search-context-compression-ab-test-design.md`）：方法论完整，5 案例 × 4 阶段 × A/B × 2 次 = 80 实验，适合未来发表或正式论文场景
- **本方案**：工程验证版，3 案例 × 2 阶段 × A/B × 2 次 + 1 E2E = 25 次实验，适合快速验证优化效果

两个方案独立保存，本方案执行完后可决定是否需要扩展为完整版。
