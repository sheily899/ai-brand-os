/**
 * GET /api/project/[id]/decisions
 *
 * 列出项目全部 Decision Memory 条目，按阶段分组。
 * 可选 query: ?stage=3 按阶段过滤。
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/project-repo";
import { getEntriesByStage, getEntries } from "@/lib/memory/decision-memory";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const stageFilter = req.nextUrl.searchParams.get("stage");

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    let entries;
    if (stageFilter) {
      entries = await getEntriesByStage(projectId, parseInt(stageFilter, 10));
    } else {
      entries = await getEntries(projectId);
    }

    // 按阶段分组
    const grouped: Record<number, typeof entries> = {};
    for (const e of entries) {
      const stage = e.stageSource;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(e);
    }

    return NextResponse.json({ entries, grouped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
