"use client";

import { STAGE_META } from "@/lib/stage-config";
import { displayFieldName, localizeFieldNames } from "@/lib/audit/field-display";

interface StageSummaryProps {
  stage: number;
  output: Record<string, any> | null;
  /** 阶段完成时间 */
  completedAt?: string;
}

/**
 * 阶段小结卡片——已完成阶段的只读回顾。
 * 展示结构化输出的关键字段摘要。
 */
export default function StageSummary({
  stage,
  output,
  completedAt,
}: StageSummaryProps) {
  const meta = STAGE_META[stage];

  if (!output) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 my-3">
        <p className="text-sm text-gray-500">
          S{stage} {meta?.name ?? ""} — 暂无结构化输出
        </p>
      </div>
    );
  }

  // 从 output 中提取展示性字段（取前几个 key-value）
  const previewEntries = Object.entries(output)
    .filter(
      ([, v]) =>
        typeof v === "string" ||
        typeof v === "number" ||
        (Array.isArray(v) && v.length > 0)
    )
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 my-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-green-800">
          ✓ S{stage} {meta?.name ?? ""} — 阶段小结
        </h4>
        {completedAt && (
          <span className="text-[11px] text-gray-400">
            {new Date(completedAt).toLocaleDateString("zh-CN")}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {previewEntries.map(([key, value]) => (
          <div key={key} className="text-xs">
            <span className="text-gray-500">{displayFieldName(key)}： </span>
            <span className="text-gray-700">
              {typeof value === "string"
                ? (() => {
                    const localized = localizeFieldNames(value);
                    return localized.length > 120
                      ? localized.slice(0, 120) + "…"
                      : localized;
                  })()
                : Array.isArray(value)
                  ? `${value.length} 项`
                  : String(value)}
            </span>
          </div>
        ))}
        {Object.keys(output).length > 5 && (
          <p className="text-[11px] text-gray-400 mt-1">
            …共 {Object.keys(output).length} 个字段
          </p>
        )}
      </div>
    </div>
  );
}
