#!/usr/bin/env npx tsx
/**
 * 精确复现 anomaly-tests.ts 4a 的变量遮蔽 bug
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

// record() helper — 与 anomaly-tests.ts 完全一致的函数定义
function record(name: string, passed: boolean, details: string) {
  const status = passed ? "✅" : "❌";
  console.log(`  ${status} ${name}: ${details}`);
}

async function main() {
  console.log("=== 复现变量遮蔽 bug ===\n");

  // 与 anomaly-tests.ts 4a 完全一致的代码
  console.log("执行 anomaly-tests.ts 4a 的代码:");
  try {
    const { getStageRecord } = await import("../src/lib/db/stage-repo");
    console.log(`  getStageRecord 导入成功，类型: ${typeof getStageRecord}`);

    // ⚠️ 这里的 const record 遮蔽了外层的 record() 函数！
    const record = await getStageRecord("non-existent-project-id-99999", 1);
    console.log(`  record 值类型: ${typeof record}, 值: ${record}`);

    // 这行本意是调用 record() 函数记录测试结果
    // 但 record 现在是 null（DB 返回的结果），所以会报错！
    record("4a. getStageRecord 不存在项目返回 null",
      record === null,
      `返回: ${record === null ? "null" : "有数据"}`);
  } catch (e: any) {
    console.error(`\n  ❌ 捕获到错误: ${e.message}`);
    console.error(`  错误类型: ${e.constructor.name}`);
    if (e.stack) {
      const stackLines = e.stack.split("\n").slice(0, 6);
      console.error(`  堆栈:\n${stackLines.map(l => `    ${l}`).join("\n")}`);
    }
  }
}

main().catch(e => {
  console.error("Fatal:", e.message);
  console.error(e.stack);
});
