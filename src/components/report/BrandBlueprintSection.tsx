"use client";

import type { BlueprintData } from "@/lib/report/types";
import EditableNode from "./EditableNode";
import { useDocumentEditor } from "@/lib/editor/useDocumentEditor";

interface BrandBlueprintSectionProps {
  data: BlueprintData;
  brandName: string;
  generatedAt: string;
}

const LABEL_CLASS = "text-xs tracking-[0.1em] uppercase text-stone-400 font-medium";
const ZH_BODY = "text-xs text-stone-700 leading-relaxed";

const ELEMENTS: Array<{ label: string; key: keyof BlueprintData }> = [
  { label: "品牌本质", key: "brandEssence" },
  { label: "品牌使命", key: "brandMission" },
  { label: "品牌定位", key: "brandPositioning" },
  { label: "品牌承诺", key: "brandPromise" },
  { label: "品牌人格", key: "brandPersonality" },
  { label: "视觉方向", key: "visualDirection" },
];

export default function BrandBlueprintSection({
  data,
  brandName,
  generatedAt,
}: BrandBlueprintSectionProps) {
  const { applyMutation, nodeStatus } = useDocumentEditor();

  const dateStr = new Date(generatedAt).toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const mkSave = (nodeId: string, path: string) =>
    async (newValue: any) => {
      await applyMutation(
        { type: "update", fieldPath: path, newValue, stage: 0 },
        { sectionPath: path },
      );
    };

  return (
    <section className="py-20 print:py-12 print:page-break-before-always">
      <p className="text-7xl font-bold text-stone-200 select-none print:text-6xl" aria-hidden>BP</p>

      <h2 className="text-2xl font-semibold text-stone-900 mt-1">品牌蓝图</h2>
      <p className="text-xs text-stone-500 mt-1.5">Brand Blueprint</p>

      <hr className="mt-10 mb-14 border-stone-200" />

      <div className="space-y-8 max-w-2xl">
        {ELEMENTS.map((el) => {
          const valueNodeId = `blueprint.${el.key}`;
          return (
            <div key={el.key}>
              <p className={LABEL_CLASS}>{el.label}</p>
              <p className={`${ZH_BODY} mt-1.5`}>
                <EditableNode nodeId={valueNodeId} type="paragraph" value={data[el.key] || "—"} as="span"
                  onSave={mkSave(valueNodeId, valueNodeId)}
                  saveStatus={nodeStatus[valueNodeId]}
                />
              </p>
            </div>
          );
        })}
      </div>

      <footer className="mt-16 pt-6 border-t border-stone-200">
        <p className="text-xs text-stone-400">
          {brandName}{" · "}品牌策略报告{" · "}{dateStr}
        </p>
        <p className="text-[10px] text-stone-300 mt-1">
          AI Brand OS 生成 · 数据来源：创始人访谈 + 博查联网检索 + AI 策略分析
        </p>
      </footer>
    </section>
  );
}
