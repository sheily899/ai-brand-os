"use client";

import Link from "next/link";
import { STAGE_META } from "@/lib/stage-config";

interface ReportToolbarProps {
  projectId: string;
  brandName: string;
  completedStages: number[];
  activeStage?: number;
}

/** 阶段进度点 hover 提示 */
function StageDot({
  stage,
  status,
}: {
  stage: number;
  status: "completed" | "active" | "pending";
}) {
  const meta = STAGE_META[stage];
  const colors = {
    completed: "bg-stone-600",
    active: "bg-stone-300",
    pending: "bg-stone-200",
  }[status];

  return (
    <div className="group relative">
      <div
        className={`w-2 h-2 rounded-full ${colors} transition-colors cursor-default`}
      />
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-20">
        <div className="bg-stone-800 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
          S{stage} {meta?.name ?? ""}
        </div>
      </div>
    </div>
  );
}

export default function ReportToolbar({
  projectId,
  brandName,
  completedStages,
  activeStage,
}: ReportToolbarProps) {
  const allStages = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-stone-200 print:hidden">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-12">
        {/* 左侧：返回工作台 */}
        <div className="flex items-center gap-4">
          <Link
            href={`/project/${projectId}`}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            ← 返回工作台
          </Link>
        </div>

        {/* 中间：8 阶段进度点 */}
        <div className="flex items-center gap-2">
          {allStages.map((s) => (
            <StageDot
              key={s}
              stage={s}
              status={
                completedStages.includes(s)
                  ? "completed"
                  : s === activeStage
                    ? "active"
                    : "pending"
              }
            />
          ))}
        </div>

        {/* 右侧：导出 PDF */}
        <button
          onClick={() => window.print()}
          className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-md hover:bg-stone-200 transition-colors border border-stone-200"
        >
          导出 PDF
        </button>
      </div>
    </header>
  );
}
