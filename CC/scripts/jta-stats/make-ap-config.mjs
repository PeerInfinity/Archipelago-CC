#!/usr/bin/env node
/**
 * Build a jta-stats harness config that emulates AP solo play of a randomized,
 * balanced JtA world (Phase 4 — emergent verification).
 *
 * Everything Phase 3 measured is IN-SAMPLE: the balance pass measures milestone
 * gaps inside the very walk that assigns the costs, with `setCostedTaskIds`
 * confining automation to the frontier. This script produces the out-of-sample
 * input: the shipped patches, no scaffolding, free automation.
 *
 * It joins the two artifacts that together define the shipped world:
 *
 *   rules.json  (exported by Generate.py)
 *     - preset_sidecars[pid][region].playable_payload.ap_locations
 *         taskId -> AP location name
 *     - preset_sidecars[pid][region].playable_payload.task_patches
 *         the perk -> JTA_PERK_COUNT grant-suppression patches (one per NATIVE
 *         perk task); their ids are also the forced perk-category set
 *     - regions[pid][region].locations[].item
 *         the post-fill placement: which item sits on which location
 *
 *   bp.json     (JTA_BP_REPORT from scripts/procgen/verify-jta-balance-pass.mjs)
 *     - patches[] : { id, cost_multiplier }
 *
 * The emitted `gameDataPatch` is the two patch lists MERGED, which is exactly
 * what the substrate bridge applies on region entry (jtaBalance merges the
 * solved costs into `world.task_patches`). The emitted `apRuntime` carries the
 * runtime a patch list cannot express: the forced perk-category ids, and the
 * placement-driven grant map (perk item -> the task whose location holds it,
 * which the fill shuffle moves away from that perk's native task).
 *
 * Usage:
 *   node CC/scripts/jta-stats/make-ap-config.mjs \
 *     --rules frontend/presets/<preset>/AP_<seed>/AP_<seed>_rules.json \
 *     --report /tmp/bp.json \
 *     --name randomized-pacing-baseline \
 *     --out CC/scripts/jta-stats/configs/randomized-pacing-baseline.json
 *
 * Variants (each isolates one thing Phase 4 must answer):
 *   --no-cost-patches   drop the balance solve; keep shuffle + suppression.
 *                       Control: is the solve helping or hurting coverage?
 *   --no-regrant        grant each perk once, never again — models bridge.js
 *                       BEFORE the 2026-07-09 fix (see driver.mjs apRuntime
 *                       header). The regression control, not current behaviour.
 *   --no-perk-category  omit the forced perk-category ids, re-introducing the
 *                       2026-07-09 categorization defect. Out-of-sample proof
 *                       that the setPerkCategoryTaskIds fix is load-bearing.
 *   --pin-max-energy N  substrate comparison pool (standalone is the default,
 *                       matching the energyBonusSync runtime).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');   // CC/scripts/jta-stats -> repo root

const args = process.argv.slice(2);
const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(name);

const rulesPath = getArg('--rules');
const reportPath = getArg('--report');
const outPath = getArg('--out');
const name = getArg('--name') ?? 'randomized-pacing-baseline';
if (!rulesPath || !outPath) {
    console.error('usage: make-ap-config.mjs --rules <rules.json> [--report <bp.json>] '
        + '--out <config.json> [--name N] [--max-runs N] [--pin-max-energy N] '
        + '[--no-cost-patches] [--no-regrant] [--no-perk-category]');
    process.exit(2);
}
// Repeatable `--mod-override key=value` (value JSON-parsed, falling back to the
// raw string). Lets a variant probe a different automation profile — e.g.
// `--mod-override threshold_all_skipped=1` swaps the Best-Task all-skipped
// fallback for End Run, which is what the baseline profile uses to rescue
// threshold-skipped tasks.
const modOverrides = {};
for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--mod-override') continue;
    const [k, ...rest] = String(args[i + 1] ?? '').split('=');
    if (!k || !rest.length) {
        console.error(`--mod-override expects key=value, got ${args[i + 1]}`);
        process.exit(2);
    }
    const raw = rest.join('=');
    try { modOverrides[k] = JSON.parse(raw); } catch { modOverrides[k] = raw; }
}

const noCostPatches = hasFlag('--no-cost-patches');
if (!reportPath && !noCostPatches) {
    console.error('--report is required unless --no-cost-patches is set');
    process.exit(2);
}

// Perk item names come from the pipeline library, the same source the balance
// pass uses — never a hand-maintained list.
const { JTA_PERK_ITEM_NAMES } = await import(
    pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js'))
);
const perkNames = new Set(JTA_PERK_ITEM_NAMES);

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const playerId = Object.keys(rules.preset_sidecars ?? {})[0];
if (!playerId) throw new Error(`${rulesPath}: no preset_sidecars — not a jta procgen export?`);

// --- ap_locations + suppression patches, from the sidecars -------------------
const apLocations = new Map();      // taskId -> location name
const suppressionPatches = [];      // { id, perk } — the NATIVE perk tasks
for (const sidecar of Object.values(rules.preset_sidecars[playerId])) {
    const payload = sidecar.playable_payload ?? sidecar;
    for (const [taskId, locName] of Object.entries(payload.ap_locations ?? {})) {
        apLocations.set(Number(taskId), locName);
    }
    for (const patch of payload.task_patches ?? []) {
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'perk')) {
            suppressionPatches.push({ id: patch.id, perk: patch.perk });
        }
    }
}
if (!apLocations.size) throw new Error(`${rulesPath}: no ap_locations in the sidecars`);

// --- placements: which item sits on which of MY locations --------------------
const locToItem = new Map();
for (const region of Object.values(rules.regions?.[playerId] ?? {})) {
    for (const loc of region.locations ?? []) {
        if (loc.item) locToItem.set(loc.name, loc.item);
    }
}

// Own-world perk grants: my perk item, on my own location. Completing that
// location's task grants the perk (and, on every later completion, re-grants it
// after a prestige wiped it — see driver.mjs).
const grants = {};
let fillerCount = 0;
let victoryCount = 0;
let foreignItemsOnMyLocations = 0;
for (const [taskId, locName] of apLocations) {
    const item = locToItem.get(locName);
    if (!item) throw new Error(`location ${locName} (task ${taskId}) has no placed item`);
    if (String(item.player) !== String(playerId)) { foreignItemsOnMyLocations++; continue; }
    if (item.name === 'Victory') { victoryCount++; continue; }
    if (perkNames.has(item.name)) grants[taskId] = item.name;
    else fillerCount++;
}

// Foreign leg: MY perks that the fill placed in ANOTHER player's world. There
// is no task of mine to re-run, so they must persist through prestige. Empty
// for a solo seed; the join is written generally so a multiworld seed works.
const foreignPerks = [];
for (const [pid, regions] of Object.entries(rules.regions ?? {})) {
    if (String(pid) === String(playerId)) continue;
    for (const region of Object.values(regions)) {
        for (const loc of region.locations ?? []) {
            const item = loc.item;
            if (!item || String(item.player) !== String(playerId)) continue;
            if (perkNames.has(item.name)) foreignPerks.push(item.name);
        }
    }
}

// --- cost patches from the balance pass --------------------------------------
let costPatches = [];
if (!noCostPatches) {
    const bp = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    costPatches = (bp.patches ?? []).map((p) => ({ id: p.id, cost_multiplier: p.cost_multiplier }));
    if (!costPatches.length) throw new Error(`${reportPath}: no patches — did the balance pass converge?`);
}

// The merged list the bridge applies: costs first, then suppression. Disjoint
// fields, so order is cosmetic; a task may legitimately appear in both.
const gameDataPatch = [...costPatches, ...suppressionPatches];

// SBtV-gated tasks (17/28/88/158) have no in-game unlocker and are NOT AP
// locations. Excluding them makes the driver's metric universe identical to the
// AP location pool, so `allCompleted` means exactly "full coverage".
const SBTV_TASK_IDS = [17, 28, 88, 158];

const options = {
    zoneLimit: 15,
    excludeTaskIds: SBTV_TASK_IDS,
    maxRuns: Number(getArg('--max-runs') ?? 2000),
    gameDataPatch,
    apRuntime: {
        perkTaskIds: hasFlag('--no-perk-category') ? [] : suppressionPatches.map((p) => p.id),
        grants,
        foreignPerks,
        regrantOnEveryCompletion: !hasFlag('--no-regrant'),
    },
};
if (getArg('--pin-max-energy')) options.pinMaxEnergy = Number(getArg('--pin-max-energy'));
if (Object.keys(modOverrides).length) options.modOverrides = modOverrides;

const config = {
    name,
    _source: {
        rules: path.relative(repoRoot, path.resolve(rulesPath)),
        report: reportPath ? path.relative(repoRoot, path.resolve(reportPath)) : null,
        seed: rules.seed_name || rules.generation_seed || rules.seed || null,
        playerId,
    },
    options,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`);

const sanity = [];
if (apLocations.size !== 130) sanity.push(`expected 130 ap_locations, got ${apLocations.size}`);
if (Object.keys(grants).length !== suppressionPatches.length - foreignPerks.length) {
    sanity.push(`perk placements (${Object.keys(grants).length}) + foreign (${foreignPerks.length}) `
        + `!= suppressed perk tasks (${suppressionPatches.length})`);
}

console.log(`${name}: player ${playerId} · ${apLocations.size} locations`);
console.log(`  gameDataPatch: ${costPatches.length} cost + ${suppressionPatches.length} suppression`);
console.log(`  grants: ${Object.keys(grants).length} own-world perks · ${foreignPerks.length} foreign perks`);
console.log(`  other placements: ${fillerCount} filler · ${victoryCount} victory`
    + (foreignItemsOnMyLocations ? ` · ${foreignItemsOnMyLocations} other players' items` : ''));
console.log(`  perkCategory: ${options.apRuntime.perkTaskIds.length} forced ids`
    + ` · regrant: ${options.apRuntime.regrantOnEveryCompletion}`);
if (sanity.length) console.log(`  ⚠ ${sanity.join(' · ')}`);
console.log(`wrote ${outPath}`);
