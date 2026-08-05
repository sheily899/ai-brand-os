/**
 * GET /api/project/[id]/report
 * 获取品牌战略报告——从八阶段输出组装
 */
import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord } from "@/lib/db/stage-repo";
import { assembleWithAudit, auditReport } from "@/lib/report/assemble";
import { getCompletedStages, getWorkflowState } from "@/lib/workflow/workflow";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 读取全部 8 个阶段的 structuredOutput + version
    const stageOutputs: Record<number, Record<string, any>> = {};
    const stageVersions: Record<number, number> = {};
    for (let s = 1; s <= 8; s++) {
      const record = await getStageRecord(projectId, s);
      if (record?.structuredOutput) {
        stageOutputs[s] = record.structuredOutput as Record<string, any>;
        stageVersions[s] = (record as any).version ?? 1;
      }
    }

    // 获取工作流状态（用于工具栏进度点）
    const completedStages = await getCompletedStages(projectId);
    const wfState = await getWorkflowState(projectId);

    if (Object.keys(stageOutputs).length === 0) {
      return NextResponse.json({
        report: null,
        message: "尚未有完成的阶段，无法生成报告",
        stagesReady: 0,
        brandName: project.name,
        category: project.category,
        completedStages,
        activeStage: wfState.currentStage,
      });
    }

    // 读取用户自定义（block 排序、列排序、展示层覆盖）
    const customization =
      (project.context as any)?.reportCustomization ?? undefined;
    const reportOverrides =
      (project.context as any)?.reportOverrides ?? undefined;

    // 组装报告（含 Final Audit + Quality Check）
    const result = await assembleWithAudit(
      projectId,
      stageOutputs,
      project.name,
      project.category ?? undefined,
      undefined,
      customization,
      reportOverrides
    );

    // 报告级质量审核
    let reportAudit = null;
    if (result.report) {
      reportAudit = auditReport(result.report, stageOutputs);
    }

    return NextResponse.json({
      report: result.report,
      audit: result.audit,
      quality: result.quality,
      reportAudit,
      suspended: result.suspended,
      suspendReason: result.suspendReason,
      stagesReady: Object.keys(stageOutputs).length,
      brandName: project.name,
      category: project.category,
      completedStages,
      activeStage: wfState.currentStage,
      customization: (project.context as any)?.reportCustomization ?? null,
      reportOverrides: (project.context as any)?.reportOverrides ?? null,
      stageVersions,
    });
  } catch (e: any) {
    console.error("[report] 获取报告失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
