/**
 * POST /api/project/[id]/stage/[n]/optimize
 *
 * 智能优化 — 根据审计反馈自动优化阶段输出：
 *   1. 读取当前 structuredOutput + auditResult
 *   2. 构建优化 Prompt（注入审计问题、评分、改进建议）
 *   3. LLM 生成优化版本 → Schema 校验 → 保存
 *   4. 重新运行 Audit Engine
 *   5. 返回新输出 + 新审计结果
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getStageRecord, saveConsultationMessages } from "@/lib/db/stage-repo";
import { reOptimizeStage } from "@/lib/stage/stage-engine";
import { setStageStatus } from "@/lib/workflow/workflow";
import { founderVisionSchema } from "@/lib/schemas/founder-vision";
import { businessContextSchema } from "@/lib/schemas/business-context";
import { marketInsightsSchema } from "@/lib/schemas/market-insights";
import { consumerInsightSchema } from "@/lib/schemas/consumer-insight";
import { competitiveInsightsSchema } from "@/lib/schemas/competitive";
import { brandStrategySchema } from "@/lib/schemas/brand-strategy";
import { visualStrategySchema } from "@/lib/schemas/visual-strategy";
import { contentStrategySchema } from "@/lib/schemas/content-strategy";
import type { AuditReport } from "@/lib/audit/audit-engine";

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
    // 1. 验证项目存在
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 2. 读取当前阶段记录
    const record = await getStageRecord(projectId, stageNumber);
    if (!record?.structuredOutput) {
      return NextResponse.json(
        { error: `Stage ${stageNumber} 尚未完成收敛，无法优化` },
        { status: 400 }
      );
    }

    const auditReport = record.auditResult as AuditReport | null;
    if (!auditReport) {
      return NextResponse.json(
        { error: `Stage ${stageNumber} 没有审计结果，无法优化` },
        { status: 400 }
      );
    }

    // 2.5 接受现状继续推进（熔断后的操作入口之一）
    const url = new URL(req.url);
    if (url.searchParams.get("acceptAsIs") === "true") {
      try {
        const { handleGateDecision } = await import("@/lib/workflow/workflow");
        await handleGateDecision(projectId, stageNumber, "advance");
        return NextResponse.json({
          success: true,
          acceptedAsIs: true,
          message: "已接受当前内容并推进到下一阶段。数据缺口已在报告中标注为待验证状态。",
        });
      } catch (e: any) {
        return NextResponse.json(
          { error: `强制推进失败: ${e.message}` },
          { status: 500 }
        );
      }
    }

    // 3. 获取 Schema
    const schema = SCHEMAS[stageNumber];
    if (!schema) {
      return NextResponse.json(
        { error: `无效的阶段编号: ${stageNumber}` },
        { status: 400 }
      );
    }

    // 4. 执行智能优化（传入品牌名/品类用于 data_gap 补充搜索）
    const result = await reOptimizeStage(
      projectId,
      stageNumber,
      schema,
      auditReport,
      project.name,
      project.category ?? undefined
    );

    if (!result.success) {
      // 熔断响应 — 返回差异化的错误信息供前端展示操作入口
      if (result.circuitBreakerTriggered) {
        return NextResponse.json({
          success: false,
          circuitBreaker: true,
          reason: result.circuitBreakerReason,
          details: result.errors,
          // 两个操作选项供前端渲染按钮
          actions: [
            {
              id: "manual_supplement",
              label: "手动补充信息",
              description: "在对话中提供行业报告、用户数据或竞品信息",
            },
            {
              id: "accept_as_is",
              label: "接受现状继续推进",
              description: "保留当前内容中的待验证标注，进入下一阶段",
            },
          ],
        });
      }

      return NextResponse.json({
        success: false,
        error: "优化失败",
        details: result.errors,
      });
    }

    // 4.5 将自然语言确认内容追加到 consultationMessages
    let summaryMessage = result.naturalLanguage ?? "";
    if (summaryMessage) {
      try {
        // 读取现有消息（确保 timestamp 必填以满足 saveConsultationMessages 签名）
        const rawMessages =
          (record.consultationMessages as Array<{
            role: string;
            content: string;
            timestamp?: string;
          }>) ?? [];
        const existingMessages = rawMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ?? new Date().toISOString(),
        }));
        // 追加新的 assistant 消息
        const updatedMessages = [
          ...existingMessages,
          {
            role: "assistant" as const,
            content: summaryMessage,
            timestamp: new Date().toISOString(),
          },
        ];
        await saveConsultationMessages(projectId, stageNumber, updatedMessages);
      } catch (e: any) {
        console.error(`[optimize] 优化对话消息保存失败: ${e.message}`);
        // 非致命：即使消息保存失败，结构化输出仍然已更新
      }
    }

    // 5. 重置为 waiting_confirm，让用户审核优化结果
    //    Audit 不在此时运行——等用户确认后，由 confirmAndCompleteStage() 统一执行
    await setStageStatus(projectId, stageNumber, "waiting_confirm");

    return NextResponse.json({
      success: true,
      output: result.output,
      summaryMessage,
    });
  } catch (e: any) {
    console.error(`[optimize] 优化失败:`, e);
    return NextResponse.json(
      { error: e.message || "智能优化失败" },
      { status: 500 }
    );
  }
}
