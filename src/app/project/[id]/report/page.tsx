"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import ReportToolbar from "@/components/report/ReportToolbar";
import CoverSection from "@/components/report/CoverSection";
import ExecutiveSummary from "@/components/report/ExecutiveSummary";
import ChapterSection from "@/components/report/ChapterSection";
import BrandBlueprintSection from "@/components/report/BrandBlueprintSection";
import QualityBanner from "@/components/report/QualityBanner";
import IncompleteWarning from "@/components/report/IncompleteWarning";
import { DocumentEditorProvider, useDocumentEditor } from "@/lib/editor/useDocumentEditor";
import type {
  ReportContent,
  FinalAuditResult,
  ReportAuditResult,
  ReportCustomization,
} from "@/lib/report/types";
import type { QualityCheckResult } from "@/lib/report/quality";

interface ReportData {
  report: ReportContent | null;
  audit: FinalAuditResult | null;
  quality: QualityCheckResult | null;
  reportAudit?: ReportAuditResult | null;
  suspended: boolean;
  suspendReason?: string;
  stagesReady: number;
  brandName: string;
  category?: string;
  completedStages?: number[];
  activeStage?: number;
  customization?: ReportCustomization | null;
  stageVersions?: Record<number, number>;
}

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 自定义状态（block 排序、列排序）────────────────

  const [customization, setCustomization] = useState<ReportCustomization>({
    blockOrder: {},
    columnOrder: {},
    rowOrder: {},
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 加载报告 ──────────────────────────────────────

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/project/${projectId}/report`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.customization) {
          setCustomization(json.customization);
        }
      } else {
        const err = await res.json();
        setError(err.error ?? "加载报告失败");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ── 持久化 customization（防抖 500ms）──────────────

  const saveCustomization = useCallback(
    (updated: ReportCustomization) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/project/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save-customization",
              customization: updated,
            }),
          });
        } catch {
          // 静默失败，下次加载恢复
        }
      }, 500);
    },
    [projectId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // ── Block 排序 ────────────────────────────────────

  const handleBlockReorder = useCallback(
    (chapterNumber: number, blockTitles: string[]) => {
      setCustomization((prev) => {
        const updated: ReportCustomization = {
          ...prev,
          blockOrder: { ...prev.blockOrder, [chapterNumber]: blockTitles },
        };
        saveCustomization(updated);
        return updated;
      });
    },
    [saveCustomization]
  );

  // ── 列排序 ────────────────────────────────────────

  const handleColumnReorder = useCallback(
    (blockId: string, columnKeys: string[]) => {
      setCustomization((prev) => {
        const updated: ReportCustomization = {
          ...prev,
          columnOrder: { ...prev.columnOrder, [blockId]: columnKeys },
        };
        saveCustomization(updated);
        return updated;
      });
    },
    [saveCustomization]
  );

  // ── 行排序 ────────────────────────────────────────

  const handleRowReorder = useCallback(
    (blockId: string, rowKeys: string[]) => {
      setCustomization((prev) => {
        const updated: ReportCustomization = {
          ...prev,
          rowOrder: { ...prev.rowOrder, [blockId]: rowKeys },
        };
        saveCustomization(updated);
        return updated;
      });
    },
    [saveCustomization]
  );

  // ── 渲染：加载中 ──────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-stone-400 text-sm">加载报告中…</div>
      </div>
    );
  }

  // ── 渲染：错误 ────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={loadReport} className="text-sm text-stone-600 hover:underline">重试</button>
        </div>
      </div>
    );
  }

  const report = data?.report;
  const stagesReady = data?.stagesReady ?? 0;
  const brandName = data?.brandName ?? "品牌战略报告";
  const completedStages = data?.completedStages ?? [];
  const activeStage = data?.activeStage;

  // ── 渲染：无数据 ──────────────────────────────────

  if (!report) {
    return (
      <div className="min-h-screen bg-white">
        <ReportToolbar
          projectId={projectId}
          brandName={brandName}
          completedStages={completedStages}
          activeStage={activeStage}
        />
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-4">
            <p className="text-stone-400 text-lg">📄</p>
            <p className="text-sm text-stone-500">
              {stagesReady === 0
                ? "尚未有完成的阶段，无法生成报告"
                : `已完成 ${stagesReady}/8 阶段，继续推进以生成完整报告`}
            </p>
            {data?.suspended && data.suspendReason && (
              <p className="text-xs text-red-500">{data.suspendReason}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 渲染：完整报告（DocumentEditorProvider 包裹）────

  return (
    <DocumentEditorProvider
      projectId={projectId}
      initialReport={report}
      initialVersions={data?.stageVersions ?? {}}
    >
      <div className="min-h-screen bg-white print:bg-white">
        {/* 顶部工具栏（打印时隐藏） */}
        <ReportToolbar
          projectId={projectId}
          brandName={brandName}
          completedStages={completedStages}
          activeStage={activeStage}
        />

        <ReportContent
          brandName={brandName}
          stagesReady={stagesReady}
          projectId={projectId}
          reportAudit={data?.reportAudit ?? null}
          suspended={data?.suspended ?? false}
          suspendReason={data?.suspendReason}
          audit={data?.audit ?? null}
          onBlockReorder={handleBlockReorder}
          onColumnReorder={handleColumnReorder}
          onRowReorder={handleRowReorder}
        />
      </div>
    </DocumentEditorProvider>
  );
}

/**
 * ReportContent — 报告主体内容。
 *
 * 必须在 DocumentEditorProvider 内部渲染，通过 useDocumentEditor().report
 * 获取实时数据。这样乐观更新后的变更会立即反映在 UI 上，无需刷新。
 */
function ReportContent({
  brandName,
  stagesReady,
  projectId,
  reportAudit,
  suspended,
  suspendReason,
  audit,
  onBlockReorder,
  onColumnReorder,
  onRowReorder,
}: {
  brandName: string;
  stagesReady: number;
  projectId: string;
  reportAudit: ReportAuditResult | null;
  suspended: boolean;
  suspendReason?: string;
  audit: FinalAuditResult | null;
  onBlockReorder: (chapterNumber: number, blockTitles: string[]) => void;
  onColumnReorder: (blockId: string, columnKeys: string[]) => void;
  onRowReorder: (blockId: string, rowKeys: string[]) => void;
}) {
  const { report } = useDocumentEditor();

  return (
    <main className="max-w-4xl mx-auto px-6 print:max-w-none print:w-full print:px-8">
      {/* 质量审核横幅 */}
      {reportAudit && !reportAudit.passed && (
        <div className="mt-6">
          <QualityBanner audit={reportAudit} />
        </div>
      )}

      {/* 未完成警告横幅 */}
      {stagesReady < 8 && (
        <div className="mt-6">
          <IncompleteWarning stagesReady={stagesReady} projectId={projectId} />
        </div>
      )}

      {/* 组装暂停提示 */}
      {suspended && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mt-6 print:hidden">
          <h3 className="text-sm font-medium text-red-800 mb-1">报告组装已暂停</h3>
          <p className="text-xs text-red-600">{suspendReason}</p>
          {audit?.issues && audit.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {audit.issues
                .filter((i) => i.severity === "error")
                .map((issue, i) => (
                  <li key={i} className="text-xs text-red-700">
                    S{issue.stage} · {issue.field}: {issue.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 封面 ── */}
      <CoverSection cover={report.cover} />

      {/* ── 执行摘要 ── */}
      <ExecutiveSummary data={report.executiveSummary} brandName={brandName} />

      {/* ── 七章正文 ── */}
      {report.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.number}
          chapter={chapter}
          onBlockReorder={onBlockReorder}
          onColumnReorder={onColumnReorder}
          onRowReorder={onRowReorder}
        />
      ))}

      {/* ── 品牌蓝图 ── */}
      <BrandBlueprintSection
        data={report.blueprint}
        brandName={brandName}
        generatedAt={report.generatedAt}
      />
    </main>
  );
}
