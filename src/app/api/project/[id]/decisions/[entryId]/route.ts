/**
 * PUT /api/project/[id]/decisions/[entryId]
 *
 * 修改一条 Decision Memory 条目。
 * 统一入口——所有修改决策的路径（决策编辑、话题回溯等）最终调用此端点。
 *
 * 流程：
 * 1. 创建新版本（保留旧版本历史）
 * 2. 触发 impact-analyzer
 * 3. 标记受影响的下游阶段为 invalidated
 * 4. 返回 ImpactReport
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { updateEntry } from "@/lib/memory/decision-version";
import { analyzeImpact } from "@/lib/audit/impact-analyzer";
import { invalidateDownstream, getStageStatus } from "@/lib/workflow/workflow";
import { getFieldSourceStage } from "@/lib/memory/dependency-graph";

export async function PUT(
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

    const { content, modifiedBy = "user" } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content 是必填字段" }, { status: 400 });
    }

    // 1. 更新条目（创建新版本）
    const updateResult = await updateEntry({ entryId, newContent: content, modifiedBy });

    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error }, { status: 400 });
    }

    // 2. 触发影响分析
    const fieldPath = updateResult.fieldPath ?? "";
    const sourceStage = updateResult.stageSource ??
      getFieldSourceStage(fieldPath) ?? 0;

    const impactReport = await analyzeImpact(
      projectId,
      fieldPath,
      updateResult.previousValue ?? "",
      content,
      sourceStage
    );

    // 3. 将 invalidated + needs_review 阶段标记为失效
    const stagesToInvalidate = impactReport.downstreamImpacts
      .filter((i) => i.level === "invalidated" || i.level === "needs_review")
      .map((i) => i.stage);

    if (stagesToInvalidate.length > 0) {
      await invalidateDownstream(projectId, stagesToInvalidate);
    }

    return NextResponse.json({
      success: true,
      newEntryId: updateResult.newEntryId,
      previousValue: updateResult.previousValue,
      impactReport,
      invalidatedStages: stagesToInvalidate,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
