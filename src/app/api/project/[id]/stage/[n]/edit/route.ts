/**
 * POST /api/project/[id]/stage/[n]/edit
 *
 * 报告编辑 API — 统一入口，委托给 recordFieldEdit()。
 *
 * Body: { fieldPath: string, newValue: any, previousValue?: any, clientVersion: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { recordFieldEdit } from "@/lib/audit/record-field-edit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    const { fieldPath, newValue, previousValue, clientVersion } = await req.json();

    if (!fieldPath || typeof fieldPath !== "string") {
      return NextResponse.json({ error: "fieldPath 不能为空" }, { status: 400 });
    }
    if (clientVersion == null || typeof clientVersion !== "number") {
      return NextResponse.json({ error: "clientVersion 不能为空" }, { status: 400 });
    }

    const result = await recordFieldEdit({
      projectId,
      stageNumber,
      fieldPath,
      previousValue: previousValue ?? null,
      newValue,
      modifiedBy: "user",
      clientVersion,
    });

    if (result.conflict) {
      return NextResponse.json(
        {
          error: "编辑冲突：数据已被其他操作修改，请刷新后重试",
          conflict: true,
          currentVersion: result.currentVersion,
        },
        { status: 409 }
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      stageNumber,
      fieldPath,
      newVersion: result.currentVersion,
      potentialImpact: result.potentialImpact,
    });
  } catch (e: any) {
    console.error("[stage-edit] 编辑失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
