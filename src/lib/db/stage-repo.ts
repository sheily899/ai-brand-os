/**
 * StageRecord 仓库
 */
import { db, stageRecord } from "./index";
import { eq, and } from "drizzle-orm";

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
  await db
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
    );
}

export async function saveStructuredOutput(
  projectId: string,
  stageNumber: number,
  output: Record<string, any>
) {
  await db
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
    );
}
