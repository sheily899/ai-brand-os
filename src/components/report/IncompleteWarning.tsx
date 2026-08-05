"use client";

import Link from "next/link";

interface IncompleteWarningProps {
  stagesReady: number;
  totalStages?: number;
  projectId: string;
}

export default function IncompleteWarning({
  stagesReady,
  totalStages = 8,
  projectId,
}: IncompleteWarningProps) {
  if (stagesReady >= totalStages) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-800">
            报告内容不完整
          </h3>
          <p className="text-xs text-amber-600 mt-1">
            当前仅完成 {stagesReady}/{totalStages} 个阶段，报告内容不完整。建议完成更多阶段后重新生成。
          </p>
        </div>
        <Link
          href={`/project/${projectId}`}
          className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors shrink-0"
        >
          返回工作台
        </Link>
      </div>
    </div>
  );
}
