/**
 * S3 拆分收敛验证脚本
 *
 * 用法：npx tsx scripts/test-s3-split-convergence.ts
 *
 * 模拟一次完整的 S3 市场机会分析对话（含搜索展示 + AI 确认总结），
 * 分别测试：
 *   1. 拆分路径（A + B 独立调用）
 *   2. A 和 B 各自的成功/失败/重试情况
 *   3. 合并后的完整校验
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// 加载 env
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  console.warn("⚠️ .env.local 未加载");
}

import { runConvergenceSplit } from "../src/lib/ai/convergence";
import {
  marketInsightsSearchDataSchema,
  marketInsightsAnalysisSchema,
  marketInsightsSchema,
} from "../src/lib/schemas/market-insights";

// ── 模拟 S3 对话历史 ──────────────────────────────────

const MOCK_HISTORY: Array<{ role: "user" | "assistant"; content: string }> = [
  // AI 开场 + 搜索展示
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

**监管政策**：宠物食品归入饲料管理范围，需符合《宠物饲料管理办法》及相关国家标准。搜索范围内未找到具体的地方性额外限制。

接下来，我想先了解你对这个品类的观察。在你看来，目前宠物食品市场，消费者最不满意的是什么？`,
  },
  // 用户回复
  {
    role: "user",
    content: `我觉得最大的问题是成分不透明。很多品牌写着"天然""健康"，但消费者根本不知道里面到底是什么。我身边很多宠物主都在吐槽，买回去的粮猫狗不爱吃，或者吃了拉肚子。

另外我觉得现在市面上大部分都是标品，没有人真的针对不同品种、不同年龄的宠物去做定制化的东西。小型犬和大型犬的营养需求肯定不一样，但大部分品牌就是一个配方打天下。

还有就是用户体验上，我发现很多宠物主其实不知道该怎么选粮，只能靠小红书看测评，但测评又良莠不齐，很多是广告。`,
  },
  // AI 追问
  {
    role: "assistant",
    content: `你观察到的这三个现象很有意思。我们逐个深入一下：

关于成分不透明——你说的"不透明"具体指什么？是配料表看不懂，还是品牌声称的东西和实际不符？有没有具体遇到的案例？`,
  },
  // 用户回复
  {
    role: "user",
    content: `都有。配料表写的都是"鸡肉粉""动物蛋白"这种模糊的说法，消费者根本不知道是什么品质的鸡肉、占比多少。而且很多品牌宣传"0添加""天然"，但你去看配料表还是有防腐剂和诱食剂。

我有个朋友买的某进口品牌，宣传说是"加拿大进口天然粮"，结果一查发现是国内的工厂代工的，只是在加拿大注册了个品牌。这种事在行业里挺普遍的。`,
  },
  // AI 追问
  {
    role: "assistant",
    content: `明白了，这涉及两个层面的问题：一是标签法规本身的模糊空间，二是品牌利用信息不对称做营销。

关于定制化营养——你提到小型犬和大型犬需求不同，有没有更具体的场景？比如你观察到的哪些品种或生命阶段的需求是现在市场上没有被满足的？`,
  },
  // 用户回复
  {
    role: "user",
    content: `我主要关注猫这边。比如说布偶猫肠胃普遍比较敏感，但市面上几乎没有专门针对布偶猫肠胃特点的粮。还有老年猫的关节问题，大部分老年猫粮只是降低了蛋白质含量，没有针对关节养护做什么。

另外就是绝育后的猫，很容易发胖，需要控制体重但又要保证营养。现有的所谓"绝育猫粮"其实就是减少了脂肪含量，但没有考虑到绝育后猫的代谢变化和食欲调节。`,
  },
  // AI 追问
  {
    role: "assistant",
    content: `这些是很好的切入点。关于信息获取——你提到宠物主不知道该怎么选粮，主要靠小红书。你觉得这种信息获取方式最大的问题是什么？你理想中消费者应该怎么选粮？`,
  },
  // 用户回复
  {
    role: "user",
    content: `最大的问题是信息可信度。小红书上的测评到底是真实体验还是付费推广，消费者根本分辨不了。而且很多测评只看"猫咪爱不爱吃""颗粒大小"这种表面指标，没有人从营养学角度做分析。

我觉得理想的方式应该是有第三方的、标准化的评价体系，像手机评测那样，有客观的指标可以对比。但宠物食品这个行业目前连基本的成分透明都没做到，谈评测体系太远了。

所以我觉得，如果有品牌能先把"成分透明"这件事做到极致，就已经是很大的差异化。`,
  },
  // AI 确认总结（三段式）
  {
    role: "assistant",
    content: `好的，基于我们刚才的讨论，我来做一个阶段总结，请你确认：

**品类现状**：

| 维度 | 当前状态 | 变化趋势 |
|------|---------|---------|
| 市场规模 | 中国宠物食品市场约510亿元（艾瑞2024），年复合增长约18% | 持续扩大，功能性/鲜食细分增速更快 |
| 用户需求 | 宠物主对成分透明度、品质可溯源的关注度快速上升 | 从"吃饱"向"吃得健康"升级，信息对称需求强烈 |
| 供给格局 | 国际品牌仍占高端市场，国产品牌在中端快速崛起，但品牌集中度低 | 新品牌加速入场，供给侧从标品向细分场景分化 |

**当前体验不足**：

目前消费者在选粮过程中面临严重的信任缺失——配料表标注模糊（"鸡肉粉""动物蛋白"等笼统表述），品牌营销宣传与实际成分存在落差，部分品牌利用国内外注册信息差制造"假洋牌"形象。消费者目前依赖小红书等社交平台的测评内容来获取信息，但这些测评良莠不齐、付费推广与真实体验难以区分。

另一个重要缺口是精细化营养方案的缺失。不同品种（布偶猫肠胃敏感、老年猫关节问题、绝育猫代谢变化）在现有市场中找不到针对性的产品解决方案，大部分品牌仍以"一个配方覆盖全品种"的方式运营，忽略了宠物个体差异带来的细分需求。

**品牌机会方向**：

第一个方向是以"成分透明化"作为品牌的核心差异化——做到配料表可溯源、成分含量清晰标注、第三方检测报告公开。这个方向的判断依据来自创始人对消费者痛点的直接观察和行业现状分析。初步判断这是当前最明确且具有商业可行性的方向，但在具体的差异化表达方式和消费者沟通策略上还有待进一步验证。

第二个方向是针对特定品种或生命阶段的精细化营养方案——从布偶猫的肠胃敏感、绝育猫的体重管理等具体场景切入，建立"精准营养"的品牌定位。这个方向目前属于推测性判断，因为这需要更深入的消费者需求验证和产品研发能力评估，建议在后续阶段继续验证。`,
  },
];

// ── 主测试 ──────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  S3 拆分收敛测试");
  console.log("═══════════════════════════════════════════\n");
  console.log(`对话轮次: ${MOCK_HISTORY.filter((m) => m.role === "user").length}`);
  console.log(`消息总数: ${MOCK_HISTORY.length}\n`);

  const startTime = Date.now();

  // ── 执行拆分收敛 ─────────────────────────────────
  console.log("▶ 开始拆分收敛 (A + B)...\n");

  const result = await runConvergenceSplit({
    stage: 3,
    history: MOCK_HISTORY,
    variables: { 品牌名: "爪爪鲜食", 品类: "宠物食品" },
    decisionMemoryContext: `### 已确认事实
- [S1] 创始人观察到宠物主对成分透明度的关注度快速上升
- [S1] 宠物食品市场存在"假洋牌"现象，消费者信任度低
- [S2] 宠物食品赛道处于增长期，品类年增速约18%

### 已确认决策
- [S2] 初步方向：以消费者信任为核心差异化`,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── 报告结果 ────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log("  结果报告");
  console.log("═══════════════════════════════════════════\n");
  console.log(`总耗时: ${elapsed}s\n`);

  // ── A: 搜索数据层 ───────────────────────────────
  console.log("─── Convergence A（搜索数据层）───");
  if (result.searchData) {
    const validation = marketInsightsSearchDataSchema.safeParse(result.searchData);
    console.log(`状态: ✅ 成功`);
    console.log(`重试次数: ${result.searchDataRetries}`);
    console.log(`校验: ${validation.success ? "✅ 通过" : "❌ 失败"}`);
    if (!validation.success) {
      console.log(`校验错误:`, JSON.stringify(validation.error.issues, null, 2));
    }
    console.log(`\n输出摘要:`);
    console.log(`  marketSize: ${result.searchData.marketOverview?.marketSize?.substring(0, 60)}...`);
    console.log(`  growthRate: ${result.searchData.marketOverview?.growthRate?.substring(0, 60)}...`);
    console.log(`  marketStage: ${result.searchData.marketOverview?.marketStage}`);
    console.log(`  channelStructure: ${result.searchData.marketOverview?.channelStructure?.length ?? 0} 条`);
    console.log(`  currentTrends: ${result.searchData.industryTrend?.currentTrends?.length ?? 0} 条`);
    console.log(`  mainChannels: ${result.searchData.channelAnalysis?.mainChannels?.length ?? 0} 条`);
    console.log(`  trafficRules: ${result.searchData.channelAnalysis?.trafficRules?.length ?? "省略"} 条`);
    console.log(`  policies: ${result.searchData.regulatoryEnvironment?.policies?.length ?? 0} 条`);
    console.log(`  dataSources: ${result.searchData.dataSources?.length ?? 0} 条`);
  } else {
    console.log(`状态: ❌ 失败`);
    console.log(`重试次数: ${result.searchDataRetries}`);
    if (result.searchDataErrors?.length) {
      console.log(`错误:`);
      result.searchDataErrors.forEach((e) => console.log(`  - ${e}`));
    }
  }

  // ── B: AI 分析层 ────────────────────────────────
  console.log(`\n─── Convergence B（AI 分析层）───`);
  if (result.analysis) {
    const validation = marketInsightsAnalysisSchema.safeParse(result.analysis);
    console.log(`状态: ✅ 成功`);
    console.log(`重试次数: ${result.analysisRetries}`);
    console.log(`校验: ${validation.success ? "✅ 通过" : "❌ 失败"}`);
    if (!validation.success) {
      console.log(`校验错误:`, JSON.stringify(validation.error.issues, null, 2));
    }
    console.log(`\n输出摘要:`);
    console.log(`  categoryStatus.definition: ${result.analysis.categoryStatus?.definition?.substring(0, 60)}...`);
    console.log(`  categoryStatus.trends: ${result.analysis.categoryStatus?.trends?.length ?? 0} 条`);
    console.log(`  experienceGaps: ${result.analysis.experienceGaps?.length ?? 0} 个`);
    if (result.analysis.experienceGaps?.length > 0) {
      result.analysis.experienceGaps.forEach((g: any, i: number) => {
        console.log(`    [${i}] gap: ${g.gap?.substring(0, 50)}... | severity: ${g.severity}`);
      });
    }
    console.log(`  opportunityDirections: ${result.analysis.opportunityDirections?.length ?? 0} 个`);
    if (result.analysis.opportunityDirections?.length > 0) {
      result.analysis.opportunityDirections.forEach((od: any, i: number) => {
        console.log(`    [${i}] direction: ${od.direction?.substring(0, 50)}... | evidenceLevel: ${od.evidenceLevel}`);
      });
    }
  } else {
    console.log(`状态: ❌ 失败`);
    console.log(`重试次数: ${result.analysisRetries}`);
    if (result.analysisErrors?.length) {
      console.log(`错误:`);
      result.analysisErrors.forEach((e) => console.log(`  - ${e}`));
    }
  }

  // ── 合并校验 ────────────────────────────────────
  console.log(`\n─── 合并后完整校验 ───`);
  if (result.searchData && result.analysis) {
    const merged = { ...result.searchData, ...result.analysis };
    const fullValidation = marketInsightsSchema.safeParse(merged);
    if (fullValidation.success) {
      console.log("状态: ✅ 完整 Schema 校验通过");
      console.log(`合并字段数: ${Object.keys(merged).length}`);
    } else {
      console.log("状态: ❌ 完整 Schema 校验失败");
      console.log(JSON.stringify(fullValidation.error.issues, null, 2));
    }
  } else {
    console.log("状态: ⚠️ 无法合并（A 或 B 缺失）");
  }

  // ── 总结 ────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  总结`);
  console.log(`═══════════════════════════════════════════`);
  const aOk = result.searchData !== undefined;
  const bOk = result.analysis !== undefined;
  const totalRetries = result.searchDataRetries + result.analysisRetries;

  console.log(`A（搜索数据层）: ${aOk ? "✅" : "❌"} | 重试 ${result.searchDataRetries} 次`);
  console.log(`B（AI 分析层）:   ${bOk ? "✅" : "❌"} | 重试 ${result.analysisRetries} 次`);
  console.log(`总重试次数: ${totalRetries}`);
  console.log(`总耗时: ${elapsed}s`);
  console.log(`最终结果: ${aOk && bOk ? "✅ 全部通过" : "⚠️ 部分失败"}`);
  console.log();
}

main().catch((e) => {
  console.error("\n❌ 测试异常:", e.message);
  console.error(e.stack);
  process.exit(1);
});
