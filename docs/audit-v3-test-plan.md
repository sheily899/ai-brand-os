# AI Brand OS Strategic Quality Audit System V3.1 — 完整验证方案

> 版本: 1.0  
> 日期: 2026-08-03  
> 范围: V3.1 升级验证（统一四维框架 + S1-S8 阶段差异化 Evaluation Criteria + Evidence 三维子维度模型 + 权重重校准）  
> 被测文件: `src/lib/audit/ai-quality.ts` (873 行)

---

## 目录

1. [测试目标](#1-测试目标)
2. [被测系统概述](#2-被测系统概述)
3. [第一部分：测试样本设计](#3-第一部分测试样本设计)
4. [第二部分：阶段专项测试](#4-第二部分阶段专项测试)
5. [第三部分：模型稳定性测试](#5-第三部分模型稳定性测试)
6. [第四部分：多模型对比测试](#6-第四部分多模型对比测试)
7. [第五部分：人工专家一致性测试](#7-第五部分人工专家一致性测试)
8. [第六部分：回归测试](#8-第六部分回归测试)
9. [第七部分：最终验收标准](#9-第七部分最终验收标准)
10. [执行计划与时间线](#10-执行计划与时间线)

---

## 1. 测试目标

### 1.1 核心验证问题

| # | 验证问题 | 为什么重要 |
|---|---------|-----------|
| 1 | 不同阶段是否按照**不同判断标准**评分？ | 这是 V3.1 的核心升级——从统一评分到阶段差异化 |
| 2 | Evidence 是否根据阶段类型进行**差异化审查**？ | Evidence 三维子维度模型是 V3.1 的最大变化 |
| 3 | 高质量/一般质量/低质量案例是否被**正确区分**？ | 验证评分的区分度和校准 |
| 4 | 不同模型、不同运行次数下结果是否**稳定**？ | 验证系统可靠性 |
| 5 | 审计结果是否**接近专业品牌咨询判断**？ | 验证战略判断准确性 |

### 1.2 非目标

- ❌ 不测试 Rule Check（纯代码逻辑，已有单元测试覆盖）
- ❌ 不测试 Cross Stage Context Check Layer A（纯代码引用完整性检查）
- ❌ 不测试 Workflow Engine 状态转移
- ❌ 不测试 Consultation/Convergence 流程
- ❌ 不测试前端 UI 展示

---

## 2. 被测系统概述

### 2.1 V3.1 关键变化

```
V3.0（修改前）                          V3.1（修改后）
───────────────────────────           ───────────────────────────
统一四维评分                           统一四维框架
  无阶段差异化                     →    + S1-S8 阶段差异化权重
  无评分锚点                            + 每阶段独立 scoringAnchors
Evidence = 单维度                      Evidence = 三维子维度
  "有没有数据？"                    →     Presence + Reliability + Connection
权重均分或接近均分                      权重按阶段战略目的重校准
```

### 2.2 V3.1 权重总览

| Stage | Specificity | Differentiation | Actionability | Evidence | 主导逻辑 |
|:---:|:---:|:---:|:---:|:---:|:---|
| S1 用户访谈 | 35% | 10% | 30% | 25% | Spec 主导，验证商业真实性 |
| S2 商业背景 | 30% | 10% | 35% | 25% | Action 主导，验证商业现实性 |
| S3 市场机会 | 20% | 20% | 20% | **40%** | **Evidence 全系统最高**，外部市场依据 |
| S4 消费者洞察 | 30% | 20% | 15% | **35%** | Spec+Evidence，行为证据验证 |
| S5 竞争判断 | 20% | **40%** | 25% | 15% | **Diff 全系统最高**，竞争差异发现 |
| S6 品牌战略 | 25% | 35% | 25% | 15% | Diff+Action，战略枢纽 |
| S7 视觉策略 | 20% | 35% | 35% | 10% | Diff+Action，视觉执行双驱动 |
| S8 内容规划 | 20% | 15% | **45%** | 20% | **Action 全系统最高**，内容执行体系 |

### 2.3 Evidence 三维子维度模型

```
Evidence 评分 = Presence + Reliability + Connection

Presence（证据存在性）：结论是否有明确来源？
Reliability（证据可信度）：来源是否真实、有效、有代表性？
Connection（证据关联性）：证据是否真正支持战略判断？
```

### 2.4 门禁阈值

| Stage | Advance | Reoptimize | Block |
|:---:|:---:|:---:|:---:|
| S1 | ≥70 | 50-69 | <50 |
| S2 | ≥70 | 50-69 | <50 |
| S3 | ≥70 | 55-69 | <55 |
| S4 | ≥70 | 55-69 | <55 |
| S5 | ≥70 | 55-69 | <55 |
| S6 | ≥75 | 60-74 | <60 |
| S7 | ≥75 | 60-74 | <60 |
| S8 | ≥70 | 55-69 | <55 |

### 2.5 测试基础设施

已有测试脚本：
- `scripts/test-ai-quality.ts` — AI Quality Audit smoke test（配置完整性 + 门禁合并逻辑）
- `scripts/compare-audit.ts` — 跨模型对比 + 单模型噪音基线（3 次调用/阶段）
- `scripts/noise-baseline.ts` — temperature=0 噪音基线
- `scripts/run-batch.ts` — S1-S8 全链路批量测试

测试框架：无（纯 TypeScript 脚本，`npx tsx scripts/*.ts` 执行）

---

## 3. 第一部分：测试样本设计

### 3.1 设计原则

1. **样本必须覆盖 S1-S8 全阶段**：每个案例提供完整的 8 阶段输出 JSON
2. **样本必须可直接调用 `runAIQualityAudit()`**：无需走完整 consultation 流程
3. **样本质量必须有明确预期**：高/中/低三档，每档有预期分数区间
4. **样本覆盖不同品类**：餐饮、零售、服务，验证品类无关性

### 3.2 Case A：高质量品牌战略案例 — "慢象咖啡"

#### 设计思路

基于 `reference/brand-domain-cases.md` 中的画像 1（林小雪 / 慢象咖啡），扩展为完整的高质量 S1-S8 输出。特点：

- S1 包含具体创始人经历（时间/情境/观察四要素）
- S2 有商业模式具体数据（客单价/复购率/成本结构）
- S3 有外部市场数据引用（咖啡行业报告/搜索趋势/消费数据）
- S4 有用户行为观察和用户原话支撑
- S5 有竞品功能对比和用户评价引用
- S6 有完整 S3→S4→S5→S6 推导链，reasoning 标注字段名+内容摘要
- S7 每个视觉决策可追溯到 S6 品牌人格
- S8 平台选择有用户行为依据，内容支柱可追溯到 S4/S6

#### S1 用户访谈 — 高质量

```json
{
  "founderMotivation": {
    "content": "林小雪在阿里巴巴担任产品经理6年后，于2025年3月辞职。触发事件：2024年双11期间，她负责的一个项目因沟通流程繁琐导致延期，同时她发现自己每天唯一的放松时刻是午休时去公司楼下精品咖啡馆的30分钟。她开始思考：为什么普通人觉得精品咖啡有距离感？她走访了杭州12家社区咖啡馆后发现，大部分在'专业'和'亲近'之间摇摆——要么像实验室让普通人不敢进，要么像网红店但咖啡品质一般。2025年4月，她在杭州拱墅区租下店面，用自己6年产品思维做'不需要懂咖啡也能感受到用心'的社区咖啡空间。",
    "source": "founder_statement",
    "confidence": "confirmed_fact"
  },
  "observations": [
    {
      "subject": "第一次进来的客人",
      "context": "2025年5月开店首周，观察位置：收银台旁",
      "behavior": "10位新客中有7位第一句话问'哪个最甜'或'有没有不苦的'，不敢尝试单品手冲",
      "result": "说明普通消费者对精品咖啡的认知门槛是真实存在的，不是假设",
      "evidenceType": "direct_observation"
    },
    {
      "subject": "每周来3次的熟客",
      "context": "2025年6月，开店第5周",
      "behavior": "熟客开始主动问'今天有没有新豆子'，能说出上次喝的豆子风味差异",
      "result": "说明经过引导后，普通消费者可以建立咖啡品味，关键在降低初始门槛",
      "evidenceType": "direct_observation"
    },
    {
      "subject": "社区大爷大妈",
      "context": "2025年5-6月，每天下午4-6点",
      "behavior": "多次在门口探头但不进来，有一次一位大妈问'这里一杯多少钱'，听到28元后说'这么贵'就走了",
      "result": "社区店的价格感知和实际人群消费力之间存在信息不对称",
      "evidenceType": "direct_observation"
    }
  ],
  "constraints": {
    "budget": "自有资金30万，已投入装修+设备22万，剩余8万用于运营",
    "team": "夫妻2人 + 1名兼职咖啡师，丈夫负责运营/财务，小雪负责产品/体验/营销",
    "timeline": "2025年4月开业，目标3个月内实现月度盈亏平衡（月营收≥4.5万）"
  },
  "founderType": "problem_driven",
  "confirmedProblems": [
    "精品咖啡馆在'专业'和'亲近'之间存在体验断层",
    "普通消费者对精品咖啡有认知门槛，但可以被引导跨越",
    "社区咖啡的定价需要与周边消费力匹配，同时保持品质差异化"
  ]
}
```

#### S2 商业背景分析 — 高质量

```json
{
  "businessModel": {
    "productForm": "社区精品咖啡馆，主打单品手冲+意式经典+季节特调，搭配手工甜品（2-3款自研）",
    "revenueModel": "堂饮70%（客单价28-45元）+ 咖啡豆零售20%（客单价68-128元/250g）+ 甜品10%",
    "deliveryMethod": "线下门店体验为主，小程序支持到店自取和咖啡豆邮寄",
    "currentStage": "MVP验证期——2025年4月开业，截至6月底月营收约3.2万，距盈亏平衡差1.3万"
  },
  "marketContext": "2025年中国咖啡市场规模约2800亿，年增速15-18%。其中精品咖啡占比从2020年8%升至2025年15%。杭州作为新一线城市，独立咖啡馆密度全国第三（每万人2.1家），但社区型精品咖啡馆的闭店率高达40%（12个月内），主要原因是定位不清和客群教育不足。",
  "drivingForces": [
    {
      "force": "咖啡消费从'功能提神'向'日常仪式'转变",
      "evidence": "根据《2025中国咖啡消费白皮书》，45%消费者选择咖啡馆的首要理由是'空间体验'而非'咖啡品质'或'便利性'"
    },
    {
      "force": "社区商业回潮——后疫情时代'15分钟生活圈'消费占比提升",
      "evidence": "杭州市商务局2025年数据：社区商业客流同比增22%，购物中心持平"
    },
    {
      "force": "消费者对'专业感'的重新定义——从'术语壁垒'转向'透明真诚'",
      "evidence": "大众点评2025咖啡品类评价词频分析：'舒服'首次超过'专业'成为第一高频词"
    }
  ],
  "strategicWindow": "2025年下半年是窗口期：社区精品咖啡赛道尚未出现头部品牌（对比上海Manner已下沉社区），杭州本地竞品大多还在'专业精品'或'网红打卡'两极，中间地带空白明显",
  "externalChallenges": ["社区消费力参差——拱墅区周边居民月均餐饮支出约1200元，咖啡预算约150-200元/月"],
  "internalChallenges": ["8万剩余运营资金若按当前月亏损1.3万，仅能支撑6个月"],
  "directionHypothesis": "将慢象咖啡定位为'社区咖啡教育者'——通过降低门槛的产品设计（入门级手冲套餐）+ 咖啡知识内容（社区咖啡小课堂）+ 熟客成长体系（豆子护照），在'专业'和'亲近'之间建立第三条路径"
}
```

#### S3 市场机会分析 — 高质量

```json
{
  "categoryStatus": {
    "definition": "社区精品咖啡——以社区居民为核心客群、提供精品级咖啡品质同时降低消费门槛的独立咖啡馆形态。品类边界：区别于商业区快咖啡（瑞幸/Manner）、区别于商场精品咖啡（%Arabica/Peet's）、区别于社区奶茶店。地域范围：杭州主城区（拱墅/西湖/上城/滨江）。",
    "currentState": "杭州独立咖啡馆约1200家，其中社区型约350家（29%），但真正实现'品质+社区+可持续盈利'的不超过15家（4.3%）。70%社区咖啡馆在12个月内调整定位或关闭。",
    "trends": [
      {
        "trend": "社区咖啡客单价出现两极分化——15元以下快咖和35元以上精品咖各占35%，中间价位（20-30元）有30%空白",
        "source": "美团《2025上半年杭州咖啡品类报告》"
      },
      {
        "trend": "咖啡豆零售在社区店的收入占比从2023年5%升至2025年12%，'在家喝好咖啡'需求快速增长",
        "source": "淘宝天猫《2025咖啡豆消费趋势》，搜索'咖啡豆'的杭州用户同比增45%"
      }
    ]
  },
  "experienceGaps": [
    {
      "gap": "精品咖啡新人被'专业术语墙'挡在门外——不知道如何点单、不敢提问、怕被笑话",
      "currentAlternative": "转向瑞幸/星巴克等标准化产品，虽然品质不如但'安全'",
      "severity": "high"
    },
    {
      "gap": "愿意尝试精品咖啡的用户缺乏持续探索路径——第一次喝了觉得不错，但不知道下一步该喝什么",
      "currentAlternative": "停留在同一款出品（通常是最甜的），无法建立咖啡品味",
      "severity": "high"
    }
  ],
  "opportunityDirections": [
    {
      "direction": "咖啡教育型社区空间——用'引导式消费体验'替代'专业术语展示'",
      "rationale": "用户需要的是被引导而非被教育，产品设计应该自然降低门槛而非降低品质",
      "evidenceLevel": "verified",
      "source": "大众点评杭州精品咖啡评价分析：提及'店员耐心解释'的好评率是提及'咖啡专业'的2.3倍"
    },
    {
      "direction": "咖啡豆订阅+社区咖啡小课堂——将低频门店消费延伸为高频家庭消费",
      "rationale": "熟客复购驱动力是'想在办公室/家里也喝到好咖啡'，这一需求目前没有被满足",
      "evidenceLevel": "inferred",
      "source": "慢象咖啡前50位熟客调研：38%表示愿意订阅月度咖啡豆（客单价预期80-120元），其中20-30元/杯的消费习惯可转化为家庭场景"
    }
  ]
}
```

#### S4 消费者洞察 — 高质量

```json
{
  "targetConsumer": {
    "definition": "25-35岁城市知识工作者，居住在杭州主城区中档社区，月收入1-3万。他们对生活质量有追求但不愿被消费主义裹挟，追求'有节制的讲究'——在能力范围内选择更好的体验，但不追求奢侈。咖啡对他们而言不是提神工具，而是日常中可控的一小段'属于自己的时间'。",
    "behaviorPatterns": ["工作日每天1-2杯咖啡（早上一杯快咖提神，周末或下午去喜欢的咖啡馆坐坐）", "选择咖啡馆时首要考虑步行可达（15分钟以内）", "愿意为'舒服的空间'付出溢价但不超过日常预算的15%"],
    "decisionMotives": ["品质安全感——不想踩雷（最难喝的咖啡也比速溶好的底线思维）", "身份表达——'我去的咖啡馆'反映个人品味但不需要太高调", "社交润滑——有一个'我的咖啡馆'可以带朋友去，不需要解释太多"]
  },
  "functionalNeeds": [
    {
      "need": "好喝的咖啡——比连锁店好、不需要专业知识也能分辨的好",
      "brandImplication": "产品设计应该让'好喝'变得显而易见（口味描述去术语化），而非让用户自学成才"
    }
  ],
  "identityNeeds": [
    {
      "need": "做一个'会生活的人'而非'懂咖啡的人'——用户想获得的身份标签是生活品味，不是咖啡知识",
      "evidence": "慢象咖啡大众点评评价词频TOP3：舒服(42%)、安静(35%)、有品位(28%)；专业(12%)、懂咖啡(5%)排名靠后",
      "brandImplication": "品牌表达应该围绕'生活仪式感'而非'咖啡专业性'"
    }
  ],
  "existingSolutions": [
    {
      "solutionType": "精品咖啡馆（以专业/品质为核心定位）",
      "failReason": "已满足：咖啡品质好。缺失：不提供引导路径——默认用户已经懂咖啡，新人感到被排斥。造成的摩擦：用户只在'想喝好咖啡'时才来（低频），不会把这里当作日常空间。"
    }
  ],
  "idealSelfReflection": "我希望有一个走路就能到的舒服地方，那里的咖啡好喝但不需要我懂咖啡，店员认识我但不过分热情，我可以在那里安静地待半小时——这段独处时间是我给自己的小奖励。"
}
```

#### S5 竞争判断 — 高质量

```json
{
  "competitiveLandscape": {
    "dimensions": ["价格带", "专业度-亲和力", "空间属性"],
    "convergenceAndDivergence": "杭州社区咖啡在'专业精品'和'网红打卡'两极集中，中间地带（有品质的社区日常空间）几乎空白。竞品在'让人进来'和'让人留下来'之间普遍只解决了一个问题。"
  },
  "directCompetitors": [
    {
      "name": "某专业精品社区咖啡馆（化名：A咖啡馆）",
      "positioning": "杭州最有态度的社区手冲咖啡馆",
      "keySellingPoint": "每周更换单品豆单，咖啡师有Q-Grader认证",
      "weakness": "菜单全英文+专业术语，普通消费者看不懂。大众点评评价：'咖啡好喝但不敢问问题，怕显得很蠢'。12个月内营业额下降30%，已开始转型外卖。"
    },
    {
      "name": "某网红打卡社区咖啡馆（化名：B咖啡馆）",
      "positioning": "杭州最美社区咖啡馆",
      "keySellingPoint": "ins风装修，每个角落都能出片",
      "weakness": "咖啡品质不稳定（大众点评差评集中在'拍照好看但咖啡难喝'），客群以打卡一次为主，复购率<10%。空间嘈杂不适合久坐。"
    }
  ],
  "whitespaceOpportunity": "在'专业但排斥'和'好看但难喝'之间，存在'好喝+舒服+想再来'的日常空间空白。核心机会不是'比A更专业'或'比B更好看'，而是'让一个普通人愿意每周来3次'——这需要同时解决品质（好喝）、体验（舒服）、关系（认识你）三个维度。"
}
```

#### S6 品牌核心战略 — 高质量

```json
{
  "positioning": "对于杭州社区中追求'日常中有品质的独处时刻'的城市知识工作者，慢象咖啡是一个'不需要懂咖啡也能感受到用心'的社区咖啡空间。不同于强调专业术语的精品咖啡馆，慢象用引导式体验让每个人自然地找到自己喜欢的咖啡；不同于追求打卡的网红店，慢象让人愿意每周来坐一坐——因为这里的好咖啡、安静空间和对你的认识，构成了一种可控的、踏实的日常幸福。",
  "valuePropositions": [
    {
      "level": "functional",
      "proposition": "好喝且不用费心——每款咖啡有'像什么'的口味描述（像烤坚果/像黑巧克力/像焦糖布丁），选咖啡像选甜点一样自然",
      "soWhatDerivation": "S4发现：用户需要'品质安全感'，但专业术语制造门槛。去术语化的口味描述直接解决这一问题。"
    },
    {
      "level": "emotional",
      "proposition": "每天的30分钟奖励——一个步行可达的安静角落，让人从工作/家庭的角色中切换出来，拥有一段纯粹属于自己的时间",
      "soWhatDerivation": "S4 identityNeeds：用户想成为'会生活的人'。固定空间+固定仪式=可控的日常幸福感。"
    },
    {
      "level": "social",
      "proposition": "我的咖啡馆——可以自信地带朋友去的地方，不需要解释'为什么选这里'，因为对方坐下就能感受到",
      "soWhatDerivation": "S4发现：用户需要一个不费力就能表达品味的地方。空间本身的体验就是最好的社交信号。"
    }
  ],
  "brandStory": {
    "struggleMoment": "林小雪在阿里最后一年，每天唯一的期待是午休30分钟去楼下咖啡馆。她发现自己不是在喝咖啡——是在用一杯咖啡的时间从KPI、钉钉、周报中逃离。但周围的精品咖啡馆要么太'专业'让人紧张，要么太'网红'无法安静。",
    "brandAction": "她决定用产品经理的方式重新设计社区咖啡馆——把'专业感'藏在产品里，把'舒服感'放在体验上。像做一个好产品一样，让用户在不知不觉中感受到品质，而不是被告知'这是好咖啡'。",
    "brandRelationship": "慢象不打搅你——不是服务员过来说'这是我们的单品手冲采用埃塞俄比亚日晒处理法'，而是你喝了一口发现'诶这个咖啡有点不一样'，下次自己主动问'今天有什么新豆子'。这种自然建立的关系比任何营销都牢固。"
  },
  "brandPersonality": [
    {
      "trait": "克制",
      "dos": "用'像烤坚果'代替'坚果风味调性'；空间留白超过装饰；不说话时不觉得尴尬",
      "donts": "不过度介绍咖啡知识；不放品牌slogan在每面墙上；不要求用户'懂'"
    },
    {
      "trait": "真诚",
      "dos": "告诉用户这个豆子为什么选它（因为好喝，不是因为贵）；承认有些豆子不一定每个人都喜欢",
      "donts": "不编造咖啡故事；不用'匠心''极致'等空洞词汇"
    },
    {
      "trait": "日常",
      "dos": "像社区便利店一样随性——来了就坐，不点咖啡也可以；店员穿日常服装不是制服",
      "donts": "不营造'你必须消费什么才能待在这里'的压力；不用限量款制造稀缺焦虑"
    },
    {
      "trait": "细腻",
      "dos": "记住熟客的口味偏好；调整音乐音量到刚好盖过隔壁桌的低声聊天",
      "donts": "不过分热情；不在客人不需要的时候主动聊天"
    },
    {
      "trait": "独立思考",
      "dos": "选择豆子的标准是'这个真的好喝吗'而不是'这个流行吗'；敢于不做流行的东西",
      "donts": "不追瑞幸的联名模式；不因为某个口味流行就跟进"
    }
  ],
  "reasoning": {
    "marketOpportunityReference": "引用 S3 opportunityDirections #1（咖啡教育型社区空间）和 #2（咖啡豆订阅+社区小课堂）。S3 发现：用户需要被引导而非被教育，'店员耐心解释'好评率是'咖啡专业'的2.3倍。→ S6 定位将'引导式体验'作为核心差异化。",
    "consumerInsightReference": "引用 S4 identityNeeds：用户想成为'会生活的人'而非'懂咖啡的人'。引用 S4 targetConsumer 行为特征：步行15分钟可达、愿意为'舒服的空间'付费但不超过预算15%。→ S6 emotional VP 围绕'日常仪式'展开。",
    "competitiveGapReference": "引用 S5 whitespaceOpportunity：'好喝+舒服+想再来'的日常空间空白。引用 S5 竞品A weakness（专业术语排斥普通人）和竞品B weakness（打卡一次后不再回来）。→ S6 定位选择'让人愿意每周来3次'作为核心指标。"
  }
}
```

#### S7 视觉策略 — 高质量

```json
{
  "coreConcept": "安静的日常感——不是'高级极简'（太冷），不是'日式杂货'（太流行），而是'有温度的空'。像一间被精心照料但不炫耀的房间：舒服的光线、趁手的器物、让你想坐下来的一切。",
  "keywords": [
    {"keyword": "留白", "rationale": "呼应品牌人格'克制'——不填满空间，给用户留出'自己的时间'"},
    {"keyword": "触感", "rationale": "呼应品牌人格'真诚'——用户触摸到的质感传递用心：温润的陶瓷杯>冰冷的玻璃杯"},
    {"keyword": "日常的精致", "rationale": "呼应品牌人格'日常'——不是精致到有距离感，而是日常中的一点点讲究"}
  ],
  "visualSystem": {
    "form": {"choice": "圆润无棱角——所有家具、器皿、标识系统避免尖角。杯型偏宽口而非高窄（更'拥抱'而非'疏离'）。空间布局以半包围卡座为主，提供安全感而非展示感。", "exclusions": "避免锐角几何造型、避免工业风金属框架", "perceptualTone": "被包裹的安全感，像坐在靠窗的沙发上"},
    "color": {"choice": "温感中性色系——墙面：暖灰（#E8E4DF）；地面：中橡木色；品牌色：烧土红（#BF6B4E，取自烘焙咖啡豆的颜色，温暖但不张扬，区别于连锁品牌的绿/蓝）。", "exclusions": "避免纯白（太冷/太医院）、避免高饱和暖色（太快餐）、避免冷调蓝绿（与咖啡的温暖感冲突）", "perceptualTone": "日落前半小时的自然光——暖但不热，让人放松"},
    "typography": {"choice": "正文：中文字体选圆体/楷体类（温润感），避免黑体（太硬）；英文选 serif 类（传递质感而非效率）。字号偏大、行距偏宽（让人慢下来阅读，而非快速扫描）。", "exclusions": "避免无衬线黑体（太效率感/互联网公司感）、避免极细字体（太'高级'但有距离感）", "perceptualTone": "翻开一本纸质书的节奏——从容，不急"},
    "imagery": {"choice": "自然光摄影为主，无过度后期。拍摄对象：咖啡制作过程中的细节（水流/蒸汽/油脂）> 成品摆拍；空间中的空座位>满座；单手捧杯的特写>人物正脸。色调保持暖调但不加滤镜。", "exclusions": "避免高饱和度食物摄影、避免人物正对镜头微笑（太广告感）、避免45度俯拍（太Instagram）", "perceptualTone": "日记里的配图——记录而非展示"},
    "material": {"choice": "天然材质原生肌理：陶瓷（哑光>亮光）、实木（保留木纹而非刷漆覆盖）、亚麻（窗帘/坐垫）、手工纸（菜单/名片）。材质随着使用产生变化——木桌的包浆、陶瓷杯的茶渍痕迹是加分不是瑕疵。", "exclusions": "避免不锈钢、镜面、亚克力、塑料（太无情/太廉价）；避免大理石（太冷/太'高级'）", "perceptualTone": "被使用过的痕迹——不是旧，是有故事"}
  },
  "restrictions": [
    {"exclusion": "不使用纯白墙面", "strategicRationale": "与品牌人格'日常'冲突——纯白空间让人下意识降低音量、不敢久坐"},
    {"exclusion": "不使用荧光灯/冷白光", "strategicRationale": "与品牌人格'克制/温暖'冲突——冷光让食物和人脸都失去温度"},
    {"exclusion": "不使用slogan墙/打卡装置", "strategicRationale": "与品牌人格'克制'和'日常'冲突——暗示用户'这里需要被拍照'而非'这里可以安静待着'"},
    {"exclusion": "视觉不主动标榜'手冲''精品''单品'等术语", "strategicRationale": "与S6定位一致——让用户因为好喝而喜欢，而非因为'这是精品咖啡'而消费"}
  ]
}
```

#### S8 内容规划 — 高质量

```json
{
  "coreDirection": "慢象的内容不是'教用户咖啡知识'，而是'陪用户建立咖啡日常'。品牌故事（林小雪从产品经理到咖啡店主）是最大的内容资产——它本身就包含了'日常中的选择'和'用心的克制'两个核心主题。",
  "contentValueSystem": {
    "awareness": {"strategy": "用创始人故事让目标人群产生'这个人懂我'的认同感——不是'我是咖啡专家'，而是'我也曾经每天只有30分钟属于自己'", "contentTypes": ["人物访谈类播客/视频", "公众号长文"]},
    "interest": {"strategy": "用'像什么'系列让咖啡变得可感知——每期一个咖啡口味搭配一个生活场景（'这款像下雨天在家裹着毯子'）", "contentTypes": ["小红书图文", "抖音15s氛围视频"]},
    "trust": {"strategy": "社区咖啡小课堂——不是'教你成为咖啡师'，而是'帮你在家也能喝到好咖啡'。从最简单的法压壶开始，降低行动门槛。", "contentTypes": ["线下活动+线上直播", "微信社群"]},
    "decision": {"strategy": "豆子护照——每消费一杯/购买一包豆子盖一个章，集满10个换一杯隐藏款，让复购有游戏感", "contentTypes": ["小程序", "实体护照卡片"]}
  },
  "themeDirections": [
    {
      "pillar": "一个人与一杯咖啡的故事",
      "corePurpose": "建立'咖啡=属于自己的时间'的品牌联想，与S6 emotional VP一致",
      "topicDirections": ["林小雪为什么要辞职开咖啡馆（创业日记系列）", "熟客专访：你第一次来慢象是什么时候（社区故事系列）", "'我需要一杯咖啡的时间'——用户投稿系列"]
    },
    {
      "pillar": "像什么——咖啡去术语化指南",
      "corePurpose": "降低咖啡消费门槛，实现S6 functional VP的'选咖啡像选甜点一样自然'",
      "topicDirections": ["单品豆'像什么'系列（每期一款豆子的生活化描述）", "'这个季节适合喝什么'——季节特调的生活场景搭配", "'今天不想喝咖啡也可以'——非咖啡饮品的同样用心"]
    },
    {
      "pillar": "社区里的好生活提案",
      "corePurpose": "建立社区品牌认知，传递品牌人格'日常的精致'",
      "topicDirections": ["拱墅区散步路线+终点慢象咖啡（社区探索系列）", "'在家做一杯不输咖啡馆的咖啡'（家庭咖啡指南）", "慢象书店角：店员最近在看的书"]
    }
  ],
  "channelStrategy": {
    "xiaohongshu": {"role": "种草+品牌表达主阵地", "reason": "S4目标消费者中78%日常使用小红书发现新店/新品牌。平台属性：图文+短视频，适合'氛围感'品牌叙事。", "contentFormat": "氛围感图文为主（色彩一致、留白多、不堆砌信息），每周3-4条"},
    "douyin": {"role": "短视频品牌故事+本地引流", "reason": "抖音本地生活杭州咖啡品类月搜索量超50万次。平台属性：15-30秒短视频有最佳本地推荐权重。", "contentFormat": "创始人日记系列短视频（30-60s），风格：安静+字幕为主+自然音效（磨豆声/水流声），每周1-2条"},
    "wechat": {"role": "熟客维护+深度内容", "reason": "S1/S4确认：熟客复购率是核心指标。微信生态（公众号+社群+小程序）最适合熟客深度运营。", "contentFormat": "公众号周更1篇长文（创业日记/社区故事/咖啡指南），社群每日1-2条轻互动，小程序支持豆子护照和咖啡豆订阅"}
  }
}
```

**预期评分：85-95 分。所有阶段 Advance。**

---

### 3.3 Case B：一般质量品牌案例 — "快享茶饮"

#### 设计思路

一个真实的普通新消费品牌。有基本战略框架，但洞察浅、差异化不足、证据缺失。

核心问题：
- S1 创始人动机过于泛泛（"想做健康茶饮"）
- S2 商业模式描述模糊（缺少具体数字）
- S3 市场判断依赖常识，无外部数据
- S4 消费者定义为人口标签
- S5 竞品分析停留在表面描述
- S6 定位可复用于任何茶饮品牌
- S7 视觉方向与品牌战略关联弱
- S8 内容策略为通用模板

#### S3 市场机会 — 一般质量（代表性样本）

```json
{
  "categoryStatus": {
    "definition": "新式茶饮市场——面向年轻人的健康茶饮品类",
    "currentState": "茶饮市场竞争激烈，但健康化是明显趋势。市场规模大，增长快。",
    "trends": [
      {"trend": "年轻人越来越关注健康，低糖低脂是主流需求", "source": "行业常识"},
      {"trend": "新式茶饮品牌都在推健康化产品线", "source": "市场观察"}
    ]
  },
  "experienceGaps": [
    {
      "gap": "现有茶饮品牌健康选项不够多",
      "currentAlternative": "消费者只能选择标注少糖的普通产品",
      "severity": "medium"
    }
  ],
  "opportunityDirections": [
    {
      "direction": "做年轻人喜欢的健康茶饮品牌",
      "rationale": "健康是趋势，年轻人是主力消费群体",
      "evidenceLevel": "inferred"
    }
  ]
}
```

#### S6 品牌核心战略 — 一般质量（代表性样本）

```json
{
  "positioning": "快享茶饮是为年轻都市白领打造的健康茶饮品牌，提供好喝不胖的日常茶饮选择。我们的产品使用天然食材，让消费者享受美味的同时保持健康。",
  "valuePropositions": [
    {"level": "functional", "proposition": "好喝不胖的茶饮", "soWhatDerivation": "年轻人想喝饮料又怕胖"},
    {"level": "emotional", "proposition": "喝得安心的快乐", "soWhatDerivation": "不用担心健康问题"},
    {"level": "social", "proposition": "健康生活方式的选择", "soWhatDerivation": "大家都在追求健康"}
  ],
  "brandStory": {
    "struggleMoment": "创始人自己很喜欢喝茶饮但担心健康问题",
    "brandAction": "决定做一个健康茶饮品牌",
    "brandRelationship": "成为年轻人健康生活的一部分"
  },
  "brandPersonality": [
    {"trait": "健康", "dos": "使用天然食材", "donts": "不使用人工添加剂"},
    {"trait": "活力", "dos": "品牌形象年轻有活力", "donts": "不老气"},
    {"trait": "亲和", "dos": "价格亲民", "donts": "不高端冷艳"}
  ],
  "reasoning": {
    "marketOpportunityReference": "茶饮市场大，健康化是趋势",
    "consumerInsightReference": "年轻人关注健康",
    "competitiveGapReference": "市场上健康茶饮选择不够多"
  }
}
```

**预期评分：60-75 分。S3/S5/S6 可能触发 Reoptimize。Evidence 维度应显著低于 Case A。**

---

### 3.4 Case C：低质量品牌案例 — "YoungLife"

#### 设计思路

典型创业者早期模糊想法——"想做一个年轻人的生活方式品牌"。无具体用户、无市场判断、无竞争分析、无数据支撑。

#### 代表性样本（S3 全阶段）

```json
{
  "categoryStatus": {
    "definition": "年轻人的生活方式品牌，覆盖吃喝玩乐",
    "currentState": "年轻人消费力强，生活方式品牌有机会",
    "trends": [
      {"trend": "年轻人喜欢新鲜事物", "source": "常识"},
      {"trend": "社交媒体改变了年轻人的消费方式", "source": "常识"}
    ]
  },
  "experienceGaps": [
    {
      "gap": "市面上缺少年轻人真正喜欢的生活方式品牌",
      "currentAlternative": "传统品牌",
      "severity": "high"
    }
  ],
  "opportunityDirections": [
    {
      "direction": "做一个跨品类的生活方式品牌",
      "rationale": "年轻人喜欢一站式体验",
      "evidenceLevel": "hypothesis"
    }
  ]
}
```

#### S6 品牌核心战略 — 低质量

```json
{
  "positioning": "YoungLife 是为年轻人打造的生活方式品牌",
  "valuePropositions": [
    {"level": "functional", "proposition": "一站式生活方式产品", "soWhatDerivation": "线上信息很少"},
    {"level": "emotional", "proposition": "年轻人的归属感", "soWhatDerivation": "线上信息很少"},
    {"level": "social", "proposition": "体现年轻人身份", "soWhatDerivation": "线上信息很少"}
  ],
  "brandStory": {
    "struggleMoment": "年轻人生活很无聊",
    "brandAction": "打造好玩的生活方式品牌",
    "brandRelationship": "和年轻人一起成长"
  },
  "brandPersonality": [
    {"trait": "年轻", "dos": "做年轻人喜欢的", "donts": "不老气"},
    {"trait": "潮流", "dos": "紧跟潮流趋势", "donts": "不做传统"}
  ],
  "reasoning": {
    "marketOpportunityReference": "未追溯到前序数据——可能为AI独立推断",
    "consumerInsightReference": "未追溯到前序数据——可能为AI独立推断",
    "competitiveGapReference": "未追溯到前序数据——可能为AI独立推断"
  }
}
```

**预期评分：<40 分。大部分阶段 Block。Evidence 维度应接近 1 分。**

---

### 3.5 测试样本汇总

| 案例 | 品类 | 质量 | 预期总分 | 预期 Gate 分布 | 关键验证点 |
|:---|:---|:---|:---|:---|:---|
| Case A 慢象咖啡 | 精品咖啡 | 高 | 85-95 | 8/8 Advance | Evidence 三维高分，S3 Evidence=40% 应 ≥4 |
| Case B 快享茶饮 | 新式茶饮 | 中 | 60-75 | 3-5/8 Reoptimize | Evidence 明显低于 A，S5 Diff=40% 应 ≤3 |
| Case C YoungLife | 生活方式 | 低 | <40 | 6-8/8 Block | Evidence≈1，所有维度低分 |

#### 执行方式

```bash
# 将每个案例的 S1-S8 JSON 写入文件
# 对每个案例的每个阶段，调用 runAIQualityAudit 10 次
npx tsx scripts/audit-v3-validation.ts --case caseA --runs 10
npx tsx scripts/audit-v3-validation.ts --case caseB --runs 10
npx tsx scripts/audit-v3-validation.ts --case caseC --runs 10
```

---

## 4. 第二部分：阶段专项测试

### 4.1 S3 市场机会 — Evidence 审查市场依据

**验证目标**：S3 Evidence=40%，验证系统能否区分"有数据"和"无数据"。

#### 测试设计

| 版本 | 内容 | 预期 Evidence | 理由 |
|:---|:---|:---|:---|
| **版本 A（无数据）** | "年轻人越来越关注健康，低糖低脂是趋势" | ≤2 分 | Presence 无来源标注；Reliability 不可验证；Connection 无推理链 |
| **版本 B（有数据）** | "根据《2025中国食品消费趋势报告》，低糖/无糖食品年增速23%，其中25-35岁人群贡献58%的增量。2025年Q1天猫'低糖茶饮'搜索量同比增长67%。线下渠道：便利店低糖饮品SKU从2024年Q4的8个增至2025年Q2的22个。" | ≥4 分 | Presence 所有判断有来源（报告名称/年份/平台/数据点）；Reliability 来源可溯源、时效好、有渠道覆盖；Connection 多源数据→趋势判断→机会识别 |

#### 测试方式

构造两份 S3 JSON（其他维度相同，仅 evidence 相关字段不同），分别调用 `runAIQualityAudit(3, output)` 各 5 次，检验 Evidence 维度分差。

```bash
npx tsx scripts/audit-v3-stage-test.ts --stage 3 --test evidence-presence
```

### 4.2 S4 消费者洞察 — 验证洞察深度区分

**验证目标**：验证系统能否区分"人口标签"和"深度行为洞察"。

| 版本 | 内容 | 预期 Specificity | 预期 Differentiation |
|:---|:---|:---|:---|
| **版本 A（浅）** | "25-35岁女性喜欢香薰，她们注重生活品质" | ≤2 | ≤2 |
| **版本 B（深）** | "25-35岁独居女性，在高压工作后通过睡前香薰建立情绪恢复仪式——不是'喜欢香味'，是'需要用可控的感官体验来标记从工作角色到自我角色的切换'" | ≥4 | ≥4 |

```bash
npx tsx scripts/audit-v3-stage-test.ts --stage 4 --test insight-depth
```

### 4.3 S5 竞争判断 — 验证 Evidence 从"外部数据"转向"战略推导链"

**验证目标**：S5 Evidence 审查竞争依据（竞品评价原文、功能对比），验证与 S3 Evidence（外部市场数据）的差异化。

| 版本 | 内容 | 预期 Evidence | 理由 |
|:---|:---|:---|:---|
| **版本 A（无依据）** | "A品牌做得好，B品牌价格低，C品牌设计漂亮" | ≤2 | 无评价原文/对比数据/市场观察 |
| **版本 B（有依据）** | 每个竞品有 ≥1 条可溯源 user review 原文，有具体功能对比表，有 gap→机会推理链 | ≥4 | Presence/Reliability/Connection 完整 |

```bash
npx tsx scripts/audit-v3-stage-test.ts --stage 5 --test evidence-derivation
```

### 4.4 S6 品牌战略 — 验证 Evidence 审查战略推导链

**验证目标**：验证 S6 Evidence 不再审查"外部数据"，而是审查 S3→S4→S5→S6 推导链完整性。

| 版本 | 内容 | 预期 Evidence | 理由 |
|:---|:---|:---|:---|
| **版本 A（无推导）** | 漂亮定位，reasoning 模糊引用（"来自S3""基于S4"），无字段名/内容摘要 | ≤2 | Presence 无具体引用；Connection 无推导链 |
| **版本 B（完整推导）** | reasoning 三个引用标注具体字段名+内容摘要+推导逻辑；VP与S4/S5一致；品牌故事可追溯到S1 | ≥4 | 完整 S4→S5→S6 推导闭环 |

```bash
npx tsx scripts/audit-v3-stage-test.ts --stage 6 --test derivation-chain
```

### 4.5 S7 视觉策略 — 验证战略一致性

**验证目标**：验证 S7 Evidence 审查"从战略到视觉"的推导链。

| 版本 | 内容 | 预期 Evidence |
|:---|:---|:---|
| **版本 A（无关）** | 视觉高级（极简黑白/现代感强），但与 S6 品牌人格"温暖/日常/亲近"完全相反 | ≤2：战略一致性断裂 |
| **版本 B（一致）** | coreConcept+五种语言均显式引用 S6 品牌人格特质，visual decisions 可追溯到品牌战略 | ≥4：完整推导链 |

```bash
npx tsx scripts/audit-v3-stage-test.ts --stage 7 --test strategic-alignment
```

### 4.6 阶段专项测试汇总

| 测试 | Stage | 验证维度 | 版本数 | 每版本调用 | 总计 |
|:---|:---:|:---|:---:|:---:|:---:|
| Evidence Presence | S3 | Evidence | 2 | 5 | 10 |
| Insight Depth | S4 | Specificity/Diff | 2 | 5 | 10 |
| Evidence Derivation | S5 | Evidence | 2 | 5 | 10 |
| Derivation Chain | S6 | Evidence | 2 | 5 | 10 |
| Strategic Alignment | S7 | Evidence | 2 | 5 | 10 |
| **合计** | | | | | **50 次 LLM 调用** |

---

## 5. 第三部分：模型稳定性测试

### 5.1 测试设计

```
模型: deepseek-chat (temperature=0.2)
样本: Case A (高质量) + Case B (一般质量) + Case C (低质量)
每样本每阶段: 10 次独立调用 runAIQualityAudit()
总调用次数: 3 cases × 8 stages × 10 runs = 240 次
```

### 5.2 记录指标

```typescript
interface StabilityReport {
  caseName: string;
  stage: number;
  scores: number[];           // 10 次总分
  dimensionScores: Record<string, number[]>;  // 每维度 10 次评分
  stats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;           // 标准差
    range: number;            // max - min
  };
  gateDistribution: Record<string, number>;  // advance/reoptimize/block 次数
  gateConsistency: number;    // 10 次中 gate 一致的比例 (0-1)
}
```

### 5.3 验收标准

| 指标 | 高质量案例 (A) | 一般质量 (B) | 低质量 (C) |
|:---|:---:|:---:|:---:|
| 总分标准差 | <5 | <5 | <5 |
| 总分极差 (max-min) | <15 | <15 | <15 |
| Gate 一致性 | ≥90% | ≥80% | ≥90% |
| 低质量案例出现 ≥70 分 | 0/10 | — | 0/10 |
| 高质量案例出现 <70 分 | 0/10 | — | — |

### 5.4 执行

```bash
npx tsx scripts/audit-v3-stability.ts --model deepseek-chat --runs 10 --cases A,B,C
```

---

## 6. 第四部分：多模型对比测试

### 6.1 测试设计

```
模型 A: deepseek-chat（通用模型，当前默认）
模型 B: deepseek-v4-flash（快速模型，不同架构）
模型 C: deepseek-reasoner（推理模型，可选）

使用相同: System Prompt + 输入案例 + 评分规则
样本: Case A + Case B + Case C 的所有阶段 JSON
每模型每阶段: 5 次调用（减少总调用量）
总调用次数: 3 models × 3 cases × 8 stages × 5 runs = 360 次
```

### 6.2 比较指标

| 指标 | 计算方式 | 验收标准 |
|:---|:---|:---|
| 总分差异 | abs(mean_A - mean_B) 每阶段 | <8 分（跨模型一致性） |
| 四维评分差异 | 每维度的 mean_A vs mean_B | <0.5 分（维度级别一致性） |
| 排名一致率 | 同一案例的 HIGH/MED/LOW 判断一致 | >80% |
| Gate 一致率 | 同一阶段相同 gate decision | >80% |
| 失败案例 | 某模型全高分 / 全低分 / 无法理解推导 | 0 个 |

### 6.3 关键观察项

1. **某模型所有案例都高分**：可能 `AUDIT_MODEL` 配置下 system prompt 未被正确理解
2. **某模型过度要求数据**：可能对 Evidence 三维模型理解偏向"必须有外部链接"
3. **某模型无法理解战略推导**：S6 Evidence 如果看"外部数据"而非"推导链"，说明模型未理解阶段差异化

### 6.4 执行

```bash
npx tsx scripts/audit-v3-cross-model.ts --models deepseek-chat,deepseek-v4-flash --runs 5 --cases A,B,C
```

---

## 7. 第五部分：人工专家一致性测试

### 7.1 测试设计

```
样本：Case A、B、C 的 S3/S5/S6 输出（这 3 个阶段最需要专业判断）
评审人员：≥2 位品牌战略人员
评审方式：独立盲评——评审人员不知道 AI 评分结果
```

### 7.2 人工评审表

每位评审人员对每个样本的每个阶段给出：

| 维度 | 评分(1-5) | 理由 |
|:---|:---|:---|
| Specificity 具体度 | _ | 是否具体到场景/人群/行为？举例说明不足/优秀处 |
| Differentiation 差异化 | _ | 是否形成独特判断？与品类通用表述的区别在哪 |
| Actionability 可执行性 | _ | 是否能指导下一步行动？哪些具体可执行/不可执行 |
| Evidence 证据支撑 | _ | 依据是否合理？Presence/Reliability/Connection 各自如何 |

### 7.3 比较指标

| 指标 | 计算方式 | 验收标准 |
|:---|:---|:---|
| Pearson 相关系数 | AI 总分 vs 人工总分 | r > 0.7（强相关） |
| 高低质量排序一致率 | A>B>C 的排序在 AI 和人工中一致 | >85% |
| 关键问题识别一致率 | AI 识别的 top-3 issues 至少 2 个与人工一致 | >66% |
| 单维度 MAE | abs(AI_dim_score - human_dim_score) 均值 | <1.0 分 |

### 7.4 执行

1. 准备评审材料包（Case A/B/C 的 S3/S5/S6 JSON + 评分表）
2. 2 位评审人员独立完成评分
3. 计算 AI vs 人工一致性指标
4. 汇总差异，分析 AI 的系统性偏差

---

## 8. 第六部分：回归测试

### 8.1 测试设计

对比 V3.0（修改前）和 V3.1（修改后）在相同输入上的评分差异。

```
方法：
1. 提取 V3.0 的 git commit 版本（如有）或模拟 V3.0 配置
2. 使用 Case A/B/C 的相同 JSON 输入
3. 分别运行 V3.0 和 V3.1 的 runAIQualityAudit
4. 比较差异
```

### 8.2 预期变化

| 验证点 | V3.0 预期 | V3.1 预期 | 验收标准 |
|:---|:---|:---|:---|
| S6 不再全部高分 | S6 接近满分（已知 bias） | S6 根据内容质量差异化 | S6 分数方差显著增大 |
| Evidence 判断更符合阶段 | 统一标准"有没有数据" | S3看重外部数据，S6看重推导链 | Case B 的 S3 Evidence < Case A 的 S3 Evidence 差值 ≥2 |
| 高质量案例保持高分 | Case A 约 80-90 | Case A 约 85-95 | Case A 总分不降 |
| 低质量案例分数下降 | Case C 约 50-60 | Case C < 40 | Case C 总分显著下降 |
| S3 Evidence 区分度提升 | 中等 | 高（40% 权重+三维模型） | Evidence 维度方差增大 |

### 8.3 执行

```bash
# 方式 1：如果有 git 历史
git stash && git checkout <v3.0-commit> -- src/lib/audit/ai-quality.ts
npx tsx scripts/audit-v3-regression.ts --cases A,B,C --runs 5 --label v3.0
git checkout HEAD -- src/lib/audit/ai-quality.ts
npx tsx scripts/audit-v3-regression.ts --cases A,B,C --runs 5 --label v3.1

# 方式 2：手动构造 V3.0 配置（权重均分 + 通用 Evidence）
# 脚本内部创建两套配置，分别运行比较
```

---

## 9. 第七部分：最终验收标准

### 9.1 综合验收矩阵

| 验收维度 | 指标 | 阈值 | 权重 |
|:---|:---|:---|:---:|
| **区分能力** | Case A 平均分 > 85 | 必须通过 | 30% |
| | Case B 平均分 60-75 | 必须通过 | |
| | Case C 平均分 < 40 | 必须通过 | |
| **稳定性** | 同模型 10 次标准差 < 5 | 必须通过 | 20% |
| | Gate 一致性 ≥ 90% (高/低) | 必须通过 | |
| **阶段准确性** | S3 Evidence 区分有/无数据（差值 ≥2） | 必须通过 | 20% |
| | S6 Evidence 审查推导链而非外部数据 | 必须通过 | |
| | S7 Evidence 审查战略一致性 | 必须通过 | |
| **模型泛化** | 排名一致率 > 80% | 必须通过 | 15% |
| | Gate 一致率 > 80% | 理想 | |
| **专业一致性** | Pearson r > 0.7 | 理想 | 15% |
| | 排序一致率 > 85% | 理想 | |

### 9.2 通过/失败判定

| 结果 | 条件 |
|:---|:---|
| ✅ **通过** | 所有"必须通过"指标达成 |
| ⚠️ **有条件通过** | 所有"必须通过"达成，但 ≥1 个"理想"未达成（需记录为已知限制） |
| ❌ **不通过** | 任一"必须通过"未达成（需修改配置后重新验证） |

### 9.3 最终目标

验证 AI Brand OS Audit System 是否从：

> **"会评分"**（产出数字）

升级为：

> **"像品牌咨询顾问一样判断战略质量"**（产出有区分度的、符合阶段特点的、可指导优化的专业判断）

---

## 10. 执行计划与时间线

### 10.1 执行顺序

```
Phase 1: 准备工作（1 天）
├── 完成 Case A/B/C 全部 8 阶段 JSON 构造
├── 编写测试脚本：
│   ├── scripts/audit-v3-validation.ts（核心验证）
│   ├── scripts/audit-v3-stage-test.ts（阶段专项）
│   ├── scripts/audit-v3-stability.ts（稳定性）
│   ├── scripts/audit-v3-cross-model.ts（多模型）
│   └── scripts/audit-v3-regression.ts（回归）
└── 准备人工评审材料

Phase 2: 执行测试（2 天）
├── Day 1: Part 1（样本测试 240 次）+ Part 2（阶段专项 50 次）
├── Day 2: Part 3（稳定性 240 次）+ Part 4（多模型 360 次）+ Part 6（回归）
└── 并行：Part 5（人工评审，独立时间线）

Phase 3: 分析与报告（1 天）
├── 汇总所有测试数据
├── 计算所有指标
├── 识别系统性偏差和问题
└── 输出测试报告
```

### 10.2 总调用量估算

| 测试部分 | LLM 调用次数 | 模型 |
|:---|:---:|:---|
| Part 1: 样本测试 | 240 (3×8×10) | deepseek-chat |
| Part 2: 阶段专项 | 50 (5×2×5) | deepseek-chat |
| Part 3: 稳定性 | 已包含在 Part 1 | — |
| Part 4: 多模型 | 360 (3×3×8×5) | chat + v4-flash + reasoner |
| Part 6: 回归 | 240 (3×8×5×2) | deepseek-chat × 2 配置 |
| **合计** | **~890 次** | |

### 10.3 交付物

1. **测试脚本**（5 个可执行 `scripts/audit-v3-*.ts`）
2. **测试数据**（Case A/B/C 完整 JSON）
3. **测试报告**（`docs/audit-v3-test-report.md`）
   - 汇总表
   - 问题发现
   - 验收结论

---

## 附录 A：现有测试脚本复用

| 现有脚本 | 关系 | 可复用部分 |
|:---|:---|:---|
| `scripts/test-ai-quality.ts` | Part 0（前置验证） | 配置完整性 + 门禁合并逻辑。每次修改后必须先跑。 |
| `scripts/compare-audit.ts` | Part 4 基础 | 跨模型对比逻辑可复用，需扩展为 3 案例 × 3 模型 |
| `scripts/noise-baseline.ts` | Part 3 基础 | 噪音基线逻辑可复用，需扩展为 10 runs × 3 cases |
| `scripts/run-batch.ts` | 非直接相关 | 全链路测试，非 audit 专项。不在此测试计划范围内。 |

## 附录 B：关键风险

| 风险 | 影响 | 缓解措施 |
|:---|:---|:---|
| LLM API 限流 | 890 次调用可能触发 rate limit | 分批次执行，每批间 sleep 5s |
| 人工评审样本过少 | Pearson r 可信度不足（n=18） | 增加评审阶段至 S2/S3/S4/S5/S6（n=30） |
| V3.0 配置不可恢复 | 回归测试无法进行 | 手动构造 V3.0 配置（权重均分 + 通用 Evidence） |
| deepseek-reasoner 不支持 temperature | Part 4 中 reasoner 结果与 chat 不可比 | reasoner 作为可选的第三组，单独分析 |
