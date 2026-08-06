# interview-me Skill 机制拆解与 Prompt 工程借鉴

> 分析日期：2026-08-05
> 来源：Claude Code 内置 skill `interview-me`
> 视角：对比分析 interview-me 的方法论与我们 S1-S8 consultation prompt 的设计，提取可借鉴的 prompt 工程技术

---

## interview-me Skill 核心机制拆解

`interview-me` skill 与我们的 S1-S8 consultation prompt 本质上在做同一件事——**通过一次一问的对话，把用户脑子里模糊的东西挖出来**。但它的方法论有几个我们目前 prompt 工程中没有用到的技术。

### 机制 1：Hypothesis + Confidence 锚定（Step 1-2）

这是 interview-me 最核心的机制：

```
HYPOTHESIS: You want a way to answer "how are we doing?" in standup, and "dashboard" was the convention that came to mind.
CONFIDENCE: ~30% — missing: who it's for, what "metrics" are, and what success looks like
```

**关键设计**：在问问题之前，先显式写下自己对用户意图的假设和置信度。这不是给用户看的——是给自己看的。它强迫 AI 承认"我其实不懂，只有 30% 把握"。

**对比我们的系统**：我们的 consultation prompt 有追问规则但没有"假设锚定"机制。AI 进入对话时带着一个隐式的理解框架，但这个框架从未被显式化。如果 AI 在第 3 轮才发现自己从第 1 轮就理解偏了创始人的意思，前面 2 轮的问题都白问了。interview-me 的方式是：每一轮都把自己的理解写下来，让用户有东西可以反驳。

### 机制 2：Guess attached to every question（Step 2）

```
Q:     When you say "how are we doing?", who's asking — you alone, the engineering team, or up the chain?
GUESS: engineering team in standup, because "we" usually scopes that way and standups are where this question gets asked.
```

**关键设计**：每个问题后面跟一个猜测。这会做到几件事：
- 用户对错误猜测的反应速度远快于从零生成答案
- 暴露 AI 自己的假设——如果猜错了，用户立刻纠正
- 防止 AI 假装自己没在做假设（实际上每个问题都隐含着一个假设）

**对比我们的系统**：我们的 S1 consultation prompt 明确禁止二选一提问（"是因为 A，还是因为 B？"），要求开放式追问。这是一个精心设计的规则，目的是防止 AI 把创始人框在自己的预设里。但 interview-me 的做法提供了一个替代方案：**不是二选一，而是"我的猜测是 X，对吗？"**。这让用户有一个锚点可以反驳，同时保持了对话的开放性。

### 机制 3：Want vs. Should Want 区分（Step 3）

```
When you hear these:
- "I should probably…", "I think I'm supposed to…"
- "good engineering practice says…"
- Buzzwords as goals

The question to ask:
"If you didn't have to justify this to anyone, what would you actually want?"
```

**关键设计**：区分"用户真正想要的"和"用户觉得应该说的"。这是品牌咨询中最难的事情——创始人说"我想做高端品牌"可能只是因为"感觉做品牌就应该做高端"，而不是他真正的差异化方向。

**对比我们的系统**：我们的 S6 consultation prompt 有空话禁令（"差异化竞争""打造高品质"），但这只是过滤 AI 的输出，不是探测创始人的真实意图。我们的 S1 有"非诱导规则"——"不给用户预设痛点"——这解决了一部分问题，但没有系统性地训练 AI 识别创始人什么时候在说"should want"而不是"want"。

### 机制 4：95% 置信度停止条件（The Stop Condition）

```
You're done when:
"Can I predict the user's reaction to the next three questions I would ask?"

If yes → stop. If no → ask the next question.
If you've gone several rounds and still can't predict → something foundational is missing.
```

**关键设计**：这是一个可检验的停止条件，不是"感觉聊够了"。而且它有一个 floor——如果问了很久还达不到 95%，说明有更根本的问题，不应该继续磨。

**对比我们的系统**：我们的 exit-checker 用 LLM 逐条评估退出条件是否满足，但退出条件是预先定义的（如"s1_motivation 已明确"），不是动态的置信度判断。interview-me 的方式更轻量也更灵活：不需要定义每个阶段的退出 Schema，只需要一个判断标准——"能不能预测用户接下来三次回答"。

### 机制 5：Explicit "not yes" 门禁（Step 5）

```
The following are NOT yes:
- "Whatever you think is best."
- "Sounds good."
- "Sure, let's go."
- Silence followed by "okay let's start."
```

**关键设计**：收敛确认不是一句"请回复确认"就完事了。它区分了真正的确认和"用户懒得想了随便吧"。

**对比我们的系统**：我们的确认总结全部使用硬约束收尾语"如果以上内容准确，请回复确认"。这保证了格式一致性，但没有区分用户的不同确认状态。创始人回复"确认"可能是真的同意，也可能是"说了这么多我累了先这样吧"。interview-me 敏感地捕捉到了"whatever you think"这种假确认。

---

## 其他值得关注的 Prompt 工程技巧

### 技巧 1：Confidence number 的元认知作用

给 AI 一个显式的置信度数字（30%→60%→95%），本质上是给 AI 安装了一个"元认知显示器"。这个数字有两个作用：
1. **防止过度自信**：AI 倾向于表现得比实际更确定。显式写一个数字强迫它量化自己的不确定性
2. **进度可视化**：用户可以感知到 AI 的理解在逐步深化，而不是突然从"不懂"跳到"懂了"

### 技巧 2：Common Rationalizations 表的价值

interview-me 的 SKILL.md 中有一个 Common Rationalizations 表：

| Rationalization | Reality |
|---|---|
| "The ask is clear enough" | If you can't write the user's desired outcome in one sentence right now, the ask isn't clear. |
| "Asking too many questions wastes their time" | Time wasted by 4–6 targeted questions is small. Time wasted by building the wrong thing is enormous. |
| "I'll figure it out as I build" | Switching costs after code exists are 10x what they are now. |

这是 prompt engineering 的一个高级技巧：**预判 AI 会找什么借口跳过步骤，提前堵住**。我们的 consultation prompt 有类似的机制（如"绝对禁止在 [系统指令] 后继续提问"），但可以更系统化。

### 技巧 3：Red Flags 作为行为监控

```
- Three or more questions in a single message: that's batching, not interviewing
- A question without your hypothesis attached: that's surveying, not committing
- Accepting "whatever you think is best" as a terminal answer
```

这些 Red Flags 本质上是一组**可观测的行为违规信号**。它们让 skill 的使用者（无论是人类还是 AI）可以在不检查完整对话日志的情况下快速判断"这个 skill 被正确执行了吗"。我们的 consultation prompt 可以引入类似的 Red Flags 来帮助 QA。

### 技巧 4：Out of scope 的强制包含

```
Including "Out of scope" is non-negotiable. Half of misalignment is silent disagreement about what is *not* being built.
```

我们的每个 consultation prompt 都有 Boundary Control 部分（禁止深入后续阶段内容），但确认总结中没有要求显式列出"本阶段不做什么"。这可能导致创始人在 S2 结束后心里想"你不是说要帮我做品牌定位的吗怎么没做"，而实际应该是 S6 才做。

---

## 对我们的 Prompt 工程的五条借鉴

### 借鉴 1：在 S1 增加"假设锚定"（高优先级，低成本）

当前 S1 的开场只有品牌名和品类注入，AI 直接开始问第一个问题。可以借鉴 interview-me 的 Step 1，让 AI 在正式提问前先做一个内部的假设锚定：

```
在提问之前，基于目前的有限信息，写下你对创始人的初步假设：
- 你认为他做这件事最可能的动机是什么？
- 你对这个假设有多少把握？（用 30%/50%/70% 表示）

这个假设不会展示给创始人，但它会影响你接下来的追问方向。
如果后续对话与你的假设矛盾，重新校准你的假设。
```

**预期效果**：AI 对自己的理解偏差更敏感，减少"聊了 5 轮才发现方向偏了"的情况。

**实施方式**：在 `stage1-consultation.md` 的 Opening Message 之前插入一个"内部假设锚定"段落，明确标注"此段仅 AI 内部使用，不出现在对话中"。

### 借鉴 2：用"猜测"替代部分开放式追问（中优先级，需谨慎设计）

我们的 S1 严格禁止二选一提问，这是正确的。但 interview-me 的"猜测"机制提供了一个中间路径：

**当前**：`"能说说你想象中的用户是什么样的吗？"`（纯开放式）

**interview-me 式**：`"我猜你想象中的用户可能是刚养猫的年轻人——但我不确定，你怎么看？"`（开放式 + 锚点）

后者的好处是：如果猜对了，用户说"对就是这样"，节省一轮对话；如果猜错了，用户会说"不不不，其实是 XX"，得到了比纯开放式更具体的回答。

**风险与约束**：
- 如果 AI 连续猜错，会让用户觉得 AI 不理解他
- 只能在前序阶段已积累足够信息的前提下使用（S4-S8，不适合 S1-S2）
- 猜测必须先说"我猜"，后说"但我不确定"，保持试探性语气
- 不能在同一个话题上连续使用超过 2 次

**实施方式**：在 S4（消费者洞察）和 S6（品牌核心战略）的 consultation prompt 中增加可选的"猜测式追问"规则，并明确标注使用条件和次数限制。

### 借鉴 3：在 convergence 前增加"Want vs. Should Want"检查（高优先级）

当前我们的 convergence 直接从对话中提取事实。可以借鉴 interview-me 的 Step 3，在 convergence prompt 中增加一个检查项：

```
提取时注意区分"创始人真正想要的"和"创始人觉得应该说的"：

以下信号提示创始人可能在说"should want"而非"want"：
- 使用行业套话（"打造高端品牌""建立用户心智"）
- 未提供具体场景或案例作为支撑
- 表述与前期对话中体现的真实偏好有矛盾

遇到这些信号时，在 inference 层进行标注（如"该判断可能受行业套话影响，建议后续阶段交叉验证"），不影响 fact 层提取。
```

**预期效果**：在不改变 consultation 对话体验的前提下，提高 convergence 输出的洞察质量，防止创始人随口说的套话被当作核心判断传递到后续阶段。

**实施方式**：在每个阶段的 converge prompt 的 Extraction Rules 部分增加"Want vs. Should Want 区分"段落。这是纯 prompt 层面的改动，不需要修改任何代码逻辑。

### 借鉴 4：用"预测反应"替代"条件清单"作为停止标准（中优先级，架构改动大）

我们当前的 exit-checker 定义了 S1-S8 每个阶段的条件清单（core + supp），然后每轮用 LLM 逐条检查。这是工程上严谨的做法，但有两个问题：
1. 每轮调 LLM 成本高（评审报告中 P0-2）
2. 条件清单是静态的，不能适应创始人的个体差异

interview-me 的"95% 置信度 + 预测反应"是一种更轻量的停止标准：

```
当你认为自己已经充分理解了创始人在本阶段的需求时，做这个测试：
你能预测创始人对接下来三个问题的回答吗？

如果能 → 该方向已饱和，输出确认总结
如果不能 → 继续追问
如果追问超过 5 轮仍不能预测 → 告诉创始人"有些地方我还没理解透，我们可能需要换个角度聊"
```

**权衡**：这个改动很大——需要重写 exit-checker 的逻辑。且"预测反应"对 AI 的元认知能力要求更高（DeepSeek 能否稳定执行这个判断？）。建议先做借鉴 1 和 3，在实践中观察效果，再决定是否推进这个方向。

### 借鉴 5：区分确认的层次（低优先级，但用户体验提升明显）

当前我们的确认收尾语是硬编码的"如果以上内容准确，请回复确认"。可以借鉴 interview-me 的 Step 5，在系统层面识别假确认：

| 用户回复 | 系统响应 |
|---------|---------|
| "确认" / "没问题" / "对的" | 正常通过 |
| "差不多" / "还行" / "都可以" / "就这样吧" | 自动追问："有哪个部分你觉得不太确定的吗？" |
| "你觉得呢" / "你决定吧" / "按你说的来" | 不给 AI 决策权，改为："我需要你来确认——因为这是你的品牌。如果暂时不确定，我们可以先标注为'待定'，在后续阶段回头再确认。" |
| "可以了" / "先这样" / "没问题，继续吧" | 追问一次："有没有哪个判断你觉得需要调整的？" 如果用户再次说"没有"，则通过 |

**实施方式**：在 `stage-engine.ts` 或 API 路由层增加确认质量判断逻辑（纯代码，不调 LLM），在用户回复确认总结后做一次轻量的文本分析。

---

## 总结

| 维度 | interview-me | 我们的系统 | 借鉴价值 |
|------|-------------|-----------|---------|
| **假设锚定** | 每轮显式写假设 + 置信度 | 无（隐含假设不暴露） | ⭐⭐⭐⭐⭐ 立即可用，改动小，S1 最受益 |
| **提问格式** | 开放式 + 猜测锚点 | 纯开放式（禁止二选一） | ⭐⭐⭐⭐ 谨慎引入，S4/S6 适用，需配合使用次数限制 |
| **意图区分** | 系统性地识别 want vs should want | 有空话禁令但只过滤 AI 输出 | ⭐⭐⭐⭐ 在 convergence 中增加，纯 prompt 改动 |
| **停止条件** | 95% 置信度 + 预测反应测试 | 静态条件清单 + LLM 逐条评估 | ⭐⭐⭐ 方向正确，但架构改动大，建议先观察借鉴 1/3 效果 |
| **确认门禁** | 区分真确认和假确认 | 硬编码收尾语，不区分确认质量 | ⭐⭐⭐ 用户体验提升明显，纯代码实现 |

### 核心启发

**interview-me 的核心哲学**：AI 不应该假装自己懂了。它通过 Hypothesis + Confidence + Guess 三个机制系统性地暴露 AI 的不确定性，让用户有东西可以纠正。

我们当前的 consultation prompt 在"如何追问"上做得很好（S1 的 Exploration Framework 是行业级最佳实践），但在"如何确认自己理解对了"上还有空间——确认总结是最后的兜底，但那时候已经聊完了整个阶段。interview-me 让我们看到一种可能性：**在每一轮对话中持续校准理解，而不是到最后才确认**。
