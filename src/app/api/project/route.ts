import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/project-repo";

export async function POST(req: NextRequest) {
  try {
    const { name, category } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "品牌名称为必填" }, { status: 400 });
    }
    const project = await createProject(name.trim(), category?.trim());
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
