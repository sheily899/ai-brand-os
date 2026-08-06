"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { renderMarkdownBlocks, renderInlineMarkdown } from "@/lib/utils/markdown";
import EditableNode from "./EditableNode";
import { useDocumentEditor } from "@/lib/editor/useDocumentEditor";
import type {
  ReportBlock,
  NarrativeBlock,
  CardsBlock,
  TagsBlock,
  ComparisonBlock,
  LandscapeBlock,
  SupplyGapBlock,
  SupplyGapRow,
  MatrixBlock,
  DecisionDimensionBlock,
  SourceBlock,
} from "@/lib/report/types";

// ═══════════════════════════════════════════════════════════
// Block Wrapper — 悬停高亮（无编辑按钮，统一 inline 编辑）
// ═══════════════════════════════════════════════════════════

function BlockWrapper({
  block,
  children,
}: {
  block: ReportBlock;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const hasSourceFields = block.sourceFields && block.sourceFields.length > 0;

  return (
    <div
      className={`relative rounded-lg transition-all ${
        hovered && hasSourceFields ? "ring-1 ring-amber-200 bg-amber-50/10" : ""
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Helper: 从 block 的 sourceFields 解析 stage 编号
// ═══════════════════════════════════════════════════════════

function getStageFromBlock(block: ReportBlock): number {
  const sf = block.sourceFields?.[0];
  if (!sf?.decisionId) return 0;
  const m = sf.decisionId.match(/^s(\d+)_/);
  return m ? parseInt(m[1], 10) : 0;
}

// ═══════════════════════════════════════════════════════════
// 分发器
// ═══════════════════════════════════════════════════════════

export function ReportBlockRenderer({
  block,
  onColumnReorder,
  onRowReorder,
}: {
  block: ReportBlock;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const content = renderBlockContent(block, onColumnReorder, onRowReorder);

  return (
    <BlockWrapper block={block}>
      {content}
    </BlockWrapper>
  );
}

function renderBlockContent(
  block: ReportBlock,
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void,
  onRowReorder?: (blockId: string, rowKeys: string[]) => void,
) {
  switch (block.type) {
    case "narrative":
      return <NarrativeRenderer block={block} />;
    case "cards":
      return <CardsRenderer block={block} />;
    case "tags":
      return <TagsRenderer block={block} />;
    case "comparison":
      return <ComparisonRenderer block={block} onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} />;
    case "landscape":
      return <LandscapeRenderer block={block} onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} />;
    case "supplyGap":
      return <SupplyGapRenderer block={block} onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} />;
    case "matrix":
      return <MatrixRenderer block={block} onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} />;
    case "decisionDimension":
      return <DecisionDimensionRenderer block={block} onRowReorder={onRowReorder} />;
    case "source":
      return <SourceRenderer block={block} />;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 1. narrative — 正文段落（内联段落编辑）
// ═══════════════════════════════════════════════════════════

const BLOCK_TITLE = "text-base font-semibold text-stone-800 mb-3 mt-5";

function BlockTitle({ title, blockId }: { title: string; blockId?: string }) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const label = title.startsWith("#### ") ? title.replace(/^####\s*/, "") : title;
  const nodeId = `block.${blockId}.title`;

  return (
    <h4 className={BLOCK_TITLE}>
      <EditableNode
        nodeId={nodeId}
        type="text"
        value={label}
        as="span"
        onSave={async (newValue) => {
          await applyMutation(
            { type: "update", fieldPath: `__title:${blockId}`, newValue, stage: 0 },
            { blockId, itemPath: "title" },
          );
        }}
        saveStatus={nodeStatus[nodeId]}
      />
    </h4>
  );
}

function NarrativeRenderer({ block }: { block: NarrativeBlock }) {
  const { nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const hasSegments = block.segments && block.segments.length > 0;

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      {block.subLabel && (
        <h4 className="text-base font-semibold text-stone-500 mb-2">{block.subLabel}</h4>
      )}
      <div className="flex gap-4">
        {block.pullQuote && (
          <div className="hidden md:block w-1 bg-stone-200 self-stretch rounded shrink-0" />
        )}
        <div className="space-y-3">
          {block.pullQuote && (
            <div
              className="text-lg italic text-stone-500 leading-relaxed border-l-2 border-stone-300 pl-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdownBlocks(block.pullQuote) }}
            />
          )}
          {hasSegments ? (
            block.segments!.map((seg, i) => {
              const nodeId = `${block.id}:seg:${i}`;
              return (
                <p key={i} className="text-xs text-stone-700 leading-relaxed">
                  <EditableNode
                    nodeId={nodeId}
                    type="paragraph"
                    value={seg.text}
                    as="span"
                    source={{ stage, fieldPath: seg.fieldPath }}
                    renderTarget={{ blockId: block.id, itemPath: `segments[${i}].text` }}
                    saveStatus={nodeStatus[nodeId]}
                  />
                </p>
              );
            })
          ) : (
            block.content ? (
              <div
                className="text-xs text-stone-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdownBlocks(block.content) }}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. cards — 卡片网格（内联编辑 title / description）
// ═══════════════════════════════════════════════════════════

function CardsRenderer({ block }: { block: CardsBlock }) {
  const { nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const cols = block.columns ?? 2;
  const srcField = block.sourceFields?.[0];

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div
        className={`grid gap-4 ${
          cols === 1 ? "grid-cols-1"
            : cols === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3"
            : "grid-cols-1 md:grid-cols-2 print:grid-cols-2"
        }`}
      >
        {block.items.map((item, i) => (
          <div key={i} className="border border-stone-200 rounded-lg p-4 bg-white">
            {item.label && (
              <span className="text-xs uppercase tracking-wider text-stone-400 font-medium">
                {item.label}
              </span>
            )}
            {/* 卡片标题 — 可编辑 */}
            {(() => {
              const nodeId = `${block.id}:card:${i}:title`;
              return (
                <h4 className="text-xs font-semibold text-stone-800 mt-1">
                  <EditableNode
                    nodeId={nodeId}
                    type="text"
                    value={item.title}
                    as="span"
                    source={{ stage, fieldPath: `${srcField?.fieldPath ?? "items"}[${i}].title` }}
                    renderTarget={{ blockId: block.id, itemPath: `items[${i}].title` }}
                    saveStatus={nodeStatus[nodeId]}
                  />
                </h4>
              );
            })()}
            {/* 卡片描述 — 可编辑 */}
            {(() => {
              const nodeId = `${block.id}:card:${i}:desc`;
              return (
                <div className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                  <EditableNode
                    nodeId={nodeId}
                    type="paragraph"
                    value={item.description}
                    as="div"
                    source={{ stage, fieldPath: `${srcField?.fieldPath ?? "items"}[${i}].description` }}
                    renderTarget={{ blockId: block.id, itemPath: `items[${i}].description` }}
                    saveStatus={nodeStatus[nodeId]}
                  />
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. tags — 标签组（内联编辑每个 tag）
// ═══════════════════════════════════════════════════════════

function TagsRenderer({ block }: { block: TagsBlock }) {
  const { nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="flex flex-wrap gap-2">
        {block.tags.map((tag, i) => {
          const nodeId = `${block.id}:tag:${i}`;
          return (
            <span
              key={i}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs text-stone-700 bg-stone-100 border border-stone-200"
            >
              <EditableNode
                nodeId={nodeId}
                type="text"
                value={tag}
                as="span"
                source={{ stage, fieldPath: `${srcField?.fieldPath ?? "tags"}[${i}]` }}
                renderTarget={{ blockId: block.id, itemPath: `tags[${i}]` }}
                saveStatus={nodeStatus[nodeId]}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. comparison — 竞品对比表（内联单元格编辑 + 列拖拽）
// ═══════════════════════════════════════════════════════════

function ComparisonRenderer({
  block,
  onColumnReorder,
  onRowReorder,
}: {
  block: ComparisonBlock;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];
  const allColumns = [...block.columns, ...(block.customColumns ?? [])];
  const [columns, setColumns] = useState(allColumns);
  const [colDragIdx, setColDragIdx] = useState<number | null>(null);
  const [colDropTarget, setColDropTarget] = useState<number | null>(null);
  const [localRows, setLocalRows] = useState(block.rows);
  const [rowDragIdx, setRowDragIdx] = useState<number | null>(null);
  const [rowDropTarget, setRowDropTarget] = useState<number | null>(null);

  // Content-aware sync: detect changes even when reference stays same
  const _ch = useRef(0); const _rh = useRef(0);
  useEffect(() => {
    const h = allColumns.length + allColumns.reduce((s: number, c: any, i: number) => s + (c.key ?? "").length * (i + 1), 0);
    if (h !== _ch.current) { _ch.current = h; setColumns(allColumns); }
  }, [block.columns, block.customColumns]);
  useEffect(() => {
    const h = block.rows.length + block.rows.reduce((s: number, r: any, i: number) => s + JSON.stringify(r).length * (i + 1), 0);
    if (h !== _rh.current) { _rh.current = h; setLocalRows(block.rows); }
  }, [block.rows]);
  // ── 行增删 ──────────────────────────────────────────
  const handleAddRow = async () => {
    const emptyCells: Record<string, string> = {};
    for (const col of columns) emptyCells[col.key] = "";
    const emptyRow = { brand: "新品牌", cells: emptyCells };
    const newRows = [...localRows, emptyRow];
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "competitors", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  const handleDeleteRow = async (idx: number) => {
    if (!window.confirm("确定删除这一行？")) return;
    const newRows = localRows.filter((_, i) => i !== idx);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "competitors", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  // ── 列增删 ──────────────────────────────────────────
  const handleAddColumn = async () => {
    const name = window.prompt("请输入新列名称（如「价格带」）");
    if (!name || !name.trim()) return;
    const key = name.trim().replace(/\s+/g, "_").toLowerCase();
    if (columns.find((c: any) => c.key === key)) { alert("该列已存在"); return; }
    const newCol = { key, label: name.trim(), protected: false };
    const newCols = [...columns, newCol];
    const newRows = localRows.map((r: any) => ({ ...r, cells: { ...r.cells, [key]: "" } }));
    setColumns(newCols);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "competitors", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
    onColumnReorder?.(block.id, newCols.map((c: any) => c.key));
  };
  const handleDeleteColumn = async (colKey: string) => {
    const col = columns.find((c: any) => c.key === colKey);
    if (col?.protected) { alert("预设列不可删除"); return; }
    if (!window.confirm(`确定删除列 "${col?.label ?? colKey}"？该列所有数据将丢失。`)) return;
    const newCols = columns.filter((c: any) => c.key !== colKey);
    const newRows = localRows.map((r: any) => {
      const newCells = { ...r.cells };
      delete newCells[colKey];
      return { ...r, cells: newCells };
    });
    setColumns(newCols);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "competitors", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
    onColumnReorder?.(block.id, newCols.map((c: any) => c.key));
  };

  const canDragCols = !!onColumnReorder && columns.length > 1;
  const canDragRows = !!onRowReorder && localRows.length > 1;

  // Column DnD
  const makeColHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setColDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setColDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setColDragIdx(null); setColDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (colDragIdx === null || colDragIdx === idx) { setColDragIdx(null); setColDropTarget(null); return; }
      const nc = [...columns]; const [m] = nc.splice(colDragIdx, 1); nc.splice(idx, 0, m);
      setColumns(nc); setColDragIdx(null); setColDropTarget(null);
      onColumnReorder?.(block.id, nc.map((c) => c.key));
    },
  });

  // Row DnD
  const makeRowHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setRowDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setRowDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setRowDragIdx(null); setRowDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (rowDragIdx === null || rowDragIdx === idx) { setRowDragIdx(null); setRowDropTarget(null); return; }
      const nr = [...localRows]; const [m] = nr.splice(rowDragIdx, 1); nr.splice(idx, 0, m);
      setLocalRows(nr); setRowDragIdx(null); setRowDropTarget(null);
      onRowReorder?.(block.id, nr.map((r) => r.brand));
    },
  });

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse table-fixed`}>
          <thead>
            <tr className="border-b border-stone-300">
              {canDragRows && <th className="w-6 px-0 py-2 print:hidden" />}
              {columns.map((col, ci) => {
                // 第一列（品牌名）固定宽度，其余均分
                const wClass = ci === 0 ? "w-[18%]" : "";
                return (
                <th
                  key={col.key}
                  draggable={canDragCols}
                  {...(canDragCols ? makeColHandlers(ci) : {})}
                  className={`${wClass} text-xs tracking-[0.1em] uppercase text-stone-500 font-medium px-3 py-2 text-left select-none group/col relative ${
                    canDragCols ? "cursor-grab active:cursor-grabbing" : ""
                  } ${colDropTarget === ci && colDragIdx !== ci ? "border-l-2 border-amber-400" : ""}`}
                >
                  {col.label}
                  {!col.protected && (
                    <button
                      onClick={() => handleDeleteColumn(col.key)}
                      className="ml-1 opacity-0 group-hover/col:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-[10px] print:hidden"
                      title="删除列"
                    >
                      ✕
                    </button>
                  )}
                </th>
                );
              })}
              <th className="w-8 px-1 py-2 print:hidden">
                <button
                  onClick={handleAddColumn}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-1.5 py-0.5 transition-colors print:hidden"
                  title="添加列"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, ri) => (
              <tr
                key={row.brand}
                draggable={canDragRows}
                {...(canDragRows ? makeRowHandlers(ri) : {})}
                className={`border-b border-stone-100 group/row transition-all ${
                  rowDropTarget === ri && rowDragIdx !== ri ? "border-t-2 border-amber-400" : ""
                }`}
              >
                {canDragRows && (
                  <td className="px-0 py-2 align-middle print:hidden">
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex justify-center">
                      <RowDragHandle />
                    </div>
                  </td>
                )}
                {columns.map((col) => {
                  const isLabelCol = col.key === "brand";
                  const raw = col.key === "brand" ? row.brand : (row.cells[col.key] ?? "");
                  const nodeId = `${block.id}:cell:${ri}:${col.key}`;
                  // 品牌名列不可编辑
                  if (isLabelCol) {
                    return (
                      <td key={col.key} className={`px-3 py-2 text-xs text-stone-700 font-medium align-top`}
                        dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cleanCellText(raw)) }}
                      />
                    );
                  }
                  const colDef = block.columnDefs?.find((cd) => cd.key === col.key);
                  const fieldPath = colDef?.fieldPath
                    ? colDef.fieldPath.replace("[]", `[${ri}]`)
                    : `${srcField?.fieldPath ?? "competitors"}[${ri}].${col.key}`;
                  return (
                    <td key={col.key} className={`px-3 py-2 text-xs text-stone-700 align-top`}>
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={cleanCellText(raw)}
                        as="span"
                        source={{ stage, fieldPath }}
                        renderTarget={{ blockId: block.id, itemPath: `rows[${ri}].cells.${col.key}` }}
                        saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })}
                <td className="px-0 py-2 align-middle print:hidden">
                  <button
                    onClick={() => handleDeleteRow(ri)}
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-xs px-1"
                    title="删除行"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="print:hidden">
              <td colSpan={columns.length + (canDragRows ? 1 : 0)} className="px-3 py-1">
                <button
                  onClick={handleAddRow}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-3 py-1 transition-colors"
                >
                  + 添加行
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 5. landscape — 竞争方向表格
// ═══════════════════════════════════════════════════════════

function LandscapeRenderer({
  block,
  onColumnReorder,
  onRowReorder,
}: {
  block: LandscapeBlock;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];

  const [columns, setColumns] = useState(block.columns);
  const [localRows, setLocalRows] = useState(block.rows);
  const [colDragIdx, setColDragIdx] = useState<number | null>(null);
  const [colDropTarget, setColDropTarget] = useState<number | null>(null);
  const [rowDragIdx, setRowDragIdx] = useState<number | null>(null);
  const [rowDropTarget, setRowDropTarget] = useState<number | null>(null);

  const _lch = useRef(0); const _lrh = useRef(0);
  useEffect(() => {
    const h = block.columns.length + block.columns.reduce((s: number, c: any, i: number) => s + (c.key ?? "").length * (i + 1), 0);
    if (h !== _lch.current) { _lch.current = h; setColumns(block.columns); }
  }, [block.columns]);
  useEffect(() => {
    const h = block.rows.length + block.rows.reduce((s: number, r: any, i: number) => s + JSON.stringify(r).length * (i + 1), 0);
    if (h !== _lrh.current) { _lrh.current = h; setLocalRows(block.rows); }
  }, [block.rows]);
  // ── 行增删 ──────────────────────────────────────────
  const handleAddRow = async () => {
    const emptyRow = { competitionType: "新竞争类型", representativeBrands: "", coreStrategy: "", consumerNeed: "", extra: {} };
    const newRows = [...localRows, emptyRow];
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  const handleDeleteRow = async (idx: number) => {
    if (!window.confirm("确定删除这一行？")) return;
    const newRows = localRows.filter((_, i) => i !== idx);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  // ── 列增删 ──────────────────────────────────────────
  const handleAddColumn = async () => {
    const name = window.prompt("请输入新列名称（如「价格带」）");
    if (!name || !name.trim()) return;
    const key = name.trim().replace(/\s+/g, "_").toLowerCase();
    if (columns.find((c: any) => c.key === key)) { alert("该列已存在"); return; }
    const newCol = { key, label: name.trim(), protected: false };
    const newCols = [...columns, newCol];
    const newRows = localRows.map((r: any) => {
      const newExtra = { ...(r.extra ?? {}) };
      newExtra[key] = "";
      return { ...r, extra: newExtra };
    });
    setColumns(newCols);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
    onColumnReorder?.(block.id, newCols.map((c: any) => c.key));
  };
  const handleDeleteColumn = async (colKey: string) => {
    const col = columns.find((c: any) => c.key === colKey);
    if (col?.protected) { alert("预设列不可删除"); return; }
    if (!window.confirm(`确定删除列 "${col?.label ?? colKey}"？该列所有数据将丢失。`)) return;
    const newCols = columns.filter((c: any) => c.key !== colKey);
    const newRows = localRows.map((r: any) => {
      const newExtra = { ...(r.extra ?? {}) };
      delete newExtra[colKey];
      return { ...r, extra: newExtra };
    });
    setColumns(newCols);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
    onColumnReorder?.(block.id, newCols.map((c: any) => c.key));
  };

  const canDragCols = !!onColumnReorder && columns.length > 1;
  const canDragRows = !!onRowReorder && localRows.length > 1;

  const makeColHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setColDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setColDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setColDragIdx(null); setColDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (colDragIdx === null || colDragIdx === idx) { setColDragIdx(null); setColDropTarget(null); return; }
      const nc = [...columns]; const [m] = nc.splice(colDragIdx, 1); nc.splice(idx, 0, m);
      setColumns(nc); setColDragIdx(null); setColDropTarget(null);
      onColumnReorder?.(block.id, nc.map((c) => c.key));
    },
  });

  const makeRowHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setRowDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setRowDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setRowDragIdx(null); setRowDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (rowDragIdx === null || rowDragIdx === idx) { setRowDragIdx(null); setRowDropTarget(null); return; }
      const nr = [...localRows]; const [m] = nr.splice(rowDragIdx, 1); nr.splice(idx, 0, m);
      setLocalRows(nr); setRowDragIdx(null); setRowDropTarget(null);
      onRowReorder?.(block.id, nr.map((r) => r.competitionType));
    },
  });

  const fieldMap: Record<string, string> = {
    competitionType: "type",
    representativeBrands: "representativeBrands",
    coreStrategy: "coreStrategy",
    consumerNeed: "consumerNeed",
  };

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse table-fixed`}>
          <thead>
            <tr className="border-b border-stone-300">
              {canDragRows && <th className="w-6 px-0 py-2 print:hidden" />}
              {columns.map((col, ci) => {
                const wClass =
                  col.key === "competitionType" ? "w-[15%]" :
                  col.key === "representativeBrands" ? "w-[20%]" :
                  col.key === "coreStrategy" ? "w-[25%]" :
                  col.key === "consumerNeed" ? "w-[25%]" :
                  "";
                return (
                <th key={col.key} draggable={canDragCols}
                  {...(canDragCols ? makeColHandlers(ci) : {})}
                  className={`${wClass} text-xs tracking-[0.1em] uppercase text-stone-500 font-medium px-3 py-2 text-left select-none group/col relative ${
                    canDragCols ? "cursor-grab active:cursor-grabbing" : ""
                  } ${colDropTarget === ci && colDragIdx !== ci ? "border-l-2 border-amber-400" : ""}`}
                >
                  {col.label}
                  {!col.protected && (
                    <button
                      onClick={() => handleDeleteColumn(col.key)}
                      className="ml-1 opacity-0 group-hover/col:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-[10px] print:hidden"
                      title="删除列"
                    >
                      ✕
                    </button>
                  )}
                </th>
                );
              })}
              <th className="w-8 px-1 py-2 print:hidden">
                <button
                  onClick={handleAddColumn}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-1.5 py-0.5 transition-colors print:hidden"
                  title="添加列"
                >
                  +
                </button>
              </th>
              <th className="w-8 px-0 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, ri) => (
              <tr key={row.competitionType}
                draggable={canDragRows}
                {...(canDragRows ? makeRowHandlers(ri) : {})}
                className={`border-b border-stone-100 group/row transition-all ${
                  rowDropTarget === ri && rowDragIdx !== ri ? "border-t-2 border-amber-400" : ""
                }`}
              >
                {canDragRows && (
                  <td className="px-0 py-2 align-middle print:hidden">
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex justify-center">
                      <RowDragHandle />
                    </div>
                  </td>
                )}
                {columns.map((col) => {
                  const isLabel = col.key === "competitionType";
                  const isStd = col.key in fieldMap;
                  const raw = col.key === "competitionType" ? row.competitionType
                    : col.key === "representativeBrands" ? row.representativeBrands
                    : col.key === "coreStrategy" ? row.coreStrategy
                    : col.key === "consumerNeed" ? row.consumerNeed
                    : row.extra?.[col.key] ?? "";
                  const nodeId = `${block.id}:cell:${ri}:${col.key}`;
                  const colDef = block.columnDefs?.find((cd) => cd.key === col.key);
                  const fieldPath = colDef?.fieldPath
                    ? colDef.fieldPath.replace("[]", `[${ri}]`)
                    : `${srcField?.fieldPath ?? "dimensions"}[${ri}].${fieldMap[col.key] ?? col.key}`;

                  return (
                    <td key={col.key}
                      className={`px-3 py-2 text-xs align-top ${isLabel ? "text-stone-700 font-medium" : "text-stone-700"}`}
                    >
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={cleanCellText(raw)}
                        as="span"
                        source={{ stage, fieldPath }}
                        renderTarget={{ blockId: block.id, itemPath: isStd ? `rows[${ri}].${fieldMap[col.key] ?? col.key}` : `rows[${ri}].extra.${col.key}` }}
                        saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })}
                <td className="px-0 py-2 align-middle print:hidden">
                  <button
                    onClick={() => handleDeleteRow(ri)}
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-xs px-1"
                    title="删除行"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="print:hidden">
              <td colSpan={columns.length + (canDragRows ? 1 : 0)} className="px-3 py-1">
                <button
                  onClick={handleAddRow}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-3 py-1 transition-colors"
                >
                  + 添加行
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 6. supplyGap — 供给缺口表（动态列支持）
// ═══════════════════════════════════════════════════════════

const SUPPLYGAP_DEFAULT_COLS: Array<{ key: string; label: string; protected: boolean; fieldPath?: string }> = [
  { key: "dimension", label: "维度", protected: true },
  { key: "currentMarket", label: "当前市场提供", protected: false },
  { key: "unmetNeed", label: "用户仍未满足", protected: false },
];

function SupplyGapRenderer({
  block,
  onColumnReorder,
  onRowReorder,
}: {
  block: SupplyGapBlock;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];

  const [localRows, setLocalRows] = useState(block.rows);
  const [rowDragIdx, setRowDragIdx] = useState<number | null>(null);
  const [rowDropTarget, setRowDropTarget] = useState<number | null>(null);
  const [colDragIdx, setColDragIdx] = useState<number | null>(null);
  const [colDropTarget, setColDropTarget] = useState<number | null>(null);

  const _srh = useRef(0);
  useEffect(() => {
    const h = block.rows.length + block.rows.reduce((s: number, r: any, i: number) => s + JSON.stringify(r).length * (i + 1), 0);
    if (h !== _srh.current) { _srh.current = h; setLocalRows(block.rows); }
  }, [block.rows]);

  // 从 block.columnDefs 构建基础列（label 优先取 columnDefs，否则用默认值）
  const baseColumns = block.columnDefs?.length
    ? SUPPLYGAP_DEFAULT_COLS.map(d => {
        const override = block.columnDefs!.find(cd => cd.key === d.key);
        return override ? { ...d, label: override.label, protected: override.protected ?? d.protected } : d;
      })
    : SUPPLYGAP_DEFAULT_COLS;
  const baseKeys = new Set(baseColumns.map(c => c.key));

  // 从行数据中检测用户自定义列
  const extraKeys: string[] = [];
  const seen = new Set<string>();
  for (const r of localRows) {
    if (r.extra) {
      for (const k of Object.keys(r.extra)) {
        if (!seen.has(k) && !baseKeys.has(k)) { seen.add(k); extraKeys.push(k); }
      }
    }
  }
  const extraCols = (block.columns ?? [])
    .filter(c => !baseKeys.has(c.key))
    .map(c => ({ key: c.key, label: c.label, protected: false }));
  // Merge: prefer block.columns order, fall back to scanning rows
  const displayExtraCols = extraCols.length > 0
    ? extraCols
    : extraKeys.map(k => ({ key: k, label: k, protected: false }));
  const allColumns = [...baseColumns, ...displayExtraCols];
  const [columns, setColumns] = useState(allColumns);
  const _colVer = useRef(0);
  useEffect(() => {
    // 当 block.columnDefs、block.columns 或 extraKeys 变化时同步
    const ver = (block.columnDefs?.length ?? 0) * 1000 + (block.columns?.length ?? 0) * 100 + extraKeys.length;
    if (ver !== _colVer.current) { _colVer.current = ver; setColumns(allColumns); }
  }, [block.columnDefs, block.columns, extraKeys.length]);

  const canDragRows = !!onRowReorder && localRows.length > 1;
  const canDragCols = !!onColumnReorder && columns.length > 1;

  // Column drag handlers
  const makeColHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setColDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setColDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setColDragIdx(null); setColDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (colDragIdx === null || colDragIdx === idx) { setColDragIdx(null); setColDropTarget(null); return; }
      const nc = [...columns]; const [m] = nc.splice(colDragIdx, 1); nc.splice(idx, 0, m);
      setColumns(nc); setColDragIdx(null); setColDropTarget(null);
      onColumnReorder?.(block.id, nc.map((c) => c.key));
    },
  });

  // ── 行增删 ──────────────────────────────────────────
  const handleAddRow = async () => {
    const emptyExtra: Record<string, string> = {};
    for (const c of displayExtraCols) emptyExtra[c.key] = "";
    const emptyRow: SupplyGapRow = { dimension: "新维度", currentMarket: "", unmetNeed: "", extra: emptyExtra };
    const newRows = [...localRows, emptyRow];
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "experienceGaps", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  const handleDeleteRow = async (idx: number) => {
    if (!window.confirm("确定删除这一行？")) return;
    const newRows = localRows.filter((_, i) => i !== idx);
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "experienceGaps", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };

  // ── 列增删 ──────────────────────────────────────────
  const handleAddColumn = async () => {
    const name = window.prompt("请输入新列名称（如「价格带」）");
    if (!name || !name.trim()) return;
    const key = name.trim().replace(/\s+/g, "_").toLowerCase();
    if (columns.find(c => c.key === key)) { alert("该列已存在"); return; }
    const newCols = [...(block.columns ?? columns.map(c => ({ key: c.key, label: c.label }))), { key, label: name.trim() }];
    const newRows = localRows.map(r => {
      const newExtra = { ...(r.extra ?? {}) };
      newExtra[key] = "";
      return { ...r, extra: newExtra };
    });
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "experienceGaps", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
  };
  const handleDeleteColumn = async (colKey: string) => {
    const col = baseColumns.find(d => d.key === colKey);
    if (col?.protected) { alert("预设列不可删除"); return; }
    if (!window.confirm(`确定删除列 "${col?.label ?? colKey}"？该列所有数据将丢失。`)) return;
    const newRows = localRows.map(r => {
      const newExtra = { ...(r.extra ?? {}) };
      delete newExtra[colKey];
      return { ...r, extra: newExtra };
    });
    setLocalRows(newRows);
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "experienceGaps", newValue: newRows, previousValue: localRows, stage },
      { blockId: block.id, itemPath: "rows" },
    );
    onColumnReorder?.(block.id, columns.filter(c => c.key !== colKey).map(c => c.key));
  };

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse table-fixed`}>
          <thead>
            <tr className="border-b border-stone-300">
              {canDragRows && <th className="w-6 px-0 py-2 print:hidden" />}
              {columns.map((col, ci) => {
                const wClass =
                  col.key === "dimension" ? "w-[18%]" :
                  col.key === "currentMarket" ? "w-[30%]" :
                  col.key === "unmetNeed" ? "w-[30%]" :
                  "";
                return (
                <th key={col.key}
                  draggable={canDragCols}
                  {...(canDragCols ? makeColHandlers(ci) : {})}
                  className={`${wClass} text-xs uppercase text-stone-500 font-medium px-3 py-2 text-left select-none group/col relative ${
                    canDragCols ? "cursor-grab active:cursor-grabbing" : ""
                  } ${colDropTarget === ci && colDragIdx !== ci ? "border-l-2 border-amber-400" : ""}`}
                >
                  {col.label}
                  {!col.protected && (
                    <button
                      onClick={() => handleDeleteColumn(col.key)}
                      className="ml-1 opacity-0 group-hover/col:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-[10px] print:hidden"
                      title="删除列"
                    >
                      ✕
                    </button>
                  )}
                </th>
                );
              })}
              <th className="w-8 px-1 py-2 print:hidden">
                <button
                  onClick={handleAddColumn}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-1.5 py-0.5 transition-colors print:hidden"
                  title="添加列"
                >
                  +
                </button>
              </th>
              <th className="w-8 px-0 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, ri) => (
              <tr key={row.dimension}
                draggable={canDragRows}
                onDragStart={canDragRows ? (e: React.DragEvent) => { setRowDragIdx(ri); e.dataTransfer.effectAllowed = "move"; } : undefined}
                onDragOver={canDragRows ? (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setRowDropTarget(ri); } : undefined}
                onDragEnd={canDragRows ? () => { setRowDragIdx(null); setRowDropTarget(null); } : undefined}
                onDrop={canDragRows ? (e: React.DragEvent) => {
                  e.preventDefault();
                  if (rowDragIdx === null || rowDragIdx === ri) { setRowDragIdx(null); setRowDropTarget(null); return; }
                  const nr = [...localRows]; const [m] = nr.splice(rowDragIdx, 1); nr.splice(ri, 0, m);
                  setLocalRows(nr); setRowDragIdx(null); setRowDropTarget(null);
                  onRowReorder?.(block.id, nr.map(r => r.dimension));
                } : undefined}
                className={`border-b border-stone-100 group/row transition-all ${
                  rowDropTarget === ri && rowDragIdx !== ri ? "border-t-2 border-amber-400" : ""
                }`}
              >
                {canDragRows && (
                  <td className="px-0 py-2 align-middle print:hidden">
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex justify-center">
                      <RowDragHandle />
                    </div>
                  </td>
                )}
                {columns.map(col => {
                  const isBase = baseKeys.has(col.key);
                  const raw = isBase
                    ? (row as any)[col.key] ?? ""
                    : (row.extra?.[col.key] ?? "");
                  const nodeId = `${block.id}:cell:${ri}:${col.key}`;
                  const fieldPath = isBase
                    ? `${srcField?.fieldPath ?? "experienceGaps"}[${ri}].${col.key}`
                    : `${srcField?.fieldPath ?? "experienceGaps"}[${ri}].extra.${col.key}`;
                  return (
                    <td key={col.key} className={`px-3 py-2 text-xs align-top ${col.key === "dimension" ? "text-stone-700 font-medium" : "text-stone-700"}`}>
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={cleanCellText(raw)}
                        as="span"
                        source={{ stage, fieldPath }}
                        renderTarget={{ blockId: block.id, itemPath: isBase ? `rows[${ri}].${col.key}` : `rows[${ri}].extra.${col.key}` }}
                        saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })}
                <td className="px-0 py-2 align-middle print:hidden">
                  <button
                    onClick={() => handleDeleteRow(ri)}
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-xs px-1"
                    title="删除行"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="print:hidden">
              <td colSpan={columns.length + (canDragRows ? 1 : 0) + 1} className="px-3 py-1">
                <button
                  onClick={handleAddRow}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-3 py-1 transition-colors"
                >
                  + 添加行
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════
// 7. matrix — 竞品矩阵
// ═══════════════════════════════════════════════════════════

function MatrixRenderer({
  block,
  onColumnReorder,
  onRowReorder,
}: {
  block: MatrixBlock;
  onColumnReorder?: (blockId: string, columnKeys: string[]) => void;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const { applyMutation, nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];

  type MatrixRow = { dim: string; cells: string[]; best: number | undefined };
  const buildRows = (b: MatrixBlock): MatrixRow[] =>
    b.dimensions.map((dim, di) => ({ dim, cells: b.cells[di] ?? [], best: b.bestPerRow?.[di] }));

  const [localRows, setLocalRows] = useState<MatrixRow[]>(buildRows(block));
  const [rowDragIdx, setRowDragIdx] = useState<number | null>(null);
  const [rowDropTarget, setRowDropTarget] = useState<number | null>(null);
  const [colDragIdx, setColDragIdx] = useState<number | null>(null);
  const [colDropTarget, setColDropTarget] = useState<number | null>(null);
  const [brandCols, setBrandCols] = useState<string[]>(block.brands);
  const _mrh = useRef(0); const _mbh = useRef("");
  useEffect(() => {
    const h = block.dimensions.join("|").length + JSON.stringify(block.cells).length;
    if (h !== _mrh.current) { _mrh.current = h; setLocalRows(buildRows(block)); }
  }, [block.dimensions, block.cells, block.bestPerRow]);
  useEffect(() => {
    const h = block.brands.join(",");
    if (h !== _mbh.current) { _mbh.current = h; setBrandCols(block.brands); }
  }, [block.brands]);
  // ── 行增删 ──────────────────────────────────────────
  const handleAddRow = async () => {
    const emptyCells = block.brands.map(() => "");
    const newDim = "新维度";
    const newDims = [...block.dimensions, newDim];
    const newCells = [...block.cells, emptyCells];
    const newBest: number[] | undefined = block.bestPerRow ? [...block.bestPerRow, -1] : undefined;
    setLocalRows(buildRows({ ...block, dimensions: newDims, cells: newCells, bestPerRow: newBest }));
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newDims, previousValue: block.dimensions, stage },
      { blockId: block.id, itemPath: "dimensions" },
    );
    // Also save cells update
    await applyMutation(
      { type: "update", fieldPath: (srcField?.fieldPath ?? "cells").replace("dimensions", "cells"), newValue: newCells, previousValue: block.cells, stage },
      { blockId: block.id, itemPath: "cells" },
    );
  };
  const handleDeleteRow = async (idx: number) => {
    if (!window.confirm("确定删除这一行？")) return;
    const newDims = block.dimensions.filter((_, i) => i !== idx);
    const newCells = block.cells.filter((_, i) => i !== idx);
    const newBest = block.bestPerRow ? block.bestPerRow.filter((_, i) => i !== idx) : undefined;
    setLocalRows(buildRows({ ...block, dimensions: newDims, cells: newCells, bestPerRow: newBest }));
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "dimensions", newValue: newDims, previousValue: block.dimensions, stage },
      { blockId: block.id, itemPath: "dimensions" },
    );
    await applyMutation(
      { type: "update", fieldPath: (srcField?.fieldPath ?? "cells").replace("dimensions", "cells"), newValue: newCells, previousValue: block.cells, stage },
      { blockId: block.id, itemPath: "cells" },
    );
  };
  // ── 列增删（品牌列）─────────────────────────────────
  const handleAddColumn = async () => {
    const name = window.prompt("请输入新品牌/列名称");
    if (!name || !name.trim()) return;
    if (brandCols.includes(name.trim())) { alert("该列已存在"); return; }
    const newBrands = [...brandCols, name.trim()];
    const newCells = block.cells.map(row => [...row, ""]);
    setBrandCols(newBrands);
    setLocalRows(buildRows({ ...block, brands: newBrands, cells: newCells }));
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "brands", newValue: newBrands, previousValue: block.brands, stage },
      { blockId: block.id, itemPath: "brands" },
    );
    await applyMutation(
      { type: "update", fieldPath: (srcField?.fieldPath ?? "cells"), newValue: newCells, previousValue: block.cells, stage },
      { blockId: block.id, itemPath: "cells" },
    );
  };
  const handleDeleteColumn = async (brand: string) => {
    if (!window.confirm(`确定删除列 "${brand}"？该列所有数据将丢失。`)) return;
    const idx = brandCols.indexOf(brand);
    if (idx === -1) return;
    const newBrands = brandCols.filter((_, i) => i !== idx);
    const newCells = block.cells.map(row => row.filter((_, i) => i !== idx));
    const newBest: number[] | undefined = block.bestPerRow
      ? (block.bestPerRow.map(b => b === idx ? -1 : b !== undefined && b > idx ? b - 1 : b) as number[])
      : undefined;
    setBrandCols(newBrands);
    setLocalRows(buildRows({ ...block, brands: newBrands, cells: newCells, bestPerRow: newBest }));
    await applyMutation(
      { type: "update", fieldPath: srcField?.fieldPath ?? "brands", newValue: newBrands, previousValue: block.brands, stage },
      { blockId: block.id, itemPath: "brands" },
    );
    await applyMutation(
      { type: "update", fieldPath: (srcField?.fieldPath ?? "cells"), newValue: newCells, previousValue: block.cells, stage },
      { blockId: block.id, itemPath: "cells" },
    );
  };

  const canDragCols = !!onColumnReorder && brandCols.length > 1;
  const canDragRows = !!onRowReorder && localRows.length > 1;
  const brandIndexMap = new Map(block.brands.map((b, i) => [b, i]));

  const makeColHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setColDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setColDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setColDragIdx(null); setColDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (colDragIdx === null || colDragIdx === idx) { setColDragIdx(null); setColDropTarget(null); return; }
      const nc = [...brandCols]; const [m] = nc.splice(colDragIdx, 1); nc.splice(idx, 0, m);
      setBrandCols(nc); setColDragIdx(null); setColDropTarget(null);
      onColumnReorder?.(block.id, nc);
    },
  });

  const makeRowHandlers = (idx: number) => ({
    onDragStart: (e: React.DragEvent) => { setRowDragIdx(idx); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setRowDropTarget(idx); },
    onDragEnd: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setRowDragIdx(null); setRowDropTarget(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (rowDragIdx === null || rowDragIdx === idx) { setRowDragIdx(null); setRowDropTarget(null); return; }
      const nr = [...localRows]; const [m] = nr.splice(rowDragIdx, 1); nr.splice(idx, 0, m);
      setLocalRows(nr); setRowDragIdx(null); setRowDropTarget(null);
      onRowReorder?.(block.id, nr.map((r) => r.dim));
    },
  });

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse table-fixed`}>
          <thead>
            <tr className="border-b border-stone-300">
              {canDragRows && <th className="w-6 px-0 py-2 print:hidden" />}
              <th className="w-[15%] text-xs uppercase text-stone-500 font-medium px-3 py-2 text-left">维度</th>
              {brandCols.map((brand, bi) => (
                <th key={brand} draggable={canDragCols}
                  {...(canDragCols ? makeColHandlers(bi) : {})}
                  className={`text-xs uppercase text-stone-500 font-medium px-3 py-2 text-left select-none group/col relative ${
                    canDragCols ? "cursor-grab active:cursor-grabbing" : ""
                  } ${colDropTarget === bi && colDragIdx !== bi ? "border-l-2 border-amber-400" : ""}`}
                >
                  {brand}
                  <button
                    onClick={() => handleDeleteColumn(brand)}
                    className="ml-1 opacity-0 group-hover/col:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-[10px] print:hidden"
                    title="删除列"
                  >
                    ✕
                  </button>
                </th>
              ))}
              <th className="w-8 px-1 py-2 print:hidden">
                <button
                  onClick={handleAddColumn}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-1.5 py-0.5 transition-colors print:hidden"
                  title="添加列"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, ri) => (
              <tr key={row.dim}
                draggable={canDragRows}
                {...(canDragRows ? makeRowHandlers(ri) : {})}
                className={`border-b border-stone-100 group/row ${ri % 2 === 0 ? "bg-stone-50/50" : "bg-white"} ${
                  rowDropTarget === ri && rowDragIdx !== ri ? "border-t-2 border-amber-400" : ""
                }`}
              >
                {canDragRows && (
                  <td className="px-0 py-2 align-middle print:hidden">
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab flex justify-center">
                      <RowDragHandle />
                    </div>
                  </td>
                )}
                {/* 维度名 — 可编辑 */}
                {(() => {
                  const nodeId = `${block.id}:dim:${ri}`;
                  return (
                    <td className={`px-3 py-2 text-xs text-stone-700 font-medium align-top`}>
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={row.dim}
                        as="span"
                        source={{ stage, fieldPath: `${srcField?.fieldPath ?? "dimensions"}[${ri}]` }}
                        renderTarget={{ blockId: block.id, itemPath: `dimensions[${ri}]` }}
                        saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })()}
                {brandCols.map((brand, bi) => {
                  const origIdx = brandIndexMap.get(brand) ?? bi;
                  const cell = row.cells[origIdx] ?? "";
                  const isBest = row.best !== undefined && row.best === origIdx;
                  const nodeId = `${block.id}:cell:${ri}:${bi}`;
                  return (
                    <td key={brand} className={`px-3 py-2 text-xs text-stone-700 align-top`}>
                      {isBest && <span className="text-amber-500 mr-1" title="最优">★</span>}
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={cleanCellText(cell)}
                        as="span"
                        source={{ stage, fieldPath: `${srcField?.fieldPath ?? "cells"}[${ri}][${origIdx}]` }}
                          renderTarget={{ blockId: block.id, itemPath: `cells.${ri}.${origIdx}` }}
                          saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })}
                <td className="px-0 py-2 align-middle print:hidden">
                  <button
                    onClick={() => handleDeleteRow(ri)}
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-stone-400 hover:text-red-500 text-xs px-1"
                    title="删除行"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="print:hidden">
              <td colSpan={2 + brandCols.length + (canDragRows ? 1 : 0)} className="px-3 py-1">
                <button
                  onClick={handleAddRow}
                  className="text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded px-3 py-1 transition-colors"
                >
                  + 添加行
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 8. decisionDimension — 消费者决策维度模型
// ═══════════════════════════════════════════════════════════

function DecisionDimensionRenderer({
  block,
  onRowReorder,
}: {
  block: DecisionDimensionBlock;
  onRowReorder?: (blockId: string, rowKeys: string[]) => void;
}) {
  const { nodeStatus } = useDocumentEditor();
  const stage = getStageFromBlock(block);
  const srcField = block.sourceFields?.[0];

  const [localRows, setLocalRows] = useState(block.rows);
  const _ddrh = useRef(0);
  useEffect(() => {
    const h = block.rows.length + block.rows.reduce((s: number, r: any, i: number) => s + JSON.stringify(r).length * (i + 1), 0);
    if (h !== _ddrh.current) { _ddrh.current = h; setLocalRows(block.rows); }
  }, [block.rows]);
  const canDragRows = !!onRowReorder && localRows.length > 1;

  const cols: Array<{ key: keyof typeof localRows[0]; label: string }> = [
    { key: "dimension", label: "决策维度" },
    { key: "consumerConcern", label: "消费者真正关注" },
    { key: "marketSolution", label: "当前市场主要解决方式" },
    { key: "gap", label: "当前不足" },
  ];

  return (
    <div>
      {block.title && <BlockTitle title={block.title} blockId={block.id} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-stone-300">
              {canDragRows && <th className="w-6 px-0 py-2 print:hidden" />}
              {cols.map((col) => {
                const wClass =
                  col.key === "dimension" ? "w-[18%]" :
                  col.key === "consumerConcern" ? "w-[28%]" :
                  col.key === "marketSolution" ? "w-[27%]" :
                  "w-[27%]"; // gap
                return (
                  <th key={col.key} className={`${wClass} text-xs uppercase text-stone-500 font-medium px-3 py-2 text-left`}>{col.label}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, ri) => (
              <tr key={row.dimension} className="border-b border-stone-100 group/row">
                {canDragRows && (
                  <td className="px-0 py-2 align-middle print:hidden">
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab flex justify-center">
                      <RowDragHandle />
                    </div>
                  </td>
                )}
                {cols.map((col) => {
                  const nodeId = `${block.id}:cell:${ri}:${col.key}`;
                  const fieldPath = `${srcField?.fieldPath ?? "rows"}[${ri}].${col.key}`;
                  return (
                    <td key={col.key} className={`px-3 py-2 text-xs align-top ${col.key === "dimension" ? "text-stone-700 font-medium" : "text-stone-700"}`}>
                      <EditableNode
                        nodeId={nodeId}
                        type="text"
                        value={cleanCellText(row[col.key] as string)}
                        as="span"
                        source={{ stage, fieldPath }}
                        renderTarget={{ blockId: block.id, itemPath: `rows[${ri}].${col.key}` }}
                        saveStatus={nodeStatus[nodeId]}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 行拖拽手柄 */
function RowDragHandle() {
  return (
    <svg className="w-3.5 h-3.5 text-stone-300" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" />
      <circle cx="9" cy="13" r="1.5" /><circle cx="15" cy="13" r="1.5" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// 9. source — 数据来源引用（不可编辑）
// ═══════════════════════════════════════════════════════════

function cleanCellText(text: string): string {
  return text.replace(/[。.]+$/, "");
}

function SourceRenderer({ block }: { block: SourceBlock }) {
  return (
    <div className="text-xs text-stone-400 space-y-1 border-l-2 border-stone-200 pl-3">
      {block.title && <p className="text-stone-500 font-medium mb-2">{block.title}</p>}
      {block.sources.map((src, i) => (
        <p key={i} className="leading-relaxed">
          {src.url ? (
            <a href={src.url} target="_blank" rel="noopener noreferrer"
              className="text-stone-400 hover:text-stone-600 underline">
              {src.title || src.url}
            </a>
          ) : (src.title)}
          {src.retrievedAt && (
            <span className="ml-1 text-stone-300">({new Date(src.retrievedAt).toLocaleDateString("zh-CN")})</span>
          )}
          {src.summary && <span className="ml-2 text-stone-400">— {src.summary}</span>}
        </p>
      ))}
    </div>
  );
}
