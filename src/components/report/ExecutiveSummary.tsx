"use client";

import type { ExecutiveSummaryData } from "@/lib/report/types";
import EditableNode from "./EditableNode";
import { useDocumentEditor } from "@/lib/editor/useDocumentEditor";

interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData;
  brandName: string;
}

const LABEL_CLASS = "text-xs tracking-[0.1em] uppercase text-stone-400 font-medium";
const BODY_CLASS = "text-xs text-stone-700 leading-relaxed";

function SummarySection({
  number,
  label,
  labelPath,
  text,
  textPath,
}: {
  number: string;
  label: string;
  labelPath: string;
  text: string;
  textPath: string;
}) {
  const { applyMutation, nodeStatus } = useDocumentEditor();

  const mkSave = (nodeId: string, path: string) =>
    async (newValue: any) => {
      await applyMutation(
        { type: "update", fieldPath: path, newValue, stage: 0 },
        { sectionPath: path },
      );
    };

  return (
    <div className="border-t border-stone-100 pt-5">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[10px] text-stone-300 font-medium tabular-nums">{number}</span>
        <dt className={LABEL_CLASS}>{label}</dt>
      </div>
      <dd className={BODY_CLASS}>
        <EditableNode
          nodeId={textPath}
          type="paragraph"
          value={text || "—"}
          as="span"
          onSave={mkSave(textPath, textPath)}
          saveStatus={nodeStatus[textPath]}
        />
      </dd>
    </div>
  );
}

export default function ExecutiveSummary({ data, brandName }: ExecutiveSummaryProps) {
  return (
    <section className="py-12 print:py-8 page-break-before">
      <p className="text-7xl font-bold text-stone-200 select-none" aria-hidden>00</p>
      <h2 className="text-2xl font-semibold text-stone-900 mt-2">
        执行摘要
      </h2>
      <hr className="mt-10 mb-14 border-stone-200" />
      <dl className="space-y-1 max-w-2xl">
        <SummarySection number="01" label="品牌定位"
          labelPath="executiveSummary.brandPositioning.label"
          text={data.brandPositioning.text}
          textPath="executiveSummary.brandPositioning.text"
        />
        <SummarySection number="02" label="目标用户"
          labelPath="executiveSummary.targetAudience.label"
          text={data.targetAudience.text}
          textPath="executiveSummary.targetAudience.text"
        />
        <SummarySection number="03" label="品牌核心价值"
          labelPath="executiveSummary.coreValue.label"
          text={data.coreValue.text}
          textPath="executiveSummary.coreValue.text"
        />
        <SummarySection number="04" label="品牌差异化"
          labelPath="executiveSummary.differentiation.label"
          text={data.differentiation.text}
          textPath="executiveSummary.differentiation.text"
        />
        <SummarySection number="05" label="战略方向"
          labelPath="executiveSummary.strategicDirection.label"
          text={data.strategicDirection.text}
          textPath="executiveSummary.strategicDirection.text"
        />
      </dl>
    </section>
  );
}
