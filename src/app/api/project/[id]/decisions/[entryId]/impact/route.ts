/**
 * POST /api/project/[id]/decisions/[entryId]/impact
 *
 * 影响预评估——在用户确认修改前，预览会影响哪些下游阶段。
 * 不执行实际修改，仅返回 previewImpact() 结果。
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { previewImpact } from "@/lib/audit/impact-analyzer";
import { getFieldSourceStage } from "@/lib/memory/dependency-graph";
import { db, decisionMemoryEntry } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const projectId = params.id;
  const entryId = params.entryId;

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 读取被修改条目的 fieldPath 和 stageSource
    const rows = await db
      .select()
      .from(decisionMemoryEntry)
      .where(eq(decisionMemoryEntry.id, entryId))
      .limit(1);

    const entry = rows[0];
    if (!entry) {
      return NextResponse.json({ error: "决策条目不存在" }, { status: 404 });
    }

    const fieldPath = entry.fieldPath ?? "";
    const sourceStage = entry.stageSource ??
      getFieldSourceStage(fieldPath) ?? 0;

    const { affectedStages, allDownstream } = previewImpact(fieldPath, sourceStage);

    return NextResponse.json({
      entryId,
      fieldPath,
      sourceStage,
      affectedStages,
      unaffectedStages: allDownstream.filter((s) => !affectedStages.includes(s)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
