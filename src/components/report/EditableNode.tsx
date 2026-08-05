/**
 * EditableNode — 统一内联编辑器
 *
 * 根据 source prop 自动判断保存路径：
 * - source 存在 → 实质性内容（来自 S1-S8 阶段产出）
 *   → 自动调用 applyMutation()，走 recordFieldEdit（版本记录、乐观锁、影响分析）
 * - source 不存在 → 展示层内容（标题、标签、页脚等）
 *   → 使用父组件提供的 onSave，走 save-report-override（轻量覆盖）
 *
 * 支持类型：text / paragraph / list-item
 *
 * 保存状态指示器：✓ 已保存 / ⚠ 保存失败 [重试] / ⟳ 保存中
 */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { EditableNodeType, NodeSaveState, RenderTarget } from "@/lib/editor/types";
import { useOptionalDocumentEditor } from "@/lib/editor/useDocumentEditor";

// ═══════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════

export interface EditableNodeProps {
  /** 唯一节点 ID（用于保存状态追踪） */
  nodeId: string;
  /** 编辑器类型 */
  type?: EditableNodeType;
  /** 当前值 */
  value: any;
  /** AI 原始值（存在且与 value 不同时显示恢复按钮） */
  originalValue?: any;
  /** 渲染为哪个 HTML 标签（默认 span） */
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p" | "div" | "dt" | "dd";
  /** 额外 CSS class */
  className?: string;
  /**
   * 数据溯源（决定保存路径）。
   *
   * 存在 → 实质性内容：EditableNode 自动调用 applyMutation()，
   *         使用 source.stage 作为乐观锁版本、source.fieldPath 作为数据路径。
   *         此时不需要传 onSave。
   *
   * 不存在 → 展示层内容：父组件必须提供 onSave 回调。
   */
  source?: { stage: number; fieldPath: string };
  /**
   * 渲染目标（source 存在时必填）。
   * 告诉乐观更新器在 report 树的哪个位置应用变更。
   */
  renderTarget?: RenderTarget;
  /**
   * 保存回调（展示层内容 — source 不存在时使用）。
   * 实质性内容不需要传此参数，EditableNode 自路由。
   */
  onSave?: (newValue: any) => Promise<void>;
  /** 当前保存状态 */
  saveStatus?: NodeSaveState;
  /** 重试（展示层内容使用；实质性内容自动从 context 获取） */
  onRetry?: () => void;
  /** 恢复 AI 原始值（展示层内容使用；实质性内容自动从 context 获取） */
  onRestore?: () => void;
  /** 是否禁用编辑 */
  disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export default function EditableNode({
  nodeId,
  type = "text",
  value,
  originalValue,
  as: Tag = "span",
  className = "",
  source,
  renderTarget,
  onSave,
  saveStatus,
  onRetry,
  onRestore,
  disabled = false,
}: EditableNodeProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(formatValue(value, type));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // 从 context 获取编辑能力（实质性内容自动路由用）
  // 在 Provider 外使用时为 null，此时只能使用 onSave
  const editor = useOptionalDocumentEditor();

  // 同步外部 value 变化（非编辑状态时）
  useEffect(() => {
    if (!editing) {
      setLocalValue(formatValue(value, type));
    }
  }, [value, type, editing]);

  // 自动聚焦
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === "text") {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  // ── 校验：source 与 onSave 不能同时缺失 ──────────────

  const hasAutoRoute = !!source && !!renderTarget;
  // 开发环境校验
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      if (!hasAutoRoute && !onSave) {
        console.warn(
          `[EditableNode] 节点 "${nodeId}" 既没有 source+renderTarget（实质性内容）也没有 onSave（展示层内容），编辑将无法保存。`
        );
      }
      if (source && onSave) {
        console.warn(
          `[EditableNode] 节点 "${nodeId}" 同时提供了 source 和 onSave。source 优先，onSave 将被忽略。如需展示层保存，请移除 source。`
        );
      }
    }
  }, [nodeId, hasAutoRoute, onSave, source]);

  // ── 保存 ─────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const trimmed = localValue.trim();
    if (trimmed === formatValue(value, type).trim()) {
      setEditing(false);
      return;
    }
    setEditing(false);

    if (hasAutoRoute && editor) {
      await editor.applyMutation(
        {
          nodeId,
          type: "update",
          fieldPath: source!.fieldPath,
          newValue: trimmed,
          previousValue: value,
          stage: source!.stage,
        },
        renderTarget!,
      );
    } else if (hasAutoRoute && !editor && onSave) {
      await onSave(trimmed);
    } else if (onSave) {
      await onSave(trimmed);
    }
  }, [localValue, value, type, hasAutoRoute, source, renderTarget, onSave, editor, nodeId]);

  // ── 取消 ─────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    setLocalValue(formatValue(value, type));
    setEditing(false);
  }, [value, type]);

  // ── 重试 ─────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else if (hasAutoRoute && editor) {
      editor.retryMutation(nodeId);
    }
  }, [onRetry, hasAutoRoute, editor, nodeId]);

  // ── 恢复原始值 ───────────────────────────────────────

  const handleRestore = useCallback(() => {
    if (onRestore) {
      onRestore();
    } else if (hasAutoRoute && editor) {
      editor.restoreOriginal(nodeId);
    }
  }, [onRestore, hasAutoRoute, editor, nodeId]);

  // ── 键盘 ─────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && type !== "paragraph") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  // ── 不可编辑 ─────────────────────────────────────────

  if (disabled) {
    return (
      <Tag className={className}>
        {formatDisplay(value, type)}
      </Tag>
    );
  }

  // ── 编辑状态 ─────────────────────────────────────────

  if (editing) {
    const inputClass =
      "text-stone-700 border border-amber-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-300 bg-amber-50/30 text-xs";

    if (type === "paragraph") {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={Math.max(2, localValue.split("\n").length)}
          className={`${inputClass} w-full resize-y leading-relaxed ${className}`}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`${inputClass} ${className}`}
      />
    );
  }

  // ── 展示状态 ─────────────────────────────────────────

  const hasChanged =
    originalValue != null &&
    formatValue(value, type) !== formatValue(originalValue, type);

  const status = saveStatus?.status;
  const displayContent = formatDisplay(value, type);
  const isEmpty = !displayContent;

  return (
    <span className="inline-group relative">
      <Tag
        className={`group/edit cursor-text rounded-sm transition-colors
          hover:bg-amber-50/40 hover:ring-1 hover:ring-amber-200 hover:ring-offset-1
          print:hover:bg-transparent print:hover:ring-0
          ${isEmpty ? "inline-block min-w-[2em]" : ""}
          ${className}`}
        onClick={() => {
          setLocalValue(formatValue(value, type));
          setEditing(true);
        }}
        title="点击编辑"
      >
        {displayContent || " "}
      </Tag>

      {/* ── 保存状态指示器 ────────────────────────── */}
      {status && status !== "idle" && (
        <span className="inline-flex items-center gap-0.5 ml-1 print:hidden">
          {status === "saving" && (
            <span className="text-[10px] text-amber-500 animate-pulse" title="保存中…">
              ⟳
            </span>
          )}
          {status === "saved" && (
            <span className="text-[10px] text-green-500" title="已保存">
              ✓
            </span>
          )}
          {status === "failed" && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] text-red-500" title={saveStatus?.error ?? "保存失败"}>
                ⚠
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                className="text-[10px] text-red-600 hover:text-red-800 underline"
              >
                重试
              </button>
            </span>
          )}
        </span>
      )}

      {/* ── 恢复原始值按钮 ────────────────────────── */}
      {hasChanged && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRestore(); }}
          className="inline-flex items-center ml-1 opacity-0 group-hover/edit:opacity-100 transition-opacity print:hidden"
          title="恢复 AI 原始版本"
        >
          <svg
            className="w-3 h-3 text-stone-400 hover:text-amber-600"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function formatValue(value: any, type: EditableNodeType): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (type === "list-item") return String(value);
  return JSON.stringify(value);
}

function formatDisplay(value: any, type: EditableNodeType): string {
  return formatValue(value, type);
}
