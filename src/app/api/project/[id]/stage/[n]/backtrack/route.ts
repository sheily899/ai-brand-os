/**
 * POST /api/project/[id]/stage/[n]/backtrack
 *
 * 回溯到已完成/等待确认的阶段，重新打开编辑权限。
 *
 * 与 /revalidate 的区别：
 *   - /revalidate：状态必须是 invalidated，触发完整重执行（reExecuteStage）
 *   - /backtrack：状态为 completed/waiting_confirm/active，仅重置 + 级联失效
 *
 * 流程：
 *   1. 验证阶段可回溯
 *   2. 重置目标阶段为 active（保留现有对话 + 输出作为参考）
 *   3. 递归计算所有下游受影响阶段
 *   4. 将有数据的下游阶段标记为 invalidated
 *   5. 返回受影响阶段列表
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageStatus, setStageStatus } from "@/lib/workflow/workflow";
import { getAllDownstream } from "@/lib/memory/dependency-graph";
import { getStageRecord } from "@/lib/db/stage-repo";
import { STAGE_META } from "@/lib/stage-config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    // 1. 验证项目存在
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if (stageNumber < 1 || stageNumber > 8) {
      return NextResponse.json({ error: "无效的阶段编号" }, { status: 400 });
    }

    // 2. 获取当前阶段状态
    const status = await getStageStatus(projectId, stageNumber);

    // 可回溯的状态：completed / waiting_confirm / active (有输出时)
    const backtrackable: string[] = ["completed", "waiting_confirm", "active"];
    if (!backtrackable.includes(status)) {
      return NextResponse.json(
        {
          error: `Stage ${stageNumber} 当前状态为 ${status}，无法回溯。只有已完成、等待确认或进行中的阶段可以回溯。`,
        },
        { status: 400 }
      );
    }

    // active 状态需要确认有输出才允许回溯（draft 的 active 无意义回溯）
    if (status === "active") {
      const record = await getStageRecord(projectId, stageNumber);
      const hasOutput = record?.structuredOutput && Object.keys(record.structuredOutput).length > 0;
      if (!hasOutput) {
        return NextResponse.json(
          { error: `Stage ${stageNumber} 尚未产生输出，无需回溯` },
          { status: 400 }
        );
      }
    }

    // 3. 计算所有下游受影响阶段
    const allDownstream = getAllDownstream(stageNumber);

    // 筛选出实际存在数据、需要失效化的下游阶段
    const invalidatedStages: { number: number; name: string }[] = [];
    for (const ds of allDownstream) {
      const dsStatus = await getStageStatus(projectId, ds);
      // 只失效化有实际产出的阶段（completed / waiting_confirm / invalidated）
      if (dsStatus === "completed" || dsStatus === "waiting_confirm") {
        await setStageStatus(projectId, ds, "invalidated");
        invalidatedStages.push({
          number: ds,
          name: STAGE_META[ds]?.name ?? `阶段 ${ds}`,
        });
      } else if (dsStatus === "active") {
        // 进行中的阶段也失效（其上游变了）
        const dsRecord = await getStageRecord(projectId, ds);
        const msgs = dsRecord?.consultationMessages as any[] | undefined;
        if (dsRecord?.structuredOutput || (msgs && msgs.length > 0)) {
          await setStageStatus(projectId, ds, "invalidated");
          invalidatedStages.push({
            number: ds,
            name: STAGE_META[ds]?.name ?? `阶段 ${ds}`,
          });
        }
      }
    }

    // 4. 重置目标阶段为 active
    await setStageStatus(projectId, stageNumber, "active");

    // 5. 返回结果
    const stageName = STAGE_META[stageNumber]?.name ?? `阶段 ${stageNumber}`;

    return NextResponse.json({
      success: true,
      stage: stageNumber,
      stageName,
      invalidatedStages,
      affectedCount: invalidatedStages.length,
    });
  } catch (e: any) {
    console.error(`[backtrack] 回溯失败:`, e);
    return NextResponse.json(
      { error: e.message || "回溯失败" },
      { status: 500 }
    );
  }
}
