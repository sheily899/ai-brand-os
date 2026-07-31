/**
 * POST /api/project/[id]/stage/[n]/advance
 *
 * Stage Orchestrator 入口 — 触发阶段确认后的自动编排：
 *   Convergence → Rule Check → Gate Decision → Advance → Search → Opening Message
 *
 * 这是 Phase 2 的核心编排端点。
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord } from "@/lib/db/stage-repo";
import { advanceToNextStage } from "@/lib/stage/stage-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const currentStage = parseInt(params.n, 10);

  try {
    // 1. 验证项目存在
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 2. 读取当前阶段的 structuredOutput（必须先 converge）
    const record = await getStageRecord(projectId, currentStage);
    if (!record?.structuredOutput) {
      return NextResponse.json(
        { error: `Stage ${currentStage} 尚未完成收敛，请先触发 converge` },
        { status: 400 }
      );
    }

    // 3. 执行 Orchestrator
    const result = await advanceToNextStage({
      projectId,
      currentStage,
      stageOutput: record.structuredOutput as Record<string, any>,
      brandName: project.name,
      category: project.category ?? "",
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`[advance] 编排失败:`, e);
    return NextResponse.json(
      { error: e.message || "阶段推进失败" },
      { status: 500 }
    );
  }
}
