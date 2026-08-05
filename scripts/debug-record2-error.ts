#!/usr/bin/env npx tsx
/**
 * Minimal reproduction of "record2 is not a function" error
 * 目标：捕获完整堆栈，定位根因
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// 加载 .env.local
const envPath = resolve(__dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { console.warn(".env.local not found"); }

async function main() {
  console.log("=== Reproducing 'record2 is not a function' ===\n");

  // Test 1: 直接调用 getStageRecord
  try {
    console.log("1. Loading stage-repo module...");
    const mod = await import("../src/lib/db/stage-repo");
    console.log(`   Exports: ${Object.keys(mod).join(", ")}`);
    console.log(`   getStageRecord type: ${typeof mod.getStageRecord}`);

    if (typeof mod.getStageRecord === "function") {
      console.log("   Calling getStageRecord('test-404', 1)...");
      try {
        const result = await mod.getStageRecord("test-404", 1);
        console.log(`   Result: ${JSON.stringify(result)}`);
      } catch (e: any) {
        console.error(`   ❌ Error: ${e.message}`);
        console.error(`   Stack: ${e.stack}`);
      }
    } else {
      console.log(`   ❌ getStageRecord is not a function, it's: ${typeof mod.getStageRecord}`);
    }
  } catch (e: any) {
    console.error(`   ❌ Import failed: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
  }

  // Test 2: 检查 db/index.ts 的导出
  console.log("\n2. Inspecting db/index.ts exports...");
  try {
    const dbMod = await import("../src/lib/db/index");
    console.log(`   Exports: ${Object.keys(dbMod).join(", ")}`);
    console.log(`   db type: ${typeof (dbMod as any).db}`);
    console.log(`   stageRecord type: ${typeof (dbMod as any).stageRecord}`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
  }

  // Test 3: 检查 Drizzle 连接
  console.log("\n3. Testing DB connection...");
  try {
    const { db } = await import("../src/lib/db/index");
    console.log(`   db type: ${typeof db}`);
    if (typeof db === "object" && db !== null) {
      console.log(`   db keys: ${Object.keys(db).join(", ")}`);
      // 尝试最简单的查询
      try {
        const result = await db.execute("SELECT 1 as test");
        console.log(`   SELECT 1: OK`);
      } catch (e: any) {
        console.error(`   SELECT 1 failed: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
  }
}

main().catch(e => {
  console.error("Fatal:", e.message);
  console.error(e.stack);
});
