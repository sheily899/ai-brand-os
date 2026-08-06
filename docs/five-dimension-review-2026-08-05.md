# Brand Intelligence OS — 五维品牌咨询场景评审报告

评审日期：2026-08-05

---

## 一、访谈追问的精准度

> 评估 AI 是否真的挖到了创业者的底层诉求，而不是停留在表面回答。

### 已有优势

1. **S1 的 Exploration Framework 设计极其精细**（`stage1-consultation.md:123-168`）。创始人类型分支（问题驱动型 vs 创作驱动型）直接改变了第 3、4 项追问方向，这是专业品牌咨询师的思维方式。
2. **"一次一问"铁律 + 五项禁止句式**（禁止二选一/多选一、禁止假设性提问、禁止非诱导预设、禁止评价性反馈、追问递进三层封顶）构成了系统性的防表面回答机制。
3. **饱和信号检测**（连续短确认→切换方向，四要素齐全→该方向关闭）防止了无效追问。
4. **`exit-checker.ts` 的质量阈值设计**（`minQuality` 字段，如 `"触发事件必须包含具体的时间/地点/情境，不能只是概括性描述"`）是代码层对追问深度的兜底保障。

### 必须修复项

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **P0-1** | **S4 消费者洞察缺少创始人类型分支逻辑**。S1 按 problem_driven/creation_driven 分叉追问，但 S4 面对"能描述具体的人"vs"只能讲人口标签"两种创始人状态，没有同等级别的分支追问策略。当前 Exploration Framework 只覆盖了第一种状态，对第二种只有一句"继续追问能描述一下她一天怎么过"，缺少结构化的降级追问路径。 | `stage4-consultation.md:116-140` | 当创始人无法提供具体消费者画像时，AI 会反复无效追问，导致该阶段轮次膨胀。 |
| **P0-2** | **Exit Checker 每轮都调 LLM**。`exit-checker.ts:481` 在每次用户消息后额外发起一次 LLM 调用来评估退出条件，使每轮 LLM 调用翻倍。虽然 temperature=0.1 可以命中 DeepSeek disk cache，但 cache 仅对完全相同的输入生效——对话历史每轮都在变化，实际 cache 命中率有限。 | `exit-checker.ts:419-546` | 每阶段额外增加 N×（checker tokens）的 LLM 成本，全链路 8 阶段可能增加 30-50% 的 token 消耗。 |

### 建议改进项

| # | 问题 | 建议 |
|---|------|------|
| S1-1 | **S2-S5 缺少 S1 级别的追问深度约束**。S1 有 5 种禁止句式 + 3 层追问递进 + 创始人类型分支，但 S2-S5 的 Conversation Rules 相对通用。 | 为 S4（消费者洞察）增加"从人口标签到具体画像"的结构化追问梯度；为 S5（竞争判断）增加"从列举竞品到分析竞争逻辑"的追问升级路径。 |
| S1-2 | **`forceSummary` 触发方式生硬**。`consultation.ts:52` 直接在用户消息前拼接 `[系统指令] 本阶段退出条件已满足，请立即输出确认总结`，AI 从"追问模式"突然切换到"总结模式"，过渡不自然。 | 改为两段式：先让 AI 输出一个过渡句（如"我们的讨论已经比较充分了，让我整理一下目前的理解"），然后在同一轮输出确认总结，而不是硬切。 |
| S1-3 | **Exit Checker 可以用启发式规则减少 LLM 调用**。当前每个条件都交给 LLM 判断，但很多条件可以用关键词计数做预筛选（如 S1 的 `s1_observations` 可以通过统计对话中包含时间/地点/行为的句子数来预判）。 | 增加纯代码预检查层：先做关键词/模式匹配，通过预检查的条件跳过 LLM 评估，只把边界案例交给 LLM。预估可减少 40-60% 的 checker LLM 调用。 |

---

## 二、策略产出的具体度

> 评估产出是否具体到"不可替代"，还是通用套话。

### 已有优势

1. **S6 consultation prompt 的"输出质量标准"是亮点**（`stage6-consultation.md:126-144`）。明确列出禁止的空话（差异化竞争、打造高品质、行业领先等 13 个词）和禁止的定位模板句式（"重新定义 XX""打造 XX 平台"等 6 种句式），并给出自查规则："换一个完全不同的品类，这句话还能用吗？如果能，就重新写"。
2. **S6 convergence 的 `reasoning` 三层引用追溯**（`stage6-converge.md:66-79`）强制定位必须可追溯到 S3/S4/S5 的具体字段，这是防止 AI 凭空生成定位的关键机制。
3. **S2-S5/S8 各阶段的 Summary Language Rules** 将口语（"挺快""很多""大家都"）转换为报告级表达的对照表是具体化的最后一道防线。

### 必须修复项

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **P0-3** | **S2/S3/S4/S5 convergence 缺少该领域专属的"过大词汇禁令"**。S6 有完整的禁止空话列表，但 S3 没有禁止"蓝海""风口""万亿市场"这类市场机会领域的套话，S5 没有禁止"差异化""降维打击""弯道超车"这类竞争领域的套话。当前各阶段的 Summary Language Rules 只覆盖了口语→书面语转换，没有覆盖"书面套话→具体判断"的转换。 | `stage3-converge.md`（缺少领域专用禁令）、`stage5-converge.md`（同上） | S3/S5 的收敛输出可能包含听起来专业但实际空洞的行业套话，这些套话会传递给 S6，污染品牌定位的推导基础。 |
| **P0-4** | **S7 visualSystem 的 `choice` 和 `perceptualTone` 字段没有"具体到不可替代"的质量门槛**。当前 validation 只要求 `choice` 至少 6 个字、`perceptualTone` 至少 6 个字且体现品牌感知关联。但"温暖自然的手作质感，传递品牌亲和力"（18字）可以套在任何手工品牌上。S7 convergence prompt（`stage7-converge.md:102-115`）有"不得仅输出短词或形容词堆砌"的规则，但缺少类似 S6 的品类不可知论自查标准。 | `stage7-converge.md:170-175` (Validation Rules) | 视觉策略输出可能充满"温暖自然""简约高级""年轻活力"等可套用在任何品牌上的通用描述。 |

### 建议改进项

| # | 问题 | 建议 |
|---|------|------|
| S2-1 | **S6 convergence 的 `reasoning` 字段"自报追溯"机制存在漏洞**。AI 可以在 `reasoning.marketOpportunityReference` 中写"引用自 S3 opportunityDirections[0].direction：高端宠物玩具市场存在供给不足"——即使 S3 的实际输出中完全没有这一判断。当前 Layer A `checkReferenceIntegrity()` 只检查是否包含"未追溯"标记，不验证引用内容是否真的存在于上游数据中。 | 在 Layer A 增加引用真实性验证：对 reasoning 中声称引用的内容，在上游 Decision Memory 中做语义相似度匹配（用 embedding 或至少用关键短语命中率），低于阈值的标记为"引用存疑"。 |
| S2-2 | **S8 内容策略的 `themeDirections` 缺少"是否可执行"的检查**。当前验证只要求 `pillar` 和 `corePurpose` 非空，但"建立品牌认知资产""打造用户关系体系"这类听起来有道理但完全无法落地执行的表述可以通过验证。 | 在 Rule Check 中为 S8 增加可执行性检测：themeDirections 的 `topicDirections` 必须包含至少一个可转化为具体内容标题的选题示例（如"3 个让猫咪更信任你的小细节"而非"建立信任内容矩阵"）。 |

---

## 三、各阶段之间的一致性

> 评估视觉方向是否真的承接了品牌策略阶段的判断，内容营销是否用了策略阶段定义的语气词库。

### 已有优势

1. **依赖图设计清晰**。`STAGE_MANDATORY_REFERENCES`（`cross-stage.ts:100-200`）精确定义了每个阶段必须引用的上游字段——S2→S1, S3→S1, S4→S1+S3, S5→S3+S4, S6→S3+S4+S5, S7→S6, S8→S6。
2. **S6 的"战略枢纽"定位正确**。S6 convergence 的 `reasoning` 字段显式要求引用 S3/S4/S5，S7/S8 的 Context 中显式说明"必须建立在品牌核心战略之上"。
3. **Layer B 语义断裂检查的设计方向正确**（`cross-stage.ts:397-472`）——检查逻辑矛盾、不当抽象/曲解、约束忽略三类问题。

### 必须修复项

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **P0-5** | **S8 内容策略 → S6 品牌人格的"语气词库"继承链路缺失**。S6 输出的 `brandPersonality[].dos/donts` 定义了品牌的行为和表达边界（如"像一位有品味的朋友，会在你焦虑时递上一杯茶，但不会说教"），但 S8 的 Cross Stage 强制引用只检查 `positioning → coreDirection` 和 `brandStory → themeDirections`，不检查 `brandPersonality → channelStrategy.expressionFocus`。这意味着 S8 的内容可能在渠道表达中使用与品牌人格完全不一致的语气。 | `cross-stage.ts:186-199` (STAGE_MANDATORY_REFERENCES[8]) | 内容策略的语气可能与品牌人格不一致。例如 S6 定义品牌"克制、不说教、不制造焦虑"，但 S8 小红书策略可能产出"再不买就晚了！限时 5 折！"的文案方向。 |
| **P0-6** | **Layer B 语义断裂检查只在 Rule Check 通过时触发**。`audit-engine.ts:139` 的条件 `if (ruleCheck.passed && stageNumber > 1)` 意味着如果阶段输出有结构性缺陷，语义断裂检查会被跳过。但结构性缺陷和语义断裂是正交的——一个输出可以字段完整但战略方向完全偏离上游判断。 | `audit-engine.ts:136-150` | 字段齐全但战略断裂的输出可能通过 audit（因为 Layer B 被跳过了），导致后续阶段基于错误方向继续推导。 |

### 建议改进项

| # | 问题 | 建议 |
|---|------|------|
| S3-1 | **S7 visualSystem → S6 brandPersonality 的关联检查只有关键词级别**。当前 `cross-stage.ts` 的 Layer A 检查 S7 时，只验证 `positioning → coreConcept` 和 `brandPersonality → visualSystem` 的关键词重叠，无法检测语义层面的不一致。 | 在 Layer B prompt（`buildSemanticCheckPrompt`）中为 S7 增加视觉-人格一致性检查项：要求 AI Audit 判断 S7 的五个维度视觉选择是否与 S6 的 brandPersonality traits 在感知层面一致。 |
| S3-2 | **S3→S4→S5 之间的横向一致性没有检查**。当前依赖图只定义了纵向引用（下一阶段引用上游），但 S3 市场机会、S4 消费者洞察、S5 竞争判断之间存在横向逻辑关系——例如 S3 说"高端市场有供给缺口"但 S5 的竞品分析只覆盖了大众市场品牌，这个矛盾不会被检测到。 | 在 Final Audit（`assemble.ts` 的 `runFinalAudit`）中增加横向一致性检查：S3 的 opportunityDirections 与 S5 的 competitiveGap 之间、S4 的 targetConsumer 与 S5 的 competitors 目标人群之间应有逻辑关联。 |

---

## 四、交付物的专业度

> 评估格式、结构是否达到能直接给客户看的水准。

### 已有优势

1. **可编辑报告系统**支持客户自定义（EditableNode + override 机制），这在品牌咨询交付中非常重要。
2. **报告不是聊天记录**——assemble.ts 将 8 阶段 structuredOutput 转换为 ReportBlock（Narrative/Cards/Tags/Comparison/Landscape 等 9 种类型），格式专业。
3. **`cleaner.ts` + 各阶段 Summary Language Rules** 确保报告不会出现口语化表达。
4. **QualityBanner + IncompleteWarning** 组件在报告中标注质量状态，诚实透明。

### 必须修复项

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **P0-7** | **报告缺少执行摘要（Executive Summary）的叙事整合**。当前 8 章报告按 S1→S8 顺序排列，但没有一个 1-2 页的执行摘要将整个品牌战略串成一个连贯故事。`ExecutiveSummary` 组件存在但从代码结构看是自动从各阶段提取字段拼接，而非形成独立叙事。品牌咨询报告的标准结构是：执行摘要 → 市场背景 → 消费者洞察 → 竞争格局 → 品牌战略 → 视觉方向 → 内容策略，其中执行摘要应该让读者在 2 分钟内理解完整战略逻辑。 | `src/components/report/ExecutiveSummary.tsx`、`src/lib/report/assemble.ts` | 客户（尤其是高管/投资人）通常只读执行摘要。没有叙事整合的报告只是 8 份独立文档的合订本。 |
| **P0-8** | **S7 视觉策略报告输出只有文字，没有视觉参考（moodboard/参考图）**。品牌咨询的视觉策略交付物通常包含情绪板、色彩方案可视化、字体样本等。当前系统虽有 `moodboard` 字段，但报告渲染只展示了文字描述。这对于"能直接给客户看"的标准来说是不够的。 | `src/components/report/` 中的视觉策略章节渲染 | 客户无法从文字描述（如"低饱和自然色调为主导，搭配暖灰基底"）直观感受视觉方向。 |

### 建议改进项

| # | 问题 | 建议 |
|---|------|------|
| S4-1 | **报告缺少品牌命名/标语建议板块**。虽然 SPEC 中 MVP 不包含命名服务，但报告中如果出现了品牌定位和品牌故事，却没有一个基于战略的品牌标语（tagline）建议，会显得不完整。 | 在 S6 报告章节中增加可选的"品牌表达"子板块，基于 positioning + valuePropositions 生成 3-5 个标语方向（标注为 AI 生成、需人工筛选）。 |
| S4-2 | **PDF 导出没有品牌视觉风格定制**。导出的 PDF 使用默认样式，没有应用 S7 中定义的色彩/字体方向。 | 将 S7 visualSystem 的 color.choice（如"暖灰基底"）和 typography.choice 映射到 PDF 的配色方案和字体选择，让 PDF 本身成为品牌视觉策略的一个示例应用。 |
| S4-3 | **报告的"下一步"章节缺失**。8 阶段完成后，报告应该为创始人提供清晰的后续行动建议——哪些判断需要市场验证、哪些方向需要消费者测试、建议的优先级顺序。 | 在 assemble.ts 中增加 NextSteps 章节生成逻辑，基于各阶段的 evidenceLevel 和 hypotheses 自动提取待验证项。 |

---

## 五、系统工程质量

> 评估代码可维护性、上下文管理是否可靠。

### 已有优势

1. **模块职责清晰**。consultation / convergence / audit / memory / report 各司其职，通过明确的接口通信。
2. **Prompt 管理方式优秀**。.md 文件独立管理，loader.ts 做变量注入和拼接，模板和逻辑分离。
3. **DeepSeek cache 优化路径清晰**。H1-H4 实验文档完整，Search Context 压缩、DM 双层结构都已科学验证。
4. **Token 追踪基础设施完善**。`token-tracker.ts` + `cost-analysis.ts` + `redundancy-detector.ts` 构成完整的成本可观测性。

### 必须修复项

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **P0-9** | **V2 优化版 Prompt 文件存在但未被系统加载**。目录中存在 `stage2-consultation-v2.md`、`stage3-consultation-v2.md`、`stage5-consultation-v2.md`、`stage8-consultation-v2.md`，但 `loader.ts:72` 的文件名格式为 `stage${stage}-${mode}.md`，始终加载 V1。这些 V2 文件是 Phase 6.3 实验的产出（已验证节省 519 tokens），但从未被接入生产环境。这是典型的"实验完成但未上线"问题。 | `loader.ts:72` vs `src/lib/ai/prompts/stage*-v2.md` | V2 优化成果未生效，token 消耗高于必要水平。更严重的是，V1 和 V2 并存会造成维护混乱——修改了 V1 但忘记同步 V2，或反之。 |
| **P0-10** | **Audit Engine 核心组件零测试覆盖**。`rule-check.ts`（981 行，包含 8 个阶段的复杂逻辑冲突检测和字段一致性检查）、`cross-stage.ts`（524 行，Layer A 引用完整性检查 + Layer B prompt 构建）、`audit-engine.ts`（287 行，三组件协调器）没有任何单元测试。E2E 测试可以验证 happy path，但不能覆盖 rule-check 中每个阶段的边界条件（如 S5 竞品 weaknesses 比较级检测、S6 品牌人格矛盾特质检测）。 | `src/lib/audit/*.ts`（无对应 test 文件） | 修改 rule-check 的任何检测逻辑都可能导致误报或漏检，且没有回归测试保障。 |

### 建议改进项

| # | 问题 | 建议 |
|---|------|------|
| S5-1 | **`audit-engine.ts` 中的错误处理全部静默吞掉**。Cross Stage 失败（`line 111`）、Layer B prompt 构建失败（`line 144`）、AI Audit 失败（`line 164`）全部 catch 后只 `console.error`，不向调用方返回任何错误信号。调用方收到的是一个 `gateDecision = "advance"` 的正常结果，不知道底层组件已经失败了。 | 在 `AuditReport` 中增加 `warnings: string[]` 字段，记录所有被吞掉的错误。前端 AuditCard 在有 warning 时展示一个"审计不完整"标记。 |
| S5-2 | **`cross-stage.ts` 的 `checkReferenceIntegrity` 使用动态 import 绕过测试环境问题**（`line 226: await import(...)`）。这说明 `decision-memory.ts` 与数据库耦合太紧，导致在 DATABASE_URL 缺失的环境下无法加载。 | 将 `getEntriesByStage` 作为参数注入 `checkReferenceIntegrity`，而非内部动态 import。这样测试可以传入 mock 函数，生产代码正常 import。 |
| S5-3 | **`loader.ts` 的搜索协议缓存是全局变量**（`line 26: _protocolCache`）。在服务端无状态部署（如 Vercel Edge Functions）中这不是问题，但在长生命周期 Node 进程中，如果 `shared-search-protocol.md` 热更新了，缓存不会刷新。 | 增加基于文件 mtime 的缓存失效机制，或使用 LRU cache 替代永久缓存。 |
| S5-4 | **`StageTabs.tsx` 和 `StageSidebar.tsx` 的组件职责有重叠**。两个组件都在处理阶段导航和状态展示，但一个用 Tab 形式一个用 Sidebar 形式。它们的阶段状态逻辑应该抽取到共享 hook（如 `useStageNavigation`）。 | 创建 `useStageNavigation.ts` hook，统一阶段状态读取和导航逻辑。 |

---

## 评审总结

| 维度 | 评分 | 关键评价 |
|------|------|---------|
| 1. 访谈追问精准度 | ⭐⭐⭐⭐ (4/5) | S1 追问设计是行业级最佳实践，S2-S8 相对通用但整体扎实。P0-2（Exit Checker 每轮调 LLM）是架构级问题。 |
| 2. 策略产出具体度 | ⭐⭐⭐½ (3.5/5) | S6 的空话禁令和追溯机制优秀，但 S3/S5/S7 缺少同等级别的领域专用具体化约束。 |
| 3. 阶段间一致性 | ⭐⭐⭐½ (3.5/5) | 依赖图设计清晰，S6 枢纽定位正确。但 S8→S6 语气词库链路缺失（P0-5）和 Layer B 的触发条件限制（P0-6）是两个关键缺口。 |
| 4. 交付物专业度 | ⭐⭐⭐ (3/5) | 可编辑报告 + 多种 Block 类型是好的基础，但缺少执行摘要叙事（P0-7）和视觉参考（P0-8），离"直接给客户看"还有距离。 |
| 5. 系统工程质量 | ⭐⭐⭐ (3/5) | 模块架构清晰、Token 追踪完善。但 Audit 核心组件零测试（P0-10）、V2 Prompt 未上线（P0-9）、错误全部静默吞掉（S5-1）是三个关键工程债。 |

### 必须修复项汇总（10 项）

| 编号 | 维度 | 问题 | 优先级 |
|------|------|------|--------|
| P0-1 | 访谈精准度 | S4 缺少创始人类型分支追问逻辑 | 高 |
| P0-2 | 访谈精准度 | Exit Checker 每轮调 LLM，成本翻倍 | 高 |
| P0-3 | 策略具体度 | S3/S5 convergence 缺少领域专用空话禁令 | 高 |
| P0-4 | 策略具体度 | S7 visualSystem 缺少"不可替代性"质量门槛 | 中 |
| P0-5 | 阶段一致性 | S8→S6 brandPersonality 语气词库继承链路缺失 | 高 |
| P0-6 | 阶段一致性 | Layer B 语义断裂检查只在 Rule Check 通过时触发 | 中 |
| P0-7 | 交付物专业度 | 报告缺少执行摘要的叙事整合 | 高 |
| P0-8 | 交付物专业度 | S7 视觉策略只有文字无视觉参考 | 中 |
| P0-9 | 系统工程 | V2 优化 Prompt 存在但未接入生产环境 | 高 |
| P0-10 | 系统工程 | Audit Engine 核心组件零测试覆盖 | 高 |

### 建议改进项汇总（12 项）

| 编号 | 维度 | 问题 |
|------|------|------|
| S1-1 | 访谈精准度 | S2-S5 缺少 S1 级别的追问深度约束 |
| S1-2 | 访谈精准度 | `forceSummary` 触发方式生硬 |
| S1-3 | 访谈精准度 | Exit Checker 可以用启发式规则减少 LLM 调用 |
| S2-1 | 策略具体度 | S6 reasoning "自报追溯"机制存在漏洞 |
| S2-2 | 策略具体度 | S8 themeDirections 缺少可执行性检查 |
| S3-1 | 阶段一致性 | S7 visualSystem → S6 brandPersonality 关联检查只有关键词级别 |
| S3-2 | 阶段一致性 | S3→S4→S5 之间缺少横向一致性检查 |
| S4-1 | 交付物专业度 | 报告缺少品牌标语建议板块 |
| S4-2 | 交付物专业度 | PDF 导出没有应用品牌视觉风格 |
| S4-3 | 交付物专业度 | 报告缺少"下一步"行动建议章节 |
| S5-1 | 系统工程 | audit-engine.ts 错误处理全部静默吞掉 |
| S5-2 | 系统工程 | cross-stage.ts 动态 import 绕过测试环境问题 |
| S5-3 | 系统工程 | loader.ts 搜索协议缓存无失效机制 |
| S5-4 | 系统工程 | StageTabs 和 StageSidebar 组件职责重叠 |

---

## 优先级建议

如果要排优先级，建议先修以下三项，分别对应质量、成本、工程三个方向，投入产出比最高：

1. **P0-5**（S8→S6 语气词库链路）— 直接影响内容策略的品牌一致性，属于质量缺陷
2. **P0-9**（V2 Prompt 接入生产）— 一行代码改动即可生效，已验证节省 token，属于工程债清理
3. **P0-2**（Exit Checker 优化）— 全链路 LLM 调用减半，属于成本优化

这三个 P0 修复后，再依次推进 P0-3（空话禁令补齐）、P0-7（执行摘要）、P0-10（Audit 测试）。
