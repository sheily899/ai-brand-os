"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReportChapter, ReportBlock } from "@/lib/report/types";
import { ReportBlockRenderer } from "./ReportBlockRenderer";
import EditableNode from "./EditableNode";
import { useDocumentEditor } from "@/lib/editor/useDocumentEditor";

interface ChapterSectionProps {
  chapter: ReportChapter;
  onBlockReorder?: (chapterNumber: number, blockTitles: string[]) => void;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}

export default function ChapterSection({
  chapter,
  onBlockReorder,
  onColumnReorder,
  onRowReorder,
}: ChapterSectionProps) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const numStr = String(chapter.number).padStart(2, "0");

  // ── 拖拽状态 ──────────────────────────────────────
  const [localBlocks, setLocalBlocks] = useState<ReportBlock[]>(chapter.blocks);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  // ── 同步 props → localBlocks（保留用户拖拽顺序，更新内容）──
  const prevContentHash = useRef("");
  useEffect(() => {
    // 用 ID + 数据指纹检测变化（ID 增删 OR 内容变动都会触发）
    const hash = chapter.blocks
      .map((b) => `${b.id}:${JSON.stringify(b).length}`)
      .join("|");
    if (hash === prevContentHash.current) return;
    prevContentHash.current = hash;

    // 用 props 数据更新，但保持 localBlocks 中的用户自定义顺序
    const propMap = new Map(chapter.blocks.map((b) => [b.id, b]));
    const localIds = new Set(localBlocks.map((b) => b.id));
    const propIds = new Set(chapter.blocks.map((b) => b.id));

    if (localIds.size !== propIds.size || [...localIds].some((id) => !propIds.has(id))) {
      // ID 集合变了（新增/删除 block）→ 重建列表
      const updated = chapter.blocks.map((b) => {
        const localIdx = localBlocks.findIndex((lb) => lb.id === b.id);
        return localIdx !== -1 ? propMap.get(b.id)! : b;
      });
      setLocalBlocks(updated);
    } else {
      // ID 相同，内容变化 → 保持顺序，替换数据
      const updated = localBlocks.map((lb) => propMap.get(lb.id) ?? lb);
      setLocalBlocks(updated);
    }
  }, [chapter.blocks, localBlocks]);

  // ── 拖拽事件 ──────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(idx);
  }, []);

  const handleDragLeave = useCallback(() => { setDropTarget(null); }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragIdx(null);
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIdx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDropTarget(null); return; }
      const newBlocks = [...localBlocks];
      const [moved] = newBlocks.splice(dragIdx, 1);
      newBlocks.splice(dropIdx, 0, moved);
      setLocalBlocks(newBlocks);
      setDragIdx(null);
      setDropTarget(null);
      if (onBlockReorder) {
        onBlockReorder(chapter.number, newBlocks.map((b) => b.title).filter((t): t is string => !!t));
      }
    },
    [dragIdx, localBlocks, chapter.number, onBlockReorder]
  );

  const canDrag = !!onBlockReorder && localBlocks.length > 1;

  const mkSave = (nodeId: string, path: string) =>
    async (newValue: any) => {
      await applyMutation(
        { type: "update", fieldPath: path, newValue, stage: 0 },
        { sectionPath: path },
      );
    };

  const titleNodeId = `chapter.${chapter.number}.title`;
  const subtitleNodeId = `chapter.${chapter.number}.subtitle`;

  return (
    <section className="py-20 print:py-12 print:page-break-before-always">
      <p className="text-7xl font-bold text-stone-200 select-none print:text-6xl" aria-hidden>{numStr}</p>

      <h2 className="text-2xl font-semibold text-stone-900 mt-1">
        <EditableNode
          nodeId={titleNodeId}
          type="text"
          value={chapter.title}
          as="span"
          onSave={mkSave(titleNodeId, titleNodeId)}
          saveStatus={nodeStatus[titleNodeId]}
        />
      </h2>

      <p className="text-sm text-stone-500 mt-1.5">
        <EditableNode
          nodeId={subtitleNodeId}
          type="text"
          value={chapter.subtitle}
          as="span"
          onSave={mkSave(subtitleNodeId, subtitleNodeId)}
          saveStatus={nodeStatus[subtitleNodeId]}
        />
      </p>

      <hr className="mt-10 mb-14 border-stone-200 print:mt-8 print:mb-10" />

      <div className="space-y-10 print:space-y-8">
        {localBlocks.map((block, i) => (
          <div
            key={block.id}
            draggable={canDrag}
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, i)}
            className={`relative group/block rounded-lg transition-all ${
              dropTarget === i && dragIdx !== i ? "border-t-2 border-amber-400 pt-2 -mt-2" : ""
            }`}
          >
            {canDrag && (
              <div
                className="absolute -left-7 top-2 hidden lg:flex items-center print:hidden
                  opacity-0 group-hover/block:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, i); }}
                onDragEnd={handleDragEnd}
              >
                <DragHandle />
              </div>
            )}

            <ReportBlockRenderer
              block={block}
              onColumnReorder={onColumnReorder}
              onRowReorder={onRowReorder}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function DragHandle() {
  return (
    <svg className="w-4 h-4 text-stone-300 hover:text-stone-400" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" />
      <circle cx="9" cy="13" r="1.5" /><circle cx="15" cy="13" r="1.5" />
    </svg>
  );
}
