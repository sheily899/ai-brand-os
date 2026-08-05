/**
 * StageRecord 仓库
 *
 * 容错策略：
 * - 所有写操作（save*）包裹 withRetry，处理短暂连接异常
 * - 读操作（getStageRecord）不做重试——调用方已处理 null 返回
 * - 重试仅针对连接层错误，数据层错误（FK/UNIQUE/NOT NULL）立即抛出
 */
import { db, stageRecord } from "./index";
import { eq, and } from "drizzle-orm";

// ── 重试工具 ────────────────────────────────────────────

/** 短暂性连接错误码（postgres 协议层 + 网络层） */
const TRANSIENT_ERRORS = new Set([
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08001", // unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "08004", // rejected_establishment
  "53300", // too_many_connections
]);

function isTransientError(e: any): boolean {
  // postgres-js 把 PG 错误码放在 code 字段
  if (e.code && TRANSIENT_ERRORS.has(e.code)) return true;
  // 网络层错误
  if (
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET" ||
    e.code === "ECONNREFUSED" ||
    e.code === "EPIPE"
  ) return true;
  // 消息中包含连接相关关键词
  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("connection") &&
    (msg.includes("timeout") || msg.includes("reset") || msg.includes("refused") || msg.includes("terminat"))
  ) return true;
  return false;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function withRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      if (!isTransientError(e) || attempt >= MAX_RETRIES) {
        throw e; // 非短暂错误或重试耗尽 → 立即抛出
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[stage-repo] ${operation} 遇到短暂连接错误，${delay}ms 后重试 (${attempt + 1}/${MAX_RETRIES}): ${e.message}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export async function getStageRecord(projectId: string, stageNumber: number) {
  const rows = await db
    .select()
    .from(stageRecord)
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber)
      )
    )
    .limit(1);
  return rows[0] || null;
}

export async function saveConsultationMessages(
  projectId: string,
  stageNumber: number,
  messages: Array<{ role: string; content: string; timestamp: string }>
) {
  await withRetry("saveConsultationMessages", () =>
    db
      .update(stageRecord)
      .set({
        consultationMessages: messages as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stageRecord.projectId, projectId),
          eq(stageRecord.stageNumber, stageNumber)
        )
      )
  );
}

/** 保存搜索上下文到阶段记录（advance 时调用） */
export async function saveSearchContext(
  projectId: string,
  stageNumber: number,
  searchContext: string
) {
  await withRetry("saveSearchContext", () =>
    db
      .update(stageRecord)
      .set({ searchContext, updatedAt: new Date() })
      .where(
        and(
          eq(stageRecord.projectId, projectId),
          eq(stageRecord.stageNumber, stageNumber)
        )
      )
  );
}

/** 保存审计结果到阶段记录（Quality Gate 完成后调用） */
export async function saveAuditResult(
  projectId: string,
  stageNumber: number,
  auditResult: Record<string, any>
) {
  await withRetry("saveAuditResult", () =>
    db
      .update(stageRecord)
      .set({ auditResult: auditResult as any, updatedAt: new Date() })
      .where(
        and(
          eq(stageRecord.projectId, projectId),
          eq(stageRecord.stageNumber, stageNumber)
        )
      )
  );
}

export async function saveStructuredOutput(
  projectId: string,
  stageNumber: number,
  output: Record<string, any>
) {
  await withRetry("saveStructuredOutput", () =>
    db
      .update(stageRecord)
      .set({
        structuredOutput: output as any,
        status: "waiting_confirm",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stageRecord.projectId, projectId),
          eq(stageRecord.stageNumber, stageNumber)
        )
      )
  );
}
