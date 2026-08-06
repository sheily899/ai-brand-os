# Agent Loop Feasibility Judgment — Brand Intelligence OS S1-S8

## 判定结论

**条件可行。** 在严格将 Agent Loop 限制在单次咨询回合内部、不触碰工作流状态机的前提下，S3（市场机会分析）和 S5（竞争判断）可以接入 LLM 工具调用能力，使 LLM 在对话中自主发起搜索。核心洞察：Agent Loop 是对单个 `chatStream()` 调用的**原地替换**——上游的 exit checker 和下游的状态机对 Agent 的存在无感知，所有确定性保证（G3 状态转换、G5 质量门禁流水线、G6 来源可追溯）均保持不变。

---

## 当前架构回顾

### S1-S8 的 LLM 调用模式

```
                        ┌─ [代码控制] ─┐
                        │              │
  User Input ──► Exit Checker ──► buildMessages()
       ▲              │                │
       │              ▼                ▼
       │      conditionsMet?    ┌─────────────┐
       │      YES → forceSummary│ systemPrompt │
       │      NO  → missingInfo │ + history    │
       │                        │ + searchCtx  │◄── runSearch() [代码控制]
       │                        │ + protocol   │    在 stage init 时执行
       │                        └──────┬──────┘
       │                               │
       │                               ▼
       │                   ┌─────────────────────┐
       │                   │  chatStream()       │ ◄── ★ 唯一的 LLM 自由发挥点
       │                   │  1 次调用            │     temperature=0.7
       │                   │  maxTokens=2048     │     maxTokens 硬上限
       │                   │  → SSE stream       │     搜索上下文只读
       │                   └──────────┬──────────┘
       │                              │
       │                              ▼
       │                   [代码控制]
       │                   detectConfirmationSummary()
       │                   saveHistory()
       │                              │
       └──────────────────────────────┘
                  下一轮用户消息
```

**关键事实：**

| 控制点 | 谁在控制 | 控制方式 |
|--------|---------|---------|
| 何时搜索 | 代码 | `stage-engine.ts:392-411`，stage init 时执行 `runSearch()` |
| 搜索什么 | LLM（间接） | `shared-search-protocol.md` 注入 system prompt，但 LLM 不执行搜索 |
| 何时退出 | 代码 | `exit-checker.ts:429-440`，`minRounds` 守卫 + LLM 评估 + 逐条件重算 |
| 何时收敛 | 代码触发，LLM 执行 | `forceSummary` → `runConvergence()` 调用 LLM 生成 JSON |
| 何时审计 | 代码 | 用户点击确认 → `/confirm` API → `audit-engine.ts` |
| 状态转换 | **纯代码** | `workflow.ts` `handleGateDecision()`，三值枚举映射 |

**LLM 真正"自由发挥"的只有一个点：** 在 `chatStream()` 中，给定 system prompt + 历史 + 搜索上下文，生成一段咨询文本。自由度的边界由 prompt 划定——LLM 不能发起搜索、不能触发状态转换、不能决定回合何时结束。所有这些都由代码在 LLM 调用前后处理。

---

## Agent 接入点分析

| 阶段 | 当前 LLM 角色 | Agent 自主性可做什么 | 接入难度 | 推荐优先级 | 理由 |
|------|-------------|-------------------|---------|-----------|------|
| **S1** 用户访谈 | 倾听者：追问创始人观察，禁止外部数据 | 无。外部数据在此阶段是**信号污染** | -- | **不建议** | 该阶段测量创始人自身能否独立表述观察。给 Agent 搜索工具会让 LLM"引导"创始人而非"倾听"创始人，破坏信号质量 |
| **S2** 品牌背景 | 核实者：已有搜索协议注入 prompt，但 LLM 不能执行搜索 | 当创始人声称"咖啡市场增长很快"，Agent 主动搜索行业增长率/冷链数据交叉验证。角色定位：**事实核查**，非自主发现 | 低 | **P2**（可选） | 搜索已在此阶段被描述为"核实"。Agent 只是让核实从"被动知道应该核实什么"变成了"主动去做核实"。工具仅限 `web_search` |
| **S3** 市场机会 | 研究者：需要品类定义、供给侧格局、消费趋势数据 | Agent 自主搜索品类边界、竞品供给、消费者行为趋势。当首次搜索结果薄弱时，自主改写查询。交叉验证创始人声称的市场规模。识别体验缺口（搜索消费者投诉） | 中 | **P0** | 这是 Agent 自主性增值最大的阶段之一。搜索需求天然是多轮、迭代式的——Agent 的"搜了看、看了再搜"循环与人类分析师的工作方式一致 |
| **S4** 消费者洞察 | 诊断者：区分 Path A（观察过用户）vs Path B（猜测）。**Prompt 明确禁止搜索工具** | 无。外部消费者数据会掩盖创始人对用户的真实理解水平 | -- | **不建议** | 架构设计上这是一个"纯度"阶段——外部数据即污染。Path A/B 框架就是设计来暴露创始人是否真的看过用户，Agent 填充消费者画像会破坏诊断能力 |
| **S5** 竞争判断 | 分析师：需要每个竞品的定位、产品、定价、评论数据。对外部数据依赖最高 | Agent 自主搜索每个竞品的品牌定位/产品目录/定价，抓取正负面用户评论，搜索市场份额/融资/专利信息，识别竞品间差异化和竞争空白。当竞品 A 的定位疑似与 B 雷同时，专门搜索差异化声明 | 中 | **P0（最高优先级）** | 无搜索时，输出质量崩塌。竞争方向表和竞品分析表需要真实品牌的事实信息，创始人可能不完整了解。这是 Agent 自主性相对确定性流水线**质量增量最大**的阶段 |
| **S6** 品牌核心 | 综合者：收敛前 5 阶段判断为品牌核心战略。**Prompt 禁止收集新数据** | 无。所有输入来自 S1-S5 的输出 | -- | **不建议** | 综合阶段。外部数据此时是冗余或干扰——工作已在上游完成 |
| **S7** 视觉策略 | 翻译者：将品牌定位翻译为视觉方向。所有视觉判断必须可追溯到 S6 锚点 | 竞品视觉审计（竞品 logo/包装长什么样）在逻辑上合理，但 prompt 将视觉决策全线锚定在 S6 输出上。添加视觉研究工具会创建一条绕过 S6 锚点的独立输入流 | -- | **不建议** | 视觉 = 品牌战略的翻译，不是独立研究。即使技术上可行，违反架构设计意图 |
| **S8** 内容策略 | 策略者：品牌表达驱动的选题策略。**Prompt 明确禁止流量/涨粉/算法等运营指标** | 平台最佳实践研究（各平台最优内容格式）在技术上可行，但使用这类工具会将 Agent 拉向算法驱动思维，恰好违背了 prompt 的设计意图 | -- | **不建议** | 品牌表达驱动 vs 平台算法驱动，是两个对立的策略哲学。给 Agent 平台研究工具 = 让 prompt 的边界控制失效 |

### 优先级排序

```
P0（立即实施）: S5 竞争判断 > S3 市场机会
P2（可选）:    S2 品牌背景（仅核实模式）
不建议:        S1, S4, S6, S7, S8
```

---

## 必须解决的冲突

### 冲突 1：搜索时机 —— 代码控制在 stage init vs Agent 在对话中途搜索

**现状：** `stage-engine.ts:392-411` 在阶段初始化时执行 `runSearch()`，搜索结果作为静态文本注入 system prompt。LLM 收到的是一个"已完成的搜索报告"，无法要求补充搜索。

**Agent 模式：** LLM 在对话中途决定搜索，结果以 `role: "tool"` 消息形式返回，而非 system prompt 文本。

**解决方案：** 保持预计算的搜索作为"启动上下文"（seeded into first system prompt）。Agent 的工具调用循环在此之上叠加**补充搜索**。这是加法，不是替代——确定性流水线仍然执行，Agent 获得额外能力。两者不冲突。

---

### 冲突 2：状态转换 —— Agent 想"继续研究" vs 代码强制进入 converging

**现状：** `workflow.ts` `handleGateDecision()` 接收三值枚举（advance/reoptimize/block），确定性地映射到阶段状态。`message/route.ts:495-537` 强制执行 exit-check → forceSummary → converging → waiting_confirm 链条。状态机没有"Agent 决定继续研究"的概念。

**Agent 模式：** Agent 可能判断"信息不足，需要更多研究"，希望延长咨询阶段。

**解决方案：** Agent Loop **不控制状态转换**。边界严格限定：Loop 在单次 `chatStream()` 调用内部运行，HTTP 响应返回前完成。Agent 完成后产生的最终文本响应由现有状态机处理，方式与之前完全相同。Agent 可以决定"我需要搜索"，但不能决定"我完成了这个阶段"。如果 Agent 在工具循环后仍缺少关键信息，它在最终响应中标注未覆盖的维度，由下一轮用户消息触发新的回合——符合现有工作流。

---

### 冲突 3：确认摘要检测 —— 纯字符串匹配 vs 中间 tool_call 块

**现状：** `exit-checker.ts:593`，`detectConfirmationSummary()` 检查字面字符串 "如果以上内容准确，请回复确认"。当前响应是纯文本流。

**Agent 模式：** 响应流中可能包含 tool_call chunk 与文本交替出现。字符串匹配需要在最终文本输出上操作，而非中间 chunk。

**解决方案：** 无需特殊处理。确认检测运行在 `fullResponse`（流完成后累积的文本，`message/route.ts:600`）上。只要 Agent Loop 在 route handler 进入检测前完成并产生最终文本响应，字符串匹配照常工作。tool_call chunk 不包含在 `fullResponse` 中——只有 `role: "assistant"` 的 content chunk 被累积。**零改动。**

---

### 冲突 4：Token 预算和延迟 —— 1 次 LLM 调用 2K output tokens / ~5s vs 3-5 次调用 / ~30s

**现状：** 每个用户消息恰好 1 次咨询 LLM 调用，`maxTokens: 2048`，预期秒级完成。

**Agent 模式：** Agent Loop 可产生 3-5 次 LLM 调用（搜索决策 → 查看结果 → 可能再搜索 → 最终响应），每次消耗工具定义的 token 和搜索结果的 token。延迟从约 5s 膨胀到约 30s，成本从约 2K output token 膨胀到可能 10K+。

**解决方案：** 实施硬上限，按阶段差异化：

| 阶段 | 最大工具轮次/回合 | 最大搜索次数/轮 | 总超时 | Token 上限 |
|------|-----------------|---------------|--------|-----------|
| S2 | 2 | 2 | 30s | 6K output |
| S3 | 3 | 3 | 60s | 10K output |
| S5 | 5 | 5 | 90s | 15K output |

上限触发时 Agent 必须以已有信息生成响应，并标注未覆盖的维度供用户补充。**这是产品决策，不是架构决策。**

---

### 冲突 5：来源追溯 —— 确定性 pipeline 的 `dataSources` vs Agent 搜索结果

**现状：** `search-context.ts` 维护 `dataSources` 数组（URL, title, sourceType）。所有外部数据有可追溯来源。

**Agent 模式：** Agent 发起的搜索不在预计算的 `dataSources` 中。

**解决方案：** 每次工具调用结果必须记录：`{tool: "web_search", query: "...", results: [{url, title, snippet}], timestamp}`。Agent 向用户展示搜索发现时，必须使用现有引用格式 `[来源名称](URL)`。`dataSources` 数组合并预计算来源和工具调用来源。**强制要求，非可选。**

---

## 最小可行改造方案

### 选定试点阶段：S5 竞争判断（5/5 fit，质量增量最大）

### 改造步骤（按依赖顺序）

#### Step 1：LLM Provider 支持工具调用（基础设施）

**文件：** `D:\brand-intelligence-os\src\lib\ai\provider\interface.ts`

在 options 接口中新增：
```typescript
tools?: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}>;
```

在 `StreamChunk` 中新增字段：
```typescript
tool_calls?: Array<{
  index: number;
  id: string;
  function: { name: string; arguments: string };
}>;
```

**文件：** `D:\brand-intelligence-os\src\lib\ai\provider\deepseek.ts`

- `doChat()`（约第 55 行）：将 `tools` 和 `tool_choice` 传入 `client.chat.completions.create()`
- `chatStream()`（约第 163 行）：在 stream 迭代中检查 `delta.tool_calls`，产出 tool call chunk

**预估工时：** 1 天

---

#### Step 2：工具定义与执行器

**新文件：** `D:\brand-intelligence-os\src\lib\ai\tools\definitions.ts`

定义两个工具：
```typescript
// web_search: 调用 bochaSearch()
export const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "搜索互联网获取实时信息。用于查找竞品信息、行业数据、市场趋势、消费者评论。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索查询词" },
        count: { type: "number", description: "返回结果数量，默认5，最大10" },
        freshness: { type: "string", description: "时间范围: Day/Week/Month/Year" }
      },
      required: ["query"]
    }
  }
};

// fetch_content: 调用 retrieveOne()
export const FETCH_CONTENT_TOOL = {
  type: "function" as const,
  function: {
    name: "fetch_content",
    description: "抓取指定 URL 的完整内容。用于深入阅读搜索结果中的页面。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "要抓取的页面 URL" },
        title: { type: "string", description: "页面标题，用于来源标注" }
      },
      required: ["url"]
    }
  }
};
```

**新文件：** `D:\brand-intelligence-os\src\lib\ai\tools\executor.ts`

```typescript
import { bochaSearch } from "../search/bocha-search";
import { retrieveOne } from "../search/retrieval";

export async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "web_search":
      return await bochaSearch(args.query as string, { count: args.count as number, freshness: args.freshness as string });
    case "fetch_content":
      return await retrieveOne(args.url as string, args.title as string, "");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function formatToolResult(name: string, result: unknown): string {
  return JSON.stringify(result);  // LLM 期望 role: "tool" 的 content 为字符串
}
```

**预估工时：** 0.5 天

---

#### Step 3：Agent Loop 集成到咨询流处理器

**文件：** `D:\brand-intelligence-os\src\app\api\project\[id]\stage\[n]\message\route.ts`（约第 562-666 行）

将当前单个 `chatStream()` 调用（约第 580 行）替换为 Agent Loop：

```
当前代码（约第 580 行）:
  const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2048 });
  for await (const chunk of stream) { ... }

替换为:
  let loopMessages = [...builtMessages];
  let toolRound = 0;
  const MAX_ROUNDS = 5;  // S5 专用
  let fullResponse = "";

  while (toolRound < MAX_ROUNDS) {
    const stream = provider.chatStream(loopMessages, {
      temperature: 0.7,
      maxTokens: 2048,
      tools: getToolsForStage(5),  // [web_search, fetch_content]
    });

    let hasToolCalls = false;
    const pendingToolCalls: Array<{id: string, name: string, args: string}> = [];

    for await (const chunk of stream) {
      if (chunk.tool_calls) {
        hasToolCalls = true;
        for (const tc of chunk.tool_calls) {
          pendingToolCalls.push({id: tc.id, name: tc.function.name, args: tc.function.arguments});
        }
      }
      if (chunk.content) {
        fullResponse += chunk.content;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({content: chunk.content})}\n\n`));
      }
    }

    if (!hasToolCalls) break;  // LLM 输出了最终文本，退出循环

    // 执行工具调用，追加结果到消息列表
    const assistantMsg: any = { role: "assistant", content: null, tool_calls: pendingToolCalls.map(tc => ({
      id: tc.id, type: "function", function: { name: tc.name, arguments: tc.args }
    }))};
    loopMessages.push(assistantMsg);

    for (const tc of pendingToolCalls) {
      const result = await executeTool(tc.name, JSON.parse(tc.args));
      loopMessages.push({ role: "tool", tool_call_id: tc.id, content: formatToolResult(tc.name, result) });
    }

    toolRound++;
  }
```

**关键约束：**
- Loop 边界：用户消息进入 → Agent Loop（LLM ↔ 工具）→ 最终文本响应 → HTTP 响应返回。Loop 在 HTTP 响应返回前完成。
- Agent **不能**调用 `setStageStatus()`、不能触发 `forceSummary`、不能调用 `confirmAndCompleteStage()`。这些操作仍是纯代码行为。
- 工具执行 handler 返回工具结果给 LLM，**不修改数据库状态**。

**预估工时：** 0.5 天

---

#### Step 4：按阶段控制工具可用性

**新文件：** `D:\brand-intelligence-os\src\lib\ai\tools\registry.ts`

```typescript
export function getToolsForStage(stage: number): ChatCompletionTool[] {
  switch (stage) {
    case 5: return [WEB_SEARCH_TOOL, FETCH_CONTENT_TOOL];
    case 3: return [WEB_SEARCH_TOOL, FETCH_CONTENT_TOOL];
    case 2: return [WEB_SEARCH_TOOL];  // 仅核实模式
    default: return [];
  }
}
```

**预估工时：** 0.1 天

---

#### Step 5：工具结果持久化（DB schema 变更）

`conversation_history` 表需支持 `tool_call` 和 `tool_result` 消息类型（当前仅 `role: user/assistant` 且仅存储 `content`）。这确保工具调用出现在对话历史中，供 exit checker 和收敛使用。

**预估工时：** 0.5 天

---

#### Step 6：A/B 测试验证（推荐，非必需）

在部署到生产前，用此前实验中使用的相同 5-case benchmark（参见 memory 文件中的 E2E 测试报告和 search context compression A/B 测试），对比 Agent 工具调用开启 vs 关闭：

| 指标 | 测量方法 |
|------|---------|
| 输出质量 | AI audit 四维度评分（完整性/准确性/深度/可执行性） |
| Token 消耗 | 每次调用的 input/output token 计数 |
| 延迟 | 从消息发送到完整响应返回的时间 |
| 对话长度 | 到达 exit conditions 的回合数 |

**预估工时：** 1 天

---

### 总工时估算

| 步骤 | 内容 | 工时 |
|------|------|------|
| Step 1 | Provider 工具调用支持 | 1 天 |
| Step 2 | 工具定义与执行器 | 0.5 天 |
| Step 3 | Agent Loop 集成 | 0.5 天 |
| Step 4 | 阶段工具注册表 | 0.1 天 |
| Step 5 | DB schema 变更 | 0.5 天 |
| Step 6 | A/B 测试验证 | 1 天 |
| **合计** | **S5 Agent Loop 全链路** | **3.6 天** |

S3 追加：+0.5 天。S2 追加：+0.5 天。

---

### 不可修改的文件（保持确定性保证）

| 文件 | 原因 |
|------|------|
| `workflow.ts` `handleGateDecision()` | 状态转换必须保持代码控制 |
| `exit-checker.ts` `checkExitConditions()` | 退出评估必须保持代码触发（在用户消息后、Agent Loop 前） |
| `stage-engine.ts` `confirmAndCompleteStage()` | converge→audit→advance 流水线不变 |
| `audit-engine.ts` `runStageAudit()` | 审计运行在收敛 JSON 上，不依赖对话历史 |
| `convergence.ts` `runConvergence()` | 收敛仍用相同的 Zod schema 将对话历史蒸馏为结构化 JSON |
| `reference/shared-search-protocol.md` | 搜索协议保持为指令集——只是从"LLM 被告知应该搜什么"变成"LLM 可以执行搜索" |

---

### 改造后的架构

```
                    USER 发送消息
                         │
                         ▼
              message/route.ts (line 505)
              checkExitConditions(history)
                         │
              ┌──────────┴──────────┐
              │ conditionsMet?       │
              │ YES → forceSummary   │
              │ NO  → missingInfo    │
              └──────────┬──────────┘
                         │
                         ▼
              message/route.ts (line 541)
              buildMessages(history, forceSummary, missingInfo)
                         │
                         ▼
         ┌───────────────────────────────────────┐
         │  ★ AGENT LOOP (新增)                  │
         │  ┌─────────────────────────────────┐  │
         │  │ while toolRounds < MAX:          │  │
         │  │   chatStream(messages, tools)    │  │
         │  │   if tool_calls in response:     │  │
         │  │     executeTool()                │  │
         │  │     append result to messages    │  │
         │  │     continue loop                │  │
         │  │   else:                          │  │
         │  │     break (最终文本响应)          │  │
         │  └─────────────────────────────────┘  │
         │  限制在单次 HTTP 请求内。              │
         │  不能修改 DB 状态。                    │
         │  不能触发状态转换。                    │
         └───────────────────────────────────────┘
                         │
                         ▼
              message/route.ts (line 600+)
              fullResponse 累积文本
              detectConfirmationSummary(fullResponse)
              saveHistory(projectId, stage, messages)
              → 现有状态机不变
```

Agent Loop 是单个 `chatStream()` 调用的**原地替换**。上游（exit checker、prompt 构建）和下游（确认检测、状态转换）都运行在相同的契约上：消息列表进，文本响应出。Loop 对工作流框架完全透明。

---

## 面试话术

**问："你的系统是 Agent 吗？"**

**答：**

> 不是端到端的自主 Agent。我们的系统有一个确定性的工作流状态机控制阶段流转——什么时候进入下个阶段、什么时候触发质量审计、什么时候要求补充信息，这些都是代码逻辑决定的，LLM 不能自行改变。

> 但在**单个咨询回合内部**，我们给 LLM 配了搜索工具。它听到创始人说"竞品 X 在降价"，可以自己决定搜一下验证，搜到结果后还可以判断要不要再深挖。这个搜索-判断-再搜索的循环是 LLM 自主的——但它被严格限制在一轮对话的生命周期内，完了就交还给状态机。

> 你可以把它理解成：**工作流是轨道，Agent 是车厢里的研究员。** 轨道是代码铺的，车厢跑在轨道上。研究员在车厢里可以自由翻资料、交叉验证、深入挖掘——但他不能扳道岔。

---

*文档生成日期：2026-07-31*
*基于：Agent Loop Feasibility Assessment for Brand Intelligence OS S1-S8 Workflow*
