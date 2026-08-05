"use client";

import { STAGE_META } from "@/lib/stage-config";
import type { StageStatus } from "@/lib/workflow/workflow";

interface StageProgressProps {
  stages: Array<{ number: number; status: StageStatus }>;
  currentStage: number;
}

const STATUS_COLORS: Record<StageStatus, string> = {
  draft: "bg-gray-200",
  active: "bg-blue-500 ring-2 ring-blue-200",
  converging: "bg-indigo-500 ring-2 ring-indigo-200",
  waiting_confirm: "bg-yellow-400",
  completed: "bg-green-500",
  failed: "bg-red-500",
  blocked: "bg-red-300",
  invalidated: "bg-orange-400",
  archived: "bg-gray-400",
};

const STATUS_LABELS: Record<StageStatus, string> = {
  draft: "未开始",
  active: "进行中",
  converging: "收束中",
  waiting_confirm: "待确认",
  completed: "已完成",
  failed: "不通过",
  blocked: "已阻断",
  invalidated: "已失效",
  archived: "已归档",
};

export default function StageProgress({
  stages,
  currentStage,
}: StageProgressProps) {
  return (
    <div className="flex items-center gap-1.5" title="阶段进度">
      {stages.map((s) => {
        const isCurrent = s.number === currentStage;
        return (
          <div
            key={s.number}
            className="flex items-center gap-1"
            title={`S${s.number} ${STAGE_META[s.number]?.name ?? ""} — ${STATUS_LABELS[s.status]}`}
          >
            <div
              className={`
                w-2.5 h-2.5 rounded-full transition-colors
                ${STATUS_COLORS[s.status] ?? "bg-gray-200"}
                ${isCurrent ? "scale-125" : ""}
              `}
            />
            {s.number < 8 && (
              <div
                className={`w-2 h-px ${
                  s.status === "completed" ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
