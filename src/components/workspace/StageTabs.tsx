"use client";

import { STAGE_META } from "@/lib/stage-config";
import type { StageStatus } from "@/lib/workflow/workflow";

interface StageInfo {
  number: number;
  status: StageStatus;
}

interface StageTabsProps {
  stages: StageInfo[];
  activeStage: number;
  onSelect: (stage: number) => void;
}

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "completed":
      return <span className="text-green-600 text-xs">✓</span>;
    case "active":
    case "waiting_confirm":
      return <span className="text-blue-600 text-xs">●</span>;
    case "invalidated":
      return <span className="text-orange-500 text-xs">⚠</span>;
    case "failed":
    case "blocked":
      return <span className="text-red-500 text-xs">⛔</span>;
    default:
      return <span className="text-gray-300 text-xs">🔒</span>;
  }
}

export default function StageTabs({
  stages,
  activeStage,
  onSelect,
}: StageTabsProps) {
  return (
    <nav
      className="flex border-b border-gray-200 bg-white px-2 shrink-0"
      role="tablist"
      aria-label="阶段导航"
    >
      {stages.map((s) => {
        const meta = STAGE_META[s.number];
        const isActive = s.number === activeStage;

        return (
          <button
            key={s.number}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(s.number)}
            className={`
              flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium
              border-b-2 transition-colors whitespace-nowrap
              ${
                isActive
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }
            `}
          >
            <StatusIcon status={s.status} />
            <span className="hidden lg:inline">S{s.number}</span>
            <span className="hidden xl:inline text-xs text-gray-400">
              {meta?.name ?? `阶段 ${s.number}`}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
