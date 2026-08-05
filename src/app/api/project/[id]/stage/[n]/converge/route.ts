/**
 * POST /api/project/[id]/stage/[n]/converge
 * 触发阶段收束 — 执行完整 Pipeline
 */
import { NextRequest, NextResponse } from "next/server";
import { runStage } from "@/lib/stage/stage-engine";
import { founderVisionSchema } from "@/lib/schemas/founder-vision";
import { businessContextSchema } from "@/lib/schemas/business-context";
import { marketInsightsSchema } from "@/lib/schemas/market-insights";
import { consumerInsightSchema } from "@/lib/schemas/consumer-insight";
import { competitiveInsightsSchema } from "@/lib/schemas/competitive";
import { brandStrategySchema } from "@/lib/schemas/brand-strategy";
import { visualStrategySchema } from "@/lib/schemas/visual-strategy";
import { contentStrategySchema } from "@/lib/schemas/content-strategy";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord } from "@/lib/db/stage-repo";
import { getStageStatus } from "@/lib/workflow/workflow";

// 阶段 Schema 映射表（S1-S8 完整）
const SCHEMAS: Record<number, any> = {
  1: founderVisionSchema,
  2: businessContextSchema,
  3: marketInsightsSchema,
  4: consumerInsightSchema,
  5: competitiveInsightsSchema,
  6: brandStrategySchema,
  7: visualStrategySchema,
  8: contentStrategySchema,
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const schema = SCHEMAS[stageNumber];
    if (!schema) {
      return NextResponse.json(
        { error: `Stage ${stageNumber} Schema 尚未实现` },
        { status: 501 }
      );
    }

    // 读取对话历史
    const record = await getStageRecord(projectId, stageNumber);
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      (record?.consultationMessages as any[])?.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })) ?? [];

    if (history.length === 0) {
      return NextResponse.json(
        { error: "没有对话记录，无法执行收束" },
        { status: 400 }
      );
    }

    // ── 前置检查：确认总结是否存在 ──────────────────
    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");
    const hasConfirmationSummary =
      lastAssistantMsg &&
      /确认|复述|理解得对|理解得对吗|如果以上内容准确|如果哪里理解得不对|如果理解有偏差/.test(
        lastAssistantMsg.content
      ) &&
      lastAssistantMsg.content.length > 150;

    if (!hasConfirmationSummary) {
      return NextResponse.json(
        {
          error:
            "阶段尚未完成确认总结，无法执行收束。请继续对话，当退出条件满足时 AI 会自动输出确认总结。你也可以在对话中发送「总结一下」来主动触发。",
          code: "NO_CONFIRMATION_SUMMARY",
        },
        { status: 409 }
      );
    }

    // 运行 Stage Pipeline
    const result = await runStage(
      {
        projectId,
        stage: stageNumber,
        history,
        variables: { 品牌名: project.name, 品类: project.category || "" },
      },
      schema
    );

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
