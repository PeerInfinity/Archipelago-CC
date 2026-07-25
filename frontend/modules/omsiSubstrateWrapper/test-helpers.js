/**
 * Test helpers for the omsi substrate wrapper — the module-owned
 * testability surface (frontend/modules/tests/README.md §4). Imported
 * by frontend/modules/tests/testCases/omsiSubstrateWrapperTests.js.
 *
 * All helpers work against the live wrapper panel (iframe class
 * `omsisw-iframe`) and the omsi_substrate_test preset (2 maze regions
 * + 1 omsi Beginnersville region, manaEnabled sidecars, loop_costs
 * embedded; regenerate with
 * scripts/test/generate-omsi-substrate-test-preset.mjs).
 *
 * Engine access goes through the iframe's own eval (`omsiEval`): the
 * fork's engine surface (IdleLoopsManaged, actions, …) consists of
 * top-level `const`s of classic scripts — global LEXICAL bindings that
 * are not window properties, so `win.IdleLoopsManaged` is undefined
 * while eval'd code in the iframe realm resolves them fine. Same-origin
 * iframe, so eval is available; this keeps test-only hooks out of the
 * production bridge.
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';

export const OMSI_TEST_PRESET_PATH =
    './presets/omsi_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
export const OMSI_TEST_REGION = 'region_1_1';       // the omsi region (town 0)
export const OMSI_TEST_MAZE_REGION = 'region_0_0';  // a maze region to stand in / leave to
export const OMSI_TEST_START_REGION = 'Menu';
export const OMSI_TEST_VICTORY_LOCATION = 'region_1_1__start_journey';
// The omsi region's one graph exit, and where it leads. The three AP-test
// fixtures (substrate / randomized / scaled) share this topology, and the
// parked-Manual helper queues this hop as the block's departure.
export const OMSI_TEST_EXIT = 'exit_N';
export const OMSI_TEST_EXIT_TARGET = 'region_1_0';

// AP-V1 unlock randomization fixture (regenerate with
// scripts/test/generate-omsi-randomized-test-preset.mjs): the same
// 2-maze + 1-omsi world, but the omsi region carries town 0's full
// 90-location discovery pool plus `travel_onward` holding 'Victory'.
export const OMSI_RANDOMIZED_PRESET_PATH =
    './presets/omsi_randomized_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
export const OMSI_RANDOMIZED_VICTORY_LOCATION = 'region_1_1__travel_onward';

// arc A scaled fixture (regenerate with
// scripts/test/generate-omsi-scaled-test-preset.mjs): the same world at
// unlockScale 0.2, so town 0 thins to 18 supply locations at evenly-
// spaced Explore steps (Pots at 5,10,…,50; the AP-check percentages
// MOVE). Same omsi region id (region_1_1) as the other omsi fixtures.
export const OMSI_SCALED_PRESET_PATH =
    './presets/omsi_scaled_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
export const OMSI_SCALED_VICTORY_LOCATION = 'region_1_1__travel_onward';

// arc C region-split fixture (regenerate with
// scripts/test/generate-omsi-region-split-test-preset.mjs): one maze start +
// TWO omsi regions, both town 0 (r1 is a clone of r0 — the omsi substrate is
// single-zone). Each carries a `world.omsiRegion` overlay descriptor with a
// low Explore gate on 'Wander' and a directional exit to the other. Entering
// one swaps its per-region value props live, so the round-trip (r0 explore ->
// exit -> r1 fresh -> return -> r0 restored) exercises the managed-only region
// machinery the byte-gate can't witness.
export const OMSI_REGION_SPLIT_PRESET_PATH =
    './presets/omsi_region_split_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
// The two omsi zones the region-split fixture emits (deterministic, seed 1).
// Both are overlays of town 0; the synthetic exit-action names are DERIVED
// from the spiral's exit geometry, so the leg reads them off the bridge's
// syntheticExits debug field rather than hard-coding a label.
export const OMSI_REGION_SPLIT_R0 = 'region_0_1';
export const OMSI_REGION_SPLIT_R1 = 'region_1_0';
// The direct graph edge between the two split zones, both ways. These are
// the GRAPH exit names the synthetic exit actions dispatch (the action's own
// label differs) — the parked-Manual helper queues the round trip with them.
export const OMSI_REGION_SPLIT_R0_TO_R1 = 'exit_to_region_1_0';
export const OMSI_REGION_SPLIT_R1_TO_R0 = 'exit_to_region_0_1';
// The fixture's maze START region and its edge into r0.
//
// `start_regions` is `Menu`, which is not in the warehouse, so
// procgenPlayerEngine's findStartRegion follows Menu's `GameStart` exit and
// the RESOLVED start — i.e. what a loop reset teleports to — is region_0_0.
// That makes it the only region a multi-run replay can be re-driven from:
// after every reset the player lands here, and `exit_0` is the way back in.
export const OMSI_REGION_SPLIT_MAZE = 'region_0_0';
export const OMSI_REGION_SPLIT_MAZE_TO_R0 = 'exit_0';

// The game's native per-loop budget (timeNeededInitial = 5 * 50) — the
// starting-budget bonus the bridge reports up to the shared pool.
export const OMSI_NATIVE_BUDGET = 250;

export function getOmsiIframe() {
    return document.querySelector('iframe.omsisw-iframe');
}

/** Evaluate an expression in the omsi iframe realm (see header). */
export function omsiEval(code) {
    const win = getOmsiIframe()?.contentWindow;
    if (!win) throw new Error('omsi iframe not mounted');
    return win.eval(code);
}

/** The game's remaining loop budget (timeNeeded - timer). */
export function readManaLeft() {
    return omsiEval('IdleLoopsManaged.getFullState().timeNeeded - IdleLoopsManaged.getFullState().timer');
}

/** Signed budget adjustment through the game's own addMana hook. */
export function omsiAddMana(amount) {
    return omsiEval(`IdleLoopsManaged.addMana(${Number(amount)})`);
}

/** Queue an action on the game's plan (e.g. 'Wander'). */
export function omsiQueueAction(name, loops) {
    return omsiEval(`actions.addAction(${JSON.stringify(name)}, ${Number(loops)})`);
}

/** Clear the game's plan. */
export function omsiClearQueue() {
    return omsiEval('actions.next.splice(0, actions.next.length)');
}

/**
 * Append one entry to the END of the game's plan, order-preserving.
 *
 * `addAction` puts the entry wherever the game's options say and re-homes it to
 * the closest town-valid index; the per-region-queue leg needs a plan whose
 * ORDER it authored, so it uses the same `(-1, false)` call the save restore and
 * the bridge's region-queue restore both make.
 */
export function omsiAppendAction(name, loops, disabled = false) {
    return omsiEval(`actions.addActionRecord({ name: ${JSON.stringify(name)}, `
        + `loops: ${Number(loops)}, disabled: ${!!disabled}, loopsType: 'actions' }, -1, false)`);
}

/**
 * The game's plan as a plain comparable list — the witness for the per-region
 * queue swap (`actions.next` is the layer slice 3 changes; the fork's own
 * progress counters are NOT a witness of anything here).
 */
export function omsiReadQueue() {
    return JSON.parse(omsiEval(
        'JSON.stringify(actions.next.map((e) => '
        + '({ name: e.name, loops: e.loops, disabled: !!e.disabled })))'));
}

/** The bridge's debug surface (window property, set by bridge.js). */
export function bridgeState() {
    return getOmsiIframe()?.contentWindow?.__omsiBridge?.getDebugState?.() ?? null;
}

export function isBridgeClockRunning() {
    return getOmsiIframe()?.contentWindow?.__omsiBridge?.isClockRunning?.() === true;
}

/**
 * Count `user:locationCheck` publishes matching a location.
 *
 * `match` is either an exact location NAME (string) or a PREDICATE
 * `(locationName) => boolean` — the arc-A scaled leg passes a predicate
 * to count every `q_0_Pots_*` check at once, proving only the SELECTED
 * steps fire (not the intermediate rows the full pool would).
 *
 * The host dispatcher is publish-only — it has no `subscribe` — so the
 * only way to observe a dispatch is to wrap `publish`. This matters:
 * the tests that assert a check was NOT re-reported are vacuous if the
 * watcher silently observes nothing, so this THROWS rather than
 * degrading when the dispatcher isn't patchable, and callers should
 * assert a positive count before trusting a zero one.
 *
 * The iframe path lands here too: the bridge's publishEventDispatcher
 * is forwarded by iframeAdapterCore into this same dispatcher.
 */
export function watchLocationChecks(match) {
    const dispatcher = window.eventDispatcher;
    if (!dispatcher || typeof dispatcher.publish !== 'function') {
        throw new Error('watchLocationChecks: window.eventDispatcher.publish unavailable — '
            + 'a silent watcher would make "not re-reported" assertions vacuous');
    }
    const matchFn = typeof match === 'function' ? match : (name) => name === match;
    const original = dispatcher.publish.bind(dispatcher);
    let count = 0;
    dispatcher.publish = (originModuleId, eventName, data, options) => {
        if (eventName === 'user:locationCheck' && matchFn(data?.locationName)) {
            count += 1;
        }
        return original(originModuleId, eventName, data, options);
    };
    return {
        get count() { return count; },
        stop() { dispatcher.publish = original; return count; },
    };
}

/**
 * Fold every `user:regionMove` publish into a list — the crossing counterpart
 * of watchLocationChecks, and for the same reason it wraps `publish`: the host
 * dispatcher has no `subscribe`.
 *
 * FOLDING rather than polling the current region is load-bearing for anything
 * that watches an omsi crossing. An omsi loop ends the moment its queue is
 * spent, which is one tick after a departure exit fires — so the fork reports
 * a run end, the host answers with a loop reset, and its teleport moves the
 * player to the loop start. "Current region is the target" is therefore a
 * TRANSIENT that a 100ms poller can sail straight past; the move event is not.
 *
 * The payload is captured, so a caller can assert on `exitName` and on the
 * `fromLoop` stamp — the flag that decides whether the strict action gate lets
 * a replay's departure through at all.
 */
export function watchRegionMoves() {
    const dispatcher = window.eventDispatcher;
    if (!dispatcher || typeof dispatcher.publish !== 'function') {
        throw new Error('watchRegionMoves: window.eventDispatcher.publish unavailable — '
            + 'a silent watcher would make every crossing assertion vacuous');
    }
    const original = dispatcher.publish.bind(dispatcher);
    const moves = [];
    dispatcher.publish = (originModuleId, eventName, data, options) => {
        if (eventName === 'user:regionMove') moves.push({ ...data });
        return original(originModuleId, eventName, data, options);
    };
    return {
        get moves() { return moves; },
        stop() { dispatcher.publish = original; return moves; },
    };
}

/**
 * Park a Manual (or Record) loops block on each hop's SOURCE region, so the
 * substrate's live actions — AP location checks, and exit crossings that
 * carry a real exit name — pass the M3b strict action gate on the
 * `parkedLivePlay` exemption.
 *
 * Arc D1 opts omsi into that gate (loopSupport declares record + playback),
 * and every omsi preset carries loop_costs → loop mode auto-enables. The
 * bridge's `user:locationCheck` publishes carry no fromLoop during LIVE play
 * (correctly — only a replay is queue execution), so with no parked block
 * the gate blocks them and the AP award never propagates. These tests verify
 * AP integration, not loop economy, so the honest post-gate shape is
 * parked-Manual live play (user ruling 2026-07-23) — park, then drive the
 * engine in place through the same hooks the tests already use.
 *
 * `hops` is the path to queue, IN ORDER: `[{ from, to, exit }]`. One hop is
 * enough to park on `from` (the queued departure defines the block); a
 * multi-hop path parks each source block in turn as the previous crossing
 * completes — that is how a round trip through synthetic exits stays legal.
 * A hop may carry its own `mode`, overriding the argument for that source
 * only: the multi-run replay leg needs the maze approach block Manual (so
 * the leg can walk it) while r0's block is Playback (the thing under test),
 * and one mode for every source cannot express that.
 * omsi is FINE-GRAINED (the registry supplies takeLastRecording), so loops
 * charges nothing for this play: the bridge's mana mirror is the economy.
 *
 * The existing path is CLEARED first (gameState.clearPath, not loops'
 * clearQueue — that one teleports the player to the loop start). The tests
 * put the player in the region with a synthetic exit-less move, which loop
 * mode does not record in the path, so whatever the path holds is the
 * procgen start hop: replaying it from index 0 would walk the player out of
 * the region before ever reaching our block. Clearing makes the first hop's
 * source block the one the queue parks on immediately.
 *
 * Returns a restore handle (with the resolved block instances), or null if
 * loop mode is off (gate inactive — no parking needed) or the queue never
 * parked. Mirrors jta's parkManualBlockInRegion.
 */
export async function parkManualBlocks(testController, hops, mode = 'manual') {
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive !== true) {
        testController.log('loop mode inactive — no parked block needed');
        return null;
    }
    const loopStateSingleton = (await import('../loops/loopStateSingleton.js')).default;
    const { resolveQueueBlocks } = await import('../loops/blockIdentity.js');

    gs.clearPath?.();
    for (const hop of hops) gs.updatePath(hop.to, hop.exit ?? null, hop.from);
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue());
    const modeFor = new Map(hops.map((h) => [h.from, h.mode ?? mode]));
    const sources = new Set(hops.map((h) => h.from));
    const instances = new Map();
    for (const visit of visits) {
        if (!sources.has(visit.name)) continue;
        loopStateSingleton.setBlockMode(visit.name, visit.instance, modeFor.get(visit.name));
        instances.set(visit.name, visit.instance);
    }
    if (instances.size !== sources.size) {
        testController.log(`could not resolve a queue block for every hop source `
            + `(${[...sources].join(', ')})`);
        return null;
    }
    const savedSpeed = loopStateSingleton.gameSpeed;
    loopStateSingleton.setGameSpeed(10000);   // hurry any arrival move to the park
    loopStateSingleton.startProcessing();
    const parked = await testController.pollForCondition(
        () => loopStateSingleton._manualActionEntered === true,
        `queue parked on the ${mode} block in ${hops[0].from}`,
        8000, 100);
    if (!parked) {
        testController.log(`queue did not park on the ${mode} block in ${hops[0].from}`);
        return null;
    }
    return { loopStateSingleton, savedSpeed, gs, instances };
}

/**
 * Undo parkManualBlocks: restore the queue speed and leave loop mode off so
 * the active flag can't leak into a later test's non-loop preset. (Direct
 * gameState write — the requiresLoopMode guard rail lives in
 * eventCoordinator and governs USER-initiated disables.)
 */
export function unparkManualBlocks(handle) {
    if (!handle) return;
    try { handle.loopStateSingleton.setGameSpeed(handle.savedSpeed); } catch { /* best-effort */ }
    try { handle.gs.setLoopModeActive(false); } catch { /* best-effort */ }
}

export function gameStateFn(name) {
    return centralRegistry.getPublicFunction?.('gameState', name);
}

export function readPool() {
    return gameStateFn('getCurrentMana')?.() ?? null;
}

export function readMaxPool() {
    return gameStateFn('getMaxMana')?.() ?? null;
}

export function readLoopResetCount() {
    return gameStateFn('getLoopResetCount')?.() ?? null;
}

export function readCurrentRegion() {
    return gameStateFn('getCurrentRegion')?.() ?? null;
}

/** The omsi entry of gameState's per-substrate max-mana accumulator. */
export function readOmsiBudgetBonus() {
    return getGameStateSingleton()?._substrateBonuses?.get?.('omsi') ?? null;
}

/**
 * The region a loop reset teleports to — same resolution the
 * resourceChannels helper uses (procgenPlayer's resolved start,
 * falling back to the rules' first start region).
 */
export function readExpectedResetTarget() {
    const fn = centralRegistry.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion');
    const resolved = fn?.() ?? null;
    if (resolved) return resolved;
    return getGameStateSingleton()?.startRegions?.[0] ?? OMSI_TEST_START_REGION;
}

/**
 * Dispatch a user:regionMove via the raw host dispatcher with
 * initialTarget bottom, mirroring what a real substrate transition
 * publishes (same helper shape as the jta/tasw tests).
 *
 * `exitName` defaults to null — an exit-LESS reposition, which the strict
 * action gate waves through as `syntheticMove`. Passing a real exit name
 * makes the dispatch a PERFORMED player crossing instead, subject to the
 * gate exactly like a substrate's own publish: it needs the queue parked on
 * the source region (`parkedLivePlay`). That is what the multi-run replay
 * leg uses to model "the player walked back" after a reset teleport.
 */
export function moveToRegion(targetRegion, sourceRegion = null, exitName = null) {
    window.eventDispatcher?.publish('test', 'user:regionMove', {
        sourceRegion,
        targetRegion,
        exitName,
    }, { initialTarget: 'bottom' });
}

/**
 * Wait until the wrapper iframe is mounted, the game is in managed
 * mode, the bridge announced itself (__omsiBridge), and its clock is
 * running — running clock ⇔ omsi region entry fully processed.
 * Returns the iframe's contentWindow, or null on timeout.
 */
export async function waitForOmsiActive(testController, timeoutMs = 20000) {
    let win = null;
    const ok = await testController.pollForCondition(
        () => {
            const iframe = getOmsiIframe();
            if (!iframe?.contentWindow) return false;
            const w = iframe.contentWindow;
            if (!w.__omsiBridge) return false;
            if (!w.__omsiBridge.isClockRunning()) return false;
            win = w;
            return true;
        },
        'omsi iframe active (bridge clock running)',
        timeoutMs,
        250,
    );
    return ok ? win : null;
}

/**
 * Wait for the bridge to exist WITHOUT requiring an active region.
 *
 * waitForOmsiActive gates on the clock, which only runs once an omsi
 * region is entered — but a test that needs to normalize persistent
 * engine state must do so BEFORE entering. Returns the contentWindow
 * or null.
 */
export async function waitForOmsiBridge(testController, timeoutMs = 20000) {
    let win = null;
    const ok = await testController.pollForCondition(
        () => {
            const w = getOmsiIframe()?.contentWindow;
            if (!w?.__omsiBridge) return false;
            win = w;
            return true;
        },
        'omsi bridge present (iframe booted)',
        timeoutMs,
        250,
    );
    return ok ? win : null;
}

/**
 * Normalize the persistent engine state the unlock tests depend on.
 *
 * The managed game lives in its own `idleLoops_substrate` save slot and
 * OUTLIVES individual tests — every test in a suite run shares one
 * booted iframe. So town unlocks and town progress leak forward: the
 * v0 victory test's `unlockTown(1)` would otherwise pre-satisfy a later
 * victory assertion, and accumulated Wander progress would pre-fire
 * unlock rows. Reset the specific dims each test sets up, through the
 * engine's own state, then recompute totals.
 */
export function resetOmsiEngineProgress(progressVars = ['Wander']) {
    const assignments = progressVars
        .map((v) => `towns[0].exp${v} = 0;`)
        .join(' ');
    return omsiEval(`
        townsUnlocked.splice(0, townsUnlocked.length, 0);
        ${assignments}
        adjustAll();
    `);
}

/**
 * Poll until fn() is truthy or timeout; thin wrapper so tests read as
 * one-liners for "eventually" assertions on host state.
 */
export function eventually(testController, fn, label, timeoutMs = 8000, intervalMs = 200) {
    return testController.pollForCondition(fn, label, timeoutMs, intervalMs);
}
