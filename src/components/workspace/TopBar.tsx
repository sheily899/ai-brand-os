"use client";

import Link from "next/link";

interface TopBarProps {
  projectId: string;
  brandName: string;
  category?: string;
  allStagesComplete: boolean;
  completedCount?: number;
  totalStages?: number;
}

export default function TopBar({
  projectId,
  brandName,
  category,
  allStagesComplete,
  completedCount = 0,
  totalStages = 8,
}: TopBarProps) {
  return (
    <header className="h-11 border-b border-stone-200 bg-white flex items-center justify-between px-4 shrink-0">
      {/* 左侧：返回 + 品牌信息 */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="text-stone-400 hover:text-stone-600 transition-colors shrink-0"
          title="返回首页"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>

        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-[#37352f] truncate">
            {brandName}
          </h1>
          {category && (
            <span className="text-[11px] text-stone-400 hidden sm:inline shrink-0">
              {category}
            </span>
          )}
        </div>
      </div>

      {/* 右侧：进度 + 查看报告 */}
      <div className="flex items-center gap-3">
        {/* 进度指示 */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: totalStages }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < completedCount ? "bg-stone-400" : "bg-stone-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-stone-400 tabular-nums">
            {completedCount}/{totalStages}
          </span>
        </div>

        {/* 查看报告按钮 */}
        <Link
          href={`/project/${projectId}/report`}
          className={`
            inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-all shrink-0 font-medium
            ${allStagesComplete
              ? "bg-[#37352f] text-white hover:bg-stone-800 shadow-sm"
              : "bg-stone-100 text-stone-400 border border-stone-200"
            }
          `}
          title={
            allStagesComplete
              ? "查看完整品牌战略报告"
              : `完成全部 ${totalStages} 个阶段后可查看报告`
          }
        >
          <ReportIcon />
          查看报告
        </Link>
      </div>
    </header>
  );
}

function ReportIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
