#!/usr/bin/env node
/**
 * Phase 3d verification: run the §2 forward balancing pass against a REAL
 * post-fill seed and report what it produced.
 *
 * This is the Pass-B pipeline end to end, minus the browser: read an exported
 * rules.json (preset_sidecars -> ap_locations, plus the embedded sphere log),
 * walk it through the fork's own simulation, and emit Tier-1 cost patches.
 *
 * Generate an input first, e.g.:
 *   JTA_RT_QUOTA=15 JTA_RT_KEEP=1 node scripts/procgen/verify-jta-locations-roundtrip.mjs
 *   node scripts/procgen/verify-jta-balance-pass.mjs \
 *     frontend/presets/jta_loctest_roundtrip_worldgen/AP_<seed>/AP_<seed>_rules.json
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
const jtaLib = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')));
const { JTA_PERK_COUNT } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/zoneTaskData.js')));

// v1 anchor curve: zones 0-14 standalone perk-milestone gaps (Phase 0,
// SUMMARY.md Round 5). The trailing 70 is the SBtV straggler, which v1
// excludes, so it is not part of the curve.
const ANCHOR_CURVE = [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8];

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const calibration = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'CC/scripts/jta-stats/results/calibration-standalone-z14.json'), 'utf8'));

// Invert every region's ap_locations (taskId -> name) into name -> taskId.
const playerId = Object.keys(rules.preset_sidecars)[0];
const apLocations = {};
for (const sidecar of Object.values(rules.preset_sidecars[playerId])) {
    const payload = sidecar.playable_payload ?? sidecar;
    for (const [taskId, locName] of Object.entries(payload.ap_locations ?? {})) {
        apLocations[locName] = Number(taskId);
    }
}
// Embedded first, then the sibling .jsonl — the same strategy sphereState uses
// in-app (sphereState/index.js loadEmbeddedFirstThenFile). Pass-A rules.json
// embeds `sphere_log`; a Generate.py export does NOT, and writes
// <seed>_sphere_log.jsonl beside it instead.
function loadSphereLog(rulesDoc, rulesFile) {
    if (Array.isArray(rulesDoc.sphere_log) && rulesDoc.sphere_log.length) return rulesDoc.sphere_log;
    const sibling = rulesFile.replace(/_rules\.json$/, '_sphere_log.jsonl');
    if (!fs.existsSync(sibling)) return [];
    return fs.readFileSync(sibling, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const sphereLog = loadSphereLog(rules, rulesPath);
console.log(`rules: ${path.basename(rulesPath)}`);
console.log(`player ${playerId} · ${Object.keys(apLocations).length} jta locations · ${sphereLog.length} sphere-log entries`);

const env = await loadJtaEnv();
const t0 = Date.now();
const { patches, report } = await runBalancePass({
    env,
    sphereLog,
    playerId,
    apLocations,
    perkItemNames: [...jtaLib.JTA_PERK_ITEM_NAMES],
    calibration,
    anchorCurve: ANCHOR_CURVE,
    options: { perkCountSentinel: JTA_PERK_COUNT },
});
const elapsed = Date.now() - t0;

console.log(`\nsolved in ${elapsed} ms · ${report.totalResets} resets simulated`);
console.log(`${report.milestoneCount} perk milestones · ${report.costedTaskCount} tasks costed · ${report.patchCount} patches`);
console.log(`clamped: ${report.clampedFloor} to floor, ${report.clampedPlateau} to plateau · stalled steps: ${report.stalledSteps}`);
console.log(`already-complete at cost time: ${report.alreadyComplete} · saturated (left vanilla): ${report.saturated}`);

console.log('\n  # perk                            target  measured  tasks');
for (const [i, s] of report.steps.entries()) {
    if (!s.milestone) continue;
    console.log(`${String(i).padStart(3)} ${String(s.perk).padEnd(30)} ${String(s.targetGap).padStart(6)} ${String(s.measuredGap).padStart(9)}${s.stalled ? ' STALL' : '     '} ${String(s.taskCount).padStart(4)}`);
}

const gaps = report.measuredGaps;
if (gaps.length) {
    const sorted = [...gaps].sort((a, b) => a - b);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    console.log(`\nmeasured gaps: p25=${p(0.25)} p50=${p(0.5)} p75=${p(0.75)} max=${sorted[sorted.length - 1]}`);
    console.log(`anchor curve : p50=7 (zones 0-14 vanilla standalone)`);
}
const cms = patches.map((x) => x.cost_multiplier).sort((a, b) => a - b);
if (cms.length) {
    console.log(`cost_multiplier: min=${cms[0].toPrecision(3)} p50=${cms[Math.floor(cms.length / 2)].toPrecision(3)} max=${cms[cms.length - 1].toPrecision(3)}`);
}
