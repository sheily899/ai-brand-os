/**
 * 数据库连接验证脚本
 * 用法: npx tsx scripts/verify-db.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

import postgres from "postgres";

async function main() {
  console.log("=== 数据库连接验证 ===\n");

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL 未设置，请在 .env.local 中配置 Supabase 连接字符串");
    process.exit(1);
  }

  console.log(`连接: ${url.replace(/\/\/.*@/, "//***@")}`);

  try {
    const client = postgres(url, { max: 1, idle_timeout: 5 });
    const result = await client`SELECT current_timestamp as now, version() as pg_version`;
    console.log(`✅ 连接成功`);
    console.log(`  时间: ${result[0].now}`);
    console.log(`  版本: ${result[0].pg_version?.slice(0, 60)}...`);

    await client.end();
    console.log("\n=== 数据库验证通过 ===");
  } catch (e: any) {
    console.error(`❌ 连接失败: ${e.message}`);
    process.exit(1);
  }
}

main();
