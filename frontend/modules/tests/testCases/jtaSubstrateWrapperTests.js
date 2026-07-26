/**
 * End-to-end tests for the JtA substrate wrapper — the file the tests
 * README has always pointed at, covering the loop-mode contract the
 * 2026-07-05 substrate-integration work implemented:
 *
 *   1. jta-out-of-mana-loop-reset — energy drain mirrors into the
 *      shared pool; pool depletion triggers a loop reset + teleport.
 *   2. jta-game-reset-triggers-loop-reset — a game-initiated energy
 *      reset (overlay click / threshold End Run / auto-continue,
 *      simulated via window.doEnergyReset) is reported by the bridge
 *      and answered with exactly ONE loop reset.
 *   3. jta-pause-resume-on-region-switch — strict clock ownership:
 *      entering a jta region resumes the game loop, leaving pauses it.
 *   4. jta-energy-mirrors-pool-both-ways — drains deduct the pool,
 *      gains (energy items etc., simulated via setEnergy upward) add
 *      to it.
 *
 * Plus the Phase-2 zone-randomization end-to-end:
 *   • jta-location-check-and-perk-grant — a perk-task completion is
 *     reported as an AP location check, the perk returns as a received
 *     AP item, and the perk is granted in-game with local grants
 *     suppressed (AP-authoritative). Loads the jta_locations_test preset
 *     (per-task AP locations + task_patches sidecars).
 *   • jta-prestige-perk-regrant — a prestige wipes every perk; an
 *     own-world perk comes back when the task holding it is re-run, a
 *     foreign one is restored by the bridge. Loads jta_prestige_test.
 *
 * The loop-mode tests load the jta_substrate_test preset (regions = JtA
 * zone names, manaEnabled sidecars, start region Menu); the zone-rando
 * tests load jta_locations_test / jta_prestige_test. All drive the REAL
 * iframe + bridge; game state is manipulated through the fork's window
 * hooks, exactly the surface the bridge itself uses.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { JTA_PERK_ITEM_NAMES } from '../../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import {
    JTA_TEST_PRESET_PATH,
    JTA_TEST_REGION,
    JTA_TEST_START_REGION,
    JTA_LOCTEST_PRESET_PATH,
    JTA_LOCTEST_REGION,
    JTA_LOCTEST_START_REGION,
    JTA_LOCTEST_PERK_LOCATION,
    JTA_LOCTEST_PERK_ITEM,
    JTA_LOCTEST_PERK_TASK_ID,
    waitForJtaActive,
    moveToRegion,
    resetJtaSaveAndReload,
    gameStateFn,
    readPool,
    readLoopResetCount,
    readCurrentRegion,
    readExpectedResetTarget,
    getJtaIframe,
    eventually,
    JTA_PRESTIGETEST_PRESET_PATH,
    JTA_PRESTIGETEST_REGION,
    JTA_PRESTIGETEST_START_REGION,
    JTA_PRESTIGETEST_OWN_TASK_ID,
    JTA_PRESTIGETEST_OWN_LOCATION,
    JTA_PRESTIGETEST_OWN_ITEM,
    JTA_PRESTIGETEST_FOREIGN_ITEM,
    JTA_PRESTIGE_TASK_ID,
    JTA_PRESTIGE_TASK_ZONE,
    readRegionExits,
} from '../../jtaSubstrateWrapper/test-helpers.js';

/** Ids at or above this are the bridge's injected synthetic exit tasks. */
const SYNTHETIC_EXIT_TASK_MIN = 10000;

/** True if the snapshot lists `name` among its checked locations. */
function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

/**
 * Park a Manual (or Record) loops block on `region` so the zone's live
 * actions (AP location checks from task completions, and the departing
 * exit crossing) pass the M3b strict action gate via the `parkedLivePlay`
 * exemption.
 *
 * M4 opts jta into the strict gate (loopSupport declares record+playback),
 * and jta presets carry loop_costs → loop mode auto-enables. A jta region's
 * task-completion `user:locationCheck` publishes carry no fromLoop
 * (bridge.js `_handleTaskCompleted`), so with no parked block the gate
 * blocks them (`notStarted`). These tests verify AP integration (perk
 * grants), NOT loop economy — the honest post-M3b shape of driving them is
 * parked-Manual LIVE PLAY (user ruling 2026-07-23): park a Manual block,
 * then drive the perk task to completion in-place (drains apply, one
 * economy). Mirrors mazeBlockModeTests' parked-live-drain setup, adapted to
 * jta's graph exit.
 *
 * `mode` selects the parked block's radio: 'manual' (default) for the
 * AP-integration tests, or 'record' for the M4 record→playback leg — both
 * park identically and both count as live play; Record additionally flags
 * the block so the successful-exit wake pulls and persists the substrate's
 * per-visit capture.
 *
 * Returns a restore handle (including the resolved block `instance`), or
 * null if loop mode is off (gate inactive — no parking needed) or the block
 * could not be parked.
 */
async function parkManualBlockInRegion(testController, region, targetRegion, exitId, mode = 'manual') {
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive !== true) {
        testController.log(`loop mode inactive — no parked block needed for ${region}`);
        return null;
    }
    const loopStateSingleton = (await import('../../loops/loopStateSingleton.js')).default;
    const { resolveQueueBlocks } = await import('../../loops/blockIdentity.js');

    // Queue a regionMove OUT of `region` — that defines the block loops
    // parks on (the maze precedent; the graph exit is the preset's exit_E).
    gs.updatePath(targetRegion, exitId, region);
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue());
    const visit = [...visits].reverse().find((v) => v.name === region);
    if (!visit) {
        testController.log(`could not resolve a queue block for ${region}`);
        return null;
    }
    loopStateSingleton.setBlockMode(region, visit.instance, mode);
    const savedSpeed = loopStateSingleton.gameSpeed;
    loopStateSingleton.setGameSpeed(10000); // hurry the arrival move to the park
    loopStateSingleton.startProcessing();
    const parked = await testController.pollForCondition(
        () => loopStateSingleton._manualActionEntered === true,
        `queue parked on the ${mode} block in ${region}`,
        8000, 100);
    if (!parked) {
        testController.log(`queue did not park on the ${mode} block in ${region}`);
        return null;
    }
    return { loopStateSingleton, savedSpeed, gs, instance: visit.instance };
}

/** Undo parkManualBlockInRegion: restore speed and leave loop mode off so
 *  the active flag can't leak into a later test's non-loop preset. */
function unparkManualBlock(handle) {
    if (!handle) return;
    try { handle.loopStateSingleton.setGameSpeed(handle.savedSpeed); } catch { /* best-effort */ }
    try { handle.gs.setLoopModeActive(false); } catch { /* best-effort */ }
}

/** Shared setup: load the preset, enter the jta region, wait for the bridge. */
async function enterJtaRegion(testController) {
    testController.log('Loading jta_substrate_test preset…');
    await testController.loadRulesFromFile(JTA_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    // Mount the wrapper panel; the host module also activates it on
    // jta:loadRegion, but the iframe must exist first.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'jtaSubstrateWrapperPanel',
    });

    testController.log(`Moving into jta region ${JTA_TEST_REGION}…`);
    moveToRegion(JTA_TEST_REGION, JTA_TEST_START_REGION);

    const win = await waitForJtaActive(testController);
    testController.reportCondition('jta bridge active in region', !!win);
    return win;
}

async function outOfManaLoopReset(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const resetsBefore = readLoopResetCount();
    const poolBefore = readPool();
    testController.log(`pool=${poolBefore}, loopResets=${resetsBefore}`);
    testController.assertEqual('pool starts above zero', true, poolBefore > 0);

    // Where the fromReset teleport should land — mode-dependent:
    // procgenPlayer may resolve the first substrate region ("The
    // Village") rather than the synthetic Menu.
    const resetTarget = readExpectedResetTarget();
    testController.log(`expected reset target: ${resetTarget}`);

    // Force the game's energy to 0. The bridge's poll reads this as a
    // full drain and mirrors it into the pool; the host's deduct
    // handler fires the loop reset at pool <= 0.
    win.setEnergy(0);

    const resetHappened = await eventually(
        testController,
        () => readLoopResetCount() === resetsBefore + 1,
        'loop reset fired after pool depletion',
        10000,
    );
    testController.assertEqual('exactly one loop reset fired', true, resetHappened);

    const teleported = await eventually(
        testController,
        () => readCurrentRegion() === resetTarget,
        `teleported to reset target ${resetTarget}`,
        8000,
    );
    testController.assertEqual('teleported to reset target', true, teleported);

    // Clock ownership after the reset: paused iff the reset target is
    // not the jta region we were standing in.
    if (resetTarget !== JTA_TEST_REGION) {
        const paused = await eventually(
            testController,
            () => getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === true,
            'game clock paused after leaving jta region',
            8000,
        );
        testController.assertEqual('game clock paused after teleport away', true, paused);
    } else {
        testController.log('reset target IS the jta region — clock stays running');
        testController.assertEqual(
            'game clock still running (reset landed in the same jta region)',
            false,
            win.isGameLoopPaused(),
        );
    }

    // Pool refilled by the loop reset.
    testController.assertEqual('pool refilled to max', true, readPool() > 0);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-out-of-mana-loop-reset',
    name: 'JtA: out-of-mana triggers loop reset and teleport',
    description: 'Drains JtA energy to 0 in a jta region; the bridge mirrors the '
               + 'drain into the shared pool, the host fires a loop reset at 0, the '
               + 'player teleports to the start region, and the game clock pauses.',
    testFunction: outOfManaLoopReset,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function gameResetTriggersLoopReset(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const resetsBefore = readLoopResetCount();
    const resetTarget = readExpectedResetTarget();
    testController.log(`expected reset target: ${resetTarget}`);

    // Simulate a game-initiated run end (energy-reset overlay click,
    // auto_continue_energy_reset, threshold End Run — all funnel into
    // doEnergyReset, whose end-of-reset callback the bridge registered).
    testController.log('Calling window.doEnergyReset() (game-initiated reset)…');
    win.doEnergyReset();

    const answered = await eventually(
        testController,
        () => readLoopResetCount() === resetsBefore + 1,
        'host answered with a loop reset',
        10000,
    );
    testController.assertEqual('host answered the game reset with a loop reset', true, answered);

    // Give the pipeline a beat, then confirm NO second reset arrived
    // (the bridge pre-counts the game's own reset, so the loop reset
    // must not be re-applied and re-reported in a cycle).
    await new Promise(r => setTimeout(r, 1500));
    testController.assertEqual(
        'exactly one loop reset (no echo loop)',
        resetsBefore + 1,
        readLoopResetCount(),
    );

    const teleported = await eventually(
        testController,
        () => readCurrentRegion() === resetTarget,
        `teleported to reset target ${resetTarget}`,
        8000,
    );
    testController.assertEqual('teleported to reset target', true, teleported);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-game-reset-triggers-loop-reset',
    name: 'JtA: game-initiated energy reset triggers exactly one loop reset',
    description: 'Calls the fork\'s doEnergyReset directly (standing in for the '
               + 'reset-overlay click / threshold End Run / Auto-Prestige); asserts '
               + 'the bridge reports it, the host fires exactly one loop reset, and '
               + 'the player teleports to the start region.',
    testFunction: gameResetTriggersLoopReset,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function pauseResumeOnRegionSwitch(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    testController.assertEqual(
        'game clock running while in jta region',
        false,
        win.isGameLoopPaused(),
    );

    testController.log(`Moving away to ${JTA_TEST_START_REGION}…`);
    moveToRegion(JTA_TEST_START_REGION, JTA_TEST_REGION);
    const pausedAway = await eventually(
        testController,
        () => win.isGameLoopPaused() === true,
        'game clock paused after moving away',
    );
    testController.assertEqual('game clock paused after moving away', true, pausedAway);

    testController.log(`Moving back into ${JTA_TEST_REGION}…`);
    moveToRegion(JTA_TEST_REGION, JTA_TEST_START_REGION);
    const resumed = await eventually(
        testController,
        () => win.isGameLoopPaused() === false,
        'game clock resumed after re-entry',
    );
    testController.assertEqual('game clock resumed after re-entry', true, resumed);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-pause-resume-on-region-switch',
    name: 'JtA: game clock pauses on region exit, resumes on entry',
    description: 'Strict clock ownership: asserts the game loop runs while the '
               + 'player stands in a jta region, pauses when they leave for a '
               + 'non-jta region, and resumes when they come back.',
    testFunction: pauseResumeOnRegionSwitch,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function energyMirrorsPoolBothWays(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const pool0 = readPool();
    const energy0 = win.getFullState().currentEnergy;
    testController.log(`pool=${pool0}, energy=${energy0}`);
    testController.assertEqual(
        'energy pinned to pool on entry',
        true,
        Math.abs(pool0 - energy0) < 0.5,
    );

    // Drain: drop energy by 10 → pool must follow down.
    win.setEnergy(energy0 - 10);
    const drained = await eventually(
        testController,
        () => Math.abs(readPool() - (pool0 - 10)) < 0.5,
        'pool followed a 10-point energy drain',
    );
    testController.assertEqual('pool followed the drain', true, drained);

    // Gain: raise energy by 5 (an energy item, in real play) → pool
    // must follow up (substrate:resourceDelta amount>0 → gameState.gainMana).
    const energy1 = win.getFullState().currentEnergy;
    win.setEnergy(energy1 + 5);
    const gained = await eventually(
        testController,
        () => Math.abs(readPool() - (pool0 - 5)) < 0.5,
        'pool followed a 5-point energy gain',
    );
    testController.assertEqual('pool followed the gain', true, gained);

    return testController.getOverallResult();
}

/**
 * Park a BOT block on `region` (M6). Sibling of parkManualBlockInRegion:
 * same queue shape — a regionMove OUT of the region defines the block — but
 * a Bot block does not park for hand-play, it hands the action to the
 * region's SOLVER. So the "we are engaged" signal is loops' bot park
 * (_botExecutedAction), not _manualActionEntered.
 *
 * Returns a restore handle, or null if loop mode is off / the block could
 * not be resolved. `instant` sets the block's Instant flag before the queue
 * starts, which the Bot dispatch turns into controller.instant(true).
 */
async function parkBotBlockInRegion(testController, region, targetRegion, exitId, { instant = true } = {}) {
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive !== true) {
        testController.log(`loop mode inactive — a Bot block needs it on`);
        return null;
    }
    const loopStateSingleton = (await import('../../loops/loopStateSingleton.js')).default;
    const { resolveQueueBlocks } = await import('../../loops/blockIdentity.js');

    gs.updatePath(targetRegion, exitId, region);
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue());
    const visit = [...visits].reverse().find((v) => v.name === region);
    if (!visit) {
        testController.log(`could not resolve a queue block for ${region}`);
        return null;
    }
    loopStateSingleton.setBlockMode(region, visit.instance, 'bot');
    loopStateSingleton.setBlockInstant(region, visit.instance, instant);
    const savedSpeed = loopStateSingleton.gameSpeed;
    const savedAutoRestart = loopStateSingleton.autoRestartQueue;
    // Auto-restart IS the retry: a depletion reset snaps the queue to index 0,
    // the earlier fromLoop move walks the player back, and the Bot branch
    // re-dispatches. Without it the queue would pause on the first reset.
    loopStateSingleton.autoRestartQueue = true;
    loopStateSingleton.setGameSpeed(10000); // hurry the arrival move to the block
    loopStateSingleton.startProcessing();
    const engaged = await testController.pollForCondition(
        () => loopStateSingleton._botExecutedAction !== null,
        `queue engaged the solver on the Bot block in ${region}`,
        8000, 100);
    if (!engaged) {
        testController.log(`the Bot block in ${region} never engaged its solver`);
        return null;
    }
    return {
        loopStateSingleton, savedSpeed, savedAutoRestart, gs, instance: visit.instance,
    };
}

/** Undo parkBotBlockInRegion. */
function unparkBotBlock(handle) {
    if (!handle) return;
    try { handle.loopStateSingleton.stopProcessing(); } catch { /* best-effort */ }
    try { handle.loopStateSingleton.setGameSpeed(handle.savedSpeed); } catch { /* best-effort */ }
    try { handle.loopStateSingleton.autoRestartQueue = handle.savedAutoRestart; } catch { /* best-effort */ }
    try { handle.gs.setLoopModeActive(false); } catch { /* best-effort */ }
}

/**
 * Wrap a live PlaybackController method so calls can be counted, and THROW
 * if the controller or the method is missing. A silent optional-chain here
 * would turn "the API vanished" into a green test with a zero count —
 * every count read below is only meaningful because this throws first.
 */
function spyOnController(controller, method, log) {
    if (!controller) throw new Error('jta PlaybackController is missing — nothing to observe');
    if (typeof controller[method] !== 'function') {
        throw new Error(`jta PlaybackController.${method} is missing — cannot observe the bot`);
    }
    const original = controller[method].bind(controller);
    const calls = [];
    controller[method] = (...args) => {
        calls.push(args.length === 1 ? args[0] : args);
        log?.(`controller.${method}(${JSON.stringify(args)})`);
        return original(...args);
    };
    return { calls, restore: () => { controller[method] = original; } };
}

async function botWalkToExit(testController) {
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    let win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();
    // Fresh game. The substrate save slot is SHARED across a suite run, so an
    // inherited part-played save makes this leg non-deterministic: the walk
    // stalls or finishes without ever outrunning a pool, depending on which
    // jta tests ran first. (Observed directly — one run in three stalled for
    // the full arrival timeout without it.) Same reason
    // jta-record-playback-crosses-zone-boundary resets the save.
    win = await resetJtaSaveAndReload(testController);
    testController.reportCondition('fresh jta game active after save reset', !!win);
    if (!win) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const loopOn = await testController.pollForCondition(
        () => gs.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)', 5000, 100);
    testController.assertEqual('loop mode active (auto-enabled by loop_costs)', true, !!loopOn);
    if (!loopOn) return testController.getOverallResult();

    const exit = readRegionExits(JTA_TEST_REGION)[0];
    testController.assertEqual(`${JTA_TEST_REGION} has a warehoused exit`, true, !!exit?.targetRegion);
    if (!exit?.targetRegion) return testController.getOverallResult();
    const exitId = exit.exit_id ?? exit.exitName;
    const targetRegion = exit.targetRegion;
    testController.log(`zone-0 exit '${exitId}' → '${targetRegion}'`);

    // Liveness-proven observation: these THROW if the API is gone, so the
    // counts below cannot silently read zero.
    const controller = substrateRegistry.get('jta')?.getPlaybackController?.();
    const walkToSpy = spyOnController(controller, 'walkTo', (m) => testController.log(m));
    const instantSpy = spyOnController(controller, 'instant', (m) => testController.log(m));

    // What the pre-M6 flat completion charge WOULD have deducted. Asserting
    // it is non-zero is what makes the "no flat charge" pin below meaningful:
    // if the preset priced this move at 0, "nothing was charged" would be
    // true for the wrong reason.
    const wouldBeFlatCharge = loopState._calculateActionCost({
        type: 'regionMove', sourceRegion: JTA_TEST_REGION, destinationRegion: targetRegion,
    });
    testController.assertEqual(
        'the loop_costs move cost is non-zero (so "no flat charge" is a real pin)',
        true, wouldBeFlatCharge > 0);
    testController.log(`a flat completion charge would have cost ${wouldBeFlatCharge} mana`);

    const xpBefore = loopState.getRegionXP(JTA_TEST_REGION).xp;
    const poolStart = readPool();
    const resetsBefore = readLoopResetCount();
    let park = null;
    // Track the pool's low-water mark from the mana EVENTS, not by polling:
    // under Instant the fork can drain a pool and have the reset refill it
    // between two 200ms samples, so a poller can miss every low value and
    // report "the pool never fell" while it was in fact hitting zero.
    let poolMin = poolStart;
    const onMana = () => { poolMin = Math.min(poolMin, readPool()); };
    testController.eventBus.subscribe('gameState:manaChanged', onMana);

    try {
        park = await parkBotBlockInRegion(
            testController, JTA_TEST_REGION, targetRegion, exitId, { instant: true });
        testController.assertEqual('a Bot block engaged the walkTo solver', true, !!park);
        if (!park) return testController.getOverallResult();

        // The Bot branch dispatched the walk, toward the queued exit.
        testController.assertEqual('loops dispatched walkTo', true, walkToSpy.calls.length >= 1);
        testController.assertEqual('walkTo targeted the queued exit', 'exit',
            walkToSpy.calls[0]?.kind);
        // Instant is set BOTH ways per block since M6; this block asked for it.
        testController.assertEqual('the Instant block set instant mode ON',
            true, instantSpy.calls[0] === true);
        // A bot is NOT live play — its events pass the gate on the
        // queueExecution exemption instead.
        testController.assertEqual('livePlayRegion is null while the solver drives',
            null, loopState.livePlayRegion());

        // ── The multi-reset retry, asserted as MACHINERY ────────────────
        // A full zone-0 walk at low skills costs more than one pool, so the
        // walk SPANS loop resets: the pool empties, the fork's energy reset
        // propagates to a host loop reset, skills persist, and the attempt
        // resumes cheaper until the zone completes inside one loop. Arrival
        // alone would not prove any of that ran.
        //
        // Which component retries is substrate-specific, and jta's is the
        // BRIDGE: it preserves _pendingWalkExit across the same-region reload
        // and re-arms automation for it (jta.md). loops' contribution is to
        // keep the block PARKED throughout — the propagated reset path
        // (gameState:loopReset → _resetActionsProgress) deliberately does not
        // tear the park down — which is what holds the queueExecution gate
        // exemption open so the resumed walk's events keep passing. The
        // queue-restart-and-re-dispatch retry is the OTHER path, the frame
        // loop's own OOM reset (unit-pinned in blockModes.test.js); asserting
        // it here would be asserting the wrong mechanism.
        let parkSurvivedReset = null;
        const sawReset = await testController.pollForCondition(() => {
            poolMin = Math.min(poolMin, readPool());
            if (readLoopResetCount() <= resetsBefore) return false;
            if (parkSurvivedReset === null) {
                parkSurvivedReset = loopState._botExecutedAction !== null;
            }
            return true;
        }, 'the bot walk outran one pool and the loop reset', 90000, 200);
        testController.assertEqual('the walk spanned at least one loop reset',
            true, !!sawReset);
        testController.assertEqual(
            'loops kept the block parked across the reset (the gate exemption stays open)',
            true, parkSurvivedReset === true);
        testController.log(`reset observed after ${walkToSpy.calls.length} walkTo dispatch(es)`);

        // ── Arrival through the real stack ──────────────────────────────
        // The retry above is proven; from here the walk is allowed to finish
        // cheaply. Topping the fork's energy makes the FINAL attempt land
        // inside ONE loop, which matters for leg 2: the bridge clears
        // _completedThisLoop on every gameState:loopReset, so a crossing that
        // races a reset leaves the zone un-completed and leg 2's synthetic
        // exit tasks are never injected. (poolMin is already sampled from the
        // un-topped phase, so the native-drain pin below still means what it
        // says.) Same technique as jta-record-playback-crosses-zone-boundary.
        const arrived = await testController.pollForCondition(() => {
            poolMin = Math.min(poolMin, readPool());
            const w = getJtaIframe()?.contentWindow;
            if (w?.isGameLoopPaused?.() === false) {
                w.setEnergy(1e9);
                pumpTicks(w, 50);
            }
            return readCurrentRegion() === targetRegion;
        }, `the bot crossed into '${targetRegion}'`, 180000, 200);
        testController.log(`pool: start=${poolStart} low-water=${poolMin}`);
        testController.assertEqual(
            'the bot crossed the zone boundary through the real dispatcher '
            + '(the bridge\'s fromLoop-less departure passes as queueExecution)',
            true, !!arrived);
        if (!arrived) return testController.getOverallResult();
        testController.log(`arrived after ${readLoopResetCount() - resetsBefore} loop reset(s) `
            + `and ${walkToSpy.calls.length} walkTo dispatch(es)`);

        // ── The zone was PLAYED, not teleported ─────────────────────────
        const ranTasks = (getJtaIframe()?.contentWindow?.getCurrentRunActions?.() ?? [])
            .some((a) => a?.type === 'task');
        testController.assertEqual('the fork actually ran tasks during the walk', true, ranTasks);

        // ── Economy: NATIVE ONLY, no flat charge on top ─────────────────
        // The pool fell because jta's energy drain mirrors into it...
        testController.assertEqual('the pool drained during the walk (native economy ran)',
            true, poolMin < poolStart);
        // ...and loops charged nothing for the completion. Every loops-side
        // spend awards region XP 1:1 (_spendMana), so unchanged region XP is
        // the signature of "loops did not bill this". A fine substrate's bot
        // completion must not be charged: the substrate already billed the
        // same play, and the pre-M6 flat charge double-billed it.
        testController.assertEqual(
            `loops added no completion charge on a FINE substrate `
            + `(region XP unchanged — a ${wouldBeFlatCharge}-mana flat charge would show here)`,
            xpBefore, loopState.getRegionXP(JTA_TEST_REGION).xp);
    } finally {
        try { testController.eventBus.unsubscribe('gameState:manaChanged', onMana); } catch { /* best-effort */ }
        walkToSpy.restore();
        instantSpy.restore();
        unparkBotBlock(park);
    }

    return testController.getOverallResult();
}


// zones.ts TaskType, as getAvailableTasks() reports it.
const JTA_TASK_TYPE_TRAVEL = 1;
// Synthetic (bridge-injected) task ids start here; the fork's own are lower.
const JTA_SYNTHETIC_TASK_ID_BASE = 10000;

/**
 * Play the loaded zone through to its Travel completion, the way every other
 * test in this file plays one: explicit performTask calls with energy topped
 * up (see completeTask above). Resolves true once the zone is played out or
 * the Travel completion carried us out of the region.
 *
 * Ticking alone plays NOTHING under the substrate host — managed zone play has
 * no automation unless something arms it (the bridge's _armWalkAutomation, on
 * a walk) — so a prep that only pumps ticks can never finish a zone.
 *
 * Travel goes LAST, and not just for tidiness: the fork keeps every Travel task
 * disabled while a Mandatory one is unfinished (updateEnabledTasks), and this
 * zone's single exit is item-gated on a perk that one of its own tasks awards,
 * so finishing everything else first is also what leaves the region traversable.
 */
async function playZoneToTravelCompletion(testController, win, label, timeoutMs = 60000) {
    return eventually(testController, () => {
        // The Travel completion dispatched a region move and it landed.
        if (readCurrentRegion() !== JTA_TEST_REGION) return true;
        if (win?.isGameLoopPaused?.() !== false) return false;
        win.setEnergy(1e9);
        const tasks = (win.getAvailableTasks?.() ?? [])
            .filter((t) => t.id < JTA_SYNTHETIC_TASK_ID_BASE);
        // Nothing of the fork's own left to run: the zone is played out.
        if (tasks.length === 0) return true;
        const next = tasks.find((t) => t.type !== JTA_TASK_TYPE_TRAVEL) ?? tasks[0];
        if (win.getFullState?.().activeTaskId !== next.id) win.performTask(next.id);
        pumpTicks(win, 50);
        return false;
    }, label, timeoutMs, 20);
}

/**
 * Synthetic exit-task id STABILITY across re-entries (user-reported
 * regression). The game's per-zone automation priorities reference task
 * ids, so a player who prioritizes "Go East" must find the same id live on
 * the next visit — and Auto-Prioritize's per-zone regen on entry must not
 * erase a manually prioritized exit task.
 *
 * Split out of jta-bot-walkto-exit in M6 slice 5.  It is NOT about the Bot
 * radio; it shares nothing with that test but the preset.
 */
async function syntheticExitTaskIdStability(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const exit = readRegionExits(JTA_TEST_REGION)[0];
    testController.assertEqual(`${JTA_TEST_REGION} has a warehoused exit`, true, !!exit?.targetRegion);
    if (!exit?.targetRegion) return testController.getOverallResult();
    const targetRegion = exit.targetRegion;

    const reEnter = async (label) => {
        moveToRegion(JTA_TEST_REGION, readCurrentRegion());
        return eventually(
            testController,
            () => readCurrentRegion() === JTA_TEST_REGION
                && getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === false,
            label,
            10000,
        );
    };

    // This test needs the zone marked COMPLETED-this-loop on re-entry: that is
    // what makes the bridge inject the synthetic exit tasks whose ids are under
    // test. Establish it here rather than inheriting it from a walk — complete
    // the zone once INSIDE one loop, with energy topped up so no reset can land
    // mid-play. A loop reset legitimately un-completes the zone (the fork's
    // doAnyReset wipes zone progress, and the bridge clears _completedThisLoop
    // on gameState:loopReset to match), which is what made the pre-split version
    // of this leg flaky — it inherited a completion from a reset-spanning walk.
    // That was the precondition being wrong, not the bridge; see jta.md.
    await reEnter('re-entered the zone to complete it cleanly');
    const played = await playZoneToTravelCompletion(
        testController,
        getJtaIframe()?.contentWindow,
        'prep: zone 0 played through its Travel task inside one loop',
    );
    testController.assertEqual('prep: zone 0 completed inside one loop', true, !!played);
    if (!played) return testController.getOverallResult();
    testController.log(`prep: zone play finished with the player in '${readCurrentRegion()}'`);

    await reEnter('re-entered completed region');
    const win2 = getJtaIframe()?.contentWindow;
    const exitIds = () => (win2?.getAvailableTasks?.() ?? [])
        .filter(t => t.id >= 10000).map(t => t.id);
    const idsFirst = exitIds();
    testController.assertEqual('exit tasks injected on completed re-entry', true, idsFirst.length > 0);

    // Prioritize the first exit task the way a player would — and turn
    // Auto-Prioritize ON (the user-reported regression: its per-zone
    // regen on entry erased manually prioritized exit tasks).
    win2.getGamestate.automation_prios.set(0, [idsFirst[0]]);
    win2.setMod('force_automation', true);
    win2.setMod('auto_prioritize', true);

    moveToRegion(targetRegion, JTA_TEST_REGION);
    await eventually(testController, () => readCurrentRegion() === targetRegion, 'left again', 8000);
    await reEnter('re-entered completed region again');
    const idsSecond = exitIds();
    testController.assertEqual(
        'same synthetic exit-task ids on every re-entry',
        JSON.stringify(idsFirst),
        JSON.stringify(idsSecond),
    );
    const prios = win2.getGamestate.automation_prios.get(0) ?? [];
    testController.assertEqual(
        'player priority survives Auto-Prioritize regen and references a live exit task',
        true,
        prios.includes(idsFirst[0]) && idsSecond.includes(idsFirst[0]),
    );
    testController.assertEqual(
        'preserved exit priority kept its front position',
        idsFirst[0],
        prios[0],
    );
    win2.setMod('auto_prioritize', false);
    win2.setMod('force_automation', false);

    // The reset semantics the pre-split version of this leg misread, pinned so
    // they stop being folklore: a loop reset genuinely un-plays the zone (the
    // fork's doAnyReset rebuilds it) and the bridge clears _completedThisLoop
    // to match, so the NEXT entry loads un-completed and injects nothing. That
    // is correct, not the bug it was recorded as for a month —
    // loadZone({completed:true}) grants every task for free, so honoring a
    // pre-reset completion here would hand back a zone the reset took away.
    const resetsBefore = readLoopResetCount();
    win2.doEnergyReset();
    const resetLanded = await eventually(
        testController,
        () => readLoopResetCount() === resetsBefore + 1,
        'the host answered with a loop reset',
        10000,
    );
    testController.assertEqual('a loop reset landed', true, resetLanded);
    await reEnter('re-entered after the loop reset');
    testController.assertEqual(
        'a loop reset un-completes the zone — no exit tasks injected on the next entry',
        0, exitIds().length);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-synthetic-exit-task-id-stability',
    name: 'JtA: synthetic exit-task ids stay stable across re-entries',
    description: 'Completes zone 0, re-enters, and asserts the bridge injects the same '
               + 'synthetic exit-task ids every time — and that a player-set priority on '
               + 'one survives Auto-Prioritize\'s per-zone regen (user-reported regression).',
    testFunction: syntheticExitTaskIdStability,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'jta-bot-walkto-exit',
    name: 'JtA: a Bot block drives the zone, retries across resets, and takes the exit',
    description: 'M6 end-to-end: a BOT-mode loops block on the zone-0 region hands the '
               + 'queued regionMove to the walkTo solver. Asserts loops dispatched walkTo, '
               + 'Instant was set for the block, the walk outran one pool and the '
               + 'parked-action retry RE-dispatched it after the loop reset, the boundary '
               + 'was crossed through the real dispatcher (the bridge\'s fromLoop-less '
               + 'departure passing as queueExecution), the fork really ran tasks, and the '
               + 'economy stayed NATIVE-only — no flat completion charge on a fine substrate.',
    testFunction: botWalkToExit,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


registerTest({
    id: 'jta-energy-mirrors-pool-both-ways',
    name: 'JtA: energy drains AND gains mirror into the shared pool',
    description: 'Moves JtA energy down then up via the fork\'s setEnergy hook and '
               + 'asserts the shared mana pool follows in both directions '
               + '(substrate:resourceDelta, signed).',
    testFunction: energyMirrorsPoolBothWays,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function startingEnergyBonusRaisesPool(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const getMaxMana = () => gameStateFn('getMaxMana')?.();
    const getJtaBonus = () => gameStateFn('getSubstrateMaxManaBonus')?.('jta') ?? 0;

    const BONUS_SETTING = 'moduleSettings.jtaSubstrateWrapper.energyBonusSync';
    const maxMana0 = getMaxMana();
    testController.log(`maxMana=${maxMana0}, jtaBonus=${getJtaBonus()}`);
    testController.assertEqual('jta bonus starts at 0', 0, getJtaBonus());

    try {
        // Enable the real setting: the host module's settings:changed handler
        // loads it and republishes initialState{energyBonusSync:true} through
        // its own relay path to the bridge (the production route — a direct
        // test publish of initialState is not relayed into the iframe).
        await settingsManager.updateSetting(BONUS_SETTING, true, { persist: false });

        // Force JtA's starting-energy-bonus accumulator (as Energetic Memory /
        // Divine Supremacy etc. would in real play). The bridge's poll reads it
        // off getFullState and reports it up via substrate:resourceBonus.
        win.getGamestate.jta_starting_energy_bonus = 50;

        const applied = await eventually(
            testController,
            () => getJtaBonus() === 50,
            'jta starting-energy bonus (50) reported to the shared pool',
            6000,
        );
        testController.assertEqual('bridge reported the bonus to gameState', true, applied);
        testController.assertEqual('maxMana rose by the bonus', maxMana0 + 50, getMaxMana());

        // Turn it back off: the host module zeroes JtA's pool contribution on
        // settings:changed when the setting is off.
        await settingsManager.updateSetting(BONUS_SETTING, false, { persist: false });
        const cleared = await eventually(
            testController,
            () => getJtaBonus() === 0,
            'jta bonus cleared when bonus-sync turned off',
            6000,
        );
        testController.assertEqual('bonus cleared on flag-off', true, cleared);
        testController.assertEqual('maxMana returned to baseline', maxMana0, getMaxMana());
    } finally {
        // Don't leak the session override into other tests.
        await settingsManager.clearOverride(BONUS_SETTING);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-starting-energy-bonus-raises-pool',
    name: 'JtA: starting-energy bonus raises the shared pool when bonus-sync is on',
    description: 'With energyBonusSync on, forces JtA\'s starting-energy-bonus '
               + 'accumulator and asserts the bridge reports it up so the shared '
               + 'maxMana rises by the bonus (setSubstrateMaxManaBonus); turning '
               + 'the flag off clears JtA\'s contribution again.',
    testFunction: startingEnergyBonusRaisesPool,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/**
 * Phase-2 zone-randomization end-to-end: complete a perk-task → the
 * bridge reports the AP location check → the AP round-trip grants the
 * perk item → the perk is present in-game. Also asserts grants are
 * AP-authoritative (local grants suppressed via task_patches), so every
 * perk the game holds arrived as a received AP item.
 *
 * Loads the jta_locations_test preset (identity placement:
 * region_0_0__13 holds 'How to Read'), enters zone 0, and drives the
 * zone with the game's own automation in Instant Mode with abundant
 * energy (no loop resets needed). Assertions key on the DURABLE checked
 * state / global perk set, so they don't race the automation possibly
 * advancing past zone 0.
 */
async function locationCheckAndPerkGrant(testController) {
    testController.log('Loading jta_locations_test preset…');
    await testController.loadRulesFromFile(JTA_LOCTEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'jtaSubstrateWrapperPanel',
    });

    testController.log(`Moving into jta region ${JTA_LOCTEST_REGION}…`);
    moveToRegion(JTA_LOCTEST_REGION, JTA_LOCTEST_START_REGION);
    const win = await waitForJtaActive(testController);
    testController.reportCondition('jta bridge active in zone-0 region', !!win);
    if (!win) return testController.getOverallResult();

    // Fresh game: the JtA substrate boots from a SHARED save slot
    // (incrementalGameSave_substrate), so perks/skills left by earlier
    // tests in this run would pollute the assertions. Clear the slot and
    // reload the iframe for a clean state; the bridge re-handshakes and
    // procgenPlayer re-publishes jta:loadRegion on iframe:appReady, so it
    // re-enters zone 0.
    try {
        getJtaIframe()?.contentWindow?.localStorage?.removeItem('incrementalGameSave_substrate');
    } catch { /* cross-origin guard — same-origin here, ignore */ }
    getJtaIframe()?.contentWindow?.location?.reload();
    const gameWin = await waitForJtaActive(testController);
    testController.reportCondition('fresh jta game active after save reset', !!gameWin);
    if (!gameWin) return testController.getOverallResult();

    // Baseline: fresh game holds no perks and the perk location is unchecked.
    const perksBefore = gameWin.getFullState().perks.length;
    testController.log(`fresh game perksBefore=${perksBefore}, zone=${gameWin.getFullState().currentZone}`);
    testController.assertEqual('fresh game holds no perks', 0, perksBefore);
    testController.assertEqual('perk location not yet checked', false,
        snapshotHasLocation(testController.stateManager.getSnapshot(), JTA_LOCTEST_PERK_LOCATION));

    // M4: jta now opts into the M3b strict action gate, and this preset's
    // loop_costs auto-enables loop mode — so the perk-task location check
    // needs a parked Manual block to pass (parked-Manual live play, user
    // ruling 2026-07-23; this test verifies AP integration, not loop
    // economy). Park the block, then complete the single zone-0 perk-task
    // (13 = How to Read) in-place via the fork — the player stays in the
    // region so the block stays parked while the check fires.
    const parkHandle = await parkManualBlockInRegion(
        testController, JTA_LOCTEST_REGION, 'region_1_0', 'exit_E');
    testController.assertEqual('parked a Manual block in the zone region', true, !!parkHandle);
    if (!parkHandle) return testController.getOverallResult();
    // Parking replayed the queue and reloaded the region — re-acquire the
    // (same) game window and keep drains from resetting mid-completion.
    const playWin = await waitForJtaActive(testController) ?? gameWin;
    const savedNoReset = parkHandle.gs.noManaDepletionReset;
    parkHandle.gs.noManaDepletionReset = true;
    try {
        const done = await completeTask(testController, playWin, JTA_LOCTEST_PERK_TASK_ID,
            `zone-0 perk task ${JTA_LOCTEST_PERK_TASK_ID} completed`);
        testController.assertEqual('zone-0 perk task completed', true, done);

        // Leg 1 — the perk-task completion is reported as an AP location check
        // (durable: stays checked once it lands).
        const checked = await eventually(testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), JTA_LOCTEST_PERK_LOCATION),
            `perk location ${JTA_LOCTEST_PERK_LOCATION} checked`, 30000, 500);
        testController.assertEqual('perk-task completion reported as an AP location check', true, checked);
    } finally {
        parkHandle.gs.noManaDepletionReset = savedNoReset;
        unparkManualBlock(parkHandle);
    }

    // Leg 2 — the AP round-trip delivers the perk item back.
    const gotItem = await eventually(testController,
        () => Number(testController.stateManager.getSnapshot()?.inventory?.[JTA_LOCTEST_PERK_ITEM] ?? 0) > 0,
        `received AP item '${JTA_LOCTEST_PERK_ITEM}'`, 12000, 300);
    testController.assertEqual('perk item received from AP', true, gotItem);

    // Leg 3 — the received item grants the perk in-game.
    const perkPresent = await eventually(testController,
        () => (getJtaIframe()?.contentWindow?.getFullState?.().perks?.length ?? 0) > perksBefore,
        'perk granted in-game via the AP item', 12000, 300);
    testController.assertEqual('perk present after AP round-trip', true, perkPresent);

    // AP-authoritative: local perk grants are suppressed (task_patches set
    // the perk-task's perk → Count), so every perk held arrived as a
    // received AP item. On a fresh game that means perks held == received
    // perk items — a leaked local grant would make perks EXCEED items.
    const inv = testController.stateManager.getSnapshot()?.inventory ?? {};
    const receivedPerkItems = JTA_PERK_ITEM_NAMES.filter((n) => Number(inv[n] ?? 0) > 0).length;
    const perksHeld = getJtaIframe()?.contentWindow?.getFullState?.().perks?.length ?? -1;
    testController.assertEqual(
        'perks held == perk items received (grants are AP-authoritative)',
        receivedPerkItems, perksHeld);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-location-check-and-perk-grant',
    name: 'JtA: task completion checks an AP location and the perk arrives as an AP item',
    description: 'Loads the Phase-2 jta_locations_test preset, plays zone 0 via the '
               + 'game\'s automation, and asserts the perk-task completion is reported '
               + 'as an AP location check, the perk returns as a received AP item, and '
               + 'the perk is granted in-game — with local grants suppressed so the '
               + 'perk count equals the received perk items (AP-authoritative).',
    testFunction: locationCheckAndPerkGrant,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ---------------------------------------------------------------------------
// Prestige grant semantics (2026-07-09)
// ---------------------------------------------------------------------------

/** Pump the fork's tick loop, but only while the region is live. */
function pumpTicks(win, count = 50) {
    if (typeof win?.stepTick !== 'function') return;
    if (win.isGameLoopPaused?.() !== false) return;
    for (let i = 0; i < count; i++) win.stepTick();
}

/** The set of perk TYPE ids the game currently holds. */
function heldPerks(win) {
    return new Set(win?.getFullState?.().perks ?? []);
}

/**
 * Run one task to full completion under NORMAL ticking (never Instant Mode,
 * which ignores GAMESTATE.repeat_tasks and so completes EVERY remaining rep at
 * once — fork 8383af0 fixed its affordability blindness, not that). Energy is
 * topped up as we go, so affordability is never the thing under test here.
 *
 * getAvailableTasks() filters out `reps >= max_reps`, so a task DROPPING OUT of
 * the list is what full completion looks like from here.
 */
async function completeTask(testController, win, taskId, label, timeoutMs = 20000) {
    const available = () => (win.getAvailableTasks?.() ?? []).some((t) => t.id === taskId);
    if (!available()) {
        testController.log(`task ${taskId} is not available to start`);
        return false;
    }
    return eventually(testController, () => {
        if (!available()) return true;
        win.setEnergy(1e9);
        if (win.getFullState?.().activeTaskId !== taskId) win.performTask(taskId);
        pumpTicks(win);
        return false;
    }, label, timeoutMs, 20);
}

/**
 * Perk grants survive a prestige, with the two origins behaving differently.
 *
 * doPrestige() sets every perk to false. Local grants are suppressed (the
 * sidecar's task_patches point each perk-task's `perk` at the Count sentinel)
 * and each AP item is received exactly once, so before the 2026-07-09 fix a
 * prestige cost the player every perk permanently — Phase-4 emergent
 * verification measured 2-5 of 130 AP locations stranded per prestiging seed.
 *
 * The ruled semantics, both legs asserted here:
 *   - an OWN-world perk (on one of our own locations) behaves like the vanilla
 *     perk it replaced: wiped by the prestige, re-granted the next time the
 *     task holding it completes. Its AP location stays checked throughout.
 *   - a FOREIGN perk has no task to re-run, so the bridge restores it as part
 *     of the prestige.
 *
 * Solo v1 worlds place all their perks at home, so the foreign leg needs a perk
 * that sits on no location of ours: jta_prestige_test puts one in
 * start_inventory, which is exactly the shape a perk found in another player's
 * world has from the bridge's side (an inventory entry with no own placement).
 *
 * Reaching a real prestige needs no fork hook — window.doPrestige doesn't
 * exist, but the game's own path does. Task 153 'Touch the Divine' is a
 * TaskType.Prestige task in zone 14: completing it sets prestige_available, and
 * then the auto-prestige wealth trigger (which fires on the first opportunity
 * while divine_spark is 0) turns the next energy depletion into a prestige via
 * updateGameOver -> maybeAutoPrestige. We load zone 14 directly and zero task
 * 153's cost rather than playing 14 zones to get there.
 */
async function prestigePerkRegrant(testController) {
    testController.log('Loading jta_prestige_test preset…');
    await testController.loadRulesFromFile(JTA_PRESTIGETEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
    moveToRegion(JTA_PRESTIGETEST_REGION, JTA_PRESTIGETEST_START_REGION);
    if (!await waitForJtaActive(testController)) {
        testController.reportCondition('jta bridge active in zone-0 region', false);
        return testController.getOverallResult();
    }

    // Fresh game — the substrate save slot is shared across the tests in a run.
    try {
        getJtaIframe()?.contentWindow?.localStorage?.removeItem('incrementalGameSave_substrate');
    } catch { /* same-origin here */ }
    getJtaIframe()?.contentWindow?.location?.reload();
    const win = await waitForJtaActive(testController);
    testController.reportCondition('fresh jta game active after save reset', !!win);
    if (!win) return testController.getOverallResult();

    // Leg 1 — the foreign perk arrives as a starting AP item and is granted.
    const invHasForeign = Number(
        testController.stateManager.getSnapshot()?.inventory?.[JTA_PRESTIGETEST_FOREIGN_ITEM] ?? 0) > 0;
    testController.assertEqual(`start_inventory holds the foreign perk '${JTA_PRESTIGETEST_FOREIGN_ITEM}'`,
        true, invHasForeign);
    const foreignGranted = await eventually(testController,
        () => heldPerks(win).size === 1, 'the foreign perk is granted from inventory', 15000, 200);
    testController.assertEqual('foreign perk granted on arrival', true, foreignGranted);
    if (!foreignGranted) return testController.getOverallResult();
    // Identify the perk types positionally: the only perk held now is the
    // foreign one; the one that appears next is task 13's own-world perk.
    const [foreignPerk] = [...heldPerks(win)];

    // M4: task-13's location check (leg 2) needs a parked Manual block to
    // pass the strict gate (parked-Manual live play; this leg verifies AP
    // integration, not loop economy — user ruling 2026-07-23). Legs 3–5
    // exercise the reset/prestige machinery, which already runs under loop
    // mode, so park only for leg 2 and let leg 3's energy-reset teleport
    // clear the block via the mana-wake reset.
    const prestigePark = await parkManualBlockInRegion(
        testController, JTA_PRESTIGETEST_REGION, 'region_1_0', 'exit_E');
    testController.assertEqual('parked a Manual block for the leg-2 location check', true, !!prestigePark);
    if (!prestigePark) return testController.getOverallResult();
    const savedPrestigeNoReset = prestigePark.gs.noManaDepletionReset;
    prestigePark.gs.noManaDepletionReset = true;

    // Leg 2 — completing task 13 checks its AP location and grants its perk.
    const ownDone = await completeTask(testController, win, JTA_PRESTIGETEST_OWN_TASK_ID,
        `task ${JTA_PRESTIGETEST_OWN_TASK_ID} completed`);
    testController.assertEqual('own-world perk task completed', true, ownDone);
    const ownGranted = await eventually(testController,
        () => heldPerks(win).size === 2, 'the own-world perk is granted', 15000, 200);
    testController.assertEqual('own-world perk granted on task completion', true, ownGranted);
    if (!ownGranted) return testController.getOverallResult();
    const ownPerk = [...heldPerks(win)].find((p) => p !== foreignPerk);
    const checkedAfterOwn = await eventually(testController,
        () => snapshotHasLocation(testController.stateManager.getSnapshot(), JTA_PRESTIGETEST_OWN_LOCATION),
        `${JTA_PRESTIGETEST_OWN_LOCATION} checked`, 15000, 250);
    testController.assertEqual('own perk task checked its AP location', true, checkedAfterOwn);
    const gotOwnItem = await eventually(testController,
        () => Number(testController.stateManager.getSnapshot()?.inventory?.[JTA_PRESTIGETEST_OWN_ITEM] ?? 0) > 0,
        `received AP item '${JTA_PRESTIGETEST_OWN_ITEM}'`, 15000, 250);
    testController.assertEqual('own perk returned as a received AP item', true, gotOwnItem);

    // Restore reset behavior so leg 3's energy depletion teleports as
    // designed (and clears the parked block via the mana-wake reset).
    prestigePark.gs.noManaDepletionReset = savedPrestigeNoReset;

    // Leg 3 — reach a real prestige. Complete the zone-14 Prestige task (cost
    // zeroed, so normal ticking finishes it), then let the wealth trigger turn
    // the next depletion into a prestige instead of an energy reset.
    win.loadZone(JTA_PRESTIGE_TASK_ZONE);
    win.applyTaskPatches([{ id: JTA_PRESTIGE_TASK_ID, cost_multiplier: 0, max_reps: 1 }]);
    const prestigeTaskDone = await completeTask(testController, win, JTA_PRESTIGE_TASK_ID,
        `zone-14 Prestige task ${JTA_PRESTIGE_TASK_ID} completed`);
    testController.assertEqual('Prestige task 153 completed', true, prestigeTaskDone);
    testController.assertEqual('completing a Prestige task makes prestige available',
        true, win.getFullState().prestigeAvailable === true);

    win.setMod('auto_prestige', true);
    win.setMod('auto_prestige_wealth_enabled', true);
    win.setMod('auto_continue_energy_reset', true);
    win.setEnergy(0);
    const prestiged = await eventually(testController, () => {
        pumpTicks(win, 5);
        return (win.getFullState().prestigeCount ?? 0) > 0;
    }, 'the game prestiged', 30000, 100);
    testController.assertEqual('energy depletion triggered a prestige', true, prestiged);
    if (!prestiged) return testController.getOverallResult();
    // One prestige is enough; leave the mods off so the re-completion below
    // isn't interrupted by a second one.
    win.setMod('auto_prestige', false);
    win.setMod('auto_continue_energy_reset', false);

    // Leg 4 — the crux. The prestige wiped both perks; the bridge restored the
    // foreign one and left the own-world one for its task to re-grant. Perks
    // held is now deliberately BELOW perk items received — the invariant the
    // other tests assert holds only while no prestige has happened.
    const held = heldPerks(win);
    testController.log(`after prestige: perks held [${[...held]}], `
        + `foreign=${foreignPerk}, own=${ownPerk}`);
    testController.assertEqual('foreign perk survives the prestige', true, held.has(foreignPerk));
    testController.assertEqual('own-world perk is wiped by the prestige', false, held.has(ownPerk));
    testController.assertEqual('the own perk\'s AP location stays checked', true,
        snapshotHasLocation(testController.stateManager.getSnapshot(), JTA_PRESTIGETEST_OWN_LOCATION));
    const inv = testController.stateManager.getSnapshot()?.inventory ?? {};
    const receivedPerkItems = JTA_PERK_ITEM_NAMES.filter((n) => Number(inv[n] ?? 0) > 0).length;
    testController.assertEqual('perk items received is unchanged by the prestige', 2, receivedPerkItems);
    testController.assertEqual('perks held is below items received while the own perk is unearned',
        1, held.size);

    // Leg 5 — re-running the task that holds the own perk brings it back, with
    // no new AP item and no second location check. The prestige sent us to zone
    // 0 and its energy reset teleported us off the jta region, so walk back
    // first (the loops queue does this in real play).
    if (readCurrentRegion() !== JTA_PRESTIGETEST_REGION) {
        moveToRegion(JTA_PRESTIGETEST_REGION, readCurrentRegion());
    }
    const active = await eventually(testController,
        () => getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === false,
        'jta region active again after the prestige reset', 15000, 200);
    testController.assertEqual('re-entered the jta region after the prestige', true, active);
    if (!active) return testController.getOverallResult();

    const reDone = await completeTask(testController, win, JTA_PRESTIGETEST_OWN_TASK_ID,
        `task ${JTA_PRESTIGETEST_OWN_TASK_ID} re-completed after the prestige`);
    testController.assertEqual('own perk task re-completed', true, reDone);
    const regranted = await eventually(testController,
        () => heldPerks(win).has(ownPerk), 'own-world perk re-granted', 15000, 200);
    testController.assertEqual('re-completing the task re-grants the own-world perk', true, regranted);
    testController.assertEqual('foreign perk still held after the re-grant',
        true, heldPerks(win).has(foreignPerk));

    const invAfter = testController.stateManager.getSnapshot()?.inventory ?? {};
    testController.assertEqual('the re-completion sent no duplicate AP item',
        1, Number(invAfter[JTA_PRESTIGETEST_OWN_ITEM] ?? 0));
    testController.assertEqual('perks held == perk items received once the task is re-run',
        JTA_PERK_ITEM_NAMES.filter((n) => Number(invAfter[n] ?? 0) > 0).length, heldPerks(win).size);

    // Leave loop mode off so the auto-enabled flag can't leak into a later
    // test's non-loop preset (leg 3's reset already unparked the block).
    unparkManualBlock(prestigePark);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-prestige-perk-regrant',
    name: 'JtA: perk grants survive a prestige (own-world re-earned, foreign restored)',
    description: 'Loads jta_prestige_test (identity placement plus one foreign perk in '
               + 'start_inventory), earns an own-world perk, reaches a real prestige via '
               + 'zone 14\'s Touch the Divine task, and asserts the prestige wipes only the '
               + 'own-world perk — restored when its task is re-run, with its AP location '
               + 'still checked and no duplicate item — while the foreign perk persists.',
    testFunction: prestigePerkRegrant,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/** The fork's inventory count for an item enum, via getFullState. */
function itemCount(win, itemEnum) {
    const entry = win.getFullState?.()?.items?.find((it) => it.type === itemEnum);
    return entry?.count ?? 0;
}

async function crossSubstrateItemGrant(testController) {
    let win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    // Fresh save: earlier tests in the run share the substrate save
    // slot, and the D4 leg below asserts the reset's EXACT keep
    // formula on a game with no keep-modifying perks.
    win = await resetJtaSaveAndReload(testController);
    testController.reportCondition('fresh save reloaded', !!win);
    if (!win) return testController.getOverallResult();

    const grantFn = centralRegistry.getPublicFunction?.('resourceChannels', 'grantItem');
    testController.assertEqual('resourceChannels grantItem public fn present', true,
        typeof grantFn === 'function');
    if (typeof grantFn !== 'function') return testController.getOverallResult();

    // Declaration ↔ live-catalog cross-check (the drift guard): the
    // registry's getTypes must equal the fork's getAllItems() names
    // minus the artifacts.
    const declared = substrateRegistry.get('jta')?.sharing?.items?.getTypes?.() ?? [];
    const catalog = win.getAllItems();
    const liveShareable = catalog.filter((it) => !it.isArtifact).map((it) => it.name).sort();
    testController.assertEqual('declared types match the live fork catalog minus artifacts',
        JSON.stringify(liveShareable), JSON.stringify([...declared].sort()));

    const itemName = declared.includes('Food') ? 'Food' : declared[0];
    const itemEnum = catalog.find((it) => it.name === itemName)?.type;
    const artifactName = catalog.find((it) => it.isArtifact)?.name;
    testController.log(`granting '${itemName}' (enum ${itemEnum}); artifact probe '${artifactName}'`);
    const before = itemCount(win, itemEnum);

    // Grants from the host and from a fellow substrate both deposit.
    testController.assertEqual('grant from host accepted', true,
        grantFn({ to: 'jta', from: 'host', itemType: itemName, count: 2 }));
    const hostLanded = await eventually(testController,
        () => itemCount(win, itemEnum) === before + 2,
        `'${itemName}' count reached ${before + 2} after the host grant`);
    testController.assertEqual('host grant landed in the fork inventory', true, hostLanded);

    testController.assertEqual('grant from omsi accepted', true,
        grantFn({ to: 'jta', from: 'omsi', itemType: itemName, count: 1 }));
    const omsiLanded = await eventually(testController,
        () => itemCount(win, itemEnum) === before + 3,
        `'${itemName}' count reached ${before + 3} after the omsi grant`);
    testController.assertEqual('cross-substrate grant landed in the fork inventory', true, omsiLanded);

    // Rejections: the bus refuses undeclared types (artifacts are not
    // declared), and the fork hook itself refuses artifacts even when
    // called directly (defense in depth).
    testController.assertEqual('bus rejects an artifact grant', false,
        grantFn({ to: 'jta', from: 'host', itemType: artifactName, count: 1 }));
    testController.assertEqual('bus rejects an unknown type', false,
        grantFn({ to: 'jta', from: 'host', itemType: 'No Such Item', count: 1 }));
    testController.assertEqual('fork hook rejects an artifact directly', false,
        win.grantItem(artifactName)?.success === true);
    testController.assertEqual('rejections left the inventory unchanged',
        before + 3, itemCount(win, itemEnum));

    // D4 made visible: the game's OWN energy reset applies its native
    // keep formula to granted items — a fresh game holds no
    // keep-modifying perks and the granted item is not a note item, so
    // the reset wipes it entirely.
    testController.log('Triggering the game\'s own energy reset…');
    win.doEnergyReset();
    const wiped = await eventually(testController,
        () => itemCount(win, itemEnum) === 0,
        'granted items wiped by the native energy reset (keep formula)');
    testController.assertEqual('granted items live by the native reset semantics', true, wiped);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-cross-substrate-item-grant',
    name: 'JtA: cross-substrate item grants land in the fork inventory',
    description: 'Grants a consumable to \'jta\' over the resourceChannels bus (from '
               + '\'host\' and from \'omsi\'); the bridge deposits via the fork\'s '
               + 'grantItem hook (Fork 1.12). Asserts the declaration matches the live '
               + 'catalog minus artifacts, artifact/unknown grants are rejected at both '
               + 'layers, and the game\'s own energy reset wipes granted items (D4).',
    testFunction: crossSubstrateItemGrant,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


// ---------------------------------------------------------------------------
// M4 — the fine-grained record → playback leg (2026-07-23)
// ---------------------------------------------------------------------------

/**
 * jta's end-to-end block-mode round trip, ACROSS A ZONE BOUNDARY.
 *
 * M4 makes jta a FINE-GRAINED Record/Playback substrate: the fork's
 * performed-actions log is the full-visit stream, the bridge slices one
 * region visit out of it and stashes it host-side, loops persists the slice
 * on a successful Record exit, and Playback replays it through the
 * jtaQueueEngine executor before crossing the recorded exit. Every piece of
 * that has unit coverage; NOTHING had in-app coverage, and the four
 * walkTo-driven jta progression tests the M3b strict gate deferred to M6
 * were jta's only end-to-end in-app stratum. This test is that stratum.
 *
 * Deliberately multi-region and driven through the REAL loops queue rather
 * than a direct replayActions() call (the maze precedent
 * `maze-record-playback-crosses-exit` is a focused replay-crosses test; jta
 * needs the whole path):
 *
 *   1. Park a RECORD block on zone 0 and play it by hand — drive a real
 *      zone-0 task to a completed rep through the fork, then complete the
 *      bridge's synthetic exit task. That fires the bridge's own
 *      _dispatchRegionMove, which finalizes + publishes the visit slice
 *      BEFORE the departing user:regionMove (the 11/n stash-before-move
 *      ordering) and crosses into the next zone. The move carries no
 *      fromLoop — it passes the strict gate only because the Record block
 *      is parked (`parkedLivePlay`), which is exactly the contract.
 *   2. Assert the recording PERSISTED and BINDS: the block's
 *      (arrivalKey, ordinal) tag resolves to a savedQueueStore entry whose
 *      actions are shared/actionQueue vocabulary (a clickTask for the task
 *      actually played), carrying the departure exit id — and that the
 *      block auto-switched to Playback.
 *   3. Walk back into zone 0, reset the fork run so the recorded reps are
 *      performable again, and restart the queue. The SAME block — now
 *      Playback with a bound recording — replays through loops'
 *      _handlePlaybackReplayEntry → the jta PlaybackProxy → the
 *      jtaQueueEngine executor → the live fork, then crossExit()s the
 *      recorded exit and CROSSES THE ZONE BOUNDARY again. Instant is set on
 *      the block, so the bridge's energy-respecting stepTick pump drives it.
 *
 * Folded in (rather than waiting for M6 to revive
 * `jta-starting-energy-bonus-raises-pool`): with energyBonusSync on, the
 * fork's starting-energy bonus is reported up and RAISES THE SHARED POOL —
 * asserted on maxMana and on the refilled loop starting mana that the
 * recorded run is then played against.
 */
async function recordPlaybackCrossesZoneBoundary(testController) {
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const { clearForRegion } = await import('../../loops/savedQueueStore.js');

    let win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();
    // Fresh game — the substrate save slot is shared across a run, and this
    // test plays real tasks whose reps must start at zero.
    win = await resetJtaSaveAndReload(testController);
    testController.reportCondition('fresh jta game active after save reset', !!win);
    if (!win) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const loopOn = await testController.pollForCondition(
        () => gs.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)', 5000, 100);
    testController.assertEqual('loop mode active (auto-enabled by loop_costs)', true, !!loopOn);
    if (!loopOn) return testController.getOverallResult();

    const exit = readRegionExits(JTA_TEST_REGION)[0];
    testController.assertEqual(`${JTA_TEST_REGION} has a warehoused exit`, true, !!exit?.targetRegion);
    if (!exit?.targetRegion) return testController.getOverallResult();
    const exitId = exit.exit_id ?? exit.exitName;
    const targetRegion = exit.targetRegion;
    testController.log(`zone-0 exit '${exitId}' → '${targetRegion}'`);

    // Wipe any recording this test left behind on an earlier run — otherwise
    // the Playback leg could replay a stale entry and the "recording
    // persisted" assertions would be vacuous.
    try { clearForRegion(loopState._rulesHash(), JTA_TEST_REGION, 'jta'); } catch { /* best-effort */ }

    const BONUS_SETTING = 'moduleSettings.jtaSubstrateWrapper.energyBonusSync';
    const getMaxMana = () => gameStateFn('getMaxMana')?.();
    const getJtaBonus = () => gameStateFn('getSubstrateMaxManaBonus')?.('jta') ?? 0;
    const savedNoReset = gs.noManaDepletionReset;
    const savedSpeed = loopState.gameSpeed;
    let park = null;
    let playedTaskId = null;

    try {
        // ── Starting-energy bonus raises the shared pool ────────────────
        // (folded-in coverage from the M6-deferred
        // jta-starting-energy-bonus-raises-pool; the recorded run below is
        // played against the raised pool.)
        await settingsManager.updateSetting(BONUS_SETTING, true, { persist: false });
        const bonusZeroed = await eventually(testController, () => getJtaBonus() === 0,
            'jta bonus starts at 0 on the fresh game', 8000);
        testController.assertEqual('jta bonus starts at 0', true, !!bonusZeroed);
        const maxMana0 = getMaxMana();
        win.getGamestate.jta_starting_energy_bonus = 50;
        const bonusApplied = await eventually(testController, () => getJtaBonus() === 50,
            'jta starting-energy bonus (50) reported to the shared pool', 10000);
        testController.assertEqual('bridge reported the starting-energy bonus', true, !!bonusApplied);
        testController.assertEqual('maxMana rose by the bonus', maxMana0 + 50, getMaxMana());
        gs.refillMana();
        testController.assertEqual('the raised maxMana is the loop starting mana',
            getMaxMana(), gs.getCurrentMana());

        // ── Leg 1: RECORD a real zone-0 visit and cross the boundary ────
        park = await parkManualBlockInRegion(
            testController, JTA_TEST_REGION, targetRegion, exitId, 'record');
        testController.assertEqual('parked a Record block in the zone region', true, !!park);
        if (!park) return testController.getOverallResult();
        const instance = park.instance;

        testController.assertEqual('no recording bound to the block before recording',
            null, loopState._lookupBoundRecording(JTA_TEST_REGION, instance));

        // Drains apply to parked live play (one economy) — keep them from
        // resetting the loop mid-recording; the recording's content, not its
        // affordability, is what's under test here.
        gs.noManaDepletionReset = true;
        const playWin = await waitForJtaActive(testController) ?? win;

        // Play a real zone-0 task by hand until the fork records a completed
        // rep for it (the recorder IS the stream being sliced, so polling it
        // is the exact "this is in the recording" signal).
        const interior = (playWin.getAvailableTasks?.() ?? [])
            .filter((t) => t.id < SYNTHETIC_EXIT_TASK_MIN);
        testController.assertEqual('zone 0 offers a real (non-exit) task', true, interior.length > 0);
        if (interior.length === 0) return testController.getOverallResult();
        playedTaskId = interior[0].id;
        testController.log(`hand-playing zone-0 task ${playedTaskId} ('${interior[0].name ?? '?'}')`);
        const repRecorded = await eventually(testController, () => {
            playWin.setEnergy(1e9);
            if (playWin.getFullState?.().activeTaskId !== playedTaskId) playWin.performTask(playedTaskId);
            pumpTicks(playWin);
            return (playWin.getCurrentRunActions?.() ?? [])
                .some((a) => a?.type === 'task' && a.task_id === playedTaskId);
        }, `the fork recorded a completed rep of task ${playedTaskId}`, 25000, 20);
        testController.assertEqual('hand play produced a recorded task rep', true, !!repRecorded);

        // Depart. A FIRST-traversal single-exit zone has no synthetic exit
        // task to click — the departure fires when the zone's Travel task
        // completes, so the zone has to be genuinely played. Hand the walk
        // to the game's own automation (walkTo, the 'activate' policy) and
        // keep energy topped up so it finishes inside one loop: the
        // deferred walkTo tests fail only because they run UNPARKED, and
        // this is the parked counterpart — the bridge's fromLoop-less
        // _dispatchRegionMove passes the gate as parkedLivePlay.
        const controller = substrateRegistry.get('jta')?.getPlaybackController?.();
        testController.assertEqual('registry exposes a live PlaybackController', true, !!controller);
        if (!controller) return testController.getOverallResult();
        controller.walkTo({ kind: 'exit', name: exit.exitName ?? exitId });
        testController.log(`walkTo dispatched toward '${exit.exitName ?? exitId}'…`);
        const crossed = await eventually(testController, () => {
            const w = getJtaIframe()?.contentWindow;
            if (w?.isGameLoopPaused?.() === false) {
                w.setEnergy(1e9);
                pumpTicks(w, 50);
            }
            return readCurrentRegion() === targetRegion;
        }, `the recorded run crossed into '${targetRegion}'`, 120000, 20);
        testController.assertEqual(
            'a parked Record block\'s hand-played exit crosses the zone boundary '
            + '(gate-allowed as parkedLivePlay, unlike an unparked walkTo)',
            true, !!crossed);
        if (!crossed) return testController.getOverallResult();

        // ── Leg 2: the recording persisted, bound, and auto-switched ────
        const bound = loopState._lookupBoundRecording(JTA_TEST_REGION, instance);
        testController.assertEqual('the visit recording persisted and binds to the block',
            true, !!bound);
        if (!bound) return testController.getOverallResult();
        testController.log(`bound recording: ${JSON.stringify(bound.actions)} `
            + `departureExitId=${bound.departureExitId}`);
        testController.assertEqual('the recording carries the departure exit id',
            exitId, bound.departureExitId);
        testController.assertEqual(
            'the recording holds the hand-played task in shared actionQueue vocabulary',
            true, (bound.actions ?? []).some(
                (a) => a.actionType === 'clickTask' && a.actionId === playedTaskId));
        // The visit slice is the zone's performed actions MINUS the departure
        // trigger (the Travel task that fired the regionMove) — the same
        // interior-only shape maze/TA recordings have. The fork stamps
        // zone_id on every entry, so the zone's own slice of the run log is
        // directly comparable.
        const zoneLog = (getJtaIframe()?.contentWindow?.getCurrentRunActions?.() ?? [])
            .filter((a) => a?.zone_id === 0);
        testController.log(`fork zone-0 run log: ${zoneLog.length} entries, `
            + `recorded interior: ${(bound.actions ?? []).length}`);
        testController.assertEqual(
            'the recorded interior is the visit minus its departure trigger',
            Math.max(zoneLog.length - 1, 0), (bound.actions ?? []).length);
        testController.assertEqual('the block auto-switched to Playback after recording',
            'playback', loopState.getBlockMode(JTA_TEST_REGION, instance));

        // ── Leg 3: PLAYBACK replays it and crosses the boundary again ───
        // Walk back into zone 0 (a bare reposition — gate-exempt
        // syntheticMove) and reset the fork run so the recorded reps are
        // performable again rather than skipped as already-completed.
        moveToRegion(JTA_TEST_REGION, readCurrentRegion());
        let replayWin = await waitForJtaActive(testController);
        testController.assertEqual('back in the recorded zone', true, !!replayWin);
        if (!replayWin) return testController.getOverallResult();
        replayWin.doEnergyReset();
        // The fork's reset propagates a host loop reset whose teleport may
        // land elsewhere — walk back if so.
        await eventually(testController, () => readCurrentRegion() != null, 'reset settled', 3000);
        if (readCurrentRegion() !== JTA_TEST_REGION) {
            moveToRegion(JTA_TEST_REGION, readCurrentRegion());
        }
        replayWin = await waitForJtaActive(testController) ?? replayWin;
        testController.assertEqual('zone 0 live again after the fork reset',
            JTA_TEST_REGION, readCurrentRegion());

        gs.noManaDepletionReset = true;
        gs.refillMana();
        // Instant: drain the replay through the bridge's energy-respecting
        // stepTick pump (M4) rather than the game's normal tick rate.
        loopState.setBlockInstant(JTA_TEST_REGION, instance, true);
        loopState.setGameSpeed(10000);
        loopState.startProcessing();

        const replayCrossed = await eventually(testController, () => {
            // Keep the replay affordable — the recording's minima are a
            // slice-4 concern; this leg tests the replay path, not the economy.
            try { getJtaIframe()?.contentWindow?.setEnergy?.(1e9); } catch { /* iframe swapping */ }
            return readCurrentRegion() === targetRegion;
        }, `Playback replayed the recording and crossed into '${targetRegion}'`, 60000, 100);
        testController.assertEqual(
            'Playback replayed the bound recording through the jtaQueueEngine executor '
            + 'and crossed the zone boundary (loops _handlePlaybackReplayEntry → '
            + 'PlaybackProxy.replayActions → executor → crossExit)',
            true, !!replayCrossed);
        if (!replayCrossed) {
            testController.log(`DIAG: region '${readCurrentRegion()}', `
                + `parked=${loopState._manualActionEntered}, `
                + `mode=${loopState.getBlockMode(JTA_TEST_REGION, instance)}`);
        }
        testController.assertEqual('the replayed block left the queue parked-free',
            false, loopState._manualActionEntered);

        // Non-vacuity: the crossing must be the END of a real replay, not an
        // empty drain straight to crossExit. doEnergyReset() snapshotted the
        // run log away, so every zone-0 entry in it now was performed by the
        // executor — including the task the recording carries (the fork's own
        // automation is off for the duration, BridgeTransport.beginRun).
        const replayLog = (getJtaIframe()?.contentWindow?.getCurrentRunActions?.() ?? [])
            .filter((a) => a?.zone_id === 0);
        testController.log(`replay re-performed ${replayLog.length} zone-0 action(s)`);
        testController.assertEqual(
            'the replay re-performed the recorded task through the live fork',
            true, replayLog.some((a) => a?.type === 'task' && a.task_id === playedTaskId));
    } finally {
        // Stop the instant pump even if the replay never exhausted, so it
        // can't keep stepping the fork into later tests.
        try {
            testController.eventBus.publish('jta:playbackControl', { method: 'stopInstantPump' });
        } catch { /* best-effort */ }
        try { loopState.setBlockInstant(JTA_TEST_REGION, park?.instance ?? 1, false); } catch { /* ignore */ }
        gs.noManaDepletionReset = savedNoReset;
        loopState.setGameSpeed(savedSpeed);
        await settingsManager.clearOverride(BONUS_SETTING);
        // Leave loop mode off so the auto-enabled flag can't leak into a
        // later test's non-loop preset.
        unparkManualBlock(park ?? { loopStateSingleton: loopState, savedSpeed, gs });
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-record-playback-crosses-zone-boundary',
    name: 'JtA: a recorded zone visit replays through the executor and crosses the zone boundary',
    description: 'The M4 fine-grained round trip on jta, multi-region: hand-plays a '
               + 'parked RECORD block in zone 0 (real fork task + the bridge\'s '
               + 'synthetic exit task) so the visit slice is stashed before the '
               + 'departing regionMove and persisted by loops; asserts the recording '
               + 'binds to the block in shared actionQueue vocabulary with the '
               + 'departure exit id and auto-switches to Playback; then restarts the '
               + 'queue on the same block so Playback replays it through the '
               + 'jtaQueueEngine executor and crosses the zone boundary again. Also '
               + 'asserts the starting-energy bonus raises the shared pool the '
               + 'recorded run is played against (energyBonusSync).',
    testFunction: recordPlaybackCrossesZoneBoundary,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});


async function latchedRunEndNotMaskedByPin(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const resetsBefore = readLoopResetCount();
    const poolBefore = readPool();
    testController.log(`pool=${poolBefore}, loopResets=${resetsBefore}`);
    testController.assertEqual('pool starts above zero', true, poolBefore > 0);

    // Build the state the energy pin used to deadlock on: the fork
    // LATCHED at energy 0 while the shared pool still holds mana.
    //
    // Stepping away first is what makes it deterministic — the bridge
    // deactivates, its poll stops, and the energy we zero below is
    // therefore never mirrored into the pool. That is the divergence
    // this fix is about: the fork's run is over, but the host (the sole
    // reset authority, deciding on the pool reaching 0) will never see a
    // drain saying so, because the only thing that could produce one is
    // the frozen game.
    testController.log(`Stepping out to ${JTA_TEST_START_REGION} so the bridge poll stops…`);
    moveToRegion(JTA_TEST_START_REGION, JTA_TEST_REGION);
    const pausedAway = await eventually(
        testController,
        () => win.isGameLoopPaused() === true,
        'game clock paused after stepping out',
    );
    testController.assertEqual('bridge deactivated before we latch the fork', true, pausedAway);

    // Zero energy, then hand-run one tick: checkEnergyReset latches
    // is_in_energy_reset, and updateGamestate returns early from here on
    // — the fork is frozen until a doEnergyReset clears it.
    win.setEnergy(0);
    win.stepTick();
    const latchedState = win.getFullState();
    testController.assertEqual('fork latched in an energy reset', true, latchedState.isInEnergyReset === true);
    testController.assertEqual('fork energy is 0 while latched', 0, Math.round(latchedState.currentEnergy));
    testController.assertEqual('shared pool still holds mana (no drain was mirrored)', true, readPool() > 0);

    // Witness at the layer under test: every write the bridge makes to
    // the fork's energy, stamped with whether the fork was latched at
    // the time. A poll cannot measure this — the reset that follows
    // erases the state within a beat — so fold the mutations instead.
    const energyWrites = [];
    const realSetEnergy = win.setEnergy;
    win.setEnergy = function spySetEnergy(current, max) {
        let latched = null;
        try { latched = win.getFullState().isInEnergyReset === true; } catch { /* ignore */ }
        energyWrites.push({ current, max, latched });
        return realSetEnergy.call(win, current, max);
    };

    // Second witness: the run-end report the bridge now publishes when it
    // sees the latch. The host module forwards it onto the host bus,
    // where resourceChannels answers it with a loop reset (unless one
    // already fired for the same depletion).
    let runEndReports = 0;
    const unsubscribe = testController.eventBus.subscribe('substrate:resourceReset', (data) => {
        if (data?.substrateId === 'jta') runEndReports += 1;
    });

    try {
        // Re-enter: loadRegion runs the catch-up (delta 0 — the host has
        // fired no reset) and then the pin, which is the exact write that
        // used to mask the run's end.
        testController.log(`Re-entering ${JTA_TEST_REGION} — loadRegion's pin runs against a latched fork…`);
        moveToRegion(JTA_TEST_REGION, JTA_TEST_START_REGION);

        const recovered = await eventually(
            testController,
            () => readLoopResetCount() === resetsBefore + 1,
            'host fired a loop reset for the latched run',
            15000,
        );
        testController.assertEqual('host fired a loop reset for the latched run', true, recovered);

        // The bridge told the host its run ended rather than waiting for a
        // drain that could never come.
        testController.assertEqual('bridge reported the run end while latched', true, runEndReports >= 1);

        // Land back in the jta region so the catch-up applies (the reset
        // teleport may have moved us out, which defers it to re-entry).
        if (readCurrentRegion() !== JTA_TEST_REGION) {
            moveToRegion(JTA_TEST_REGION, readCurrentRegion());
        }
        const unlatched = await eventually(
            testController,
            () => win.getFullState().isInEnergyReset === false,
            'fork unlatched by the host-driven reset',
            15000,
        );
        testController.assertEqual('fork unlatched by the host-driven reset', true, unlatched);
        const refilled = await eventually(
            testController,
            () => win.getFullState().currentEnergy > 0,
            'fork energy back above zero for the fresh run',
            10000,
        );
        testController.assertEqual('fork energy refilled for the fresh run', true, refilled);

        // THE assertion: the pin never raised energy while the fork was
        // latched. Every masking write is one of these.
        const maskingWrites = energyWrites.filter((w) => w.latched === true && w.current > 0);
        testController.log(`energy writes seen: ${energyWrites.length}, masking: ${maskingWrites.length}`);
        testController.assertEqual(
            'no energy write raised the fork above zero while it was latched',
            0,
            maskingWrites.length,
        );

        // Liveness: the spy DOES see pins, so the zero above is not vacuous.
        // The post-reset resync is the legitimate one.
        testController.assertEqual(
            'the spy observed the legitimate post-reset pin',
            true,
            energyWrites.some((w) => w.latched === false && w.current > 0),
        );
    } finally {
        win.setEnergy = realSetEnergy;
        try { unsubscribe?.(); } catch { /* best-effort */ }
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-latched-run-end-not-masked-by-pin',
    name: 'JtA: the energy pin declines while the fork is latched, and the run end is reported',
    description: 'Builds the deadlock state directly — the fork latched at energy 0 '
               + 'while the shared pool still holds mana, so no drain will ever tell '
               + 'the host a reset is due — then re-enters the region so loadRegion\'s '
               + 'pin runs against it. Asserts (via a spy on the fork\'s setEnergy, '
               + 'which also proves it sees the legitimate post-reset pin) that no '
               + 'write raised energy while latched, that the bridge reported the run '
               + 'end on the resource channel, and that the host-driven reset unlatched '
               + 'the fork and refilled it.',
    testFunction: latchedRunEndNotMaskedByPin,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});
