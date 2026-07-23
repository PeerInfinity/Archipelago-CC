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
} from '../../jtaSubstrateWrapper/test-helpers.js';

/** True if the snapshot lists `name` among its checked locations. */
function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

/**
 * Park a Manual loops block on `region` so the zone's live actions (AP
 * location checks from task completions) pass the M3b strict action gate
 * via the `parkedLivePlay` exemption.
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
 * Returns a restore handle, or null if loop mode is off (gate inactive —
 * no parking needed) or the block could not be parked.
 */
async function parkManualBlockInRegion(testController, region, targetRegion, exitId) {
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
    loopStateSingleton.setBlockMode(region, visit.instance, 'manual');
    const savedSpeed = loopStateSingleton.gameSpeed;
    loopStateSingleton.setGameSpeed(10000); // hurry the arrival move to the park
    loopStateSingleton.startProcessing();
    const parked = await testController.pollForCondition(
        () => loopStateSingleton._manualActionEntered === true,
        `queue parked on the Manual block in ${region}`,
        8000, 100);
    if (!parked) {
        testController.log(`queue did not park on the Manual block in ${region}`);
        return null;
    }
    return { loopStateSingleton, savedSpeed, gs };
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

async function botWalkToExit(testController) {
    const win = await enterJtaRegion(testController);
    if (!win) return testController.getOverallResult();

    const controller = substrateRegistry.get('jta')?.getPlaybackController?.();
    testController.assertEqual('registry exposes a live PlaybackController', true, !!controller);
    if (!controller) return testController.getOverallResult();

    // The preset's zone-0 exit (sidecar exitName format "src -> dst").
    const exitName = `${JTA_TEST_REGION} -> The Village Watch`;
    const targetRegion = 'The Village Watch';

    // Instant Mode so each task completes in one tick; then ask the
    // bot to take the exit — exactly what loops' executeVia queue
    // execution dispatches for a regionMove action.
    //
    // The zone is played by the game's automation (policy 'activate'),
    // which at fresh skills costs MORE than one 100-mana loop: the pool
    // empties, the loop resets (skills persist), and the walk must be
    // re-dispatched — in real usage loops' parked-action retry does
    // that; the test emulates it on every observed loop reset. Skills
    // compound across attempts until the zone completes in one loop.
    controller.instant();
    controller.walkTo({ kind: 'exit', name: exitName });
    testController.log(`walkTo dispatched toward '${exitName}'…`);

    let lastResets = readLoopResetCount();
    let arrived = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 400));
        if (readCurrentRegion() === targetRegion) { arrived = true; break; }
        const resets = readLoopResetCount();
        if (resets !== lastResets) {
            lastResets = resets;
            // The reset teleport may land on a non-jta start region
            // (Menu); the real loops queue walks back via its earlier
            // regionMove actions — emulate that, then re-dispatch the
            // parked walk.
            if (readCurrentRegion() === targetRegion) { arrived = true; break; }
            if (readCurrentRegion() !== JTA_TEST_REGION) {
                moveToRegion(JTA_TEST_REGION, readCurrentRegion());
            }
            const active = await eventually(
                testController,
                () => getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === false,
                'jta region active again after loop reset',
                10000,
            );
            if (!active) continue;
            controller.walkTo({ kind: 'exit', name: exitName });
            testController.log(`loop reset #${resets} — walkTo re-dispatched`);
        }
    }
    testController.assertEqual('bot walked to the target region', true, arrived);
    testController.log(`arrived after ${lastResets} loop reset(s)`);
    if (!arrived) return testController.getOverallResult();

    // Regression (user-reported): synthetic exit-task ids must be
    // STABLE across re-entries — the game's per-zone automation
    // priorities reference task ids, so a player who prioritizes
    // "Go East" must find the same id live next visit.
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

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-bot-walkto-exit',
    name: 'JtA: playback controller walkTo drives the zone and takes the exit',
    description: 'Gets the jta PlaybackController from the substrate registry, '
               + 'enables Instant Mode, and walkTo()s the zone-0 exit: the bridge '
               + 'drives mandatory+travel tasks to completion and dispatches the '
               + 'requested regionMove — the loops executeVia path end-to-end.',
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
 * whose completeTaskInstantly is affordability-blind). Energy is topped up as
 * we go, so affordability is never the thing under test here.
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
