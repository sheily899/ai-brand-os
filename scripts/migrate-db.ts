/**
 * One-shot DB migration: add missing columns
 * Run: npx tsx scripts/migrate-db.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local before importing db module
const envPath = resolve(__dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  console.warn("[migrate-db] .env.local 未找到");
}

async function main() {
  const { db } = await import("../src/lib/db/index");

  try {
    await db.execute("ALTER TABLE stage_record ADD COLUMN IF NOT EXISTS search_context text");
    console.log("✅ Added search_context column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("⏭️ search_context already exists");
    } else {
      console.error(`❌ search_context: ${e.message}`);
    }
  }

  try {
    await db.execute("ALTER TABLE stage_record ADD COLUMN IF NOT EXISTS audit_result jsonb");
    console.log("✅ Added audit_result column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("⏭️ audit_result already exists");
    } else {
      console.error(`❌ audit_result: ${e.message}`);
    }
  }

  try {
    await db.execute("ALTER TABLE decision_memory_entry ADD COLUMN IF NOT EXISTS previous_version_id text");
    console.log("✅ Added previous_version_id column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("⏭️ previous_version_id already exists");
    } else {
      console.error(`❌ previous_version_id: ${e.message}`);
    }
  }

  try {
    await db.execute("ALTER TABLE decision_memory_entry ADD COLUMN IF NOT EXISTS modified_by text");
    console.log("✅ Added modified_by column");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("⏭️ modified_by already exists");
    } else {
      console.error(`❌ modified_by: ${e.message}`);
    }
  }

  process.exit(0);
}

main();
