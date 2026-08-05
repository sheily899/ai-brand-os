---
name: token-e2e-test-2026-08-04
description: S1-S8 完整 Token 消耗测试报告（慢象咖啡），72次调用 686K tokens，含成本分析和优化建议
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e1cbe48-91f8-40c6-a5e6-84435abb7388
---

# Token 消耗端到端测试报告

**日期**: 2026-08-04 (补: 部分跨天至 2026-08-05)
**测试案例**: 慢象咖啡 (画像 1)
**项目 ID**: 6J5t2oosfzo342qP
**脚本**: `scripts/test-token-tracking.ts`

## 全局汇总

| 指标 | 值 |
|------|-----|
| 总调用次数 | 72 |
| 总 Input Tokens | 664,046 |
| 总 Output Tokens | 21,777 |
| 总 Tokens | 685,823 |
| 估算成本 (DeepSeek) | **$0.2032** |
| 测试耗时 | 18.1 分钟 |

## 各阶段 Token 消耗

| 阶段 | 轮次 | 调用 | Tokens | 均Token/调用 | 搜索 | AI Score | Gate |
|------|------|------|--------|-------------|------|----------|------|
| S1 用户访谈 | 8 | 9 | 32,914 | 3,657 | — | 73 | ✅ Advance |
| S2 商业背景 | 6 | 8 | 113,898 | 14,237 | 🔍 | 75 | ✅ Advance |
| S3 市场机会 | 6 | 8 | 124,690 | 15,586 | 🔍 | 73 | ✅ Advance |
| S4 消费者洞察 | 12* | 16 | 98,771 | 6,173 | — | 69 | ⚠️ 强制完成 |
| S5 竞争判断 | 6 | 8 | 82,698 | 10,337 | 🔍 | 77 | ✅ Advance |
| S6 品牌核心 | 7 | 9 | 62,056 | 6,895 | — | 80 | ✅ Advance |
| S7 视觉策略 | 5 | 7 | 43,795 | 6,256 | 🔍 | 91 | ✅ Advance |
| S8 内容规划 | 5 | 7 | 127,001 | 18,143 | 🔍 | 76 | ✅ Advance |

*S4 包含 2 次 reoptimize 尝试（各 3 轮额外咨询）

## 核心发现

### 1. 搜索阶段 token 消耗是非搜索阶段的 2-4 倍
- 搜索阶段 (S2/S3/S5/S8): 平均 **14,576** tokens/调用
- 非搜索阶段 (S1/S4/S6/S7): 平均 **5,745** tokens/调用
- 差距主要来自搜索上下文注入（~14K tokens）到 system prompt

### 2. System Prompt 占比严重偏高
- 搜索阶段 consultation: system prompt 占 input 的 **85-89%**
- 非搜索阶段 consultation: system prompt 占 input 的 **65-81%**
- 对话内容仅占 5-20%，大部分 Token 消耗在固定内容的重复发送

### 3. 成本构成
- Consultation: **77.5%** ($0.157)
- Audit: **11.6%** ($0.024)
- Opening: **11.0%** ($0.022)

### 4. S4 Quality Gate 问题
- S4 (消费者洞察) 2 次 reoptimize 后 AI 评分仍为 69
- 使用强制完成绕过，需人工评审 S4 输出质量

### 5. 识别到的冗余
- 8 个 `large_system_prompt` flag (所有阶段)
- 1 个 `duplicate_injection` flag (S4, 12 轮咨询)
- 搜索协议 + Decision Memory 每轮完整重复注入

## 优化建议

1. **Prompt Caching**: 将搜索协议和 Decision Memory 移到可缓存前缀（预估节省 20-25% 搜索阶段 Token）
2. **搜索上下文截断**: 搜索结果按相关性截断为 TOP-3，而非全部注入
3. **S4 质量审查**: 消费者洞察阶段需要人工评审，AI Audit 持续低分

**Why:** 首次获得完整的 S1-S8 Token 消耗基准数据，量化了搜索阶段和非搜索阶段的成本差距。

**How to apply:** 
- 成本分析: `npx tsx scripts/cost-analysis.ts 6J5t2oosfzo342qP`
- 完整 JSON: `token-report-6J5t2oosfzo342qP.json`
- 后续可基于此基线对比优化效果
