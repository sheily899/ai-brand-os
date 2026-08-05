/**
 * POST /api/project/[id]/stage/[n]/confirm
 *
 * 用户确认阶段总结后的完整闭环：
 * Converge → Save Output → Decision Memory → Audit → Gate Decision → Advance
 *
 * 与 converge + advance 分步调用的区别：
 * - 单一 API 调用完成全流程，避免状态不同步
 * - 确保 StageOutput / Decision Memory / Audit / Workflow 状态一致
 */
import { NextRequest, NextResponse } from "next/server";
import { confirmAndCompleteStage } from "@/lib/stage/stage-engine";
import { founderVisionSchema } from "@/lib/schemas/founder-vision";
import { businessContextSchema } from "@/lib/schemas/business-context";
import { marketInsightsSchema } from "@/lib/schemas/market-insights";
import { consumerInsightSchema } from "@/lib/schemas/consumer-insight";
import { competitiveInsightsSchema } from "@/lib/schemas/competitive";
import { brandStrategySchema } from "@/lib/schemas/brand-strategy";
import { visualStrategySchema } from "@/lib/schemas/visual-strategy";
import { contentStrategySchema } from "@/lib/schemas/content-strategy";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageStatus } from "@/lib/workflow/workflow";

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
    // 验证项目存在
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 验证 Schema 存在
    const schema = SCHEMAS[stageNumber];
    if (!schema) {
      return NextResponse.json(
        { error: `Stage ${stageNumber} Schema 尚未实现` },
        { status: 501 }
      );
    }

    // 验证处于可确认的状态
    const currentStatus = await getStageStatus(projectId, stageNumber);
    if (currentStatus !== "waiting_confirm" && currentStatus !== "converging") {
      return NextResponse.json(
        {
          error: `当前阶段状态为 ${currentStatus}，无法确认。请先完成咨询并生成确认总结。`,
          code: "NOT_AWAITING_CONFIRMATION",
        },
        { status: 409 }
      );
    }

    // 运行完整确认管道
    const result = await confirmAndCompleteStage({
      projectId,
      stageNumber,
      brandName: project.name,
      category: project.category ?? "",
      schema,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`[confirm] Pipeline 失败: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
