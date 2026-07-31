/**
 * GET /api/project/[id]/stage/[n]
 * 获取阶段记录（对话历史 + 结构化输出）
 */
import { NextRequest, NextResponse } from "next/server";
import { getStageRecord } from "@/lib/db/stage-repo";
import { getStageStatus } from "@/lib/workflow/workflow";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    const record = await getStageRecord(projectId, stageNumber);
    const status = await getStageStatus(projectId, stageNumber);

    return NextResponse.json({
      status,
      messages: record?.consultationMessages ?? [],
      output: record?.structuredOutput ?? null,
      createdAt: record?.createdAt ?? null,
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
