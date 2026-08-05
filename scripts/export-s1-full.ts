// scripts/export-s1-full.ts — 导出 S1 完整对话 + 结构化输出
import { readFileSync, writeFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const rows = await db.select().from(stageRecord)
    .where(and(eq(stageRecord.projectId, "qbt_bOs495Sa5_74"), eq(stageRecord.stageNumber, 1)))
    .limit(1);

  const r = rows[0] as any;
  if (!r) { console.log("S1: 无数据"); process.exit(1); }

  const out: string[] = [];
  out.push(`========================================================================`);
  out.push(`  Stage 1 — 用户访谈（创始人诉求）`);
  out.push(`========================================================================\n`);
  out.push(`状态: ${r.status}  |  消息数: ${r.consultationMessages?.length ?? 0}\n`);

  out.push(`──────────────────────────────────────────────────`);
  out.push(`  对 话 内 容`);
  out.push(`──────────────────────────────────────────────────\n`);

  if (r.consultationMessages) {
    for (const msg of r.consultationMessages) {
      const role = msg.role === "user" ? "👤 创始人" : msg.role === "assistant" ? "🤖 AI顾问" : `[${msg.role}]`;
      out.push(`[${msg.turn || "?"}] ${role}:\n`);
      out.push(`${msg.content}\n`);
    }
  }

  out.push(`──────────────────────────────────────────────────`);
  out.push(`  阶段收敛输出 (Structured Output)`);
  out.push(`──────────────────────────────────────────────────\n`);

  if (r.structuredOutput) {
    out.push("```json");
    out.push(JSON.stringify(r.structuredOutput, null, 2));
    out.push("```\n");
  }

  const outFile = `temp/qbt_bOs495Sa5_74/S1-用户访谈.md`;
  writeFileSync(outFile, out.join("\n"), "utf8");
  console.log(`✅ ${outFile}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
