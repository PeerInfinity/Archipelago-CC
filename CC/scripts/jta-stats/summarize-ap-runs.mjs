#!/usr/bin/env node
/**
 * Summarize `randomized-pacing-*` harness runs (Phase 4 — emergent verification).
 *
 * Phase 4's FIRST-CLASS assertion is LOCATION COVERAGE, not pacing: of the AP
 * location pool, how many are ever checked under FREE automation? The balance
 * pass cannot answer this by construction — it confines automation to the walk
 * frontier with `setCostedTaskIds` and waits for each entry, so a task that only
 * ever completes because the walk waited for it looks identical to one real play
 * would reach. Pacing is the secondary metric.
 *
 * Emits a markdown comparison across result files.
 *
 * Usage:
 *   node CC/scripts/jta-stats/summarize-ap-runs.mjs \
 *     --balance-report /tmp/bp.json \
 *     --out CC/scripts/jta-stats/results/comparison-randomized-pacing.md \
 *     results/randomized-pacing-baseline-node.json ...
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const balanceReportPath = getArg('--balance-report');
const outPath = getArg('--out');
const files = args.filter((a) => a.endsWith('.json') && a !== balanceReportPath);
if (!files.length) {
    console.error('usage: summarize-ap-runs.mjs [--balance-report bp.json] [--out X.md] <result.json>...');
    process.exit(2);
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '-');

// Tasks the balance pass flagged `thresholdFloored`: MIN cost is unaffordable at
// first touch, and they complete IN THE WALK only because nothing else is
// runnable, so the all-skipped Best-Task fallback grinds the skill up. In free
// play automation always has better work, so the fallback may never fire. These
// are the specific tasks whose coverage Phase 4 exists to check.
let flooredIds = [];
if (balanceReportPath) {
    const bp = JSON.parse(fs.readFileSync(balanceReportPath, 'utf8'));
    flooredIds = (bp.report?.entries ?? []).filter((e) => e.thresholdFloored).map((e) => e.taskId);
}

const rows = [];
for (const file of files) {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ap = d.apRuntime;
    if (!ap) {
        console.error(`${file}: no apRuntime block — not an AP-emulation run; skipping`);
        continue;
    }
    const name = d.meta?.configName ?? path.basename(file, '.json');

    // Pacing: resets between consecutive perk-item acquisitions, in the order
    // they actually happened. The in-sample analogue is the walk's milestone gap.
    const acquired = ap.milestones.filter((m) => m.run != null).sort((a, b) => a.run - b.run);
    const gaps = acquired.slice(1).map((m, i) => m.run - acquired[i].run);
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;

    // Cross-check: the polling metric INFERS zone-skip completions; the callback
    // observes what the fork actually fired (and what the bridge would report as
    // an AP check). Any disagreement is a harness bug, not a game result.
    const cb = ap.firstCompletionRuns ?? {};
    const polling = new Map(d.completions.map((c) => [String(c.id), c]));
    const onlyPolling = [...polling.keys()].filter((id) => !(id in cb));
    const onlyCallback = Object.keys(cb).filter((id) => !polling.has(id));

    rows.push({
        name,
        coverage: ap.coverage,
        total: ap.coverageTotal,
        full: ap.fullCoverage,
        uncovered: ap.uncovered,
        runs: d.timing.runsExecuted,
        prestiges: ap.prestigeWipes,
        regrants: ap.regrants,
        perks: ap.perksGranted.length,
        perksMissing: ap.perksMissing,
        gaps,
        p25: quantile(sortedGaps, 0.25),
        p50: quantile(sortedGaps, 0.5),
        p75: quantile(sortedGaps, 0.75),
        max: sortedGaps[sortedGaps.length - 1],
        mean,
        stalled: d.stalled,
        onlyPolling,
        onlyCallback,
        flooredRuns: flooredIds.map((id) => ({ id, run: cb[String(id)] ?? null })),
        acquiredRuns: acquired.map((m) => m.run),
    });
}

const L = [];
L.push('# Randomized-pacing runs (Phase 4 — emergent verification)\n');
L.push('First-class assertion is **location coverage** under free automation.');
L.push('`resetsPerStep = 5` is the pacing target the balance pass solved against.\n');

L.push('## Coverage\n');
L.push('| run | coverage | full? | runs | prestiges | perks | re-grants | stalled |');
L.push('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    L.push(`| ${r.name} | ${r.coverage}/${r.total} | ${r.full ? '**yes**' : '**NO**'} | ${r.runs} `
        + `| ${r.prestiges} | ${r.perks}/21 | ${r.regrants} | ${r.stalled ? 'YES' : 'no'} |`);
}

L.push('\n## Pacing — resets between consecutive perk acquisitions\n');
L.push('| run | n | p25 | p50 | p75 | max | mean | vs target 5 |');
L.push('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const ratio = Number.isFinite(r.mean) && r.mean > 0 ? `${fmt(5 / r.mean)}×` : '-';
    L.push(`| ${r.name} | ${r.gaps.length} | ${r.p25} | ${r.p50} | ${r.p75} | ${r.max} | ${fmt(r.mean)} | ${ratio} |`);
}

if (flooredIds.length) {
    L.push(`\n## The \`thresholdFloored\` tasks (${flooredIds.length}) — the coverage risk\n`);
    L.push('Run at which each was first completed under free automation (`—` = never).\n');
    L.push(`| run | ${flooredIds.map((id) => `t${id}`).join(' | ')} |`);
    L.push(`|---|${flooredIds.map(() => '---').join('|')}|`);
    for (const r of rows) {
        L.push(`| ${r.name} | ${r.flooredRuns.map((f) => f.run ?? '—').join(' | ')} |`);
    }
}

L.push('\n## Metric cross-check\n');
L.push('`completions` (polling; infers zone-skip credit at run boundaries) vs');
L.push('`firstCompletionRuns` (what the fork\'s completion callback actually fired —');
L.push('the same signal the bridge turns into an AP location check).\n');
for (const r of rows) {
    const ok = r.onlyPolling.length === 0 && r.onlyCallback.length === 0;
    L.push(`- **${r.name}**: ${ok ? 'agree exactly' : `DISAGREE — polling-only ${JSON.stringify(r.onlyPolling)}, callback-only ${JSON.stringify(r.onlyCallback)}`}`);
}

for (const r of rows) {
    if (!r.full) {
        L.push(`\n### ${r.name} — uncovered locations (${r.uncovered.length})\n`);
        for (const u of r.uncovered) L.push(`- task ${u.id} (zone ${u.zone}) ${u.name}`);
        if (r.perksMissing.length) L.push(`\nPerks never acquired: ${r.perksMissing.join(', ')}`);
    }
}

L.push('\n## Perk-acquisition runs\n');
for (const r of rows) L.push(`- **${r.name}**: ${r.acquiredRuns.join(', ')}`);

const md = `${L.join('\n')}\n`;
if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, md);
    console.log(`wrote ${outPath}`);
}
console.log(md);
