/**
 * recordFieldEdit() — 统一字段编辑入口
 *
 * 所有具有 sourceField 的实质内容修改必须经过此函数。
 * 内部完成：乐观锁检查 → 版本记录 → 更新 structuredOutput → 影响预览。
 *
 * 不触发 Cross-Stage Audit（当前阶段仅返回潜在影响供前端展示）。
 */
import { db, stageRecord, stageFieldVersion } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils/id";
import {
  normalizeFieldPath,
  getDownstreamAffected,
} from "@/lib/memory/dependency-graph";

// ── 类型 ──────────────────────────────────────────────────

export interface RecordFieldEditInput {
  projectId: string;
  stageNumber: number;
  fieldPath: string;
  previousValue: any;
  newValue: any;
  modifiedBy: "user" | "ai";
  clientVersion: number;
}

export interface FieldEditResult {
  success: boolean;
  conflict?: boolean;
  currentVersion?: number;
  versionRecord?: {
    id: string;
    previousValue: any;
    newValue: any;
  };
  potentialImpact?: {
    changedField: string;
    affectedStages: number[];
  };
  error?: string;
}

export interface RollbackEditInput {
  projectId: string;
  stageNumber: number;
  fieldPath: string;
  modifiedBy: "user" | "ai";
  clientVersion: number;
}

// ── 辅助 ──────────────────────────────────────────────────

/** 按 dot-path 深度设置嵌套对象字段（不修改原对象）。支持数组索引语法 field[0].subfield */
function setNestedField(
  obj: Record<string, any>,
  path: string,
  value: any,
): Record<string, any> {
  const result = JSON.parse(JSON.stringify(obj));

  // 预处理：在 . 之前插入分隔符，但保护 [n] 不被 split
  // "competitors[0].positioning" → ["competitors[0]", "positioning"]
  const rawSegments = path.split(".");

  let current: any = result;
  for (let i = 0; i < rawSegments.length - 1; i++) {
    const seg = rawSegments[i];
    // 解析数组索引: "items[2]" → key="items", idx=2
    const arrMatch = seg.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      const key = arrMatch[1];
      const idx = parseInt(arrMatch[2], 10);
      if (!Array.isArray(current[key])) {
        current[key] = [];
      }
      if (!current[key][idx] || typeof current[key][idx] !== "object") {
        current[key][idx] = {};
      }
      current = current[key][idx];
    } else {
      if (
        !(seg in current) ||
        typeof current[seg] !== "object" ||
        Array.isArray(current[seg])
      ) {
        current[seg] = {};
      }
      current = current[seg];
    }
  }

  // 最后一段可能是普通 key 或数组索引
  const lastSeg = rawSegments[rawSegments.length - 1];
  const lastArrMatch = lastSeg.match(/^(\w+)\[(\d+)\]$/);
  if (lastArrMatch) {
    const key = lastArrMatch[1];
    const idx = parseInt(lastArrMatch[2], 10);
    if (!Array.isArray(current[key])) {
      current[key] = [];
    }
    current[key][idx] = value;
  } else {
    current[lastSeg] = value;
  }

  return result;
}

// ── 核心函数 ──────────────────────────────────────────────

/**
 * 统一字段编辑入口。
 *
 * 1. 乐观锁检查——比对 clientVersion 与 stageRecord.version
 * 2. 创建 stageFieldVersion 版本记录（previousVersionId 链）
 * 3. 更新 stageRecord.structuredOutput 并递增 version
 * 4. 检查 FIELD_FORWARD_DEPENDENCIES 返回潜在影响阶段
 */
export async function recordFieldEdit(
  input: RecordFieldEditInput,
): Promise<FieldEditResult> {
  const {
    projectId,
    stageNumber,
    fieldPath,
    previousValue,
    newValue,
    modifiedBy,
    clientVersion,
  } = input;

  // ── 1. 乐观锁检查 ──────────────────────────────────

  const rows = await db
    .select({ version: stageRecord.version, output: stageRecord.structuredOutput })
    .from(stageRecord)
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber),
      ),
    )
    .limit(1);

  const record = rows[0];
  if (!record) {
    return { success: false, error: `阶段 ${stageNumber} 不存在` };
  }

  const currentVersion = record.version ?? 1;

  if (clientVersion !== currentVersion) {
    return {
      success: false,
      conflict: true,
      currentVersion,
      error: `版本冲突：客户端版本 ${clientVersion}，服务端版本 ${currentVersion}。请刷新后重试。`,
    };
  }

  if (!record.output) {
    return {
      success: false,
      error: `阶段 ${stageNumber} 尚无结构化输出，无法编辑`,
    };
  }

  const currentOutput = record.output as Record<string, any>;

  // ── 2. 查找该字段的上一版本（建立版本链） ──────────

  const prevVersionRows = await db
    .select({ id: stageFieldVersion.id, newValue: stageFieldVersion.newValue })
    .from(stageFieldVersion)
    .where(
      and(
        eq(stageFieldVersion.projectId, projectId),
        eq(stageFieldVersion.stageNumber, stageNumber),
        eq(stageFieldVersion.fieldPath, fieldPath),
      ),
    )
    .orderBy(desc(stageFieldVersion.modifiedAt))
    .limit(1);

  const previousVersionId = prevVersionRows.length > 0 ? prevVersionRows[0].id : null;

  // ── 3. 创建版本记录 ────────────────────────────────

  const versionId = generateId();
  const now = new Date();

  await db.insert(stageFieldVersion).values({
    id: versionId,
    projectId,
    stageNumber,
    fieldPath,
    previousValue: previousValue ?? null,
    newValue,
    modifiedBy,
    modifiedAt: now,
    previousVersionId,
  });

  // ── 4. 更新 structuredOutput ───────────────────────

  const updatedOutput = setNestedField(currentOutput, fieldPath, newValue);
  const newVersion = currentVersion + 1;

  await db
    .update(stageRecord)
    .set({
      structuredOutput: updatedOutput as any,
      version: newVersion,
      updatedAt: now,
    })
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber),
      ),
    );

  // ── 5. 影响预览 ────────────────────────────────────

  const affectedStages = getDownstreamAffected(fieldPath);
  const potentialImpact =
    affectedStages.length > 0
      ? { changedField: fieldPath, affectedStages }
      : undefined;

  if (potentialImpact) {
    console.log(
      `[recordFieldEdit] 字段 ${fieldPath} 可能影响阶段: ${affectedStages.join(", ")}`,
    );
  }

  return {
    success: true,
    currentVersion: newVersion,
    versionRecord: {
      id: versionId,
      previousValue,
      newValue,
    },
    potentialImpact,
  };
}

/**
 * 撤销字段编辑——基于版本链回退到上一版本。
 *
 * 逻辑：
 * 1. 读取该字段的最新版本记录
 * 2. 获取 previousValue（上一版本的值）
 * 3. 调用 recordFieldEdit() 将值恢复到上一个版本
 *   （这次调用本身也会创建一条新版本记录，链继续延伸）
 */
export async function rollbackEdit(
  input: RollbackEditInput,
): Promise<FieldEditResult> {
  const { projectId, stageNumber, fieldPath, modifiedBy, clientVersion } = input;

  // 1. 找到该字段的最新版本
  const latestRows = await db
    .select()
    .from(stageFieldVersion)
    .where(
      and(
        eq(stageFieldVersion.projectId, projectId),
        eq(stageFieldVersion.stageNumber, stageNumber),
        eq(stageFieldVersion.fieldPath, fieldPath),
      ),
    )
    .orderBy(desc(stageFieldVersion.modifiedAt))
    .limit(1);

  if (latestRows.length === 0) {
    return {
      success: false,
      error: `字段 ${fieldPath} 没有历史版本，无法撤销`,
    };
  }

  const latest = latestRows[0];

  // 2. 获取 previousValue（回退目标值）
  let rollbackValue: any = null;
  let prevVersionRecord: typeof latest | null = null;

  if (latest.previousVersionId) {
    const prevRows = await db
      .select()
      .from(stageFieldVersion)
      .where(eq(stageFieldVersion.id, latest.previousVersionId))
      .limit(1);
    if (prevRows.length > 0) {
      prevVersionRecord = prevRows[0];
    }
  }

  if (prevVersionRecord) {
    // 有上一版本 → 回退到上一版本的 newValue
    rollbackValue = prevVersionRecord.newValue;
  } else {
    // 没有上一版本 → 回退到 latest 的 previousValue（即原始值）
    rollbackValue = latest.previousValue;
  }

  // 3. 调用 recordFieldEdit 将值恢复（这会创建新版本记录）
  return recordFieldEdit({
    projectId,
    stageNumber,
    fieldPath,
    previousValue: latest.newValue,
    newValue: rollbackValue,
    modifiedBy,
    clientVersion,
  });
}

/**
 * 获取字段的版本历史（供前端展示）。
 */
export async function getFieldVersionHistory(
  projectId: string,
  stageNumber: number,
  fieldPath: string,
) {
  return db
    .select()
    .from(stageFieldVersion)
    .where(
      and(
        eq(stageFieldVersion.projectId, projectId),
        eq(stageFieldVersion.stageNumber, stageNumber),
        eq(stageFieldVersion.fieldPath, fieldPath),
      ),
    )
    .orderBy(desc(stageFieldVersion.modifiedAt));
}
