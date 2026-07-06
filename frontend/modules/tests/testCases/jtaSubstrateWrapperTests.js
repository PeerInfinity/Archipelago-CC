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
 * All tests load the jta_substrate_test preset (regions = JtA zone
 * names, manaEnabled sidecars, start region Menu) and drive the REAL
 * iframe + bridge; game state is manipulated through the fork's
 * window hooks, exactly the surface the bridge itself uses.
 */

import { registerTest } from '../testRegistry.js';
import {
    JTA_TEST_PRESET_PATH,
    JTA_TEST_REGION,
    JTA_TEST_START_REGION,
    waitForJtaActive,
    moveToRegion,
    readPool,
    readLoopResetCount,
    readCurrentRegion,
    readExpectedResetTarget,
    getJtaIframe,
    eventually,
} from '../../jtaSubstrateWrapper/test-helpers.js';

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
    // must follow up (jta:bridgeGainMana → gameState.gainMana).
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

registerTest({
    id: 'jta-energy-mirrors-pool-both-ways',
    name: 'JtA: energy drains AND gains mirror into the shared pool',
    description: 'Moves JtA energy down then up via the fork\'s setEnergy hook and '
               + 'asserts the shared mana pool follows in both directions '
               + '(jta:bridgeDeductMana / jta:bridgeGainMana).',
    testFunction: energyMirrorsPoolBothWays,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
