/**
 * Phase 6.3: Prompt 冗余分析
 *
 * 对 S8/S3/S2/S5 consultation prompt 进行四种类型的冗余检测：
 *   A: 重复指令删除
 *   B: 规则合并
 *   C: 结构压缩
 *   D: 低价值说明删除
 *
 * 输出：每个文件的冗余估算和优化建议。
 */

import * as fs from "fs";
import * as path from "path";

const PROMPTS_DIR = path.resolve("src/lib/ai/prompts");
const STAGES = ["stage2", "stage3", "stage5", "stage8"];

interface RedundancyFinding {
  type: "A" | "B" | "C" | "D";
  category: string;
  pattern: string;
  lines: string;
  count: number;
  estimatedChars: number;
  description: string;
  suggestion: string;
}

interface FileAnalysis {
  stage: string;
  totalChars: number;
  totalLines: number;
  estTokens: number;
  findings: RedundancyFinding[];
  totalRedundantChars: number;
  redundantPct: number;
}

// ── 共享段落检测 ──────────────────────────────────

/** 在所有 stage 中出现的共享 block */
const SHARED_BLOCKS = [
  {
    name: "阶段退出机制 (完整)",
    // 检测 marker
    marker: "## 阶段退出机制",
    endMarker: "## Confirmation Summary Template",
    chars: 0, // 运行时计算
  },
  {
    name: "收尾语硬约束",
    marker: "### 收尾语硬约束",
    endMarker: null, // 到文件末尾或下一个 ##
    chars: 0,
  },
];

// ── 类型 A: 重复指令 ──────────────────────────────

const TYPE_A_PATTERNS = [
  {
    category: "角色重复说明",
    patterns: [
      /你是.{2,20}(顾问|师|分析师|策略师)/g,
      /你的工作是.{10,80}?。/g,
      /你不是.{10,80}?。/g,
    ],
  },
  {
    category: "一次一问规则重复",
    patterns: [
      /每条回复有且只有一个问句/g,
      /聊天阶段只输出一个问题/g,
      /每轮最多提出一个问题/g,
    ],
  },
  {
    category: "不表达认可/否定",
    patterns: [
      /不表达认可或否定.*/g,
      /不替用户总结观点/g,
      /不提前告诉用户你的分析结果/g,
    ],
  },
];

// ── 类型 B: 规则合并候选 ──────────────────────────

const TYPE_B_PATTERNS = [
  {
    category: "退出机制相关规则分散",
    description: "退出机制在 Conversation Rules、阶段退出机制、Confirmation Summary Template 三处重复说明",
    patterns: [
      /阶段退出判断优先级高于一次一问规则/g,
      /立即停止提问/g,
      /强制总结模式/g,
      /绝对禁止.*收到.*信号.*提出问题/g,
    ],
  },
  {
    category: "符号禁止规则分散",
    description: "禁止使用的符号列表在多个位置出现",
    patterns: [
      /禁止使用这些符号[：:][^。]+。/g,
    ],
  },
];

// ── 类型 C: 结构压缩候选 ──────────────────────────

const TYPE_C_PATTERNS = [
  {
    category: "逐条展开的步骤说明",
    description: "用数字编号展开的步骤可压缩为箭头链",
    patterns: [
      /(\d+)\.\s*\n\s*(\S[^\n]+)\n\s*\n\s*(\d+)\./g,
    ],
  },
  {
    category: "示例过长",
    description: "每个 boundary control 示例可压缩一半",
    // 检测示例块: 创始人：...\n\n正确回应：...\n\n错误回应：...
    patterns: [] as RegExp[], // 手动检测
  },
];

// ── 类型 D: 低价值说明 ────────────────────────────

const TYPE_D_PATTERNS = [
  {
    category: "LLM 自解释要求",
    description: "告诉 LLM '你不需要自己检查'是冗余的——已经由代码控制",
    patterns: [
      /本阶段的退出条件由系统自动判断，你不需要自己检查每个条件是否达成。/g,
    ],
  },
  {
    category: "自我描述性元说明",
    description: "'本阶段负责...' 在 Role 中已经说明，Boundary Control 中重复",
    patterns: [
      /本阶段负责[：:][^。]+。/g,
    ],
  },
];

// ── 工具函数 ──────────────────────────────────────

function readPrompt(stage: string): string {
  const filePath = path.join(PROMPTS_DIR, `${stage}-consultation.md`);
  return fs.readFileSync(filePath, "utf-8");
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/** 估算 token 数 (char / 2.2) */
function estTokens(chars: number): number {
  return Math.round(chars / 2.2);
}

function analyzeFile(stage: string): FileAnalysis {
  const content = readPrompt(stage);
  const lines = content.split("\n");
  const totalChars = content.length;

  const findings: RedundancyFinding[] = [];

  // ── 类型 A 检测 ────────────────────────────────
  for (const patternGroup of TYPE_A_PATTERNS) {
    let totalGroupChars = 0;
    let matchDetails = "";
    for (const pattern of patternGroup.patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          totalGroupChars += m.length;
          if (!matchDetails.includes(m.substring(0, 30))) {
            matchDetails += (matchDetails ? " | " : "") + m.substring(0, 60);
          }
        }
      }
    }
    // 检测到多次匹配（重复指令的核心判断标准是同一概念出现 >=2 次）
    const totalMatches = patternGroup.patterns.reduce((sum, p) => sum + countMatches(content, p), 0);
    if (totalMatches >= 2) {
      findings.push({
        type: "A",
        category: patternGroup.category,
        pattern: patternGroup.patterns.map(p => p.source).join(", "),
        lines: matchDetails,
        count: totalMatches,
        estimatedChars: Math.round(totalGroupChars * 0.5), // 保守估计可删除 50%
        description: `${patternGroup.category}在多处重复出现 ${totalMatches} 次`,
        suggestion: `合并为单一表述，删除重复。预计可省 ${Math.round(totalGroupChars * 0.5)} chars`,
      });
    }
  }

  // ── 类型 B 检测 ────────────────────────────────
  for (const patternGroup of TYPE_B_PATTERNS) {
    let totalMatches = 0;
    let totalChars = 0;
    for (const pattern of patternGroup.patterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalMatches += matches.length;
        totalChars += matches.reduce((sum, m) => sum + m.length, 0);
      }
    }
    if (totalMatches >= 3) {
      findings.push({
        type: "B",
        category: patternGroup.category,
        pattern: patternGroup.patterns.map(p => p.source).join(", "),
        lines: `共 ${totalMatches} 处匹配`,
        count: totalMatches,
        estimatedChars: Math.round(totalChars * 0.3), // 合并后预计省 30%
        description: patternGroup.description,
        suggestion: `合并为集中定义的规则块。预计可省 ${Math.round(totalChars * 0.3)} chars`,
      });
    }
  }

  // ── 类型 C 检测 ────────────────────────────────
  // 检测可压缩的数字编号步骤 (1. 2. 3. 4.)
  const numberedSteps = content.match(/(?:^|\n)(\d+)\.\s+.+/gm);
  if (numberedSteps && numberedSteps.length >= 5) {
    const totalStepChars = numberedSteps.reduce((sum, s) => sum + s.length, 0);
    findings.push({
      type: "C",
      category: "数字编号步骤",
      pattern: "\\d+\\.\\s+...",
      lines: numberedSteps.slice(0, 5).join("\n"),
      count: numberedSteps.length,
      estimatedChars: Math.round(totalStepChars * 0.25),
      description: `${numberedSteps.length} 个数字编号步骤，可用箭头链压缩`,
      suggestion: `步骤列表压缩为 "→" 链式表达。预计省 ${Math.round(totalStepChars * 0.25)} chars`,
    });
  }

  // 检测 Boundary Control 示例块
  const boundaryExamples = content.match(/创始人[：:][^\n]+/g);
  if (boundaryExamples && boundaryExamples.length >= 2) {
    const exampleSection = content.match(/示例[：:][\s\S]{100,500}/g);
    if (exampleSection) {
      const totalExampleChars = exampleSection.reduce((sum, s) => sum + s.length, 0);
      findings.push({
        type: "C",
        category: "Boundary Control 示例",
        pattern: "创始人：... 正确回应：... 错误回应：...",
        lines: exampleSection.map(e => e.substring(0, 80)).join("\n"),
        count: exampleSection.length,
        estimatedChars: Math.round(totalExampleChars * 0.4),
        description: `${exampleSection.length} 个边界示例，可精简`,
        suggestion: `示例压缩一半或合并。预计省 ${Math.round(totalExampleChars * 0.4)} chars`,
      });
    }
  }

  // ── 类型 D 检测 ────────────────────────────────
  for (const patternGroup of TYPE_D_PATTERNS) {
    let totalChars = 0;
    let totalMatches = 0;
    for (const pattern of patternGroup.patterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalMatches += matches.length;
        totalChars += matches.reduce((sum, m) => sum + m.length, 0);
      }
    }
    if (totalMatches > 0) {
      findings.push({
        type: "D",
        category: patternGroup.category,
        pattern: patternGroup.patterns.map(p => p.source).join(", "),
        lines: `共 ${totalMatches} 处`,
        count: totalMatches,
        estimatedChars: totalChars, // D 类可完全删除
        description: patternGroup.description,
        suggestion: `删除。预计省 ${totalChars} chars`,
      });
    }
  }

  // ── Summary Language Rules 示例表 ──────────────
  // 这些示例表通常很长，但教学价值有限
  const summaryLangSection = content.match(/# Summary Language Rules[\s\S]+?(?=---\n#|$)/);
  if (summaryLangSection) {
    const sectionText = summaryLangSection[0];
    const exampleBlocks = sectionText.match(/用户[：:][\s\S]{50,300}?输出[：:]/g);
    if (exampleBlocks && exampleBlocks.length >= 3) {
      // 每个示例 ~200 chars, 保留 2 个最有代表性的
      const reducible = (exampleBlocks.length - 2) * 200;
      if (reducible > 0) {
        findings.push({
          type: "C",
          category: "Summary Language Rules 示例",
          pattern: "用户：... 输出：...",
          lines: `${exampleBlocks.length} 个示例`,
          count: exampleBlocks.length,
          estimatedChars: reducible,
          description: `${exampleBlocks.length} 个语言转换示例，核心规则重复`,
          suggestion: `保留 2 个最有代表性的示例，其余删除。预计省 ${reducible} chars`,
        });
      }
    }
  }

  // 汇总
  const totalRedundantChars = findings.reduce((sum, f) => sum + f.estimatedChars, 0);
  const redundantPct = totalChars > 0 ? (totalRedundantChars / totalChars) * 100 : 0;

  return {
    stage,
    totalChars,
    totalLines: lines.length,
    estTokens: estTokens(totalChars),
    findings,
    totalRedundantChars,
    redundantPct,
  };
}

// ── 共享 block 大小计算 ──────────────────────────
function calcSharedBlockSizes() {
  // 取 stage8 的代表性计算
  const s8 = readPrompt("stage8");
  const exitStart = s8.indexOf("## 阶段退出机制");
  const summaryStart = s8.indexOf("## Confirmation Summary Template");
  const footerStart = s8.indexOf("### 收尾语硬约束");

  SHARED_BLOCKS[0].chars = exitStart >= 0 && summaryStart > exitStart
    ? summaryStart - exitStart
    : 0;
  SHARED_BLOCKS[1].chars = footerStart >= 0
    ? s8.length - footerStart
    : 0;

  console.log("\n━━━ 共享 Block 大小 ━━━");
  for (const b of SHARED_BLOCKS) {
    console.log(`  ${b.name}: ~${b.chars} chars (${estTokens(b.chars)} tokens)`);
  }
  console.log(`  合计: ~${SHARED_BLOCKS.reduce((s, b) => s + b.chars, 0)} chars`);
}

// ── 主入口 ────────────────────────────────────────

function main() {
  console.log("═".repeat(70));
  console.log("Phase 6.3 Prompt 冗余分析");
  console.log("═".repeat(70));

  calcSharedBlockSizes();

  const results: FileAnalysis[] = [];

  for (const stage of STAGES) {
    console.log(`\n${"─".repeat(70)}`);
    const analysis = analyzeFile(stage);
    results.push(analysis);

    console.log(`\n📄 ${stage}-consultation.md`);
    console.log(`  总大小: ${analysis.totalChars} chars / ${analysis.estTokens} tokens / ${analysis.totalLines} 行`);
    console.log(`  发现 ${analysis.findings.length} 个冗余问题`);
    console.log(`  可优化: ${analysis.totalRedundantChars} chars (${estTokens(analysis.totalRedundantChars)} tokens) = ${analysis.redundantPct.toFixed(1)}%`);

    for (const f of analysis.findings) {
      console.log(`\n  [${f.type}] ${f.category}`);
      console.log(`      匹配: ${f.count} 次 | 可省: ~${f.estimatedChars} chars (${estTokens(f.estimatedChars)} tokens)`);
      console.log(`      说明: ${f.description}`);
      console.log(`      建议: ${f.suggestion}`);
    }
  }

  // ── 汇总 ────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}`);
  console.log("汇总");
  console.log("═".repeat(70));

  console.log("\n| Stage | 模板 chars | 模板 tokens | 冗余 chars | 冗余% | 可省 tokens |");
  console.log("|-------|-----------|------------|-----------|-------|------------|");

  let grandTotal = 0;
  let grandSavable = 0;
  for (const r of results) {
    const savable = estTokens(r.totalRedundantChars);
    console.log(
      `| ${r.stage.toUpperCase()} | ${r.totalChars.toLocaleString()} | ${r.estTokens.toLocaleString()} | ${r.totalRedundantChars.toLocaleString()} | ${r.redundantPct.toFixed(1)}% | ${savable.toLocaleString()} |`
    );
    grandTotal += r.estTokens;
    grandSavable += savable;
  }

  console.log(`\n总计模板 tokens: ${grandTotal.toLocaleString()}`);
  console.log(`总计可节省 tokens: ${grandSavable.toLocaleString()} (${(grandSavable / grandTotal * 100).toFixed(1)}%)`);

  // 类型分布
  console.log("\n按优化类型分布:");
  const byType: Record<string, { count: number; chars: number }> = {};
  for (const r of results) {
    for (const f of r.findings) {
      if (!byType[f.type]) byType[f.type] = { count: 0, chars: 0 };
      byType[f.type].count++;
      byType[f.type].chars += f.estimatedChars;
    }
  }
  for (const [type, data] of Object.entries(byType)) {
    const typeName = { A: "重复指令删除", B: "规则合并", C: "结构压缩", D: "低价值说明删除" }[type] || type;
    console.log(`  [${type}] ${typeName}: ${data.count} 处, ${data.chars.toLocaleString()} chars (${estTokens(data.chars)} tokens)`);
  }

  // 按文件输出详细发现，供优化脚本使用
  console.log("\n━━━ 优化优先级排序 ━━━");
  const sorted = [...results].sort((a, b) => b.totalRedundantChars - a.totalRedundantChars);
  for (const r of sorted) {
    console.log(`  ${r.stage}: ${r.totalRedundantChars.toLocaleString()} chars → P${sorted.indexOf(r)}`);
  }
}

main();
