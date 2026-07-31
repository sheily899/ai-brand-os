/**
 * Drizzle Schema Push — 创建/更新数据库表
 * 用法: npx tsx scripts/push-schema.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// 加载 .env.local
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";

async function main() {
  console.log("=== Drizzle Schema Push ===\n");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  // 手动创建表（避免 drizzle-kit 依赖问题）
  console.log("Creating tables...");
  await client`
    CREATE TABLE IF NOT EXISTS "project" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT DEFAULT '',
      "user_id" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
      "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("  ✅ project");

  await client`
    CREATE TABLE IF NOT EXISTS "stage_record" (
      "id" TEXT PRIMARY KEY,
      "project_id" TEXT NOT NULL REFERENCES "project"("id"),
      "stage_number" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "consultation_messages" JSONB DEFAULT '[]',
      "structured_output" JSONB,
      "audit_result" JSONB,
      "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
      "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("  ✅ stage_record");

  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS "project_stage_idx" ON "stage_record" ("project_id", "stage_number")
  `;
  console.log("  ✅ project_stage_idx (unique index)");

  await client`
    CREATE TABLE IF NOT EXISTS "decision_memory_entry" (
      "id" TEXT PRIMARY KEY,
      "project_id" TEXT NOT NULL REFERENCES "project"("id"),
      "stage_source" INTEGER NOT NULL,
      "entry_type" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "field_path" TEXT,
      "evidence_level" TEXT DEFAULT 'ai_inferred',
      "confirmed_at" TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("  ✅ decision_memory_entry");

  await client.end();
  console.log("\n=== Schema push 完成 ===");
}

main().catch((e) => {
  console.error("Push failed:", e.message);
  process.exit(1);
});
