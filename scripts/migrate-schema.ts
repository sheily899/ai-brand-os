#!/usr/bin/env npx tsx
/**
 * 一次性 Schema 迁移：加 version 列 + 创建 stage_field_version 表
 * 用法: npx tsx scripts/migrate-schema.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

// 加载 .env.local
const envPath = resolve(process.cwd(), ".env.local");
try {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { console.error(".env.local not found"); process.exit(1); }

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  console.log("1. 添加 version 列到 stage_record...");
  try {
    await sql.unsafe(`
      ALTER TABLE stage_record ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL
    `);
    console.log("   ✅ stage_record.version 已添加");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("   ⏭  column already exists");
    } else { throw e; }
  }

  console.log("2. 创建 stage_field_version 表...");
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS stage_field_version (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES project(id),
        stage_number INTEGER NOT NULL,
        field_path TEXT NOT NULL,
        previous_value JSONB,
        new_value JSONB NOT NULL,
        modified_by TEXT NOT NULL DEFAULT 'user',
        modified_at TIMESTAMP DEFAULT NOW() NOT NULL,
        previous_version_id TEXT
      )
    `);
    console.log("   ✅ stage_field_version 表已创建");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("   ⏭  table already exists");
    } else { throw e; }
  }

  console.log("3. 添加 Prompt Cache 列到 token_consumption...");
  const cacheCols = [
    { name: 'cache_creation_tokens', type: 'INTEGER DEFAULT 0' },
    { name: 'cache_read_tokens', type: 'INTEGER DEFAULT 0' },
    { name: 'billable_tokens', type: 'INTEGER DEFAULT 0' },
    { name: 'latency_ms', type: 'INTEGER' },
    { name: 'experiment_group', type: 'TEXT' },
  ];
  for (const col of cacheCols) {
    try {
      await sql.unsafe(`ALTER TABLE token_consumption ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`   ✅ token_consumption.${col.name} 已添加`);
    } catch (e: any) {
      console.log(`   ⏭  ${col.name}: ${e.message?.slice(0, 60)}`);
    }
  }

  console.log("\n🎉 迁移完成！");
  await sql.end();
  process.exit(0);
}

main().catch(e => { console.error("迁移失败:", e.message); process.exit(1); });
