import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/project-repo";
import { initStageRecord, setStageStatus } from "@/lib/workflow/workflow";
import { sendMessage } from "@/lib/ai/consultation";
import { saveConsultationMessages } from "@/lib/db/stage-repo";

export async function POST(req: NextRequest) {
  try {
    const { name, category } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "品牌名称为必填" }, { status: 400 });
    }
    const project = await createProject(name.trim(), category?.trim());

    // 初始化 S1 阶段并生成 AI 开场消息
    try {
      await initStageRecord(project.id, 1);
      await setStageStatus(project.id, 1, "active");

      const openingMessage = await sendMessage(
        {
          stage: 1,
          history: [],
          variables: {
            品牌名: project.name,
            品类: project.category ? `的 ${project.category}` : "",
          },
        },
        "（系统自动触发）用户刚创建了品牌项目。请按照 Opening Message 格式，向用户做简短开场，然后提出第一个咨询问题。"
      );

      if (openingMessage) {
        await saveConsultationMessages(project.id, 1, [
          { role: "assistant", content: openingMessage, timestamp: new Date().toISOString() },
        ]);
      }
    } catch (e: any) {
      console.error(`[createProject] S1 初始化失败: ${e.message}`);
      // 非致命：项目已创建，用户可手动开始咨询
    }

    return NextResponse.json(project, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
