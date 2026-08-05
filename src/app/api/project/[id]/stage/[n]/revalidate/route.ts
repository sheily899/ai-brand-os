/**
 * POST /api/project/[id]/stage/[n]/revalidate
 *
 * 重新进入失效阶段——重置状态为 active，保留原有对话历史，
 * 注入更新后的 Decision Memory Context，重新执行 Consultation + Convergence。
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageStatus } from "@/lib/workflow/workflow";
import { reExecuteStage } from "@/lib/stage/stage-engine";
import { founderVisionSchema } from "@/lib/schemas/founder-vision";
import { businessContextSchema } from "@/lib/schemas/business-context";
import { marketInsightsSchema } from "@/lib/schemas/market-insights";
import { consumerInsightSchema } from "@/lib/schemas/consumer-insight";
import { competitiveInsightsSchema } from "@/lib/schemas/competitive";
import { brandStrategySchema } from "@/lib/schemas/brand-strategy";
import { visualStrategySchema } from "@/lib/schemas/visual-strategy";
import { contentStrategySchema } from "@/lib/schemas/content-strategy";

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

    const status = await getStageStatus(projectId, stageNumber);
    if (status !== "invalidated") {
      return NextResponse.json(
        { error: `Stage ${stageNumber} 当前状态为 ${status}，只有 invalidated 阶段可以重新进入` },
        { status: 400 }
      );
    }

    const schema = SCHEMAS[stageNumber];
    if (!schema) {
      return NextResponse.json({ error: `无效的阶段编号: ${stageNumber}` }, { status: 400 });
    }

    const result = await reExecuteStage(
      projectId,
      stageNumber,
      schema,
      project.name,
      project.category ?? ""
    );

    return NextResponse.json({
      success: result.success,
      output: result.output,
      errors: result.errors,
      retriesUsed: result.retriesUsed,
      needsHumanReview: result.needsHumanReview,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
