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

/** The bridge's debug surface (window property, set by bridge.js). */
export function bridgeState() {
    return getOmsiIframe()?.contentWindow?.__omsiBridge?.getDebugState?.() ?? null;
}

export function isBridgeClockRunning() {
    return getOmsiIframe()?.contentWindow?.__omsiBridge?.isClockRunning?.() === true;
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
 */
export function moveToRegion(targetRegion, sourceRegion = null) {
    window.eventDispatcher?.publish('test', 'user:regionMove', {
        sourceRegion,
        targetRegion,
        exitName: null,
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
 * Poll until fn() is truthy or timeout; thin wrapper so tests read as
 * one-liners for "eventually" assertions on host state.
 */
export function eventually(testController, fn, label, timeoutMs = 8000, intervalMs = 200) {
    return testController.pollForCondition(fn, label, timeoutMs, intervalMs);
}
