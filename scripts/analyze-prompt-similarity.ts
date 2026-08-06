/**
 * 机会 4 前置分析：8 个 Consultation Prompt 模板相似度
 *
 * 方法：
 * 1. 段落级 hash：按空行分割段落，MD5 hash 后跨文件匹配
 * 2. 段落级归一化匹配：去除 stage-specific 关键词后匹配
 * 3. 统计 shared vs unique token 占比
 * 4. 分类共享内容：规则类 vs 方法论类
 *
 * 判定标准：
 * - 共享 <20%：不值得优化
 * - 共享 20-40%：可考虑，优先级一般
 * - 共享 >40%：值得重构
 * - 共享 >50%：高优先级
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const PROMPTS_DIR = path.join(__dirname, "..", "src", "lib", "ai", "prompts");

interface ParagraphInfo {
  text: string;
  hash: string;
  normalizedHash: string;
  charCount: number;
  estimatedTokens: number;
  section: string; // 所属章节（最近的 ## 标题）
}

interface FileAnalysis {
  file: string;
  totalChars: number;
  estimatedTokens: number;
  uniqueChars: number;
  sharedChars: number;
  sharedPct: number;
  paragraphs: ParagraphInfo[];
}

interface SharedBlock {
  hash: string;
  text: string;
  charCount: number;
  estimatedTokens: number;
  appearsIn: string[]; // 文件名列表
  category: "rule" | "methodology" | "template_structure" | "mixed";
  section: string;
}

// ── 工具函数 ──────────────────────────────────────────

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex").slice(0, 12);
}

function estTokens(chars: number): number {
  // Chinese text: ~2 chars/token for mixed CN content
  return Math.round(chars / 2.2);
}

function normalizeText(text: string): string {
  // 移除 stage-specific 内容做归一化
  return text
    .replace(/Stage\s*\d/g, "Stage N")
    .replace(/stage\s*\d/gi, "stage N")
    .replace(/S\d/g, "SN")
    .replace(/S1|S2|S3|S4|S5|S6|S7|S8/g, "SN")
    .replace(/[一二三四五六七八]阶段/g, "N阶段")
    .replace(/用户访谈|商业背景分析|市场机会分析|消费者洞察|竞争判断|品牌核心战略|视觉策略|内容规划/g, "STAGE_NAME")
    .replace(/FounderVision|BusinessContext|MarketInsights?|ConsumerInsights?|CompetitiveInsights?|BrandPositioning|VisualStrategy|ContentStrategy/g, "STAGE_OUTPUT")
    .replace(/\{品牌名\}/g, "{BRAND}")
    .replace(/\{品类\}/g, "{CATEGORY}")
    .replace(/\d+-\d+岁/g, "AGE_RANGE")
    .replace(/\d+\s*字/g, "N_CHARS")
    .replace(/\d+\s*[条个轮]/g, "N_COUNT")
    .replace(/\d+\s*分/g, "N_SCORE")
    .replace(/\d+\s*%/g, "N_PCT")
    .trim();
}

function splitParagraphs(text: string): string[] {
  // 按空行分割，保留标题
  const raw = text.split(/\n\n+/);
  return raw.map(p => p.trim()).filter(p => p.length > 0);
}

function findSection(lines: string[], lineIndex: number): string {
  // 向上查找最近的 ## 标题
  for (let i = lineIndex; i >= 0; i--) {
    const m = lines[i].match(/^##\s+(.+)/);
    if (m) return m[1].trim();
  }
  return "(无章节)";
}

function classifyBlock(text: string, section: string): SharedBlock["category"] {
  const lower = text.toLowerCase();

  // 规则类关键词
  const ruleKeywords = [
    "禁止", "不允许", "不得", "必须", "只能", "不要", "避免",
    "规则", "约束", "硬约束", "红线", "违规", "限制",
    "最多", "至少", "恰好", "不超过",
  ];
  // 方法论/知识类关键词
  const methodKeywords = [
    "框架", "目标", "分析", "洞察", "判断", "推导", "策略",
    "消费者", "竞争", "市场", "定位", "品牌", "战略",
    "需求", "行为", "场景", "价值主张",
  ];

  const ruleHits = ruleKeywords.filter(k => lower.includes(k)).length;
  const methodHits = methodKeywords.filter(k => lower.includes(k)).length;

  if (ruleHits >= 3 && methodHits < 2) return "rule";
  if (methodHits >= 3 && ruleHits < 2) return "methodology";
  if (ruleHits >= 2 && methodHits >= 2) return "mixed";
  return "template_structure";
}

// ── 主分析 ────────────────────────────────────────────

async function main() {
  console.log("═".repeat(70));
  console.log("机会 4 前置分析：Consultation Prompt 模板相似度");
  console.log("═".repeat(70));

  // ── 1. 加载所有 consultation 模板 ──────────────────
  const files: Record<string, string> = {};
  for (let s = 1; s <= 8; s++) {
    const filePath = path.join(PROMPTS_DIR, `stage${s}-consultation.md`);
    files[`S${s}`] = fs.readFileSync(filePath, "utf8");
  }

  console.log("\n━━━ ① 模板原始大小 ━━━\n");
  console.log("Stage │ chars   │ est.tokens");
  console.log("──────┼─────────┼──────────");

  let totalTemplateChars = 0;
  for (const [stage, content] of Object.entries(files)) {
    const chars = content.length;
    const tokens = estTokens(chars);
    totalTemplateChars += chars;
    console.log(`  ${stage} │ ${chars.toLocaleString().padStart(6)} │ ${tokens.toLocaleString().padStart(7)}`);
  }
  const totalTemplateTokens = estTokens(totalTemplateChars);
  console.log(`──────┼─────────┼──────────`);
  console.log(`  ALL │ ${totalTemplateChars.toLocaleString().padStart(6)} │ ${totalTemplateTokens.toLocaleString().padStart(7)}`);
  console.log(`  平均 │ ${Math.round(totalTemplateChars/8).toLocaleString().padStart(6)} │ ${Math.round(totalTemplateTokens/8).toLocaleString().padStart(7)}`);

  // ── 2. 段落级精确匹配 ──────────────────────────────
  console.log("\n━━━ ② 段落级精确匹配分析 ━━━\n");

  // 解析所有文件的段落
  const fileParagraphs = new Map<string, ParagraphInfo[]>();
  const globalHashMap = new Map<string, { text: string; files: string[] }>(); // hash → info

  for (const [stage, content] of Object.entries(files)) {
    const lines = content.split("\n");
    const paragraphs = splitParagraphs(content);
    const infos: ParagraphInfo[] = [];

    for (const para of paragraphs) {
      // 找到该段落在原文中的大致行号
      const lineIdx = content.indexOf(para);
      const lineNum = lineIdx >= 0 ? content.slice(0, lineIdx).split("\n").length : 0;
      const section = findSection(lines, lineNum);

      const hash = md5(para);
      const normHash = md5(normalizeText(para));

      const info: ParagraphInfo = {
        text: para,
        hash,
        normalizedHash: normHash,
        charCount: para.length,
        estimatedTokens: estTokens(para.length),
        section,
      };
      infos.push(info);

      // 全局 hash 表
      if (!globalHashMap.has(hash)) {
        globalHashMap.set(hash, { text: para, files: [] });
      }
      globalHashMap.get(hash)!.files.push(stage);
    }

    fileParagraphs.set(stage, infos);
  }

  // 找出共享段落（出现在 ≥2 个文件中）
  const sharedHashes = new Set<string>();
  const allSharedBlocks: SharedBlock[] = [];

  for (const [hash, info] of globalHashMap) {
    const uniqueFiles = [...new Set(info.files)];
    if (uniqueFiles.length >= 2) {
      sharedHashes.add(hash);
      allSharedBlocks.push({
        hash,
        text: info.text,
        charCount: info.text.length,
        estimatedTokens: estTokens(info.text.length),
        appearsIn: uniqueFiles,
        category: classifyBlock(info.text, ""),
        section: "",
      });
    }
  }

  // 每个文件的 share/unshare 统计
  const fileAnalyses: FileAnalysis[] = [];
  let totalSharedChars = 0;
  let totalUniqueChars = 0;

  console.log("Stage │ 段落数 │ 共享段 │ 共享chars │ 共享% │ 结论");
  console.log("──────┼───────┼───────┼──────────┼──────┼──────");

  for (const [stage, paragraphs] of fileParagraphs) {
    let sharedChars = 0;
    let uniqueChars = 0;
    let sharedParaCount = 0;

    for (const p of paragraphs) {
      if (sharedHashes.has(p.hash)) {
        sharedChars += p.charCount;
        sharedParaCount++;
      } else {
        uniqueChars += p.charCount;
      }
    }

    const total = sharedChars + uniqueChars;
    const sharedPct = total > 0 ? (sharedChars / total * 100) : 0;

    fileAnalyses.push({
      file: stage,
      totalChars: total,
      estimatedTokens: estTokens(total),
      uniqueChars,
      sharedChars,
      sharedPct: Math.round(sharedPct * 10) / 10,
      paragraphs,
    });

    totalSharedChars += sharedChars;
    totalUniqueChars += uniqueChars;

    const signal = sharedPct >= 50 ? "🔴 高优" : sharedPct >= 40 ? "🟡 值得" : sharedPct >= 20 ? "🟢 可考虑" : "⚪ 跳过";

    console.log(
      `  ${stage} │ ${String(paragraphs.length).padStart(4)} │ ${String(sharedParaCount).padStart(4)} │ ${sharedChars.toLocaleString().padStart(7)} │ ${sharedPct.toFixed(1).padStart(4)}% │ ${signal}`
    );
  }

  const overallSharedPct = (totalSharedChars / (totalSharedChars + totalUniqueChars) * 100);
  console.log(`──────┼───────┼───────┼──────────┼──────┼──────`);
  console.log(`  汇总 │       │       │ ${totalSharedChars.toLocaleString().padStart(7)} │ ${overallSharedPct.toFixed(1).padStart(4)}% │`);

  // ── 3. 归一化匹配分析 ──────────────────────────────
  console.log("\n━━━ ③ 归一化匹配（去除 stage 特定词后） ━━━\n");

  const normalizedHashMap = new Map<string, { text: string; files: string[] }>();

  for (const [stage, content] of Object.entries(files)) {
    const paragraphs = splitParagraphs(content);
    for (const para of paragraphs) {
      const normHash = md5(normalizeText(para));
      if (!normalizedHashMap.has(normHash)) {
        normalizedHashMap.set(normHash, { text: para, files: [] });
      }
      normalizedHashMap.get(normHash)!.files.push(stage);
    }
  }

  // 统计归一化后的共享
  let normSharedChars = 0;
  let normUniqueChars = 0;
  const normSharedCounts: Map<string, number> = new Map();

  for (const [stage, paragraphs] of fileParagraphs) {
    for (const p of paragraphs) {
      const normHash = p.normalizedHash;
      const info = normalizedHashMap.get(normHash);
      const fileCount = info ? [...new Set(info.files)].length : 1;

      if (fileCount >= 2) {
        normSharedChars += p.charCount;
        normSharedCounts.set(stage, (normSharedCounts.get(stage) || 0) + p.charCount);
      } else {
        normUniqueChars += p.charCount;
      }
    }
  }

  const normSharedPct = (normSharedChars / (normSharedChars + normUniqueChars) * 100);
  console.log(`精确匹配共享: ${overallSharedPct.toFixed(1)}%`);
  console.log(`归一化后共享: ${normSharedPct.toFixed(1)}%`);
  console.log(`归一化增量:   +${(normSharedPct - overallSharedPct).toFixed(1)}%（这些是内容相同但包含 stage 特定数字/名称的段落）`);

  // ── 4. 共享内容分类 ────────────────────────────────
  console.log("\n━━━ ④ 共享内容分类：规则 vs 方法论 ━━━\n");

  // 给每个共享段落标记章节
  const blocksWithSection: SharedBlock[] = [];
  for (const block of allSharedBlocks) {
    // 找到该 block 首次出现时的章节
    for (const [stage, paragraphs] of fileParagraphs) {
      for (const p of paragraphs) {
        if (p.hash === block.hash) {
          block.section = p.section;
          break;
        }
      }
      if (block.section) break;
    }
    block.category = classifyBlock(block.text, block.section);
    blocksWithSection.push(block);
  }

  const catStats: Record<string, { count: number; chars: number; tokens: number }> = {
    rule: { count: 0, chars: 0, tokens: 0 },
    methodology: { count: 0, chars: 0, tokens: 0 },
    template_structure: { count: 0, chars: 0, tokens: 0 },
    mixed: { count: 0, chars: 0, tokens: 0 },
  };

  for (const b of blocksWithSection) {
    catStats[b.category].count++;
    catStats[b.category].chars += b.charCount * (b.appearsIn.length - 1); // 共享节省 = 内容 × (出现次数-1)
    catStats[b.category].tokens += b.estimatedTokens * (b.appearsIn.length - 1);
  }

  console.log("类型           │ 段落数 │ 可节省chars │ 可节省tokens │ 占比");
  console.log("───────────────┼───────┼────────────┼────────────┼──────");

  const totalSavableChars = Object.values(catStats).reduce((s, c) => s + c.chars, 0);
  const totalSavableTokens = Object.values(catStats).reduce((s, c) => s + c.tokens, 0);

  for (const [cat, stats] of Object.entries(catStats)) {
    const label: Record<string, string> = {
      rule: "规则/约束      ",
      methodology: "方法论/知识    ",
      template_structure: "模板结构      ",
      mixed: "混合          ",
    };
    const pct = totalSavableTokens > 0 ? (stats.tokens / totalSavableTokens * 100) : 0;
    console.log(
      `${label[cat]} │ ${String(stats.count).padStart(4)} │ ${stats.chars.toLocaleString().padStart(9)} │ ${stats.tokens.toLocaleString().padStart(9)} │ ${pct.toFixed(1).padStart(4)}%`
    );
  }
  console.log(`───────────────┼───────┼────────────┼────────────┼──────`);
  console.log(
    `  合计          │ ${allSharedBlocks.length.toString().padStart(4)} │ ${totalSavableChars.toLocaleString().padStart(9)} │ ${totalSavableTokens.toLocaleString().padStart(9)} │`
  );

  // ── 5. 与成本数据交叉分析 ──────────────────────────
  console.log("\n━━━ ⑤ 结合成本数据判定 ━━━\n");

  // 之前已知数据：S2/S3/S8 system prompt 特别大
  const costData: Record<string, number> = {
    S1: 2790,
    S2: 12254,
    S3: 12785,
    S4: 3811,
    S5: 10451,
    S6: 4442,
    S7: 4194,
    S8: 14759,
  };

  console.log("Stage │ 模板chars │ System Prompt │ 模板占比 │ 共享chars │ 共享可压% │ 判定");
  console.log("──────┼──────────┼──────────────┼─────────┼──────────┼──────────┼──────");

  for (const fa of fileAnalyses) {
    const stage = fa.file;
    const actualSysPrompt = costData[stage] || 0;
    const actualSysChars = actualSysPrompt * 2.2; // 反推 chars（粗略）
    const templatePct = actualSysPrompt > 0 ? (fa.estimatedTokens / actualSysPrompt * 100) : 0;
    const sharedTokens = estTokens(fa.sharedChars);
    const compressiblePct = actualSysPrompt > 0 ? (sharedTokens / actualSysPrompt * 100) : 0;

    const signal = compressiblePct >= 30 ? "🔴" : compressiblePct >= 15 ? "🟡" : "⚪";

    console.log(
      `  ${stage} │ ${fa.estimatedTokens.toLocaleString().padStart(7)} │ ${actualSysPrompt.toLocaleString().padStart(11)} │ ${templatePct.toFixed(0).padStart(6)}% │ ${fa.sharedChars.toLocaleString().padStart(7)} │ ${compressiblePct.toFixed(1).padStart(7)}% │ ${signal}`
    );
  }

  // ── 6. 共享段落详情（Top 10） ──────────────────────
  console.log("\n━━━ ⑥ 重复最多段落 Top 10 ━━━\n");

  const sortedBlocks = [...allSharedBlocks]
    .sort((a, b) => b.appearsIn.length - a.appearsIn.length || b.charCount - a.charCount)
    .slice(0, 10);

  for (let i = 0; i < sortedBlocks.length; i++) {
    const b = sortedBlocks[i];
    const preview = b.text.length > 120
      ? b.text.slice(0, 120).replace(/\n/g, " ") + "…"
      : b.text.replace(/\n/g, " ");
    console.log(
      `  ${i + 1}. [${b.category}] 出现在 ${b.appearsIn.length} 个文件 (${b.charCount} chars)`
    );
    console.log(`     章节: ${b.section}`);
    console.log(`     预览: ${preview}`);
    console.log();
  }

  // ── 7. 最终判定 ────────────────────────────────────
  console.log("━━━ ⑦ 机会 4 最终判定 ━━━\n");

  const avgSharedPct = fileAnalyses.reduce((s, f) => s + f.sharedPct, 0) / fileAnalyses.length;

  console.log(`模板内共享率 (精确): ${overallSharedPct.toFixed(1)}%`);
  console.log(`模板内共享率 (归一化): ${normSharedPct.toFixed(1)}%`);
  console.log(`平均每文件共享率: ${avgSharedPct.toFixed(1)}%`);
  console.log();

  // 实际 system prompt 层面：模板只占一部分，其余是 DM Context + Search Context
  console.log(`实际 System Prompt 层面:`);
  const totalSysPromptTokens = Object.values(costData).reduce((a, b) => a + b, 0);
  const totalTemplTokens = totalTemplateTokens;
  const templateShareOfSystem = (totalTemplTokens / totalSysPromptTokens * 100);
  console.log(`  8 模板合计: ${totalTemplTokens.toLocaleString()} tokens`);
  console.log(`  System Prompt 合计: ${totalSysPromptTokens.toLocaleString()} tokens (含 DM+Search)`);
  console.log(`  模板占 System Prompt: ${templateShareOfSystem.toFixed(1)}%`);
  console.log();

  if (overallSharedPct >= 50) {
    console.log(`🔴 高优先级 — 模板共享率 ${overallSharedPct.toFixed(0)}% > 50%，收益明显`);
    console.log(`   建议：提取共享段落到 base.md，每个 stage 只维护独有内容`);
  } else if (overallSharedPct >= 40) {
    console.log(`🟡 值得重构 — 模板共享率 ${overallSharedPct.toFixed(0)}% 在 40-50%`);
    console.log(`   建议：可以重构，但需评估 DeepSeek cache 是否已覆盖这部分节省`);
  } else if (overallSharedPct >= 20) {
    console.log(`🟢 可考虑 — 模板共享率 ${overallSharedPct.toFixed(0)}% 在 20-40%，优先级一般`);
  } else {
    console.log(`⚪ 跳过 — 模板共享率 ${overallSharedPct.toFixed(0)}% < 20%，不值得优化`);
    console.log(`   原因：独有内容（阶段专业知识/方法论）是主体，共享规则占比低`);
  }
}

main().catch(err => {
  console.error("分析失败:", err);
  process.exit(1);
});
