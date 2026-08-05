/**
 * Phase 1: Real DM Data Structure Analysis
 *
 * Analyzes all existing Decision Memory entries to understand:
 * - Distribution by stage/entryType/evidenceLevel
 * - Content length statistics
 * - fieldPath patterns
 * - Importance score distribution
 *
 * This calibration data drives the extended dataset generator.
 */

import { db, decisionMemoryEntry } from "../src/lib/db";
import { computeMemoryImportance } from "../src/lib/memory/decision-memory";

interface RawDMEntry {
  id: string;
  projectId: string;
  stageSource: number;
  entryType: string;
  content: string;
  fieldPath: string;
  evidenceLevel: string;
  confirmedAt: Date;
}

async function analyze() {
  // Query all entries
  const rows = await db
    .select()
    .from(decisionMemoryEntry)
    .orderBy(decisionMemoryEntry.confirmedAt) as any as RawDMEntry[];

  if (rows.length === 0) {
    console.log("No DM entries found.");
    return;
  }

  console.log(`=== Real DM Data Calibration Analysis ===`);
  console.log(`Total entries: ${rows.length}`);
  console.log(`Unique projects: ${new Set(rows.map(r => r.projectId)).size}`);
  console.log();

  // ── 1. Distribution by stage ──
  console.log("--- Distribution by Stage ---");
  const byStage = new Map<number, RawDMEntry[]>();
  for (const r of rows) {
    if (!byStage.has(r.stageSource)) byStage.set(r.stageSource, []);
    byStage.get(r.stageSource)!.push(r);
  }
  for (const [stage, entries] of [...byStage.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  S${stage}: ${entries.length} entries`);
  }
  console.log();

  // ── 2. Distribution by entryType ──
  console.log("--- Distribution by entryType ---");
  const typeCounts: Record<string, number> = {};
  for (const r of rows) {
    typeCounts[r.entryType] = (typeCounts[r.entryType] || 0) + 1;
  }
  for (const [t, c] of Object.entries(typeCounts)) {
    console.log(`  ${t}: ${c} (${(c/rows.length*100).toFixed(1)}%)`);
  }
  console.log();

  // ── 3. Distribution by evidenceLevel ──
  console.log("--- Distribution by evidenceLevel ---");
  const evCounts: Record<string, number> = {};
  for (const r of rows) {
    evCounts[r.evidenceLevel] = (evCounts[r.evidenceLevel] || 0) + 1;
  }
  for (const [e, c] of Object.entries(evCounts)) {
    console.log(`  ${e}: ${c} (${(c/rows.length*100).toFixed(1)}%)`);
  }
  console.log();

  // ── 4. Content length statistics ──
  console.log("--- Content Length Statistics ---");
  const lengths = rows.map(r => r.content.length).sort((a, b) => a - b);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const avg = sum / lengths.length;
  const median = lengths[Math.floor(lengths.length / 2)];
  const min = lengths[0];
  const max = lengths[lengths.length - 1];
  const p90 = lengths[Math.floor(lengths.length * 0.9)];
  const p95 = lengths[Math.floor(lengths.length * 0.95)];

  console.log(`  Min:    ${min}`);
  console.log(`  Max:    ${max}`);
  console.log(`  Avg:    ${avg.toFixed(0)}`);
  console.log(`  Median: ${median}`);
  console.log(`  P90:    ${p90}`);
  console.log(`  P95:    ${p95}`);

  // Distribution buckets
  const buckets = [50, 100, 150, 200, 300, 500, 1000, 2000];
  console.log("  Length distribution:");
  for (let i = 0; i < buckets.length; i++) {
    const low = i === 0 ? 0 : buckets[i - 1];
    const high = buckets[i];
    const count = lengths.filter(l => l > low && l <= high).length;
    console.log(`    ${String(low).padStart(4)}-${String(high).padStart(4)}: ${count} (${(count/lengths.length*100).toFixed(1)}%)`);
  }
  const overMax = lengths.filter(l => l > buckets[buckets.length - 1]).length;
  if (overMax > 0) {
    console.log(`    >${buckets[buckets.length - 1]}: ${overMax} (${(overMax/lengths.length*100).toFixed(1)}%)`);
  }
  console.log();

  // ── 5. Content length by entryType ──
  console.log("--- Avg Content Length by entryType ---");
  for (const [t, c] of Object.entries(typeCounts)) {
    const group = rows.filter(r => r.entryType === t);
    const avgLen = group.reduce((s, r) => s + r.content.length, 0) / group.length;
    console.log(`  ${t}: avg ${avgLen.toFixed(0)} chars (n=${c})`);
  }
  console.log();

  // ── 6. Content length by stage ──
  console.log("--- Avg Content Length by Stage ---");
  for (const [stage, entries] of [...byStage.entries()].sort((a, b) => a[0] - b[0])) {
    const avgLen = entries.reduce((s, r) => s + r.content.length, 0) / entries.length;
    console.log(`  S${stage}: avg ${avgLen.toFixed(0)} chars (n=${entries.length})`);
  }
  console.log();

  // ── 7. fieldPath patterns ──
  console.log("--- fieldPath Patterns ---");
  const pathGroups = new Map<string, RawDMEntry[]>();
  for (const r of rows) {
    // Normalize array indices
    const normalized = r.fieldPath.replace(/\[\d+\]/g, "[]");
    if (!pathGroups.has(normalized)) pathGroups.set(normalized, []);
    pathGroups.get(normalized)!.push(r);
  }
  const sortedPaths = [...pathGroups.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [path, entries] of sortedPaths) {
    console.log(`  ${path}: ${entries.length} entries, avg ${(entries.reduce((s, r) => s + r.content.length, 0) / entries.length).toFixed(0)} chars`);
  }
  console.log();

  // ── 8. Cross-analysis: (stage, entryType, evidenceLevel) combinations ──
  console.log("--- Cross Analysis (stage × entryType × evidenceLevel) ---");
  const crossKeys = new Map<string, RawDMEntry[]>();
  for (const r of rows) {
    const key = `S${r.stageSource} | ${r.entryType} | ${r.evidenceLevel}`;
    if (!crossKeys.has(key)) crossKeys.set(key, []);
    crossKeys.get(key)!.push(r);
  }
  const sortedCross = [...crossKeys.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [key, entries] of sortedCross) {
    const avgLen = (entries.reduce((s, r) => s + r.content.length, 0) / entries.length).toFixed(0);
    console.log(`  ${key}: ${entries.length} entries, avg ${avgLen} chars`);
  }
  console.log();

  // ── 9. Importance score distribution ──
  console.log("--- Importance Score Distribution ---");
  const scoreDist: Record<number, number> = {};
  for (const r of rows) {
    const score = computeMemoryImportance(r);
    scoreDist[score] = (scoreDist[score] || 0) + 1;
  }
  for (const [score, count] of Object.entries(scoreDist).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    const threshold = Number(score) >= 4 ? "FULL" : "SUM";
    const bar = "█".repeat(count);
    console.log(`  score=${score} (${threshold}): ${count} ${bar}`);
  }
  const fullCount = rows.filter(r => computeMemoryImportance(r) >= 4).length;
  const sumCount = rows.length - fullCount;
  console.log(`  FULL: ${fullCount} (${(fullCount/rows.length*100).toFixed(1)}%)`);
  console.log(`  SUM:  ${sumCount} (${(sumCount/rows.length*100).toFixed(1)}%)`);
  console.log();

  // ── 10. Strategic field retention check ──
  console.log("--- Strategic Field Coverage ---");
  const CORE_STRATEGIC_FIELDS = [
    "founderMotivation.content",
    "deepNeeds.identityNeed",
    "deepNeeds.functionalNeed",
    "whitespaceOpportunity",
    "competitiveGap.marketOpportunity",
    "positioning",
    "brandStory.struggleMoment",
    "brandStory.brandAction",
    "brandStory.brandRelationship",
    "coreConcept",
    "coreDirection",
  ];
  for (const sf of CORE_STRATEGIC_FIELDS) {
    const matches = rows.filter(r => r.fieldPath.includes(sf));
    if (matches.length > 0) {
      const scores = matches.map(r => computeMemoryImportance(r));
      console.log(`  ✅ ${sf}: ${matches.length} entries, scores [${Math.min(...scores)}-${Math.max(...scores)}], allFULL=${scores.every(s => s >= 4)}`);
    } else {
      console.log(`  ❌ ${sf}: NOT FOUND in dataset`);
    }
  }

  // ── Summary for data generator ──
  console.log("\n=== Data Generator Parameters ===");
  console.log(`  Real entries: ${rows.length}`);
  console.log(`  Stages present: ${[...byStage.keys()].sort((a,b)=>a-b).join(",")}`);
  console.log(`  Content length: min=${min}, max=${max}, median=${median}, p95=${p95}`);
  console.log(`  EntryType ratios: ${Object.entries(typeCounts).map(([k,v]) => `${k}=${(v/rows.length*100).toFixed(0)}%`).join(", ")}`);
  console.log(`  EvidenceLevel ratios: ${Object.entries(evCounts).map(([k,v]) => `${k}=${(v/rows.length*100).toFixed(0)}%`).join(", ")}`);
  console.log(`  Importance: ${fullCount} FULL / ${sumCount} SUM (${(fullCount/rows.length*100).toFixed(0)}% full)`);
}

analyze().catch(err => {
  console.error("Analysis failed:", err.message);
  process.exit(1);
});
