/**
 * ⚖ Robert 2026-11-09, "Honour it everywhere" (slice sdc-depletion-flag):
 * `gameState.noManaDepletionReset` holds in every room type that charges the
 * shared pool, with loop mode OFF — the maze's per-tile charge, the JtA and
 * omsi mirrored drains, and the text adventure wrapper's move charge. Before
 * the slice, `chargeMana` reported depletion at `mana <= 0` whatever the flag,
 * and each of these legs reset on it; only the loops' own resets read the flag.
 *
 * Each row plays the real room: it empties the pool through the room's own
 * charge, once with the flag SET (no loop reset: the pool runs negative, or
 * sits at 0 for a mirror whose game floors at 0) and once with it CLEAR (the
 * loop reset fires as before — the control that proves the charge really
 * reached depletion, so the flag-set half is not vacuous).
 *
 * JtA and omsi can also ask for a reset THEMSELVES when their own run ends
 * (`substrate:resourceReset`): that is the game's run end, not a pool
 * depletion, and the flag does not suppress it. These rows count those
 * requests separately and report them.
 */

import { registerTest } from '../testRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import {
    OMSI_TEST_PRESET_PATH,
    OMSI_TEST_REGION,
    OMSI_TEST_MAZE_REGION,
    waitForOmsiActive,
    omsiClearQueue,
    omsiAddMana,
    readManaLeft,
    moveToRegion,
    readPool,
    readLoopResetCount,
    readCurrentRegion,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';
import {
    JTA_TEST_PRESET_PATH,
    JTA_TEST_REGION,
    JTA_TEST_START_REGION,
    waitForJtaActive,
} from '../../jtaSubstrateWrapper/test-helpers.js';

const JTA_MIXED_PRESET_PATH = './presets/jta_mixed_test/AP_1/AP_1_rules.json';
const TA_REGION = 'AdventureZone';
const TA_EXIT_TARGET = 'JtaZone1';
const SETTLE_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Loop mode OFF for the row; the flag restored afterwards. */
function withLoopOffAndFlag(gs) {
    const saved = gs.noManaDepletionReset;
    gs.setLoopModeActive(false);
    return () => {
        gs.noManaDepletionReset = saved;
        gs.setLoopModeActive(false);
    };
}

/**
 * Leave loop mode the way the app does. These presets carry `loop_costs`, so
 * the loops module auto-enters loop mode after the load (asynchronously); wait
 * for that to land, then disable it through the same `loops:setLoopMode` event.
 */
async function forceLoopModeOff(testController, gs) {
    await testController.pollForCondition(() => gs.isLoopModeActive === true,
        'loop mode auto-entered for a preset with loop_costs (or not)', 3000, 100).catch(() => false);
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false });
    return testController.pollForCondition(() => gs.isLoopModeActive !== true,
        'loop mode off', 5000, 100);
}

/** Count the game-side reset requests (a run that ended in the game itself). */
function watchGameResetRequests(testController) {
    const seen = { count: 0 };
    const unsub = testController.eventBus.subscribe('substrate:resourceReset', () => { seen.count += 1; });
    return { seen, stop: () => { try { unsub?.(); } catch { /* ignore */ } } };
}

function stepOneSafeTile(testController, panel) {
    const DIRS = [
        { key: 'ArrowRight', dx: 1, dy: 0 },
        { key: 'ArrowLeft', dx: -1, dy: 0 },
        { key: 'ArrowDown', dx: 0, dy: 1 },
        { key: 'ArrowUp', dx: 0, dy: -1 },
    ];
    const world = panel.world;
    const exitTiles = new Set([...world.exits.values()].map((e) => `${e.x},${e.y}`));
    for (const d of DIRS) {
        const pos = panel.state?.player_pos;
        if (!pos) return false;
        const key = `${pos.x + d.dx},${pos.y + d.dy}`;
        if (exitTiles.has(key)) continue;
        if (world.itemLocationNames?.has?.(key)) continue;
        panel._handleKeydown({ key: d.key, preventDefault: () => {} });
        const after = panel.state?.player_pos;
        if (after && (after.x !== pos.x || after.y !== pos.y)) {
            testController.log(`stepped ${d.key} to (${after.x},${after.y})`);
            return true;
        }
    }
    return false;
}

// ── Maze: the per-tile charge ────────────────────────────────────────────────

async function enterMaze(testController) {
    await testController.loadRulesFromFile(OMSI_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    await forceLoopModeOff(testController, getGameStateSingleton());
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    moveToRegion(OMSI_TEST_MAZE_REGION, null);
    return testController.pollForValue(() => {
        const p = getPanelInstance();
        return (p?.world && p.currentRegionId === OMSI_TEST_MAZE_REGION && p.state?.player_pos) ? p : null;
    }, `maze panel live in ${OMSI_TEST_MAZE_REGION}`, 15000, 250);
}

async function mazeHalf(testController, gs, flag) {
    const panel = await enterMaze(testController);
    testController.assertEqual(`[flag ${flag}] maze panel live`, true, !!panel);
    if (!panel) return false;
    testController.assertEqual(`[flag ${flag}] loop mode off`, false, gs.isLoopModeActive === true);
    gs.noManaDepletionReset = flag;
    gs.refillMana();
    gs.deductMana(gs.getCurrentMana() - 0.01); // one step from empty
    const resetsBefore = readLoopResetCount();
    const stepped = stepOneSafeTile(testController, panel);
    const resets = readLoopResetCount() - resetsBefore;
    // A reset teleports back to the arrival tile, which can be the tile the
    // step left — so a step that reset reads as "no move" to the position check.
    testController.assertEqual(`[flag ${flag}] took a maze step`, true, stepped || resets > 0);
    await sleep(500);
    testController.log(`[flag ${flag}] maze: pool=${readPool()} resets=${resets} region=${readCurrentRegion()}`);
    if (flag) {
        testController.assertEqual('[flag on] the step emptied the pool and ran it negative', true, readPool() < 0);
        testController.assertEqual('[flag on] no loop reset', 0, resets);
    } else {
        testController.assertEqual('[flag off] the step emptied the pool: one loop reset', 1, resets);
        testController.assertEqual('[flag off] the pool refilled', true, readPool() > 0);
    }
    return true;
}

async function mazeFlagHolds(testController) {
    const gs = getGameStateSingleton();
    const restore = withLoopOffAndFlag(gs);
    try {
        if (await mazeHalf(testController, gs, true)) await mazeHalf(testController, gs, false);
    } finally {
        restore();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mana-depletion-flag-maze',
    name: 'noManaDepletionReset holds in a maze room with loop mode off',
    description: 'A maze step that empties the pool with loop mode off: with the flag set the '
               + 'pool runs negative and no loop reset fires; with it clear the reset fires.',
    testFunction: mazeFlagHolds,
    category: 'Mana depletion flag',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ── JtA: the mirrored energy drain ───────────────────────────────────────────

async function jtaHalf(testController, gs, flag) {
    await testController.loadRulesFromFile(JTA_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    await forceLoopModeOff(testController, gs);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
    moveToRegion(JTA_TEST_REGION, JTA_TEST_START_REGION);
    const win = await waitForJtaActive(testController);
    testController.assertEqual(`[flag ${flag}] jta bridge active`, true, !!win);
    if (!win) return false;
    testController.assertEqual(`[flag ${flag}] loop mode off`, false, gs.isLoopModeActive === true);
    gs.noManaDepletionReset = flag;
    const resetsBefore = readLoopResetCount();
    const watch = watchGameResetRequests(testController);
    try {
        win.setEnergy(0); // the bridge mirrors the whole drain into the pool
        const drained = await eventually(testController,
            () => readPool() <= 0 || readLoopResetCount() > resetsBefore,
            `[flag ${flag}] the drain reached the pool`, 10000);
        testController.assertEqual(`[flag ${flag}] the drain reached the pool`, true, drained);
        await sleep(SETTLE_MS);
    } finally {
        watch.stop();
    }
    const resets = readLoopResetCount() - resetsBefore;
    testController.log(`[flag ${flag}] jta: pool=${readPool()} resets=${resets} `
        + `gameResetRequests=${watch.seen.count} region=${readCurrentRegion()}`);
    if (flag) {
        testController.assertEqual('[flag on] no reset from the pool drain (only game-side requests may reset)',
            watch.seen.count, resets);
    } else {
        testController.assertEqual('[flag off] the drain reset the loop', true, resets >= 1);
    }
    return true;
}

async function jtaFlagHolds(testController) {
    const gs = getGameStateSingleton();
    const restore = withLoopOffAndFlag(gs);
    try {
        if (await jtaHalf(testController, gs, true)) await jtaHalf(testController, gs, false);
    } finally {
        restore();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mana-depletion-flag-jta',
    name: 'noManaDepletionReset holds for a JtA drain with loop mode off',
    description: 'JtA energy drained to 0 with loop mode off: with the flag set the mirrored '
               + 'drain fires no loop reset (a reset the game itself requests is counted apart); '
               + 'with it clear the reset fires.',
    testFunction: jtaFlagHolds,
    category: 'Mana depletion flag',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ── omsi: the mirrored budget drain ──────────────────────────────────────────

async function omsiHalf(testController, gs, flag) {
    await testController.loadRulesFromFile(OMSI_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    await forceLoopModeOff(testController, gs);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);
    const win = await waitForOmsiActive(testController);
    testController.assertEqual(`[flag ${flag}] omsi bridge active`, true, !!win);
    if (!win) return false;
    omsiClearQueue();
    testController.assertEqual(`[flag ${flag}] loop mode off`, false, gs.isLoopModeActive === true);
    gs.noManaDepletionReset = flag;
    const resetsBefore = readLoopResetCount();
    const watch = watchGameResetRequests(testController);
    try {
        omsiAddMana(-readManaLeft());
        let drained = await eventually(testController,
            () => readPool() <= 0 || readLoopResetCount() > resetsBefore,
            `[flag ${flag}] the drain reached the pool`, 4000);
        if (!drained && readManaLeft() > 0.5) {
            // The cold-boot budget re-pin race (see omsi-out-of-mana-loop-reset).
            testController.log('first drain was clobbered — re-draining once');
            omsiAddMana(-readManaLeft());
            drained = await eventually(testController,
                () => readPool() <= 0 || readLoopResetCount() > resetsBefore,
                `[flag ${flag}] the drain reached the pool (2nd)`, 8000);
        }
        testController.assertEqual(`[flag ${flag}] the drain reached the pool`, true, drained);
        await sleep(SETTLE_MS);
    } finally {
        watch.stop();
    }
    const resets = readLoopResetCount() - resetsBefore;
    testController.log(`[flag ${flag}] omsi: pool=${readPool()} resets=${resets} `
        + `gameResetRequests=${watch.seen.count} region=${readCurrentRegion()}`);
    if (flag) {
        testController.assertEqual('[flag on] no reset from the pool drain (only game-side requests may reset)',
            watch.seen.count, resets);
    } else {
        testController.assertEqual('[flag off] the drain reset the loop', true, resets >= 1);
    }
    return true;
}

async function omsiFlagHolds(testController) {
    const gs = getGameStateSingleton();
    const restore = withLoopOffAndFlag(gs);
    try {
        if (await omsiHalf(testController, gs, true)) await omsiHalf(testController, gs, false);
    } finally {
        restore();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mana-depletion-flag-omsi',
    name: 'noManaDepletionReset holds for an omsi drain with loop mode off',
    description: 'The omsi budget zeroed with loop mode off: with the flag set the mirrored '
               + 'drain fires no loop reset (a reset the game itself requests is counted apart); '
               + 'with it clear the reset fires.',
    testFunction: omsiFlagHolds,
    category: 'Mana depletion flag',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ── Text adventure: the wrapper's move charge ────────────────────────────────

async function taHalf(testController, gs, flag) {
    await testController.loadRulesFromFile(JTA_MIXED_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    await forceLoopModeOff(testController, gs);
    moveToRegion(TA_REGION, null);
    const inRoom = await eventually(testController, () => readCurrentRegion() === TA_REGION,
        `[flag ${flag}] standing in ${TA_REGION}`, 10000);
    testController.assertEqual(`[flag ${flag}] standing in the text adventure room`, true, inRoom);
    if (!inRoom) return false;
    const info = (await import('../../../app/core/centralRegistry.js')).centralRegistry
        .getPublicFunction('procgenPlayer', 'getRegionInfo')?.(TA_REGION);
    testController.assertEqual(`[flag ${flag}] ${TA_REGION} is a mana-enabled text adventure room`,
        true, info?.substrate === 'text_adventure' && info?.manaEnabled === true);
    testController.assertEqual(`[flag ${flag}] loop mode off`, false, gs.isLoopModeActive === true);
    gs.noManaDepletionReset = flag;
    gs.refillMana();
    gs.deductMana(gs.getCurrentMana() - 0.01); // the move out empties it
    const resetsBefore = readLoopResetCount();
    // Read the pool AT the departure: mana.js charges the move inside its own
    // gameState:regionChanged handler, subscribed at module init (before this
    // one). The room's only exit leads into a JtA room, whose game may end its
    // own run on a negative pool afterwards — a game-side reset request,
    // counted apart, not this leg's.
    let atDeparture = null;
    const unsub = testController.eventBus.subscribe('gameState:regionChanged', (d) => {
        if (!atDeparture && d?.oldRegion === TA_REGION && !d?.fromReset) {
            atDeparture = { pool: readPool(), resets: readLoopResetCount() - resetsBefore };
        }
    });
    const watch = watchGameResetRequests(testController);
    try {
        moveToRegion(TA_EXIT_TARGET, TA_REGION);
        const departed = await eventually(testController, () => !!atDeparture,
            `[flag ${flag}] departed ${TA_REGION}`, 10000);
        testController.assertEqual(`[flag ${flag}] departed the room`, true, departed);
        await sleep(SETTLE_MS);
    } finally {
        try { unsub?.(); } catch { /* ignore */ }
        watch.stop();
    }
    if (!atDeparture) return false;
    testController.log(`[flag ${flag}] text adventure: at departure pool=${atDeparture.pool} `
        + `resets=${atDeparture.resets}; after settling pool=${readPool()} `
        + `resets=${readLoopResetCount() - resetsBefore} gameResetRequests=${watch.seen.count} `
        + `region=${readCurrentRegion()}`);
    if (flag) {
        testController.assertEqual('[flag on] the move emptied the pool and ran it negative', true, atDeparture.pool < 0);
        testController.assertEqual('[flag on] no loop reset from the move', 0, atDeparture.resets);
    } else {
        testController.assertEqual('[flag off] the move emptied the pool: one loop reset', 1, atDeparture.resets);
    }
    return true;
}

async function taFlagHolds(testController) {
    const gs = getGameStateSingleton();
    const restore = withLoopOffAndFlag(gs);
    try {
        if (await taHalf(testController, gs, true)) await taHalf(testController, gs, false);
    } finally {
        restore();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mana-depletion-flag-text-adventure',
    name: 'noManaDepletionReset holds in a text adventure room with loop mode off',
    description: 'Leaving a mana-enabled text adventure room with the pool nearly empty, loop '
               + 'mode off: with the flag set the pool runs negative and no loop reset fires; '
               + 'with it clear the reset fires.',
    testFunction: taFlagHolds,
    category: 'Mana depletion flag',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
