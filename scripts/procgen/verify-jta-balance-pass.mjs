#!/usr/bin/env node
/**
 * Phase 3d verification: run the Pass-B forward balancing pass against a REAL
 * post-fill seed and report what it produced.
 *
 * This is the Pass-B pipeline end to end, minus the browser: read an exported
 * rules.json (preset_sidecars -> ap_locations, access-rule gate counts, plus
 * the sphere log), walk it through the fork's own simulation under NORMAL
 * ticking (plan §1.1 amendment — never instant mode), and emit Tier-1 cost
 * patches. Design: CC/docs/plans/jta-balance-pass-plan.md.
 *
 * Generate an input first, e.g.:
 *   JTA_RT_QUOTA=15 JTA_RT_KEEP=1 node scripts/procgen/verify-jta-locations-roundtrip.mjs
 *   node scripts/procgen/verify-jta-balance-pass.mjs \
 *     frontend/presets/jta_loctest_roundtrip_worldgen/AP_<seed>/AP_<seed>_rules.json
 *
 * Synthetic-dataset worlds (Phase 5e) are AUTO-DETECTED from the sidecar
 * carriage (single-carrier + refs): the dataset is loadGameData'd into the
 * env before the walk and the identity constants (perk item names,
 * suppression sentinel) come from the document instead of the vanilla
 * snapshot — the same worker path jtaBalance runs in-app. Generate a dataset
 * input with JTA_RT_DATASET=1 JTA_RT_KEEP=1 on the roundtrip verifier.
 * A ref without a resolvable document is fatal (solving vanilla tables
 * against dataset task ids would be garbage).
 *
 * Exits non-zero when the pass fails its own convergence bar: any stalled or
 * never-started entry, any saturated solve, or a walk that doesn't cover the
 * full location universe.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const rulesPath = process.argv[2];
if (!rulesPath) {
    console.error('usage: verify-jta-balance-pass.mjs <exported rules.json>');
    process.exit(2);
}

const { loadJtaEnv } = await import(pathToFileURL(path.join(repoRoot, 'CC/scripts/jta-stats/node-env.mjs')));
const { runBalancePass } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaBalance/balancePass.js')));
const { computeSeedName, extractPerkHolderTaskIds } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaBalance/hostGlue.js')));
const jtaLib = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')));
const { JTA_PERK_COUNT } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/vanillaDataset.js')));

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// ap_locations, payload-native direction (taskId -> location name). Dataset
// carriage (5e): the single carrier's `jta_dataset` if any sidecar has one.
const playerId = Object.keys(rules.preset_sidecars)[0];
const apLocations = {};
let dataset = null;
let datasetRef = null;
for (const sidecar of Object.values(rules.preset_sidecars[playerId])) {
    const payload = sidecar.playable_payload ?? sidecar;
    if (!dataset && payload.jta_dataset) dataset = payload.jta_dataset;
    if (!datasetRef && payload.jta_dataset_ref) datasetRef = payload.jta_dataset_ref;
    for (const [taskId, locName] of Object.entries(payload.ap_locations ?? {})) {
        apLocations[taskId] = locName;
    }
}
if (datasetRef && !dataset) {
    console.error(`FATAL: world references dataset '${datasetRef.dataset_id}' but no sidecar carries it`);
    process.exit(2);
}

// Gate counts: the HasFromListUnique perk count on each location's access
// rule (Phase 3a's loose zone gates); no access_rule = free (0). Walk the
// rule tree defensively — the count may sit under a combinator.
function ruleGateCount(rule) {
    if (!rule || typeof rule !== 'object') return 0;
    if (rule.rule === 'HasFromListUnique') return Number(rule.args?.count ?? 0);
    let max = 0;
    for (const v of Object.values(rule.args ?? rule)) {
        if (Array.isArray(v)) for (const x of v) max = Math.max(max, ruleGateCount(x));
        else if (v && typeof v === 'object') max = Math.max(max, ruleGateCount(v));
    }
    return max;
}
const nameToTaskId = new Map(Object.entries(apLocations).map(([id, n]) => [n, Number(id)]));
const gateCounts = new Map();
for (const region of Object.values(rules.regions?.[playerId] ?? {})) {
    for (const loc of region.locations ?? []) {
        const taskId = nameToTaskId.get(loc.name);
        if (taskId == null) continue;
        gateCounts.set(taskId, ruleGateCount(loc.access_rule));
    }
}

// Embedded first, then the sibling .jsonl — the same strategy sphereState uses
// in-app. Pass-A rules.json embeds `sphere_log`; a Generate.py export does NOT
// and writes <seed>_sphere_log.jsonl beside it instead.
function loadSphereLog(rulesDoc, rulesFile) {
    if (Array.isArray(rulesDoc.sphere_log) && rulesDoc.sphere_log.length) return rulesDoc.sphere_log;
    const sibling = rulesFile.replace(/_rules\.json$/, '_sphere_log.jsonl');
    if (!fs.existsSync(sibling)) return [];
    return fs.readFileSync(sibling, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const sphereLog = loadSphereLog(rules, rulesPath);
// computeSeedName, not a hand-rolled fallback chain: Pass-A presets carry an
// EMPTY seed_name (`??` would keep it, `||` skips it) and a generation_seed —
// the in-app worker keys its walk shuffle and cache on computeSeedName, so the
// guard must derive the SAME seed or it walks the same preset in a different
// order than the app solves it.
const seed = computeSeedName(rules);
console.log(`rules: ${path.basename(rulesPath)} · seed ${seed}`
    + (dataset ? ` · dataset ${dataset.dataset_id}` : ''));
console.log(`player ${playerId} · ${Object.keys(apLocations).length} jta locations · `
    + `${gateCounts.size} gate counts · ${sphereLog.length} sphere-log entries`);

const env = await loadJtaEnv();
// Dataset world: swap the engine's tables to the document before the walk —
// the same seam the jtaBalance worker uses — and take identity constants
// from the dataset (placed-perk names / perk count) instead of the vanilla
// snapshot.
let perkItemNames = [...jtaLib.JTA_PERK_ITEM_NAMES];
let perkCountSentinel = JTA_PERK_COUNT;
if (dataset) {
    if (typeof env.win.loadGameData !== 'function') {
        console.error('FATAL: dataset world but loadGameData is unavailable (fork build predates Fork 1.7)');
        process.exit(2);
    }
    const res = env.win.loadGameData(dataset);
    if (!res?.ok) {
        console.error(`FATAL: loadGameData rejected the dataset: ${(res?.errors ?? []).join('; ')}`);
        process.exit(2);
    }
    perkItemNames = [...new Set(dataset.zones.flatMap((z) => z.tasks
        .filter((t) => t.perk != null)
        .map((t) => dataset.perks[t.perk].name)))];
    perkCountSentinel = dataset.perks.length;
}
// Holder leg of the forced perk-category set — the same extraction the
// in-app host performs (hostGlue -> perkOrigin shared definition).
const perkHolderIds = extractPerkHolderTaskIds(rules, playerId, apLocations, perkItemNames);
const t0 = Date.now();
const { patches, report } = await runBalancePass({
    env,
    sphereLog,
    playerId,
    apLocations,
    perkItemNames,
    perkHolderTaskIds: perkHolderIds,
    gateCounts,
    seed,
    options: { perkCountSentinel },
});
const elapsed = Date.now() - t0;

console.log(`\nsolved in ${(elapsed / 1000).toFixed(1)} s · ${report.totalResets} resets simulated (normal ticking)`);
console.log(`walk: ${report.entryCount} entries (${report.order.logCovered} from log, `
    + `${report.order.synthesized} synthesized, ${report.order.buckets} buckets, `
    + `${report.order.repairsApplied} repair moves)`);
console.log(`${report.milestoneCount} perk milestones · ${report.costedTaskCount} cost patches · `
    + `skill-less ${report.skillless} · floor ${report.floorClamped} · threshold-clamped ${report.thresholdClamped}`);
console.log(`stalled ${report.stalledEntries} · never-started ${report.neverStarted} · `
    + `completed-unsolved ${report.completedUnsolved} · saturated ${report.saturated} · `
    + `unengaged ${report.unengaged} (milestones ${report.unengagedMilestones})`
    + (report.unengagedCostMultiplier != null
        ? ` · unengaged tail repriced to max cm ${report.unengagedCostMultiplier.toPrecision(3)}` : ''));

console.log(`\n  # perk milestone                    zone-bucket target  gap  via`);
let mi = 0;
for (const r of report.entries) {
    if (!r.milestone) continue;
    mi++;
    console.log(`${String(mi).padStart(3)} task ${String(r.taskId).padEnd(5)} ${String(r.location ?? '').padEnd(22)}`
        + ` ${String(r.bucket).padStart(6)} ${String(r.target ?? '-').padStart(6)} ${String(r.gap ?? '-').padStart(5)}`
        + `  ${r.solvedVia ?? '-'}${r.stalled ? ' STALL' : ''}`);
}

const gaps = report.milestoneGaps;
if (gaps.length) {
    const sorted = [...gaps].sort((a, b) => a - b);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const mean = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
    console.log(`\nmilestone gaps vs resetsPerStep=${report.resetsPerStep}: `
        + `p25=${p(0.25)} p50=${p(0.5)} p75=${p(0.75)} max=${sorted[sorted.length - 1]} mean=${mean}`);
}
const cms = patches.map((x) => x.cost_multiplier).sort((a, b) => a - b);
if (cms.length) {
    console.log(`cost_multiplier: min=${cms[0].toPrecision(3)} p50=${cms[Math.floor(cms.length / 2)].toPrecision(3)} max=${cms[cms.length - 1].toPrecision(3)}`);
}

// Full per-entry report for debugging (stall diagnosis, gap distributions).
const reportPath = process.env.JTA_BP_REPORT;
if (reportPath) {
    fs.writeFileSync(reportPath, JSON.stringify({ patches, report }, null, 1));
    console.log(`\n[report written to ${reportPath}]`);
}

// ---- Convergence bar -------------------------------------------------------
const failures = [];
if (report.entryCount !== Object.keys(apLocations).length) {
    failures.push(`walk covers ${report.entryCount}/${Object.keys(apLocations).length} locations`);
}
if (report.stalledEntries) failures.push(`${report.stalledEntries} stalled entries`);
if (report.neverStarted) failures.push(`${report.neverStarted} entries never started`);
if (report.saturated) failures.push(`${report.saturated} saturated solves`);
// A perk milestone automation refuses to run at any cost would strand progression.
if (report.unengagedMilestones) failures.push(`${report.unengagedMilestones} unengaged MILESTONES`);
if (failures.length) {
    console.log(`\nFAILED: ${failures.join(' · ')}`);
    process.exit(1);
}
console.log('\nPASS: full coverage, no stalls, no saturation');
