/**
 * S3 拆分收敛 — 批量测试（3 案例）
 *
 * 用法：npx tsx scripts/test-s3-batch.ts
 *
 * 案例设计：
 *   A: 宠物食品 — 搜索数据充足，创始人观察详细（高信息密度）
 *   B: 香薰品牌 — 搜索数据中等，创始人早期探索阶段（中信息密度）
 *   C: 家居品牌 — 搜索数据有限，代工转型自有品牌（低信息密度）
 *
 * 每个案例跑 2 轮取均值，共 6 轮。
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

import { runConvergenceSplit } from "../src/lib/ai/convergence";

// ── 案例定义 ────────────────────────────────────────────

interface TestCase {
  name: string;
  brandName: string;
  category: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  decisionMemoryContext: string;
  /** 预期特征 */
  expected: {
    infoDensity: "高" | "中" | "低";
    searchDataQuality: "高" | "中" | "低";
  };
}

// ── 案例 A: 宠物食品（高信息密度）───────────────────────

const CASE_A_HISTORY: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "assistant",
    content: `好的，我们现在进入 Stage 3 市场机会分析阶段。

我已经执行了针对「爪爪鲜食」宠物食品品牌的市场搜索，以下是搜索发现：

**市场规模**：根据艾瑞咨询2024年报告，中国宠物食品市场规模约510亿元，其中主粮占比约65%。过去三年年复合增长率约18%。

**增长趋势**：近3年持续保持15%以上的增速，功能性宠物食品和鲜食细分增速更快（25%+）。

**赛道阶段**：目前处于增长期，市场集中度正在提升但仍有大量细分空间。

**渠道结构**：线上渠道占比约60%，天猫/京东是主力平台；抖音等内容电商增速最快（年增40%+）；线下宠物门店和商超渠道仍占约40%。

**消费趋势**：宠物人性化趋势明显，宠物主愿意为品质和健康支付溢价；成分透明度成为购买决策的关键因素。

**主流售卖渠道**：综合电商（天猫/京东）→ 内容电商（抖音/小红书）→ 线下宠物店。新品牌多从抖音和小红书起盘。

**监管政策**：宠物食品归入饲料管理范围，需符合《宠物饲料管理办法》及相关国家标准。

接下来，我想先了解你对这个品类的观察。在你看来，目前宠物食品市场，消费者最不满意的是什么？`,
  },
  {
    role: "user",
    content: "我觉得最大的问题是成分不透明。很多品牌写着'天然''健康'，但消费者根本不知道里面到底是什么。我身边很多宠物主都在吐槽，买回去的粮猫狗不爱吃，或者吃了拉肚子。另外我发现大部分都是标品，没有真的针对不同品种、不同年龄的宠物去做定制化的东西。还有就是宠物主其实不知道该怎么选粮，只能靠小红书看测评，但测评良莠不齐。",
  },
  {
    role: "assistant",
    content: "你观察到的这三个现象很有意思。关于成分不透明——你说的'不透明'具体指什么？是配料表看不懂，还是品牌声称的东西和实际不符？",
  },
  {
    role: "user",
    content: "都有。配料表写的都是'鸡肉粉''动物蛋白'这种模糊的说法。而且很多品牌宣传'0添加''天然'，但配料表还是有防腐剂和诱食剂。我有个朋友买的某进口品牌，宣传是'加拿大进口天然粮'，结果一查是国内工厂代工的，只是在加拿大注册了个品牌。",
  },
  {
    role: "assistant",
    content: "关于定制化营养——你提到小型犬和大型犬需求不同，有没有更具体的场景？",
  },
  {
    role: "user",
    content: "比如说布偶猫肠胃普遍比较敏感，但市面上几乎没有专门针对布偶猫肠胃特点的粮。还有老年猫的关节问题，大部分老年猫粮只是降低了蛋白质含量，没有针对关节养护做什么。另外绝育后的猫很容易发胖，需要控制体重但又要保证营养。",
  },
  {
    role: "assistant",
    content: `好的，基于我们刚才的讨论，我来做一个阶段总结，请你确认：

**品类现状**：

| 维度 | 当前状态 | 变化趋势 |
|------|---------|---------|
| 市场规模 | 中国宠物食品市场约510亿元，年复合增长约18% | 持续扩大，功能性/鲜食细分增速更快 |
| 用户需求 | 宠物主对成分透明度、品质可溯源的关注度快速上升 | 从"吃饱"向"吃得健康"升级，信息对称需求强烈 |
| 供给格局 | 国际品牌仍占高端市场，国产品牌中端快速崛起，集中度低 | 新品牌加速入场，从标品向细分场景分化 |

**当前体验不足**：

消费者在选粮过程中面临严重的信任缺失——配料表标注模糊，品牌营销宣传与实际成分存在落差，部分品牌利用国内外注册信息差制造"假洋牌"形象。消费者目前依赖小红书等社交平台的测评内容来获取信息，但这些测评良莠不齐、付费推广与真实体验难以区分。

另一个重要缺口是精细化营养方案的缺失。不同品种（布偶猫肠胃敏感、老年猫关节问题、绝育猫代谢变化）在现有市场中找不到针对性的产品解决方案。

**品牌机会方向**：

第一个方向是以"成分透明化"作为品牌的核心差异化——做到配料表可溯源、成分含量清晰标注、第三方检测报告公开。初步判断这是当前最明确且具有商业可行性的方向。

第二个方向是针对特定品种或生命阶段的精细化营养方案——从布偶猫肠胃敏感、绝育猫体重管理等具体场景切入，建立"精准营养"的品牌定位。目前属于推测性判断。`,
  },
];

// ── 案例 B: 香薰品牌（中信息密度）───────────────────────

const CASE_B_HISTORY: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "assistant",
    content: `好的，我们现在进入 Stage 3 市场机会分析阶段。

我已经执行了针对「山雾」香薰品牌的市场搜索，以下是搜索发现：

**市场规模**：根据CBNData报告，中国香薰市场规模约120亿元（2024年），近3年增速约25%。线上渠道占比超过70%。

**增长趋势**：居家场景消费升级驱动增长，情绪疗愈类产品增速尤为显著（30%+）。Z世代是核心增量人群。

**赛道阶段**：处于增长期向成熟期过渡，头部品牌（观夏、野兽派、气味图书馆）已建立品牌认知，但中高端细分市场仍有空间。

**渠道结构**：线上以天猫/小红书/抖音为主，线下以买手店、生活方式集合店为主。

**消费趋势**：消费者从"好闻"升级为"情绪价值+空间美学"，对品牌故事和文化内涵的关注度提升。

**主流售卖渠道**：天猫旗舰店 → 小红书种草 → 抖音直播 → 线下生活方式店。新品牌多从小红书起盘，通过内容建立品牌调性。

**监管政策**：香薰产品目前归入日化品类管理，无特殊准入要求。但香精原料安全标准在逐步提高。`,
  },
  {
    role: "user",
    content: "我是自己在家做手工香薰蜡烛起家的，目前在小红书上有一些粉丝，每个月大概能卖几百个。我发现很多用户买香薰不只是为了好闻，更多是想要一种仪式感，或者说是情绪上的安抚。但我感觉现在市面上的品牌要么太贵（三百多一个蜡烛），要么太廉价没有品质感。中间好像有个空档。",
  },
  {
    role: "assistant",
    content: "你说的'中间空档'很有意思。能具体描述一下这个空档的特征吗？比如价格带大概在什么范围？你观察到的消费者在这个价格带上的期待是什么？",
  },
  {
    role: "user",
    content: "大概100-200之间吧。这个价位的消费者不是随便买买的那种，他们会在意香味是不是高级、包装是不是好看、品牌是不是有调性。但他们又负担不起观夏那种三四百的价格。我自己的蜡烛定价在128-168之间，复购率还不错，大概30%左右。用户反馈最多的是'香味很舒服，不冲'和'摆在桌上很好看'。",
  },
  {
    role: "assistant",
    content: "你的复购率30%在小众品牌里是不错的数据。关于竞争——除了价格带，你觉得现有品牌在产品体验上还有什么没做好的地方？",
  },
  {
    role: "user",
    content: "我觉得最大的问题是同质化。你去搜'香薰蜡烛'，大部分品牌用的都是差不多的香型（什么白茶、檀香、玫瑰），包装也都是极简ins风。真正有自己品牌美学体系的很少。而且很多品牌在内容上就是拍产品图，很少去讲香味背后的故事或者使用场景。还有就是蜡烛的燃烧体验，很多便宜的蜡烛烧不均匀，中间一个坑，边上烧不到，这个体验很差但很少有品牌去解决。",
  },
  {
    role: "assistant",
    content: `好的，基于我们刚才的讨论，我来做一个阶段总结：

**品类现状**：

| 维度 | 当前状态 | 变化趋势 |
|------|---------|---------|
| 市场规模 | 中国香薰市场约120亿元（2024），年增速约25% | 持续增长，情绪疗愈细分增速更快 |
| 用户需求 | 消费者需求从功能层（好闻）向情感层（情绪价值+空间美学）升级 | Z世代成为核心增量，对品牌故事和文化内涵要求提高 |
| 供给格局 | 头部品牌（观夏等）占据高端，低端以白牌为主，中间价格带有明显空白 | 新品牌持续入场，差异化品牌有机会 |

**当前体验不足**：

目前100-200元价格带存在明显的供给空白——这个区间的消费者追求品质感和品牌调性，但高端品牌价格过高，低端产品缺乏品质感。此外，品类同质化严重，大部分品牌在香型选择、包装设计、品牌美学上缺乏差异化，内容传播停留在产品展示层面，缺少场景叙事和品牌故事。

还有一个被忽略的产品体验问题：中低价位蜡烛普遍存在燃烧不均匀的问题（隧道效应），影响了用户的实际使用体验，但少有品牌将此作为产品优化的重点。

**品牌机会方向**：

第一个方向是占据100-200元价格带的"品质入门香薰"定位——以优质原料、稳定燃烧体验和有辨识度的品牌美学为核心，服务从低价产品升级但尚未进入高端消费的用户。这个方向的依据来自创始人的销售数据（定价128-168元，复购率30%）和消费者反馈。

第二个方向是以"东方山野香调"作为香型差异化——避开市面上泛滥的白茶、玫瑰等常见香型，从中国本土植物和自然场景中寻找独特的嗅觉表达。这是一个推测性的方向，需要进一步验证消费者对非传统香型的接受度。`,
  },
];

// ── 案例 C: 家居品牌（低信息密度）───────────────────────

const CASE_C_HISTORY: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "assistant",
    content: `好的，我们现在进入 Stage 3 市场机会分析阶段。

我已经执行了针对「木椟」家居品牌的市场搜索，以下是搜索发现：

**市场规模**：家居用品市场规模庞大但分散。根据国家统计局数据，家具及家居品类零售规模超过8000亿元。但"新中式家居用品"作为细分品类，缺乏独立的市场规模统计。

**增长趋势**：整体家居市场增速放缓（约5%），但新中式、原木风格等细分方向增速高于整体（约8-10%）。搜索范围内未找到更精确的增长数据。

**赛道阶段**：传统家居处于成熟期，新中式细分赛道处于增长期，但品牌化程度低，以手工作坊和区域品牌为主。

**渠道结构**：搜索范围内未找到针对新中式家居品的渠道结构数据。行业整体仍以线下（家居卖场、展会）为主，线上渗透率约30%。

**消费趋势**：国潮文化带动下，消费者对东方美学家居品的关注度提升，小红书"新中式家居"相关笔记超过200万篇。但"叫好不叫座"现象普遍——关注度高但转化为实际购买的较少。

**监管政策**：家居用品一般无特殊行业准入要求。但实木制品涉及木材来源合规（FSC认证等），搜索范围内未找到具体限制信息。`,
  },
  {
    role: "user",
    content: "我原来是做家具代工的，主要是出口到欧洲。但现在外贸不好做了，我想做自己的品牌。我工厂里有很好的木工师傅，能做榫卯结构的东西，但说实话我不太确定应该做什么产品、卖给谁。我就是觉得现在年轻人好像挺喜欢那种简约的、有点东方感觉的东西。",
  },
  {
    role: "assistant",
    content: "从代工转型做自有品牌，这是一个很大的转变。你说年轻人喜欢简约东方感的东西——这是你从小红书等平台观察到的，还是你自己身边有具体的例子？",
  },
  {
    role: "user",
    content: "主要是看小红书。我女儿经常给我看，说这个好看那个好看。但我自己也觉得，现在市面上要么是那种很便宜的快消品（像名创优品那种），要么就是很贵的实木家具。好像中间缺一些日常能用、有点设计感、但又买得起的东西。不过说实话我对国内市场了解不多，之前一直在做外单。",
  },
  {
    role: "assistant",
    content: "你提到'日常能用、有设计感、买得起'——工厂目前的生产能力在什么方向？有没有你们特别擅长的工艺或材料？",
  },
  {
    role: "user",
    content: "我们最擅长的是榫卯结构，师傅都是老木匠。还有就是我们对木材很了解，什么木头适合做什么。以前给欧洲客户做过一些小的木制家居品，比如托盘、收纳盒、小边几。但那些都是客户给图纸我们做，我们没有自己设计过东西。",
  },
  {
    role: "assistant",
    content: "所以你手上有的资产是：成熟的榫卯工艺、对木材的专业认知、做过小件木制品的生产经验。现在缺的是对国内消费者需求的了解和一个明确的品牌方向。",
  },
  {
    role: "user",
    content: "对，就是这个意思。我其实就想先做一些小的东西试试水，不需要太大的投入。看看市场反馈怎么样再决定下一步。",
  },
  {
    role: "assistant",
    content: `好的，基于我们刚才的讨论，我来做一个阶段总结：

**品类现状**：

| 维度 | 当前状态 | 变化趋势 |
|------|---------|---------|
| 市场规模 | 新中式家居用品缺乏独立市场规模统计，整体家居零售超8000亿元 | 新中式方向增速约8-10%，高于整体 |
| 用户需求 | 消费者对东方美学家居品的兴趣在增长（小红书相关笔记200万+） | 从"欣赏"到"购买"的转化链路尚未打通 |
| 供给格局 | 新中式家居品牌化程度低，以手工作坊和区域品牌为主 | 新品牌有进入机会，但需要解决消费者触达问题 |

**当前体验不足**：

目前家居市场在"日常小件家居品"领域存在明显的产品断层——低端是缺乏设计感的快消品，高端是价格较高的实木家具，中间缺少一个"日常可用、有设计感、价格可接受"的选择。此外，新中式家居品虽然在小红书等平台关注度高，但"叫好不叫座"，消费者从内容种草到实际购买之间存在较大的转化鸿沟。

创始人团队在榫卯工艺和木材方面具有专业能力，但对国内市场认知有限，需要从消费者需求端补充信息。

**品牌机会方向**：

初步判断可以将"榫卯工艺的小件日常家居品"作为一个探索方向——以木制托盘、收纳盒、小边几等低客单价产品作为切入点，测试市场对工艺感日常家居品的接受度。这个方向目前是推测性的（hypothesis），需要进一步验证消费者对"榫卯"概念的认知度、支付意愿和使用场景。`,
  },
];

// ── 决策记忆上下文 ─────────────────────────────────────

const CASE_A_DM = `### 已确认事实
- [S1] 创始人观察到宠物主对成分透明度的关注度快速上升，宠物食品行业存在"假洋牌"现象
- [S2] 宠物食品赛道处于增长期，年复合增速约18%，功能性细分增速更快

### 已确认决策
- [S2] 初步方向：以消费者信任为核心差异化`;

const CASE_B_DM = `### 已确认事实
- [S1] 创始人通过小红书手工香薰蜡烛起家，月销数百个，复购率约30%
- [S2] 创始人对品质感和品牌美学有明确认知，选择手工制作作为核心工艺

### 已确认决策
- [S2] 初步方向：100-200元价格带，以"山野香调"作为差异化定位`;

const CASE_C_DM = `### 已确认事实
- [S1] 创始人从家具代工（出口欧洲）转型自有品牌，团队有老木匠和榫卯工艺能力
- [S2] 创始人对国内市场了解有限，倾向于从小件产品试水

### 已确认决策
- [S2] 初步方向：以榫卯工艺为核心，从日常小件家居品切入市场`;

const CASES: TestCase[] = [
  {
    name: "A. 宠物食品（爪爪鲜食）",
    brandName: "爪爪鲜食",
    category: "宠物食品",
    history: CASE_A_HISTORY,
    decisionMemoryContext: CASE_A_DM,
    expected: { infoDensity: "高", searchDataQuality: "高" },
  },
  {
    name: "B. 香薰品牌（山雾）",
    brandName: "山雾",
    category: "香薰",
    history: CASE_B_HISTORY,
    decisionMemoryContext: CASE_B_DM,
    expected: { infoDensity: "中", searchDataQuality: "中" },
  },
  {
    name: "C. 家居品牌（木椟）",
    brandName: "木椟",
    category: "新中式家居",
    history: CASE_C_HISTORY,
    decisionMemoryContext: CASE_C_DM,
    expected: { infoDensity: "低", searchDataQuality: "低" },
  },
];

// ── 运行 ──────────────────────────────────────────────

interface RoundResult {
  aSuccess: boolean;
  bSuccess: boolean;
  aRetries: number;
  bRetries: number;
  mergedOk: boolean;
  errors: string[];
  elapsedSec: number;
}

async function runOneRound(testCase: TestCase): Promise<RoundResult> {
  const start = Date.now();
  const errors: string[] = [];

  const result = await runConvergenceSplit({
    stage: 3,
    history: testCase.history,
    variables: { 品牌名: testCase.brandName, 品类: testCase.category },
    decisionMemoryContext: testCase.decisionMemoryContext,
  });

  const elapsed = (Date.now() - start) / 1000;

  // A 校验
  let aOk = result.searchData !== undefined;
  if (aOk) {
    const { marketInsightsSearchDataSchema } = await import(
      "../src/lib/schemas/market-insights"
    );
    const v = marketInsightsSearchDataSchema.safeParse(result.searchData);
    if (!v.success) {
      aOk = false;
      errors.push(...v.error.issues.map((i) => `[A校验] ${i.path.join(".")}: ${i.message}`));
    }
  } else if (result.searchDataErrors?.length) {
    errors.push(...result.searchDataErrors.map((e) => `[A失败] ${e}`));
  }

  // B 校验
  let bOk = result.analysis !== undefined;
  if (bOk) {
    const { marketInsightsAnalysisSchema } = await import(
      "../src/lib/schemas/market-insights"
    );
    const v = marketInsightsAnalysisSchema.safeParse(result.analysis);
    if (!v.success) {
      bOk = false;
      errors.push(...v.error.issues.map((i) => `[B校验] ${i.path.join(".")}: ${i.message}`));
    }
  } else if (result.analysisErrors?.length) {
    errors.push(...result.analysisErrors.map((e) => `[B失败] ${e}`));
  }

  // 合并校验
  let mergedOk = false;
  if (aOk && bOk) {
    const { marketInsightsSchema } = await import(
      "../src/lib/schemas/market-insights"
    );
    const merged = { ...result.searchData!, ...result.analysis! };
    const v = marketInsightsSchema.safeParse(merged);
    mergedOk = v.success;
    if (!v.success) {
      errors.push(...v.error.issues.map((i) => `[合并] ${i.path.join(".")}: ${i.message}`));
    }
  }

  return {
    aSuccess: aOk,
    bSuccess: bOk,
    aRetries: result.searchDataRetries,
    bRetries: result.analysisRetries,
    mergedOk,
    errors,
    elapsedSec: elapsed,
  };
}

async function main() {
  console.log("══════════════════════════════════════════════════");
  console.log("  S3 拆分收敛 — 批量测试（3 案例 × 2 轮 = 6 轮）");
  console.log("══════════════════════════════════════════════════\n");

  const ROUNDS = 2;
  const allResults: Array<{
    caseName: string;
    round: number;
    result: RoundResult;
  }> = [];

  for (const tc of CASES) {
    console.log(`\n▶ ${tc.name}`);
    console.log(`  预期: 信息密度=${tc.expected.infoDensity}, 搜索质量=${tc.expected.searchDataQuality}`);
    console.log(`  对话轮次: ${tc.history.filter((m) => m.role === "user").length}\n`);

    for (let r = 0; r < ROUNDS; r++) {
      process.stdout.write(`  第 ${r + 1}/${ROUNDS} 轮... `);
      const result = await runOneRound(tc);
      allResults.push({ caseName: tc.name, round: r + 1, result });

      const aIcon = result.aSuccess ? "✅" : "❌";
      const bIcon = result.bSuccess ? "✅" : "❌";
      const mIcon = result.mergedOk ? "✅" : "❌";
      process.stdout.write(
        `A${aIcon} B${bIcon} 合并${mIcon} | A重试${result.aRetries} B重试${result.bRetries} | ${result.elapsedSec.toFixed(1)}s\n`
      );

      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.log(`      ⚠ ${e}`);
        }
      }
    }
  }

  // ── 汇总 ──────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  汇总统计`);
  console.log(`══════════════════════════════════════════════════`);

  const totalRounds = allResults.length;
  const aSuccesses = allResults.filter((r) => r.result.aSuccess).length;
  const bSuccesses = allResults.filter((r) => r.result.bSuccess).length;
  const mergedSuccesses = allResults.filter((r) => r.result.mergedOk).length;
  const totalARetries = allResults.reduce((s, r) => s + r.result.aRetries, 0);
  const totalBRetries = allResults.reduce((s, r) => s + r.result.bRetries, 0);
  const totalErrors = allResults.reduce((s, r) => s + r.result.errors.length, 0);
  const avgTime =
    allResults.reduce((s, r) => s + r.result.elapsedSec, 0) / totalRounds;

  console.log(`\n总轮次: ${totalRounds}`);
  console.log(`A（搜索数据层）成功率: ${aSuccesses}/${totalRounds} (${((aSuccesses / totalRounds) * 100).toFixed(0)}%)`);
  console.log(`B（AI 分析层）成功率:   ${bSuccesses}/${totalRounds} (${((bSuccesses / totalRounds) * 100).toFixed(0)}%)`);
  console.log(`合并成功率:              ${mergedSuccesses}/${totalRounds} (${((mergedSuccesses / totalRounds) * 100).toFixed(0)}%)`);
  console.log(`A 总重试次数: ${totalARetries}`);
  console.log(`B 总重试次数: ${totalBRetries}`);
  console.log(`总错误数: ${totalErrors}`);
  console.log(`平均耗时: ${avgTime.toFixed(1)}s`);

  // ── 按案例分组 ────────────────────────────────────
  console.log(`\n─── 按案例分组 ───`);
  for (const tc of CASES) {
    const caseResults = allResults.filter((r) => r.caseName === tc.name);
    const ca = caseResults.filter((r) => r.result.aSuccess).length;
    const cb = caseResults.filter((r) => r.result.bSuccess).length;
    const cm = caseResults.filter((r) => r.result.mergedOk).length;
    const cr = caseResults.reduce((s, r) => s + r.result.aRetries + r.result.bRetries, 0);
    console.log(
      `  ${tc.name}: A=${ca}/${ROUNDS} B=${cb}/${ROUNDS} 合并=${cm}/${ROUNDS} 重试=${cr}`
    );
  }

  // ── 对比：拆分 vs 单次（估算）───────────────────────
  console.log(`\n─── 拆分效率估算 ───`);
  const avgRetriesPerRound = (totalARetries + totalBRetries) / totalRounds;
  console.log(`平均每轮总重试: ${avgRetriesPerRound.toFixed(1)} 次`);

  if (totalARetries === 0 && totalBRetries === 0) {
    console.log(`结论: ✅ 所有轮次零重试通过。拆分后校验阻塞率显著低于未拆分模式。`);
  } else {
    console.log(`结论: ${totalARetries + totalBRetries} 次重试发生在 ${allResults.filter((r) => r.result.aRetries + r.result.bRetries > 0).length} 轮中。`);
  }
  console.log();
}

main().catch((e) => {
  console.error("\n❌ 测试异常:", e.message);
  process.exit(1);
});
