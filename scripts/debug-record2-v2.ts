#!/usr/bin/env npx tsx
/**
 * Exact reproduction of anomaly-tests.ts 4a test
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(__dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { console.warn(".env.local not found"); }

async function main() {
  console.log("=== Exact reproduction of anomaly-tests.ts Test 4a ===\n");

  // Test A: Exact same code as anomaly-tests.ts
  console.log("A. Running EXACT anomaly-tests.ts 4a code:");
  try {
    const { getStageRecord } = await import("../src/lib/db/stage-repo");
    console.log(`   getStageRecord type: ${typeof getStageRecord}`);
    const record = await getStageRecord("non-existent-project-id-99999", 1);
    console.log(`   Result: ${record === null ? "null" : JSON.stringify(record)}`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
  }

  // Test B: Also check if running AFTER search tests causes issue
  // (the anomaly tests run search tests BEFORE db tests)
  console.log("\nB. Running after search module import (like anomaly tests order):");
  try {
    // Simulate what anomaly-tests.ts does: import search stuff first
    await import("../src/lib/ai/search/bocha-search");
    await import("../src/lib/ai/search/search-context");
    await import("../src/lib/ai/search/search-intent");
    await import("../src/lib/ai/search/retrieval");
    console.log("   Search modules loaded OK");

    const { getStageRecord } = await import("../src/lib/db/stage-repo");
    console.log(`   getStageRecord type: ${typeof getStageRecord}`);
    const record = await getStageRecord("non-existent-project-id-99999", 1);
    console.log(`   Result: ${record === null ? "null" : JSON.stringify(record)}`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
    console.error(`   Stack: ${e.stack}`);
  }

  // Test C: Check for module-level side effects
  console.log("\nC. Checking stage-repo source for 'record2' string:");
  try {
    const src = readFileSync(resolve(__dirname, "../src/lib/db/stage-repo.ts"), "utf8");
    const hasRecord2 = src.includes("record2");
    console.log(`   Source contains 'record2': ${hasRecord2}`);
    if (hasRecord2) {
      const lines = src.split("\n");
      lines.forEach((l, i) => {
        if (l.includes("record2")) console.log(`   Line ${i+1}: ${l.trim()}`);
      });
    }
  } catch (e: any) {
    console.error(`   ❌: ${e.message}`);
  }

  // Test D: Check Drizzle schema for 'record2'
  console.log("\nD. Checking Drizzle schema exports:");
  try {
    const schema = await import("../src/lib/db/schema");
    console.log(`   Schema exports: ${Object.keys(schema).join(", ")}`);
    for (const [k, v] of Object.entries(schema)) {
      if (k.toLowerCase().includes("record")) {
        console.log(`   ${k}: ${typeof v}`);
      }
    }
  } catch (e: any) {
    console.error(`   ❌: ${e.message}`);
  }
}

main().catch(e => {
  console.error("Fatal:", e.message);
  console.error(e.stack);
});
