"use client";

import { useState } from "react";
import type { ReportAuditResult } from "@/lib/report/types";

interface QualityBannerProps {
  audit: ReportAuditResult;
}

export default function QualityBanner({ audit }: QualityBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (audit.passed && audit.issues.length === 0) return null;

  const isError = !audit.passed;
  const bg = isError ? "bg-red-50 border-red-200" : "bg-amber-50/60 border-amber-200";
  const textColor = isError ? "text-red-800" : "text-amber-800";
  const subColor = isError ? "text-red-600" : "text-amber-600";

  return (
    <div className={`rounded-lg border ${bg} p-4 mb-6 print:hidden`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-semibold ${textColor}`}>
            报告质量审核
            <span className="ml-2 text-xs font-normal opacity-75">
              质量分数 {audit.score}/100
            </span>
          </h3>
          <p className={`text-xs ${subColor} mt-1`}>{audit.summary}</p>
        </div>
        {audit.issues.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-stone-500 hover:text-stone-700 shrink-0"
          >
            {expanded ? "收起" : `查看 ${audit.issues.length} 条`}
          </button>
        )}
      </div>

      {expanded && (
        <ul className="mt-3 space-y-1.5">
          {audit.issues.slice(0, 10).map((issue, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  issue.severity === "error" ? "bg-red-400" : "bg-amber-400"
                }`}
              />
              <span className={`text-xs ${subColor} leading-relaxed`}>
                {issue.chapter !== undefined && (
                  <span className="font-medium">第{issue.chapter}章: </span>
                )}
                {issue.message}
              </span>
            </li>
          ))}
          {audit.issues.length > 10 && (
            <li className="text-xs text-stone-400 pl-4">
              …另有 {audit.issues.length - 10} 条
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
