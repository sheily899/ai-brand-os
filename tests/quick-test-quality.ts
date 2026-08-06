// Quick test for confirmation-quality classifier
import { classifyConfirmationQuality, getQualityAction } from "../src/lib/ai/confirmation-quality";

const cases: Array<[string, string, string, string]> = [
  ["确认", "", "explicit_yes", "advance"],
  ["没问题", "", "explicit_yes", "advance"],
  ["好的", "", "explicit_yes", "advance"],
  ["差不多", "", "weak_yes", "follow_up"],
  ["还行吧", "", "weak_yes", "follow_up"],
  ["你觉得呢", "", "delegation", "follow_up"],
  ["你决定吧", "", "delegation", "follow_up"],
  ["都可以", "", "delegation", "follow_up"],
  ["可以了", "", "exhaustion", "follow_up"],
  ["继续吧", "", "exhaustion", "follow_up"],
  ["先这样", "", "exhaustion", "follow_up"],
  ["确认", "有没有哪个部分你觉得需要调整的？", "explicit_yes", "advance"],
  ["可以了", "有没有哪个判断你觉得需要调整的？如果都 OK，回复确认我们就进入下一步。", "exhaustion", "advance_with_flag"],
  ["差不多", "有没有哪个部分你觉得需要调整的？", "weak_yes", "follow_up"],
];

let pass = 0, fail = 0;
for (const [msg, lastAI, expQ, expA] of cases) {
  const r = classifyConfirmationQuality(msg, lastAI);
  const a = getQualityAction(r.quality, r.isRetry);
  const ok = r.quality === expQ && a.action === expA;
  console.log(
    (ok ? "✅" : "❌"),
    `"${msg}"`.padEnd(12),
    `→ ${r.quality}/${a.action}`.padEnd(30),
    r.isRetry ? "(retry)" : "",
    !ok ? `EXPECTED ${expQ}/${expA}` : ""
  );
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
