/**
 * S4 Path B 分支验证测试 v2
 *
 * 验证 stage4-consultation.md 新增的"抽象标签型"降级追问框架是否生效。
 *
 * v2 改进：使用 LLM 模拟 founder（而非硬编码回复），
 * founder 自然耗尽消费者知识，不人为截断。
 *
 * 测试设计：
 * - 构造一个只能给人口标签、无法描述具体消费者的创始人
 * - 只跑 S4 consultation（S1-S3 fast-forward）
 * - Founder 由 LLM 扮演，诚实反映自身消费者知识的边界
 * - 验证：轮次 ≤8、AI 不反复追问同一角度、Path B 三角度至少出现 2 个
 *
 * 用法：npx tsx scripts/test-s4-path-b.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ── 加载 .env.local ──────────────────────────────────────

const envPath = resolve(__dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  console.error(".env.local 未找到");
  process.exit(1);
}

// ── 抽象标签型创始人定义 ─────────────────────────────────

const PROFILE = {
  brandName: "轻醒",
  category: "功能性饮品",
  founder: "李明，31岁，男性，前互联网运营总监",
  background:
    "在互联网公司做了7年运营后离职创业。他发现身边同事几乎人手一杯咖啡或功能饮料，" +
    "但不是因为喜欢——是因为不得不。他想做一款能提神但没有咖啡因副作用的功能饮品，" +
    "用中医草本配方。目前产品还在研发阶段，他本人对产品配方很有研究，" +
    "但对消费者只有模糊的认知——他没有做过任何消费者访谈，也没有观察过任何具体的个人。",
  observations:
    "1) 办公室下午2-4点是效率低谷期，同事们集体犯困 2) 有人喝完咖啡心悸、失眠，" +
    "有人喝完功能饮料胃不舒服 3) 大家都是边喝边抱怨，但第二天继续喝——因为没有替代方案",
  constraints: "自有资金15万，一人创业，产品还在研发阶段",
  founderType: "problem_driven" as const,
};

// ── 预置 S1-S3 结构化数据（让 S4 有 DM Context）─────────

const MOCK_S1_OUTPUT = {
  founderType: "problem_driven",
  founderMotivation: {
    content: "观察到办公室同事对现有功能饮品的健康副作用普遍不满，想做更健康的功能饮品",
    source: "founder_observation",
  },
  observations: [{
    subject: "办公室白领",
    context: "互联网公司办公环境",
    behavior: "下午困了就喝咖啡或功能饮料，边喝边抱怨副作用",
    result: "没有健康的替代方案可选",
    source: "founder_observation",
  }],
  confirmedProblems: [
    "现有功能饮品（咖啡/红牛等）有明确健康副作用",
    "办公室人群下午效率低谷期缺乏健康的提神方案",
  ],
  userHypothesis: {
    description: "25-35岁一线城市办公室白领，有健康意识但只能在现有选项中妥协",
    evidenceLevel: "founder_assumption",
    keyBehaviors: "下午犯困→找提神饮品→在咖啡/功能饮料中随便选一个",
  },
  constraints: { budget: "15万", team: "1人", timeline: "6个月" },
};

const MOCK_S2_OUTPUT = {
  industryOverview: "功能性饮品市场年增长率12%，健康化是核心趋势",
  categoryDefinition: "草本功能性饮品，替代传统咖啡因饮品的健康提神方案",
  marketSize: "国内功能饮品市场约800亿",
  growthDrivers: ["健康意识提升", "办公室场景刚需", "中医草本认知度提高"],
  targetSegment: "25-35岁一线城市办公室白领",
};

const MOCK_S3_OUTPUT = {
  marketOverview: "草本功能饮品处于早期阶段，尚无头部品牌",
  opportunityDirections: [
    "替代咖啡因的健康提神方案——市场空白明显",
    "办公室场景的即时饮品消费——便利性需求强",
  ],
  experienceGaps: [
    "消费者对'草本提神'的认知度低，需要教育",
    "现有草本饮品口感普遍不好",
  ],
};

// ── Founder LLM 模拟器 ──────────────────────────────────

function buildFounderSystemPrompt(stage: number): string {
  return `你正在扮演一位真实的品牌创始人，正在与 AI 品牌战略顾问进行第 ${stage} 阶段咨询对话。

## 你的身份

- 品牌名：${PROFILE.brandName}
- 行业/品类：${PROFILE.category}
- 创始人背景：${PROFILE.founder}
- 你的故事：${PROFILE.background}

## 你对行业的观察

${PROFILE.observations}

## 你的经营约束

${PROFILE.constraints}

## 你的消费者知识边界（极其重要——决定本次测试的成败）

你是一个对消费者了解极其有限的创始人。你**从未**做过消费者访谈，**从未**近距离观察过任何具体用户的行为，你对消费者的了解全部来自"在办公室里大家一起上班"这种模糊的群体共处经验。

**硬性规则（违反将导致测试无效）：**
1. 你的回答中**不能出现任何具体个体的故事**。禁止说"有一个同事""我们组有个姑娘""我记得有一次XX做了YY"。你只有群体印象——"大家下午都犯困""同事们都在抱怨咖啡副作用"这类表述。
2. 如果有人问你"能描述一个具体的人吗"，你诚实回答"说实话我没有认真观察过一个具体的人，我看到的都是群体现象"。
3. 如果有人问你"她的一天怎么过"，你只能描述你想象中一个普通白领的典型一天（"大概就是早上挤地铁、到公司开会、中午点外卖..."），而不是某个真实的人。
4. 你对"哪些人不适合这个产品"有判断（因为了解品类边界），这部分可以展开说。
5. **不主动提出结束**：不要用"差不多就是这样""说的比较完整了""聊得差不多了"等收束语。让 AI 来判断。如果你确实没有新信息了，诚实地重复或简化之前的说法，而不是宣布结束。
6. 短回复：每次 50-150 字。`;
}

async function simulateFounderResponse(
  aiMessage: string,
  systemPrompt: string,
  historySoFar: Array<{ role: string; content: string }>
): Promise<string> {
  const { getLLMProvider } = await import("../src/lib/ai/provider");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = historySoFar.slice(-12);
  for (const m of recentHistory) {
    messages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  messages.push({ role: "user", content: aiMessage });

  const provider = getLLMProvider();
  const response = await provider.chat(messages, { temperature: 0.7, maxTokens: 512 });
  return response.trim();
}

// ── 主程序 ──────────────────────────────────────────────

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { createProject } = await import("../src/lib/db/project-repo");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { initStageRecord } = await import("../src/lib/workflow/workflow");
  const { sendMessage } = await import("../src/lib/ai/consultation");
  const { saveConsultationMessages } = await import("../src/lib/db/stage-repo");
  const { buildMemoryContext } = await import("../src/lib/memory/decision-memory");
  const { extractFromFounderVision, saveStageEntries, extractFromBusinessContext, extractFromMarketInsights } =
    await import("../src/lib/memory/decision-memory");

  console.log("═══════════════════════════════════════════");
  console.log(`S4 Path B 分支验证测试 v2 (LLM founder)`);
  console.log(`品牌: ${PROFILE.brandName} | 品类: ${PROFILE.category}`);
  console.log(`创始人: 抽象标签型，LLM 自然模拟`);
  console.log("═══════════════════════════════════════════\n");

  // ── Step 1: 创建项目 ────────────────────────────────
  console.log("[1/5] 创建项目...");
  const project = await createProject(PROFILE.brandName, PROFILE.category);
  if (!project) { console.error("创建项目失败"); process.exit(1); }
  console.log(`  项目 ID: ${project.id}\n`);

  // ── Step 2: 预置 S1-S3 ──────────────────────────────
  console.log("[2/5] 预置 S1-S3 Decision Memory...");

  const s1Entries = extractFromFounderVision(project.id, MOCK_S1_OUTPUT as any);
  await saveStageEntries(project.id, 1, s1Entries);
  const s2Entries = extractFromBusinessContext(project.id, MOCK_S2_OUTPUT as any);
  await saveStageEntries(project.id, 2, s2Entries);
  const s3Entries = extractFromMarketInsights(project.id, MOCK_S3_OUTPUT as any);
  await saveStageEntries(project.id, 3, s3Entries);

  const { eq, and } = await import("drizzle-orm");
  const now = new Date();
  for (const stage of [1, 2, 3]) {
    await initStageRecord(project.id, stage);
    const output = stage === 1 ? MOCK_S1_OUTPUT : stage === 2 ? MOCK_S2_OUTPUT : MOCK_S3_OUTPUT;
    await db.update(stageRecord)
      .set({ status: "completed", structuredOutput: output as any, completedAt: now })
      .where(and(eq(stageRecord.projectId, project.id), eq(stageRecord.stageNumber, stage)));
  }
  console.log(`  S1: ${s1Entries.length} | S2: ${s2Entries.length} | S3: ${s3Entries.length}\n`);

  // ── Step 3: 初始化 S4 ────────────────────────────────
  console.log("[3/5] 初始化 S4 + DM Context...");
  await initStageRecord(project.id, 4);
  const dmCtx = await buildMemoryContext(project.id, 4);
  console.log(`  DM: ${dmCtx?.length ?? 0} chars\n`);

  // ── Step 4: S4 Consultation（LLM founder）────────────
  console.log("[4/5] 运行 S4 Consultation（LLM founder 自然模拟）...\n");

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  const MAX_ROUNDS = 8;
  const founderSystemPrompt = buildFounderSystemPrompt(4);
  let roundCount = 0;

  // 首轮：AI 自动开场
  const openingCtx = {
    stage: 4,
    history: [] as Array<{ role: "user" | "assistant"; content: string }>,
    variables: { 品牌名: PROFILE.brandName, 品类: PROFILE.category },
    decisionMemoryContext: dmCtx || undefined,
  };

  const openingMsg = await sendMessage(openingCtx, "[SYSTEM] 请开始本阶段的咨询。");
  history.push({ role: "assistant", content: openingMsg });
  console.log(`  [AI 开场] ${openingMsg.slice(0, 150)}...\n`);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastAiMsg = history.filter(m => m.role === "assistant").pop()?.content ?? "";
    console.log(`  ── Round ${round + 1}/${MAX_ROUNDS} ──`);

    // LLM founder 回复
    const founderMsg = await simulateFounderResponse(lastAiMsg, founderSystemPrompt, history);
    console.log(`  [Founder] ${founderMsg.slice(0, 150)}${founderMsg.length > 150 ? "..." : ""}`);

    // AI 回复
    const ctx = {
      stage: 4,
      history: history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      variables: { 品牌名: PROFILE.brandName, 品类: PROFILE.category },
      decisionMemoryContext: dmCtx || undefined,
    };

    const aiMsg = await sendMessage(ctx, founderMsg);
    history.push(
      { role: "user", content: founderMsg },
      { role: "assistant", content: aiMsg }
    );

    console.log(`  [AI]     ${aiMsg.slice(0, 150)}${aiMsg.length > 150 ? "..." : ""}`);

    // 检测 Path B 信号
    const signals: string[] = [];
    if (/场景假设|试着.*还原|试着.*想象|假设.*符合.*人.*试着|还原.*那个.*时刻|还原.*那个.*瞬间/.test(aiMsg)) signals.push("场景假设");
    if (/反向排除|确定不是.*用户|哪类人.*不是|谁.*不需要|排除.*人群|不是.*你的.*用户/.test(aiMsg)) signals.push("反向排除");
    if (/行为锚定|最早.*意识|最早.*注意|看到.*什么.*印象|印象.*深刻.*瞬间|什么.*具体.*事.*场景/.test(aiMsg)) signals.push("行为锚定");
    if (/待验证|创始人假设.*消费者|缺少.*具体.*行为|未经.*验证|目前的判断|目前.*了解.*这些/.test(aiMsg)) signals.push("标记待验证");
    if (round >= 3 && /描述.*具体.*人|具体.*描述.*人|能.*再.*具体.*一点/.test(aiMsg)) signals.push("⚠️ 无效重复追问");

    if (signals.length > 0) console.log(`  [检测] ${signals.join(" | ")}`);

    roundCount = round + 1;

    // 检测 AI 是否主动发起确认总结
    if (/复述一下|确认一下.*消费者|理解.*是否.*准确/.test(aiMsg) && aiMsg.length > 200) {
      console.log(`  → AI 主动触发确认总结\n`);
      break;
    }
  }

  // ── Step 5: 保存 + 报告 ──────────────────────────────
  console.log(`[5/5] 保存结果...`);

  await saveConsultationMessages(project.id, 4,
    history.map((m, i) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
    }))
  );

  const allAiMsgs = history.filter(m => m.role === "assistant").map(m => m.content);
  const allAiText = allAiMsgs.join("\n");

  const pathBScene = /场景假设|试着.*还原|试着.*想象|假设.*符合.*人.*试着|还原.*那个.*时刻|还原.*那个.*瞬间/.test(allAiText);
  const pathBExclude = /反向排除|确定不是.*用户|哪类人.*不是|谁.*不需要|排除.*人群|不是.*你的.*用户/.test(allAiText);
  const pathBAnchor = /行为锚定|最早.*意识|最早.*注意|看到.*什么.*印象|印象.*深刻.*瞬间|什么.*具体.*事.*场景/.test(allAiText);
  const pathBFlag = /待验证|创始人假设.*消费者|缺少.*具体.*行为|未经.*验证|目前的判断|目前.*了解.*这些/.test(allAiText);
  const aiInitiatedSummary = /复述一下|确认一下.*消费者|理解.*是否.*准确|以上.*目前.*判断.*记下了/.test(allAiText);

  const lateMsgs = allAiMsgs.slice(3);
  const badRepeat = lateMsgs.some(m =>
    /能.*描述.*一个.*具体.*人|能.*具体.*描述.*一下.*这个人|可以.*再.*具体.*一点.*吗/.test(m)
  );

  let score = 0;
  const checks: string[] = [];

  checks.push(`轮次控制: ${roundCount} 轮 ${roundCount <= 8 ? "✅" : "❌"}`);
  if (roundCount <= 8) score++;
  checks.push(`场景假设: ${pathBScene ? "✅" : "❌"}`);
  if (pathBScene) score++;
  checks.push(`反向排除: ${pathBExclude ? "✅" : "❌"}`);
  if (pathBExclude) score++;
  checks.push(`行为锚定: ${pathBAnchor ? "✅" : "❌"}`);
  if (pathBAnchor) score++;
  checks.push(`AI主动收束: ${aiInitiatedSummary ? "✅" : "❌"}`);
  if (aiInitiatedSummary) score++;
  checks.push(`无无效重复追问: ${!badRepeat ? "✅" : "❌"}`);
  if (!badRepeat) score++;
  checks.push(`Path B 三角度全覆盖: ${([pathBScene, pathBExclude, pathBAnchor].filter(Boolean).length >= 3) ? "✅" : "❌"}`);
  if ([pathBScene, pathBExclude, pathBAnchor].filter(Boolean).length >= 3) score++;

  const maxScore = 7;
  const passed = score >= 6;

  const report = [
    `# S4 Path B 分支验证 — 测试报告 v2`,
    ``,
    `**测试时间**: ${new Date().toISOString()}`,
    `**品牌**: ${PROFILE.brandName} (${PROFILE.category})`,
    `**创始人类型**: 抽象标签型（LLM 自然模拟）`,
    `**测试文件**: scripts/test-s4-path-b.ts`,
    ``,
    `## 验证结果: ${passed ? "✅ 通过" : "❌ 未通过"} (${score}/${maxScore})`,
    ``,
    `| 检查项 | 结果 |`,
    `|--------|------|`,
    ...checks.map(c => `| ${c.replace(/: /, " | ")} |`),
    ``,
    `## 关键指标`,
    ``,
    `- 轮次: ${roundCount}/${MAX_ROUNDS}`,
    `- Path B 角度: ${[pathBScene && "场景假设", pathBExclude && "反向排除", pathBAnchor && "行为锚定"].filter(Boolean).join("、") || "无"}`,
    `- AI 主动收束: ${aiInitiatedSummary ? "是 ✅" : "否 ❌"}`,
    `- 无效重复追问: ${badRepeat ? "是 ⚠️" : "否"}`,
    ``,
    `---`,
    ``,
    `## 完整对话`,
    ``,
    ...history.map((m, i) => {
      const label = m.role === "assistant" ? "🤖 AI 顾问" : "👤 创始人";
      return `### ${label} (第 ${Math.floor(i/2)+1} 轮)\n\n${m.content}\n`;
    }),
  ];

  const outFile = `temp/s4-path-b-test-v2-${Date.now()}.md`;
  writeFileSync(outFile, report.join("\n"), "utf8");

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`验证: ${passed ? "✅ 通过" : "❌ 未通过"} (${score}/${maxScore})`);
  console.log(`轮次: ${roundCount}/${MAX_ROUNDS}`);
  console.log(`Path B 信号: ${[pathBScene && "场景假设", pathBExclude && "反向排除", pathBAnchor && "行为锚定"].filter(Boolean).join("、") || "无"}`);
  console.log(`无效重复追问: ${badRepeat ? "⚠️ 是" : "✅ 否"}`);
  console.log(`完整对话: ${outFile}`);
  console.log(`═══════════════════════════════════════════\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error("测试失败:", e);
  process.exit(1);
});
