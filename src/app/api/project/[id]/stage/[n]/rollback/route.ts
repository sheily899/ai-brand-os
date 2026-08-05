/**
 * POST /api/project/[id]/stage/[n]/rollback
 *
 * 撤销字段编辑——基于版本链回退到上一版本。
 * Body: { fieldPath: string, clientVersion: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { rollbackEdit } from "@/lib/audit/record-field-edit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; n: string } }
) {
  const projectId = params.id;
  const stageNumber = parseInt(params.n, 10);

  try {
    const { fieldPath, clientVersion } = await req.json();

    if (!fieldPath || typeof fieldPath !== "string") {
      return NextResponse.json({ error: "fieldPath 不能为空" }, { status: 400 });
    }
    if (clientVersion == null || typeof clientVersion !== "number") {
      return NextResponse.json({ error: "clientVersion 不能为空" }, { status: 400 });
    }

    const result = await rollbackEdit({
      projectId,
      stageNumber,
      fieldPath,
      modifiedBy: "user",
      clientVersion,
    });

    if (result.conflict) {
      return NextResponse.json(
        { error: "编辑冲突", conflict: true, currentVersion: result.currentVersion },
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
    console.error("[stage-rollback] 撤销失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
