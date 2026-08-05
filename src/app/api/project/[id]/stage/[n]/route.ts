/**
 * GET /api/project/[id]/stage/[n]
 * 获取阶段记录（对话历史 + 结构化输出 + goal + progress）
 */
import { NextRequest, NextResponse } from "next/server";
import { getStageRecord } from "@/lib/db/stage-repo";
import type { StageStatus } from "@/lib/workflow/workflow";
import { getStageGoal, getStageName } from "@/lib/stage-config";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    const record = await getStageRecord(projectId, stageNumber);
    // getStageRecord 已包含 status 字段，无需额外查询
    const status = (record?.status as StageStatus) ?? "draft";

    // 计算阶段级 progress
    const messages: Array<{ role: string; content: string; timestamp?: string }> =
      (record?.consultationMessages as any[]) ?? [];
    const userMessages = messages.filter((m) => m.role === "user");
    const roundCount = userMessages.length;
    const hasStructuredOutput = record?.structuredOutput != null;
    const hasAuditResult = record?.auditResult != null;

    return NextResponse.json({
      status,
      stageNumber,
      stageName: getStageName(stageNumber),
      goal: getStageGoal(stageNumber),
      messages,
      output: record?.structuredOutput ?? null,
      auditResult: record?.auditResult ?? null,
      searchContext: record?.searchContext ?? null,
      progress: {
        roundCount,
        hasOutput: hasStructuredOutput,
        hasAudit: hasAuditResult,
        isComplete: status === "completed",
      },
      createdAt: record?.createdAt ?? null,
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
