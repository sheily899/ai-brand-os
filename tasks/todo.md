# AI Brand OS — 开发任务清单

> 按 Phase 依赖顺序排列。★ = 该 Phase 核心验证任务。每个 Phase 完成后验证 Checkpoint。

---

## Phase 1：基础设施 + S1 闭环验证

### Checkpoint：FounderVision 是否有战略价值？

- [ ] **1.1** 项目初始化与技术栈搭建
  - Next.js 14+ / TypeScript strict / Tailwind / Drizzle / Supabase / DeepSeek 适配器
  - `npm run dev` 成功，DB 建表成功，DeepSeek API 连通
  - DeepSeek Prompt Cache 验证：两次相同 system prompt 请求 → 对比第二次 input token 计费

- [ ] **1.2** 项目创建页与 Project 实体
  - `/` 页面：品牌名（必填）+ 品类方向（可选，含"其他"）+ 历史项目列表
  - POST `/api/project` → GET `/api/project/[id]`
  - Project 表 Drizzle schema（userId nullable）

- [ ] **1.3** Workflow Engine
  - 七状态状态机 + 决策依赖图
  - 验证：S1→S2 正确推进，非法跳级被阻止，代码中无 LLM 调用

- [ ] **1.4** Stage Engine S1 闭环
  - Consultation（多轮 + 一次一问 + SSE 流式）→ Convergence（JSON）→ Normalization → Zod Validation → Save
  - 验证：S1 多轮咨询 → FounderVision JSON → StageRecord 正确保存

- [ ] **1.5** Decision Memory
  - 保存 confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions
  - 不保存聊天记录和 AI 推理
  - **S1-S8 完整字段映射**：S1(founderMotivation/observations/confirmedProblems/constraints→fact) + S2(businessBackground/strategicChallenge→fact) + S3(marketOverview/opportunityDirections(verified)→fact, opportunityDirections(hypothesis)→hypothesis) + S4(identityNeeds→decision, functionalNeeds→fact) + S5(competitors→fact, competitiveGap→hypothesis) + S6(positioning/valuePropositions→decision, reasoning→不存入) + S7(visualDirection→decision) + S8(contentPillars→decision)
  - 通用规则：search_backed > search_snippet > ai_inferred；字段值为"搜索范围内未找到"或空数组不写入
  - 验证：S1 输出提取战略资产 → S2 可读取 Context；S6 可追溯到 S4/S5 决策

- [ ] **共享工具** `scripts/run-stage.ts` CLI 测试脚本
  - `--mode consult|converge|full|batch`，支持 Phase 2-5 无 UI 测试
  - batch 模式：AI 搜索意图自动触发 Search Intelligence Layer，案例文件可预置 `searchDirectives`
  - Phase 1 完成后可用 consult/converge 模式，Phase 2 完成后可用 batch 模式

---

## Phase 2：八阶段战略链路

### Checkpoint：战略推导是否成立？（S1→S6 决策连续性 + Search Intelligence Layer 验证）

### 阶段间自动编排（Stage Orchestrator）

每个阶段结束到下一阶段开始的自动流转：

```
用户输入「确认」
  ↓
Step 1: Convergence（收束为 JSON）→ 保存 StageRecord
  ↓
Step 2: Decision Memory 提取
  ↓
Step 3: Rule Check（纯代码，Phase 2 轻量版）
  ↓
Step 4: Gate Decision = Advance → Workflow 推进到 N+1
  ↓
Step 5: AI 自动搜索（Search Intent Generator → Search API → URL Ranking → Web Retrieval）
  ↓
Step 6: AI 先说第一句话（Stage Opening Message，含搜索结果呈现）
  ↓
Step 7: 进入新一轮咨询对话
```

Phase 2 的 Orchestrator 为轻量版——只做步骤串联，不带 AI Quality Audit。
Phase 3 把 AI Quality Audit + Cross Stage Check 插入 Step 3-4 之间。

---

- [x] **2.0 ★ Search Intelligence Layer**（共享基础能力，S2/S3/S5/S8 共用）
  - **Search Intent Generator**：根据阶段 + 品牌信息 + 品类 + Decision Memory Context，自动生成搜索关键词和方向
  - **Brave Search API 封装**：调用 Brave Search，返回结构化结果（URL + title + snippet）
  - **URL Ranking**：AI 根据权威性/相关度/数据密度筛选 Top 3-5 URL
  - **Web Retrieval**：Jina Reader（`r.jina.ai`）→ fetch + cheerio fallback → 搜索摘要兜底
  - **Source Credibility**：四阶段分来源信任权重（官方数据 > 行业报告 > 媒体报道 > 社媒内容）
  - **Search Coverage Matrix 驱动**：每个阶段调用前对照 `shared-search-protocol.md` 覆盖矩阵，缺哪补哪
  - **自动搜索触发**：Stage Orchestrator 在进入新阶段时自动调用，无需用户手动触发
  - **Search Context 注入**：搜索结果结构化注入 Consultation system prompt（实现 `loader.ts` 中 `includeSearchProtocol` 参数，当前为空壳）
  - **Opening Message**：不创建独立文件，由 Orchestrator 通过 `sendMessage()` + 搜索上下文触发 AI 自然生成开场白
  - **Stage Orchestrator 串联**（`stage-engine.ts` 新增 `advanceToNextStage()`）：Convergence → Decision Memory → Rule Check → Gate → Advance → Search → Opening Message → 咨询
  - **dataSources 区分**：全文引用 vs 摘要引用，存入阶段 JSON
  - 验证：S2/S3/S5/S8 进入时自动搜索 → 搜索结果进入 Consultation Context → AI 开场白包含搜索发现 → 未覆盖维度标注"搜索范围内未找到"

- [x] **2.1** S2 商业背景分析
  - Schema: business-context.ts
  - Stage 2 extractor registered in Decision Memory
  - S2 prompts copied from reference/ to src/lib/ai/prompts/
  - **复用 2.0 Search Intelligence Layer**：覆盖矩阵 8 维度（市场规模/增长趋势/生命周期/政策环境/消费趋势/渠道结构/平台生态/爆品路径）
  - Opening Message：AI 先展示搜索结果摘要，再引导用户讨论行业环境
  - 验证：BusinessContext JSON 产出，搜索覆盖维度完整，dataSources 标注

- [x] **2.2** S3 市场机会分析
  - Schema: market-insights.ts。搜索数据层（marketOverview/industryTrend/channelAnalysis/regulatoryEnvironment/dataSources）+ AI 分析层（categoryStatus/experienceGaps/opportunityDirections）
  - Stage 3 extractor registered in Decision Memory
  - S3 prompts copied from reference/ to src/lib/ai/prompts/
  - **复用 2.0 Search Intelligence Layer**：覆盖矩阵 8 维度（品类规模/增速/供需缺口/价格带/用户画像/区域差异/季节周期/替代威胁）
  - Opening Message：AI 先展示市场搜索发现，再引导用户讨论品类机会
  - 验证：MarketInsights JSON 两层结构完整，dataSources 区分全文/摘要

- [ ] **2.3** S4 消费者洞察
  - Schema: consumer-insight.ts。关键字段：identityNeeds（S6 强制引用）
  - 本阶段不依赖搜索，但使用 S3/S5 的搜索数据作为交叉验证
  - Opening Message：基于前序阶段资产，引导用户描述目标消费者
  - 验证：输出完成"原始信息 → 行为事实 → 洞察"推导

- [ ] **2.4** S5 竞争判断
  - Schema: competitive.ts。竞品数据层（competitors[] 完整卡片）+ competitiveGap + competitiveLandscape
  - 关键字段：competitiveGap + competitors[].opportunityGap（S6 强制引用）
  - **复用 2.0 Search Intelligence Layer**：覆盖矩阵 8 维度（品牌定位/价格体系/产品体系/核心卖点/视觉体系/内容传播/用户好评/用户差评）
  - 竞品卡片：至少 3 个竞品，含用户好评/差评原文摘录（excerpt 字段）
  - Opening Message：AI 先展示竞品搜索发现，再引导用户讨论竞争格局
  - competitiveGap.marketOpportunity 可追溯到具体竞品差评原文或产品缺口

- [ ] **2.5 ★** S6 品牌核心战略（战略枢纽验证）
  - Schema: brand-strategy.ts。positioning / valuePropositions（三层）/ brandStory / brandPersonality / **reasoning**（marketOpportunityReference/consumerInsightReference/competitiveGapReference）
  - 本阶段不依赖搜索，但依赖 S3/S4/S5 的完整输出
  - 强制引用：reasoning 字段显式追溯到 S3 市场机会 + S4 identityNeeds + S5 competitiveGap
  - Opening Message：基于前序全部资产总结，引导创始人确认战略方向
  - **对照测试**：有 Context vs 无 Context 的 S6 输出

- [ ] **2.6** S7 视觉策略 + S8 内容规划
  - visual-strategy.ts + content-strategy.ts
  - S8 **复用 2.0 Search Intelligence Layer**：覆盖矩阵 7 维度（平台生态/内容趋势/用户兴趣/KOL 生态/内容形式/品牌案例/用户互动）
  - 验证：S7 visualDirection 可追溯到 S6，S8 ContentStrategy JSON 的 dataSources 非空

- [ ] **2.7** Knowledge Base 基础设施
  - pgvector + DeepSeek embeddings + retriever（hybrid search）+ seed.ts 播种脚本
  - `knowledge-docs/` 目录为空，仅建管道不做数据播种
  - 验证：embedding 生成、检索 API 可用、空库不阻塞流程

---

## Phase 3：Audit Engine（增强 Phase 2 轻量审查）

### Checkpoint：能否发现明显战略错误？

Phase 2 的 Stage Orchestrator 已内置轻量 Rule Check（字段完整性 + Schema 完整性）。
Phase 3 在此基础上增强为完整 Audit Engine，并在 Orchestrator 的 Step 3-4 之间插入 AI Quality Audit 和 Cross Stage Check。

增强后流程：
```
用户确认 → Convergence → Decision Memory
  → Rule Check（增强版：+ 逻辑冲突检测）
  → AI Quality Audit（新增：四维评估）
  → Cross Stage Context Check（新增：Layer A + Layer B）
  → Quality Gate（增强版：Advance / Reoptimize / Block + 评分阈值）
  → 推进 → 搜索 → 开场白
```

- [ ] **3.1** Rule Check 增强（纯代码，增强 Phase 2 已有组件）
  - Phase 2 已有：字段完整性 / Schema 完整性
  - Phase 3 新增：基础逻辑冲突检测（如"高端定位"+"低价策略"同时出现）、字段间一致性（如 targetAudience 与 userPersona 矛盾）
  - 禁止 LLM
  - 验证：能发现结构错误 + 逻辑冲突，不误报

- [ ] **3.2** AI Quality Audit（LLM，新增组件）
  - 四维评估：Specificity / Differentiation / Evidence / Executability
  - 每阶段独立权重和阈值（S1 侧重 Specificity，S6 侧重 Differentiation）
  - 验证：评分与人工判断偏差 < 1 分

- [ ] **3.3 ★** Cross Stage Context Check（新增组件）
  - Layer A：Fact Reference Check（纯代码，依赖图驱动，**含 S6 字段级依赖**：reasoning → S3/S4/S5 具体字段）
  - Layer B：Strategic Continuity Check（复用 AI Quality Audit 同次调用）
  - **红线**：Layer B 不产生独立 LLM 调用
  - 验证：能发现 S2/S6 事实冲突 + S6 reasoning 引用缺失/不匹配，不误判文案差异

- [ ] **3.4** Quality Gate 增强（增强 Phase 2 已有组件）
  - Phase 2 已有：简单 Advance/Block（基于 Rule Check 结果）
  - Phase 3 增强：Advance → 下一阶段 / Reoptimize → 回到 ACTIVE / Block → 必须手动修复
  - 评分阈值驱动：Block阈值 < Reoptimize区间 < Advance阈值
  - 集成到 Stage Orchestrator 的 Step 3-4 之间
  - 验证：Gate Decision 正确驱动阶段推进/回退

- [ ] **3.5** Report Engine + Final Audit
  - assemble.ts（八阶段输出 → 报告）+ quality.ts（违规检测 + 术语一致性）+ pdf-generate.ts（含中文字体注册）
  - Final Audit：组装前遍历完整依赖图 → Layer A Fact Reference Check → error 级暂停组装
  - 可通过 `run-stage.ts --mode assemble` 独立测试（不依赖 UI）
  - 验证：报告结构正确、违规检测生效、PDF 中文渲染正常（需注册 Noto Sans SC 等中文字体）

---

## Phase 4：完整产品体验

### Checkpoint：状态恢复 + 用户流程是否完整？

- [ ] **4.1** 品牌咨询工作台
  - 三区域布局：侧边栏（✓/●/🔒）+ 对话区（Markdown + SSE + 搜索三段式）+ 顶部栏
  - **状态恢复**：WorkflowState 持久化到 StageRecord.status → 页面加载从 API re-fetch
  - 对话历史以 DB 为准（非 localStorage），SSE 中断后可恢复已接收片段

- [ ] **4.2** 审计卡片 UI
  - Advance / Reoptimize / Block 三态卡片
  - "智能优化" / "手动调整" / "保持当前决策"

- [ ] **4.3** 品牌战略报告页 UI
  - 八章节折叠 + 在线编辑（富文本）+ PDF 导出按钮（调用 Task 3.5 Report Engine API）
  - 报告不展示审计评分/审计历史/对话过程

- [ ] **4.4** 文件上传与图片粘贴
  - 拖拽上传 + Ctrl+V 粘贴。Supabase Storage

---

## Phase 5：质量验证

### Checkpoint：内容质量 + 稳定性是否达标？

- [ ] **5.1** 单元测试覆盖
  - Workflow / Stage / Audit / Memory / Report / AI
  - 引擎层 >80%，AI 层 >60%

- [ ] **5.2** 集成测试 + 异常测试
  - S1→S8 完整流程 / 中断恢复 / 回退修改 / Reoptimize 循环
  - LLM 超时 / Search 失败 / Convergence 格式错误 / DB 连接失败

- [ ] **5.3 ★** 内容质量测试（三案例）
  - 案例 A：宠物食品品牌升级
  - 案例 B：香薰品牌创业验证
  - 案例 C：家居品牌转型
  - 至少 2 个案例五维均分 ≥ 3.5
  - 对照测试：连续推导价值 > ChatGPT
  - 输出 Prompt 优化建议清单

---

## Phase 6：成本优化

### Checkpoint：单次咨询成本可度量 + 优化机会已识别

- [ ] **6.1** Token 消耗追踪与分析
  - 每次 LLM 调用记录 TokenConsumption
  - 可按阶段/调用类型/模型查询消耗分布
  - 识别"哪个阶段 token 消耗最高？""system prompt vs 对话占比？"

- [ ] **6.2** Prompt Caching 策略
  - System prompt 公共前缀与动态部分分离
  - DeepSeek 服务端缓存自动生效
  - 验证：相邻阶段 input token 成本降低

- [ ] **6.3** Prompt 优化迭代（数据驱动）
  - 基于 Phase 5 质量数据 + Phase 6.1 消耗数据
  - 目标：token ↓ 10% 或质量 ↑ 0.5 分
  - **强制回归**：优化后重跑三案例 S1→S8，任一维度降 >0.3 分或均分 <3.5 → 回滚
  - 结果写入 `src/tests/quality/regression-log.md`

---

## 模块边界红线

| # | 红线 | 违反 = bug |
|---|---|---|
| 1 | Workflow Engine 不调用 LLM |
| 2 | Decision Memory 不保存聊天记录 |
| 3 | Strategic Continuity Check 不发起独立 LLM 调用 |
| 4 | 前端组件不直接调用 AI 层 |
| 5 | Cross Stage Check 只检查依赖图定义的边上 |
| 6 | Report 不展示审计评分和审计历史 |
| 7 | 不提前实现 User 表（userId 保持 null） |
