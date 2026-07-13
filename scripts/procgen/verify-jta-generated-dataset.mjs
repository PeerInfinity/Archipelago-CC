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
    // profiled sampler landed in commit 2 (detailed coverage in section 1c).
    ok(generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { policy: 'profiled' } } }).validation.ok,
        'profiled policy is accepted (sampler landed)');
    // Unknown structure fields fail fast.
    ok(throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { bogus: 1 } } })),
        'unknown structure field is rejected');
    ok((throws(() => generateJtaDataset({ seed: 1, profile, vanilla, params: { structure: { policy: 'nope' } } })) || '').includes('policy'),
        'invalid policy is rejected');
}

// ---- 1c. Profiled sampler (post-v1 §2.2/§2.3, Phase A commit 2) ------------
const P = (seed, structure) => generateJtaDataset({ seed, profile, vanilla, params: { zoneCount: 15, structure } });
const profiledDense = P(2, { policy: 'profiled', tasksPerZone: { mean: 13, jitter: 0 } });
{
    const throws = (fn) => { try { fn(); return false; } catch { return true; } };
    const bytes = (r) => JSON.stringify(r.dataset, null, 2);
    const counts = (r) => r.dataset.zones.map((z) => z.tasks.length);
    const names = (r) => r.dataset.zones.map((z) => z.tasks.map((t) => t.name));

    const pDefault = P(1, { policy: 'profiled' });
    const mDefault = P(1, { policy: 'mirror' });
    ok(pDefault.validation.ok && pDefault.c4.ok, 'profiled at defaults: valid + C4-clean');
    ok(bytes(pDefault) === bytes(P(1, { policy: 'profiled' })), 'profiled is deterministic');
    // A null axis draws zero rng, so profiled-at-defaults reproduces the mirror
    // structure and draw order and differs ONLY in the id stride (100 vs 20).
    ok(pDefault.dataset.zones[1].tasks[0].id === 110, 'profiled uses id stride 100');
    ok(JSON.stringify(counts(pDefault)) === JSON.stringify(counts(mDefault)), 'profiled defaults: per-zone task counts == mirror');
    ok(JSON.stringify(names(pDefault)) === JSON.stringify(names(mDefault)), 'profiled defaults: task names == mirror (draw order preserved)');
    ok(pDefault.dataset.dataset_id !== mDefault.dataset.dataset_id, 'profiled gets a distinct identity from mirror');

    // tasksPerZone: dense clones stay C4-clean (adding training raises opportunity).
    ok(profiledDense.validation.ok && profiledDense.c4.ok, 'dense tasksPerZone{mean:13}: valid + C4-clean');
    ok(counts(profiledDense).every((n) => n >= 12), 'dense: every zone has >= 12 tasks');
    ok(profiledDense.dataset.zones.flatMap((z) => z.tasks).every((t) => Number.isInteger(t.id) && t.id > 0
        && (t.prestige_layer === null || [0, 1, 2, 3].includes(t.prestige_layer))),
    'dense: every synthetic task has a valid positive id and prestige_layer');
    ok(bytes(profiledDense) === bytes(P(2, { policy: 'profiled', tasksPerZone: { mean: 13, jitter: 0 } })), 'dense is deterministic');

    // tasksPerZone per-zone array.
    const arr = Array(15).fill(11); arr[3] = 14;
    const pArr = P(3, { policy: 'profiled', tasksPerZone: arr });
    ok(pArr.validation.ok && pArr.c4.ok && pArr.dataset.zones[3].tasks.length === 14, 'tasksPerZone array: valid + zone 3 == 14 tasks');

    // typeMix: retype the free pool; type is C4-blind so it stays clean.
    const z5 = pDefault.dataset.zones[5].tasks;
    const carriers5 = z5.filter((t) => t.perk != null || t.item != null || t.type === 'Travel' || t.type === 'Prestige' || t.hidden_by_default).length;
    const nfree5 = z5.length - carriers5;
    const pMix = P(4, { policy: 'profiled', typeMix: { 5: { Normal: nfree5 - 1, Boss: 1 } } });
    ok(pMix.validation.ok && pMix.c4.ok && pMix.dataset.zones[5].tasks.filter((t) => t.type === 'Boss').length >= 1,
        'typeMix retype: valid + C4-clean + zone 5 gains a Boss');
    ok(throws(() => P(4, { policy: 'profiled', typeMix: { 5: { Normal: 99 } } })), 'typeMix whose counts miss the free-pool size is rejected');

    // Reserved Full axes are unbuilt: setting one is a no-op today (documented),
    // but carriers (perk/item/unlock/prestige placement) stay profile-shaped.
    ok(profiledDense.dataset.perks.filter((p) => !p.placeholder).length === mDefault.dataset.perks.filter((p) => !p.placeholder).length,
        'profiled preserves the perk roster (reserved perkCadence axis)');
}

// ---- 1d. C4 repair loop + skillCount (Phase A commit 3) --------------------
const skillCountWorld = P(2, { policy: 'profiled', skillCount: 13 });
{
    const caps = (() => {
        const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
        return { xpMult: q(profile.tasks.map((t) => t.xpMult), 0.95), maxReps: q(profile.tasks.map((t) => t.maxReps), 0.95) };
    })();
    const throws = (fn) => { try { fn(); return false; } catch { return true; } };

    // The mirror sits at exactly 1.00x C4 margin, so a sparse tasksPerZone
    // pulls a demanded skill below floor → the repair loop must fire and clear it.
    let sparse = null;
    for (const s of [1, 2, 3, 7, 11]) {
        const r = P(s, { policy: 'profiled', tasksPerZone: { mean: 6, jitter: 0 } });
        if (r.dataset.provenance.c4_repairs) { sparse = r; break; }
    }
    ok(sparse != null, 'a sparse tasksPerZone departure triggers the C4 repair loop');
    if (sparse) {
        ok(sparse.c4.ok && sparse.validation.ok, 'the repaired sparse world is C4-clean + valid');
        const valueEdits = sparse.dataset.provenance.c4_repairs.filter((e) => e.field === 'xp_mult' || e.field === 'max_reps');
        ok(valueEdits.length > 0 && valueEdits.every((e) => e.field === 'xp_mult' ? e.to <= caps.xpMult + 1e-9 : e.to <= caps.maxReps),
        `every repair value edit respects the profile p95 caps (${valueEdits.length} edits)`);
        ok(JSON.stringify(sparse.dataset) === JSON.stringify(P(sparse.dataset.provenance.seed, { policy: 'profiled', tasksPerZone: { mean: 6, jitter: 0 } }).dataset),
        'the repaired world is deterministic (repair is a pure function of inputs)');
    }

    // skillCount add-only: new skills are woven in and supplied by repair; C4-clean.
    ok(skillCountWorld.validation.ok && skillCountWorld.c4.ok && skillCountWorld.dataset.skills.length === 13,
        'skillCount 13: valid + C4-clean + roster grew to 13');
    const uses = {};
    for (const z of skillCountWorld.dataset.zones) for (const t of z.tasks) for (const s of t.skills) uses[s] = (uses[s] ?? 0) + 1;
    ok([10, 11, 12].every((si) => (uses[si] ?? 0) >= 2), 'each appended skill is used by >= 2 tasks');
    ok((skillCountWorld.dataset.provenance.c4_repairs?.length ?? 0) > 0, 'skillCount exercised the repair loop to supply the new skills');
    ok(throws(() => P(1, { policy: 'profiled', skillCount: 5 })), 'reducing the skill roster is refused (would break role couplings)');
    // Mirror never repairs (C4-clean by construction — no provenance.c4_repairs).
    ok(generated[0].dataset.provenance.c4_repairs === undefined, 'mirror carries no c4_repairs (repairs are profiled-only)');
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
loadAndPlay(profiledDense.dataset); // profiled departure loads + plays through the fork
loadAndPlay(skillCountWorld.dataset); // skillCount 13 (grown roster + repaired supply) loads + plays

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
