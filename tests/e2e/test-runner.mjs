/**
 * AI Brand OS — E2E Test Runner
 *
 * 用法: node tests/e2e/test-runner.mjs [case1|case2|both]
 *
 * 测试 2 个案例:
 *   Case 1 (花间集): 高质量 — 资深行业人士，清晰愿景，有调研基础
 *   Case 2 (闪亮生活): 低质量 — 初次创业，方向模糊，预期不切实际
 */

const BASE = "http://localhost:3000";
const LOG_FILE = null; // Set to a path to write logs

// ============================================================================
// Test Case Definitions
// ============================================================================

const CASE_1 = {
  id: "case1",
  name: "花间集",
  tagline: "中国植物香氛",
  category: "香氛 / 香水",
  quality: "high",
  founder: {
    name: "林语晴",
    background:
      "8年香氛行业经验，曾在欧洲奢侈香水品牌担任高级调香师，ISIPCA（法国香水学院）毕业。回国后发现中国植物原料（桂花、白茶、竹子、腊梅等）在高端香水领域几乎空白，想做一个以中国植物为主题的东方香氛品牌。",
    budget: "个人积蓄约30万元，有朋友介绍的代工厂资源",
    constraint:
      "调香技术扎实但对品牌营销一窍不通，不确定应该走高端奢侈路线还是轻奢大众路线",
  },
  userMessages: {
    // S1: 创始人愿景
    1: [
      // 回答"为什么想做这个品牌"
      "我在欧洲做了八年调香，发现国际大牌用的东方元素非常表面——桂花就是桂花、茶就是茶，完全没有理解中国人对这些植物的情感。比如桂花对我们来说是秋天的记忆，是小时候家门口那棵桂花树，不是一个简单的花香调。我想把这种文化记忆做进香水里。",
      // 回答"观察到的具体现象"
      "最直接的观察是：问身边朋友用什么香水，90%说是国外大牌，但他们也说这些味道跟中国文化没什么关系。另外我去看了天猫香氛品类，2023年国货香水同比增长超过60%，但大部分是仿香——仿大牌的名字、仿包装、仿香调。真正做原创东方香调的很少。",
      // 回答"已经做了什么"
      "我回国这一年做了几件事：一是跑了云南、福建、浙江三个原料产地，确定了桂花、白茶、竹叶、腊梅四个核心原料的供应链；二是在小红书上做了一个月的植物香氛内容测试，发了12条笔记，最高一条有3.2万阅读，评论区超过200条都在问「哪里能买到」；三是找代工厂打了三款样品，朋友试用反馈不错。",
      // 回答"品牌想解决什么问题"
      "两个问题：一是中国人没有属于自己的高端香氛语言。现在一提高端香水就是法国、意大利，但中国有三千年的香文化——唐宋的香道、明清的香铺，这些文化资产没有人用现代香水的语言重新表达。二是市面上的国产香水要么走廉价路线要么走仿大牌路线，中间缺一个既有文化根基又有国际品质的选项。",
      // 回答"约束和顾虑"
      "最大的约束是两个：第一是钱——30万对于香氛品牌真的很少，开模、瓶器、包装、第一批货，可能就去掉大半了。第二是我完全不懂品牌和营销，调香我可以闭着眼睛做，但怎么做品牌定位、怎么讲故事、怎么获客，我真的不知道。",
    ],
    // S2: 商业背景
    2: [
      "我之前在那家欧洲品牌的时候了解过：一瓶零售价800元的香水，香精成本大概在5%-8%，瓶器和包装占15%-20%，渠道和营销占40%-50%，品牌方毛利大约20%-30%。我现在的优势是香精成本可以控——因为我自己就是调香师，不需要外包。",
      "香氛行业的门槛其实不在调香，而在品牌和渠道。调香师freelancer很多，但能把一个香氛品牌做起来的人很少。国际大牌一年营销预算几个亿，国产新品牌要在天猫做起来，没有几百万流量费根本没人看到。这对我来说是最难的。",
      "我的理解是这个行业分三层：顶层是国际奢侈品牌，一瓶1000-3000元，靠品牌溢价；中间是设计师/小众品牌，300-800元，靠独特的香调和故事；底层是大众品牌，50-200元，靠走量。我的产品应该定在中间层，但这个区间的竞争其实也很激烈——Byredo、Diptyque、Le Labo 这些都在这个区间。",
      "我目前没有团队，就我一个人。调香、找原料、联系代工厂、做内容都是自己。现在的资金大概能撑6-8个月的产品开发和第一批小批量生产，但没有多余的钱做市场推广。我想先做一批样品，通过小红书和线下市集测试市场反应。",
    ],
    // S3: 市场机会
    3: [
      "我看到的数据是：中国香氛市场2023年规模大约180亿人民币，年增长率在15%-20%。但这里面90%以上还是国际品牌占着。值得注意的是国货香氛品牌的增速超过60%，远高于市场平均。说明消费者对国货香氛的接受度在快速提高。",
      "我觉得最大的机会在'文化自信'这个趋势上。现在年轻人越来越愿意为'中国故事'买单——汉服、国潮、新中式茶饮都是例子。但在香氛领域，还没有一个品牌能把'东方香调'做出高端感和文化深度。这是一个窗口期，但不会太长，可能就2-3年。",
      "我观察到一个细分方向：现在市场上的香氛主要是'西方审美'的——玫瑰、薰衣草、柑橘这些香调。但对于中国消费者来说，桂花、栀子花、白兰花、腊梅这些才是'有记忆的味道'。'嗅觉记忆'是一个还没有被充分开发的品类。",
      "关于目标人群，我初步判断是25-35岁的一二线城市女性，有一定消费力（月可支配收入8000+），对生活品质有要求，喜欢尝试新品牌，关注设计感和文化内涵。但我也在想能不能扩展到送礼场景——香水在中国已经是一个常见的礼品品类了。",
    ],
    // S4: 消费者洞察
    4: [
      "做调研的时候我发现一个很有意思的分层：买香水的动机大概分三种——第一种是'悦己'，自己闻着开心，不在乎别人知不知道这个牌子；第二种是'社交货币'，需要被认出来是高端品牌，是一种无声的身份标签；第三种是'记忆连接'，某个味道让她们想起某个人或某个时刻。我的品牌应该主打第一种和第三种。",
      "我在小红书上的12条内容测试给了我很多洞察。互动最高的三条分别是：'桂花的味道，是外婆家的秋天'、'为什么中国没有自己的高级香水'、'调香师教你分辨香精和植物精油的区别'。这三个话题分别对应了：情感记忆（identity need）、文化自信（identity need）、专业信任（functional need）。",
      "上次线下和朋友聊的时候发现一个有趣的现象：她们买香水之前会在小红书搜'XX香水好闻吗'，但她们最终的购买决策往往不是基于'好闻'，而是基于'这个味道代表了什么'。比如有人说'我买Jo Malone是因为它很英式、很优雅'，这是一种身份认同。中国的香水品牌目前基本没有提供这种'身份叙事'。",
      "我定义的核心用户画像是'文化自信的都市女性'——她可能穿江南布衣或者Ms MIN，喝茶也喝咖啡，看展也看抖音，对'中国风'的理解不是龙凤牡丹，而是一种更现代的、克制的东方美学。她买香水不是为了吸引异性，而是为了让自己开心。这个人群我觉得在一二线城市大概有500-800万人。",
    ],
    // S5: 竞争判断
    5: [
      "我研究过目前市场上几个相关的品牌。观夏（To Summer）是做东方植物香氛的，2020年成立，现在已经是这个细分品类的头部了。它们做得很好的是'东方故事'——每个香味背后有一个场景，比如'昆仑煮雪'、'颐和金桂'。但它们的香调还是比较偏'禅意'和'清冷'，缺少一种更温暖、更日常的东方感。",
      "另一个参考是闻献（Documents），它们的定位更先锋、更艺术化，走高端路线，一瓶1500-2500元。包装很极简，但味道很大胆，用了很多中国本土原料比如艾草、花椒。我觉得它们的风格有点太'冷'了，一般消费者可能接受不了。",
      "国际品牌方面，Jo Malone、Diptyque、Byredo 在中国市场都很强。Jo Malone 的特点是'叠香'概念和英式优雅，价格在600-1200元区间。但它们用的'东方元素'其实很表面——比如'桂花限定版'就是把桂花香调加进去，没有任何文化深度。这是我可以差异化的重要切入点。",
      "我的差异化空间在于：不做'外国人眼中的东方'，而是做'中国人记忆中的味道'。具体来说就是每一款香水的创作原点不是香调本身，而是一个具体的中国生活场景——比如'外婆院子的桂花树'、'江南雨后的竹林'、'冬日书房的白茶香'。这个切入角度目前市场上没有人做。",
    ],
    // S6: 这些信息已经通过S1-S5覆盖，S6品牌战略阶段AI可以基于前序推导
    6: [
      "基于前五个阶段的讨论，我认为花间集的核心定位应该是'以中国嗅觉记忆为灵感的东方植物香氛品牌'。我们的差异化不在于'用了中国原料'（观夏也用了），而在于'还原中国人真实的嗅觉记忆场景'。每一款香水不是一瓶液体，而是一个你可以穿在身上的中国记忆。",
      "关于品牌调性，我更倾向于'温润的东方感'而不是'性冷淡的东方感'。花间集的品牌人格应该是'一个有文化底蕴但不高冷的女性朋友'——她知道桂花什么时候开，记得外婆晒桂花的日子，愿意把这些温暖的故事分享给你。这个调性跟观夏的'禅意清冷'和闻献的'先锋冷感'形成明确区别。",
      "我考虑的核心用户群是25-35岁、一二线城市、月收入1.5万以上的文化消费型女性。她们的特征是：对'中国风'的理解不是传统的而是现代的，愿意为'意义'和'审美'支付溢价，通过消费选择来表达文化身份。她们现在的香氛选择可能是Jo Malone或Diptyque，但这些品牌无法满足她们的文化归属需求。",
      "产品线初步规划：先出4款核心香水（桂花记忆、雨后竹林、书房白茶、腊梅初雪），每款50ml定价在480-580元之间。这个价格区间高于大众国产香水（100-200元）但低于国际设计师品牌（800-1500元），正好卡在'有品质但不奢侈'的位置。同时可以出同香型的护手霜、香薰蜡烛作为入门产品线。",
    ],
    // S7: 视觉策略
    7: [
      "视觉上，我想避免两种常见的'东方感'：一是太传统的——龙凤、牡丹、大红大金；二是太'性冷淡'的——黑白灰、极简到没有温度。花间集的视觉语言应该是'有温度的克制'——主色调考虑暖米色、哑光白、和根据每款香型变化的点缀色（比如桂花记忆用暖金色，雨后竹林用青绿色）。",
      "瓶器设计上我有一个想法：不用传统的圆形或方形瓶，而是参考中国陶瓷中的'玉壶春瓶'的曲线，但做一个现代简化版。瓶盖用竹木材质，瓶身用磨砂玻璃。整体的感觉是'放在梳妆台上像一件小艺术品，而不是一个化妆品'。当然这个设计成本可能会比较高，需要平衡。",
      "包装方面，我希望做到'开箱是一个体验'而不仅仅是拆包装。每瓶香水附带一张手绘风格的卡片，讲述这款香水的灵感来源——比如'桂花记忆'的卡片会讲一个关于外婆和桂花树的故事。外盒用再生纸，呼应'植物'和'自然'的品牌理念。",
      "字体和Logo方向：中文用仿宋或手写楷体的现代变体，体现'文化感'但不要老气。英文名考虑用一个简洁的无衬线体做辅助。Logo不要图形，纯文字排版——类似Mǎzú zú那种克制的方式。整个视觉体系要让消费者一眼感受到'这是东方的，但这是现代的东方'。",
    ],
    // S8: 内容策略
    8: [
      "内容核心要传递的是'嗅觉记忆'这个独特价值。我考虑的内容策略是围绕'中国人的嗅觉记忆地图'展开——不是讲香水参数，而是讲故事。比如可以做一个系列'中国城市的气味记忆'：成都的火锅和茶馆、杭州的桂花和龙井、潮汕的功夫茶和海风。这个内容方向在小红书上应该会有比较强的共鸣。",
      "渠道策略：初期以小红书为核心内容阵地（这个平台最匹配目标用户），同时布局微信公众号做深度内容，抖音做短视频（调香过程、原料产地探访）。线下考虑参加设计类市集和买手店合作——初期没有能力进商场专柜，通过精品买手店和生活方式集合店触达用户。",
      "内容节奏：产品上市前2个月开始做内容预热，每周3-4篇小红书笔记+1-2条抖音短视频。内容主题分三个方向：调香知识科普（建立专业信任）、中国植物故事（建立文化连接）、品牌幕后（建立人格化认知）。不直接卖货，先建立'花间集=东方嗅觉记忆'这个心智。",
      "关于增长策略，第一年不追求快速起量，目标是建立1000个核心种子用户。通过邀请制试用、线下闻香会、用户共创等方式深度运营这1000个用户，让他们成为品牌的传播节点。这个策略对于香水品类来说是比较合适的——香水的购买决策很大程度上受社交推荐影响。",
    ],
  },
};

const CASE_2 = {
  id: "case2",
  name: "闪亮生活",
  tagline: "年轻人的生活方式品牌",
  category: "生活方式 / 快消品",
  quality: "low",
  founder: {
    name: "小陈",
    background:
      "应届毕业生，社会学专业。不想找工作，想创业做品牌。没有行业经验，没有明确产品方向，预算约5万元（父母给的）。在抖音上看了一些品牌相关的短视频，觉得'做品牌很酷'。",
    budget: "父母给的5万元，没有任何行业资源和人脉",
    constraint: "没有行业经验，没有产品概念，对品牌的理解停留在'好看的设计+社交媒体营销'",
  },
  userMessages: {
    1: [
      "我想做一个品牌，服务当代年轻人。现在的年轻人压力很大，996、内卷、租房、单身，我觉得需要一个品牌能给他们带来快乐和放松。具体什么产品我还没想好，可能是生活用品吧，杯子、香薰、帆布包之类的。",
      "我自己就是年轻人啊，我觉得我了解年轻人的需求。大家现在都喜欢有设计感的东西，愿意为好看的东西付费。你看喜茶、泡泡玛特这些，都是卖给年轻人的，做得很大。我也想做这样的品牌，不一定要很大，但要有自己的调性。",
      "我还没做什么具体准备，就是在想这个事情。看了很多品牌故事，觉得那些创始人一开始也不知道怎么做，做着做着就成了。我觉得最重要的是先开始，边做边学。我现在在写一个品牌计划书，但是写了一半写不下去了，因为很多问题我还没想清楚。",
      "我最大的顾虑是钱不够——5万块可能连第一批货都生产不了。但我听朋友说现在可以做预售、众筹这些模式，先有用户再找工厂生产。或者先做一个品牌概念出来，找投资人。我觉得如果品牌故事好，产品方向对，投资人应该会感兴趣的。",
    ],
    2: [
      "我对这个行业不太了解，但我知道消费品市场很大。我觉得现在是个好时机，因为新消费品牌很多都是从零开始的。具体商业模式我还没想好，大概就是做一个品牌，卖产品，通过小红书和抖音推广。我朋友说现在做品牌最重要的是'人设'和'内容'。",
      "运营模式的话……可能先找一个代工厂做一批样品，然后在社交媒体上发内容，如果反响好就找工厂批量生产。我不太清楚成本结构，但我看过一些案例，一个杯子成本可能就几块钱，品牌包装好了可以卖到几十块。利润空间应该挺大的。",
      "时间规划方面，我希望半年内能把品牌做起来，一年内做到月销10万。我看小红书上有些品牌半年就火了，只要内容做得好、产品有差异化，应该不需要太长时间。如果半年没起色，我可能就得去找工作了。",
    ],
    3: [
      "我不是很清楚市场规模，但我知道生活方式消费品是一个趋势。现在的年轻人都追求'生活美学'，愿意为好看的设计付费。我关注的一些抖音博主经常推荐各种精致的生活用品，评论区很多人问链接，说明需求是存在的。",
      "趋势的话，我觉得'国潮'、'新中式'这些方向都很火，但我不想做太传统的中国风。我想做一个更现代、更活泼的品牌，可能用一些明亮的颜色、有趣的设计。现在年轻人都喜欢'治愈系'的东西——盲盒、手办、jellycat这些。我觉得可以做'治愈系生活用品'。",
      "关于竞争对手，我觉得我的品牌没有直接的竞争对手，因为我还没想好具体做什么产品。但我不担心竞争，因为市场足够大，只要找到一个细分点就能做起来。我不需要做得很大，能活着就行。像名创优品一开始也就是卖小商品的。",
    ],
    4: [
      "目标用户就是跟我一样的年轻人，20-30岁，在一二线城市工作。他们压力大、收入一般但愿意为喜欢的东西花钱。我理解他们因为我自己就是这样的——看到好看的东西会冲动消费，虽然买了可能用不上。",
      "我觉得他们需要一个能'治愈'他们的品牌。现在的年轻人都很焦虑——工作焦虑、年龄焦虑、社交焦虑。如果一个品牌能让他们感受到温暖和放松，他们应该会喜欢。就像jellycat的玩偶，买了不是为了用，就是为了'被治愈'的感觉。",
      "我观察到身边的朋友买一个东西很多时候不是因为需要，而是因为'这个好好看'或者'这个牌子很有意思'。所以我觉得对于年轻人来说，品牌的情感价值比功能价值更重要。你提供一个好看的杯子，大家买的不只是杯子，买的是'拥有这个杯子的感觉'。",
    ],
    5: [
      "竞争对手的话……说实话我没有做过系统的竞品分析。我知道名创优品、NOME、OCE 这些做生活方式的品牌，但它们偏性价比路线。还有一些独立设计师品牌比如-超级植物、mǎzú zú这些，做得很精致但价格也比较高。我想找一个中间的定位。",
      "我的差异化可能是'更年轻、更有趣'。现有的生活方式品牌要么太性冷淡（像无印良品），要么太廉价（像名创优品），中间缺少一个'有设计感但不贵、有趣但不幼稚'的品牌。但这个说起来有点虚，我需要想得更具体一些。",
      "我不太担心竞品，因为我觉得市场很大，消费者不会只买一个品牌的东西。而且我的品牌理念是'让生活闪亮'——不是卖产品，是卖一种生活态度。只要这个理念能打动人，产品本身不是最重要的。",
    ],
    6: [
      "经过前面讨论，我大概想清楚了：闪亮生活是一个'为焦虑的都市年轻人提供治愈感的生活方式品牌'。核心产品是日常小物件——杯子、香薰蜡烛、帆布包、桌面小摆件——每个产品都有一个'治愈瞬间'的概念，比如'周五下班后的第一口啤酒'、'周日早晨的阳光'。",
      "品牌调性：明亮、温暖、有点可爱但不幼稚。主色调考虑柠檬黄+奶油白，给人阳光的感觉。我想把产品做成'可以放在办公桌上的小确幸'——在996的间隙看到它会笑一下。这个定位跟名创优品的'廉价实用'和无印良品的'性冷淡极简'都不一样。",
      "第一波产品我计划做3-5个SKU，从最基础的开始——一个马克杯、一个香薰蜡烛、一个帆布包。预算有限先不做太多。定价在39-99元之间，比名创优品贵但比独立设计师品牌便宜，让年轻人可以'闭眼下单'。",
    ],
    7: [
      "视觉风格我想要'明亮治愈风'——主色调是柠檬黄和奶油白，辅色可以有一些暖橘和淡粉。整体的感觉像一个'阳光明媚的周末早晨'。包装上考虑用简单的插画风格，每个产品配一个可爱的插画场景。Logo想用圆润的手写字体，不要太正经。",
      "具体的包装方案我还没有，但我知道包装很重要——尤其在社交媒体上，好看的包装会让人主动拍照分享。我考虑包装盒上印一些温暖的文案，比如'今天辛苦了'、'你值得被温柔对待'之类的，拆开包装就是一个治愈的体验。",
      "字体方面，中文用圆体或手写体，英文用圆润的无衬线体。整个视觉系统的关键词是：温暖、明亮、柔和、有小惊喜。不要太复杂，简简单单的就好。我希望消费者看到产品图片的第一反应是'好可爱，想买'。",
    ],
    8: [
      "内容策略我觉得就是'治愈系内容'——在小红书和抖音上发产品图+治愈文案，让大家看了觉得温暖。具体的内容方向包括开箱视频、产品使用场景（比如在办公室用我们的杯子喝咖啡）、用户投稿的治愈瞬间。可能做一些互动话题比如'今天让你感到快乐的小事是什么'。",
      "渠道就是小红书和抖音，主要做短视频和图文。没有预算投广告，靠内容自然引流。如果能做到第一批1000个粉丝就可以开始做产品预售了。线下的话考虑参加一些创意市集，摆个摊位卖卖看。",
      "对于增长，我比较佛系。先做内容，积累粉丝，然后推产品。如果一款产品火了就加大推广，不火就换方向。我没有太大的资金压力（因为本来就没什么钱），可以慢慢试。目标是第一年活下来，能有100个忠实用户就好。",
    ],
  },
};

// ============================================================================
// HTTP Helpers
// ============================================================================

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

/**
 * Send a message to a stage via SSE and collect the full AI response.
 */
async function sendMessage(projectId, stageNumber, message, searchEnabled = false) {
  const url = `${BASE}/api/project/${projectId}/stage/${stageNumber}/message`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, searchEnabled }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST message failed (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullResponse = "";
  let searchResult = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.searchResult) {
            searchResult = data.searchResult;
          }
          if (data.content) {
            fullResponse += data.content;
          }
        } catch {}
      }
    }
  }

  return { fullResponse, searchResult };
}

/**
 * Trigger convergence for a stage.
 */
async function convergeStage(projectId, stageNumber) {
  const res = await fetch(
    `${BASE}/api/project/${projectId}/stage/${stageNumber}/converge`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Converge failed (${res.status}): ${err}`);
  }
  return res.json();
}

/**
 * Advance a stage (triggers audit).
 */
async function advanceStage(projectId, stageNumber) {
  const res = await fetch(
    `${BASE}/api/project/${projectId}/stage/${stageNumber}/advance`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Advance failed (${res.status}): ${err}`);
  }
  return res.json();
}

/**
 * Get stage data.
 */
async function getStage(projectId, stageNumber) {
  const { data } = await api(`/api/project/${projectId}/stage/${stageNumber}`);
  return data;
}

/**
 * Get project data.
 */
async function getProject(projectId) {
  const { data } = await api(`/api/project/${projectId}`);
  return data;
}

/**
 * Get decision memory.
 */
async function getDecisions(projectId) {
  const { data } = await api(`/api/project/${projectId}/stage/1/decisions`);
  return data;
}

/**
 * Trigger smart optimize.
 */
async function smartOptimize(projectId, stageNumber) {
  const res = await fetch(
    `${BASE}/api/project/${projectId}/stage/${stageNumber}/optimize`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Optimize failed (${res.status}): ${err}`);
  }
  return res.json();
}

/**
 * Trigger backtrack on a stage.
 */
async function backtrackStage(projectId, stageNumber, reason) {
  const res = await fetch(
    `${BASE}/api/project/${projectId}/stage/${stageNumber}/backtrack`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backtrack failed (${res.status}): ${err}`);
  }
  return res.json();
}

/**
 * Force advance (skip audit).
 */
async function forceAdvance(projectId, stageNumber) {
  const res = await fetch(
    `${BASE}/api/project/${projectId}/stage/${stageNumber}/force-advance`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Force advance failed (${res.status}): ${err}`);
  }
  return res.json();
}

// ============================================================================
// Test Engine
// ============================================================================

class TestEngine {
  constructor(testCase) {
    this.tc = testCase;
    this.projectId = null;
    this.stageData = {}; // stageNumber -> data
    this.results = {
      caseId: testCase.id,
      caseName: testCase.name,
      quality: testCase.quality,
      projectId: null,
      stages: {},
      auditResults: {},
      issues: [],
      timeline: [],
    };
  }

  log(msg) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${msg}`);
    this.results.timeline.push({ time: ts, message: msg });
  }

  addIssue(stage, severity, description) {
    this.results.issues.push({ stage, severity, description });
  }

  // ── Step 1: Create Project ──────────────────────────────
  async createProject() {
    this.log(`📦 创建项目: ${this.tc.name} (${this.tc.tagline})`);
    const { status, data } = await api("/api/project", {
      method: "POST",
      body: JSON.stringify({
        name: this.tc.name,
        category: this.tc.category,
      }),
    });

    if (status !== 201 && status !== 200) {
      throw new Error(`创建项目失败: ${JSON.stringify(data)}`);
    }

    this.projectId = data.id;
    this.results.projectId = data.id;
    this.log(`✅ 项目创建成功: ${this.projectId}`);

    // Wait for S1 auto-init (AI opening message)
    await sleep(5000);
    const s1 = await getStage(this.projectId, 1);
    this.stageData[1] = s1;
    const msgCount = s1?.messages?.length || 0;
    this.log(`   S1 初始化完成，${msgCount} 条消息（含 AI 开场）`);

    return data;
  }

  // ── Step 2: Run a stage ─────────────────────────────
  async runStage(stageNumber) {
    const stageName = STAGE_NAMES[stageNumber] || `Stage ${stageNumber}`;
    this.log(`\n━━━ S${stageNumber} ${stageName} ━━━`);

    const messages = this.tc.userMessages[stageNumber] || [];
    const results = {
      stageNumber,
      stageName,
      rounds: 0,
      aiOpening: null,
      convergeResult: null,
      auditResult: null,
      gateDecision: null,
      status: "unknown",
    };

    // Get initial stage data
    let stage = await getStage(this.projectId, stageNumber);
    this.stageData[stageNumber] = stage;
    const initialMsgCount = stage?.messages?.length || 0;

    // Check AI opening
    if (stage?.messages?.length > 0) {
      const firstMsg = stage.messages[0];
      results.aiOpening = (firstMsg?.content || "").slice(0, 200);
      this.log(`   📝 AI 开场: ${results.aiOpening.slice(0, 80)}...`);
    }

    // Send user messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      this.log(`   💬 用户消息 ${i + 1}/${messages.length}: "${msg.slice(0, 40)}..."`);

      try {
        const { fullResponse, searchResult } = await sendMessage(
          this.projectId,
          stageNumber,
          msg,
          [3, 5, 8].includes(stageNumber) // Enable search for S3, S5, S8
        );
        const preview = fullResponse.slice(0, 120).replace(/\n/g, " ");
        this.log(`   🤖 AI 回复 (${fullResponse.length} 字): "${preview}..."`);
        if (searchResult) {
          this.log(`   🔍 搜索结果: query="${searchResult.query}"`);
        }

        // Small delay between messages
        await sleep(2000);
      } catch (err) {
        this.log(`   ❌ 消息失败: ${err.message}`);
        this.addIssue(stageNumber, "P1", `S${stageNumber} 消息${i + 1}发送失败: ${err.message}`);
      }
    }

    results.rounds = messages.length;

    // Refresh stage data
    stage = await getStage(this.projectId, stageNumber);
    this.stageData[stageNumber] = stage;

    // ── Trigger Convergence ─────────────────────────────
    this.log(`   🔄 触发收敛...`);
    try {
      results.convergeResult = await convergeStage(this.projectId, stageNumber);
      this.log(`   ✅ 收敛完成: success=${results.convergeResult.success}, retries=${results.convergeResult.retriesUsed}`);

      // Show output summary
      const output = results.convergeResult.output;
      if (output) {
        const keys = Object.keys(output);
        const nonEmpty = keys.filter((k) => {
          const v = output[k];
          if (typeof v === "string") return v.length > 0;
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === "object" && v !== null) return Object.keys(v).length > 0;
          return false;
        });
        this.log(`   📊 输出字段: ${nonEmpty.length}/${keys.length} 非空 (${keys.length} total)`);
      }
    } catch (err) {
      this.log(`   ❌ 收敛失败: ${err.message}`);
      this.addIssue(stageNumber, "P0", `S${stageNumber} 收敛失败: ${err.message}`);
      results.status = "converge_failed";
      this.results.stages[stageNumber] = results;
      return results;
    }

    await sleep(2000);

    // ── Trigger Advance (Audit) ─────────────────────────
    this.log(`   🔍 触发审计推进...`);
    try {
      const advanceResult = await advanceStage(this.projectId, stageNumber);
      results.auditResult = advanceResult.auditReport;
      results.gateDecision = advanceResult.gateDecision;

      if (results.auditResult) {
        const ar = results.auditResult;
        this.log(`   📋 审计结果: score=${ar.score||ar.totalScore}, gate=${results.gateDecision}`);
        if (ar.dimensions) {
          const dims = ar.dimensions;
          this.log(`      维度: S=${dims.specificity||dims.Specificity} D=${dims.differentiation||dims.Differentiation} E=${dims.evidence||dims.Evidence} A=${dims.actionability||dims.Actionability}`);
        }
      } else {
        this.log(`   📋 审计结果: gate=${results.gateDecision} (无详细报告)`);
      }

      results.status = results.gateDecision === "advance" ? "advanced" :
        results.gateDecision === "block" ? "blocked" : "reoptimize";
    } catch (err) {
      this.log(`   ❌ 审计推进失败: ${err.message}`);
      this.addIssue(stageNumber, "P0", `S${stageNumber} 审计推进失败: ${err.message}`);
      results.status = "audit_failed";
    }

    // Refresh
    stage = await getStage(this.projectId, stageNumber);
    this.stageData[stageNumber] = stage;
    results.finalStatus = stage?.status;

    this.results.stages[stageNumber] = results;
    this.results.auditResults[stageNumber] = {
      gate: results.gateDecision,
      score: results.auditResult?.score || results.auditResult?.totalScore || null,
      dimensions: results.auditResult?.dimensions || null,
      issues: results.auditResult?.issues || [],
    };

    return results;
  }

  // ── Run all stages ─────────────────────────────────
  async runAllStages() {
    for (let i = 1; i <= 8; i++) {
      // Check if stage can be entered
      const stage = await getStage(this.projectId, i);
      this.stageData[i] = stage;

      await this.runStage(i);

      // Check for reoptimize — if gate says reoptimize, try smart optimize
      const result = this.results.stages[i];
      if (result && result.gateDecision === "reoptimize") {
        this.log(`   ⚠️ 阶段需要优化，触发智能优化...`);
        await this.testSmartOptimize(i);
      }
    }
  }

  // ── Smart Optimize ─────────────────────────────────
  async testSmartOptimize(stageNumber) {
    this.log(`\n🔧 S${stageNumber} 智能优化测试 ────`);

    // Get pre-optimize state
    const before = await getStage(this.projectId, stageNumber);
    const beforeOutput = before?.structuredOutput;
    const beforeAudit = before?.auditResult;

    try {
      const optResult = await smartOptimize(this.projectId, stageNumber);
      this.log(`   ✅ 优化完成: success=${optResult.success}`);

      if (optResult.naturalLanguage) {
        this.log(`   📝 优化后自然语言: "${optResult.naturalLanguage.slice(0, 100)}..."`);
      }

      // Get post-optimize state
      await sleep(2000);
      const after = await getStage(this.projectId, stageNumber);
      const afterOutput = after?.structuredOutput;
      const afterAudit = after?.auditResult;
      const afterMessages = after?.messages || [];

      // Check that optimization message was added to chat
      const lastMsg = afterMessages[afterMessages.length - 1];
      const hasOptimizeMsg = lastMsg?.content?.includes(optResult.naturalLanguage?.slice(0, 20) || "");
      this.log(`   📋 消息追加到对话: ${hasOptimizeMsg ? 'YES' : 'NO'} (消息总数: ${afterMessages.length})`);

      // Check audit refresh
      this.log(`   📊 优化前审计: score=${beforeAudit?.score||beforeAudit?.totalScore}`);
      this.log(`   📊 优化后审计: score=${afterAudit?.score||afterAudit?.totalScore}`);

      this.results.optimizeTest = {
        stage: stageNumber,
        success: optResult.success,
        hasNaturalLanguage: !!optResult.naturalLanguage,
        messageAppended: hasOptimizeMsg,
        auditRefreshed: afterAudit?.score !== beforeAudit?.score ||
                        JSON.stringify(afterAudit) !== JSON.stringify(beforeAudit),
        beforeScore: beforeAudit?.score || beforeAudit?.totalScore,
        afterScore: afterAudit?.score || afterAudit?.totalScore,
      };

      return optResult;
    } catch (err) {
      this.log(`   ❌ 智能优化失败: ${err.message}`);
      this.addIssue(stageNumber, "P1", `智能优化失败: ${err.message}`);
      return null;
    }
  }

  // ── Backtrack ──────────────────────────────────────
  async testBacktrack(stageNumber, reason) {
    this.log(`\n⏪ S${stageNumber} 回溯测试 ────`);
    this.log(`   原因: ${reason}`);

    try {
      const btResult = await backtrackStage(this.projectId, stageNumber, reason);
      this.log(`   ✅ 回溯结果: affectedStages=${JSON.stringify(btResult.affectedStages || btResult.impact || [])}`);

      // Check downstream stages are invalidated
      const downstream = [4,5,6,7,8].filter(n => n > stageNumber);
      for (const dn of downstream) {
        const ds = await getStage(this.projectId, dn);
        this.log(`   S${dn} 状态: ${ds?.status}`);
      }

      this.results.backtrackTest = {
        stage: stageNumber,
        reason,
        success: true,
        result: btResult,
      };

      return btResult;
    } catch (err) {
      this.log(`   ❌ 回溯失败: ${err.message}`);
      this.addIssue(stageNumber, "P1", `回溯修改失败: ${err.message}`);
      return null;
    }
  }

  // ── Check Decision Memory ──────────────────────────
  async checkDecisionMemory() {
    this.log(`\n🧠 Decision Memory 检查 ────`);
    try {
      const decisions = await getDecisions(this.projectId);
      if (Array.isArray(decisions)) {
        this.log(`   条目数: ${decisions.length}`);
        const types = {};
        decisions.forEach((d) => {
          const t = d.entryType || d.type || "unknown";
          types[t] = (types[t] || 0) + 1;
        });
        this.log(`   类型分布: ${JSON.stringify(types)}`);
        this.results.decisionMemory = { count: decisions.length, types };
      } else {
        this.log(`   数据: ${JSON.stringify(decisions).slice(0, 200)}`);
        this.results.decisionMemory = decisions;
      }
    } catch (err) {
      this.log(`   ❌ 获取失败: ${err.message}`);
      this.addIssue("DM", "P2", `Decision Memory 获取失败: ${err.message}`);
    }
  }

  // ── Final Report Check ─────────────────────────────
  async checkReport() {
    this.log(`\n📄 最终报告检查 ────`);
    try {
      const { data } = await api(`/api/project/${this.projectId}/report`);
      this.log(`   报告数据: ${JSON.stringify(data).slice(0, 300)}`);
      this.results.report = data;
    } catch (err) {
      this.log(`   ⚠️ 报告检查: ${err.message}`);
    }
  }
}

// ============================================================================
// Stage names
// ============================================================================
const STAGE_NAMES = {
  1: "创始人诉求",
  2: "商业背景分析",
  3: "市场机会分析",
  4: "消费者洞察",
  5: "竞争判断",
  6: "品牌核心战略",
  7: "视觉策略",
  8: "内容策略",
};

// ============================================================================
// Utils
// ============================================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main
// ============================================================================

async function runCase(testCase) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 开始测试: ${testCase.name} (${testCase.quality === 'high' ? '高质量' : '低质量'})`);
  console.log(`   品类: ${testCase.category}`);
  console.log(`   创始人: ${testCase.founder.name}`);
  console.log(`${"=".repeat(60)}`);

  const engine = new TestEngine(testCase);

  try {
    // Step 1: Create project
    await engine.createProject();

    // Step 2: Run all 8 stages
    await engine.runAllStages();

    // Step 3: Check decision memory
    await engine.checkDecisionMemory();

    // Generate summary
    console.log(`\n📊 ${testCase.name} 测试完成`);
    printCaseSummary(engine.results);

    return engine.results;
  } catch (err) {
    console.error(`❌ ${testCase.name} 测试异常:`, err.message);
    engine.results.fatalError = err.message;
    return engine.results;
  }
}

function printCaseSummary(results) {
  console.log(`\n${"─".repeat(40)}`);
  console.log(`📊 ${results.caseName} 摘要`);
  console.log(`${"─".repeat(40)}`);

  for (let i = 1; i <= 8; i++) {
    const s = results.stages[i];
    if (s) {
      const icon = s.gateDecision === "advance" ? "✅" :
        s.gateDecision === "reoptimize" ? "⚠️" :
        s.gateDecision === "block" ? "🚫" : "❓";
      const audit = results.auditResults[i] || {};
      console.log(`  ${icon} S${i}: rounds=${s.rounds} gate=${s.gateDecision||'?'} score=${audit.score||'?'} status=${s.finalStatus||'?'}`);
    } else {
      console.log(`  ⬜ S${i}: 未执行`);
    }
  }

  if (results.optimizeTest) {
    console.log(`\n🔧 智能优化: stage=S${results.optimizeTest.stage} score ${results.optimizeTest.beforeScore}→${results.optimizeTest.afterScore}`);
  }
  if (results.backtrackTest) {
    console.log(`⏪ 回溯: stage=S${results.backtrackTest.stage} "${results.backtrackTest.reason}"`);
  }
  if (results.decisionMemory) {
    console.log(`🧠 Decision Memory: ${results.decisionMemory.count || '?'} entries`);
  }
  console.log(`🐛 Issues: ${results.issues.length}`);
}

// ============================================================================
// Entry Point
// ============================================================================

const arg = process.argv[2] || "both";

(async () => {
  console.log("AI Brand OS — E2E Test Runner");
  console.log(`Target: ${BASE}`);
  console.log(`Mode: ${arg}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const allResults = [];

  if (arg === "case1" || arg === "both") {
    allResults.push(await runCase(CASE_1));
  }

  if (arg === "case2" || arg === "both") {
    allResults.push(await runCase(CASE_2));
  }

  // Write full results
  const fs = await import("fs");
  const outPath = `tests/e2e/results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), "utf-8");
  console.log(`\n📁 完整结果: ${outPath}`);
})();
