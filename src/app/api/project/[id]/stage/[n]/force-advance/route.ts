/**
 * POST /api/project/[id]/stage/[n]/force-advance
 *
 * 跳过审计建议，强制推进到下一阶段。
 * 对应审计卡片上的"保持当前决策"按钮。
 */
import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord, saveAuditResult, saveConsultationMessages } from "@/lib/db/stage-repo";
import { handleGateDecision, initStageRecord, setStageStatus, canEnterStage } from "@/lib/workflow/workflow";
import { isSearchStage } from "@/lib/ai/loader";
import { buildMemoryContext } from "@/lib/memory/decision-memory";
import { getStageStatus } from "@/lib/workflow/workflow";

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
    if (status !== "waiting_confirm" && status !== "completed" && status !== "active") {
      return NextResponse.json(
        { error: `阶段 ${stageNumber} 状态为 ${status}，无法强制推进` },
        { status: 400 }
      );
    }

    // 先推进当前阶段状态（force-advance 的语义是"无论如何都要推进"），
    // 再验证下一阶段依赖。否则 canEnterStage 检查下一阶段时，
    // 当前阶段尚未标记为 completed，依赖检查会失败。
    const nextStage = stageNumber + 1;

    if (nextStage > 8) {
      await handleGateDecision(projectId, stageNumber, "advance");
      return NextResponse.json({
        advanced: true,
        nextStage: null,
        message: "全部八个阶段已完成",
      });
    }

    // 先标记当前阶段完成
    await handleGateDecision(projectId, stageNumber, "advance");

    // 再验证下一阶段依赖（此时当前阶段已在 completed 列表中）
    const canEnter = await canEnterStage(projectId, nextStage);
    if (!canEnter.allowed) {
      // 回滚：将当前阶段恢复为原状态
      await setStageStatus(projectId, stageNumber, status);
      return NextResponse.json(
        { error: canEnter.reason ?? "无法进入下一阶段" },
        { status: 400 }
      );
    }

    // 初始化下一阶段
    await initStageRecord(projectId, nextStage);
    await setStageStatus(projectId, nextStage, "active");

    // 自动搜索（如需要）
    let searchContext: string | undefined;
    let searchExecuted = false;

    if (isSearchStage(nextStage)) {
      try {
        const { runSearch } = await import("@/lib/ai/search");
        const memoryCtx = await buildMemoryContext(projectId, nextStage);
        const searchOutput = await runSearch({
          stage: nextStage,
          brandName: project.name,
          category: project.category ?? "",
          decisionMemoryContext: memoryCtx || undefined,
        });
        searchContext = searchOutput.formatted.contextText;
        searchExecuted = searchOutput.retrieved.length > 0;
      } catch (e: any) {
        console.error(`[force-advance] 搜索失败: ${e.message}`);
      }
    }

    if (searchContext) {
      try {
        const { saveSearchContext } = await import("@/lib/db/stage-repo");
        await saveSearchContext(projectId, nextStage, searchContext);
      } catch (e: any) {
        console.error(`[force-advance] 搜索上下文保存失败: ${e.message}`);
      }
    }

    // 第一条开场消息
    let openingMessage: string | undefined;
    try {
      const { sendMessage } = await import("@/lib/ai/consultation");
      const memoryCtx = await buildMemoryContext(projectId, nextStage);
      const triggerMessage = searchExecuted
        ? "（系统自动触发）请基于以上搜索发现，先向用户展示搜索成果覆盖情况，然后提出本阶段的第一个咨询问题。"
        : "（系统自动触发）请基于前序阶段的战略资产，向用户总结当前阶段的目标和已知信息，然后提出本阶段的第一个咨询问题。";

      openingMessage = await sendMessage(
        {
          stage: nextStage,
          history: [],
          variables: { 品牌名: project.name, 品类: project.category ?? "" },
          decisionMemoryContext: memoryCtx || undefined,
          searchContext,
          includeSearchProtocol: isSearchStage(nextStage),
        },
        triggerMessage
      );
    } catch (e: any) {
      console.error(`[force-advance] 开场消息生成失败: ${e.message}`);
      openingMessage = `欢迎进入 Stage ${nextStage}。请描述您对本阶段的理解和需求。`;
    }

    // 持久化开场消息
    if (openingMessage) {
      try {
        await saveConsultationMessages(projectId, nextStage, [
          { role: "assistant", content: openingMessage, timestamp: new Date().toISOString() },
        ]);
      } catch (e: any) {
        console.error(`[force-advance] 开场消息保存失败: ${e.message}`);
      }
    }

    return NextResponse.json({
      advanced: true,
      nextStage,
      openingMessage,
      searchExecuted,
      searchContext,
    });
  } catch (e: any) {
    console.error("[force-advance] 失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
