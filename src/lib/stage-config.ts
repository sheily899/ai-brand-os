/**
 * 阶段元数据配置
 *
 * 为前端工作台提供阶段名称、目标描述、退出条件等展示信息。
 * 内容来源于各阶段 consultation prompt 的 Goal / Exit Conditions。
 */

export interface StageMeta {
  number: number;
  name: string;
  /** 阶段目标——显示在 StageGoal 横幅中 */
  goal: string;
  /** 阶段职责简述——显示在侧边栏 tooltip */
  description: string;
  /** 报告章节映射 */
  reportChapter?: string;
}

export const STAGE_META: Record<number, StageMeta> = {
  1: {
    number: 1,
    name: "用户访谈",
    goal: "收集创始人的原始诉求、创业动机、市场观察和已知约束，形成对品牌起点的完整理解",
    description: "了解创始人的初始想法、动机和已知信息",
    reportChapter: undefined,
  },
  2: {
    number: 2,
    name: "商业背景分析",
    goal: "理解品牌所处的行业环境、商业模型和当前阶段，明确创始人面临的核心战略挑战",
    description: "分析行业环境、创业动机和战略挑战",
    reportChapter: "01 品牌背景与战略方向",
  },
  3: {
    number: 3,
    name: "市场机会分析",
    goal: "明确品类规模与趋势、供需缺口、细分机会方向，形成有数据支撑的市场机会判断",
    description: "分析市场规模、趋势、缺口和机会方向",
    reportChapter: "02 市场机会",
  },
  4: {
    number: 4,
    name: "消费者洞察",
    goal: "定义目标消费者画像与使用场景，理解功能层需求和身份认同层需求，识别现有解决方案的满足与不足",
    description: "分析目标消费者、需求和现有方案局限",
    reportChapter: "03 消费者洞察",
  },
  5: {
    number: 5,
    name: "竞争判断",
    goal: "识别竞争类型与主要竞品，分析竞品定位与核心打法，判断心智空位和可突破空间",
    description: "分析竞品格局、竞争方式和心智空位",
    reportChapter: "04 竞争判断",
  },
  6: {
    number: 6,
    name: "品牌核心战略",
    goal: "综合前序所有判断，完成品牌定位、价值主张、品牌故事和品牌人格的最终选择——这是整个工作流的战略枢纽",
    description: "确定品牌定位、价值主张和品牌人格",
    reportChapter: "05 品牌核心战略",
  },
  7: {
    number: 7,
    name: "视觉策略",
    goal: "将品牌战略转译为可感知的视觉方向：核心概念、视觉关键词、五类视觉语言和视觉禁区",
    description: "定义视觉方向、设计原则和风格建议",
    reportChapter: "06 视觉策略",
  },
  8: {
    number: 8,
    name: "内容策略",
    goal: "基于品牌战略建立长期内容表达体系：内容核心方向、四阶段用户旅程价值、内容主题方向和渠道表达策略",
    description: "制定内容策略、内容方向和资产体系",
    reportChapter: "07 内容策略",
  },
};

/** 阶段名称快速查询 */
export function getStageName(stage: number): string {
  return STAGE_META[stage]?.name ?? `阶段 ${stage}`;
}

/** 阶段目标快速查询 */
export function getStageGoal(stage: number): string {
  return STAGE_META[stage]?.goal ?? "";
}
