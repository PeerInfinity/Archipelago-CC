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
 *   6. omsi-victory-start-journey — completing Start Journey (town 1
 *      unlocked, simulated via the game's own unlockTown(1) — the
 *      exact call Start Journey's completion makes; a real playthrough
 *      is a multi-hundred-loop event) checks the victory location and
 *      the Victory item arrives in the AP inventory. Driven from a
 *      PARKED MANUAL BLOCK since arc D1: omsi declares record +
 *      playback, which arms the M3b strict action gate, and an
 *      unparked location check is swallowed whole (award included).
 *
 * All tests load the omsi_substrate_test preset (2 maze regions + 1
 * omsi Beginnersville region, manaEnabled sidecars, loop_costs
 * embedded) and drive the REAL iframe + bridge; game state is
 * manipulated through the iframe's own eval (the fork's engine surface
 * is global lexical bindings, not window properties — see
 * test-helpers.js).
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import {
    OMSI_TEST_PRESET_PATH,
    OMSI_TEST_REGION,
    OMSI_TEST_MAZE_REGION,
    OMSI_TEST_VICTORY_LOCATION,
    OMSI_TEST_EXIT,
    OMSI_TEST_EXIT_TARGET,
    OMSI_NATIVE_BUDGET,
    parkManualBlocks,
    unparkManualBlocks,
    waitForOmsiActive,
    moveToRegion,
    readManaLeft,
    omsiAddMana,
    omsiQueueAction,
    omsiClearQueue,
    omsiEval,
    isBridgeClockRunning,
    readPool,
    readLoopResetCount,
    readCurrentRegion,
    readOmsiBudgetBonus,
    readExpectedResetTarget,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

/** True if the snapshot lists `name` among its checked locations. */
function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

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

async function omsiOutOfManaLoopReset(testController) {
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

    // Cold-boot race guard (the historical "cold-start flake", long
    // misattributed to the jta suite via the test-registry functionName
    // collision): on the iframe's first-ever boot, a late budget re-pin
    // catch-up can land AFTER the drain above and restore the game's
    // budget — the depletion then never registers (signature: no reset,
    // no teleport, pool still positive, budget still pinned). If the
    // drain visibly vanished, apply it once more; a genuinely broken
    // depletion path still fails the assertions below, and the re-drain
    // is skipped whenever a reset already fired so 'exactly one' stays
    // meaningful.
    const drainRegistered = await eventually(
        testController,
        () => readLoopResetCount() === resetsBefore + 1 || readPool() <= 0,
        'depletion registered on the first drain',
        4000,
    );
    if (!drainRegistered
            && readLoopResetCount() === resetsBefore
            && readManaLeft() > 0.5) {
        testController.log('first drain was clobbered (cold-boot budget re-pin race) — re-draining once');
        omsiAddMana(-readManaLeft());
    }

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
    testFunction: omsiOutOfManaLoopReset,
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

    // Cold-boot re-pin clobber guard (same race outOfManaLoopReset
    // guards against): a bridge re-pin (_syncBudgetFromPool — fired by
    // any manaChanged that fails the echo check, e.g. a late maxMana
    // recompute on a cold first boot) landing within one 20ms clock
    // tick of our addMana erases the change before the mirror samples
    // it — budget restored, pool untouched, and since we only wrote
    // once the whole poll times out. Retry once when the evidence
    // matches that signature exactly (pool unmoved AND budget back at
    // the pre-write value); a genuinely broken mirror fails both
    // attempts.
    async function nudgeBudgetExpectingPool(amount, expectedPool, label) {
        const before = readManaLeft(); // budget value pre-write
        omsiAddMana(amount);
        let ok = await eventually(
            testController,
            () => Math.abs(readPool() - expectedPool) < 0.5,
            label,
        );
        if (!ok
                && Math.abs(readPool() - (expectedPool - amount)) < 0.5
                && Math.abs(readManaLeft() - before) < 0.5) {
            testController.log(`'${label}' was clobbered (cold-boot budget re-pin race) — retrying once`);
            omsiAddMana(amount);
            ok = await eventually(
                testController,
                () => Math.abs(readPool() - expectedPool) < 0.5,
                `${label} (retry)`,
            );
        }
        return ok;
    }

    // Drain: shrink the budget by 10 → pool must follow down.
    const drained = await nudgeBudgetExpectingPool(
        -10, pool0 - 10, 'pool followed a 10-point budget drain');
    testController.assertEqual('pool followed the drain', true, drained);

    // Gain: extend the budget by 5 (Buy Mana, in real play) → pool
    // must follow up (substrate:resourceDelta amount>0 → gainMana).
    const gained = await nudgeBudgetExpectingPool(
        5, pool0 - 5, 'pool followed a 5-point budget gain');
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

async function victoryStartJourney(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    testController.assertEqual(
        'victory location not yet checked',
        false,
        snapshotHasLocation(testController.stateManager.getSnapshot(), OMSI_TEST_VICTORY_LOCATION),
    );

    // Arc D1 arms the strict action gate for omsi (loopSupport declares
    // record + playback) and this preset's loop_costs auto-enables loop
    // mode — so the victory check needs a parked Manual block to reach AP
    // (a blocked check isn't merely uncaptured: loops swallows the event,
    // and the award never propagates). Park, then drive the milestone
    // in-place: parked-Manual LIVE PLAY, the honest post-gate shape for an
    // AP-integration test.
    const park = await parkManualBlocks(testController,
        [{ from: OMSI_TEST_REGION, to: OMSI_TEST_EXIT_TARGET, exit: OMSI_TEST_EXIT }]);
    testController.assertEqual('parked a Manual block in the omsi region', true, !!park);
    if (!park) return testController.getOverallResult();

    try {
        // Complete Start Journey: its finish handler calls unlockTown(1) —
        // call the same engine function directly (a real playthrough is a
        // multi-hundred-loop event; townsUnlocked is the persistent
        // milestone the victory location is defined on).
        testController.log('Simulating Start Journey completion via unlockTown(1)…');
        omsiEval('unlockTown(1)');

        const checked = await eventually(
            testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), OMSI_TEST_VICTORY_LOCATION),
            'victory location checked',
            10000,
        );
        testController.assertEqual('victory location checked', true, checked);

        const victoryReceived = await eventually(
            testController,
            () => Number(testController.stateManager.getSnapshot()?.inventory?.Victory ?? 0) > 0,
            "'Victory' item in the AP inventory",
            10000,
        );
        testController.assertEqual("'Victory' item received", true, victoryReceived);
    } finally {
        // The re-entry leg below is a synthetic exit-less hop, not queue
        // execution — leave the park (and loop mode) behind for it.
        unparkManualBlocks(park);
    }

    // The check is once-only: town 1 stays unlocked, the dedupe (and
    // the reseed on region reload) must not re-dispatch it. Re-enter
    // the region and confirm no error and the location stays checked.
    moveToRegion(OMSI_TEST_MAZE_REGION, OMSI_TEST_REGION);
    await eventually(testController, () => !isBridgeClockRunning(), 'clock stopped after leaving');
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);
    await eventually(testController, () => isBridgeClockRunning(), 'clock resumed on re-entry');
    testController.assertEqual(
        'victory location still checked after re-entry',
        true,
        snapshotHasLocation(testController.stateManager.getSnapshot(), OMSI_TEST_VICTORY_LOCATION),
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-victory-start-journey',
    name: 'Omsi: completing Start Journey checks the victory location',
    description: 'Simulates Start Journey completion (unlockTown(1), the exact '
               + 'call its finish handler makes); the bridge reports the victory '
               + 'location as an AP check, the Victory item arrives, and the '
               + 'check is not re-dispatched on region re-entry.',
    testFunction: victoryStartJourney,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


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


async function omsiCrossSubstrateItemGrant(testController) {
    const win = await enterOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const grantFn = centralRegistry.getPublicFunction?.('resourceChannels', 'grantItem');
    testController.assertEqual('resourceChannels grantItem public fn present', true,
        typeof grantFn === 'function');
    if (typeof grantFn !== 'function') return testController.getOverallResult();

    // Declaration ↔ engine cross-check (the drift guard): the static
    // registry list must equal the NUMERIC entries of the live engine's
    // resourcesTemplate.
    const declared = [...(substrateRegistry.get('omsi')?.sharing?.items?.types ?? [])];
    const liveNumerics = omsiEval(
        'Object.keys(resourcesTemplate).filter((k) => typeof resourcesTemplate[k] === "number")');
    testController.assertEqual('declared types match the engine\'s numeric resources bag',
        JSON.stringify([...liveNumerics].sort()), JSON.stringify(declared.sort()));

    const goldBefore = omsiEval('resources.gold');
    testController.log(`resources.gold before grants: ${goldBefore}`);

    // Grants from the host and from a fellow substrate both deposit
    // through the engine's own addResource.
    testController.assertEqual('grant from host accepted', true,
        grantFn({ to: 'omsi', from: 'host', itemType: 'gold', count: 5 }));
    const hostLanded = await eventually(testController,
        () => omsiEval('resources.gold') === goldBefore + 5,
        `resources.gold reached ${goldBefore + 5} after the host grant`);
    testController.assertEqual('host grant landed in the resources bag', true, hostLanded);

    testController.assertEqual('grant from jta accepted', true,
        grantFn({ to: 'omsi', from: 'jta', itemType: 'gold', count: 2 }));
    const jtaLanded = await eventually(testController,
        () => omsiEval('resources.gold') === goldBefore + 7,
        `resources.gold reached ${goldBefore + 7} after the jta grant`);
    testController.assertEqual('cross-substrate grant landed in the resources bag', true, jtaLanded);

    // Rejections: boolean bag entries are unlock flags (undeclared),
    // unknown types and non-positive counts are refused by the bus.
    testController.assertEqual('bus rejects a boolean-flag grant', false,
        grantFn({ to: 'omsi', from: 'host', itemType: 'glasses', count: 1 }));
    testController.assertEqual('bus rejects an unknown resource', false,
        grantFn({ to: 'omsi', from: 'host', itemType: 'noSuchResource', count: 1 }));
    testController.assertEqual('bus rejects a non-positive count', false,
        grantFn({ to: 'omsi', from: 'host', itemType: 'gold', count: 0 }));
    testController.assertEqual('rejections left the bag unchanged',
        goldBefore + 7, omsiEval('resources.gold'));
    testController.assertEqual('boolean flag untouched', false, omsiEval('resources.glasses'));

    // D4 made visible: the game's OWN loop reset wipes the per-loop
    // resources bag — granted consumables evaporate with it, by design.
    // restartLoop → restart() → resetResources(); the bridge's
    // no-progress guard keeps this idle restart from ping-ponging a
    // host loop reset.
    testController.log('Restarting the loop via IdleLoopsManaged.restartLoop()…');
    omsiEval('IdleLoopsManaged.restartLoop()');
    const wiped = await eventually(testController,
        () => omsiEval('resources.gold') === 0,
        'granted gold wiped by the native loop reset');
    testController.assertEqual('granted items live by the native reset semantics', true, wiped);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-cross-substrate-item-grant',
    name: 'Omsi: cross-substrate item grants land in the resources bag',
    description: 'Grants gold to \'omsi\' over the resourceChannels bus (from '
               + '\'host\' and from \'jta\'); the bridge deposits via the engine\'s '
               + 'own addResource. Asserts the declared type list matches the '
               + 'engine\'s numeric resourcesTemplate entries, boolean/unknown '
               + 'grants are rejected, and the game\'s own loop reset wipes the '
               + 'granted resources (D4 native clearing).',
    testFunction: omsiCrossSubstrateItemGrant,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
