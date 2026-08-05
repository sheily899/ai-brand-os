/**
 * DocumentEditorContext — 报告文档编辑的统一状态管理
 *
 * 提供：
 * - applyMutation(): 统一编辑入口，乐观更新 + API 保存
 * - nodeStatus: 每个节点的保存状态（idle/saving/saved/failed）
 * - restoreOriginal(): 恢复 AI 原始值
 * - retryMutation(): 重试失败的保存
 *
 * 替代旧的 useReportOverrides + EditPanel 双系统。
 */
"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type {
  Mutation,
  RenderTarget,
  NodeSaveState,
  SaveStatus,
  MutationResult,
} from "./types";
import type { ReportContent } from "@/lib/report/types";

// ── Context Shape ──────────────────────────────────────────

interface DocumentEditorContextValue {
  /** 当前报告数据（乐观更新后的最新状态） */
  report: ReportContent;
  /** 各阶段版本号（乐观锁） */
  stageVersions: Record<number, number>;
  /** 节点保存状态 */
  nodeStatus: Record<string, NodeSaveState>;
  /** 应用一次编辑操作 */
  applyMutation: (mutation: Mutation, target: RenderTarget) => Promise<void>;
  /** 恢复 AI 原始值 */
  restoreOriginal: (nodeId: string) => void;
  /** 重试失败的保存 */
  retryMutation: (nodeId: string) => void;
  /** 替换整个报告（初始化时用） */
  setReportData: (report: ReportContent, versions: Record<number, number>) => void;
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(null);

// ── Provider Props ─────────────────────────────────────────

interface DocumentEditorProviderProps {
  projectId: string;
  initialReport: ReportContent;
  initialVersions: Record<number, number>;
  children: React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * 在 report 树中按 RenderTarget 定位并更新值。
 * 返回新 report（structuredClone），不修改原对象。
 */
function applyOptimisticUpdate(
  report: ReportContent,
  target: RenderTarget,
  newValue: any,
): ReportContent {
  const clone = structuredClone(report);

  if (target.sectionPath) {
    // 处理 chapter.{n}.{field} → chapters[n-1].{field}
    const chMatch = target.sectionPath.match(/^chapter\.(\d+)\.(.+)$/);
    if (chMatch) {
      const chNum = parseInt(chMatch[1], 10);
      const field = chMatch[2];
      const chapter = clone.chapters.find((c) => c.number === chNum);
      if (chapter) {
        setByPath(chapter as any, field, newValue);
      }
      return clone;
    }
    // 其他 sectionPath：cover.*, executiveSummary.*, blueprint.* 直接写
    setByPath(clone as any, target.sectionPath, newValue);
    return clone;
  }

  if (target.blockId) {
    for (const chapter of clone.chapters) {
      for (const block of chapter.blocks) {
        if (block.id === target.blockId) {
          if (target.itemPath) {
            // 防护：如果 newValue 是标量但目标是数组/对象，说明 itemPath 太粗糙，跳过避免数据损坏
            const existing = getByPath(block, target.itemPath);
            if (typeof newValue === "string" && (Array.isArray(existing) || (existing && typeof existing === "object" && !Array.isArray(existing)))) {
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  `[DocumentEditor] 乐观更新跳过：itemPath "${target.itemPath}" 指向数组/对象，但 newValue 是字符串。请使用精确路径（如 rows[0].cells.positioning）。`
                );
              }
              return clone; // 跳过乐观更新，仅靠后端保存
            }
            setByPath(block as any, target.itemPath, newValue);
          }
          return clone;
        }
      }
    }
  }

  return clone;
}

/**
 * 按路径设置嵌套对象的值。
 * 支持 "foo.bar", "items[2].title", "rows[0].cells.positioning"
 */
function setByPath(obj: any, path: string, value: any): void {
  const parts = parsePath(path);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const { key, index } = parts[i];
    if (index !== undefined) {
      if (!Array.isArray(current[key])) current[key] = [];
      current = current[key][index];
    } else {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
  }
  const last = parts[parts.length - 1];
  if (last.index !== undefined) {
    if (!Array.isArray(current[last.key])) current[last.key] = [];
    current[last.key][last.index] = value;
  } else {
    current[last.key] = value;
  }
}

/**
 * 解析路径 "items[2].title" → [{key:"items",index:2}, {key:"title"}]
 */
function parsePath(path: string): Array<{ key: string; index?: number }> {
  const segments = path.split(".");
  return segments.map((seg) => {
    const m = seg.match(/^(\w+)\[(\d+)\]$/);
    if (m) return { key: m[1], index: parseInt(m[2], 10) };
    return { key: seg };
  });
}

/**
 * 从 report 中按 RenderTarget 读取值（用于 rollback）
 */
function getByTarget(report: ReportContent, target: RenderTarget): any {
  if (target.sectionPath) {
    return getByPath(report, target.sectionPath);
  }
  if (target.blockId) {
    for (const chapter of report.chapters) {
      for (const block of chapter.blocks) {
        if (block.id === target.blockId) {
          if (target.itemPath) {
            return getByPath(block, target.itemPath);
          }
        }
      }
    }
  }
  return undefined;
}

function getByPath(obj: any, path: string): any {
  const parts = parsePath(path);
  let current = obj;
  for (const { key, index } of parts) {
    if (current == null) return undefined;
    if (index !== undefined) {
      current = Array.isArray(current[key]) ? current[key][index] : undefined;
    } else {
      current = current[key];
    }
  }
  return current;
}

// ── Provider ───────────────────────────────────────────────

export function DocumentEditorProvider({
  projectId,
  initialReport,
  initialVersions,
  children,
}: DocumentEditorProviderProps) {
  const [report, setReport] = useState<ReportContent>(initialReport);
  const [stageVersions, setStageVersions] = useState<Record<number, number>>(initialVersions);
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeSaveState>>({});

  // 保存待重试的 mutation（nodeId → { mutation, target }）
  const pendingRetry = useRef<Map<string, { mutation: Mutation; target: RenderTarget }>>(new Map());

  // 保存用于 rollback 的旧值（nodeId → oldValue）
  const rollbackValues = useRef<Map<string, any>>(new Map());

  // ── 状态辅助 ─────────────────────────────────────────

  const setNodeState = useCallback((nodeId: string, status: SaveStatus, error?: string) => {
    setNodeStatus((prev) => ({ ...prev, [nodeId]: { status, error } }));
  }, []);

  // ── 核心：applyMutation ──────────────────────────────

  const applyMutation = useCallback(
    async (mutation: Mutation, target: RenderTarget) => {
      const nodeId = mutation.nodeId ?? `${target.blockId ?? "section"}:${target.itemPath ?? target.sectionPath ?? "unknown"}`;
      if (!nodeId) {
        console.error("[DocumentEditor] mutation 缺少 nodeId");
        return;
      }

      // 保存旧值用于 rollback
      const oldValue = getByTarget(report, target);
      rollbackValues.current.set(nodeId, oldValue);

      // 1. Optimistic 更新
      setNodeState(nodeId, "saving");
      const newReport = applyOptimisticUpdate(report, target, mutation.newValue);
      setReport(newReport);

      try {
        // ── 路由前校验 ─────────────────────────────────
        if (process.env.NODE_ENV === "development") {
          const hasStage = mutation.stage && mutation.stage >= 1 && mutation.stage <= 8;
          const pathIsSuspicious =
            mutation.fieldPath.startsWith("__") ||
            mutation.fieldPath.includes("blueprint.") ||
            mutation.fieldPath.includes("cover.") ||
            mutation.fieldPath.includes("executiveSummary.");
          const pathLooksSubstantive =
            /^[a-z]+(\.[a-zA-Z]+)*(\[\d+\])?(\.[a-zA-Z]+)*$/.test(mutation.fieldPath) &&
            !pathIsSuspicious;

          if (hasStage && pathIsSuspicious) {
            console.warn(
              `[DocumentEditor] ⚠ 实质性内容（stage=${mutation.stage}）的 fieldPath 看起来像展示层路径: "${mutation.fieldPath}"。可能误将展示内容写入了版本链。`,
            );
          }
          if (!hasStage && pathLooksSubstantive && mutation.fieldPath.includes(".")) {
            console.warn(
              `[DocumentEditor] ⚠ 展示层保存（stage=0）的 fieldPath 看起来像实质性数据路径: "${mutation.fieldPath}"。可能绕过了版本管理。`,
            );
          }
        }

        // 2. 调用 API
        let result: MutationResult;

        if (mutation.stage && mutation.stage >= 1 && mutation.stage <= 8) {
          // 有 stage 来源 → 走 recordFieldEdit
          const clientVersion = stageVersions[mutation.stage] ?? 1;
          const res = await fetch(
            `/api/project/${projectId}/stage/${mutation.stage}/edit`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fieldPath: mutation.fieldPath,
                newValue: mutation.newValue,
                previousValue: mutation.previousValue ?? oldValue,
                clientVersion,
              }),
            },
          );

          if (res.status === 409) {
            result = { success: false, conflict: true };
          } else if (!res.ok) {
            const err = await res.json();
            result = { success: false, error: err.error ?? "保存失败" };
          } else {
            const json = await res.json();
            result = { success: true, newVersion: json.newVersion };
          }
        } else {
          // 装饰性内容 → 存到 context（临时：后续迁移到统一版本模型）
          const res = await fetch(`/api/project/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save-report-override",
              path: target.sectionPath ?? `${target.blockId}.${target.itemPath}`,
              text: typeof mutation.newValue === "string" ? mutation.newValue : JSON.stringify(mutation.newValue),
            }),
          });
          result = res.ok ? { success: true } : { success: false, error: "保存失败" };
        }

        // 3. 处理结果
        if (result.success) {
          setNodeState(nodeId, "saved");
          pendingRetry.current.delete(nodeId);
          rollbackValues.current.delete(nodeId);

          // 更新版本号
          if (result.newVersion && mutation.stage) {
            setStageVersions((prev) => ({ ...prev, [mutation.stage!]: result.newVersion! }));
          }

          // 3 秒后回到 idle
          setTimeout(() => {
            setNodeStatus((prev) => {
              const s = prev[nodeId];
              if (s?.status === "saved") {
                return { ...prev, [nodeId]: { status: "idle" } };
              }
              return prev;
            });
          }, 3000);
        } else if (result.conflict) {
          // 冲突
          setNodeState(nodeId, "failed", "数据已被其他操作修改，请刷新页面");
        } else {
          // 失败 → rollback
          setReport((prev) => applyOptimisticUpdate(prev, target, oldValue));
          setNodeState(nodeId, "failed", result.error ?? "保存失败");
          // 保留 mutation 用于重试
          pendingRetry.current.set(nodeId, { mutation, target });
        }
      } catch (e: any) {
        // 网络失败 → rollback
        console.error("[applyMutation] 网络异常，回滚", { nodeId, error: e.message });
        setNodeState(nodeId, "failed", e.message ?? "网络错误");
        pendingRetry.current.set(nodeId, { mutation, target });
      }
    },
    [report, stageVersions, projectId, setNodeState],
  );

  // ── 恢复原始值 ───────────────────────────────────────

  const restoreOriginal = useCallback(
    (nodeId: string) => {
      // 清除保存状态
      setNodeStatus((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
      pendingRetry.current.delete(nodeId);
      rollbackValues.current.delete(nodeId);
      // 注意：实际的数据恢复由调用方提供 originalValue
    },
    [],
  );

  // ── 重试 ─────────────────────────────────────────────

  const retryMutation = useCallback(
    (nodeId: string) => {
      const pending = pendingRetry.current.get(nodeId);
      if (pending) {
        applyMutation(pending.mutation, pending.target);
      }
    },
    [applyMutation],
  );

  // ── 初始化/替换报告 ──────────────────────────────────

  const setReportData = useCallback(
    (newReport: ReportContent, newVersions: Record<number, number>) => {
      setReport(newReport);
      setStageVersions(newVersions);
      setNodeStatus({});
      pendingRetry.current.clear();
      rollbackValues.current.clear();
    },
    [],
  );

  // ── Context Value ────────────────────────────────────

  const value: DocumentEditorContextValue = {
    report,
    stageVersions,
    nodeStatus,
    applyMutation,
    restoreOriginal,
    retryMutation,
    setReportData,
  };

  return (
    <DocumentEditorContext.Provider value={value}>
      {children}
    </DocumentEditorContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────

export function useDocumentEditor(): DocumentEditorContextValue {
  const ctx = useContext(DocumentEditorContext);
  if (!ctx) {
    throw new Error("useDocumentEditor 必须在 DocumentEditorProvider 内使用");
  }
  return ctx;
}

/**
 * 安全版本的 useDocumentEditor — 在 Provider 外使用时返回 null 而不是 throw。
 * 供 EditableNode 等可能在 Provider 内外同时使用的组件调用。
 */
export function useOptionalDocumentEditor(): DocumentEditorContextValue | null {
  return useContext(DocumentEditorContext);
}
