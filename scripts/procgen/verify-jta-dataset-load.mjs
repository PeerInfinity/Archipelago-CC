#!/usr/bin/env node
/**
 * Headless load smoke for the fork's synthetic game data boundary
 * (`window.loadGameData`, Fork 1.7; jta-synthetic-data plan §3 / Phase 5b).
 *
 * Proves, in one process against the committed fork build:
 *   1. NEGATIVE: structurally broken datasets are rejected with errors and
 *      leave every content table untouched (atomicity).
 *   2. POSITIVE: loading the vanilla dataset fixture rebuilds tables that are
 *      equivalent to the natively compiled ones — skills, zones/tasks (every
 *      TaskDefinition field), perks, items, prestige tables, derived maps,
 *      enum Counts, roles, economy, prestige constants.
 *   3. The save slot gains the dataset dimension
 *      (`incrementalGameSave_substrate__<dataset_id>`).
 *   4. Idempotency: re-loading the same dataset_id is a no-op (GAMESTATE
 *      object identity preserved).
 *   5. The re-initialized game actually plays: a task runs to completion
 *      under stepTick and drains energy, several hundred ticks crash-free.
 *
 * Known deliberate deltas (not failures):
 *   - Dead-slot placeholder names differ (cosmetic; never rendered).
 *   - Items with a declarative energy_on_consume effect get synthesized
 *     tooltip/effect text on the vanilla Food pattern, so Fish/Calamari/
 *     Cave Insects gain the "Can take you above your Max Energy" lines their
 *     hand-written tooltips omit. Asserted via containment instead.
 *   - Dataset-built `.enum` fields are set from position, which FIXES the two
 *     items.ts typos (Cactus, Glasses) — asserted as enum === position.
 *
 *   node scripts/procgen/verify-jta-dataset-load.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const fixturePath = path.join(
    repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json');
const rawFixturePath = path.join(
    repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla-raw.json');

const { loadJtaEnv } = await import(
    `file://${path.join(repoRoot, 'CC/scripts/jta-stats/node-env.mjs')}`);

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`FAIL: ${msg}`); };
const ok = (msg) => console.log(`ok: ${msg}`);
const assert = (cond, msg) => { if (!cond) fail(msg); };

const env = await loadJtaEnv();
const { win, game, sim, zones, perks, items, skills, prestige } = env;

const dataset = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

// Placeholder indices from the dataset — those entries' cosmetic fields are
// excluded from the equivalence snapshot.
const isPlaceholder = (e) => e != null && e.placeholder === true;
const deadSkills = new Set(dataset.skills.flatMap((s, i) => (isPlaceholder(s) ? [i] : [])));
const deadPerks = new Set(dataset.perks.flatMap((p, i) => (isPlaceholder(p) ? [i] : [])));
const energyItems = new Map(dataset.items.flatMap((it, i) => {
    const e = (it.effects ?? []).find((x) => x.kind === 'energy_on_consume');
    return e ? [[i, e.base_amount]] : [];
}));

// Gameplay-equivalence projection of every swapped table, at fresh state.
function snapshotTables() {
    const modifierPairs = (list) => (list?.modifiers ?? []).map((m) => [m.skill, m.effect]);
    return {
        skillCount: skills.SkillType.Count,
        perkCount: perks.PerkType.Count,
        itemCount: items.ItemType.Count,
        skillList: [...skills.SKILLS],
        skillDefs: skills.SKILL_DEFINITIONS.map((d, i) => (deadSkills.has(i) ? 'dead' : {
            type: d.type, name: d.name, icon: d.icon, xp_needed_mult: d.xp_needed_mult,
        })),
        perkDefs: perks.PERKS.map((d, i) => (deadPerks.has(i) ? 'dead' : {
            enum: d.enum, name: d.name, icon: d.icon,
            modifiers: modifierPairs(d.skill_modifiers),
            tooltip: d.getTooltip(),
        })),
        itemDefs: items.ITEMS.map((d, i) => ({
            name: d.name, name_plural: d.name_plural, icon: d.icon,
            modifiers: modifierPairs(d.skill_modifiers),
            // Energy items get synthesized text (checked separately below).
            tooltip: energyItems.has(i) ? '(energy)' : d.getTooltip(),
        })),
        artifacts: [...items.ARTIFACTS],
        noteItems: [...items.NOTE_ITEMS],
        zones: zones.ZONES.map((z) => ({
            name: z.name,
            tasks: z.tasks.map((t) => ({
                id: t.id, name: t.name, type: t.type,
                cost_multiplier: t.cost_multiplier, skills: [...t.skills],
                xp_mult: t.xp_mult, item: t.item, use_item: t.use_item,
                perk: t.perk, prestige_layer: t.prestige_layer,
                max_reps: t.max_reps, hidden_by_default: t.hidden_by_default,
                unlocks_task: t.unlocks_task, zone_id: t.zone_id, free: t.free,
            })),
        })),
        taskLookupIds: [...zones.TASK_LOOKUP.keys()].sort((a, b) => a - b),
        perksByZone: [...zones.PERKS_BY_ZONE],
        itemsByZone: [...zones.ITEMS_BY_ZONE],
        unlockables: prestige.PRESTIGE_UNLOCKABLES.map((u) => ({
            type: u.type, layer: u.layer, name: u.name, cost: u.cost,
            description: u.get_description(),
        })),
        repeatables: prestige.PRESTIGE_REPEATABLES.map((r) => ({
            type: r.type, layer: r.layer, name: r.name,
            initial_cost: r.initial_cost, scaling_exponent: r.scaling_exponent,
            description: r.get_description(),
        })),
        roles: JSON.parse(JSON.stringify(sim.SKILL_ROLES)),
        economy: { ...sim.ECONOMY },
        prestigeData: JSON.parse(JSON.stringify(sim.PRESTIGE_DATA)),
    };
}

// Compare two snapshots and report the first few field-level differences.
function diffSnapshots(a, b) {
    const diffs = [];
    const walk = (x, y, at) => {
        if (diffs.length >= 5) return;
        if (typeof x !== typeof y) { diffs.push(`${at}: ${typeof x} vs ${typeof y}`); return; }
        if (x !== null && typeof x === 'object') {
            const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
            for (const k of keys) walk(x[k], y[k], `${at}.${k}`);
            return;
        }
        if (x !== y) diffs.push(`${at}: ${JSON.stringify(x)} !== ${JSON.stringify(y)}`);
    };
    walk(a, b, '$');
    return diffs;
}

// Effective-value projection at fresh state — what raw mode must reproduce
// bit-exactly (the raw fixture folds the backbone into raw values, so its
// DEF fields differ from native by design; behavior must not).
function effectiveSnapshot() {
    return zones.ZONES.map((z) => z.tasks.map((d) => {
        const t = new zones.Task(d);
        return {
            id: d.id,
            cost: sim.calcTaskCost(t),
            xp100: sim.calcSkillXp(t, 100, true),
            drain: sim.calcEnergyDrainPerTick(t, false),
            progressMult: sim.calcTaskProgressMultiplier(t),
        };
    }));
}

// ---- Native baseline (fresh state so state-reading tooltips are deterministic)
win.pauseGameLoop?.();
win.initializeHeadless();
const nativeSnapshot = snapshotTables();
const nativeEffective = effectiveSnapshot();
assert(sim.getLoadedDatasetId() === null, 'no dataset loaded at boot');
const nativeSaveLocation = sim.getSaveLocation();

// ---- 1. NEGATIVE: broken datasets are rejected and apply nothing
const clone = () => JSON.parse(JSON.stringify(dataset));

const brokenCases = [
    ['duplicate task id', (d) => { d.zones[0].tasks[0].id = d.zones[1].tasks[0].id; }],
    ['bad schema_version', (d) => { d.schema_version = 99; }],
    ['behavior at wrong slot', (d) => { d.perks[0].behavior = 'automation_unlock'; }],
    ['silent behavior-slot takeover', (d) => { d.perks[3].behavior = null; }],
    ['dangling unlocks_task', (d) => { d.zones[0].tasks[0].unlocks_task = 99999; }],
    ['skill-index out of range', (d) => { d.zones[0].tasks[0].skills = [d.skills.length]; }],
    ['missing economy field', (d) => { delete d.economy.level_curve; }],
];
for (const [name, mutate] of brokenCases) {
    const broken = clone();
    broken.dataset_id = `broken-${name}`;
    mutate(broken);
    const res = win.loadGameData(broken);
    assert(res.ok === false, `${name}: must be rejected`);
    assert(Array.isArray(res.errors) && res.errors.length > 0, `${name}: must report errors`);
    assert(sim.getLoadedDatasetId() === null, `${name}: must not mark a dataset loaded`);
}
const afterRejects = snapshotTables();
{
    const diffs = diffSnapshots(nativeSnapshot, afterRejects);
    assert(diffs.length === 0, `rejected datasets must leave tables untouched: ${diffs.join('; ')}`);
    assert(sim.getSaveLocation() === nativeSaveLocation, 'save slot untouched after rejects');
}
if (failures === 0) ok(`${brokenCases.length} broken datasets rejected, tables untouched`);

// ---- 2. POSITIVE: vanilla dataset load is table-equivalent to native
const loadResult = win.loadGameData(dataset);
assert(loadResult.ok === true, `vanilla dataset must load: ${JSON.stringify(loadResult.errors ?? [])}`);
assert(sim.getLoadedDatasetId() === dataset.dataset_id, 'dataset id recorded');

const datasetSnapshot = snapshotTables();
{
    const diffs = diffSnapshots(nativeSnapshot, datasetSnapshot);
    assert(diffs.length === 0, `dataset tables must equal native tables: ${diffs.join('; ')}`);
}
// Loader sets .enum from position — this is what neutralizes the two
// items.ts enum typos (Cactus, Glasses).
assert(items.ITEMS.every((d, i) => d.enum === i), 'item .enum === position after load');
assert(perks.PERKS.every((d, i) => d.enum === i), 'perk .enum === position after load');
// Synthesized energy-item text scales with calcItemEnergyGain.
for (const [i, base] of energyItems) {
    const def = items.ITEMS[i];
    const gain = sim.calcItemEnergyGain(base);
    assert(def.getTooltip().includes(`Gives ${gain} `), `items[${i}] synthesized tooltip mentions gain ${gain}`);
    assert(def.getEffectText(2).includes(`${2 * gain} `), `items[${i}] synthesized effect text scales`);
}
if (failures === 0) ok('vanilla dataset ≡ native tables (incl. prestige, roles, economy, derived maps)');

// ---- 3. Save keying
const expectedSlot = `incrementalGameSave_substrate__${dataset.dataset_id}`;
assert(sim.getSaveLocation() === expectedSlot,
    `save slot must be ${expectedSlot}, got ${sim.getSaveLocation()}`);
if (failures === 0) ok(`save slot keyed by dataset (${expectedSlot})`);

// ---- 4. Idempotency: same dataset_id is a no-op
{
    const before = game.GAMESTATE;
    const res = win.loadGameData(clone());
    assert(res.ok === true, 'repeat load must succeed');
    assert(game.GAMESTATE === before, 'repeat load must not re-initialize (GAMESTATE identity)');
}
if (failures === 0) ok('repeat load of the same dataset_id is a no-op');

// ---- 5. The re-initialized game plays
{
    win.initializeHeadless();
    const G = game.GAMESTATE;
    assert(G.tasks.length > 0, 'fresh init built zone tasks');
    const firstTask = G.tasks.find((t) => t.enabled && t.reps < t.task_definition.max_reps);
    const started = win.performTask(firstTask.task_definition.id);
    assert(started.success === true, `performTask started (${JSON.stringify(started)})`);
    let completed = false;
    for (let i = 0; i < 500; i += 1) {
        win.stepTick();
        if (G.tasks.some((t) => t.reps > 0)) completed = true;
    }
    assert(completed, 'a task completed under stepTick');
    assert(G.current_energy < 100, `energy drained (${G.current_energy})`);
    // Food-pattern consumption grants energy through calcItemEnergyGain.
    const [foodIndex, foodBase] = [...energyItems.entries()][0];
    const energyBefore = G.current_energy;
    items.ITEMS[foodIndex].applyEffects(1);
    assert(G.current_energy === energyBefore + sim.calcItemEnergyGain(foodBase),
        'energy_on_consume grants calcItemEnergyGain(base)');
}
if (failures === 0) ok('re-initialized game runs: task completion, energy drain, item consumption');

// ---- 6. RAW MODE (5g): rejects, effective equivalence, mode reset
const rawDataset = JSON.parse(fs.readFileSync(rawFixturePath, 'utf8'));
{
    // Broken raw documents are rejected (raw completeness is validated).
    const rawClone = () => JSON.parse(JSON.stringify(rawDataset));
    const rawBrokenCases = [
        ['missing raw_cost', (d) => { delete d.zones[0].tasks[0].raw_cost; }],
        ['missing raw_xp', (d) => { delete d.zones[2].tasks[1].raw_xp; }],
        ['missing raw_drain', (d) => { delete d.zones[1].raw_drain; }],
        ['bad value_mode', (d) => { d.economy.value_mode = 'raw-ish'; }],
        ['missing zone_speedup_base', (d) => { delete d.economy.zone_speedup_base; }],
    ];
    for (const [name, mutate] of rawBrokenCases) {
        const broken = rawClone();
        broken.dataset_id = `broken-raw-${name}`;
        mutate(broken);
        const res = win.loadGameData(broken);
        assert(res.ok === false, `raw ${name}: must be rejected`);
    }
    if (failures === 0) ok(`${rawBrokenCases.length} broken raw datasets rejected`);

    // The raw fixture loads and reproduces native effective values EXACTLY.
    const res = win.loadGameData(rawDataset);
    assert(res.ok === true, `raw fixture must load: ${JSON.stringify(res.errors ?? [])}`);
    assert(sim.ECONOMY.value_mode === 'raw', 'ECONOMY.value_mode flips to raw');
    assert(sim.getSaveLocation() === `incrementalGameSave_substrate__${rawDataset.dataset_id}`,
        'raw save slot keyed by the raw dataset id');
    win.initializeHeadless();
    const rawEffective = effectiveSnapshot();
    {
        const diffs = diffSnapshots(nativeEffective, rawEffective);
        assert(diffs.length === 0,
            `raw effective values must equal native BIT-EXACTLY: ${diffs.join('; ')}`);
    }
    if (failures === 0) ok('raw fixture ≡ native effective values (cost/XP/drain/progress, bit-exact)');

    // Runtime-synthesized tasks fall back to the formula backbone in raw mode.
    {
        const G = game.GAMESTATE;
        const inject = win.injectSyntheticTask?.(
            { id: 10001, name: 'raw-mode exit probe', costMultiplier: 2, free: true },
            () => {});
        assert(inject?.success === true, 'synthetic task injects under raw mode');
        const synth = G.tasks.find((t) => t.task_definition.id === 10001);
        const expected = rawDataset.economy.base_task_cost * 2
            * Math.pow(rawDataset.economy.zone_cost_exponent, synth.task_definition.zone_id);
        assert(sim.calcTaskCost(synth) === expected,
            `synthetic task uses the formula fallback (got ${sim.calcTaskCost(synth)}, want ${expected})`);
        assert(sim.calcEnergyDrainPerTick(synth, false) === 0, 'free synthetic task still drains 0');
        win.clearSyntheticTasks?.();
    }
    if (failures === 0) ok('raw mode: runtime-synthesized tasks fall back to the formula backbone');

    // Loading a formula dataset afterwards RESETS the mode.
    const back = win.loadGameData(clone());
    assert(back.ok === true, 'formula fixture reloads after raw');
    assert(sim.ECONOMY.value_mode === 'zone_formula', 'value_mode resets to zone_formula');
    if (failures === 0) ok('formula load after raw resets value_mode');
}

if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
}
console.log('\nAll dataset-load smoke checks passed.');
process.exit(0);
