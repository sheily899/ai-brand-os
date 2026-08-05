/**
 * PUT /api/project/[id]/report/chapter/[n]
 * 编辑单个报告章节内容——保存用户修改，不覆盖 AI 原始版本
 *
 * MVP 策略：将编辑存储在 stageRecord 的 structuredOutput 中
 * （新增 _userEdits 字段），组装报告时优先使用用户编辑版本。
 */
import { NextRequest, NextResponse } from "next/server";
import { getStageRecord } from "@/lib/db/stage-repo";
import { db } from "@/lib/db";
import { stageRecord } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const chapterNumber = parseInt(params.n, 10);

  try {
    const { sectionHeading, content } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    // 找到对应章节的阶段
    const CHAPTER_STAGE_MAP: Record<number, number> = {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 8,
    };
    const sourceStage = CHAPTER_STAGE_MAP[chapterNumber];
    if (!sourceStage) {
      return NextResponse.json({ error: "无效的章节编号" }, { status: 400 });
    }

    const record = await getStageRecord(projectId, sourceStage);
    if (!record?.structuredOutput) {
      return NextResponse.json(
        { error: `Stage ${sourceStage} 尚未完成，无法编辑对应章节` },
        { status: 400 }
      );
    }

    // 保存用户编辑（存储在 structuredOutput._userEdits 中）
    const output = record.structuredOutput as Record<string, any>;
    const userEdits = (output._userEdits ?? {}) as Record<string, string>;
    userEdits[sectionHeading] = content;

    await db
      .update(stageRecord)
      .set({
        structuredOutput: { ...output, _userEdits: userEdits } as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stageRecord.projectId, projectId),
          eq(stageRecord.stageNumber, sourceStage)
        )
      );

    return NextResponse.json({
      success: true,
      chapter: chapterNumber,
      sectionHeading,
    });
  } catch (e: any) {
    console.error("[report-chapter] 编辑失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
