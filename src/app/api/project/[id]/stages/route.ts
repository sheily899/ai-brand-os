/**
 * GET /api/project/[id]/stages
 * 获取项目全部 8 个阶段的状态摘要（供工作台侧边栏/Tab 渲染）
 */
import { NextRequest, NextResponse } from "next/server";
import { db, stageRecord } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getStageName } from "@/lib/stage-config";
import type { AuditReport } from "@/lib/audit/audit-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    // 一次 DB 查询获取全部 8 个阶段的状态 + 审计结果
    const rows = await db
      .select({
        stageNumber: stageRecord.stageNumber,
        status: stageRecord.status,
        auditResult: stageRecord.auditResult,
      })
      .from(stageRecord)
      .where(eq(stageRecord.projectId, projectId));

    // 构建 status + auditResult map
    const statusMap = new Map<string, string>();
    const gateDecisionMap = new Map<number, string>();
    for (let i = 1; i <= 8; i++) {
      statusMap.set(String(i), "draft");
    }
    for (const row of rows) {
      if (row.stageNumber) {
        statusMap.set(String(row.stageNumber), row.status ?? "draft");
        // 提取审计中的 gateDecision（用于区分"自然通过"vs"强制推进"）
        if (row.status === "completed" && row.auditResult) {
          const audit = row.auditResult as AuditReport;
          if (audit.gateDecision) {
            gateDecisionMap.set(row.stageNumber, audit.gateDecision);
          }
        }
      }
    }

    const stages = Array.from({ length: 8 }, (_, i) => {
      const stageNumber = i + 1;
      return {
        number: stageNumber,
        name: getStageName(stageNumber),
        status: statusMap.get(String(stageNumber)) ?? "draft",
        finalGateDecision: gateDecisionMap.get(stageNumber) ?? null,
      };
    });

    const allComplete = stages.every((s) => s.status === "completed");
    const activeStage = stages.find(
      (s) => s.status !== "completed"
    )?.number ?? 1;

    return NextResponse.json(
      { stages, activeStage, allComplete }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
