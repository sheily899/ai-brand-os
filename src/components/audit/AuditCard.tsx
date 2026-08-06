"use client";

import AuditDetail from "./AuditDetail";
import type { AIAuditResult } from "@/lib/audit/ai-quality";
import type { RuleCheckResult } from "@/lib/audit/rule-check";
import type { ReferenceIssue } from "@/lib/audit/cross-stage";
import type { GateDecision } from "@/lib/audit/audit-engine";
import { displayFieldName, localizeFieldNames } from "@/lib/audit/field-display";

interface AuditCardProps {
  /** 门禁决策 */
  gateDecision: GateDecision;
  /** AI 审计结果 */
  aiAudit: AIAuditResult | null;
  /** Rule Check 结果 */
  ruleCheck: RuleCheckResult | null;
  /** 引用完整性问题 */
  referenceIssues?: ReferenceIssue[];
  /** 操作回调 */
  onSmartOptimize?: () => void;
  onManualAdjust?: () => void;
  onKeepCurrent?: () => void;
  /** 操作进行中 */
  loading?: boolean;
  /** 当前优化操作的 label */
  loadingLabel?: string;
}

export default function AuditCard({
  gateDecision,
  aiAudit,
  ruleCheck,
  referenceIssues,
  onSmartOptimize,
  onManualAdjust,
  onKeepCurrent,
  loading = false,
  loadingLabel,
}: AuditCardProps) {
  // ── Advance 态 ──────────────────────────────────────
  if (gateDecision === "advance") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 my-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-600 text-sm">✅</span>
          <h4 className="text-sm font-medium text-green-800">阶段审核通过</h4>
        </div>
        <p className="text-xs text-green-600">
          {aiAudit
            ? `内容质量评估通过，阶段已完成并推进到下一阶段。`
            : "所有检查已通过，阶段已完成。"}
        </p>
        <AuditDetail
          aiAudit={aiAudit}
          ruleCheck={ruleCheck}
          referenceIssues={referenceIssues}
        />
      </div>
    );
  }

  // ── Block 态 ────────────────────────────────────────
  if (gateDecision === "block") {
    const criticalIssues =
      ruleCheck?.issues?.filter((i) => i.severity === "error") ?? [];
    const aiBlockIssues =
      aiAudit?.issues?.filter((i) => i.severity === "critical") ?? [];
    const refErrors =
      referenceIssues?.filter((r) => r.severity === "error") ?? [];

    return (
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 my-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-600 text-sm">⛔</span>
          <h4 className="text-sm font-medium text-red-800">
            阶段审核未通过——需要修复后重试
          </h4>
        </div>

        {/* 阻断问题列表 */}
        <div className="space-y-1.5 mb-3">
          {criticalIssues.map((issue, i) => (
            <div
              key={`rule-${i}`}
              className="text-xs text-red-700 bg-red-100 rounded px-2 py-1"
            >
              <span className="font-medium">结构问题: </span>
              {issue.field && (
                <span className="text-red-500">{displayFieldName(issue.field)} </span>
              )}
              {localizeFieldNames(issue.message)}
            </div>
          ))}
          {aiBlockIssues.map((issue, i) => (
            <div
              key={`ai-${i}`}
              className="text-xs text-red-700 bg-red-100 rounded px-2 py-1"
            >
              <span className="font-medium">内容问题: </span>
              {localizeFieldNames(issue.description)}
              {issue.suggestion && (
                <span className="text-red-500 ml-1">→ {localizeFieldNames(issue.suggestion)}</span>
              )}
            </div>
          ))}
          {refErrors.map((ref, i) => (
            <div
              key={`ref-${i}`}
              className="text-xs text-red-700 bg-red-100 rounded px-2 py-1"
            >
              <span className="font-medium">引用缺失: </span>
              {ref.userMessage || localizeFieldNames(ref.message)}
            </div>
          ))}
        </div>

        <p className="text-xs text-red-600 mb-3">
          以上问题必须在当前阶段对话中手动修复。修复后重新触发收束。
        </p>

        <div className="flex gap-2">
          <button
            onClick={onManualAdjust}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded
              hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            手动调整
          </button>
        </div>

        <AuditDetail
          aiAudit={aiAudit}
          ruleCheck={ruleCheck}
          referenceIssues={referenceIssues}
        />
      </div>
    );
  }

  // ── Reoptimize 态 ───────────────────────────────────
  const stageIssues = aiAudit?.issues ?? [];
  const refWarnings =
    referenceIssues?.filter((r) => r.severity !== "error") ?? [];
  const allIssues = [
    ...stageIssues.map((i) => ({
      source: "content" as const,
      severity: i.severity,
      text: i.description,
      suggestion: i.suggestion,
    })),
    ...refWarnings.map((r) => ({
      source: "reference" as const,
      severity: r.severity,
      text: r.userMessage || localizeFieldNames(r.message),
      suggestion: undefined as string | undefined,
    })),
  ].sort((a, b) => {
    const order = { critical: 0, major: 1, error: 1, minor: 2, warning: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 my-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-600 text-sm">⚠</span>
        <h4 className="text-sm font-medium text-yellow-800">阶段建议优化</h4>
        {aiAudit && (
          <span className="text-xs text-yellow-600">
            (综合 {aiAudit.totalScore}/100)
          </span>
        )}
      </div>

      {/* 问题列表（合并阶段问题 + 跨阶段问题） */}
      {allIssues.length > 0 && (
        <div className="space-y-1 mb-3">
          {allIssues.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className={`text-xs rounded px-2 py-1 ${
                item.severity === "critical" || item.severity === "error"
                  ? "text-red-700 bg-red-100"
                  : "text-yellow-700 bg-yellow-100"
              }`}
            >
              {localizeFieldNames(item.text)}
              {item.suggestion && (
                <span className="text-gray-500 ml-1">→ {localizeFieldNames(item.suggestion)}</span>
              )}
            </div>
          ))}
          {allIssues.length > 5 && (
            <p className="text-[11px] text-gray-400">
              …共 {allIssues.length} 个问题（展开审计详情查看全部）
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-yellow-600 mb-3">
        以上问题建议优化处理，你也可以选择保持当前版本继续推进。
      </p>

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onSmartOptimize}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded
            hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading && loadingLabel ? loadingLabel : "智能优化"}
        </button>
        <button
          onClick={onManualAdjust}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded
            hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          手动调整
        </button>
        <button
          onClick={onKeepCurrent}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-500 rounded
            hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          保持当前决策
        </button>
      </div>

      <AuditDetail
        aiAudit={aiAudit}
        ruleCheck={ruleCheck}
        referenceIssues={referenceIssues}
      />
    </div>
  );
}
