/**
 * Document Editor Types — 统一编辑系统核心类型
 *
 * 所有报告编辑操作都通过这套类型定义。
 * 替代旧的 EditableText/Override + EditPanel/sourceField 双系统。
 */

// ── 编辑操作类型 ──────────────────────────────────────────

export type MutationType = "update" | "insert" | "delete";

/** 一次编辑操作 */
export interface Mutation {
  /** 节点 ID，与 EditableNode.nodeId 对应 */
  nodeId?: string;
  type: MutationType;
  /** 目标字段路径（stage 数据路径），如 "brandPositioning"、"competitors[2].name" */
  fieldPath: string;
  /** 新值（insert/update 时使用） */
  newValue?: any;
  /** 旧值（用于 rollback 和版本记录） */
  previousValue?: any;
  /** 来源阶段编号（1-8），用于乐观锁和版本追踪 */
  stage?: number;
  /** insert 时的插入位置；delete 时的删除索引 */
  index?: number;
}

// ── 渲染目标 — 告诉乐观更新器改报告树的哪个位置 ──────────

/**
 * 渲染目标定位器。
 * EditableNode 通过此结构告知 useDocumentEditor
 * 乐观更新时应该修改 ReportContent 的哪个位置。
 */
export interface RenderTarget {
  /** block.id（在 ReportContent 中唯一定位 block） */
  blockId?: string;
  /** block 内的数据路径，如 "items[2].title"、"rows[0].cells.positioning" */
  itemPath?: string;
  /** cover/executiveSummary/blueprint 等顶层数据的路径 */
  sectionPath?: string;
}

// ── 保存状态 ──────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export interface NodeSaveState {
  status: SaveStatus;
  error?: string;
}

// ── EditableNode 定义 ─────────────────────────────────────

export type EditableNodeType =
  | "text"        // 标题、label、短文本（单行）
  | "paragraph"   // 正文段落（多行）
  | "list-item"   // 列表中的单个项
  | "card"        // 卡片对象（{ title, description, ... }）
  | "table-cell"; // 表格单元格

/** 统一可编辑节点 */
export interface EditableNodeDef {
  /** 节点唯一 ID，用于保存状态追踪 */
  nodeId: string;
  type: EditableNodeType;
  /** 当前显示值 */
  value: any;
  /** AI 原始值（用于恢复） */
  originalValue?: any;
  /** 数据溯源 */
  source?: {
    stage: number;
    fieldPath: string;
  };
  /** 是否可编辑 */
  editable?: boolean;
}

// ── Document Editor Context ───────────────────────────────

export interface DocumentEditorState {
  /** 各节点的保存状态，key = nodeId */
  nodeStatus: Record<string, NodeSaveState>;
}

// ── Mutation Result ───────────────────────────────────────

export interface MutationResult {
  success: boolean;
  conflict?: boolean;
  newVersion?: number;
  error?: string;
}
