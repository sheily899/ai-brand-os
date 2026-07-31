/**
 * DeepSeek API 连通性 + Prompt Cache 验证脚本
 * 用法: npx tsx scripts/verify-deepseek.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// 手动加载 .env.local（tsx 不自动加载）
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* .env.local not found */ }

import { createDeepSeekProvider } from "../src/lib/ai/provider/deepseek";

async function main() {
  console.log("=== DeepSeek API 验证 ===\n");

  const provider = createDeepSeekProvider();
  const systemPrompt = "你是一个品牌咨询助手。请用简洁的中文回答。";

  // ── 第一次调用 ──
  console.log("[1/2] 第一次调用...");
  const r1 = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "你好，请用一句话介绍你自己" },
    ],
    { maxTokens: 100 }
  );
  console.log(`  响应: ${r1.slice(0, 80)}...`);
  console.log("  第一次调用成功 ✅\n");

  // ── 第二次调用（相同 system prompt，验证 cache） ──
  console.log("[2/2] 第二次调用（相同 system prompt，测试 cache）...");
  const r2 = await provider.chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "品牌定位是什么" },
    ],
    { maxTokens: 200 }
  );
  console.log(`  响应: ${r2.slice(0, 80)}...`);
  console.log("  第二次调用成功 ✅\n");

  console.log("=== 验证通过: DeepSeek API 连通正常 ===");
  console.log("(Prompt Cache 效果需在 DeepSeek 控制台查看 input token 差异)");
}

main().catch((e) => {
  console.error("验证失败:", e.message);
  process.exit(1);
});
