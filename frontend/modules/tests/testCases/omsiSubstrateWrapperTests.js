/**
 * End-to-end tests for the omsi (Idle Loops) substrate wrapper — the
 * R2 mana-channel contract, mirroring the jta substrate suite:
 *
 *   1. omsi-out-of-mana-loop-reset — a game-side budget drain mirrors
 *      into the shared pool via substrate:resourceDelta; pool
 *      depletion triggers a loop reset + teleport, and the catch-up
 *      re-pins the game's budget to the refilled pool.
 *   2. omsi-loop-exhaustion-single-reset — a REAL queued run
 *      (Wander × many, host-driven clock) exhausts the loop budget;
 *      the game's natural restart coincides with the pool hitting 0,
 *      and the router's race guard collapses the two into exactly ONE
 *      loop reset (no ping-pong).
 *   3. omsi-clock-runs-only-in-region — strict clock ownership: the
 *      bridge's host-driven clock runs only while an omsi region is
 *      active.
 *   4. omsi-budget-mirrors-pool-both-ways — drains deduct the pool,
 *      gains add to it; entry pins the budget to the pool.
 *   5. omsi-native-budget-raises-pool — the game's native per-loop
 *      budget (250) is reported as a substrate:resourceBonus and lands
 *      in gameState's per-substrate max-mana accumulator.
 *
 * All tests load the omsi_substrate_test preset (2 maze regions + 1
 * omsi Beginnersville region, manaEnabled sidecars, loop_costs
 * embedded) and drive the REAL iframe + bridge; game state is
 * manipulated through the iframe's own eval (the fork's engine surface
 * is global lexical bindings, not window properties — see
 * test-helpers.js).
 */

import { registerTest } from '../testRegistry.js';
import {
    OMSI_TEST_PRESET_PATH,
    OMSI_TEST_REGION,
    OMSI_TEST_MAZE_REGION,
    OMSI_NATIVE_BUDGET,
    waitForOmsiActive,
    moveToRegion,
    readManaLeft,
    omsiAddMana,
    omsiQueueAction,
    omsiClearQueue,
    isBridgeClockRunning,
    readPool,
    readLoopResetCount,
    readCurrentRegion,
    readOmsiBudgetBonus,
    readExpectedResetTarget,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

/** Shared setup: load the preset, enter the omsi region, wait for the bridge. */
async function enterOmsiRegion(testController) {
    testController.log('Loading omsi_substrate_test preset…');
    await testController.loadRulesFromFile(OMSI_TEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    // Mount the wrapper panel; the host module also activates it on
    // omsi:loadRegion, but the iframe must exist first.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'omsiSubstrateWrapperPanel',
    });

    testController.log(`Moving into omsi region ${OMSI_TEST_REGION}…`);
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);

    const win = await waitForOmsiActive(testController);
    testController.reportCondition('omsi bridge active in region', !!win);
    if (win) {
        // Leftover plan entries from an earlier test would let the clock
        // step (and drain) in the background of assertions that assume
        // an idle game.
        omsiClearQueue();
    }
    return win;
}

async function outOfManaLoopReset(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const resetsBefore = readLoopResetCount();
    const poolBefore = readPool();
    testController.log(`pool=${poolBefore}, loopResets=${resetsBefore}`);
    testController.assertEqual('pool starts above zero', true, poolBefore > 0);

    const resetTarget = readExpectedResetTarget();
    testController.log(`expected reset target: ${resetTarget}`);

    // Zero the game's remaining budget through its own addMana hook (a
    // game-side change, same surface Buy Mana rides). The bridge's next
    // sample mirrors the full drain into the pool; the router fires the
    // loop reset at pool <= 0.
    const left = readManaLeft();
    testController.assertEqual('budget pinned to pool on entry', true,
        Math.abs(left - poolBefore) < 0.5);
    omsiAddMana(-left);

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

    testController.assertEqual('pool refilled', true, readPool() > 0);

    if (resetTarget !== OMSI_TEST_REGION) {
        const stopped = await eventually(
            testController,
            () => !isBridgeClockRunning(),
            'bridge clock stopped after leaving omsi region',
            8000,
        );
        testController.assertEqual('bridge clock stopped after teleport away', true, stopped);
    }

    // The catch-up applied the reset to the game and re-pinned its
    // budget to the refilled pool.
    const repinned = await eventually(
        testController,
        () => Math.abs(readManaLeft() - readPool()) < 0.5,
        'game budget re-pinned to refilled pool',
        8000,
    );
    testController.assertEqual('game budget re-pinned to refilled pool', true, repinned);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-out-of-mana-loop-reset',
    name: 'Omsi: out-of-mana triggers loop reset and teleport',
    description: 'Zeroes the game\'s remaining loop budget via its addMana hook; the '
               + 'bridge mirrors the drain into the shared pool, the host fires a '
               + 'loop reset at 0, the player teleports to the start region, and the '
               + 'catch-up re-pins the game\'s budget to the refilled pool.',
    testFunction: outOfManaLoopReset,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function loopExhaustionSingleReset(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const resetsBefore = readLoopResetCount();
    const poolBefore = readPool();
    testController.log(`pool=${poolBefore}, loopResets=${resetsBefore}`);

    // A real run: queue far more Wander reps than the budget can pay
    // for. The host-driven clock steps the engine at 50 ticks/s and
    // each tick drains 1 mana; the budget is pinned to the pool, so
    // the game's natural timer >= timeNeeded restart coincides with
    // the pool hitting 0 through the mirrored drains.
    omsiQueueAction('Wander', 9999);
    testController.log('queued Wander x9999; waiting for budget exhaustion…');

    const drained = await eventually(
        testController,
        () => readPool() < poolBefore - 5,
        'pool draining under the host-driven clock',
        15000,
    );
    testController.assertEqual('pool drains while the queue runs', true, drained);

    // Budget ≈ pool mana at 50/s ⇒ exhaustion within (pool/50 + slack) s.
    const exhaustTimeout = Math.max(20000, (poolBefore / 50) * 1000 + 15000);
    const resetHappened = await eventually(
        testController,
        () => readLoopResetCount() >= resetsBefore + 1,
        'loop reset fired at exhaustion',
        exhaustTimeout,
    );
    testController.assertEqual('loop reset fired at exhaustion', true, resetHappened);

    // The race guard must collapse the coincident game restart and
    // pool depletion into exactly ONE loop reset — give the pipeline a
    // beat and confirm no second reset arrives.
    await new Promise((r) => setTimeout(r, 2000));
    testController.assertEqual(
        'exactly one loop reset (race guard, no ping-pong)',
        resetsBefore + 1,
        readLoopResetCount(),
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-loop-exhaustion-single-reset',
    name: 'Omsi: natural loop exhaustion causes exactly one loop reset',
    description: 'Queues a long Wander run under the bridge\'s host-driven clock; '
               + 'budget exhaustion (timer >= timeNeeded) coincides with the shared '
               + 'pool hitting 0, and the reset-count race guard collapses the two '
               + 'paths into exactly one loop reset.',
    testFunction: loopExhaustionSingleReset,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function clockRunsOnlyInRegion(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    testController.assertEqual('clock running while in omsi region', true, isBridgeClockRunning());

    testController.log(`Moving away to ${OMSI_TEST_MAZE_REGION}…`);
    moveToRegion(OMSI_TEST_MAZE_REGION, OMSI_TEST_REGION);
    const stoppedAway = await eventually(
        testController,
        () => !isBridgeClockRunning(),
        'clock stopped after moving away',
    );
    testController.assertEqual('clock stopped after moving away', true, stoppedAway);

    testController.log(`Moving back into ${OMSI_TEST_REGION}…`);
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);
    const resumed = await eventually(
        testController,
        () => isBridgeClockRunning(),
        'clock resumed after re-entry',
    );
    testController.assertEqual('clock resumed after re-entry', true, resumed);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-clock-runs-only-in-region',
    name: 'Omsi: host-driven clock runs only while an omsi region is active',
    description: 'The bridge owns time in managed mode: its clock starts on '
               + 'omsi:loadRegion, stops when the player leaves for a non-omsi '
               + 'region, and resumes on re-entry.',
    testFunction: clockRunsOnlyInRegion,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function budgetMirrorsPoolBothWays(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const pool0 = readPool();
    const left0 = readManaLeft();
    testController.log(`pool=${pool0}, manaLeft=${left0}`);
    testController.assertEqual(
        'budget pinned to pool on entry',
        true,
        Math.abs(pool0 - left0) < 0.5,
    );

    // Drain: shrink the budget by 10 → pool must follow down.
    omsiAddMana(-10);
    const drained = await eventually(
        testController,
        () => Math.abs(readPool() - (pool0 - 10)) < 0.5,
        'pool followed a 10-point budget drain',
    );
    testController.assertEqual('pool followed the drain', true, drained);

    // Gain: extend the budget by 5 (Buy Mana, in real play) → pool
    // must follow up (substrate:resourceDelta amount>0 → gainMana).
    omsiAddMana(5);
    const gained = await eventually(
        testController,
        () => Math.abs(readPool() - (pool0 - 5)) < 0.5,
        'pool followed a 5-point budget gain',
    );
    testController.assertEqual('pool followed the gain', true, gained);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-budget-mirrors-pool-both-ways',
    name: 'Omsi: loop budget mirrors the shared pool both ways',
    description: 'Shrinks and extends the game\'s remaining loop budget via its '
               + 'addMana hook; the bridge mirrors both directions into the shared '
               + 'pool through substrate:resourceDelta, and entry pins the budget '
               + 'to the pool.',
    testFunction: budgetMirrorsPoolBothWays,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


async function nativeBudgetRaisesPool(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    // The bridge reports the game's native per-loop starting budget
    // (timeNeededInitial = 250) as substrate:resourceBonus on region
    // entry; the router folds it into gameState's per-substrate
    // accumulator, raising maxMana.
    const bonusLanded = await eventually(
        testController,
        () => readOmsiBudgetBonus() === OMSI_NATIVE_BUDGET,
        `omsi budget bonus ${OMSI_NATIVE_BUDGET} in the per-substrate accumulator`,
    );
    testController.assertEqual(
        'native budget landed in the per-substrate max-mana accumulator',
        true,
        bonusLanded,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-native-budget-raises-pool',
    name: 'Omsi: native starting budget raises the shared pool',
    description: 'On omsi region entry the bridge reports the game\'s native '
               + 'per-loop budget (250) as substrate:resourceBonus; asserts it '
               + 'lands in gameState\'s per-substrate max-mana accumulator.',
    testFunction: nativeBudgetRaisesPool,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
