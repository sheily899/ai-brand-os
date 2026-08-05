import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProjectContext } from "@/lib/db/project-repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await getProjectById(params.id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    return NextResponse.json(project, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const body = await req.json();
    const { action } = body;

    // ── save-customization：持久化报告自定义（block 排序、列排序） ──
    if (action === "save-customization") {
      const { customization } = body;
      if (!customization || typeof customization !== "object") {
        return NextResponse.json({ error: "customization 不能为空" }, { status: 400 });
      }

      await updateProjectContext(projectId, { reportCustomization: customization });

      return NextResponse.json({ success: true });
    }

    // ── save-report-override：持久化单条文本覆盖 ──
    if (action === "save-report-override") {
      const { path, text } = body;
      if (!path || typeof path !== "string") {
        return NextResponse.json({ error: "path 不能为空" }, { status: 400 });
      }

      const p = await getProjectById(projectId);
      if (!p) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

      const existing = (p.context as Record<string, any>) ?? {};
      const overrides = { ...(existing.reportOverrides ?? {}) };

      if (text) {
        overrides[path] = text;
      } else {
        delete overrides[path];
      }

      await updateProjectContext(projectId, { reportOverrides: overrides });

      return NextResponse.json({ success: true, path });
    }

    return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
  } catch (e: any) {
    console.error("[project] POST 失败:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
