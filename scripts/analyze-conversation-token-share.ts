/**
 * 机会 3 前置分析：真实项目对话轮次和历史 Token 占比
 *
 * 回答两个问题：
 * 1. 每个 stage 平均多少轮对话？
 * 2. consultation 调用中，对话历史 tokens 占总 input 的比例是多少？
 *
 * 判定标准：如果 conversation history 平均占比 > 30%，
 * 则机会 3（对话历史滚动摘要）是真实瓶颈，值得推进。
 */

import { db, tokenConsumption, stageRecord } from "../src/lib/db";
import { inArray } from "drizzle-orm";

interface StageRoundStats {
  stage: number;
  projectCount: number;
  avgRounds: number;
  minRounds: number;
  maxRounds: number;
  p50Rounds: number;
}

interface TokenShareStats {
  stage: number;
  callCount: number;
  avgSystemPromptTokens: number;
  avgConversationTokens: number;
  avgTotalInputTokens: number;
  conversationSharePct: number;
}

async function main() {
  console.log("═".repeat(65));
  console.log("机会 3 前置分析：对话轮次 & 历史 Token 占比");
  console.log("═".repeat(65));

  // ── 分析 1: 每阶段对话轮次 ──────────────────────────
  console.log("\n━━━ ① 各 Stage 对话轮次统计 ━━━\n");

  const stageRecords = await db
    .select({
      projectId: stageRecord.projectId,
      stageNumber: stageRecord.stageNumber,
      messages: stageRecord.consultationMessages,
    })
    .from(stageRecord)
    .orderBy(stageRecord.projectId, stageRecord.stageNumber);

  // 按 (projectId, stageNumber) 分组，计算每阶段对话轮次
  const stageRounds = new Map<string, { projectId: string; stage: number; rounds: number }>();

  for (const row of stageRecords) {
    const messages = (row.messages as any[]) ?? [];
    // 每轮 = 一对 user+assistant，或一条 user 消息
    const userMsgs = messages.filter((m: any) => m.role === "user");
    const key = `${row.projectId}_${row.stageNumber}`;
    if (!stageRounds.has(key) || userMsgs.length > 0) {
      stageRounds.set(key, {
        projectId: row.projectId,
        stage: row.stageNumber,
        rounds: userMsgs.length,
      });
    }
  }

  // 按 stage 聚合
  const byStage = new Map<number, number[]>();
  for (const { stage, rounds } of stageRounds.values()) {
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage)!.push(rounds);
  }

  const stageStats: StageRoundStats[] = [];
  console.log("Stage │ 项目数 │ 平均轮次 │ 最小 │ 最大 │ P50");
  console.log("──────┼───────┼─────────┼──────┼──────┼─────");

  for (let s = 1; s <= 8; s++) {
    const rounds = byStage.get(s) ?? [];
    if (rounds.length === 0) {
      console.log(`  S${s}  │     0 │       - │    - │    - │   -`);
      continue;
    }
    const sorted = [...rounds].sort((a, b) => a - b);
    const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];

    stageStats.push({
      stage: s,
      projectCount: rounds.length,
      avgRounds: Math.round(avg * 10) / 10,
      minRounds: min,
      maxRounds: max,
      p50Rounds: p50,
    });

    console.log(
      `  S${s}  │ ${String(rounds.length).padStart(4)} │ ${avg.toFixed(1).padStart(6)} │ ${String(min).padStart(3)} │ ${String(max).padStart(3)} │ ${String(p50).padStart(2)}`
    );
  }

  // ── 分析 2: Token 占比 ──────────────────────────────
  console.log("\n━━━ ② Consultation 调用 Token 占比 ━━━\n");

  const tokenRows = await db
    .select({
      stageNumber: tokenConsumption.stageNumber,
      callType: tokenConsumption.callType,
      systemPromptTokens: tokenConsumption.systemPromptTokens,
      conversationTokens: tokenConsumption.conversationTokens,
      inputTokens: tokenConsumption.inputTokens,
      totalTokens: tokenConsumption.totalTokens,
    })
    .from(tokenConsumption)
    .where(
      inArray(tokenConsumption.callType, ["consultation", "opening"])
    );

  // 按 stage 聚合
  const tokenByStage = new Map<number, {
    systemPromptTokens: number[];
    conversationTokens: number[];
    inputTokens: number[];
  }>();

  for (const row of tokenRows) {
    if (!tokenByStage.has(row.stageNumber)) {
      tokenByStage.set(row.stageNumber, {
        systemPromptTokens: [],
        conversationTokens: [],
        inputTokens: [],
      });
    }
    const bucket = tokenByStage.get(row.stageNumber)!;
    // inputTokens 是 provider 报告的实际 input tokens（最准确）
    // 但 systemPromptTokens 和 conversationTokens 是代码层估算
    // 优先用 provider 的 inputTokens，用估算做分解
    if (row.systemPromptTokens > 0) bucket.systemPromptTokens.push(row.systemPromptTokens);
    if (row.conversationTokens > 0) bucket.conversationTokens.push(row.conversationTokens);
    if (row.inputTokens > 0) bucket.inputTokens.push(row.inputTokens);
  }

  const tokenStats: TokenShareStats[] = [];

  console.log("Stage │ 调用数 │ System平均 │ Conv平均 │ Input平均 │ Conv占比");
  console.log("──────┼───────┼───────────┼─────────┼──────────┼────────");

  for (let s = 1; s <= 8; s++) {
    const bucket = tokenByStage.get(s);
    if (!bucket || bucket.conversationTokens.length === 0) {
      console.log(`  S${s}  │     0 │         - │       - │        - │     -`);
      continue;
    }

    const avgSys = Math.round(avg(bucket.systemPromptTokens));
    const avgConv = Math.round(avg(bucket.conversationTokens));
    const avgInput = Math.round(avg(bucket.inputTokens));
    const convShare = avgInput > 0 ? (avgConv / avgInput * 100) : 0;

    tokenStats.push({
      stage: s,
      callCount: bucket.conversationTokens.length,
      avgSystemPromptTokens: avgSys,
      avgConversationTokens: avgConv,
      avgTotalInputTokens: avgInput,
      conversationSharePct: Math.round(convShare * 10) / 10,
    });

    const signal = convShare >= 30 ? " ⚠️" : "  ";

    console.log(
      `  S${s}  │ ${String(bucket.conversationTokens.length).padStart(4)} │ ${String(avgSys).padStart(8)} │ ${String(avgConv).padStart(6)} │ ${String(avgInput).padStart(7)} │ ${convShare.toFixed(1).padStart(5)}%${signal}`
    );
  }

  // ── 全阶段汇总 ──────────────────────────────────────
  console.log("\n━━━ ③ 全阶段汇总 ━━━\n");

  const allRounds = [...stageRounds.values()].map(v => v.rounds);
  const overallAvgRounds = allRounds.length > 0
    ? (allRounds.reduce((a, b) => a + b, 0) / allRounds.length).toFixed(1)
    : "N/A";

  const allSysTokens = tokenStats.flatMap(s => {
    const bucket = tokenByStage.get(s.stage);
    return bucket?.systemPromptTokens ?? [];
  });
  const allConvTokens = tokenStats.flatMap(s => {
    const bucket = tokenByStage.get(s.stage);
    return bucket?.conversationTokens ?? [];
  });
  const allInputTokens = tokenStats.flatMap(s => {
    const bucket = tokenByStage.get(s.stage);
    return bucket?.inputTokens ?? [];
  });

  const overallAvgSys = allSysTokens.length > 0 ? Math.round(avg(allSysTokens)) : 0;
  const overallAvgConv = allConvTokens.length > 0 ? Math.round(avg(allConvTokens)) : 0;
  const overallAvgInput = allInputTokens.length > 0 ? Math.round(avg(allInputTokens)) : 0;
  const overallConvShare = overallAvgInput > 0 ? (overallAvgConv / overallAvgInput * 100) : 0;

  console.log(`总项目阶段记录: ${stageRounds.size}`);
  console.log(`总 consultation 调用: ${allConvTokens.length}`);
  console.log(`平均对话轮次: ${overallAvgRounds}`);
  console.log(`平均 System Prompt: ${overallAvgSys.toLocaleString()} tokens`);
  console.log(`平均 Conversation:   ${overallAvgConv.toLocaleString()} tokens`);
  console.log(`平均 Total Input:     ${overallAvgInput.toLocaleString()} tokens`);
  console.log(`对话历史占比:         ${overallConvShare.toFixed(1)}%`);

  // ── 判定 ────────────────────────────────────────────
  console.log("\n━━━ ④ 机会 3 判定 ━━━\n");

  const highShareStages = tokenStats.filter(s => s.conversationSharePct >= 30);

  if (overallConvShare >= 30 || highShareStages.length > 0) {
    console.log(`⚠️  对话历史占比 ≥ 30%，机会 3 是真实瓶颈`);
    console.log();
    if (highShareStages.length > 0) {
      console.log(`高占比阶段: S${highShareStages.map(s => s.stage).join(", S")}`);
    }
    console.log(`建议: 推进 Full History vs Rolling Summary 对比实验`);
  } else {
    console.log(`✅ 对话历史占比 < 30%，机会 3 不是当前瓶颈`);
    console.log();
    console.log(`原因: 对话历史平均仅占 ${overallConvShare.toFixed(1)}%，`);
    console.log(`      System Prompt（含 DM Context + Search Context + Prompt 模板）是主要 Token 消费者`);
    console.log(`      机会 1（DM 分层）和机会 2（Search Context 压缩）已经覆盖了主要优化空间`);
    console.log(`建议: 跳过机会 3，进入机会 4（模板去重）`);
  }

  // ── 额外分析：每轮对话平均 token ───────────────────
  console.log("\n━━━ ⑤ 每轮对话平均 Token 增量 ━━━\n");

  for (let s = 1; s <= 8; s++) {
    const bucket = tokenByStage.get(s);
    const rounds = byStage.get(s) ?? [];
    if (!bucket || rounds.length === 0) continue;

    const avgStageRounds = rounds.reduce((a, b) => a + b, 0) / rounds.length;
    const avgConvTokens = Math.round(avg(bucket.conversationTokens));
    const tokensPerRound = avgStageRounds > 0 ? Math.round(avgConvTokens / avgStageRounds) : 0;

    console.log(`  S${s}: ${avgStageRounds.toFixed(1)} 轮 × ${tokensPerRound} tokens/轮 = ~${avgConvTokens.toLocaleString()} tokens 历史`);
  }
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

main().catch((err) => {
  console.error("分析失败:", err);
  process.exit(1);
});
