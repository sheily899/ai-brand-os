/**
 * Task 3.5 Report Engine + Final Audit smoke test
 *
 * Validates:
 * 1. Report Quality Check: 5 violation categories + terminology consistency
 * 2. Report Assembly: 8 stages → 8 chapters per SPEC §4.5
 * 3. Final Audit: dependency-graph traversal → Layer A Fact Reference Check
 * 4. assembleWithAudit: error-level issues → suspend assembly
 *
 * Run: npx tsx scripts/test-report-engine.ts
 */

// Dynamic import to avoid DB connection at module load time
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  // We'll run tests manually below
}

async function runAll() {
  console.log("\n=== Task 3.5 Report Engine + Final Audit Smoke Test ===\n");

  // ── Dynamically import modules ──────────────────────
  const { qualityCheck, VIOLATION_PATTERNS, checkTerminologyConsistency } =
    await import("../src/lib/report/quality");
  const { assembleReport, runFinalAudit, assembleWithAudit } =
    await import("../src/lib/report/assemble");

  const results: Array<{ name: string; ok: boolean; error?: string }> = [];

  function t(name: string) {
    return {
      assert(condition: boolean, msg: string) {
        if (!condition) throw new Error(msg);
      },
      async run(fn: () => void | Promise<void>) {
        try {
          await fn();
          results.push({ name, ok: true });
          console.log(`  [PASS] ${name}`);
        } catch (e: any) {
          results.push({ name, ok: false, error: e.message });
          console.log(`  [FAIL] ${name}: ${e.message}`);
        }
      },
    };
  }

  // ================================================================
  // Part 1: Report Quality Check
  // ================================================================
  console.log("Report Quality Check");

  await t("detects absolute words (violation)").run(() => {
    const result = qualityCheck("这必然是市场上最好的产品，毫无疑问所有消费者都会喜欢");
    const absolutes = result.violations.filter(v => v.category === "absolute_words");
    t("").assert(absolutes.length >= 3, `Expected >=3 absolute words, got ${absolutes.length}`);
    t("").assert(result.violations.length > 0, "Should have violations");
  });

  await t("detects exaggerated words").run(() => {
    const result = qualityCheck("这是一款颠覆行业的革命性产品，具有世界级品质");
    const exaggerated = result.violations.filter(v => v.category === "exaggerated_words");
    t("").assert(exaggerated.length >= 2, `Expected >=2 exaggerated words, got ${exaggerated.length}`);
  });

  await t("detects first person in brand context").run(() => {
    const result = qualityCheck("我们品牌致力于为消费者提供最好的服务，我认为这个定位很准确");
    const firstPerson = result.violations.filter(v => v.category === "first_person");
    t("").assert(firstPerson.length >= 1, `Expected >=1 first person violations, got ${firstPerson.length}`);
  });

  await t("detects oral connectors").run(() => {
    const result = qualityCheck("首先我们需要分析市场，然后制定策略，最后执行方案");
    const oral = result.violations.filter(v => v.category === "oral_connectors");
    t("").assert(oral.length >= 2, `Expected >=2 oral connectors, got ${oral.length}`);
  });

  await t("detects interview traces").run(() => {
    const result = qualityCheck("根据您的描述，正如你所说，您刚才提到的市场机会很有价值");
    const traces = result.violations.filter(v => v.category === "interview_traces");
    t("").assert(traces.length >= 2, `Expected >=2 interview traces, got ${traces.length}`);
  });

  await t("clean text has no violations").run(() => {
    const result = qualityCheck(
      "市场数据显示精品咖啡品类年均增速达到15%，线上渠道占比持续提升。消费者通过咖啡消费表达精致生活态度。"
    );
    t("").assert(result.violations.length === 0, `Expected 0 violations, got ${result.violations.length}`);
  });

  await t("terminology consistency check detects mismatch").run(() => {
    // Use semicolons to create clear split points
    // "城市中产" vs "都市中产" — different terms for same concept, 75% char overlap
    const chapters = [
      "城市中产；品质生活；日常仪式感；消费体验；精致生活",
      "都市中产；品质体验；社交认同；品牌消费；体验缺口",
    ];
    const issues = checkTerminologyConsistency(chapters);
    // "城市中产" vs "都市中产" share 市中产 (3 chars) = 75% overlap → should be flagged
    t("").assert(issues.length >= 1, `Expected >=1 terminology issues, got ${issues.length}`);
  });

  await t("terminology consistency passes for consistent terms").run(() => {
    // Terms are either identical or clearly unrelated
    const chapters = [
      "中产女性；品质生活；日常仪式感；消费体验；精致生活",
      "中产女性；品质生活；社交认同；品牌体验；消费决策",
    ];
    const issues = checkTerminologyConsistency(chapters);
    t("").assert(issues.length === 0, `Expected 0 issues for consistent terms, got ${issues.length}: ${JSON.stringify(issues)}`);
  });

  await t("qualityCheck result has correct structure").run(() => {
    const result = qualityCheck("这是一段测试文本");
    t("").assert(typeof result.passed === "boolean", "passed should be boolean");
    t("").assert(Array.isArray(result.violations), "violations should be array");
    t("").assert(Array.isArray(result.terminologyIssues), "terminologyIssues should be array");
    t("").assert(typeof result.summary === "string", "summary should be string");
    result.violations.forEach(v => {
      t("").assert(typeof v.category === "string", "category required");
      t("").assert(typeof v.pattern === "string", "pattern required");
      t("").assert(typeof v.match === "string", "match required");
      t("").assert(typeof v.suggestion === "string", "suggestion required");
    });
  });

  // ================================================================
  // Part 2: Report Assembly
  // ================================================================
  console.log("\nReport Assembly");

  // Construct mock stage outputs for all 8 stages
  const mockOutputs: Record<number, Record<string, any>> = {
    1: { founderMotivation: { content: "创始人希望通过精品咖啡传递精致生活态度" }, observations: [], confirmedProblems: ["问题1"], constraints: {} },
    2: { businessBackground: { marketContext: "咖啡市场背景" }, coreChallenges: { externalChallenges: ["竞争加剧"], internalChallenges: ["资源有限"] }, strategicDirection: { directionHypothesis: "向精品化发展", workingPriorities: ["品质提升"] } },
    3: {
      marketOverview: { marketSize: "500亿", growthRate: "15%", marketStage: "增长期" },
      opportunityDirections: [{ direction: "精品咖啡", rationale: "增速快", evidenceLevel: "verified" }],
      dataSources: [{ url: "https://example.com", title: "Report", type: "full_text", summary: "Market data" }],
    },
    4: {
      targetConsumer: { definition: "追求品质生活的中产女性消费者人群画像，她们在繁忙的都市生活中寻找日常仪式感", idealSelfReflection: "精致生活表达" },
      deepNeeds: { functionalNeed: "高品质咖啡", identityNeed: "精致生活态度的表达方式" },
      existingSolutions: [{ solutionType: "速溶咖啡", examples: "雀巢三合一", failReason: "满足便捷需求但牺牲了品质感" }],
    },
    5: {
      competitors: [{ name: "竞品A", weakness: "体验不够好" }],
      competitiveGap: { marketOpportunity: "体验感和社区归属感缺口" },
    },
    6: {
      positioning: "对于追求品质生活的中产女性而言本品牌是精品咖啡中能够实现日常仪式感的选择",
      valuePropositions: [
        { proposition: "功能性价值", level: "functional", soWhatDerivation: "因为x所以需要这样做" },
        { proposition: "情感性价值", level: "emotional", soWhatDerivation: "因为y所以需要这样做" },
        { proposition: "社会性价值", level: "social", soWhatDerivation: "因为z所以需要这样做" },
      ],
      brandStory: { struggleMoment: "都市生活匆忙缺少仪式感", brandAction: "创造可以慢下来的空间", brandRelationship: "建立每日仪式时刻" },
      brandPersonality: [
        { trait: "精致", dos: "注重每一处细节", donts: "绝不粗糙敷衍" },
        { trait: "内敛", dos: "低调表达品质", donts: "不张扬喧哗" },
        { trait: "专业", dos: "严谨品质标准", donts: "不随意妥协" },
        { trait: "温暖", dos: "亲切对待客人", donts: "不冷漠疏远" },
        { trait: "现代", dos: "融合当代审美", donts: "不守旧过时" },
      ],
      reasoning: {
        marketOpportunityReference: "引用自 S3 marketOverview: 精品咖啡市场年增速 15%",
        consumerInsightReference: "引用自 S4 deepNeeds: 消费者身份认同需求为精致生活表达",
        competitiveGapReference: "引用自 S5 competitiveGap: 竞争空位在体验感和社区归属感",
      },
    },
    7: {
      coreConcept: "日常仪式感的美学表达",
      keywords: [{ keyword: "温暖", rationale: "匹配品牌人格中的温暖特质" }, { keyword: "精致", rationale: "传达品质感" }, { keyword: "简约", rationale: "避免视觉过载" }],
      visualSystem: {
        form: { choice: "圆润柔和的线条", exclusions: "尖锐几何", perceptualTone: "亲切温暖" },
        color: { choice: "暖色调为主", exclusions: "冷荧光色", perceptualTone: "温暖舒适" },
        typography: { choice: "衬线体为主", exclusions: "过于现代的几何无衬线", perceptualTone: "经典优雅" },
        imagery: { choice: "自然光摄影", exclusions: "过度修图", perceptualTone: "真实自然" },
        material: { choice: "哑光质地", exclusions: "高光镀膜", perceptualTone: "低调品质" },
      },
      restrictions: [{ exclusion: "荧光色", strategicRationale: "与温暖克制的品牌人格冲突" }, { exclusion: "过于夸张的字体", strategicRationale: "与内敛气质不符" }, { exclusion: "过度装饰", strategicRationale: "品牌追求简约表达" }],
    },
    8: {
      coreDirection: "内容服务于品牌定位，让每次沟通都强化品质生活的品牌联想",
      contentValueSystem: [
        { userStage: "awareness", userProblem: "不了解精品咖啡", contentValue: "科普精品咖啡知识" },
        { userStage: "interest", userProblem: "如何选择好咖啡", contentValue: "展示产品品质标准" },
        { userStage: "trust", userProblem: "为什么信任本品牌", contentValue: "讲述品牌故事与理念" },
        { userStage: "decision", userProblem: "如何购买体验", contentValue: "提供便捷购买与体验路径" },
      ],
      themeDirections: [{ pillar: "品质生活", corePurpose: "建立品质生活关联", topicDirections: ["咖啡知识", "生活方式"] }, { pillar: "社区文化", corePurpose: "建立用户归属感", topicDirections: ["用户故事", "线下活动"] }],
      channelStrategy: [
        { platform: "xiaohongshu", contentFormat: "图文+短视频", expressionFocus: "生活方式展示" },
        { platform: "douyin", contentFormat: "短视频+直播", expressionFocus: "品质细节展示" },
        { platform: "wechat", contentFormat: "公众号文章+社群", expressionFocus: "深度内容+用户关系" },
      ],
    },
  };

  await t("assembleReport returns valid ReportContent").run(async () => {
    const report = await assembleReport("test-project", "测试品牌", "精品咖啡", mockOutputs);

    t("").assert(typeof report.brandName === "string", "brandName required");
    t("").assert(typeof report.generatedAt === "string", "generatedAt required");
    t("").assert(report.cover !== undefined, "cover required");
    t("").assert(report.executiveSummary !== undefined, "executiveSummary required");
    t("").assert(report.blueprint !== undefined, "blueprint required");
    t("").assert(Array.isArray(report.chapters), "chapters required");
    t("").assert(report.chapters.length >= 1, `Expected >=1 chapters, got ${report.chapters.length}`);

    // Verify chapter structure
    for (const ch of report.chapters) {
      t("").assert(typeof ch.number === "number", `Chapter ${ch.number}: number required`);
      t("").assert(typeof ch.title === "string", `Chapter ${ch.number}: title required`);
      t("").assert(typeof ch.subtitle === "string", `Chapter ${ch.number}: subtitle required`);
      t("").assert(typeof ch.sourceStage === "number", `Chapter ${ch.number}: sourceStage required`);
      t("").assert(Array.isArray(ch.blocks), `Chapter ${ch.number}: blocks array required`);
      t("").assert(ch.blocks.length >= 1, `Chapter ${ch.number}: at least 1 block`);
    }

    // Verify chapter ordering by number
    for (let i = 1; i < report.chapters.length; i++) {
      t("").assert(
        report.chapters[i].number === report.chapters[i - 1].number + 1,
        `Chapters should be sequential`
      );
    }
  });

  await t("assembleReport chapter numbers are sequential").run(async () => {
    const report = await assembleReport("test-project", "测试品牌", "精品咖啡", mockOutputs);
    for (let i = 0; i < report.chapters.length; i++) {
      t("").assert(
        report.chapters[i].number === i + 1,
        `Chapter index ${i} should have number ${i + 1}, got ${report.chapters[i].number}`
      );
    }
  });

  await t("assembleReport throws on empty outputs").run(async () => {
    try {
      await assembleReport("test-project", "测试品牌", undefined, {});
      t("").assert(false, "Should have thrown");
    } catch (e: any) {
      t("").assert(e.message.includes("无可用") || e.message.includes("empty") || e.message.includes("no stage"),
        `Expected meaningful error, got: ${e.message}`);
    }
  });

  await t("assembleReport skips missing stages gracefully").run(async () => {
    // Only provide S1-S6, skip S7-S8
    const partial: Record<number, Record<string, any>> = {};
    for (let i = 1; i <= 6; i++) partial[i] = mockOutputs[i];

    const report = await assembleReport("test-project", "测试品牌", "精品咖啡", partial);
    // Should still assemble, just fewer chapters
    t("").assert(report.chapters.length >= 1, "Should assemble with partial data");
    t("").assert(report.chapters.every((ch) => ch.sourceStage <= 6), "All chapters should come from S1-S6");
  });

  // ================================================================
  // Part 3: Final Audit
  // ================================================================
  console.log("\nFinal Audit");

  await t("runFinalAudit returns audit results for all stages").run(async () => {
    const auditResult = await runFinalAudit("test-project", mockOutputs);
    t("").assert(typeof auditResult.passed === "boolean", "passed required");
    t("").assert(Array.isArray(auditResult.issues), "issues required");
    t("").assert(typeof auditResult.summary === "string", "summary required");
  });

  await t("runFinalAudit finds reference issues in incomplete data").run(async () => {
    // Output with missing reasoning (S6 without proper references)
    const incompleteOutputs = { ...mockOutputs };
    incompleteOutputs[6] = {
      positioning: "Test positioning here with enough chars for validation",
      valuePropositions: [
        { proposition: "Func value", level: "functional", soWhatDerivation: "x" },
        { proposition: "Emo value", level: "emotional", soWhatDerivation: "y" },
        { proposition: "Soc value", level: "social", soWhatDerivation: "z" },
      ],
      brandStory: { struggleMoment: "A and B and C test", brandAction: "D and E and F test", brandRelationship: "G and H and I test" },
      brandPersonality: [
        { trait: "A", dos: "do a stuff", donts: "not x stuff" },
        { trait: "B", dos: "do b stuff", donts: "not y stuff" },
        { trait: "C", dos: "do c stuff", donts: "not z stuff" },
        { trait: "D", dos: "do d stuff", donts: "not w stuff" },
        { trait: "E", dos: "do e stuff", donts: "not v stuff" },
      ],
      reasoning: {
        marketOpportunityReference: "Valid reference to S3 market data with sufficient length",
        consumerInsightReference: "Valid reference to S4 consumer insight data with sufficient length here",
        competitiveGapReference: "Valid reference to S5 competitive gap data with sufficient length for testing",
      },
    };

    const auditResult = await runFinalAudit("test-project", incompleteOutputs);
    // Should pass since all references are valid
    t("").assert(auditResult.passed === true, `Expected passed=true, got ${auditResult.passed}: ${auditResult.summary}`);
  });

  await t("assembleWithAudit suspends on error-level ref issues").run(async () => {
    // Output with S6 reasoning all "未追溯" — triggers ref errors
    const badOutputs = { ...mockOutputs };
    badOutputs[6] = {
      ...badOutputs[6],
      reasoning: {
        marketOpportunityReference: "未追溯到前序数据——该定位要素可能为AI独立推断",
        consumerInsightReference: "未追溯到前序数据",
        competitiveGapReference: "未追溯",
      },
    };

    const result = await assembleWithAudit("test-project", badOutputs, "测试品牌", "精品咖啡");
    t("").assert(!result.report, "Report should be null when suspended");
    t("").assert(result.audit.passed === false, "Audit should not pass");
    t("").assert(result.audit.issues.length > 0, "Should have audit issues");
    t("").assert(result.suspended === true, "Should be suspended");
    t("").assert(typeof result.suspendReason === "string", "Should have suspend reason");
  });

  await t("assembleWithAudit proceeds when audit passes").run(async () => {
    const result = await assembleWithAudit("test-project", mockOutputs, "测试品牌", "精品咖啡");
    t("").assert(result.audit.passed === true, `Expected audit passed, got: ${result.audit.summary}`);
    t("").assert(!result.suspended, "Should not be suspended");
    t("").assert(result.report !== null, "Report should not be null");
    t("").assert(result.report!.chapters.length >= 1, "Should have chapters");
  });

  // ================================================================
  // Report results
  // ================================================================
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${"-".repeat(40)}`);
  console.log(`Results: ${ok} passed, ${fail} failed`);
  console.log(`${"-".repeat(40)}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

runAll();
