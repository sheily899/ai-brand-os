// scripts/check-s1-data.ts — 检查 S1 数据是否存在
import { readFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  // Check multiple projects
  const projects = ["qbt_bOs495Sa5_74"];
  for (const pid of projects) {
    for (let sn = 1; sn <= 8; sn++) {
      const rows = await db.select()
        .from(stageRecord)
        .where(and(eq(stageRecord.projectId, pid), eq(stageRecord.stageNumber, sn)))
        .limit(1);
      const o = rows[0]?.structuredOutput as any;
      console.log(`S${sn}: ${rows[0] ? "exists (status=" + rows[0].status + ")" : "NONE"} ${o ? "(has output)" : ""}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
