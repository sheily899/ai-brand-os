/**
 * POST /api/upload
 * 上传图片文件——MVP 存储到本地 public/uploads/
 *
 * Body: FormData { file: File, projectId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage/upload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "缺少项目 ID" }, { status: 400 });
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadFile(
      buffer,
      file.name,
      file.type,
      projectId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      textContent: result.textContent ?? null,
    });
  } catch (e: any) {
    console.error("[upload] 上传失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
