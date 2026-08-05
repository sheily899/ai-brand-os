#!/usr/bin/env npx tsx
/**
 * dump-conversation.ts — 导出完整对话 + 阶段收敛输出 + 审计详情
 *
 * 用法:
 *   npx tsx scripts/dump-conversation.ts <projectId>            # 全部阶段，单文件
 *   npx tsx scripts/dump-conversation.ts <projectId> --stage 3   # 仅单个阶段
 *   npx tsx scripts/dump-conversation.ts <projectId> --split     # 每阶段一个文件
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const envPath = resolve(__dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { console.warn("[dump] .env.local 未找到"); }

const STAGE_NAMES: Record<number, string> = {
  1: "用户访谈", 2: "商业背景分析", 3: "市场机会分析", 4: "消费者洞察",
  5: "竞争判断", 6: "品牌核心战略", 7: "视觉策略", 8: "内容规划",
};

function formatJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

async function main() {
  const projectId = process.argv[2];
  const targetStage = process.argv.includes("--stage")
    ? parseInt(process.argv[process.argv.indexOf("--stage") + 1])
    : undefined;
  const splitFiles = process.argv.includes("--split");

  if (!projectId) {
    console.log("用法: npx tsx scripts/dump-conversation.ts <projectId> [--stage N] [--split]");
    process.exit(1);
  }

  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const stages = targetStage ? [targetStage] : [1, 2, 3, 4, 5, 6, 7, 8];
  let allOutput = "";

  for (const stage of stages) {
    const rows = await db
      .select()
      .from(stageRecord)
      .where(and(eq(stageRecord.projectId, projectId), eq(stageRecord.stageNumber, stage)))
      .limit(1);

    const record = rows[0];
    if (!record) continue;

    const messages = (record.consultationMessages as any[]) || [];
    const auditResult = record.auditResult as any;

    let stageOutput = "";
    stageOutput += `\n${"=".repeat(72)}\n`;
    stageOutput += `  Stage ${stage} — ${STAGE_NAMES[stage]}\n`;
    stageOutput += `${"=".repeat(72)}\n\n`;
    stageOutput += `状态: ${record.status}  |  消息数: ${messages.length}\n`;

    // ── 对话内容（完整，不截断）──
    stageOutput += `\n${"─".repeat(50)}\n`;
    stageOutput += `  对 话 内 容\n`;
    stageOutput += `${"─".repeat(50)}\n\n`;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i] as any;
      const role = m.role === "user" ? "👤 创始人" : "🤖 AI顾问";
      const content = (m.content || "").trim();
      if (!content) continue;

      stageOutput += `[${i + 1}] ${role}:\n\n`;
      stageOutput += content + "\n\n";
    }

    if (messages.length === 0) {
      stageOutput += `(无对话记录)\n`;
    }

    // ── 阶段收敛输出（完整结构化 JSON）──
    if (record.structuredOutput) {
      stageOutput += `\n${"─".repeat(50)}\n`;
      stageOutput += `  阶段收敛输出 (Structured Output)\n`;
      stageOutput += `${"─".repeat(50)}\n\n`;
      stageOutput += "```json\n";
      stageOutput += formatJSON(record.structuredOutput);
      stageOutput += "\n```\n";
    }

    // ── 审计详情 ──
    if (auditResult) {
      stageOutput += `\n${"─".repeat(50)}\n`;
      stageOutput += `  审 计 详 情\n`;
      stageOutput += `${"─".repeat(50)}\n\n`;

      stageOutput += `Gate Decision: ${auditResult.gateDecision}\n\n`;

      // Rule Check
      const rc = auditResult.ruleCheck;
      stageOutput += `### Rule Check\n`;
      stageOutput += `Passed: ${rc?.passed ?? "N/A"}\n`;
      if (rc?.issues?.length > 0) {
        for (const issue of rc.issues) {
          stageOutput += `- [${issue.severity}] ${issue.field}: ${issue.message}\n`;
        }
      } else {
        stageOutput += `(无问题)\n`;
      }
      stageOutput += "\n";

      // Cross Stage
      const refIssues = auditResult.referenceIssues || [];
      stageOutput += `### Cross Stage (Layer A)\n`;
      stageOutput += `Reference Issues: ${refIssues.length}\n`;
      for (const ri of refIssues) {
        stageOutput += `- [${ri.severity}] ${ri.currentStageField} → ${ri.upstreamField}: ${ri.description}\n`;
      }
      if (refIssues.length === 0) stageOutput += `(无引用问题)\n`;
      stageOutput += "\n";

      // AI Quality Audit
      const ai = auditResult.aiAudit;
      if (ai) {
        stageOutput += `### AI Quality Audit (Layer B)\n`;
        stageOutput += `总分: ${ai.totalScore} / 100\n`;
        stageOutput += `门禁推荐: ${ai.gateRecommendation}\n\n`;
        stageOutput += `| 维度 | 原始分 | 权重 | 加权分 | 理由 |\n`;
        stageOutput += `|------|--------|------|--------|------|\n`;
        if (ai.dimensionScores) {
          for (const ds of ai.dimensionScores) {
            const dNameLookup: Record<string, string> = { specificity: "具体度", differentiation: "差异化", actionability: "可执行性", evidence: "证据" };
            const dName = dNameLookup[ds.dimension] || ds.dimension;
            stageOutput += `| ${dName} | ${ds.score} | ${(ds.weight * 100).toFixed(0)}% | ${ds.weightedScore} | ${ds.reason.slice(0, 80)} |\n`;
          }
        }
        stageOutput += "\n";

        if (ai.issues?.length > 0) {
          stageOutput += `**AI 发现的问题:**\n\n`;
          for (const issue of ai.issues) {
            stageOutput += `- [${issue.severity}] ${issue.dimension}: ${issue.description}\n`;
            if (issue.suggestion) stageOutput += `  → 建议: ${issue.suggestion}\n`;
          }
          stageOutput += "\n";
        }

        // Suggestions
        const suggestions = ai.dimensionScores?.flatMap((d: any) => d.improvements || []) || [];
        if (suggestions.length > 0) {
          stageOutput += `**优化建议:**\n\n`;
          for (const s of suggestions) {
            stageOutput += `- ${s}\n`;
          }
          stageOutput += "\n";
        }
      }
    }

    if (splitFiles) {
      const dir = `temp/${projectId}`;
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fname = `${dir}/S${stage}-${STAGE_NAMES[stage]}.md`;
      writeFileSync(fname, stageOutput, "utf8");
      console.log(`✅ ${fname}`);
    }

    allOutput += stageOutput;
  }

  if (!splitFiles) {
    const outFile = `temp/conversation-${projectId}.md`;
    writeFileSync(outFile, allOutput, "utf8");
    console.log(`✅ 已导出到 ${outFile} (${allOutput.length} 字符)`);
  }

  process.exit(0);
}

main().catch((e) => { console.error("导出失败:", e); process.exit(1); });
