"use client";

import { useState } from "react";
import { STAGE_META } from "@/lib/stage-config";
import type { StageStatus } from "@/lib/workflow/workflow";

interface StageInfo {
  number: number;
  status: StageStatus;
  /** 阶段完成时的审计决策（advance = 自然通过；reoptimize/block = 强制推进） */
  finalGateDecision?: string | null;
}

interface StageSidebarProps {
  stages: StageInfo[];
  activeStage: number;
  onSelect: (stage: number) => void;
  /** 各阶段输出数据（用于已完成阶段的清单展示） */
  stageOutputs?: Map<number, Record<string, any>>;
  /** 回溯到指定阶段的指定话题 */
  onBacktrack?: (stage: number, field: string) => void;
}

// ── SVG Icons ──────────────────────────────────────────

function CheckCircle() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" />
      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="7" width="9" height="7" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L15.5 15H.5L8 1.5z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

// ── Status Icon ─────────────────────────────────────────

function StatusIcon({ status, finalGateDecision }: { status: StageStatus; finalGateDecision?: string | null }) {
  // completed 但审计未通过（强制推进）→ 黄色警告
  if (status === "completed" && finalGateDecision && finalGateDecision !== "advance") {
    return <AlertIcon />;
  }
  switch (status) {
    case "completed": return <CheckCircle />;
    case "active": case "waiting_confirm": return <DotIcon />;
    case "invalidated": return <AlertIcon />;
    case "failed": case "blocked": return <XCircleIcon />;
    default: return <LockIcon />;
  }
}

function iconColor(status: StageStatus, finalGateDecision?: string | null): string {
  // completed 但审计未通过 → 黄色
  if (status === "completed" && finalGateDecision && finalGateDecision !== "advance") {
    return "text-amber-500";
  }
  switch (status) {
    case "completed": return "";
    case "active": case "waiting_confirm": return "text-[#37352f]";
    case "invalidated": return "text-orange-500";
    case "failed": case "blocked": return "text-red-500";
    default: return "text-stone-300";
  }
}

function textColor(status: StageStatus, isActive: boolean, finalGateDecision?: string | null): string {
  if (isActive) return "text-[#37352f]";
  // completed 但审计未通过 → 黄色文字
  if (status === "completed" && finalGateDecision && finalGateDecision !== "advance") {
    return "text-amber-600";
  }
  switch (status) {
    case "completed": return "text-stone-500";
    case "invalidated": return "text-orange-600";
    case "failed": case "blocked": return "text-red-600";
    default: return "text-stone-400";
  }
}

// ── Checklist ───────────────────────────────────────────

/** 从阶段输出中提取关键完成的字段清单，返回 fieldPath + 中文标签 */
function getChecklistItems(stageNumber: number, output?: Record<string, any>): { field: string; label: string }[] {
  if (!output) return [];

  const keyFields: Record<number, string[]> = {
    1: ["founderMotivation", "observations", "confirmedProblems", "constraints"],
    2: ["businessBackground", "coreChallenges", "strategicDirection"],
    3: ["marketOverview", "opportunityDirections", "categoryDefinition"],
    4: ["targetConsumer", "deepNeeds", "userPersona"],
    5: ["competitors", "competitiveGap", "mindshareGap"],
    6: ["positioning", "valuePropositions", "brandPersonality", "brandStory"],
    7: ["coreConcept", "visualSystem", "keywords"],
    8: ["coreDirection", "themeDirections", "channelStrategy"],
  };

  const fields = keyFields[stageNumber] ?? [];
  const labels: Record<string, string> = {
    founderMotivation: "创始人动机",
    observations: "市场观察",
    confirmedProblems: "确认的核心问题",
    constraints: "已知约束",
    businessBackground: "商业背景",
    coreChallenges: "核心挑战",
    strategicDirection: "战略方向",
    marketOverview: "市场概况",
    opportunityDirections: "机会方向",
    categoryDefinition: "品类定义",
    targetConsumer: "目标消费者",
    deepNeeds: "深层需求",
    userPersona: "用户画像",
    competitors: "竞品分析",
    competitiveGap: "竞争空位",
    mindshareGap: "心智空位",
    positioning: "品牌定位",
    valuePropositions: "价值主张",
    brandPersonality: "品牌人格",
    brandStory: "品牌故事",
    coreConcept: "核心视觉概念",
    visualSystem: "视觉系统",
    keywords: "视觉关键词",
    coreDirection: "内容核心方向",
    themeDirections: "内容主题",
    channelStrategy: "渠道策略",
  };

  return fields.filter((f) => {
    const val = output[f];
    if (val === undefined || val === null) return false;
    if (typeof val === "string" && val.length < 3) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).map((f) => ({ field: f, label: labels[f] ?? f }));
}

// ── Component ───────────────────────────────────────────

/** 计算哪些阶段可点击：已完成阶段 + 第一个未完成阶段（当前活跃） */
function getAccessibleStages(stages: StageInfo[]): Set<number> {
  const accessible = new Set<number>();
  const sorted = [...stages].sort((a, b) => a.number - b.number);
  let foundActive = false;
  for (const s of sorted) {
    if (s.status === "completed") {
      accessible.add(s.number);
    } else if (!foundActive) {
      accessible.add(s.number); // 第一个非 completed 阶段 = 当前工作阶段
      foundActive = true;
    }
    // 后续的非 completed 阶段不加（locked）
  }
  return accessible;
}

export default function StageSidebar({
  stages,
  activeStage,
  onSelect,
  stageOutputs,
  onBacktrack,
}: StageSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const accessibleStages = getAccessibleStages(stages);

  return (
    <aside
      className={`shrink-0 border-r border-stone-200 bg-[#f7f7f5] flex flex-col overflow-y-auto transition-all duration-200 ${
        collapsed ? "w-12" : "w-52"
      }`}
    >
      {/* 折叠按钮 */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2 py-3 border-b border-stone-200`}>
        {!collapsed && (
          <h3 className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
            咨询流程
          </h3>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-stone-400 hover:text-stone-600 p-1 rounded transition-colors"
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* 阶段列表 */}
      <nav className="flex-1 py-1" aria-label="阶段列表">
        {stages.map((s) => {
          const meta = STAGE_META[s.number];
          const isActive = s.number === activeStage;
          const isCompleted = s.status === "completed";
          const output = stageOutputs?.get(s.number);
          const hasOutput = output && Object.keys(output).length > 0;
          // 已完成或有输出的阶段（含 reoptimize 中）可展开查看清单并回溯
          const canExpand = isCompleted || (s.status === "active" && hasOutput);
          const isExpanded = expandedStage === s.number;
          const canAccess = accessibleStages.has(s.number);

          // 折叠模式：只显示图标
          if (collapsed) {
            return (
              <button
                key={s.number}
                onClick={() => canAccess && onSelect(s.number)}
                disabled={!canAccess}
                className={`w-full flex justify-center py-3 transition-colors ${
                  !canAccess
                    ? "cursor-not-allowed opacity-50"
                    : isActive
                      ? "bg-stone-200/50 border-l-2 border-[#37352f] cursor-pointer"
                      : "border-l-2 border-transparent hover:bg-stone-200/30 cursor-pointer"
                }`}
                title={`S${s.number} ${meta?.name ?? ""}${!canAccess ? " (前序阶段未完成，已锁定)" : ""}${s.finalGateDecision && s.finalGateDecision !== "advance" ? " (强制推进)" : ""}`}
              >
                <span className={iconColor(s.status, s.finalGateDecision)}>
                  <StatusIcon status={s.status} finalGateDecision={s.finalGateDecision} />
                </span>
              </button>
            );
          }

          // 展开模式
          const checklist = canExpand ? getChecklistItems(s.number, output) : [];

          return (
            <div key={s.number}>
              <button
                onClick={() => {
                  if (!canAccess) return;
                  onSelect(s.number);
                  if (canExpand) {
                    setExpandedStage(isExpanded ? null : s.number);
                  }
                }}
                disabled={!canAccess}
                className={`
                  w-full text-left px-4 py-2.5 transition-colors flex items-center gap-3
                  ${!canAccess
                    ? "cursor-not-allowed opacity-50"
                    : isActive
                      ? "bg-stone-200/50 border-l-2 border-[#37352f] pl-[14px] cursor-pointer"
                      : "border-l-2 border-transparent pl-4 hover:bg-stone-200/30 cursor-pointer"
                  }
                `}
              >
                <span className={iconColor(s.status, s.finalGateDecision)}>
                  <StatusIcon status={s.status} finalGateDecision={s.finalGateDecision} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-tight font-medium ${textColor(s.status, isActive, s.finalGateDecision)}`}>
                    <span className="tabular-nums">S{s.number}</span>{" "}
                    {meta?.name ?? `阶段 ${s.number}`}
                  </p>
                </div>
                {/* 展开指示器 */}
                {canExpand && (
                  <span className={`text-stone-300 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>

              {/* 可回溯阶段的清单 + 话题级回溯入口 */}
              {isExpanded && canExpand && (
                <div className="px-4 pb-3 pl-10">
                  {checklist.length > 0 && (
                    <ul className="space-y-0.5">
                      {checklist.map((item, i) => (
                        <li key={i} className="text-[11px] text-stone-500 flex items-center justify-between group hover:bg-stone-200/50 rounded px-1 -mx-1 py-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <svg className="w-3 h-3 text-green-500 shrink-0" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" fill="#10b981" />
                              <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {/* 每个话题独立的编辑按钮 */}
                          {onBacktrack && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onBacktrack(s.number, item.field);
                              }}
                              className="shrink-0 text-stone-400 hover:text-amber-600 p-0.5 transition-colors"
                              title={`修改「${item.label}」`}
                            >
                              <EditIcon />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
