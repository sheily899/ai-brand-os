#!/usr/bin/env npx tsx
/**
 * run-batch.ts — 批量测试脚本
 *
 * 读取 reference/brand-domain-cases.md 中的 5 个虚构创始人画像，
 * 自动模拟 S1→S8 完整咨询流程，统计每阶段轮次和结果。
 *
 * 用法：
 *   npx tsx scripts/run-batch.ts                    # 运行全部 5 个案例
 *   npx tsx scripts/run-batch.ts --case 1            # 仅运行案例 1
 *   npx tsx scripts/run-batch.ts --case 1 --stage 3  # 案例 1 仅运行 Stage 3
 *   npx tsx scripts/run-batch.ts --dry-run           # 仅解析案例文件，不调用 LLM
 */

import { readFileSync, existsSync } from "fs";
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
  console.warn("[run-batch] .env.local 未找到，使用系统环境变量");
}

// ── CLI 参数解析 ──────────────────────────────────────────

const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const TARGET_CASE = argVal("--case") ? parseInt(argVal("--case")!) : undefined;
const TARGET_STAGE = argVal("--stage") ? parseInt(argVal("--stage")!) : undefined;
const DRY_RUN = args.includes("--dry-run");
const MAX_ROUNDS = argVal("--max-rounds") ? parseInt(argVal("--max-rounds")!) : 10;

// ── 常量 ──────────────────────────────────────────────────

const CASES_PATH = resolve(process.cwd(), "reference/brand-domain-cases.md");

const STAGE_NAMES: Record<number, string> = {
  1: "用户访谈",
  2: "商业背景分析",
  3: "市场机会分析",
  4: "消费者洞察",
  5: "竞争判断",
  6: "品牌核心战略",
  7: "视觉策略",
  8: "内容规划",
};

/** 每个阶段的建议最大轮数（基于信息密度需求） */
const STAGE_MAX_ROUNDS: Record<number, number> = {
  1: 8,
  2: 5,
  3: 5,
  4: 5,
  5: 5,
  6: 6,
  7: 4,
  8: 4,
};

// ── 类型 ──────────────────────────────────────────────────

interface FounderProfile {
  caseIndex: number;
  caseName: string;
  brandName: string;
  category: string;
  founder: string;
  background: string;
  observations: string;
  constraints: string;
  founderType: string;
}

interface StageRecord {
  stage: number;
  name: string;
  rounds: number;
  convergeSuccess: boolean;
  convergeErrors?: string[];
  advanceSuccess: boolean;
  advanceGate?: string;
  searchExecuted: boolean;
  openingMessage?: string;
  /** openingMessage 是否具有报告语体特征 */
  openingIsReportLike: boolean;
  /** Phase 3 audit info */
  auditGate?: string;
  auditRuleIssues?: number;
  auditRefIssues?: number;
  auditAIScore?: number;
  auditAIGate?: string;
}

interface CaseResult {
  profile: FounderProfile;
  stages: StageRecord[];
  totalRounds: number;
  startTime: number;
  endTime: number;
}

// ── 案例解析 ──────────────────────────────────────────────

/** 从 brand-domain-cases.md 解析 5 个创始人画像 */
function parseProfiles(): FounderProfile[] {
  if (!existsSync(CASES_PATH)) {
    console.error(`[run-batch] 案例文件不存在: ${CASES_PATH}`);
    process.exit(1);
  }

  const content = readFileSync(CASES_PATH, "utf8");

  // 定位 "5 个虚构创业者画像" 章节
  const sectionStart = content.indexOf("## 5 个虚构创业者画像");
  if (sectionStart === -1) {
    console.error("[run-batch] 未找到「5 个虚构创业者画像」章节");
    process.exit(1);
  }

  // 定位章节结束（下一个 ## 或 运行记录）
  const afterSection = content.slice(sectionStart);
  const sectionEnd = afterSection.search(/\n---\n\n## 运行记录/);
  const sectionContent =
    sectionEnd >= 0 ? afterSection.slice(0, sectionEnd) : afterSection;

  // 按画像标题拆分
  const profileBlocks = sectionContent.split(/### 画像 \d+/).slice(1);
  const profiles: FounderProfile[] = [];

  for (let i = 0; i < profileBlocks.length; i++) {
    const block = profileBlocks[i];
    if (!block.trim()) continue;

    const profile = parseProfileBlock(i + 1, block);
    if (profile) profiles.push(profile);
  }

  return profiles;
}

/** 从单个画像文本块解析字段 */
function parseProfileBlock(
  caseIndex: number,
  block: string
): FounderProfile | null {
  // 提取案例名（标题行：xxx · yyy）
  const nameMatch = block.match(/^[：:]\s*(.+)/m);
  const caseName = nameMatch?.[1]?.trim() ?? `案例 ${caseIndex}`;

  // 提取表格字段
  function extractField(label: string): string {
    const regex = new RegExp(
      `\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`,
      "i"
    );
    const m = block.match(regex);
    return m?.[1]?.trim() ?? "";
  }

  const brandName = extractField("品牌名");
  const category = extractField("行业");
  const founder = extractField("创始人");
  const background = extractField("背景故事");
  const observations = extractField("关键观察");
  const constraints = extractField("约束");
  const founderType = extractField("创始人类型");

  if (!brandName) {
    console.warn(`[run-batch] 画像 ${caseIndex} 缺少品牌名，跳过`);
    return null;
  }

  return {
    caseIndex,
    caseName,
    brandName,
    category,
    founder,
    background,
    observations,
    constraints,
    founderType,
  };
}

// ── Founder 模拟器 ────────────────────────────────────────

/** 构建创始人角色扮演 system prompt */
function buildFounderSystemPrompt(
  profile: FounderProfile,
  stage: number
): string {
  return `你正在扮演一位真实的品牌创始人，正在与 AI 品牌战略顾问进行第 ${stage} 阶段咨询对话。

## 你的身份

- 品牌名：${profile.brandName}
- 行业/品类：${profile.category}
- 创始人背景：${profile.founder}
- 你的故事：${profile.background}

## 你对行业的观察

${profile.observations}

## 你的经营约束

${profile.constraints}

## 你的创始人类型

${profile.founderType === "problem_driven" ? "问题驱动型 — 因为看到了行业中具体的问题/痛点而创业" : "创造驱动型 — 因为热爱和专业追求而创业"}

## 当前咨询阶段：Stage ${stage} — ${STAGE_NAMES[stage] ?? ""}

## 行为规则

1. **自然对话**：用真实创始人的口语化中文回答，可以有适度的犹豫、热情或困惑。
2. **基于已知信息回答**：只回答你在背景故事和观察中知道的内容。如果 AI 问到你没有的信息，诚实地说"这方面我还没有仔细了解过"或"这个我不太确定"。
3. **不要一次性倾倒信息**：每次只回答 AI 提出的具体问题，不要在一轮对话中把背景故事全部说完。让 AI 通过追问逐步深入。
4. **保持创业者特质**：${profile.founderType === "problem_driven" ? "你对行业痛点有深刻认知，说话务实、关注解决方案的可行性" : "你对品质有执念，说话带有专业自信，关注细节和差异化的表达"}
5. **短回复**：每次回复控制在 50-150 字，像真实的聊天对话，不要写长篇大论。
6. **${profile.founder.split("，")[0] ?? "创始人"}的语气**：保持你作为${profile.founder.split("，")[2]?.includes("女") ? "女性" : "男性"}创业者的真实语气。
7. **自主判断收束时机**：当你觉得当前话题已经讨论充分、没有新的实质性信息可以补充时，可以自然地表达"我觉得这方面的信息已经讨论得比较充分了"或类似的收束意愿。不要强行生硬地切换话题——先正常回答问题，再自然过渡。也不要在对话刚开始不久就急着收束，确保充分交流后再表达。`;
}

/** 生成 founder 对 AI 问题的回复 */
async function simulateFounderResponse(
  profile: FounderProfile,
  stage: number,
  aiMessage: string,
  historySoFar: Array<{ role: string; content: string }>
): Promise<string> {
  if (DRY_RUN) {
    return `[DRY RUN] 这是 ${profile.brandName} 创始人对 Stage ${stage} AI 提问的模拟回复。`;
  }

  const { getLLMProvider } = await import("../src/lib/ai/provider");

  const systemPrompt = buildFounderSystemPrompt(profile, stage);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // 注入历史对话（最近 6 轮避免 token 过大）
  const recentHistory = historySoFar.slice(-12); // 最近 6 轮 = 12 条消息
  for (const m of recentHistory) {
    messages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }

  // AI 的最新消息作为 user 输入给 founder simulator
  messages.push({ role: "user", content: aiMessage });

  try {
    const provider = getLLMProvider();
    const response = await provider.chat(messages, {
      temperature: 0.7,
      maxTokens: 512,
    });
    return response.trim();
  } catch (e: any) {
    console.error(`[founder-sim] LLM 调用失败: ${e.message}`);
    // 降级：返回简单回复
    return `好的，我理解了。让我想想还有什么可以补充的。`;
  }
}

// ── 报告语体检测 ──────────────────────────────────────────

/** 简单启发式检测文本是否具有报告语体特征 */
function detectReportStyle(text: string): boolean {
  if (!text || text.length < 30) return false;

  let score = 0;

  // 报告语体信号
  const formalPatterns = [
    // 原有
    /基于以上/,
    /综合来看/,
    /从.*维度/,
    /数据显示/,
    /根据.*分析/,
    /整体而言/,
    /核心发现/,
    /覆盖.*维度/,
    /战略意义/,
    /初步判断/,
    /需要关注/,
    /机会在于/,
    /风险.*在于/,
    /建议.*方向/,
    /本阶段/,
    /关键洞察/,
    // 2026-08-01 新增：AI 实际高频使用的专业咨询语体模式
    /我们进入/,
    /前序阶段/,
    /这个阶段/,
    /已确认[的了]/,
    /先回顾一下/,
    /品牌(的|核心)/,
    /【搜索发现】/,
  ];

  for (const p of formalPatterns) {
    if (p.test(text)) score++;
  }

  // 口语化信号（反向）
  const casualPatterns = [
    /哈哈/,
    /吧$/,
    /呢$/,
    /呀/,
    /哦/,
    /嘛/,
    /超/,
    /挺/,
    /有点/,
    /对吧/,
  ];

  for (const p of casualPatterns) {
    if (p.test(text)) score--;
  }

  return score >= 2;
}

// ── 单案例 S1→S8 运行 ────────────────────────────────────

async function runCase(
  profile: FounderProfile
): Promise<CaseResult> {
  const { createProject } = await import("../src/lib/db/project-repo");
  const { initStageRecord } = await import("../src/lib/workflow/workflow");
  const { sendMessage } = await import("../src/lib/ai/consultation");
  const { runStage, advanceToNextStage } = await import("../src/lib/stage/stage-engine");
  const { saveConsultationMessages } = await import("../src/lib/db/stage-repo");
  const { buildMemoryContext } = await import("../src/lib/memory/decision-memory");

  // Schema 映射
  const { founderVisionSchema } = await import("../src/lib/schemas/founder-vision");
  const { businessContextSchema } = await import("../src/lib/schemas/business-context");
  const { marketInsightsSchema } = await import("../src/lib/schemas/market-insights");
  const { consumerInsightSchema } = await import("../src/lib/schemas/consumer-insight");
  const { competitiveInsightsSchema } = await import("../src/lib/schemas/competitive");
  const { brandStrategySchema } = await import("../src/lib/schemas/brand-strategy");
  const { visualStrategySchema } = await import("../src/lib/schemas/visual-strategy");
  const { contentStrategySchema } = await import("../src/lib/schemas/content-strategy");

  const SCHEMAS: Record<number, any> = {
    1: founderVisionSchema,
    2: businessContextSchema,
    3: marketInsightsSchema,
    4: consumerInsightSchema,
    5: competitiveInsightsSchema,
    6: brandStrategySchema,
    7: visualStrategySchema,
    8: contentStrategySchema,
  };

  const startTime = Date.now();
  const stages: StageRecord[] = [];

  // 创建项目
  if (DRY_RUN) {
    console.log(`\n  [DRY RUN] 创建项目: ${profile.brandName}`);
  }

  const project = await createProject(profile.brandName, profile.category || "");
  if (!project) {
    console.error(`  ❌ 创建项目失败: ${profile.brandName}`);
    return { profile, stages, totalRounds: 0, startTime, endTime: Date.now() };
  }

  console.log(`  项目 ID: ${project.id}`);

  let openingMessage: string | undefined;
  let searchContext: string | undefined;

  // ── S1→S8 逐阶段运行 ───────────────────────────────
  for (let stage = 1; stage <= 8; stage++) {
    // 支持 --stage 参数跳过阶段
    if (TARGET_STAGE !== undefined && stage !== TARGET_STAGE) continue;

    const maxRounds = STAGE_MAX_ROUNDS[stage] ?? 5;
    console.log(`\n  ── Stage ${stage} (${STAGE_NAMES[stage]}) ──`);

    if (DRY_RUN) {
      stages.push({
        stage,
        name: STAGE_NAMES[stage],
        rounds: maxRounds,
        convergeSuccess: true,
        advanceSuccess: true,
        searchExecuted: stage === 2 || stage === 3 || stage === 5 || stage === 8,
        openingMessage: "[DRY RUN] 开场白...",
        openingIsReportLike: true,
      });
      continue;
    }

    // 初始化阶段
    await initStageRecord(project.id, stage);

    // ── Consultation 循环 ──────────────────────────────
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    let roundCount = 0;

    for (let round = 1; round <= maxRounds; round++) {
      if (round === 1 && stage === 1 && !openingMessage) {
        // S1 首轮：创始人主动开口介绍
        const founderIntro = `你好！我是${profile.founder.split("，")[0] ?? profile.brandName + "的创始人"}，我做了一个品牌叫「${profile.brandName}」，主要做${profile.category || "消费品"}。我想系统地梳理一下品牌战略，不知道从哪里开始。`;

        console.log(`    轮次 ${round}/${maxRounds}: 创始人开场...`);

        const ctx = {
          stage,
          history: [] as Array<{ role: "user" | "assistant"; content: string }>,
          variables: { 品牌名: profile.brandName, 品类: profile.category },
          decisionMemoryContext: await buildMemoryContext(project.id, stage) || undefined,
        };

        const aiResponse = await sendMessage(ctx, founderIntro);

        history.push(
          { role: "user", content: founderIntro },
          { role: "assistant", content: aiResponse }
        );

        // 保存
        await saveConsultationMessages(
          project.id, stage,
          history.map((m, i) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
          }))
        );

        roundCount = round;
      } else if (round === 1 && openingMessage) {
        // S2-S8 首轮：AI 已有 opening message，founder 回复它，AI 再跟进提问
        console.log(`    轮次 ${round}/${maxRounds}: 回复 AI 开场白...`);

        const founderMsg = await simulateFounderResponse(
          profile, stage, openingMessage, []
        );

        // 构造对话上下文并发起 AI 跟进回应
        const round1Ctx = {
          stage,
          history: [
            { role: "assistant" as const, content: openingMessage },
            { role: "user" as const, content: founderMsg },
          ],
          variables: { 品牌名: profile.brandName, 品类: profile.category },
          decisionMemoryContext: await buildMemoryContext(project.id, stage) || undefined,
          includeSearchProtocol: [2, 3, 5, 8].includes(stage),
          searchContext,
        };

        const aiResponse = await sendMessage(round1Ctx, founderMsg);

        history.push(
          { role: "assistant", content: openingMessage },
          { role: "user", content: founderMsg },
          { role: "assistant", content: aiResponse }
        );

        // 保存完整首轮对话
        await saveConsultationMessages(
          project.id, stage,
          history.map((m, i) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
          }))
        );

        roundCount = round;
      } else {
        // 后续轮次：founder 回复 AI 上一轮的问题
        const lastAiMsg = history.filter(m => m.role === "assistant").pop()?.content ?? "";
        console.log(`    轮次 ${round}/${maxRounds}...`);

        const founderMsg = await simulateFounderResponse(
          profile, stage, lastAiMsg, history
        );

        const ctx = {
          stage,
          history: history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          variables: { 品牌名: profile.brandName, 品类: profile.category },
          decisionMemoryContext: await buildMemoryContext(project.id, stage) || undefined,
          includeSearchProtocol: [2, 3, 5, 8].includes(stage),
          searchContext,
        };

        const aiResponse = await sendMessage(ctx, founderMsg);

        history.push(
          { role: "user", content: founderMsg },
          { role: "assistant", content: aiResponse }
        );

        // 每轮保存一次
        await saveConsultationMessages(
          project.id, stage,
          history.map((m, i) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
          }))
        );

        roundCount = round;
      }
    }

    // ── Step: Convergence ──────────────────────────────
    console.log(`    触发 Convergence...`);
    let convergeSuccess = false;
    let convergeErrors: string[] | undefined;
    let stageOutput: Record<string, any> | undefined;

    try {
      const convergeResult = await runStage(
        {
          projectId: project.id,
          stage,
          history,
          variables: { 品牌名: profile.brandName, 品类: profile.category },
        },
        SCHEMAS[stage]
      );

      convergeSuccess = convergeResult.success;
      convergeErrors = convergeResult.errors;
      stageOutput = convergeResult.output;

      if (convergeSuccess) {
        console.log(`    ✅ Converge 成功 (retries: ${convergeResult.retriesUsed})`);
      } else {
        console.log(`    ❌ Converge 失败: ${convergeResult.errors?.join("; ")}`);
      }
    } catch (e: any) {
      console.log(`    ❌ Converge 异常: ${e.message}`);
      convergeErrors = [e.message];
    }

    // ── Step: Advance ──────────────────────────────────
    console.log(`    触发 Advance...`);
    let advanceSuccess = false;
    let advanceGate: string | undefined;
    let searchExecuted = false;
    let auditGate = "—";
    let auditRuleIssues = 0;
    let auditRefIssues = 0;
    let auditAIScore: number | undefined;
    let auditAIGate = "—";

    try {
      if (convergeSuccess && stageOutput) {
        const advanceResult = await advanceToNextStage({
          projectId: project.id,
          currentStage: stage,
          stageOutput,
          brandName: profile.brandName,
          category: profile.category || "",
        });

        advanceSuccess = advanceResult.advanced;
        advanceGate = advanceResult.gateDecision;
        searchExecuted = advanceResult.searchExecuted;
        openingMessage = advanceResult.openingMessage;
        searchContext = advanceResult.searchContext;

        // Phase 3 audit capture
        const ar = advanceResult.auditReport;
        if (ar) {
          auditGate = ar.gateDecision ?? "—";
          auditRuleIssues = ar.ruleCheck?.issues?.length ?? 0;
          auditRefIssues = ar.referenceIssues?.length ?? 0;
          auditAIScore = ar.aiAudit?.totalScore ?? undefined;
          auditAIGate = ar.aiAudit?.gateRecommendation ?? "—";
        }

        if (advanceSuccess) {
          const searchInfo = searchExecuted ? " 🔍" : "";
          console.log(`    ✅ Advance 成功 → Stage ${advanceResult.nextStage}${searchInfo}`);

          if (advanceResult.openingMessage) {
            const preview = advanceResult.openingMessage.slice(0, 120).replace(/\n/g, " ");
            console.log(`      开场白预览: ${preview}...`);
          }
        } else {
          console.log(`    ❌ Advance 被阻止 (gate: ${advanceGate})`);
        }
        console.log(`      审计: Gate=${auditGate} | Rule=${auditRuleIssues} issue(s) | Ref=${auditRefIssues} issue(s) | AI Score=${auditAIScore ?? "N/A"} | AI Gate=${auditAIGate}`);
      } else {
        console.log(`    ⏭️ 跳过 Advance（Converge 失败）`);
      }
    } catch (e: any) {
      console.log(`    ❌ Advance 异常: ${e.message}`);
    }

    // 记录本阶段结果
    stages.push({
      stage,
      name: STAGE_NAMES[stage],
      rounds: roundCount,
      convergeSuccess,
      convergeErrors,
      advanceSuccess,
      advanceGate,
      searchExecuted,
      openingMessage: openingMessage?.slice(0, 500),
      openingIsReportLike: detectReportStyle(openingMessage ?? ""),
      auditGate,
      auditRuleIssues,
      auditRefIssues,
      auditAIScore,
      auditAIGate,
    });

    // 阶段失败不阻塞后续（下一阶段可能因依赖检查失败）
  }

  return {
    profile,
    stages,
    totalRounds: stages.reduce((sum, s) => sum + s.rounds, 0),
    startTime,
    endTime: Date.now(),
  };
}

// ── 结果输出 ──────────────────────────────────────────────

function printResults(results: CaseResult[]) {
  console.log("\n" + "=".repeat(78));
  console.log("  批量测试结果汇总");
  console.log("=".repeat(78));

  for (const result of results) {
    const { profile, stages, totalRounds, startTime, endTime } = result;
    const elapsed = ((endTime - startTime) / 1000).toFixed(0);

    console.log(`\n┌─ 案例 ${profile.caseIndex}: ${profile.brandName}`);
    console.log(`│  创始人: ${profile.founder.split("，")[0] ?? "—"}`);
    console.log(`│  行业: ${profile.category}  |  类型: ${profile.founderType}`);
    console.log(`│  耗时: ${elapsed}s  |  总轮次: ${totalRounds}`);

    if (stages.length === 0) {
      console.log(`│  ⚠️ 无阶段数据`);
      continue;
    }

    console.log(`│`);
    console.log(`│  阶段          轮次  Converge  Advance  Gate    Search  Audit`);
    console.log(`│  ────────────  ────  ────────  ───────  ──────  ──────  ────────────`);

    for (const s of stages) {
      const convergeIcon = s.convergeSuccess ? "✅" : "❌";
      const advanceIcon = s.advanceSuccess ? "✅" : s.advanceGate === "block" ? "⛔" : "—";
      const searchIcon = s.searchExecuted ? "🔍" : "—";
      const auditInfo = s.auditGate === "advance" ? "✅通过"
        : s.auditGate === "reoptimize" ? "⚠️优化"
        : s.auditGate === "block" ? "⛔阻止"
        : "—";

      console.log(
        `│  S${s.stage} ${s.name.padEnd(10)}  ${String(s.rounds).padStart(3)}   ${convergeIcon}        ${advanceIcon}       ${s.advanceGate?.padEnd(5) ?? "—".padEnd(5)}  ${searchIcon}      ${auditInfo}`
      );
    }

    // 汇总统计
    const convergeOk = stages.filter(s => s.convergeSuccess).length;
    const advanceOk = stages.filter(s => s.advanceSuccess).length;
    const searchStages = stages.filter(s => s.searchExecuted).length;
    const auditAdvance = stages.filter(s => s.auditGate === "advance").length;
    const auditReopt = stages.filter(s => s.auditGate === "reoptimize").length;
    const auditBlock = stages.filter(s => s.auditGate === "block").length;

    console.log(`│`);
    console.log(`│  📊 Converge: ${convergeOk}/${stages.length}  |  Advance: ${advanceOk}/${stages.length}`);
    console.log(`│  📊 Search: ${searchStages}  |  Audit: ✅${auditAdvance} ⚠️${auditReopt} ⛔${auditBlock}`);
    console.log(`└${"─".repeat(77)}`);
  }

  // ── 全局汇总 ──────────────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("  全局统计");
  console.log("=".repeat(78));

  const allStages = results.flatMap(r => r.stages);
  const totalRoundsAll = results.reduce((s, r) => s + r.totalRounds, 0);
  const convergeAllOk = allStages.filter(s => s.convergeSuccess).length;
  const advanceAllOk = allStages.filter(s => s.advanceSuccess).length;
  const reportLikeAll = allStages.filter(s => s.openingIsReportLike).length;

  console.log(`  总案例数: ${results.length} | 总阶段数: ${allStages.length} | 总轮次: ${totalRoundsAll}`);
  console.log(`  Converge 成功率: ${convergeAllOk}/${allStages.length} (${(convergeAllOk / allStages.length * 100).toFixed(0)}%)`);
  console.log(`  Advance 成功率: ${advanceAllOk}/${allStages.length} (${(advanceAllOk / allStages.length * 100).toFixed(0)}%)`);
  console.log(`  报告语体率: ${reportLikeAll}/${allStages.length} (${(reportLikeAll / allStages.length * 100).toFixed(0)}%)`);

  // 每阶段平均轮次
  console.log(`\n  各阶段平均轮次:`);
  for (let stage = 1; stage <= 8; stage++) {
    const stageResults = allStages.filter(s => s.stage === stage);
    if (stageResults.length === 0) continue;
    const avgRounds = stageResults.reduce((s, r) => s + r.rounds, 0) / stageResults.length;
    const bar = "█".repeat(Math.round(avgRounds));
    console.log(`    S${stage} ${STAGE_NAMES[stage].padEnd(10)} ${avgRounds.toFixed(1)} 轮 ${bar}`);
  }

  // 失败详情
  const failedConverge = allStages.filter(s => !s.convergeSuccess);
  const failedAdvance = allStages.filter(s => !s.advanceSuccess && s.convergeSuccess);

  if (failedConverge.length > 0) {
    console.log(`\n  ⚠️ Converge 失败:`);
    for (const s of failedConverge) {
      const c = results.find(r => r.stages.includes(s));
      console.log(`    - ${c?.profile.brandName ?? "?"} S${s.stage}: ${s.convergeErrors?.join("; ") ?? "未知错误"}`);
    }
  }

  if (failedAdvance.length > 0) {
    console.log(`\n  ⚠️ Advance 失败:`);
    for (const s of failedAdvance) {
      const c = results.find(r => r.stages.includes(s));
      console.log(`    - ${c?.profile.brandName ?? "?"} S${s.stage}: gate=${s.advanceGate}`);
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log("  测试完成");
  console.log("=".repeat(78) + "\n");
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  AI Brand OS — 批量测试 (5 cases × S1→S8)                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN 模式：仅解析案例，不调用 LLM\n");
  }

  // 解析案例
  let profiles = parseProfiles();
  console.log(`\n📋 解析到 ${profiles.length} 个创始人画像:\n`);
  for (const p of profiles) {
    console.log(`  ${p.caseIndex}. ${p.brandName} (${p.category}) — ${p.founder.split("，")[0] ?? "—"}`);
  }

  // 筛选
  if (TARGET_CASE) {
    profiles = profiles.filter(p => p.caseIndex === TARGET_CASE);
    if (profiles.length === 0) {
      console.error(`\n❌ 未找到案例 ${TARGET_CASE}`);
      process.exit(1);
    }
    console.log(`\n🎯 仅运行案例 ${TARGET_CASE}`);
  }

  if (TARGET_STAGE) {
    console.log(`🎯 仅运行 Stage ${TARGET_STAGE}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] 案例解析完成，退出。");
    process.exit(0);
  }

  // 验证环境
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("\n❌ DEEPSEEK_API_KEY 未设置，请在 .env.local 中配置");
    process.exit(1);
  }

  console.log(`\n⚙️  每阶段最大轮数: ${MAX_ROUNDS}`);
  console.log(`⚙️  DeepSeek API Key: ${apiKey.slice(0, 8)}...`);
  console.log(`⚙️  博查 API Key: ${process.env.BOCHA_API_KEY ? "已设置" : "未设置（搜索将降级）"}`);

  // 逐案例运行
  const results: CaseResult[] = [];
  const totalStart = Date.now();

  for (const profile of profiles) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`  案例 ${profile.caseIndex}/${profiles.length}: ${profile.brandName}`);
    console.log(`${"=".repeat(70)}`);

    const result = await runCase(profile);
    results.push(result);
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000 / 60).toFixed(1);
  console.log(`\n🏁 全部案例完成，总耗时: ${totalElapsed} 分钟`);

  // 输出结果
  printResults(results);
}

main().catch((e) => {
  console.error("\n❌ 批量测试异常退出:");
  console.error(e);
  process.exit(1);
});
