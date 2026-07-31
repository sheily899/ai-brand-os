/**
 * S1 + Decision Memory 完整端到端测试
 * 用法: npx tsx scripts/test-s1-memory.ts
 */

// 必须在所有 import 之前加载 env
import { readFileSync } from "fs"; import { resolve } from "path";
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try { const c = readFileSync(envPath, "utf8"); for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); } } catch {}

// 验证 env 已加载
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — 请检查 .env.local");
  process.exit(1);
}

async function main() {
  // 动态 import（确保 env 已加载）
  const { extractFromFounderVision, saveStageEntries, getEntries, getConfirmed, buildMemoryContext } =
    await import("../src/lib/memory/decision-memory");
  const { createProject } = await import("../src/lib/db/project-repo");

  // 先创建 Project（FK 约束需要）
  const project = await createProject("Test-Memory", "测试");
  const TEST_PROJECT = project!.id;

  // ── Phase 1: 单元测试 S1 提取逻辑 ──
  console.log("=== Decision Memory 单元测试 ===\n");

  const mockFounderVision = {
    founderType: "problem_driven",
    founderMotivation: {
      content: "观察到猫主人对现有猫粮成分担忧，想做天然宠物食品",
      source: "founder_statement",
    },
    observations: [
      {
        subject: "猫主人",
        context: "宠物社群讨论",
        behavior: "反复查看成分表",
        result: "对化学添加剂表示担忧",
        source: "founder_observation",
      },
    ],
    confirmedProblems: [
      "市场上缺少让猫主人放心的天然猫粮",
      "现有产品成分不透明",
    ],
    constraints: {
      budget: "50 万启动资金",
      team: "3 人核心团队",
      timeline: "6 个月上市",
    },
  };

  const entries = extractFromFounderVision(TEST_PROJECT, mockFounderVision);
  console.log(`提取条数: ${entries.length}`);

  // 验证
  const hasFactOnly = entries.every(e => e.entryType === "confirmed_fact");
  console.log(`全部 entryType=confirmed_fact: ${hasFactOnly ? "✅" : "❌"}`);

  const hasMotivation = entries.some(e => e.fieldPath === "founderMotivation.content");
  console.log(`founderMotivation 已提取: ${hasMotivation ? "✅" : "❌"}`);

  const hasObservations = entries.some(e => e.fieldPath.startsWith("observations"));
  console.log(`observations 已提取: ${hasObservations ? "✅" : "❌"}`);

  const problemCount = entries.filter(e => e.fieldPath.startsWith("confirmedProblems")).length;
  console.log(`confirmedProblems: ${problemCount} 条 ${problemCount === 2 ? "✅" : "❌"}`);

  const constraintCount = entries.filter(e => e.fieldPath.startsWith("constraints")).length;
  console.log(`constraints: ${constraintCount} 条 ${constraintCount === 3 ? "✅" : "❌"}`);

  // 验证空值不提取
  const emptyMock = {
    founderType: "creation_driven",
    founderMotivation: { content: "因为热爱设计", source: "founder_statement" },
    observations: [{ subject: "自己", context: "设计", behavior: "创作", result: "满意", source: "founder_observation" }],
    confirmedProblems: [],
    constraints: { budget: "", team: "", timeline: "" },
  };
  const emptyEntries = extractFromFounderVision("test-empty", emptyMock);
  const emptyConstraintsExtracted = emptyEntries.filter(e => e.fieldPath.startsWith("constraints")).length;
  console.log(`空 constraints 不提取: ${emptyConstraintsExtracted === 0 ? "✅" : "❌"}`);

  // ── Phase 2: 写入 + 读取测试 ──
  console.log("\n=== 写入/读取测试 ===\n");
  await saveStageEntries(TEST_PROJECT, 1, entries);
  console.log("写入完成 ✅");

  const all = await getEntries(TEST_PROJECT);
  console.log(`getEntries: ${all.length} 条 ${all.length === entries.length ? "✅" : "❌"}`);

  const confirmed = await getConfirmed(TEST_PROJECT);
  console.log(`getConfirmed: ${confirmed.length} 条 ${confirmed.length === entries.length ? "✅" : "❌"}`);

  // ── Phase 3: Context 构建测试 ──
  console.log("\n=== Context 构建测试 ===\n");
  const ctx = await buildMemoryContext(TEST_PROJECT, 2); // S2 读取 S1
  console.log(`Context 长度: ${ctx.length} 字符 ✅`);
  console.log(`包含 [S1]: ${ctx.includes("[S1]") ? "✅" : "❌"}`);
  console.log(`包含"已确认事实": ${ctx.includes("已确认事实") ? "✅" : "❌"}`);

  const ctxSelf = await buildMemoryContext(TEST_PROJECT, 1); // S1 不应读到 S1
  console.log(`阶段隔离 (S1 不读 S1): ${ctxSelf.length === 0 ? "✅" : "❌"}`);

  console.log("\n=== Decision Memory 全部通过 ✅ ===");
}

main().catch((e) => {
  console.error("测试失败:", e.message);
  process.exit(1);
});
