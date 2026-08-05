"use client";

import { useState } from "react";
import type { AIAuditResult, AuditIssue, DimensionScore } from "@/lib/audit/ai-quality";
import type { RuleCheckResult } from "@/lib/audit/rule-check";
import type { ReferenceIssue } from "@/lib/audit/cross-stage";
import { displayFieldName, localizeFieldNames, displayDependencyPath } from "@/lib/audit/field-display";

interface AuditDetailProps {
  /** AI 质量审计结果 */
  aiAudit: AIAuditResult | null;
  /** Rule Check 结果 */
  ruleCheck: RuleCheckResult | null;
  /** 跨阶段引用问题 */
  referenceIssues?: ReferenceIssue[];
  /** 默认是否展开 */
  defaultExpanded?: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  specificity: "具体度",
  differentiation: "差异化",
  actionability: "可执行性",
  evidence: "证据",
};

// ── 横向胶囊叠轨进度条 ────────────────────────────────────

function DimensionBar({ score, weight, label }: { score: number; weight: number; label: string }) {
  const pct = (score / 5) * 100;

  const isGreen = score >= 4;
  const isAmber = score >= 2 && score < 4;

  const fillColor = isGreen ? "bg-green-400" : isAmber ? "bg-amber-400" : "bg-red-500";
  const borderColor = isGreen
    ? "border-green-400/30"
    : isAmber
      ? "border-amber-300/30"
      : "border-red-400/30";
  const hatchRgba = isGreen
    ? "rgba(74,222,128,0.12)"
    : isAmber
      ? "rgba(251,191,36,0.15)"
      : "rgba(220,38,38,0.12)";
  const badgeClass = isGreen
    ? "bg-green-50 text-green-700"
    : isAmber
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 text-[11px] font-medium shrink-0 whitespace-nowrap">{label}</span>
      <div className="flex-1 relative h-6 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${hatchRgba} 4px, ${hatchRgba} 8px)`,
          }}
        />
        <div className={`absolute inset-0 rounded-full border ${borderColor}`} />
        <div
          className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full transition-all duration-500 ${fillColor}`}
          style={{ width: `calc(${pct}% - 4px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${Math.min(Math.max(pct, 8), 92)}%` }}
        >
          <span
            className={`inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 shadow-sm ${badgeClass}`}
          >
            {score}/5
          </span>
        </div>
      </div>
      <span className="w-10 text-right text-gray-400 text-[11px] shrink-0 tabular-nums">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function AuditDetail({
  aiAudit,
  ruleCheck,
  referenceIssues,
  defaultExpanded = false,
}: AuditDetailProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <span className={`transform transition-transform ${expanded ? "rotate-90" : ""}`}>
          ▸
        </span>
        审计详情
        {aiAudit && (
          <span className="text-gray-400">
            · 综合 {aiAudit.totalScore}/100
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-3 text-xs">
          {/* AI Quality Audit */}
          {aiAudit?.dimensionScores && (
            <div>
              <h5 className="font-medium text-gray-600 mb-2">四维评估</h5>
              <div className="space-y-3">
                {aiAudit.dimensionScores.map((ds: DimensionScore) => (
                  <div key={ds.dimension}>
                    <DimensionBar
                      score={ds.score}
                      weight={ds.weight}
                      label={DIMENSION_LABELS[ds.dimension] ?? ds.dimension}
                    />
                    {/* 评分理由 */}
                    {ds.reason && (
                      <p className="text-[11px] text-gray-500 mt-1 ml-[72px] leading-relaxed">
                        {localizeFieldNames(ds.reason)}
                      </p>
                    )}
                    {/* 改进建议 */}
                    {ds.improvements && ds.improvements.length > 0 && (
                      <ul className="mt-1 ml-[72px] space-y-0.5">
                        {ds.improvements.map((imp, j) => (
                          <li key={j} className="text-[11px] text-gray-400 flex gap-1">
                            <span className="text-gray-300 shrink-0">·</span>
                            <span>{localizeFieldNames(imp)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {aiAudit?.issues && aiAudit.issues.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-600 mb-1">
                AI 发现的问题 ({aiAudit.issues.length})
              </h5>
              <ul className="space-y-1">
                {aiAudit.issues.map((issue: AuditIssue, i: number) => (
                  <li
                    key={i}
                    className={`pl-2 border-l-2 ${
                      issue.severity === "critical"
                        ? "border-red-400"
                        : issue.severity === "major"
                          ? "border-yellow-400"
                          : "border-gray-300"
                    }`}
                  >
                    <span className="text-gray-700">{localizeFieldNames(issue.description)}</span>
                    {issue.suggestion && (
                      <span className="text-gray-400 ml-1">
                        → {localizeFieldNames(issue.suggestion)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rule Check Issues */}
          {ruleCheck?.issues && ruleCheck.issues.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-600 mb-1">
                结构检查 ({ruleCheck.issues.length})
              </h5>
              <ul className="space-y-0.5">
                {ruleCheck.issues.map((issue, i) => (
                  <li key={i} className="text-gray-600">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                        issue.severity === "error"
                          ? "bg-red-400"
                          : "bg-yellow-400"
                      }`}
                    />
                    {issue.field && (
                      <span className="text-gray-400">{displayFieldName(issue.field)}: </span>
                    )}
                    {localizeFieldNames(issue.message)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reference Issues */}
          {referenceIssues && referenceIssues.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-600 mb-1">
                跨阶段引用检查 ({referenceIssues.length})
              </h5>
              <ul className="space-y-0.5">
                {referenceIssues.map((ref, i) => (
                  <li
                    key={i}
                    className={`${
                      ref.severity === "error"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    <p className="text-gray-700 leading-relaxed">
                      {ref.userMessage || localizeFieldNames(ref.message)}
                    </p>
                    {/* 技术详情仅在折叠区作为灰色附注展示 */}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {displayDependencyPath(ref.dependencyPath ?? "")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
