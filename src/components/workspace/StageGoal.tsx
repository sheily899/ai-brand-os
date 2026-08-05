"use client";

import { useState } from "react";
import { getStageGoal, getStageName } from "@/lib/stage-config";
import type { StageStatus } from "@/lib/workflow/workflow";

interface StageGoalProps {
  stage: number;
  status: StageStatus;
}

export default function StageGoal({ stage, status }: StageGoalProps) {
  const [expanded, setExpanded] = useState(true);
  const goal = getStageGoal(stage);
  const name = getStageName(stage);

  if (!goal) return null;

  return (
    <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 w-full text-left"
      >
        <span
          className={`transform transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        <span className="font-medium">
          S{stage} {name}
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-400">
          {status === "active"
            ? "进行中"
            : status === "completed"
              ? "已完成"
              : status === "invalidated"
                ? "已失效"
                : status === "draft"
                  ? "待开始"
                  : status === "waiting_confirm"
                    ? "待确认"
                    : ""}
        </span>
      </button>
      {expanded && (
        <p className="mt-1 text-xs text-gray-500 leading-relaxed ml-4">
          {goal}
        </p>
      )}
    </div>
  );
}
