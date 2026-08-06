/**
 * Prompt Loader — 加载 Prompt 模板 + 注入变量
 *
 * 职责：
 * - 读取 .md 格式 Prompt 模板
 * - 注入 Context 变量（品牌名、品类、Decision Memory 等）
 * - 拼接共享搜索协议（S2/S3/S5/S8 阶段）
 * - 注入搜索上下文（Search Intelligence Layer 产出）
 *
 * 不负责：
 * - 实际调用 LLM（由 consultation.ts / convergence.ts 负责）
 */

import { readFileSync } from "fs";
import { resolve, join } from "path";
import type { MessageContent } from "@/lib/ai/provider/interface";

/** 是否启用 vision 多模态（需要模型支持，如 GPT-4o、Claude 3.5）。DeepSeek deepseek-chat 不支持 */
const VISION_ENABLED = process.env.VISION_ENABLED === "true"; // 默认关闭（DeepSeek 不支持 image_url）

const PROMPTS_DIR = resolve(process.cwd(), "src/lib/ai/prompts");
const SEARCH_PROTOCOL_PATH = resolve(process.cwd(), "reference/shared-search-protocol.md");
const SHARED_RULES_PATH = resolve(PROMPTS_DIR, "_shared-rules.md");

// ── 搜索协议缓存 ──────────────────────────────────────

let _protocolCache: string | null = null;

function loadSearchProtocol(): string {
  if (!_protocolCache) {
    try {
      _protocolCache = readFileSync(SEARCH_PROTOCOL_PATH, "utf8");
    } catch {
      console.warn("[loader] shared-search-protocol.md 加载失败，搜索协议将跳过");
      _protocolCache = "";
    }
  }
  return _protocolCache;
}

// ── 共用规则 ──────────────────────────────────────────

let _sharedRulesCache: string | null = null;

function loadSharedRules(): string {
  if (!_sharedRulesCache) {
    try {
      _sharedRulesCache = readFileSync(SHARED_RULES_PATH, "utf8");
    } catch {
      console.warn("[loader] _shared-rules.md 加载失败，共用规则将跳过");
      _sharedRulesCache = "";
    }
  }
  return _sharedRulesCache;
}

/**
 * 阶段专属占位符默认值。
 * Phase 2 逐阶段增强时会覆盖这些默认值。
 */
function getStageDefaults(stage: number): Record<string, string> {
  const generic = {
    LAYER_DEFINITIONS: `1. **事实层**：具体发生了什么？谁、在什么情境下？
2. **原因层**：为什么会这样？背后的驱动因素是什么？
3. **判断层**：这意味着什么？指向什么方向？`,
    KNOWN_INFO_SOURCE: "前序阶段的确认总结",
    STAGE_BUZZWORDS: "行业通用套话，缺乏具体场景支撑",
    BREAKTHROUGH_QUESTION: "如果抛开行业术语——你自己最确信的那个判断是什么？",
    STAGE_SPECIFIC_RED_FLAGS: "",
  };

  const stageOverrides: Record<number, Partial<Record<string, string>>> = {
    1: {
      KNOWN_INFO_SOURCE: "品牌名 + 品类（本阶段为第一个阶段，已知信息最少）",
      LAYER_DEFINITIONS: `1. **事实层**：发生了什么？什么时候、谁、在什么情境下？
2. **原因层**：为什么这件事让你记住了？它和别的经历有什么不同？
3. **意义层**：你觉得这件事说明了什么？`,
      STAGE_BUZZWORDS: '"想做高端品牌""市场上没有好的选择""大家都需要这个"',
      BREAKTHROUGH_QUESTION: "如果抛开品牌定位这些概念——你自己最想做的东西是什么样的？",
      STAGE_SPECIFIC_RED_FLAGS: `- 在用户还没描述具体经历时，就开始问"你觉得问题出在哪"→ 你在跳跃——先问事实，再问原因
- 对创作驱动型创始人问"现有解决方案哪里不够好"→ 你忘了分叉——创作驱动型不问这个问题
- 用户说"没有""没想过"之后，换个角度继续问同一件事 → 路径已关闭，不要绕路`,
    },
    2: {
      KNOWN_INFO_SOURCE: "S1 确认总结（创始动机、观察、用户假设、资源约束）",
      LAYER_DEFINITIONS: `1. **事实层**：行业发生了什么变化？有什么数据或观察？
2. **原因层**：为什么发生这些变化？背后的驱动因素是什么？
3. **影响层**：这些变化对你这个品牌具体意味着什么？`,
      STAGE_BUZZWORDS: '"这个市场很大""是蓝海""是风口"（无数据支撑）；"消费升级""Z世代崛起"（行业套话，无具体信号）；"现在是最好的时机"（无具体时间窗口论证）',
      BREATHROUGH_QUESTION: "如果把市场很大这几个字放一边——你亲眼看到的、让你确信该现在动手的那个信号是什么？",
      STAGE_SPECIFIC_RED_FLAGS: `- 问题中出现了"结构性""驱动因素""供需错配"→ 在用过大的词包装有限的信息
- 创始人说"我只是感觉"之后你仍然在追问市场数据 → 他没有数据，记录为推测
- 你在替创始人总结行业趋势 → 越界了，你的工作是追问不是总结`,
    },
    3: {
      KNOWN_INFO_SOURCE: "S1+S2 确认总结（创始动机、商业背景、市场变化趋势）",
      LAYER_DEFINITIONS: `1. **事实层**：品类中正在发生什么？供给端有什么特征？有什么数据？
2. **原因层**：为什么存在这些体验缺口？是供给端的问题还是需求端的变化？
3. **判断层**：这些观察指向什么机会方向？判断依据的可靠程度如何？`,
      STAGE_BUZZWORDS: '"这是个蓝海，没人做"（可能是没人需要，而不是没人发现）；"市场教育成本很低"（未经验证的乐观假设）；"消费者在等待更好的产品"（消费者可能根本没在等）',
      BREATHROUGH_QUESTION: "如果市场机会这个词太抽象——你观察到的那个具体场景里，消费者现在最无奈的是什么？",
      STAGE_SPECIFIC_RED_FLAGS: `- 创始人说"市场规模几百亿"但说不出数据来源 → 标记为推测
- 把"我有个朋友就是这样的"当作市场需求证据 → 追问是否有更多案例
- 把非消费群体等同于"没需求" → 提示：不买可能是因为现有方案太贵/太复杂/不知道`,
    },
    4: {
      KNOWN_INFO_SOURCE: "S1+S2+S3 确认总结（创始动机、商业背景、市场机会判断）",
      LAYER_DEFINITIONS: `1. **场景层**：谁、在什么情境下、产生了什么需求？
2. **行为层**：他们现在怎么解决？满足/没满足什么？
3. **意义层**：这个需求对他们来说除了功能之外还意味着什么？

注意：Path B 降级路径的三轮限制（行为锚定→场景假设→反向排除）优先级高于三层递进。Path B 三轮结束后直接输出确认总结，不适用三层递进。`,
      STAGE_BUZZWORDS: '"用户想要更好的体验"（什么算更好？哪个具体环节？）；"用户需要被理解""用户需要陪伴"（太大，缺乏行为锚定）；"现在的年轻人越来越注重精神消费"（行业套话）',
      BREATHROUGH_QUESTION: "你能想起一个具体的用户吗——Ta 在使用现有产品后的真实反应是什么样的？不用分析，就描述那个瞬间。",
      STAGE_SPECIFIC_RED_FLAGS: `- 在 Path B 三轮后仍然在追问"你的用户是谁"→ 已超过降级追问上限
- 接受了"25-35岁女性"作为用户画像而不追问场景 → 人口标签不是画像
- 把创始人的"我觉得用户会喜欢"当作已验证事实记录 → 这是假设不是事实
- 对 Path B 创始人追问"你观察到的具体行为"→ 无效追问，他不会观察`,
    },
    5: {
      KNOWN_INFO_SOURCE: "S1+S2+S3+S4 确认总结（前序 4 个阶段已积累创始动机、商业背景、市场机会、消费者画像）",
      LAYER_DEFINITIONS: `1. **事实层**：市场上有哪些竞争方式？代表品牌是谁？各自怎么打？
2. **逻辑层**：为什么消费者选择 A 而不是 B？背后的价值逻辑是什么？
3. **空位层**：现有竞争格局中，哪个需求维度尚未被充分覆盖？`,
      STAGE_BUZZWORDS: '"竞品没有创新""竞品做得不好"（无具体维度和对比）；"我们的产品比他们好多了"（好在哪？为什么消费者会在意这个维度？）；"这个市场大家都在卷价格"（可能只是创始人的印象）',
      BREATHROUGH_QUESTION: "如果把更好、创新这些词放一边——在消费者的购买决策里，哪个环节现在没有任何品牌做好？",
      STAGE_SPECIFIC_RED_FLAGS: `- 只分析了直接竞品，没有追问替代方案和非消费 → 竞争视角不完整
- 接受"更专业""更年轻""更懂用户"作为差异化 → 追问具体维度
- 用"吊打""秒杀"等词描述竞争关系 → 转换为客观竞争分析
- 鼓励创始人得出"我们有明显优势"的结论 → 越界了`,
    },
    6: {
      KNOWN_INFO_SOURCE: "S1+S2+S3+S4+S5 确认总结（全部前序信息）",
      LAYER_DEFINITIONS: `本阶段包含四个递进模块：**定位 → 价值主张拆解 → 品牌故事 → 品牌人格**。
每个模块内部的追问不超过三层：
1. **方向层**：创始人的直觉选择是什么？（不评价，先让他说出来）
2. **逻辑层**：为什么是这个方向而不是别的？与前序信息的一致性如何？
3. **具象层**：如果这个方向成立，在具体场景中怎么体现？（逼出具体画面）

当前模块三层问完后，切换到下一个模块。不允许在一个模块上无限追问。`,
      STAGE_BUZZWORDS: '"我们想做高端品牌"（为什么是高端？你的用户需要高端吗？）；"我们要打造生活方式品牌"（什么品类？什么生活方式？哪个具体场景？）；"差异化竞争""打造核心竞争力"（已被空话禁令覆盖）；"消费者需要被尊重""需要品质生活"（太大，无行为锚定）；"我们的品牌代表自由/独立/自我表达"（任何品牌都可以这么说）',
      BREATHROUGH_QUESTION: '如果不考虑品牌该怎么说——你心里最想让消费者用一句话向朋友推荐你的时候，说的那句话是什么？',
      STAGE_SPECIFIC_RED_FLAGS: `- 定位表达中出现空话禁令中的任何词汇 → 自查并追问具体化
- 品牌人格只停留在形容词（温暖/专业/年轻/有趣）→ 追问行为描述："它会怎么做？"
- 价值主张三层之间没有递进关系 → 重新检查逻辑链条
- 品牌故事只是创业经历的复述 → 追问"消费者面临什么共同问题"
- 在同一个战略模块上追问超过 3 轮没有新信息 → 该模块已饱和，切换
- 接受了"高端""生活方式"等词作为定位方向而不追问品类锚定 → 严重违规`,
    },
    7: {
      KNOWN_INFO_SOURCE: "S6 品牌核心战略（定位、价值主张、品牌故事、品牌人格）",
      LAYER_DEFINITIONS: `1. **感觉层**：创始人想要传达什么视觉感受？
2. **转译层**：这种感受在五类视觉语言（形态/色彩/字体/图像/材质）中各自对应什么具体表达？
3. **边界层**：哪些视觉方向与品牌核心明确冲突？为什么？`,
      STAGE_BUZZWORDS: '"高级感""有质感""简约大气"（没有具体画面参考）；"像苹果那样""像 MUJI 那样"（借用其他品牌的视觉资产）；"年轻化""国际化"（太大，无法指导视觉执行）',
      BREATHROUGH_QUESTION: "如果不说高级感——你能不能想起一个具体的画面、一张图、一个场景，让你觉得就是这个感觉？",
      STAGE_SPECIFIC_RED_FLAGS: `- 只收集了形容词（高级/年轻/温暖）没有追问具体画面 → 追问
- 五类视觉语言中有类别被跳过 → 检查是否遗漏
- 视觉方向与 S6 品牌人格明显冲突但未被指出 → 必须提醒
- 视觉禁区少于 3 个 → 继续追问"还有什么绝对不行的？"`,
    },
    8: {
      KNOWN_INFO_SOURCE: "S6 品牌核心战略 + S7 视觉策略",
      LAYER_DEFINITIONS: `1. **角色层**：品牌在用户生活中扮演什么内容角色？（教育者/陪伴者/启发者/娱乐者？）
2. **价值层**：每个用户旅程阶段，内容提供什么价值？
3. **执行层**：每个渠道，内容的具体形式和表达重点是什么？`,
      STAGE_BUZZWORDS: '"提供有价值的内容""建立品牌认知""和用户建立连接"（任何品牌都可以这么说）；"做小红书、抖音、公众号全平台覆盖"（没有差异化内容策略）；"内容要年轻化、有趣、有互动性"（形容词堆砌）',
      BREATHROUGH_QUESTION: "如果一个用户关注了你一年，你觉得她会跟朋友说这个品牌的内容___——她会填什么词？",
      STAGE_SPECIFIC_RED_FLAGS: `- 内容方向只是产品宣传的变体 → 追问"除了产品，还能帮用户理解什么"
- 三个渠道的表达策略没有实质差异 → 追问差异化
- 只讨论了流量话题而没有长期主题支柱 → 拉回到品牌内容角色
- 内容策略与 S6 品牌故事无关 → 提醒品牌故事是内容的核心素材`,
    },
  };

  return { ...generic, ...(stageOverrides[stage] ?? {}) };
}

/**
 * 将共用规则注入到 consultation prompt 中。
 * - 如果 prompt 中有 {SHARED_RULES} 占位符 → 替换
 * - 如果没有占位符 → 在 Conversation Rules 段落之后插入
 */
function injectSharedRules(processed: string, stage: number): string {
  let sharedRules = loadSharedRules();
  if (!sharedRules) return processed;

  // ── 替换阶段专属占位符 ───────────────────────────
  const stageDefaults = getStageDefaults(stage);
  for (const [key, value] of Object.entries(stageDefaults)) {
    sharedRules = sharedRules.split(`{${key}}`).join(value);
  }

  // ── 情况 1：prompt 中已有 {SHARED_RULES} 占位符 ──
  if (processed.includes("{SHARED_RULES}")) {
    return processed.split("{SHARED_RULES}").join(sharedRules);
  }

  // ── 情况 2：在 Conversation Rules 段落后插入 ─────
  const convRulesRe = /\n(#{1,3})\s+Conversation Rules\b/i;
  const convRulesMatch = processed.match(convRulesRe);

  if (!convRulesMatch) {
    // 没有 Conversation Rules 段落 → 追加到末尾
    return processed + "\n\n---\n\n" + sharedRules;
  }

  const headingLevel = convRulesMatch[1];
  const sectionStart = convRulesMatch.index! + convRulesMatch[0].length;

  // 找到下一个同级或更高级标题
  const afterSection = processed.slice(sectionStart);
  const nextHeadingRe = new RegExp(`\n#{1,${headingLevel.length}}\\s+`);
  const nextHeadingMatch = afterSection.match(nextHeadingRe);

  const insertAt = nextHeadingMatch
    ? sectionStart + nextHeadingMatch.index!
    : processed.length;

  return (
    processed.slice(0, insertAt) +
    "\n\n" +
    sharedRules +
    "\n\n" +
    processed.slice(insertAt)
  );
}

// ── 搜索阶段判断 ──────────────────────────────────────

/** 哪些阶段需要拼接搜索协议 */
const SEARCH_STAGES = new Set([2, 3, 5, 8]);

// ── 公开接口 ──────────────────────────────────────────

export interface LoadOptions {
  /** 阶段编号 */
  stage: number;
  /** 咨询还是收束 */
  mode: "consultation" | "converge";
  /** 注入变量（品牌名、品类等） */
  variables?: Record<string, string>;
  /** 是否拼接搜索协议（S2/S3/S5/S8 阶段建议开启） */
  includeSearchProtocol?: boolean;
  /** Decision Memory Context（前序阶段提取的战略资产） */
  decisionMemoryContext?: string;
  /** 搜索上下文（Search Intelligence Layer 产出，注入 system prompt） */
  searchContext?: string;
}

/** 加载并注入变量后的完整 System Prompt */
export function loadPrompt(options: LoadOptions): string {
  const {
    stage,
    mode,
    variables = {},
    includeSearchProtocol = false,
    searchContext,
  } = options;

  const filename = `stage${stage}-${mode}.md`;
  const filePath = resolve(PROMPTS_DIR, filename);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Prompt file not found: ${filename}`);
  }

  // ── 变量注入：{品牌名} 等占位符替换 ──────────────────
  let processed = raw;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    processed = processed.split(placeholder).join(value);
  }

  // ── 共用规则注入（仅 consultation 模式）────────────────
  if (mode === "consultation") {
    processed = injectSharedRules(processed, stage);
  }

  // ── 拼接搜索协议 ─────────────────────────────────────
  if (includeSearchProtocol || SEARCH_STAGES.has(stage)) {
    const protocol = loadSearchProtocol();
    if (protocol) {
      processed += `\n\n---\n\n## 搜索能力说明\n\n${protocol}`;
    }
  }

  // ── 搜索上下文注入（AI 已执行的搜索结果） ──────────────
  if (searchContext) {
    processed += `\n\n---\n\n## 已执行的搜索及其结果\n\n${searchContext}`;
  }

  // ── Decision Memory Context ──────────────────────────
  if (options.decisionMemoryContext) {
    processed += `\n\n## 前序阶段确认的战略资产\n\n${options.decisionMemoryContext}`;
  }

  return processed;
}

// ── 图片处理 ──────────────────────────────────────────

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 将相对路径图片转为 base64 data URL */
function imageToBase64(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:/.test(trimmed)) return trimmed;

  try {
    const filePath = join(process.cwd(), "public", trimmed.replace(/^\//, ""));
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString("base64");
    const ext = trimmed.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    };
    return `data:${mimeMap[ext] ?? "image/png"};base64,${base64}`;
  } catch {
    console.warn(`[loader] 无法读取图片: ${trimmed}`);
    return trimmed;
  }
}

/** Vision 模式：将 ![name](url) 转为多模态 content 数组 */
function toMultimodalContent(text: string): MessageContent {
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    parts.push({ type: "image_url", image_url: { url: imageToBase64(match[2]) } });
    lastIdx = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIdx < text.length) {
    parts.push({ type: "text", text: text.slice(lastIdx) });
  }
  if (!parts.some((p) => p.type === "text")) {
    parts.unshift({ type: "text", text: "请分析这张图片" });
  }
  return parts as MessageContent;
}

/** 文本模式：给包含图片的消息加上 AI 可读的上下文提示 */
function wrapImageAsText(text: string): string {
  const matches = text.match(IMAGE_RE);
  if (!matches || matches.length === 0) return text;

  const names = matches.map((m) => {
    const nameMatch = m.match(/!\[([^\]]*)\]/);
    return nameMatch?.[1] ?? "未知文件";
  });

  return `[系统提示] 用户上传了 ${names.length} 张图片（${names.join("、")}）。当前模型暂不支持直接查看图片内容，请根据文件名和对话上下文来判断图片可能的用途，并在回复中坦诚说明你无法查看图片这一限制。\n\n${text}`;
}

// ── buildMessages ──────────────────────────────────────

/**
 * 从对话历史构造 messages 数组。
 * - VISION_ENABLED=true → 图片以多模态 base64 发送（需模型支持 vision）
 * - VISION_ENABLED=false（默认）→ 图片保持文字 + 系统提示
 */
export function buildMessages(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newUserMessage?: string
): Array<{ role: "system" | "user" | "assistant"; content: MessageContent }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: MessageContent }> = [
    { role: "system", content: systemPrompt },
  ];

  const processUserContent = (text: string): MessageContent =>
    VISION_ENABLED ? toMultimodalContent(text) : wrapImageAsText(text);

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.role === "user" ? processUserContent(msg.content) : msg.content,
    });
  }

  if (newUserMessage) {
    messages.push({ role: "user", content: processUserContent(newUserMessage) });
  }

  return messages;
}

/** 判断某阶段是否需要搜索 */
export function isSearchStage(stage: number): boolean {
  return SEARCH_STAGES.has(stage);
}
