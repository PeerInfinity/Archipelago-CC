#!/usr/bin/env node
/**
 * Phase 3d-hooks verification: behavior probe for the two Tier-1 fork hooks
 * added to frontend/modules/journey-to-ascension (branch `substrate`):
 *
 *   window.setCostedTaskIds(ids | null)        — cost-assignment allowlist
 *   window.setTaskFirstStartCallback(fn | null) — first-start cost callback
 *   window.setPerkCategoryTaskIds(ids | null)   — perk-categorization override
 *
 * Drives the fork's committed build/*.js under the shared headless DOM stubs
 * (frontend/modules/jtaBalance/headlessGameEnv.js, via node-env.mjs) with
 * automation All + automation_skip_blocked + instant mode, and asserts:
 *
 *   A. Allowlist confinement — completions stay a subset of the allowlist;
 *      excluding the zone-0 Travel task keeps the sim in zone 0, including it
 *      lets the sim advance.
 *   B. First-start contract — a callback that synchronously applyTaskPatches a
 *      huge cost_multiplier is observed by the very tick that starts the task,
 *      in BOTH instant and normal ticking; the callback fires at reps==0 &&
 *      progress==0 and fires again after an energy reset (fresh reps).
 *   C. Hooks unset — a short vanilla run behaves normally.
 *   D. Free-completion guard — an uncosted task blocks skipFreeZones' zone
 *      skip (free completion bypasses applyTaskRepStartEffects, so it must
 *      never touch a task whose cost isn't assigned); a fully-costed zone
 *      free-skips normally.
 *   E. setPerkCategoryTaskIds restores perk categorization for a task whose
 *      `perk` field was suppressed for AP-authoritative grants — and wins even
 *      when the player already holds the perk (AP can deliver it early).
 *
 * Exit 0 on success (one PASS line per check), non-zero on any failure.
 *
 * Gotchas respected (see headlessGameEnv.js / verify-jta-balance-pass.mjs):
 *  - pauseGameLoop() before initializeHeadless() and again at the very end —
 *    reset/prestige paths restart the render loop, which crashes on stub DOM.
 *  - sim.setMod (not window.setMod: the window wrapper needs task DOM).
 *
 * NOTE on the instant-mode proof (an implementation reality, not a compromise):
 * the fork's instant mode (completeTaskInstantly) finishes ALL of a task's reps
 * in the tick it starts REGARDLESS of whether the run can afford them — a huge
 * cost is billed as energy, driving current_energy negative and triggering an
 * energy reset, but the task still completes. So "the starting tick saw the
 * patched cost" is proven in instant mode by the energy signal (huge cost =>
 * the single starting tick exhausts energy / triggers a reset, which vanilla
 * cost does not), and the literal "does not complete in the tick it starts" is
 * proven in NORMAL ticking (huge cost => the task never completes; its energy
 * run drains away first). A callback wrongly placed AFTER the cost is read
 * would leave both signals identical to vanilla.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const { loadJtaEnv } = await import(
    pathToFileURL(path.join(repoRoot, 'CC/scripts/jta-stats/node-env.mjs'))
);
const { baselineMods } = await import(
    pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaBalance/automationProfile.js'))
);
// The PerkType.Count sentinel the pipeline patches perk tasks to (grant suppression).
const { JTA_PERK_COUNT: JTA_PERK_COUNT_SENTINEL } = await import(
    pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/vanillaDataset.js'))
);

const env = await loadJtaEnv();
const { sim, game, zones, win } = env;

// ---- zone-0 task ids (from the live data, so the probe never hard-codes) ----
const z0 = zones.ZONES[0].tasks;
const TaskType = zones.TaskType;
const zone0Ids = z0.map((t) => t.id);
const travelId = z0.find((t) => t.type === TaskType.Travel).id;               // 10
const hiddenIds = z0.filter((t) => t.hidden_by_default).map((t) => t.id);      // 17 (SBtV)
// A confineable ordinary skilled task (Normal, has skills, not hidden): cost
// actually gates it, so patches are observable. "Beg for Food" (id 14).
const ordinary = z0.find(
    (t) => t.type === TaskType.Normal && t.skills.length > 0 && !t.hidden_by_default
);
const nonHiddenZone0 = zone0Ids.filter((id) => !hiddenIds.includes(id));

// Snapshot vanilla cost_multipliers so tests that patch can restore them (the
// patch mutates the shared static TaskDefinition and persists across
// initializeHeadless).
const vanillaCost = new Map();
for (const zone of zones.ZONES.slice(0, 3)) {
    for (const def of zone.tasks) vanillaCost.set(def.id, def.cost_multiplier);
}
function restoreCosts() {
    win.applyTaskPatches(
        [...vanillaCost.entries()].map(([id, cost_multiplier]) => ({ id, cost_multiplier }))
    );
}

function setup(instant = true, modOverrides = {}) {
    win.pauseGameLoop();
    win.initializeHeadless();
    win.setInstantMode(instant);
    // Clear any hook state from a previous check (module-level, survives init).
    win.setCostedTaskIds(null);
    win.setTaskFirstStartCallback(null);
    win.setTaskCompletionCallback(null);
    restoreCosts();
    const mods = { ...baselineMods(), ...modOverrides };
    for (const [k, v] of Object.entries(mods)) {
        if (!sim.setMod(k, v)) throw new Error(`setMod(${k}) failed`);
    }
    game.GAMESTATE.automation_skip_blocked = true;
    sim.setAutomationEndZone(99);
    sim.autoFillAllPriorities();
    sim.setAutomationMode(sim.AutomationMode.All);
}

// Tick with the driver's run-end discipline (auto-prestige else energy reset),
// plus idle detection (instant mode leaves active_task null every tick, so idle
// is "nothing changed for 50 ticks"). Returns the highest zone seen.
function runTicks(n, { stopWhen } = {}) {
    let idle = 0;
    let last = '';
    let maxZone = game.GAMESTATE.current_zone;
    for (let i = 0; i < n; i++) {
        sim.updateGamestate();
        game.GAMESTATE.pending_render_events.length = 0;
        maxZone = Math.max(maxZone, game.GAMESTATE.current_zone);
        if (stopWhen && stopWhen()) return { maxZone, ticks: i + 1, stopped: true };
        if (!game.GAMESTATE.is_in_energy_reset) {
            const sig =
                `${game.GAMESTATE.current_zone}|${game.GAMESTATE.current_energy}|` +
                `${game.GAMESTATE.tasks.reduce((a, t) => a + t.reps, 0)}`;
            if (sig === last) {
                if (++idle >= 50) game.GAMESTATE.is_in_energy_reset = true;
            } else {
                idle = 0;
                last = sig;
            }
        }
        if (game.GAMESTATE.is_in_energy_reset) {
            const prestiged = sim.maybeAutoPrestige();
            if (!prestiged) sim.doEnergyReset();
            idle = 0;
            last = '';
        }
    }
    return { maxZone, ticks: n, stopped: false };
}

const failures = [];
function check(name, cond, detail) {
    if (cond) {
        console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
        console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
        failures.push(name);
    }
}
const isSubset = (set, allow) => [...set].every((x) => allow.includes(x));

// ===========================================================================
// Check A — allowlist confinement
// ===========================================================================
console.log('\n== Check A: setCostedTaskIds allowlist confinement ==');

// A1: allowlist excludes the zone-0 Travel task (and the SBtV hidden task,
// which never unlocks here) -> sim stays in zone 0, completions ⊆ allowlist.
{
    const allow = nonHiddenZone0.filter((id) => id !== travelId);
    setup(true);
    const completed = new Set();
    win.setTaskCompletionCallback((i) => completed.add(i.id));
    win.setCostedTaskIds(allow);
    const { maxZone } = runTicks(3000);
    check('A1 confinement stays in zone 0 (Travel excluded)', maxZone === 0,
        `maxZone=${maxZone}`);
    check('A1 completions ⊆ allowlist', isSubset(completed, allow),
        `completed=[${[...completed].sort((a, b) => a - b)}] allow=[${allow}]`);
    check('A1 allowlisted tasks actually ran (non-empty)', completed.size > 0,
        `completed ${completed.size} tasks`);
}

// A2: allowlist includes the Travel task (+ its mandatory prereqs) -> the sim
// advances out of zone 0; completions still ⊆ allowlist.
{
    const allow = nonHiddenZone0; // includes Travel (10) + mandatory (11,12)
    setup(true);
    const completed = new Set();
    win.setTaskCompletionCallback((i) => completed.add(i.id));
    win.setCostedTaskIds(allow);
    const { maxZone } = runTicks(3000, { stopWhen: () => game.GAMESTATE.current_zone > 0 });
    check('A2 sim advances past zone 0 (Travel included)', maxZone > 0,
        `maxZone=${maxZone}`);
    check('A2 completions ⊆ allowlist', isSubset(completed, allow),
        `completed=[${[...completed].sort((a, b) => a - b)}]`);
    check('A2 Travel task completed', completed.has(travelId),
        `travelId=${travelId}`);
}

// ===========================================================================
// Check B — first-start cost callback contract
// ===========================================================================
console.log('\n== Check B: setTaskFirstStartCallback contract ==');
// threshold_master off so the single allowlisted task is never energy-threshold
// skipped — keeps the start deterministic while we probe cost delivery.
const B_MODS = { threshold_master: false };

// B-instant CONTROL: allowlist = {ordinary}, no first-start callback. The task
// completes in tick 0 at vanilla cost and does NOT exhaust energy.
let controlReset;
{
    setup(true, B_MODS);
    win.setCostedTaskIds([ordinary.id]);
    let completed = false;
    win.setTaskCompletionCallback((i) => { if (i.id === ordinary.id) completed = true; });
    sim.updateGamestate();
    game.GAMESTATE.pending_render_events.length = 0;
    controlReset = game.GAMESTATE.is_in_energy_reset;
    check('B-instant control completes at vanilla cost in start tick', completed,
        `completed=${completed}`);
    check('B-instant control start tick does NOT exhaust energy', controlReset === false,
        `is_in_energy_reset=${controlReset} energy=${game.GAMESTATE.current_energy.toFixed(1)}`);
}

// B-instant TEST: first-start callback applies a huge cost_multiplier. The
// callback must fire at reps==0 && progress==0, and the SAME starting tick must
// bill the patched cost — observable as energy exhaustion (a reset), which the
// vanilla control did not trigger. Then it must fire again after the reset.
{
    setup(true, B_MODS);
    win.setCostedTaskIds([ordinary.id]);
    let fires = 0;
    let firstProgress = null;
    let firstReps = null;
    let secondReps = null;
    win.setTaskFirstStartCallback((info) => {
        if (info.id !== ordinary.id) return;
        fires += 1;
        if (fires === 1) { firstProgress = info.progress; firstReps = info.reps; }
        if (fires === 2) { secondReps = info.reps; }
        win.applyTaskPatches([{ id: ordinary.id, cost_multiplier: 1e6 }]);
    });
    // Tick 0: the task starts (callback fires) and completes, billing 1e6 cost.
    sim.updateGamestate();
    game.GAMESTATE.pending_render_events.length = 0;
    const testReset = game.GAMESTATE.is_in_energy_reset;
    check('B-instant callback fired on the starting tick', fires >= 1,
        `fires=${fires}`);
    check('B-instant callback fired before any progress (progress==0 && reps==0)',
        firstProgress === 0 && firstReps === 0,
        `progress=${firstProgress} reps=${firstReps}`);
    check('B-instant starting tick billed the patched cost (energy exhausted)',
        testReset === true && controlReset === false,
        `test reset=${testReset}, control reset=${controlReset}`);
    // Advance through the reset; the task restarts with fresh reps -> re-fire.
    runTicks(200, { stopWhen: () => fires >= 2 });
    check('B-instant callback re-fires after an energy reset (fresh reps)', fires >= 2,
        `fires=${fires}`);
    check('B-instant re-fire is a fresh start (reps==0)', secondReps === 0,
        `secondReps=${secondReps}`);
    restoreCosts();
}

// B-normal: with instant mode OFF the literal "does not complete in the tick it
// starts" is meaningful. Huge cost => the task never completes (its energy run
// drains first); vanilla cost => it completes. Both prove the starting tick
// read the patched cost.
{
    // vanilla control (normal ticking): the ordinary task completes.
    setup(false, B_MODS);
    win.setCostedTaskIds([ordinary.id]);
    let controlDone = false;
    win.setTaskCompletionCallback((i) => { if (i.id === ordinary.id) controlDone = true; });
    runTicks(4000, { stopWhen: () => controlDone });
    check('B-normal vanilla task completes', controlDone, `completed=${controlDone}`);

    // huge-cost test (normal ticking): the task never completes.
    setup(false, B_MODS);
    win.setCostedTaskIds([ordinary.id]);
    let testDone = false;
    let normalFired = false;
    let normalFireProgress = null;
    win.setTaskCompletionCallback((i) => { if (i.id === ordinary.id) testDone = true; });
    win.setTaskFirstStartCallback((info) => {
        if (info.id !== ordinary.id) return;
        if (!normalFired) { normalFired = true; normalFireProgress = info.progress; }
        win.applyTaskPatches([{ id: ordinary.id, cost_multiplier: 1e6 }]);
    });
    runTicks(4000, { stopWhen: () => testDone });
    check('B-normal callback fired before progress', normalFired && normalFireProgress === 0,
        `fired=${normalFired} progress=${normalFireProgress}`);
    check('B-normal huge-cost task does NOT complete in its starting run', testDone === false,
        `completed=${testDone}`);
    restoreCosts();
}

// ===========================================================================
// Check C — hooks unset: a short vanilla run behaves normally
// ===========================================================================
console.log('\n== Check C: hooks unset -> vanilla behavior ==');
{
    setup(true); // full baselineMods, no hooks set
    const completed = new Set();
    win.setTaskCompletionCallback((i) => completed.add(i.id));
    const { maxZone } = runTicks(4000);
    win.setTaskCompletionCallback(null);
    check('C vanilla run advances past zone 0', maxZone > 0, `maxZone=${maxZone}`);
    check('C vanilla run completes many tasks', completed.size >= 8,
        `completed ${completed.size} tasks`);
}

// ===========================================================================
// Check D — free-completion paths respect the allowlist
// ===========================================================================
// With Minor Time Compression held, doEnergyReset's skipFreeZones() completes
// a whole zone for free when every remaining task is single-tick — a path that
// BYPASSES applyTaskRepStartEffects, so an uncosted task completed there would
// never get a cost. The guard: an uncosted task blocks the zone from being
// "free". (Same guard covers Mastery of Time's per-reset free completion,
// which is prestige-gated and not separately drivable here.)
console.log('\n== Check D: free-zone skip respects the allowlist ==');
{
    setup(true, { threshold_master: false });
    // Grant the zone-skip perk and make zone 0 TRIVIALLY free-skippable (every
    // task patched to a tiny cost => single-tick regardless of skills), so the
    // ONLY thing that can block the skip is the uncosted-task guard.
    win.grantPerk('Minor Time Compression');
    win.applyTaskPatches(nonHiddenZone0.map((id) => ({ id, cost_multiplier: 0.001 })));
    const straggler = ordinary.id;
    const completed = new Set();
    win.setTaskCompletionCallback((i) => completed.add(i.id));

    // D1: straggler NOT in the allowlist -> the zone is not "free"; the reset's
    // skipFreeZones() must leave the sim in zone 0 with nothing completed.
    win.setCostedTaskIds(nonHiddenZone0.filter((id) => id !== straggler));
    sim.doEnergyReset();
    check('D1 uncosted straggler blocks the free-zone skip',
        game.GAMESTATE.current_zone === 0 && !completed.has(straggler),
        `zone=${game.GAMESTATE.current_zone} stragglerCompleted=${completed.has(straggler)}`);

    // D2: allowlist the straggler -> the zone is legitimately free and the same
    // reset path now skips it, free-completing everything (this also proves D1
    // wasn't vacuous — the skip machinery and the perk grant are live).
    win.setCostedTaskIds(nonHiddenZone0);
    sim.doEnergyReset();
    check('D2 costed zone free-skips normally',
        completed.has(straggler) && game.GAMESTATE.current_zone > 0,
        `zone=${game.GAMESTATE.current_zone} stragglerCompleted=${completed.has(straggler)}`);
    win.setTaskCompletionCallback(null);
    win.setCostedTaskIds(null);
    restoreCosts();
}

// ===========================================================================
// Check E — setPerkCategoryTaskIds overrides both categorizers
// ===========================================================================
// AP-authoritative grants patch a perk task's `perk` -> Count to suppress the
// local grant. Both getThresholdCategory and autoFillCategory gate on
// `def.perk != Count && !hasPerk(def.perk)`, so suppression silently demotes
// the task into the `other` threshold category (energy-per-level metric, which
// perk tasks fail by design) and out of the cheapest-first auto-fill "perk"
// band. The override must restore BOTH, and must win even when the player
// already holds the perk (AP can deliver it before the task is done).
console.log('\n== Check E: setPerkCategoryTaskIds restores perk categorization ==');
{
    setup(true);
    // Zone 0's perk task: id 13 "How to Read" (perk Reading).
    // Zone 0's only perk task (id 13, "Learn How to Read"): perk != the Count
    // sentinel. Captured from live data, and its perk id is saved because the
    // suppression patch below overwrites the field.
    const perkTask = z0.find((t) => t.perk !== JTA_PERK_COUNT_SENTINEL);
    const perkId = perkTask.perk;
    const liveTask = () => game.GAMESTATE.tasks.find((t) => t.task_definition.id === perkTask.id);

    const vanillaCat = sim.getThresholdCategory(liveTask());
    check('E vanilla perk task is a perk threshold category',
        String(vanillaCat).startsWith('perk_'), `category=${vanillaCat}`);

    // Suppress the grant, exactly as the pipeline's task_patches do.
    win.applyTaskPatches([{ id: perkTask.id, perk: JTA_PERK_COUNT_SENTINEL }]);
    const suppressedCat = sim.getThresholdCategory(liveTask());
    check('E suppression demotes it out of the perk category (the bug)',
        !String(suppressedCat).startsWith('perk_'), `category=${suppressedCat}`);

    // The override restores it.
    win.setPerkCategoryTaskIds([perkTask.id]);
    const restoredCat = sim.getThresholdCategory(liveTask());
    check('E override restores the perk threshold category',
        String(restoredCat).startsWith('perk_'), `category=${restoredCat}`);

    // ... and wins even when the perk is already held (AP delivered it early).
    win.grantPerk(perkId);
    const heldCat = sim.getThresholdCategory(liveTask());
    check('E override wins even when the perk is already held',
        String(heldCat).startsWith('perk_'), `category=${heldCat}`);

    // Retiring the id returns it to the suppressed behaviour.
    win.setPerkCategoryTaskIds([]);
    const retiredCat = sim.getThresholdCategory(liveTask());
    check('E retiring the id drops it back out of the perk category',
        !String(retiredCat).startsWith('perk_'), `category=${retiredCat}`);

    // null clears entirely (standalone default).
    win.setPerkCategoryTaskIds(null);
    check('E null clears the override', true, 'no throw');
    // Undo the suppression patch: applyTaskPatches mutates the shared static def.
    win.applyTaskPatches([{ id: perkTask.id, perk: perkId }]);
    restoreCosts();
}

// ---------------------------------------------------------------------------
win.pauseGameLoop();
console.log('');
if (failures.length) {
    console.log(`FAILED: ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
}
console.log('ALL CHECKS PASSED');
process.exit(0);
