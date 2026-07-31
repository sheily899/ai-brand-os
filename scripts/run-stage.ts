#!/usr/bin/env npx tsx
/**
 * run-stage.ts — CLI 测试脚本
 *
 * 用法：
 *   npx tsx scripts/run-stage.ts --mode consult  模拟 S1 多轮咨询
 *   npx tsx scripts/run-stage.ts --mode converge 测试 JSON 收敛
 *   npx tsx scripts/run-stage.ts --mode full     完整运行阶段
 *
 * Phase 1：支持 consult / converge / full
 * Phase 2+：扩展 batch 模式（含搜索自动触发）
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// 加载 env
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

import * as readline from "readline";

// ── CLI 参数解析 ──────────────────────────────────────

const args = process.argv.slice(2);
const modeIdx = args.indexOf("--mode");
const mode = modeIdx >= 0 ? args[modeIdx + 1] : "consult";

if (!["consult", "converge", "full"].includes(mode)) {
  console.error("用法: npx tsx scripts/run-stage.ts --mode consult|converge|full");
  process.exit(1);
}

// ── 交互式咨询 ────────────────────────────────────────

async function runConsultation() {
  const { createProject } = await import("../src/lib/db/project-repo");
  const { initStageRecord } = await import("../src/lib/workflow/workflow");
  const { sendMessage } = await import("../src/lib/ai/consultation");
  const { loadPrompt } = await import("../src/lib/ai/loader");
  const { saveConsultationMessages } = await import("../src/lib/db/stage-repo");

  console.log("=== S1 交互式咨询 ===\n");

  // 创建项目
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  const name = await ask("品牌名称: ");
  const category = await ask("品类方向 (可选): ");

  const project = await createProject(name, category || "");
  if (!project) { console.error("创建项目失败"); process.exit(1); }
  console.log(`项目已创建: ${project.name} (${project.id})\n`);

  await initStageRecord(project.id, 1);

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  console.log("开始 S1 咨询（输入 /done 结束，/exit 退出）\n");

  while (true) {
    const input = await ask("你 > ");
    if (input === "/exit") { rl.close(); process.exit(0); }
    if (input === "/done") break;

    console.log("\nAI 思考中...\n");

    const systemPrompt = loadPrompt({
      stage: 1,
      mode: "consultation",
      variables: { 品牌名: project.name, 品类: project.category || "" },
    });

    const response = await sendMessage(
      {
        stage: 1,
        history,
        variables: { 品牌名: project.name, 品类: project.category || "" },
      },
      input
    );

    console.log(`AI > ${response}\n`);

    history.push(
      { role: "user", content: input },
      { role: "assistant", content: response }
    );

    // 实时保存
    const messages = history.map((m, i) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
    }));
    await saveConsultationMessages(project.id, 1, messages as any);
  }

  rl.close();
  console.log(`\n咨询完成。共 ${history.length / 2} 轮对话。`);
  console.log(`项目 ID: ${project.id}`);
  console.log(`\n运行 Convergence: npx tsx scripts/run-stage.ts --mode converge ${project.id}`);
}

// ── Convergence 测试 ──────────────────────────────────

async function runConvergence(projectId?: string) {
  const { runStage } = await import("../src/lib/stage/stage-engine");
  const { founderVisionSchema } = await import("../src/lib/schemas/founder-vision");
  const { getProjectById } = await import("../src/lib/db/project-repo");
  const { getStageRecord } = await import("../src/lib/db/stage-repo");

  // 获取 project ID
  if (!projectId) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    projectId = await new Promise<string>((res) => rl.question("Project ID: ", res));
    rl.close();
  }

  const project = await getProjectById(projectId);
  if (!project) { console.error("项目不存在"); process.exit(1); }

  const record = await getStageRecord(projectId, 1);
  const history: Array<{ role: "user" | "assistant"; content: string }> =
    (record?.consultationMessages as any[])?.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? [];

  if (history.length === 0) {
    console.error("没有对话记录，请先运行 --mode consult");
    process.exit(1);
  }

  console.log(`\n=== S1 Convergence ===`);
  console.log(`项目: ${project.name} (${project.id})`);
  console.log(`对话轮次: ${history.length / 2}`);
  console.log(`开始 Convergence...\n`);

  const result = await runStage(
    {
      projectId,
      stage: 1,
      history,
      variables: { 品牌名: project.name, 品类: project.category || "" },
    },
    founderVisionSchema
  );

  if (result.success) {
    console.log("✅ Convergence 成功");
    console.log(JSON.stringify(result.output, null, 2));
    console.log(`\nRetries: ${result.retriesUsed}`);
  } else {
    console.log("❌ Convergence 失败");
    console.log("Errors:", result.errors);
    console.log(`Needs human review: ${result.needsHumanReview}`);
  }
}

// ── Full 模式 ─────────────────────────────────────────

async function runFull() {
  console.log("=== S1 Full 模式 ===\n");
  console.log("此模式运行完整的咨询 + 收敛流程\n");

  // 先跑咨询
  const { createProject } = await import("../src/lib/db/project-repo");
  const { initStageRecord } = await import("../src/lib/workflow/workflow");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  const name = await ask("品牌名称: ");
  const category = await ask("品类方向 (可选): ");

  const project = await createProject(name, category || "");
  if (!project) { console.error("创建项目失败"); process.exit(1); }

  await initStageRecord(project.id, 1);
  rl.close();

  // 跑咨询
  await runConsultationWithProject(project.id);

  // 跑收敛
  console.log("\n--- 自动触发 Convergence ---\n");
  await runConvergence(project.id);
}

async function runConsultationWithProject(projectId: string) {
  const { getProjectById } = await import("../src/lib/db/project-repo");
  const { sendMessage } = await import("../src/lib/ai/consultation");
  const { loadPrompt } = await import("../src/lib/ai/loader");
  const { saveConsultationMessages } = await import("../src/lib/db/stage-repo");

  const project = await getProjectById(projectId);
  if (!project) { console.error("项目不存在"); process.exit(1); }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  console.log(`项目: ${project.name} | 输入 /done 结束咨询\n`);

  while (true) {
    const input = await ask("你 > ");
    if (input === "/done") break;

    console.log("\nAI 思考中...\n");

    const response = await sendMessage(
      { stage: 1, history, variables: { 品牌名: project.name, 品类: project.category || "" } },
      input
    );

    console.log(`AI > ${response}\n`);
    history.push(
      { role: "user", content: input },
      { role: "assistant", content: response }
    );

    const messages = history.map((m, i) => ({
      role: m.role, content: m.content,
      timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
    }));
    await saveConsultationMessages(projectId, 1, messages as any);
  }

  rl.close();
}

// ── Main ──────────────────────────────────────────────

const projectIdArg = args.length > 1 && args[0] !== "--mode" ? args[0] : undefined;

switch (mode) {
  case "consult":
    runConsultation().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "converge":
    runConvergence(projectIdArg).catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "full":
    runFull().catch((e) => { console.error(e.message); process.exit(1); });
    break;
}
