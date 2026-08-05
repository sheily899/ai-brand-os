"use client";

import { useState } from "react";
import type { AIAuditResult, DimensionScore } from "@/lib/audit/ai-quality";
import type { RuleCheckResult } from "@/lib/audit/rule-check";
import type { ReferenceIssue } from "@/lib/audit/cross-stage";
import type { AuditReport, GateDecision } from "@/lib/audit/audit-engine";
import { displayFieldName, localizeFieldNames, displayDependencyPath } from "@/lib/audit/field-display";

interface OptimizeCompleteCardProps {
  stage: number;
  newOutput: Record<string, any> | null;
  changeSummary: string[];
  auditReport?: AuditReport | null;
  gateDecision?: GateDecision;
  onConfirm: () => void;
  onConfirmCurrent: () => void;
  onSmartOptimize: () => void;
  onRollback: () => void;
  loading?: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  specificity: "具体度",
  differentiation: "差异化",
  actionability: "可执行性",
  evidence: "证据支撑",
};

// ── SVG Icons (matching AuditPanel) ──────────────────────────

function PassIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#4ade80" />
      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L15.5 15H.5L8 1.5z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <circle cx="8" cy="12" r="0.5" fill="#d97706" stroke="none" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" />
    </svg>
  );
}

function ChevronExpand({ expanded }: { expanded: boolean }) {
  return (
    <svg className={`w-3 h-3 text-stone-400 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── 横向胶囊叠轨进度条 (matching AuditPanel) ────────────────

function DimensionBar({ score, weight, label }: { score: number; weight: number; label: string }) {
  const pct = (score / 5) * 100;
  const isGreen = score >= 4;
  const isAmber = score >= 2 && score < 4;
  const fillColor = isGreen ? "bg-green-400" : isAmber ? "bg-amber-400" : "bg-red-500";
  const borderColor = isGreen ? "border-green-400/30" : isAmber ? "border-amber-300/30" : "border-red-400/30";
  const hatchRgba = isGreen ? "rgba(74,222,128,0.12)" : isAmber ? "rgba(251,191,36,0.15)" : "rgba(220,38,38,0.12)";
  const badgeClass = isGreen ? "bg-green-50 text-green-700" : isAmber ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-500 text-[11px] font-medium shrink-0 whitespace-nowrap">{label}</span>
      <div className="flex-1 relative h-6 rounded-full overflow-hidden">
        <div className="absolute inset-0 rounded-full"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${hatchRgba} 4px, ${hatchRgba} 8px)` }} />
        <div className={`absolute inset-0 rounded-full border ${borderColor}`} />
        <div className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full transition-all duration-500 ${fillColor}`}
          style={{ width: `calc(${pct}% - 4px)` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${Math.min(Math.max(pct, 8), 92)}%` }}>
          <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 shadow-sm ${badgeClass}`}>
            {score}/5
          </span>
        </div>
      </div>
      <span className="w-10 text-right text-stone-400 text-[11px] shrink-0 tabular-nums">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── 评分胶囊 ──────────────────────────────────────────────────

function ScoreBadge({ score, gateDecision }: { score: number; gateDecision: GateDecision }) {
  const colors = {
    advance: "bg-green-100 text-green-700",
    reoptimize: "bg-amber-50 text-amber-600",
    block: "bg-red-100 text-red-700",
  }[gateDecision];
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${colors}`}>
      {score}
      <span className="text-[10px] font-normal opacity-60">/100</span>
    </span>
  );
}

// ── 精简单句 AI 问题 ──────────────────────────────────────────

function AIFindingsText({ issues }: { issues: AIAuditResult["issues"] }) {
  if (!issues || issues.length === 0) return null;
  const critical = issues.filter((i) => i.severity === "critical" || i.severity === "major");
  const top = critical.length > 0 ? critical[0] : issues[0];
  return (
    <span className="text-[11px] text-stone-500 leading-relaxed">
      {localizeFieldNames(top.description)}
    </span>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────

export default function OptimizeCompleteCard({
  stage,
  newOutput: _newOutput,
  changeSummary: _changeSummary,
  auditReport,
  gateDecision,
  onConfirm,
  onConfirmCurrent,
  onSmartOptimize,
  onRollback,
  loading = false,
}: OptimizeCompleteCardProps) {
  const aiAudit = auditReport?.aiAudit ?? null;
  const ruleCheck = auditReport?.ruleCheck ?? null;
  const referenceIssues = auditReport?.referenceIssues ?? [];
  const gate = gateDecision ?? "reoptimize";
  const isPassed = gate === "advance";

  // ── 面板头部 ──────────────────────────────────────────
  const headerConfig = {
    advance: { bg: "bg-green-50 border-green-200", Icon: PassIcon, title: "优化完成，审核通过" },
    reoptimize: { bg: "bg-amber-50/60 border-amber-200", Icon: WarnIcon, title: "优化完成，建议复核" },
    block: { bg: "bg-red-50 border-red-200", Icon: BlockIcon, title: "优化完成，需要修复" },
  }[gate];
  const { bg, Icon, title } = headerConfig;

  return (
    <div className="w-72 border-l border-stone-200 bg-white overflow-y-auto shrink-0 p-4">
      {/* 状态头部：图标 + 标题 + 评分胶囊 */}
      <div className={`rounded-lg border ${bg} px-3 py-2.5 mb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon />
            <span className="text-sm font-semibold text-[#37352f]">{title}</span>
          </div>
          {aiAudit && <ScoreBadge score={aiAudit.totalScore} gateDecision={gate} />}
        </div>
        {aiAudit?.issues && aiAudit.issues.length > 0 && (
          <div className="mt-1.5">
            <AIFindingsText issues={aiAudit.issues} />
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col gap-1.5 mb-3">
        {onConfirmCurrent && (
          <button
            onClick={onConfirmCurrent}
            disabled={loading}
            className="w-full px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg
              hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "提交中…" : "确定当前方案"}
          </button>
        )}
        {onSmartOptimize && (
          <button
            onClick={onSmartOptimize}
            disabled={loading}
            className="w-full px-3 py-2 text-xs font-medium bg-[#37352f] text-white rounded-lg
              hover:bg-stone-800 disabled:opacity-40 transition-colors"
          >
            {loading ? "优化中…" : "智能优化"}
          </button>
        )}
        {onRollback && (
          <button
            onClick={onRollback}
            disabled={loading}
            className="w-full px-3 py-2 text-xs font-medium border border-stone-300 text-stone-600 rounded-lg
              hover:bg-stone-50 disabled:opacity-40 transition-colors"
          >
            回退原方案
          </button>
        )}
      </div>

      {/* 审计详情（可折叠，匹配 AuditPanel 样式）*/}
      <AuditDetailSection aiAudit={aiAudit} ruleCheck={ruleCheck} referenceIssues={referenceIssues} />
    </div>
  );
}

// ── 审计详情（可折叠）─────────────────────────────────────────

function AuditDetailSection({
  aiAudit,
  ruleCheck,
  referenceIssues,
}: {
  aiAudit: AIAuditResult | null;
  ruleCheck: RuleCheckResult | null;
  referenceIssues?: ReferenceIssue[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-stone-200 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1.5 w-full"
      >
        <ChevronExpand expanded={expanded} />
        审计详情
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-xs">
          {/* 四维评估 */}
          {aiAudit?.dimensionScores && (
            <div>
              <h5 className="font-medium text-stone-600 mb-2">四维评估</h5>
              <div className="space-y-3">
                {aiAudit.dimensionScores.map((ds: DimensionScore) => (
                  <div key={ds.dimension}>
                    <DimensionBar
                      score={ds.score}
                      weight={ds.weight}
                      label={DIMENSION_LABELS[ds.dimension] ?? ds.dimension}
                    />
                    {ds.reason && (
                      <p className="text-[11px] text-stone-400 mt-0.5 ml-[60px] leading-relaxed"
                         dangerouslySetInnerHTML={{
                           __html: localizeFieldNames(ds.reason)
                             .replace(/\*\*(.+?)\*\*/g, '<strong class="text-stone-600 font-medium">$1</strong>'),
                         }}
                      />
                    )}
                    {ds.improvements && ds.improvements.length > 0 && (
                      <p className="text-[11px] text-stone-400 mt-0.5 ml-[60px] leading-relaxed">
                        {ds.improvements.map((imp, j) => (
                          <span key={j}>
                            {j > 0 && " "}
                            {localizeFieldNames(imp)}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 结构检查 */}
          {ruleCheck?.issues && ruleCheck.issues.length > 0 && (
            <div>
              <h5 className="font-medium text-stone-600 mb-1">结构检查</h5>
              <ul className="space-y-0.5">
                {ruleCheck.issues.map((issue, i) => (
                  <li key={i} className="text-stone-500 flex gap-1 text-[11px]">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      issue.severity === "error" ? "bg-red-400" : "bg-amber-400"
                    }`} />
                    <span>
                      {issue.field && (
                        <span className="text-stone-400">{displayFieldName(issue.field)}: </span>
                      )}
                      {localizeFieldNames(issue.message)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 跨阶段引用 */}
          {referenceIssues && referenceIssues.length > 0 && (
            <div>
              <h5 className="font-medium text-stone-600 mb-1">跨阶段引用检查</h5>
              <ul className="space-y-1">
                {referenceIssues.map((ref, i) => (
                  <li key={i}>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      {ref.userMessage || localizeFieldNames(ref.message)}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{displayDependencyPath(ref.dependencyPath ?? "")}</p>
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
