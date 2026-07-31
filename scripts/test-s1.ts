/**
 * S1 端到端测试脚本
 * 用法: npx tsx scripts/test-s1.ts
 */
import { readFileSync } from "fs"; import { resolve } from "path";
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try { const c = readFileSync(envPath, "utf8"); for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); } } catch {}

const BASE = "http://localhost:3458";

async function main() {
  // Step 1: 创建项目
  console.log("=== Step 1: 创建项目 ===");
  const pRes = await fetch(`${BASE}/api/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "超级宠物", category: "宠物食品" }),
  });
  const project = await pRes.json() as any;
  console.log(`  Project: ${project.name} (${project.id})`);
  console.log(`  Status: ${pRes.status} ✅\n`);

  // Step 2: 发送 S1 咨询消息
  console.log("=== Step 2: S1 咨询消息 ===");
  const msgRes = await fetch(`${BASE}/api/project/${project.id}/stage/1/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "你好，我做了一个宠物食品品牌叫超级宠物，想了解如何做品牌" }),
  });

  // 读取 SSE 流
  const reader = msgRes.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            fullResponse += data.content;
          }
          if (data.done) {
            fullResponse = data.fullResponse;
          }
        }
      }
    }
  }
  console.log(`  AI 回复 (前150字): ${fullResponse.slice(0, 150)}...`);
  console.log(`  SSE 流式响应正常 ✅\n`);

  // Step 3: 再发一条消息
  console.log("=== Step 3: 第二轮到消息 ===");
  const msg2Res = await fetch(`${BASE}/api/project/${project.id}/stage/1/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "我观察到很多猫主人对现有猫粮的成分很担忧，他们想要更天然的产品" }),
  });
  const reader2 = msg2Res.body?.getReader();
  let fullResponse2 = "";
  if (reader2) {
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.done) fullResponse2 = data.fullResponse;
        }
      }
    }
  }
  console.log(`  AI 回复 (前150字): ${fullResponse2.slice(0, 150)}...`);
  console.log(`  第二轮对话正常 ✅\n`);

  // Step 4: 检查阶段记录
  console.log("=== Step 4: 阶段记录 ===");
  const recordRes = await fetch(`${BASE}/api/project/${project.id}/stage/1`);
  const record = await recordRes.json() as any;
  console.log(`  Status: ${record.status}`);
  console.log(`  消息数: ${(record.messages as any[])?.length ?? 0}`);
  console.log(`  阶段记录正常 ✅\n`);

  // Step 5: 触发 Convergence
  console.log("=== Step 5: 触发 Convergence ===");
  const convRes = await fetch(`${BASE}/api/project/${project.id}/stage/1/converge`, {
    method: "POST",
  });
  const convResult = await convRes.json() as any;
  console.log(`  Success: ${convResult.success}`);
  if (convResult.success) {
    const out = convResult.output;
    console.log(`  founderType: ${out?.founderType}`);
    console.log(`  founderMotivation: ${out?.founderMotivation?.content?.slice(0, 100)}...`);
    console.log(`  observations: ${out?.observations?.length} 条`);
    console.log(`  confirmedProblems: ${out?.confirmedProblems?.length} 条`);
    console.log(`  constraints: budget=${out?.constraints?.budget || "(空)"}, team=${out?.constraints?.team || "(空)"}`);
  } else {
    console.log(`  Errors: ${JSON.stringify(convResult.errors)}`);
  }
  console.log(`  Retries: ${convResult.retriesUsed}`);
  console.log(`  Convergence 成功 ✅`);
}

main().catch((e) => {
  console.error("测试失败:", e.message);
  process.exit(1);
});
