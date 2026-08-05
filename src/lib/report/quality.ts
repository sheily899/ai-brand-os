/**
 * Report Quality Check — 报告质量检测（Phase 3）
 *
 * 职责：
 * - 违规检测：绝对化词汇 / 过大词汇 / 第一人称 / 口语连接词 / 访谈痕迹
 * - 跨章节术语一致性扫描
 * - 输出 QualityCheckResult
 *
 * 纯代码实现，不调用 LLM。
 * 在报告组装前运行，违规内容标记后由用户选择重新生成或手动修改。
 *
 * 红线：不判断战略质量（由 Audit Engine 负责），不做 AI 质量评估。
 */

// ── 类型定义 ──────────────────────────────────────────────

export interface Violation {
  category: ViolationCategory;
  pattern: string;
  match: string;
  index: number;
  suggestion: string;
}

export type ViolationCategory =
  | "absolute_words"       // 绝对化词汇
  | "exaggerated_words"    // 过大词汇
  | "first_person"         // 第一人称（品牌战略报告中应避免）
  | "oral_connectors"      // 口语连接词（AI 对话痕迹）
  | "interview_traces";    // 访谈痕迹（"你提到"、"根据您的描述" 等）

export interface TerminologyIssue {
  term: string;
  variants: string[];
  chapters: number[];
  suggestion: string;
}

export interface QualityCheckResult {
  passed: boolean;
  violations: Violation[];
  terminologyIssues: TerminologyIssue[];
  summary: string;
}

// ── 违规检测规则 ──────────────────────────────────────────

interface ViolationRule {
  category: ViolationCategory;
  patterns: RegExp[];
  suggestion: string;
}

const VIOLATION_RULES: ViolationRule[] = [
  {
    category: "absolute_words",
    patterns: [
      /必然/g,
      /绝对/g,
      /一定/g,
      /毫无疑问/g,
      /毋庸置疑/g,
      /所有/g,
      /任何/g,
      /百分之百/g,
      /100%/g,
      /完全/g,
      /从不/g,
      /总是/g,
      /永远/g,
    ],
    suggestion: "品牌战略报告应基于数据和分析，避免绝对化断言。建议改为基于证据的趋势判断表述。",
  },
  {
    category: "exaggerated_words",
    patterns: [
      /颠覆/g,
      /革命性/g,
      /划时代/g,
      /世界级/g,
      /全球第一/g,
      /无与伦比/g,
      /独一无二/g,
      /最/g,
      /顶级/g,
      /终极/g,
      /极致/g,
      /传奇/g,
      /神/g,         // "神话" "神器" 等
    ],
    suggestion: "避免使用夸大性词汇。品牌战略报告应使用客观、克制的专业语言。",
  },
  {
    category: "first_person",
    patterns: [
      /我们/g,
      /我/g,
      /咱们/g,
    ],
    suggestion: `品牌战略报告应使用第三人称客观表述（如"品牌"、"消费者"），避免第一人称。`,
  },
  {
    category: "oral_connectors",
    patterns: [
      /首先/g,
      /其次/g,
      /然后/g,
      /接着/g,
      /最后/g,
      /总的来说/g,
      /总的来看/g,
      /另外/g,
      /除此之外/g,
      /顺便说/g,
      /值得一提的是/g,
      /需要指出的是/g,
      /值得注意的是/g,
      /综上所述/g,
      /总而言之/g,
    ],
    suggestion: "口语连接词暴露了 AI 对话生成痕迹。报告应使用报告语体的过渡方式（如小标题、数据引用）。",
  },
  {
    category: "interview_traces",
    patterns: [
      /你提到/g,
      /你刚才/g,
      /您提到/g,
      /您刚才/g,
      /根据您的描述/g,
      /根据你的描述/g,
      /正如你所说/g,
      /正如您所说/g,
      /基于您的/g,
      /基于你的/g,
      /你说的/g,
      /您说的/g,
      /从你的/g,
      /从您的/g,
      /你提供的/g,
      /您提供的/g,
      /我们知道/g,
      /我们了解到/g,
      /创始人的/g,
      /创始人提到/g,
      /创始人认为/g,
    ],
    suggestion: "访谈痕迹词暴露了内容的对话来源。报告应以独立分析的形式呈现，而非转述对话。",
  },
];

// ── 核心检查函数 ──────────────────────────────────────────

/**
 * 对报告文本（或单个章节）执行违规检测。
 *
 * @param text - 待检查的文本内容
 * @param context - 可选上下文（如章节编号），用于定位
 * @returns QualityCheckResult
 */
export function qualityCheck(text: string): QualityCheckResult {
  const violations: Violation[] = [];

  for (const rule of VIOLATION_RULES) {
    for (const pattern of rule.patterns) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        // 跳过一些合理的"最"用法（如"最早"表示时间、"最大"有数据支撑）
        if (rule.category === "exaggerated_words" && match[0] === "最") {
          // 检查上下文：如果"最"后面跟着的是"大的"、"高的"等且前面有数字，可能是数据描述
          const after = text.slice(match.index + 1, match.index + 4);
          const before = text.slice(Math.max(0, match.index - 5), match.index);
          if (/\d/.test(before) || /大|高|多|快|长/.test(after)) {
            // 可能是合理的数据比较（"最大的市场"）——仍标记但用 minor
            // 跳过纯数据上下文的"最"
            continue;
          }
        }

        violations.push({
          category: rule.category,
          pattern: pattern.source,
          match: match[0],
          index: match.index,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  // 按位置排序
  violations.sort((a, b) => a.index - b.index);

  // 术语一致性检查
  const terminologyIssues = checkTerminologyConsistency([text]);

  return {
    passed: violations.length === 0,
    violations,
    terminologyIssues,
    summary: violations.length === 0
      ? "未发现违规内容"
      : `发现 ${violations.length} 处违规：${summarizeViolations(violations)}`,
  };
}

/** 汇总违规统计 */
function summarizeViolations(violations: Violation[]): string {
  const counts: Record<string, number> = {};
  for (const v of violations) {
    const label = VIOLATION_RULES.find(r => r.category === v.category);
    const key = label?.category ?? v.category;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([cat, n]) => `${categoryLabel(cat)} ×${n}`)
    .join("、");
}

const CATEGORY_LABELS: Record<string, string> = {
  absolute_words: "绝对化词汇",
  exaggerated_words: "过大词汇",
  first_person: "第一人称",
  oral_connectors: "口语连接词",
  interview_traces: "访谈痕迹",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ── 术语一致性检查 ────────────────────────────────────────

/**
 * 跨章节术语一致性扫描。
 *
 * 检查不同章节中对同一概念的表述是否一致。
 * 例如：S3 称为"中产女性"，S6 称为"城市白领女性"→ 标记为不一致。
 *
 * 纯代码实现，使用 n-gram 提取 + 字符重叠度判断。
 * 不做深度语义分析（那是 AI Quality Audit 的职责）。
 */
export function checkTerminologyConsistency(
  chapterTexts: string[]
): TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];

  // 从各章节中提取有意义的 2-4 字中文短语
  const chapterPhrases: Array<{ phrase: string; chapter: number }>[] = [];

  for (let i = 0; i < chapterTexts.length; i++) {
    const phrases = extractKeyPhrases(chapterTexts[i]);
    // 去重
    const unique = [...new Set(phrases)];
    chapterPhrases.push(unique.map(p => ({ phrase: p, chapter: i + 1 })));
  }

  // 跨章节比较：寻找语义相似但表述不同的短语
  const allPhrases = chapterPhrases.flat();
  const seen = new Set<string>();

  for (let i = 0; i < allPhrases.length; i++) {
    const a = allPhrases[i];
    if (seen.has(a.phrase)) continue;

    const variants: Array<{ term: string; chapter: number }> = [];
    const chapters = new Set<number>();

    for (let j = 0; j < allPhrases.length; j++) {
      if (i === j) continue;
      const b = allPhrases[j];
      if (a.chapter === b.chapter) continue; // 同章节不比较

      // 判断是否为同一概念的变体：
      // 1. 字符重叠度 >= 50%
      // 2. 但又不完全一致（排除完全相同的）
      if (a.phrase !== b.phrase && phrasesSimilar(a.phrase, b.phrase)) {
        if (variants.length === 0) {
          variants.push({ term: a.phrase, chapter: a.chapter });
          chapters.add(a.chapter);
        }
        variants.push({ term: b.phrase, chapter: b.chapter });
        chapters.add(b.chapter);
        seen.add(b.phrase);
      }
    }

    if (variants.length >= 1 && chapters.size > 1) {
      seen.add(a.phrase);
      issues.push({
        term: a.phrase,
        variants: variants.map(v => v.term),
        chapters: [...chapters].sort(),
        suggestion: `建议在各章节中统一术语表述。检测到的变体：${variants.map(v => `"${v.term}"(Ch${v.chapter})`).join("、")}`,
      });
    }
  }

  return issues;
}

/**
 * 从中文字符串中提取有代表性的 2-4 字短语。
 * 按标点和停用词分割，提取有意义的名词性短语。
 */
function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];

  // 停用模式（功能词，不参与术语比较）
  const stopPatterns = /^(的|是|在|和|与|及|或|对|为|以|从|到|让|使|被|把|向|之|其|这|那|此|该|等|等|个|种|些|每|所有|任何|可以|能够|应该|需要|需要|必须|已经|正在|将会|也将|以及|并且|而且|但是|因为|所以|因此|如果|虽然|然而|不仅|另外|此外|还有|同时|其中|具有|存在|通过|作为|进行|相关)$/;

  // 按标点分割
  const segments = text.split(/[，,。.、；;：:\s\n\-—「『」』""（）()【】\[\]《》]+/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    // 只保留 2-6 字中文为主的短语（关键术语通常在这个范围）
    if (trimmed.length < 2 || trimmed.length > 6) continue;
    if (stopPatterns.test(trimmed)) continue;

    // 只保留中文为主的短语
    const chineseChars = trimmed.replace(/[^一-鿿]/g, "");
    if (chineseChars.length < 2) continue;

    phrases.push(trimmed);
  }

  // 去重
  return [...new Set(phrases)];
}

/** 判断两个中文短语是否相似（字符重叠度 >= 60%，且至少有 2 个共享字符） */
function phrasesSimilar(a: string, b: string): boolean {
  // 纯中文字符
  const cA = a.replace(/[^一-鿿]/g, "");
  const cB = b.replace(/[^一-鿿]/g, "");

  // 子串关系 → 不视为变体（相同词根）
  if (cA.includes(cB) || cB.includes(cA)) return false;

  const charsA = new Set(cA);
  const charsB = new Set(cB);

  if (charsA.size < 2 || charsB.size < 2) return false;

  let overlap = 0;
  for (const c of charsA) {
    if (charsB.has(c)) overlap++;
  }

  // 需要至少 2 个共享字符 + 60% 重叠度
  if (overlap < 2) return false;

  const minSize = Math.min(charsA.size, charsB.size);
  return overlap / minSize >= 0.67;
}

// ── 导出违规规则（供 assemble.ts 使用）───────────────────

export { VIOLATION_RULES as VIOLATION_PATTERNS };
