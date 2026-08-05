/**
 * Decision Memory 版本管理
 *
 * 职责：
 * - 更新 Decision Memory 条目并保留历史版本
 * - 查询变更历史
 *
 * 每次更新创建新条目（新 id），通过 previousVersionId 链接到旧版本。
 * 不是原地修改——保证完整审计追踪。
 */

import { db, decisionMemoryEntry } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/id";
import type { EvidenceLevel } from "./decision-memory";

export interface VersionRecord {
  entryId: string;
  previousValue: string;
  newValue: string;
  modifiedBy: "user" | "ai";
  modifiedAt: Date;
  fieldPath: string;
  stageSource: number;
}

export interface UpdateEntryInput {
  entryId: string;
  newContent: string;
  modifiedBy: "user" | "ai";
}

export interface UpdateEntryResult {
  success: boolean;
  newEntryId?: string;
  previousValue?: string;
  fieldPath?: string;
  stageSource?: number;
  error?: string;
}

/**
 * 更新一条 Decision Memory 条目。
 *
 * 不是原地修改——创建新条目，将 previousVersionId 指向旧条目。
 * 旧条目保留不变，新条目继承除 content 外的所有元数据。
 */
export async function updateEntry(
  input: UpdateEntryInput
): Promise<UpdateEntryResult> {
  // 1. 读取旧条目
  const rows = await db
    .select()
    .from(decisionMemoryEntry)
    .where(eq(decisionMemoryEntry.id, input.entryId))
    .limit(1);

  const oldEntry = rows[0];
  if (!oldEntry) {
    return { success: false, error: `条目不存在: ${input.entryId}` };
  }

  const previousValue = oldEntry.content;
  if (previousValue === input.newContent) {
    return { success: false, error: "新内容与旧内容相同，无需更新" };
  }

  // 2. 创建新版本条目（version chain）
  const newId = generateId();
  await db.insert(decisionMemoryEntry).values({
    id: newId,
    projectId: oldEntry.projectId,
    stageSource: oldEntry.stageSource,
    entryType: oldEntry.entryType,
    content: input.newContent,
    fieldPath: oldEntry.fieldPath,
    evidenceLevel: oldEntry.evidenceLevel as EvidenceLevel,
    confirmedAt: new Date(),
    previousVersionId: input.entryId,
    modifiedBy: input.modifiedBy,
  });

  return {
    success: true,
    newEntryId: newId,
    previousValue,
    fieldPath: oldEntry.fieldPath ?? undefined,
    stageSource: oldEntry.stageSource,
  };
}

/**
 * 查询某条目的完整版本历史。
 *
 * 从最新版本开始，沿 previousVersionId 链回溯。
 */
export async function getVersionHistory(
  entryId: string
): Promise<VersionRecord[]> {
  const history: VersionRecord[] = [];
  let currentId: string | null = entryId;

  // 先找到最新的版本（可能是链尾）
  let entry = await db
    .select()
    .from(decisionMemoryEntry)
    .where(eq(decisionMemoryEntry.id, currentId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!entry) return [];

  // 如果当前条目有 previousVersionId，先跳到链头
  while (entry?.previousVersionId) {
    const prev = await db
      .select()
      .from(decisionMemoryEntry)
      .where(eq(decisionMemoryEntry.id, entry.previousVersionId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!prev) break;
    entry = prev;
  }

  // entry 现在是链头（最老版本）
  // 向前遍历收集所有版本
  let cursor: typeof entry | null = entry;
  while (cursor) {
    // 找下一个版本
    const next: typeof entry | null = await db
      .select()
      .from(decisionMemoryEntry)
      .where(eq(decisionMemoryEntry.previousVersionId, cursor.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (next) {
      history.push({
        entryId: next.id,
        previousValue: cursor.content,
        newValue: next.content,
        modifiedBy: (next.modifiedBy as "user" | "ai") ?? "user",
        modifiedAt: next.confirmedAt ?? new Date(),
        fieldPath: next.fieldPath ?? "",
        stageSource: next.stageSource,
      });
    }

    cursor = next;
  }

  return history;
}
