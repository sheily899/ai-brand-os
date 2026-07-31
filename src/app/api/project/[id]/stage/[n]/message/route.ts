/**
 * POST /api/project/[id]/stage/[n]/message
 * Consultation 消息 — SSE 流式响应
 */
import { NextRequest } from "next/server";
import { loadPrompt, buildMessages, isSearchStage } from "@/lib/ai/loader";
import { getLLMProvider } from "@/lib/ai/provider";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord, saveConsultationMessages } from "@/lib/db/stage-repo";
import { initStageRecord } from "@/lib/workflow/workflow";
import { buildMemoryContext } from "@/lib/memory/decision-memory";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  const { message } = await req.json();
  if (!message) {
    return Response.json({ error: "消息不能为空" }, { status: 400 });
  }

  // 获取项目信息
  const project = await getProjectById(projectId);
  if (!project) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  // 确保阶段记录存在
  await initStageRecord(projectId, stageNumber);

  // 读取已有对话历史
  const record = await getStageRecord(projectId, stageNumber);
  const history: Array<{ role: "user" | "assistant"; content: string }> =
    (record?.consultationMessages as any[])?.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? [];

  // 加载 Decision Memory Context（前序阶段已确认的战略资产）
  const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);

  // 加载 Prompt（注入 Decision Memory Context + 搜索协议）
  const systemPrompt = loadPrompt({
    stage: stageNumber,
    mode: "consultation",
    variables: { 品牌名: project.name, 品类: project.category || "" },
    decisionMemoryContext: decisionMemoryContext || undefined,
    includeSearchProtocol: isSearchStage(stageNumber),
  });

  const messages = buildMessages(systemPrompt, history, message);

  // 流式响应
  const provider = getLLMProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
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

        // 发送完成信号
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, fullResponse })}\n\n`
          )
        );

        // 保存对话历史
        const updatedHistory = [
          ...history,
          { role: "user", content: message, timestamp: new Date().toISOString() },
          { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
        ];
        await saveConsultationMessages(projectId, stageNumber, updatedHistory as any);
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: e.message })}\n\n`
          )
        );
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
