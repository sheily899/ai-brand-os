/**
 * POST /api/project/[id]/stage/[n]/message
 * Consultation 消息 — SSE 流式响应
 */
import { NextRequest } from "next/server";
import { loadPrompt, buildMessages, isSearchStage } from "@/lib/ai/loader";
import { getLLMProvider } from "@/lib/ai/provider";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord, saveConsultationMessages, saveSearchContext } from "@/lib/db/stage-repo";
import { initStageRecord, getStageStatus, setStageStatus } from "@/lib/workflow/workflow";
import { buildMemoryContext } from "@/lib/memory/decision-memory";
import { checkExitConditions, detectConfirmationSummary } from "@/lib/ai/exit-checker";
import { classifyConfirmationIntent } from "@/lib/ai/intent-classifier";
import { recordUsageFromProvider, estimateCharCount } from "@/lib/ai/token-tracker";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  const { message, searchEnabled } = await req.json();
  if (!message) {
    return Response.json({ error: "消息不能为空" }, { status: 400 });
  }

  // 获取项目信息
  const project = await getProjectById(projectId);
  if (!project) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  // 确保阶段记录存在（含依赖守卫：禁止跳过前序阶段）
  try {
    await initStageRecord(projectId, stageNumber);
  } catch (e: any) {
    return Response.json(
      { error: e.message || "无法进入此阶段", code: "STAGE_LOCKED" },
      { status: 403 }
    );
  }

  // 活跃阶段校验：拒绝向 invalidated 阶段发送消息
  let currentStatus = await getStageStatus(projectId, stageNumber);
  if (currentStatus === "invalidated") {
    return Response.json(
      {
        error: "当前阶段的上游决策已变更，请先完成影响评估后再继续",
        code: "STAGE_INVALIDATED",
      },
      { status: 409 }
    );
  }
  if (
    currentStatus !== "active" &&
    currentStatus !== "draft" &&
    currentStatus !== "waiting_confirm" &&
    currentStatus !== "converging" &&
    currentStatus !== "completed"
  ) {
    return Response.json(
      {
        error: `当前阶段状态为 ${currentStatus}，无法发送消息`,
        code: "STAGE_NOT_ACTIVE",
      },
      { status: 403 }
    );
  }

  // 读取已有对话历史
  const record = await getStageRecord(projectId, stageNumber);
  const history: Array<{ role: "user" | "assistant"; content: string }> =
    (record?.consultationMessages as any[])?.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? [];

  // ── converging 状态：兜底检查（安全网）──────────────
  // 正常情况下，AI 输出确认总结后 detectConfirmationSummary 会把状态切到
  // waiting_confirm。但万一检测失败，状态仍为 converging，用户发送的"确认"
  // 不应掉进正常 Consultation。这里用精确字符串匹配再验证一次。
  if (currentStatus === "converging") {
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");
    const lastResponse = lastAssistantMsg?.content ?? "";

    if (detectConfirmationSummary(lastResponse)) {
      // 命中固定收尾语 → AI 确实已输出确认总结，补设状态
      console.log("[message] converging 兜底：检测到固定收尾语，补设 waiting_confirm");
      await setStageStatus(projectId, stageNumber, "waiting_confirm");
      currentStatus = "waiting_confirm";
      // 继续往下走，下面的 waiting_confirm 分支会接管
    } else {
      // 未命中 → AI 上一条是正常追问而非总结。恢复为 active 继续咨询。
      console.log("[message] converging 状态但未检测到确认总结，恢复为 active");
      await setStageStatus(projectId, stageNumber, "active");
      currentStatus = "active";
      // 继续往下走，进入正常 Consultation 流程
    }
  }

  // ── waiting_confirm 状态：意图分类 + 自动完成 ──────
  if (currentStatus === "waiting_confirm") {
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");
    const confirmationSummary = lastAssistantMsg?.content ?? "";

    // 分类用户意图
    let intent: string;
    let modificationNotes: string | undefined;
    let rejectionReason: string | undefined;

    try {
      const classification = await classifyConfirmationIntent(message, confirmationSummary);
      intent = classification.intent;
      modificationNotes = classification.modificationNotes;
      rejectionReason = classification.rejectionReason;
      console.log(`[message] 意图分类: ${intent} (${classification.reason})`);
    } catch (e: any) {
      console.warn(`[message] 意图分类失败: ${e.message}`);
      // 降级：保守视为 confirm
      intent = "confirm";
    }

    // ── confirm: 自动完成阶段 ──────────────────────
    if (intent === "confirm") {
      // 保存用户的确认消息
      const confirmHistory = [
        ...history,
        { role: "user" as const, content: message, timestamp: new Date().toISOString() },
      ];
      await saveConsultationMessages(projectId, stageNumber, confirmHistory as any);

      // 预加载 Schema（同步操作，提前完成以避免 stream 内 import 失败无回退）
      const schemas: Record<number, any> = {
        1: (await import("@/lib/schemas/founder-vision")).founderVisionSchema,
        2: (await import("@/lib/schemas/business-context")).businessContextSchema,
        3: (await import("@/lib/schemas/market-insights")).marketInsightsSchema,
        4: (await import("@/lib/schemas/consumer-insight")).consumerInsightSchema,
        5: (await import("@/lib/schemas/competitive")).competitiveInsightsSchema,
        6: (await import("@/lib/schemas/brand-strategy")).brandStrategySchema,
        7: (await import("@/lib/schemas/visual-strategy")).visualStrategySchema,
        8: (await import("@/lib/schemas/content-strategy")).contentStrategySchema,
      };
      const schema = schemas[stageNumber];

      // 运行完整确认管道（SSE 流式返回进度 + 结果）
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // 辅助函数：发送 SSE 事件
          const emit = (data: Record<string, any>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // ── Step 1: Schema 校验 ────────────────────
            if (!schema) {
              emit({ done: true, confirmed: true, success: false, advanced: false,
                errors: [`Stage ${stageNumber} Schema 未实现`] });
              controller.close();
              return;
            }

            emit({ content: "正在收束阶段对话…" });

            const { confirmAndCompleteStage } = await import("@/lib/stage/stage-engine");

            const result = await confirmAndCompleteStage({
              projectId,
              stageNumber,
              brandName: project.name,
              category: project.category ?? "",
              schema,
            });

            // ── 始终发送 done 事件（无论成功失败）───────
            emit({
              done: true,
              confirmed: true,
              success: result.success,
              advanced: result.advanced,
              nextStage: result.nextStage,
              gateDecision: result.gateDecision,
              auditReport: result.auditReport,
              openingMessage: result.openingMessage,
              errors: result.errors,
            });
          } catch (e: any) {
            // ⚠️ 异常也发送 done 事件，确保前端不会永久等待
            console.error(`[message] confirm 管道异常: ${e.message}`);
            emit({
              done: true,
              confirmed: true,
              success: false,
              advanced: false,
              errors: [e.message || "确认管道执行失败"],
            });
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ── modify: 回到咨询模式 ────────────────────────
    if (intent === "modify") {
      await setStageStatus(projectId, stageNumber, "active");
      console.log(`[message] 用户要求修改，状态从 waiting_confirm → active`);

      // 注入修改上下文：告知 AI 用户对哪些部分不满意
      const modifyContext = modificationNotes
        ? `[系统提示] 用户对确认总结中的以下内容需要修改：${modificationNotes}。请基于用户的修改意见，继续当前阶段的咨询，聚焦于需要调整的部分。`
        : `[系统提示] 用户希望对确认总结进行修改，请询问具体需要调整哪些内容。`;

      // 保存用户的修改消息
      const modifyHistory = [
        ...history,
        { role: "user" as const, content: message, timestamp: new Date().toISOString() },
      ];
      await saveConsultationMessages(projectId, stageNumber, modifyHistory as any);

      // 重新加载上下文继续咨询
      const currentRound = history.length / 2 + 1;
      const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);
      const systemPrompt = loadPrompt({
        stage: stageNumber,
        mode: "consultation",
        variables: { 品牌名: project.name, 品类: project.category ? `的 ${project.category}` : "" },
        decisionMemoryContext: decisionMemoryContext || undefined,
        searchContext: record?.searchContext || undefined,
        includeSearchProtocol: isSearchStage(stageNumber),
      });

      const messageWithModify = `> 当前为本阶段第 ${currentRound + 1} 轮对话\n\n${modifyContext}\n\n${message}`;
      const modifiedMessages = buildMessages(systemPrompt, history, messageWithModify);

      // 流式返回 AI 回复
      const provider = getLLMProvider();
      const encoder = new TextEncoder();
      const modifyStream = new ReadableStream({
        async start(controller) {
          let fullResponse = "";
          try {
            const aiStream = provider.chatStream(modifiedMessages, { temperature: 0.7, maxTokens: 2048 });
            for await (const chunk of aiStream) {
              if (chunk.content) {
                fullResponse += chunk.content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
                );
              }
            }
            // Token 追踪
            if (provider.lastUsage) {
              const { systemChars, conversationChars } = estimateCharCount(modifiedMessages);
              recordUsageFromProvider(provider, { projectId, stageNumber, callType: "consultation", systemPromptChars: systemChars, conversationChars }).catch(() => {});
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, fullResponse, intent: "modify" })}\n\n`)
            );
            // 保存
            const updated = [
              ...history,
              { role: "user" as const, content: message, timestamp: new Date().toISOString() },
              { role: "assistant" as const, content: fullResponse, timestamp: new Date().toISOString() },
            ];
            await saveConsultationMessages(projectId, stageNumber, updated as any);
          } catch (e: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`)
            );
          }
          controller.close();
        },
      });

      return new Response(modifyStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ── reject: 重新咨询 ────────────────────────────
    if (intent === "reject") {
      await setStageStatus(projectId, stageNumber, "active");
      console.log(`[message] 用户拒绝确认总结，状态从 waiting_confirm → active（重新开始）`);

      // 保存用户的拒绝消息
      const rejectHistory = [
        ...history,
        { role: "user" as const, content: message, timestamp: new Date().toISOString() },
      ];
      await saveConsultationMessages(projectId, stageNumber, rejectHistory as any);

      // 注入拒绝上下文
      const rejectContext = rejectionReason
        ? `[系统提示] 用户对确认总结表示不认可：${rejectionReason}。请以开放态度重新理解用户的想法，从 Exploration Framework 中尚未充分覆盖的维度开始。`
        : `[系统提示] 用户对确认总结表示不认可，希望重新讨论。请以开放态度重新理解用户的核心意图，从最基础的信息开始收集。`;

      // 重新加载上下文继续咨询
      const currentRound = history.length / 2 + 1;
      const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);
      const systemPrompt = loadPrompt({
        stage: stageNumber,
        mode: "consultation",
        variables: { 品牌名: project.name, 品类: project.category ? `的 ${project.category}` : "" },
        decisionMemoryContext: decisionMemoryContext || undefined,
        searchContext: record?.searchContext || undefined,
        includeSearchProtocol: isSearchStage(stageNumber),
      });

      const messageWithReject = `> 当前为本阶段第 ${currentRound + 1} 轮对话\n\n${rejectContext}\n\n${message}`;
      const rejectMessages = buildMessages(systemPrompt, history, messageWithReject);

      const provider = getLLMProvider();
      const encoder = new TextEncoder();
      const rejectStream = new ReadableStream({
        async start(controller) {
          let fullResponse = "";
          try {
            const aiStream = provider.chatStream(rejectMessages, { temperature: 0.7, maxTokens: 2048 });
            for await (const chunk of aiStream) {
              if (chunk.content) {
                fullResponse += chunk.content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
                );
              }
            }
            // Token 追踪
            if (provider.lastUsage) {
              const { systemChars, conversationChars } = estimateCharCount(rejectMessages);
              recordUsageFromProvider(provider, { projectId, stageNumber, callType: "consultation", systemPromptChars: systemChars, conversationChars }).catch(() => {});
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, fullResponse, intent: "reject" })}\n\n`)
            );
            const updated = [
              ...history,
              { role: "user" as const, content: message, timestamp: new Date().toISOString() },
              { role: "assistant" as const, content: fullResponse, timestamp: new Date().toISOString() },
            ];
            await saveConsultationMessages(projectId, stageNumber, updated as any);
          } catch (e: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`)
            );
          }
          controller.close();
        },
      });

      return new Response(rejectStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // 当前轮次（历史消息对数为已完成轮次，+1 为当前轮次）
  const currentRound = history.length / 2 + 1;

  // 加载 Decision Memory Context（前序阶段已确认的战略资产）
  const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);

  // ── 消息级搜索 ──────────────────────────────────────
  let dynamicSearchContext: string | undefined;
  let searchResultEvent: {
    query: string;
    findings: string;
    credibility: string;
    impact: string;
  } | null = null;

  if (searchEnabled) {
    try {
      const { runSearch } = await import("@/lib/ai/search");
      const searchOutput = await runSearch({
        stage: stageNumber,
        brandName: project.name,
        category: project.category ?? "",
        decisionMemoryContext: decisionMemoryContext || undefined,
      });

      dynamicSearchContext = searchOutput.formatted.contextText;

      // 持久化搜索上下文（覆盖旧值）
      try {
        await saveSearchContext(projectId, stageNumber, dynamicSearchContext);
      } catch { /* 保存失败不阻塞 */ }

      // 构建前端 SearchResult 卡片数据
      const directCount = searchOutput.retrieved.filter(
        (r) => r.sourceType === "fulltext"
      ).length;
      const snippetCount = searchOutput.retrieved.filter(
        (r) => r.sourceType === "snippet"
      ).length;

      searchResultEvent = {
        query: searchOutput.intent.queries[0]?.keyword ?? searchOutput.intent.objective,
        findings: searchOutput.formatted.coverageReport,
        credibility:
          `共检索 ${searchOutput.results.length} 条结果，选取 ${searchOutput.ranked.length} 个来源` +
          (directCount > 0
            ? `，其中 ${directCount} 个来源获取了全文`
            : "") +
          (snippetCount > 0
            ? `，${snippetCount} 个来源基于搜索摘要判断`
            : ""),
        impact: `搜索上下文已注入 S${stageNumber} 的系统提示词，AI 将在回复中引用搜索结果。`,
      };
    } catch (e: any) {
      console.error(`[message] 搜索失败: ${e.message}`);
    }
  }

  // 合并搜索上下文（优先使用本次动态搜索，fallback 到阶段自动搜索）
  const effectiveSearchContext = dynamicSearchContext || record?.searchContext || undefined;

  // 加载 Prompt（注入 Decision Memory Context + 搜索上下文 + 搜索协议）
  const systemPrompt = loadPrompt({
    stage: stageNumber,
    mode: "consultation",
    variables: { 品牌名: project.name, 品类: project.category ? `的 ${project.category}` : "" },
    decisionMemoryContext: decisionMemoryContext || undefined,
    searchContext: record?.searchContext || undefined,
    includeSearchProtocol: isSearchStage(stageNumber),
  });

  // ── URL 内容抓取 ──────────────────────────────────────
  let fetchedUrlContent: string | undefined;

  const URL_RE = /https?:\/\/[^\s]+/g;
  const urlsInMessage = message.match(URL_RE);
  if (urlsInMessage && urlsInMessage.length > 0) {
    try {
      const results: string[] = [];
      for (const url of urlsInMessage.slice(0, 3)) {
        // 只抓取前 3 个链接
        try {
          const fetched = await fetch(url, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "BrandIntelligenceOS/1.0" },
          });
          if (fetched.ok) {
            const html = await fetched.text();
            // 简单提取 title + body 文本（不依赖 cheerio）
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            const title = titleMatch?.[1]?.trim() ?? "";
            // 去掉 HTML 标签取纯文本
            const bodyText = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 3000); // 限制长度
            results.push(
              `### ${title || url}\nURL: ${url}\n\n${bodyText || "(无法提取正文内容)"}`
            );
          } else {
            results.push(`### ${url}\n(无法访问，HTTP ${fetched.status})`);
          }
        } catch {
          results.push(`### ${url}\n(抓取超时或网络错误)`);
        }
      }
      if (results.length > 0) {
        fetchedUrlContent = `## 用户提供的链接内容\n\n${results.join("\n\n---\n\n")}`;
      }
    } catch (e: any) {
      console.warn(`[message] URL 抓取失败: ${e.message}`);
    }
  }

  // ── Exit Condition Check ───────────────────────────
  // 构建包含当前用户消息的临时历史用于退出条件检查
  const historyForCheck: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history,
    { role: "user", content: message },
  ];

  let forceSummary = false;
  let missingInfo: string | undefined;

  // 仅对 active/draft/waiting_confirm 状态执行退出检查
  if (currentStatus === "active" || currentStatus === "draft") {
    try {
      const exitCheck = await checkExitConditions(stageNumber, historyForCheck);
      if (exitCheck.conditionsMet) {
        forceSummary = true;
        console.log(`[message] 退出条件满足 (核心 ${exitCheck.coreCompleted}/${exitCheck.coreTotal}，补充 ${exitCheck.suppCompleted}/${exitCheck.suppTotal})，注入 FORCE_SUMMARY 信号`);
        // 标记为 converging 状态
        try {
          await setStageStatus(projectId, stageNumber, "converging");
        } catch (e: any) {
          console.warn(`[message] converging 状态设置失败: ${e.message}`);
        }
      } else if (exitCheck.missingSummary) {
        missingInfo = exitCheck.missingSummary;
        console.log(`[message] 退出条件未满足: ${exitCheck.missingSummary}`);
      }
    } catch (e: any) {
      console.warn(`[message] Exit Condition Check 失败: ${e.message}`);
      // 降级：不注入信号，正常咨询
    }
  }

  // 注入轮次信号 + 系统指令
  let messageWithSignal = `> 当前为本阶段第 ${currentRound} 轮对话\n\n`;

  if (forceSummary) {
    messageWithSignal += `[系统指令] 本阶段退出条件已满足，请立即输出确认总结。\n\n`;
  } else if (missingInfo) {
    messageWithSignal += `[系统提示] 以下信息尚未充分收集：${missingInfo}\n\n`;
  }

  messageWithSignal += fetchedUrlContent
    ? fetchedUrlContent + "\n\n---\n\n用户消息：\n" + message
    : message;

  const messages = buildMessages(systemPrompt, history, messageWithSignal);

  // ── 诊断日志 ──────────────────────────────────────────
  const userMsg = messages[messages.length - 1];
  const isMultimodal = Array.isArray(userMsg?.content);
  console.log(`[message] VISION_ENABLED=${process.env.VISION_ENABLED} isMultimodal=${isMultimodal}`);
  if (isMultimodal) {
    const parts = userMsg.content as any[];
    const textParts = parts.filter((p: any) => p.type === "text");
    const imgParts = parts.filter((p: any) => p.type === "image_url");
    console.log(`[message] multimodal parts: text=${textParts.length} image=${imgParts.length}`);
    for (const img of imgParts) {
      const url = img.image_url?.url ?? "";
      console.log(`[message] image_url 长度=${url.length} 前缀=${url.slice(0, 60)}`);
    }
  } else {
    const text = typeof userMsg?.content === "string" ? userMsg.content : "";
    const hasImgMd = /!\[/.test(text);
    console.log(`[message] 纯文本模式 hasImageMarkdown=${hasImgMd} 长度=${text.length}`);
  }

  // 流式响应
  const provider = getLLMProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        // 先发送搜索结果事件（如有），前端据此渲染 SearchResult 卡片
        if (searchResultEvent) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ searchResult: searchResultEvent })}\n\n`
            )
          );
        }

        const aiStream = provider.chatStream(messages, {
          temperature: 0.7,
          maxTokens: 2048,
        });

        for await (const chunk of aiStream) {
          if (chunk.content) {
            fullResponse += chunk.content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
            );
          }
        }

        // ── Token 追踪 ──────────────────────────────
        if (provider.lastUsage) {
          const { systemChars, conversationChars } = estimateCharCount(messages);
          recordUsageFromProvider(provider, { projectId, stageNumber, callType: "consultation", systemPromptChars: systemChars, conversationChars }).catch(() => {});
        }

        // 处理空响应：AI 返回了 0 个 token
        if (!fullResponse || fullResponse.trim().length === 0) {
          fullResponse = "抱歉，AI 没有生成任何回复内容。这可能是因为：\n"
            + "1. 当前模型不支持所发送的内容格式（如图片、链接）\n"
            + "2. API 调用遇到了内部错误\n"
            + "3. 请求触发了内容安全策略\n\n"
            + "请尝试用文字描述你的需求，或检查服务端日志排查具体原因。";
          console.warn(`[message] AI 返回空内容，使用 fallback 消息`);
        }

        // 发送完成信号
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, fullResponse })}\n\n`
          )
        );

        // ── 确认总结检测 ──────────────────────────
        if (forceSummary) {
          const hasConfirmation = detectConfirmationSummary(fullResponse);
          if (hasConfirmation) {
            console.log(`[message] 检测到确认总结，状态切换为 awaiting_confirmation`);
            try {
              await setStageStatus(projectId, stageNumber, "waiting_confirm");
            } catch (e: any) {
              console.warn(`[message] awaiting_confirmation 状态设置失败: ${e.message}`);
            }
          } else {
            console.warn(`[message] 已发送 FORCE_SUMMARY 但 AI 未输出确认总结，保持 converging 状态`);
          }
        }

        // 保存对话历史
        const updatedHistory = [
          ...history,
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
        ];
        await saveConsultationMessages(projectId, stageNumber, updatedHistory as any);
      } catch (e: any) {
        // ── 错误处理：将错误信息保存为 AI 消息，而不是只显示闪一下就消失 ──
        const errorMsg = `抱歉，AI 调用遇到了问题：${e.message || "未知错误"}。请稍后重试或检查 API 配置。`;
        console.error(`[message] AI 调用失败，将错误保存为消息: ${e.message}`);

        // 以正常 content 事件发送（前端会累积到 fullResponse 并保存为消息）
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content: errorMsg })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, fullResponse: errorMsg })}\n\n`)
        );

        // 持久化错误消息
        try {
          const updatedHistory = [
            ...history,
            { role: "user", content: message, timestamp: new Date().toISOString() },
            { role: "assistant", content: errorMsg, timestamp: new Date().toISOString() },
          ];
          await saveConsultationMessages(projectId, stageNumber, updatedHistory as any);
        } catch (saveErr: any) {
          console.error(`[message] 保存错误消息失败: ${saveErr.message}`);
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
