#!/usr/bin/env node
/**
 * Phase 5d guard: generated synthetic datasets are deterministic, valid,
 * and PLAY on the committed fork build.
 *
 *   1. Determinism — generateJtaDataset(seed, params) twice ⇒ byte-identical
 *      JSON (the same regeneration discipline as export-vanilla-dataset.mjs).
 *   2. Validation — the authoritative datasetValidator passes with zero
 *      errors, and the C4 skill-XP opportunity report clears its
 *      profile-derived floors (the generator asserts this; the guard
 *      re-checks the report shape so a silent generator regression shows).
 *   3. Load + play — window.loadGameData (Fork 1.7) accepts the dataset,
 *      the swapped tables are the dataset's (zone/skill/task names), the
 *      save slot is dataset-keyed, and several hundred stepTicks run
 *      crash-free with task completion and energy drain.
 *   4. A truncated-zone dataset (the in-app test preset's shape) loads and
 *      plays through the SAME process — exercising a dataset→dataset swap.
 *
 * Unlike verify-jta-dataset-load.mjs (vanilla fixture ≡ native tables),
 * a generated dataset is deliberately DIFFERENT data — its checks are
 * validity + playability, not equivalence.
 *
 *   node scripts/procgen/verify-jta-generated-dataset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const { loadJtaEnv } = await import(
    pathToFileURL(path.join(repoRoot, 'CC/scripts/jta-stats/node-env.mjs')));
const { generateJtaDataset } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/generateDataset.js')));
const { validateJtaDataset } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasetValidator.js')));

const profile = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'CC/scripts/jta-stats/results/vanilla-profile.json'), 'utf8')).static;
const vanilla = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json'), 'utf8'));

let failures = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
    if (!cond) failures++;
};

// ---- 1. Determinism -------------------------------------------------------
const CASES = [
    { seed: 1, params: {} },                                    // raw (the default, 5g Q9)
    { seed: 2, params: {} },
    { seed: 3, params: { zoneCount: 3 } },
    { seed: 3, params: { zoneCount: 3, valueMode: 'zone_formula' } }, // the formula twin
];
const generated = [];
for (const { seed, params } of CASES) {
    const a = generateJtaDataset({ seed, profile, vanilla, params });
    const b = generateJtaDataset({ seed, profile, vanilla, params });
    const bytesA = JSON.stringify(a.dataset, null, 2);
    const bytesB = JSON.stringify(b.dataset, null, 2);
    ok(bytesA === bytesB, `seed ${seed}${params.zoneCount ? ` z${params.zoneCount}` : ''}`
        + `${params.valueMode ? ` ${params.valueMode}` : ''}: `
        + `regeneration is byte-identical (${a.dataset.dataset_id})`);
    generated.push(a);
}
{
    // Different seeds must not collapse onto one identity.
    const [a, b] = generated;
    ok(a.dataset.dataset_id !== b.dataset.dataset_id
        && JSON.stringify(a.dataset.skills) !== JSON.stringify(b.dataset.skills),
    'different seeds produce different datasets');
}
{
    // Raw is the default (5g Q9); the identity carries the content hash
    // (rider 2); the raw and formula twins differ ONLY in economy mode +
    // value fields (same names/ids/skeleton) and get distinct identities.
    const rawTwin = generated[2].dataset;
    const formulaTwin = generated[3].dataset;
    ok(rawTwin.economy.value_mode === 'raw', 'default generation is raw mode');
    ok(formulaTwin.economy.value_mode === 'zone_formula', 'zone_formula stays generatable');
    ok(CASES.every((_, i) => {
        const d = generated[i].dataset;
        return d.provenance.content_hash?.length === 8
            && d.dataset_id.endsWith(`-${d.provenance.content_hash}`);
    }), 'every dataset_id carries its content-hash suffix');
    ok(rawTwin.dataset_id !== formulaTwin.dataset_id, 'twins get distinct identities');
    ok(rawTwin.zones.every((z, zi) => z.key === formulaTwin.zones[zi].key
        && typeof z.key === 'string' && z.key.length > 0),
    'zones[].key emitted and mode-independent');
    ok(rawTwin.zones.every((z) => typeof z.raw_drain === 'number'
        && z.tasks.every((t) => typeof t.raw_cost === 'number' && t.raw_cost > 0
            && typeof t.raw_xp === 'number' && t.cost_multiplier === 1)),
    'raw twin carries raw values everywhere, cost_multiplier folded to 1');
    // The informational formula-equivalent multipliers must reproduce the
    // formula twin's real multipliers exactly (strategy info the fold
    // would otherwise erase from the data).
    ok(rawTwin.zones.every((z, zi) => z.tasks.every((t, ti) => {
        const f = formulaTwin.zones[zi].tasks[ti];
        return t.formula_cost_multiplier === f.cost_multiplier
            && t.formula_xp_mult === f.xp_mult;
    })), 'formula_cost_multiplier/formula_xp_mult ≡ the formula twin\'s multipliers');
}

// ---- 1b. Structure policy v2 (post-v1 §2.3, Phase A commit 1) --------------
{
    const throws = (fn) => { try { fn(); return false; } catch (e) { return e.message; } };
    // The default (mirror) uses the v1 id stride of 20 — zone 1 task 0 is id 30.
    ok(generated[0].dataset.zones[1].tasks[0].id === 30, 'mirror default keeps id stride 20 (zone1 task0 == id 30)');
    // An explicit all-default mirror block must reproduce the default byte-for-byte.
    ok(JSON.stringify(generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { policy: 'mirror' } } }).dataset, null, 2)
        === JSON.stringify(generated[0].dataset, null, 2),
    'explicit { policy: "mirror" } is byte-identical to the default');
    // A custom mirror idStride is a valid, DISTINCT variant (ids widen).
    const wide = generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { idStride: 30 } } });
    ok(wide.validation.ok && wide.c4.ok && wide.dataset.zones[1].tasks[0].id === 40
        && wide.dataset.dataset_id !== generated[0].dataset.dataset_id,
    'custom mirror idStride widens ids (zone1 task0 == id 40) and gets a distinct identity');
    // idStride is range-checked on BOTH sides (collision below, exit-task floor above).
    ok(throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { idStride: 5 } } })),
        'idStride below max tasks-per-zone is rejected');
    ok(throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { idStride: 800 } } })),
        'idStride that pushes deep zone ids >= 10000 is rejected');
    // profiled sampler is reserved but not yet built (Phase A commit 2).
    ok((throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { policy: 'profiled' } } })) || '').includes('not yet implemented'),
        'profiled policy is reserved (throws not-implemented until commit 2)');
    // Unknown structure fields fail fast.
    ok(throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { bogus: 1 } } })),
        'unknown structure field is rejected');
    ok((throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { policy: 'nope' } } })) || '').includes('policy'),
        'invalid policy is rejected');
}

// ---- 2. Validation + C4 ----------------------------------------------------
for (const { dataset, c4 } of generated) {
    const v = validateJtaDataset(dataset);
    ok(v.ok && v.errors.length === 0, `${dataset.dataset_id}: validator passes (${v.warnings.length} warnings)`);
    ok(c4.ok && c4.checkedPairs > 0 && c4.violations.length === 0,
        `${dataset.dataset_id}: C4 report clears floors (${c4.checkedPairs} demand pairs)`);
    ok(dataset.prestige.sbtv_unlock_task_ids.length === 0,
        `${dataset.dataset_id}: sbtv_unlock_task_ids empty by construction`);
}

// ---- 3./4. Load + play (full-size, then the truncated one in-process) -----
const env = await loadJtaEnv();
const { win, game, sim, zones, skills } = env;
win.pauseGameLoop?.();
win.initializeHeadless();

function loadAndPlay(dataset, ticks = 500) {
    const res = win.loadGameData(dataset);
    ok(res?.ok === true, `${dataset.dataset_id}: loadGameData ok`
        + (res?.ok ? '' : ` (${JSON.stringify(res?.errors ?? [])})`));
    if (!res?.ok) return;
    ok(sim.getLoadedDatasetId() === dataset.dataset_id, `${dataset.dataset_id}: recorded as loaded`);
    ok(zones.ZONES.length === dataset.zones.length
        && zones.ZONES[0].name === dataset.zones[0].name,
    `${dataset.dataset_id}: engine zones are the dataset's (${zones.ZONES.length})`);
    ok(skills.SkillType.Count === dataset.skills.length,
        `${dataset.dataset_id}: SkillType.Count tracks the dataset (${skills.SkillType.Count})`);
    ok(sim.getSaveLocation() === `incrementalGameSave_substrate__${dataset.dataset_id}`,
        `${dataset.dataset_id}: save slot is dataset-keyed`);

    win.initializeHeadless();
    const G = game.GAMESTATE;
    const first = G.tasks.find((t) => t.enabled && t.reps < t.task_definition.max_reps);
    ok(!!first, `${dataset.dataset_id}: fresh init offers an enabled task`);
    const started = win.performTask(first.task_definition.id);
    ok(started?.success === true, `${dataset.dataset_id}: performTask starts (${first.task_definition.name})`);
    let completed = false;
    for (let i = 0; i < ticks; i++) {
        win.stepTick();
        if (G.tasks.some((t) => t.reps > 0)) completed = true;
    }
    ok(completed, `${dataset.dataset_id}: a task completed under ${ticks} stepTicks`);
    ok(G.current_energy < 100, `${dataset.dataset_id}: energy drained (${G.current_energy.toFixed(1)})`);
}

loadAndPlay(generated[0].dataset);
loadAndPlay(generated[2].dataset); // dataset→dataset swap + truncated zones

// ---- 5. Raw ≡ formula twin: effective values are BIT-EXACT ----------------
// The raw twin is premultiplyDataset(formula twin) by construction; loading
// both through the real fork boundary must produce identical effective
// costs/XP/drain at fresh state (the tick-for-tick property, statically).
{
    const effective = () => zones.ZONES.map((z) => z.tasks.map((d) => {
        const t = new zones.Task(d);
        return [d.id, sim.calcTaskCost(t), sim.calcSkillXp(t, 100, true),
            sim.calcEnergyDrainPerTick(t, false), sim.calcTaskProgressMultiplier(t)];
    }));
    const load = (dataset) => {
        const res = win.loadGameData(dataset);
        ok(res?.ok === true, `${dataset.dataset_id}: loads for the twin comparison`);
        win.initializeHeadless();
        return effective();
    };
    const formulaEff = load(generated[3].dataset);
    const rawEff = load(generated[2].dataset);
    ok(JSON.stringify(formulaEff) === JSON.stringify(rawEff),
        'raw twin ≡ formula twin effective values (cost/XP/drain/progress, bit-exact)');
}

console.log(failures === 0
    ? '\nAll generated-dataset assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
