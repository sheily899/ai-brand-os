"use client";

import type { CoverData } from "@/lib/report/types";
import EditableNode from "./EditableNode";
import { useDocumentEditor } from "@/lib/editor/useDocumentEditor";

interface CoverSectionProps {
  cover: CoverData;
}

export default function CoverSection({ cover }: CoverSectionProps) {
  const { applyMutation, nodeStatus } = useDocumentEditor();

  const dateStr = new Date(cover.generatedAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const mkSave = (nodeId: string, sectionPath: string) =>
    async (newValue: any) => {
      await applyMutation(
        { type: "update", fieldPath: sectionPath, newValue, stage: 0 },
        { sectionPath },
      );
    };

  return (
    <section className="min-h-[85vh] flex flex-col items-center justify-center bg-white print:bg-white">
      <div className="text-center space-y-6">
        {/* 品牌名称 */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-stone-900 tracking-tight">
          <EditableNode
            nodeId="cover.brandName"
            type="text"
            value={cover.brandName}
            as="span"
            onSave={mkSave("cover.brandName", "cover.brandName")}
            saveStatus={nodeStatus["cover.brandName"]}
          />
        </h1>

        {/* 分隔线 */}
        <div className="flex justify-center">
          <div className="w-16 h-px bg-stone-300" />
        </div>

        {/* 报告标题 */}
        <div className="space-y-2">
          <p className="text-lg text-stone-600 font-medium">品牌策略报告</p>
          <p className="text-sm text-stone-400 uppercase tracking-widest">Brand Strategy Report</p>
        </div>

        {/* 日期 */}
        <p className="text-xs text-stone-400">{dateStr}</p>

        {/* 机密标记 */}
        <div className="pt-12">
          <span className="text-xs text-stone-300 uppercase tracking-[0.2em] border border-stone-200 px-4 py-2 rounded">
            CONFIDENTIAL · 内部资料
          </span>
        </div>
      </div>
    </section>
  );
}
