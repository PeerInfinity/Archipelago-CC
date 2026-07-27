/**
 * Region splitting, end to end (arc C) and the per-region authored plans that
 * ride the same swap (arc D1 slice 3). This is the INDEPENDENT STRATUM the
 * byte-gate can't provide: the region-overlay machinery is managed-mode-only
 * and off the vanilla path, so only a real managed round-trip through the real
 * bridge + real fork can witness it.
 *
 * Fixture: the omsi_region_split_test preset (regenerate with
 * scripts/test/generate-omsi-region-split-test-preset.mjs) — a maze start +
 * TWO omsi zones, BOTH town 0, each carrying a `world.omsiRegion` overlay
 * descriptor gated on 'Wander' FULLY explored — where "fully" is the REGION's
 * own ceiling, `exploreMaxLevel: 10` = 5500 exp (arc D2 slice 2b), not the
 * town's 505000 — with a direct graph edge between them. Entering a zone swaps
 * its per-region value props live.
 *
 * The FIRST leg drives one full round-trip:
 *   enter r0 -> r0 is FRESH -> exit gate is CLOSED (0% explored)
 *   explore r0 to the threshold + bank some state -> gate OPENS
 *   take the synthetic exit to r1 -> r1 has its OWN FRESH Explore level
 *   (r0's state is now stashed host-side) -> bank different r1 state
 *   take the exit back to r0 -> r0's state is restored intact.
 *
 * The synthetic exit ACTION registration / census-exclusion / gate predicate
 * are pinned headlessly by the fork's region-overlay.test.mjs; this leg proves
 * the whole host+fork loop, including that taking a synthetic exit's finish()
 * dispatches user:regionMove and the host swaps the region.
 *
 * The second leg drives the same round trip to witness the PLAN swap, which
 * only a real managed round trip can see either:
 *   r0 entered fresh -> EMPTY plan -> author one (plus its synthetic exit)
 *   cross to r1 -> r1's plan is EMPTY, r0's is stashed WITHOUT the exit entry
 *   author a different r1 plan -> return -> r0's plan is back intact
 *
 * Since arc D1 the round trip runs from PARKED MANUAL BLOCKS. omsi declares
 * record + playback, which arms the M3b strict action gate, and a synthetic
 * exit crossing carries a REAL exit name — so unlike the suite's exit-less
 * repositions it is a performed player action, blocked unless the queue is
 * parked on the region it leaves. Queueing the round trip is therefore not a
 * test workaround: it is what playing a split world in loop mode is.
 */

import { registerTest } from '../testRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import {
    OMSI_REGION_SPLIT_PRESET_PATH,
    OMSI_REGION_SPLIT_R0,
    OMSI_REGION_SPLIT_R1,
    OMSI_REGION_SPLIT_R0_TO_R1,
    OMSI_REGION_SPLIT_R1_TO_R0,
    OMSI_REGION_SPLIT_MAZE,
    OMSI_REGION_SPLIT_MAZE_TO_R0,
    waitForOmsiActive,
    waitForOmsiBridge,
    resetOmsiEngineProgress,
    resetOmsiSaveAndReload,
    moveToRegion,
    omsiEval,
    omsiClearQueue,
    omsiAppendAction,
    omsiReadQueue,
    bridgeState,
    parkManualBlocks,
    unparkManualBlocks,
    watchRegionMoves,
    gameStateFn,
    readPool,
    readMaxPool,
    readCurrentRegion,
    readLoopResetCount,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

// Gate (arc D2 slice 2b): the fixture's regions cap Explore at level 10, so
// "fully explored" is expFromLevel(10) = 5500 exp, not the town's 505000.
// EXPLORE_ABOVE is the cap exactly — which is also where finishProgress clamps,
// so a Wander landing between the write and the read cannot drift it.
const EXPLORE_ABOVE = 5500;
const R1_MARK = 3000;   // a distinct expWander value banked in r1 (gate shut)

/** The synthetic exit-action name whose move targets `region`, or null. */
function exitToward(region) {
    const exits = bridgeState()?.syntheticExits ?? [];
    return exits.find((e) => e.targetRegion === region)?.name ?? null;
}

/** Enter an omsi region and wait until the bridge reports it active. */
async function enterRegion(testController, region, source = null) {
    moveToRegion(region, source);
    const win = await waitForOmsiActive(testController);
    if (win) omsiClearQueue();   // keep the engine from stepping our set state
    return win;
}

async function regionRoundTrip(testController) {
    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return testController.getOverallResult();
    // Normalize persistent progress (the managed game outlives tests).
    resetOmsiEngineProgress(['Wander']);

    // ── Enter r0: a FRESH region, gate CLOSED ───────────────────────────────
    const win = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();
    testController.assertEqual('bridge active in r0', OMSI_REGION_SPLIT_R0, bridgeState()?.activeRegionId);

    // Arc D1 arms the M3b strict action gate for omsi, and unlike the
    // tests' synthetic exit-less repositions, a SYNTHETIC EXIT crossing
    // carries a real exit name — a performed player action, blocked unless
    // the queue is parked on the region it leaves. Queue the whole round
    // trip as Manual blocks: parking on r0 lets the first crossing through,
    // which completes that block and parks the next one on r1 for the
    // return. (The strict gate's own semantics, not a test workaround —
    // this is what playing a split world in loop mode looks like.)
    const park = await parkManualBlocks(testController, [
        { from: OMSI_REGION_SPLIT_R0, to: OMSI_REGION_SPLIT_R1, exit: OMSI_REGION_SPLIT_R0_TO_R1 },
        { from: OMSI_REGION_SPLIT_R1, to: OMSI_REGION_SPLIT_R0, exit: OMSI_REGION_SPLIT_R1_TO_R0 },
    ]);
    testController.assertEqual('parked Manual blocks for the round trip', true, !!park);
    if (!park) return testController.getOverallResult();
    try {
        return await roundTripLegs(testController);
    } finally {
        unparkManualBlocks(park);
    }
}

/** The round trip itself, run with both region blocks parked Manual. */
async function roundTripLegs(testController) {
    testController.assertEqual('r0 Explore starts fresh', 0, Number(omsiEval('towns[0].expWander')));
    testController.assertEqual('r0 exit gate closed at 0% explored', false, bridgeState()?.regionExitAvailable);

    // The synthetic exit toward r1 exists and reads as not-runnable below the gate.
    const toR1 = exitToward(OMSI_REGION_SPLIT_R1);
    testController.assertEqual('synthetic exit toward r1 injected', true, !!toR1);
    if (!toR1) return testController.getOverallResult();
    testController.assertEqual('exit to r1 not runnable below threshold', false,
        omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).canStart()`));

    // ── Explore r0 to the threshold + bank distinctive state ────────────────
    omsiEval(`towns[0].expWander = ${EXPLORE_ABOVE}; towns[0].checkedPots = 7; adjustAll();`);
    testController.assertEqual('r0 exit gate opens at threshold', true, bridgeState()?.regionExitAvailable);
    testController.assertEqual('exit to r1 runnable at/above threshold', true,
        omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).canStart()`));

    // ── Take the exit: the synthetic finish() dispatches user:regionMove ────
    omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).finish()`);
    const inR1 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R1, 'host swapped into r1');
    testController.assertEqual('taking the exit swapped into r1', true, inR1);
    if (!inR1) return testController.getOverallResult();
    omsiClearQueue();

    // r1 has its OWN fresh Explore level; r0's state was stashed host-side.
    testController.assertEqual('r1 Explore is fresh (own region state)', 0, Number(omsiEval('towns[0].expWander')));
    testController.assertEqual('r1 Pots counter is fresh', 0, Number(omsiEval('towns[0].checkedPots')));
    testController.assertEqual('r0 state stashed host-side', true,
        (bridgeState()?.regionStoreKeys ?? []).includes(OMSI_REGION_SPLIT_R0));

    // ── Bank different r1 state, then take the exit back to r0 ───────────────
    omsiEval(`towns[0].expWander = ${R1_MARK}; adjustAll();`);
    const toR0 = exitToward(OMSI_REGION_SPLIT_R0);
    testController.assertEqual('synthetic exit toward r0 injected in r1', true, !!toR0);
    if (!toR0) return testController.getOverallResult();
    omsiEval(`getActionPrototype(${JSON.stringify(toR0)}).finish()`);
    const backInR0 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R0, 'host swapped back into r0');
    testController.assertEqual('taking the exit swapped back into r0', true, backInR0);
    if (!backInR0) return testController.getOverallResult();

    // ── r0's state is restored intact; r1's is now stashed ──────────────────
    testController.assertEqual('r0 Explore restored on return', EXPLORE_ABOVE, Number(omsiEval('towns[0].expWander')));
    testController.assertEqual('r0 Pots counter restored on return', 7, Number(omsiEval('towns[0].checkedPots')));
    testController.assertEqual('r1 state stashed host-side', true,
        (bridgeState()?.regionStoreKeys ?? []).includes(OMSI_REGION_SPLIT_R1));

    resetOmsiEngineProgress(['Wander']);
    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────────────────
// Per-region authored queues (arc D1 slice 3, ruling 4)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The plans this leg authors. Both name real town-0 actions (every `Action.*`
 * is in `totalActionList` regardless of unlock state, so the bridge's
 * membership filter passes them) and both are DISTINCTIVE, so a restored plan
 * that came from the wrong region is obvious rather than plausible.
 *
 * `Smash Pots` rides along DISABLED to prove the flag round-trips, and r0's
 * synthetic exit is queued disabled as well: an enabled exit entry would fire
 * itself the moment the engine's own `Wander` progress crossed the Explore
 * gate, and the leg would race its own crossing.
 */
const R0_PLAN = [
    { name: 'Wander', loops: 3, disabled: false },
    { name: 'Smash Pots', loops: 5, disabled: true },
];
const R1_PLAN = [
    { name: 'Pick Locks', loops: 11, disabled: false },
];

/**
 * Enter a region WITHOUT clearing the plan — unlike the round-trip leg's
 * `enterRegion`, the plan is precisely what this leg measures.
 */
async function enterRegionKeepingPlan(testController, region) {
    moveToRegion(region);
    return waitForOmsiActive(testController);
}

/** Open the active region's Explore gate and take the synthetic exit toward `region`. */
function crossTo(testController, region, label) {
    const exit = exitToward(region);
    testController.assertEqual(`synthetic exit toward ${label} injected`, true, !!exit);
    if (!exit) return false;
    // Set the gate open and cross in ONE synchronous block: the bridge clock is
    // a Worker message, so nothing can tick between these two statements.
    omsiEval(`towns[0].expWander = ${EXPLORE_ABOVE}; adjustAll();`);
    omsiEval(`getActionPrototype(${JSON.stringify(exit)}).finish()`);
    return true;
}

async function perRegionQueues(testController) {
    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return testController.getOverallResult();
    resetOmsiEngineProgress(['Wander']);

    // ── r0, entered for the first time: an EMPTY plan ────────────────────────
    // Not merely "we didn't author one yet": the managed game outlives tests, so
    // an earlier leg's plan can still be live in `actions.next` right up to this
    // entry. Emptiness here is the fresh-region restore firing — with the restore
    // neutered, this leg's OTHER six conditions go red (verified by control run).
    const win = await enterRegionKeepingPlan(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();
    testController.assertEqual('bridge active in r0', OMSI_REGION_SPLIT_R0, bridgeState()?.activeRegionId);
    testController.assertEqual('r0 entered for the first time starts with an EMPTY plan',
        '[]', JSON.stringify(omsiReadQueue()));

    // Same strict-gate story as the round trip: a synthetic exit crossing
    // carries a real exit name, so both hops run from parked Manual blocks.
    const park = await parkManualBlocks(testController, [
        { from: OMSI_REGION_SPLIT_R0, to: OMSI_REGION_SPLIT_R1, exit: OMSI_REGION_SPLIT_R0_TO_R1 },
        { from: OMSI_REGION_SPLIT_R1, to: OMSI_REGION_SPLIT_R0, exit: OMSI_REGION_SPLIT_R1_TO_R0 },
    ]);
    testController.assertEqual('parked Manual blocks for the round trip', true, !!park);
    if (!park) return testController.getOverallResult();
    try {
        return await perRegionQueueLegs(testController);
    } finally {
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

/** The plan round trip itself, run with both region blocks parked Manual. */
async function perRegionQueueLegs(testController) {
    // ── Author r0's plan, plus its synthetic exit (which must NOT be stored) ──
    for (const e of R0_PLAN) omsiAppendAction(e.name, e.loops, e.disabled);
    const toR1 = exitToward(OMSI_REGION_SPLIT_R1);
    testController.assertEqual('synthetic exit toward r1 injected', true, !!toR1);
    if (!toR1) return testController.getOverallResult();
    omsiAppendAction(toR1, 1, true);
    testController.assertEqual('r0 plan authored (incl. the exit entry)',
        JSON.stringify([...R0_PLAN, { name: toR1, loops: 1, disabled: true }]),
        JSON.stringify(omsiReadQueue()));

    // ── Cross to r1: a region entered for the first time, so an EMPTY plan ────
    if (!crossTo(testController, OMSI_REGION_SPLIT_R1, 'r1')) return testController.getOverallResult();
    const inR1 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R1, 'host swapped into r1');
    testController.assertEqual('taking the exit swapped into r1', true, inR1);
    if (!inR1) return testController.getOverallResult();

    testController.assertEqual('r1 entered for the first time starts with an EMPTY plan',
        '[]', JSON.stringify(omsiReadQueue()));
    // r0's plan was stashed host-side — WITHOUT the synthetic exit entry. The
    // exit action itself is gone from the fork by now (setActiveRegion deleted
    // it), so a stored exit name would make r0's next loop start throw out of
    // translateClassNames; the dump-time strip is what prevents that.
    testController.assertEqual('r0 plan stashed host-side, synthetic exit stripped',
        R0_PLAN.length, bridgeState()?.regionQueueCounts?.[OMSI_REGION_SPLIT_R0]);
    // (Read the Action table directly — getActionPrototype console.warns on a miss.)
    testController.assertEqual('the r0 exit action is gone from the fork in r1', true,
        omsiEval(`!(${JSON.stringify(toR1.replace(/ /gu, ''))} in Action)`));

    // ── Author a DIFFERENT plan in r1, then return to r0 ─────────────────────
    for (const e of R1_PLAN) omsiAppendAction(e.name, e.loops, e.disabled);
    testController.assertEqual('r1 plan authored',
        JSON.stringify(R1_PLAN), JSON.stringify(omsiReadQueue()));

    if (!crossTo(testController, OMSI_REGION_SPLIT_R0, 'r0')) return testController.getOverallResult();
    const backInR0 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R0, 'host swapped back into r0');
    testController.assertEqual('taking the exit swapped back into r0', true, backInR0);
    if (!backInR0) return testController.getOverallResult();

    // ── r0's plan came back INTACT, and carries no synthetic-exit entry ───────
    const restored = omsiReadQueue();
    testController.assertEqual('r0 plan restored intact (order, loops and disabled flags)',
        JSON.stringify(R0_PLAN), JSON.stringify(restored));
    testController.assertEqual('restored r0 plan contains no synthetic-exit entry', true,
        restored.every((e) => !/^(Go |Take exit:)/u.test(e.name)));
    testController.assertEqual('r1 plan is now the stashed one',
        R1_PLAN.length, bridgeState()?.regionQueueCounts?.[OMSI_REGION_SPLIT_R1]);
    // A restored plan makes the region RUNNABLE again — the state slice 2's gate
    // has to hold back when nothing is parked here.
    testController.assertEqual('restored plan is the live one', R0_PLAN.length,
        bridgeState()?.queuedActionCount);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────────────────
// Record → Playback (arc D1 slice 4, ruling 1)
// ────────────────────────────────────────────────────────────────────────────

/**
 * What a Record visit captures and a Playback visit replays.
 *
 * `Wander` is the recorded plan for one reason: its completion is the ONLY
 * thing in the replayed queue that can move the region's Explore gate. The
 * leg sets Explore to 150 exp BELOW the gate and Wander grants exactly 200
 * (`finishProgress(varName, 200)`, unmultiplied on a fresh loop), so the
 * departure exit's `canStart()` is FALSE when the replay starts and can only
 * become true if the fork actually completes the recorded action.
 *
 * That is what makes the crossing an EFFECT assertion rather than an outcome
 * one: a replay that installed nothing, or degraded into a bare teleport,
 * cannot cross an exit whose gate never opened.
 */
const RECORDED_ACTION = 'Wander';
const RECORDED_LOOPS = 1;
// Gate = the region's own ceiling, expFromLevel(10) = 5500 exp (slice 2b).
// One Wander (+200) is the difference between closed and open.
const BELOW_GATE = 5350;
// The fork's native loop budget is 250 mana and one Wander costs all of it,
// so the replay only fits in ONE loop if the pool (which the bridge pins the
// budget to) is comfortably larger. A loop that ended mid-replay would still
// replay correctly — it recompiles the same plan — but it would report a run
// end, and the reset teleport would pull the player out mid-assertion.
const REPLAY_POOL_TOPUP = 2000;

async function recordPlaybackCrossesRegion(testController) {
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const { clearForRegion } = await import('../../loops/savedQueueStore.js');

    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return testController.getOverallResult();
    resetOmsiEngineProgress(['Wander']);

    const win = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();

    // A recording this leg left behind on an earlier run would make every
    // "persisted" assertion below vacuous (and could be replayed instead).
    try {
        clearForRegion(loopState._rulesHash(), OMSI_REGION_SPLIT_R0, 'omsi');
    } catch { /* best-effort */ }

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    const watcher = watchRegionMoves();
    let park = null;
    try {
        return await recordPlaybackLegs(testController, { loopState, gs, watcher, setPark: (p) => { park = p; } });
    } finally {
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

async function recordPlaybackLegs(testController, { loopState, gs, watcher, setPark }) {
    const HOP = [{
        from: OMSI_REGION_SPLIT_R0,
        to: OMSI_REGION_SPLIT_R1,
        exit: OMSI_REGION_SPLIT_R0_TO_R1,
    }];

    // ── Leg 1: RECORD — the visit recording IS the authored plan ─────────────
    // Live play drains, and this leg is about the recording's CONTENT, not its
    // affordability; a depletion reset mid-record would discard the capture.
    gs.noManaDepletionReset = true;
    const park = await parkManualBlocks(testController, HOP, 'record');
    testController.assertEqual('parked a Record block on r0', true, !!park);
    if (!park) return testController.getOverallResult();
    setPark(park);
    const instance = park.instances.get(OMSI_REGION_SPLIT_R0);

    testController.assertEqual('no recording bound to the block before recording',
        null, loopState._lookupBoundRecording(OMSI_REGION_SPLIT_R0, instance));

    const toR1 = exitToward(OMSI_REGION_SPLIT_R1);
    testController.assertEqual('synthetic exit toward r1 injected', true, !!toR1);
    if (!toR1) return testController.getOverallResult();

    // Author the plan, open the gate and cross — all in ONE synchronous block,
    // so the clock (a Worker message) cannot tick between them. The capture is
    // a SNAPSHOT of `actions.next` taken in the exit's finish(), so the plan
    // never has to be played to be recorded: that is ruling 1.
    omsiClearQueue();
    omsiAppendAction(RECORDED_ACTION, RECORDED_LOOPS);
    omsiEval(`towns[0].expWander = ${EXPLORE_ABOVE}; adjustAll();`);
    omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).finish()`);

    const inR1 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R1, 'host swapped into r1');
    testController.assertEqual('the Record visit crossed into r1', true, inR1);
    if (!inR1) return testController.getOverallResult();

    // ── The recording persisted, binds, and auto-switched ────────────────────
    const bound = loopState._lookupBoundRecording(OMSI_REGION_SPLIT_R0, instance);
    testController.assertEqual('the visit recording persisted and binds to the block', true, !!bound);
    if (!bound) return testController.getOverallResult();
    testController.log(`bound recording: ${JSON.stringify(bound.actions)} `
        + `departureExitId=${bound.departureExitId}`);
    testController.assertEqual('the recording carries the departure exit id (the stable GRAPH exit name)',
        OMSI_REGION_SPLIT_R0_TO_R1, bound.departureExitId);
    testController.assertEqual('the recording is the authored plan in shared actionQueue vocabulary',
        JSON.stringify([{ actionType: 'clickTask', actionId: RECORDED_ACTION, loops: RECORDED_LOOPS }]),
        JSON.stringify((bound.actions ?? []).map(
            (a) => ({ actionType: a.actionType, actionId: a.actionId, loops: a.loops }))));
    testController.assertEqual('the recording carries no synthetic-exit entry', true,
        (bound.actions ?? []).every((a) => !/^(Go |Take exit:)/u.test(String(a.actionId))));
    testController.assertEqual('the block auto-switched to Playback after recording',
        'playback', loopState.getBlockMode(OMSI_REGION_SPLIT_R0, instance));

    // ── Leg 2: PLAYBACK — install the recording and let the fork RUN it ──────
    moveToRegion(OMSI_REGION_SPLIT_R0, OMSI_REGION_SPLIT_R1);
    const backInR0 = await waitForOmsiActive(testController);
    testController.assertEqual('back in r0 for the replay', true, !!backInR0);
    if (!backInR0) return testController.getOverallResult();

    // Re-entering restored r0's stashed state — including the wide-open
    // Explore level leg 1 set. Put the gate just out of reach so only the
    // REPLAYED action can open it, and clear the live plan so anything in the
    // queue afterwards is unambiguously the replay's install.
    omsiEval(`towns[0].expWander = ${BELOW_GATE}; adjustAll();`);
    omsiClearQueue();
    testController.assertEqual('r0 exit gate CLOSED at replay start', false,
        bridgeState()?.regionExitAvailable);
    testController.assertEqual('the live plan is empty at replay start',
        '[]', JSON.stringify(omsiReadQueue()));

    gameStateFn('gainMana')?.(REPLAY_POOL_TOPUP);
    testController.log(`pool before the replay: ${readPool()}`);
    const actionsBefore = Number(omsiEval('totals.actions'));
    const movesBefore = watcher.moves.length;

    const park2 = await parkManualBlocks(testController, HOP, 'playback');
    testController.assertEqual('parked the Playback block on r0', true, !!park2);
    if (!park2) return testController.getOverallResult();

    // The install: the recorded plan, with the recorded departure queued LAST.
    const installed = await eventually(testController, () => {
        const q = omsiReadQueue();
        return q.length === 2 && q[0].name === RECORDED_ACTION && q[1].name === toR1;
    }, 'the replay installed the recorded plan with its departure exit LAST');
    testController.assertEqual('replay installed the recorded plan, departure exit last',
        true, !!installed);
    // …and the loop RECOMPILED onto it. Writing `actions.next` alone would
    // leave the loop already in flight running the region's previous plan —
    // for a replay that is the whole replay, since a loop ends by exhausting
    // its queue.
    testController.assertEqual('the loop recompiled onto the installed plan', true,
        omsiEval(`actions.current.some((a) => a.name === ${JSON.stringify(RECORDED_ACTION)})`) === true);
    testController.assertEqual('the bridge holds the replay window open', true,
        bridgeState()?.replayInFlight === true);
    testController.assertEqual('the replay knows which exit ends it',
        OMSI_REGION_SPLIT_R0_TO_R1, bridgeState()?.replayDepartureExitId);

    // The crossing, folded from the dispatcher rather than polled: the fork's
    // own loop ends one tick after the exit fires (its queue is spent), which
    // reports a run end and teleports the player to the loop start — so
    // "current region is r1" is a transient a poller can miss.
    const crossed = await eventually(testController,
        () => watcher.moves.slice(movesBefore).some(
            (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                && m?.targetRegion === OMSI_REGION_SPLIT_R1
                && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1
                && m?.fromLoop === true),
        'the replay crossed the recorded departure with fromLoop stamped', 60000, 200);
    testController.assertEqual(
        'Playback ran the recorded plan through the live fork and crossed the recorded exit — '
        + 'whose gate was CLOSED at replay start, so only the replayed action can have opened it',
        true, !!crossed);
    if (!crossed) {
        testController.log(`DIAG: expWander=${omsiEval('towns[0].expWander')}, `
            + `gate=${bridgeState()?.regionExitAvailable}, queue=${JSON.stringify(omsiReadQueue())}, `
            + `replayInFlight=${bridgeState()?.replayInFlight}, pool=${readPool()}`);
        return testController.getOverallResult();
    }

    const performed = Number(omsiEval('totals.actions')) - actionsBefore;
    testController.log(`fork completed ${performed} action(s) during the replay`);
    testController.assertEqual('the fork completed the recorded action and the departure', true,
        performed >= RECORDED_LOOPS + 1);
    testController.assertEqual('the replay window closed when the departure crossed',
        false, bridgeState()?.replayInFlight);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────────────────
// The MULTI-RUN replay retry (arc D slice 4b)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The same Record → Playback round trip as the leg above, but at the pool
 * size real play actually has — so the replay CANNOT finish in one run.
 *
 * `omsi_region_split_test` carries no starting-mana override, so a run's
 * budget is gameState's default maxMana 100 plus omsi's native starting-budget
 * bonus 250 ≈ 350 mana, and one `Wander` costs 250. A recorded plan whose gate
 * needs several Wanders therefore outlives its run: the fork's loop boundary is
 * reported to the host, the host fires a real loop reset, and the reset
 * TELEPORTS the player to the resolved start region — out of the region being
 * replayed, ending the replay window. The leg above sizes the pool to 2000
 * precisely to dodge that, which means the path real play takes had no
 * coverage at all.
 *
 * A multi-run replay continues not by the replay window surviving but by the
 * queue-restart RETRY: the reset snaps the cursor to 0, the queue re-routes
 * back to the region, re-enters the Playback block, and dispatches
 * replayActions again — the bridge's install is idempotent by construction.
 *
 * Hence the LEADING hop. The reset teleports to `region_0_0` (the fixture's
 * resolved start — see OMSI_REGION_SPLIT_MAZE), so the queue is
 * `region_0_0 -exit_0-> r0 -exit_to_region_1_0-> r1`: after every reset the
 * player lands on the queue's index 0 and has a route home. The maze block is
 * MANUAL and this leg walks it (a `user:regionMove` carrying the real exit,
 * gate-allowed as `parkedLivePlay`) — modelling the player walking back, and
 * keeping the omsi half honest. Playback on the maze block would not work:
 * the maze is fine-grained too, and a fine-grained Playback block with no
 * bound recording parks for live play (M4), so the queue would stall there.
 */
// Gate = the region's own ceiling, expFromLevel(10) = 5500 exp (slice 2b).
const EXPLORE_GATE = 5500;
// `<progress value="200"/>` on Wander in the fork's actionList.xml, with the
// ×4 multiplier gated on an item this fixture never grants.
const WANDER_EXP = 200;
// How many Wander completions the seeded Explore level leaves between the
// replay start and the gate. One run affords ONE Wander (250 of ~350 mana),
// so this is also the number of runs — hence the number of resets that must
// land mid-replay.
const REPLAY_RUNS = 3;
const MULTI_RUN_SEED = EXPLORE_GATE - REPLAY_RUNS * WANDER_EXP;

const MULTI_RUN_HOPS = [
    {
        from: OMSI_REGION_SPLIT_MAZE,
        to: OMSI_REGION_SPLIT_R0,
        exit: OMSI_REGION_SPLIT_MAZE_TO_R0,
        mode: 'manual',
    },
    {
        from: OMSI_REGION_SPLIT_R0,
        to: OMSI_REGION_SPLIT_R1,
        exit: OMSI_REGION_SPLIT_R0_TO_R1,
        mode: 'record',   // overridden to 'playback' for the second park
    },
];

/** MULTI_RUN_HOPS with r0's block in `mode` (record for leg 1, playback for leg 2). */
function hopsWithR0Mode(mode) {
    return MULTI_RUN_HOPS.map((h) => (h.from === OMSI_REGION_SPLIT_R0 ? { ...h, mode } : h));
}

/**
 * Walk the maze approach block if the queue is parked on it — "the player
 * walked back". Returns true when a crossing was dispatched.
 *
 * Called from the crossing poll rather than once, because the retry needs it
 * on EVERY run: each reset teleports the player back to the maze and re-parks
 * index 0 there. Counting the calls is therefore the direct witness that the
 * queue re-drove from index 0 at all — a park that never released cannot
 * produce a second one.
 */
function walkBackIfParkedOnMaze(loopState) {
    if (loopState._manualActionEntered !== true) return false;
    if (loopState._manualRegionName !== OMSI_REGION_SPLIT_MAZE) return false;
    if (readCurrentRegion() !== OMSI_REGION_SPLIT_MAZE) return false;
    moveToRegion(OMSI_REGION_SPLIT_R0, OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_MAZE_TO_R0);
    return true;
}

async function multiRunReplayRetry(testController) {
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const { clearForRegion } = await import('../../loops/savedQueueStore.js');

    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return testController.getOverallResult();
    resetOmsiEngineProgress(['Wander']);

    // Enter r0 once to normalize its per-region state (an empty plan, so the
    // Record park below starts from a known queue), then step out to the maze
    // — which is where the queue's index 0 lives.
    const win = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();
    try {
        clearForRegion(loopState._rulesHash(), OMSI_REGION_SPLIT_R0, 'omsi');
    } catch { /* best-effort */ }

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    const watcher = watchRegionMoves();
    // ── WHY THIS LEG SURVIVES ITS RESETS, made witnessable ───────────────────
    //
    // This leg runs at the natural pool with depletion resets live, and it
    // works only because the pool never quite EMPTIES: omsi's run ends at its
    // own ~350-mana budget and the reset arrives on that run end
    // (`substrate:resourceReset`), which lands while a few mana are still
    // left. Measured margin: 5–10 of 350.
    //
    // That margin is load-bearing, not incidental. A Playback park sets
    // `_manualActionEntered` exactly like a hand-play park, so if a drain ever
    // took the pool to <= 0 here, `gameState:manaChanged` would reach
    // `_handleManualWake_mana` → `_resetLoop()`, which tears the park down and
    // — `autoRestartQueue` off, the default — declines to resume. The queue is
    // then unreachable (every wake bails on the missing park) AND the step
    // gate closes on the fork, so it can never end another run to fire the
    // reset that would have revived it. That is the deadlock that made
    // `omsi-bot-instant-multi-reset-walk` a ~60 % flake (diagnosed 2026-07-26;
    // see loop-recording.md). The bot legs answer it with
    // `autoRestartQueue = true`; this leg does NOT need that, and setting it
    // here would be a control with nothing to control — measured 8/8 green
    // either way, because the branch is never taken.
    //
    // So pin the REASON instead. If a future economy change (a bigger native
    // budget, a cost tweak, an Instant variant that drains a whole run in one
    // batch) eats the margin, this fails immediately naming the pool, instead
    // of the leg hanging 180 s on a crossing that can no longer happen.
    //
    // Folded from the mutation events, never sampled: the reset refills
    // synchronously, so a poller would step straight over the low-water mark.
    // Samples are counted so the `> 0` assertion cannot pass vacuously on a
    // subscription that never fired, and the suppressed leg-1 window is
    // skipped — `noManaDepletionReset` is exactly when negative mana is legal.
    let manaLowWater = Infinity;
    let manaSamples = 0;
    let unsubMana = testController.eventBus.subscribe('gameState:manaChanged', () => {
        if (gs.noManaDepletionReset) return;
        manaSamples += 1;
        const mana = gs.getCurrentMana();
        if (mana < manaLowWater) manaLowWater = mana;
    });
    let park = null;
    try {
        await multiRunReplayLegs(testController, {
            loopState, gs, watcher, setPark: (p) => { park = p; },
        });
        // Asserted HERE, not in the `finally`: getOverallResult() is the AND of
        // the assertions made SO FAR, so anything reported after the return
        // expression has been evaluated would never reach the returned verdict.
        unsubMana?.(); unsubMana = null;
        testController.log(`pool low-water across the replay: ${manaLowWater} `
            + `(${manaSamples} unsuppressed manaChanged samples)`);
        testController.assertEqual('the drain watcher actually saw the replay spend',
            true, manaSamples > 0);
        testController.assertEqual(
            'the pool never EMPTIED — the run-end reset always beat it, which is the '
            + 'only reason this leg needs no autoRestartQueue (see the comment above)',
            true, manaLowWater > 0);
        return testController.getOverallResult();
    } finally {
        unsubMana?.();
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

async function multiRunReplayLegs(testController, { loopState, gs, watcher, setPark }) {
    // ── Leg 1: RECORD, entered THROUGH the maze ──────────────────────────────
    // The recording binds by `(region, arrivalKey, ordinal)`, and arrivalKey is
    // the exit the block was entered by — so the Record visit has to happen on
    // the same two-hop path the replay will run, or the Playback block would
    // find nothing bound to it.
    gs.noManaDepletionReset = true;
    moveToRegion(OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_R0);
    const park = await parkManualBlocks(testController, hopsWithR0Mode('record'));
    testController.assertEqual('parked the maze approach + a Record block on r0', true, !!park);
    if (!park) return testController.getOverallResult();
    setPark(park);

    testController.assertEqual('the queue parked on the maze approach block first',
        OMSI_REGION_SPLIT_MAZE, loopState._manualRegionName);
    walkBackIfParkedOnMaze(loopState);
    const recording = await eventually(testController,
        () => loopState._manualRegionName === OMSI_REGION_SPLIT_R0,
        'walking the maze approach parked the Record block on r0');
    testController.assertEqual('walking the maze approach handed the queue to r0\'s block',
        true, !!recording);
    if (!recording) return testController.getOverallResult();
    const active = await waitForOmsiActive(testController);
    testController.assertEqual('the bridge loaded r0 for the Record visit', true, !!active);
    if (!active) return testController.getOverallResult();

    const instance = park.instances.get(OMSI_REGION_SPLIT_R0);
    const toR1 = exitToward(OMSI_REGION_SPLIT_R1);
    testController.assertEqual('synthetic exit toward r1 injected', true, !!toR1);
    if (!toR1) return testController.getOverallResult();

    // Author, open the gate and cross in ONE synchronous block (the clock is a
    // Worker message, so nothing can tick between the statements).
    omsiClearQueue();
    omsiAppendAction(RECORDED_ACTION, RECORDED_LOOPS);
    omsiEval(`towns[0].expWander = ${EXPLORE_ABOVE}; adjustAll();`);
    omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).finish()`);

    const inR1 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R1, 'host swapped into r1');
    testController.assertEqual('the Record visit crossed into r1', true, inR1);
    if (!inR1) return testController.getOverallResult();

    const bound = loopState._lookupBoundRecording(OMSI_REGION_SPLIT_R0, instance);
    testController.assertEqual('the visit recording binds to the maze-entered block', true, !!bound);
    if (!bound) return testController.getOverallResult();
    testController.assertEqual('the recording carries the departure exit id',
        OMSI_REGION_SPLIT_R0_TO_R1, bound.departureExitId);

    // ── Seed r0 so the replay needs REPLAY_RUNS runs ─────────────────────────
    // Set the Explore level while r0 is loaded, then step out to the maze: the
    // seeded value is stashed with the rest of r0's per-region state and comes
    // back when the replay re-enters. Nothing can move it in between — the
    // bridge clock only runs while an omsi region is active.
    moveToRegion(OMSI_REGION_SPLIT_R0, OMSI_REGION_SPLIT_R1);
    const backInR0 = await waitForOmsiActive(testController);
    testController.assertEqual('back in r0 to seed the replay', true, !!backInR0);
    if (!backInR0) return testController.getOverallResult();
    omsiEval(`towns[0].expWander = ${MULTI_RUN_SEED}; adjustAll();`);
    omsiClearQueue();
    testController.assertEqual('r0 exit gate CLOSED at replay start', false,
        bridgeState()?.regionExitAvailable);
    testController.assertEqual(`Explore seeded ${REPLAY_RUNS} Wanders below the gate`,
        MULTI_RUN_SEED, Number(omsiEval('towns[0].expWander')));
    moveToRegion(OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_R0);

    // ── Leg 2: PLAYBACK at the pool real play has ────────────────────────────
    // No top-up: the natural pool is the point of this leg. Depletion resets
    // are exactly what it is here to survive, so the Record leg's suppression
    // comes back off.
    gs.noManaDepletionReset = false;
    testController.log(`pool before the replay: ${readPool()} / ${readMaxPool()}`);
    const actionsBefore = Number(omsiEval('totals.actions'));
    const resetsBefore = readLoopResetCount();
    const movesBefore = watcher.moves.length;

    const park2 = await parkManualBlocks(testController, hopsWithR0Mode('playback'));
    testController.assertEqual('parked the maze approach + the Playback block on r0',
        true, !!park2);
    if (!park2) return testController.getOverallResult();

    let walkBacks = 0;
    const crossed = await eventually(testController, () => {
        if (walkBackIfParkedOnMaze(loopState)) walkBacks += 1;
        return watcher.moves.slice(movesBefore).some(
            (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                && m?.targetRegion === OMSI_REGION_SPLIT_R1
                && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1
                && m?.fromLoop === true);
    }, 'the replay crossed the recorded departure after grinding across resets', 180000, 250);
    const moves = watcher.moves.slice(movesBefore);
    testController.log(`walk-backs: ${walkBacks}; moves during the replay: `
        + JSON.stringify(moves.map((m) => `${m.sourceRegion}->${m.targetRegion}`
            + `${m.exitName ? ` via ${m.exitName}` : ''}${m.fromReset ? ' [reset]' : ''}`
            + `${m.fromLoop ? ' [loop]' : ''}`)));
    testController.assertEqual(
        'Playback ran the recorded plan through the live fork and crossed the recorded exit — '
        + 'at the pool real play has, so the plan could not fit in one run',
        true, !!crossed);
    if (!crossed) {
        testController.log(`DIAG: expWander=${omsiEval('towns[0].expWander')}, `
            + `gate=${bridgeState()?.regionExitAvailable}, queue=${JSON.stringify(omsiReadQueue())}, `
            + `replayInFlight=${bridgeState()?.replayInFlight}, pool=${readPool()}, `
            + `region=${readCurrentRegion()}, manualRegion=${loopState._manualRegionName}, `
            + `manualEntered=${loopState._manualActionEntered}, `
            + `isProcessing=${loopState.isProcessing}, index=${loopState.currentActionIndex}, `
            + `boundReplayCheckedIndex=${loopState._boundReplayCheckedIndex}, `
            + `resets=${readLoopResetCount() - resetsBefore}`);
        return testController.getOverallResult();
    }

    // ── A reset really did interrupt the replay ──────────────────────────────
    // The EFFECT that makes this leg different from the single-run one: not
    // "the replay finished" but "the replay was cut in half by a loop reset
    // and picked itself back up". Folded from the dispatcher, because the
    // teleport is a transient a poller can miss.
    const resetMoves = moves.filter((m) => m?.fromReset === true);
    testController.assertEqual('a loop reset teleport interrupted the replay', true,
        resetMoves.length >= 1);
    testController.assertEqual('every reset teleport landed on the queue\'s index-0 region',
        true, resetMoves.every((m) => m?.targetRegion === OMSI_REGION_SPLIT_MAZE));
    // The queue re-drove from index 0 after each of those: a park that never
    // released could not produce a second walk-back.
    testController.assertEqual('the queue re-parked on index 0 after each reset', true,
        walkBacks >= 2);
    testController.assertEqual('loops counted the interrupting resets', true,
        readLoopResetCount() - resetsBefore >= 1);

    // ── …and the fork really ground, rather than being teleported through ────
    // The crossing alone is not enough here: a Playback block that fell
    // through to the generic executor would dispatch the same regionMove with
    // the same fromLoop stamp without replaying anything. Only the fork's own
    // completed-action count separates the two, and a single-run replay could
    // not reach REPLAY_RUNS Wanders.
    const performed = Number(omsiEval('totals.actions')) - actionsBefore;
    testController.log(`fork completed ${performed} action(s) across the replay`);
    testController.assertEqual(
        `the fork completed the recorded plan more than once (${REPLAY_RUNS} Wanders + the departure)`,
        true, performed >= REPLAY_RUNS + 1);
    testController.assertEqual('the replay window closed when the departure crossed',
        false, bridgeState()?.replayInFlight);

    return testController.getOverallResult();
}

// ────────────────────────────────────────────────────────────────────────────
// Playback × INSTANT (Instant-policy pass, slice 1)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The same recorded plan replayed TWICE — paced, then Instant — in one leg.
 *
 * Running both is what makes the duration bound mean something. An absolute
 * threshold ("under 3 s") would encode this machine's speed and would go
 * amber on a loaded CI box; a RATIO between two replays of the identical plan,
 * measured back to back, is self-calibrating. And it is the assertion the
 * feature is actually about: a silent fallback to paced stepping — the exact
 * failure a `case 'instant'` that logs-and-drops would produce — passes every
 * correctness assertion here and fails only this one.
 *
 * The second half is the in-app echo of the byte-identity contract that
 * clockGate.test.js pins headlessly: the two replays must produce the SAME
 * effects (same actions completed, same gate opened, same exit crossed). A
 * pump that changed results would not be a pump.
 *
 * The pool is topped up so each replay fits in ONE run, deliberately:
 * multi-run replay under Instant is round-trip-bound, not tick-bound, so a
 * multi-run variant would measure the host round trip rather than the pump.
 * The single-run shape is where the pump's effect is actually visible.
 *
 * The queue still carries the MAZE APPROACH hop even so — see instantHops for
 * the two reasons, one of which (the post-crossing reset teleport landing
 * between the two replays) only bites a leg that replays more than once.
 */
// Three Wanders (600 exp) below the region ceiling, so the replayed plan has
// to complete all three before the departure gate opens — long enough that
// paced (750 ticks ≈ 15 s at 50 ticks/s) and Instant are far apart.
const INSTANT_REPLAY_LOOPS = 3;
const INSTANT_REPLAY_SEED = EXPLORE_GATE - INSTANT_REPLAY_LOOPS * WANDER_EXP;
// One Wander costs the fork's whole native 250-mana budget, so three need
// 750 plus the departure — topped well past that to keep it inside one run.
const INSTANT_REPLAY_TOPUP = 4000;
// Instant must beat paced by at least this factor. The real gap is ~15 s vs
// a few hundred ms; 3× leaves enormous headroom for a loaded machine while
// still being unreachable for a paced fallback (which would score ~1×).
const INSTANT_SPEEDUP_MIN = 3;

/** The bridge's cumulative pump counters, or zeros before the first pump. */
function pumpStats() {
    const s = bridgeState()?.clockStats ?? {};
    return {
        ticks: Number(s.pumpTicks ?? 0),
        batches: Number(s.pumpBatches ?? 0),
        collapsed: Number(s.pumpViewRequestsCollapsed ?? 0),
    };
}

/**
 * The queue this leg parks, r0's block in `mode` with `instant` set.
 *
 * The MAZE APPROACH hop is not optional, for two independent reasons — both
 * learned the hard way when a single-hop version of this leg failed:
 *
 *   1. A recording binds by `(region, arrivalKey, ordinal)`, and arrivalKey is
 *      the exit the block was entered by. Record and Playback must therefore
 *      run the SAME path, or the replay finds nothing bound to it.
 *   2. The fork's loop ends one tick after a departure fires (its queue is
 *      spent), which reports a run end; the host answers with a loop reset
 *      whose teleport lands on the queue's index-0 region. With no approach
 *      hop the player ends up in the maze with no queued route home, and the
 *      NEXT replay can never park. Harmless in the single-run leg, where that
 *      teleport happens after the last assertion — but this leg runs two
 *      replays back to back, so it lands squarely between them.
 *
 * So the queue is `region_0_0 -exit_0-> r0 -exit_to_region_1_0-> r1`, the maze
 * block is Manual, and the leg walks it — the player walking back.
 */
function instantHops(mode, instant) {
    return MULTI_RUN_HOPS.map((h) => (h.from === OMSI_REGION_SPLIT_R0
        ? { ...h, mode, instant }
        : h));
}

async function omsiPlaybackInstant(testController) {
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const { clearForRegion } = await import('../../loops/savedQueueStore.js');

    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return testController.getOverallResult();
    resetOmsiEngineProgress(['Wander']);

    const win = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();
    try {
        clearForRegion(loopState._rulesHash(), OMSI_REGION_SPLIT_R0, 'omsi');
    } catch { /* best-effort */ }

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    const watcher = watchRegionMoves();
    let park = null;
    try {
        return await omsiPlaybackInstantLegs(testController, {
            loopState, gs, watcher, setPark: (p) => { park = p; },
        });
    } finally {
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

/**
 * Run one replay of the bound recording and time it.
 *
 * Returns the wall time to the crossing, the actions the fork completed, and
 * how much of the stepping went through the PUMP — the last being the
 * positive witness that Instant engaged at all (a paced replay must score
 * exactly zero, or the "Instant" leg is measuring nothing).
 */
/**
 * Put the player back in r0 from wherever they are, and stay until it sticks.
 *
 * Both callers need this and neither can assume a source region: after a
 * replay crosses, the fork's loop ends (its queue is spent), the host answers
 * with a loop reset, and the teleport lands on the maze — possibly AFTER a
 * one-shot move would already have run. Re-issuing the move every poll until
 * the bridge reports r0 active is what makes that race unlosable.
 */
async function settleInR0(testController, label) {
    return eventually(testController, () => {
        const here = readCurrentRegion();
        if (here !== OMSI_REGION_SPLIT_R0) {
            moveToRegion(OMSI_REGION_SPLIT_R0, here);
            return false;
        }
        return bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R0;
    }, `settled in r0 ${label}`, 30000, 200);
}

async function timeOneReplay(testController, { loopState, watcher, instant, label }) {
    const backInR0 = await settleInR0(testController, `to stage the ${label} replay`);
    testController.assertEqual(`back in r0 to stage the ${label} replay`, true, !!backInR0);
    if (!backInR0) return null;

    // Identical starting conditions for both replays — the comparison is only
    // meaningful if the plan, the gate distance and the budget all match. The
    // seeded level is stashed with the rest of r0's per-region state when we
    // step out below, and comes back when the replay re-enters.
    omsiEval(`towns[0].expWander = ${INSTANT_REPLAY_SEED}; adjustAll();`);
    omsiClearQueue();
    testController.assertEqual(`r0 exit gate CLOSED at the ${label} replay start`, false,
        bridgeState()?.regionExitAvailable);
    gameStateFn('gainMana')?.(INSTANT_REPLAY_TOPUP);
    testController.log(`pool before the ${label} replay: ${readPool()} / ${readMaxPool()}`);

    const actionsBefore = Number(omsiEval('totals.actions'));
    const movesBefore = watcher.moves.length;
    const pumpBefore = pumpStats();

    // Step out to the maze — the queue's index 0, where the park begins.
    moveToRegion(OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_R0);

    // The clock starts BEFORE the approach walk, not at r0 entry. Starting it
    // at entry would clip the first poll interval off the measurement, and
    // clipping 100 ms off a ~300 ms Instant replay flatters the ratio. Paying
    // the approach in BOTH measurements understates the speed-up instead,
    // which is the honest direction for a bound.
    const startedAt = performance.now();
    const parked = await parkManualBlocks(testController, instantHops('playback', instant));
    testController.assertEqual(`parked the maze approach + the ${label} Playback block`,
        true, !!parked);
    if (!parked) return null;

    let walkBacks = 0;
    const crossed = await eventually(testController,
        () => {
            if (walkBackIfParkedOnMaze(loopState)) walkBacks += 1;
            return watcher.moves.slice(movesBefore).some(
                (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                    && m?.targetRegion === OMSI_REGION_SPLIT_R1
                    && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1
                    && m?.fromLoop === true);
        },
        `the ${label} replay crossed the recorded departure`, 120000, 100);
    const elapsedMs = performance.now() - startedAt;

    // r0's final Explore level, read by RE-ENTERING rather than by sampling.
    // Sampling during the replay cannot work and is how this leg first failed:
    // an Instant replay finishes between two 100 ms polls, so the poller only
    // ever saw the seed (4900) while paced caught a mid-grind value (5300) —
    // a poller cannot measure what a fast path passes through. Re-entry reads
    // the region's STASHED state, which is a settled fact rather than a
    // transient, and is equally valid for both cadences.
    const reread = await settleInR0(testController, `to read the ${label} final level`);
    const exploreAfter = reread ? Number(omsiEval('towns[0].expWander')) : null;

    const pumpAfter = pumpStats();
    const result = {
        parked,
        crossed: !!crossed,
        elapsedMs,
        performed: Number(omsiEval('totals.actions')) - actionsBefore,
        exploreAfter,
        pumpTicks: pumpAfter.ticks - pumpBefore.ticks,
        pumpBatches: pumpAfter.batches - pumpBefore.batches,
        collapsed: pumpAfter.collapsed - pumpBefore.collapsed,
    };
    testController.log(`${label} replay: crossed=${result.crossed} in `
        + `${Math.round(elapsedMs)} ms, ${result.performed} action(s), `
        + `${walkBacks} walk-back(s), pump ${result.pumpTicks} tick(s) in `
        + `${result.pumpBatches} batch(es), ${result.collapsed} view request(s) collapsed`);
    if (!result.crossed) {
        testController.log(`DIAG (${label}): expWander=${omsiEval('towns[0].expWander')}, `
            + `gate=${bridgeState()?.regionExitAvailable}, queue=${JSON.stringify(omsiReadQueue())}, `
            + `replayInFlight=${bridgeState()?.replayInFlight}, `
            + `instant=${JSON.stringify(bridgeState()?.instant)}, pool=${readPool()}`);
    }
    return result;
}

async function omsiPlaybackInstantLegs(testController, { loopState, gs, watcher, setPark }) {
    // ── Leg 1: RECORD, entered THROUGH the maze ──────────────────────────────
    // Same two-hop path the replays will run, because the recording binds by
    // the exit the block was entered by (see instantHops).
    gs.noManaDepletionReset = true;
    moveToRegion(OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_R0);
    const park = await parkManualBlocks(testController, instantHops('record', false));
    testController.assertEqual('parked the maze approach + a Record block on r0', true, !!park);
    if (!park) return testController.getOverallResult();
    setPark(park);
    const instance = park.instances.get(OMSI_REGION_SPLIT_R0);

    testController.assertEqual('the queue parked on the maze approach block first',
        OMSI_REGION_SPLIT_MAZE, loopState._manualRegionName);
    walkBackIfParkedOnMaze(loopState);
    const recording = await eventually(testController,
        () => loopState._manualRegionName === OMSI_REGION_SPLIT_R0,
        'walking the maze approach parked the Record block on r0');
    testController.assertEqual('walking the maze approach handed the queue to r0\'s block',
        true, !!recording);
    if (!recording) return testController.getOverallResult();
    const active = await waitForOmsiActive(testController);
    testController.assertEqual('the bridge loaded r0 for the Record visit', true, !!active);
    if (!active) return testController.getOverallResult();

    const toR1 = exitToward(OMSI_REGION_SPLIT_R1);
    testController.assertEqual('synthetic exit toward r1 injected', true, !!toR1);
    if (!toR1) return testController.getOverallResult();

    omsiClearQueue();
    omsiAppendAction(RECORDED_ACTION, INSTANT_REPLAY_LOOPS);
    omsiEval(`towns[0].expWander = ${EXPLORE_ABOVE}; adjustAll();`);
    omsiEval(`getActionPrototype(${JSON.stringify(toR1)}).finish()`);

    const inR1 = await eventually(testController,
        () => bridgeState()?.activeRegionId === OMSI_REGION_SPLIT_R1, 'host swapped into r1');
    testController.assertEqual('the Record visit crossed into r1', true, inR1);
    if (!inR1) return testController.getOverallResult();

    const bound = loopState._lookupBoundRecording(OMSI_REGION_SPLIT_R0, instance);
    testController.assertEqual('the visit recording binds to the block', true, !!bound);
    if (!bound) return testController.getOverallResult();
    testController.assertEqual(`the recording carries the ${INSTANT_REPLAY_LOOPS}-loop plan`,
        INSTANT_REPLAY_LOOPS, bound.actions?.[0]?.loops);

    // Both replays run at the natural pool plus a top-up, so a depletion reset
    // cannot cut either one short and skew the comparison.
    gs.noManaDepletionReset = true;

    // ── Leg 2: PACED — the control ───────────────────────────────────────────
    const paced = await timeOneReplay(testController,
        { loopState, watcher, instant: false, label: 'paced' });
    if (!paced) return testController.getOverallResult();
    testController.assertEqual('the paced replay crossed the recorded departure', true, paced.crossed);
    if (!paced.crossed) return testController.getOverallResult();
    // The control must NOT have pumped, or the comparison below is between two
    // Instant replays and proves nothing.
    testController.assertEqual('the paced replay used the paced clock, not the pump',
        0, paced.pumpTicks);

    // ── Leg 3: INSTANT — the same plan, the same distance, one flag apart ────
    const instant = await timeOneReplay(testController,
        { loopState, watcher, instant: true, label: 'instant' });
    if (!instant) return testController.getOverallResult();
    testController.assertEqual('the Instant replay crossed the recorded departure', true,
        instant.crossed);
    if (!instant.crossed) return testController.getOverallResult();

    // ── The pump really ran ──────────────────────────────────────────────────
    // Positive first: a zero here means the flag never reached the bridge, and
    // every timing assertion below would be measuring noise.
    testController.assertEqual('the bridge pumped ticks for the Instant replay', true,
        instant.pumpTicks > 0);
    testController.assertEqual('the pump ran in bounded batches, not one giant step', true,
        instant.pumpBatches > 1);
    testController.assertEqual('the pump collapsed the view request queue between batches', true,
        instant.collapsed > 0);

    // ── The duration bound: what a silent paced fallback fails ───────────────
    const speedup = paced.elapsedMs / Math.max(instant.elapsedMs, 1);
    testController.log(`paced ${Math.round(paced.elapsedMs)} ms vs instant `
        + `${Math.round(instant.elapsedMs)} ms — ${speedup.toFixed(1)}× faster`);
    testController.assertEqual(
        `the Instant replay drained at least ${INSTANT_SPEEDUP_MIN}× faster than the paced one `
        + `(measured ${speedup.toFixed(1)}×) — a fallback to paced stepping scores ~1×`,
        true, speedup >= INSTANT_SPEEDUP_MIN);

    // ── …and produced the SAME results (byte identity, in-app) ───────────────
    testController.assertEqual('both replays completed the same number of fork actions',
        paced.performed, instant.performed);
    testController.assertEqual(
        'both replays ground r0 to the same Explore level (read back by re-entering)',
        paced.exploreAfter, instant.exploreAfter);
    testController.assertEqual('…and that level really is the gate the replay had to open',
        EXPLORE_GATE, instant.exploreAfter);
    testController.assertEqual('the fork really ground the recorded plan (not a bare teleport)',
        true, instant.performed >= INSTANT_REPLAY_LOOPS + 1);
    testController.assertEqual('the replay window closed when the departure crossed',
        false, bridgeState()?.replayInFlight);
    testController.assertEqual('the pump is no longer active once the window closed',
        false, bridgeState()?.instant?.pumpActive);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-record-playback-crosses-region',
    name: 'Omsi: a recorded region plan replays through the fork and crosses the recorded exit',
    description: 'The arc D slice 4 fine-grained round trip: a parked RECORD block captures r0\'s '
               + 'authored plan when its synthetic exit fires (stashed before the departing '
               + 'regionMove, persisted by loops in shared actionQueue vocabulary with the graph '
               + 'exit id, auto-switched to Playback); the same block then replays it — the bridge '
               + 'installs the plan with the departure queued last, forces the loop to recompile, '
               + 'and the fork grinds until the recorded action opens an exit gate that was CLOSED '
               + 'when the replay started.',
    testFunction: recordPlaybackCrossesRegion,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-multi-run-replay-retry',
    name: 'Omsi: a Playback replay too big for one run grinds across loop resets',
    description: 'Arc D slice 4b: at the pool real play has (~350 mana, one Wander costs 250) a '
               + 'recorded plan outlives its run. The fork\'s loop end is reported to the host, the '
               + 'host\'s reset teleports the player to the queue\'s index-0 region, and the replay '
               + 'continues only via the generic queue-restart retry — the queue re-drives from 0, '
               + 'routes back, re-enters the Playback block and re-dispatches replayActions. The leg '
               + 'walks the maze approach block each run (the player walking back) and asserts the '
               + 'reset really interrupted the replay, that the queue re-parked on index 0 each time, '
               + 'and that the fork ground more than one run\'s worth of actions.',
    testFunction: multiRunReplayRetry,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-region-split-round-trip',
    name: 'Omsi region split: a managed region round-trip swaps per-region state',
    description: 'Entering an omsi region-split zone swaps its per-region value props live: r0 is '
               + 'fresh, its Explore gate opens at the threshold, taking a synthetic exit swaps into '
               + 'a fresh r1, and returning restores r0 state intact — the region machinery the '
               + 'byte-gate cannot witness.',
    testFunction: regionRoundTrip,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-region-split-per-region-queues',
    name: 'Omsi region split: each region keeps its own authored plan',
    description: 'The fork\'s authored queue joins the region swap (arc D slice 3): a region entered '
               + 'for the first time starts with an empty plan, the plan authored in r0 is stashed on '
               + 'exit — minus its synthetic-exit entry, whose action no longer exists on return — and '
               + 'comes back intact (order, loops, disabled flags) while r1 keeps its own.',
    testFunction: perRegionQueues,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────────────────
// The Bot: the fork's own automation planner as the solver (arc D2 slice 3)
// ────────────────────────────────────────────────────────────────────────────

/**
 * What a Bot block on an omsi region actually does, and what these two legs
 * are here to witness.
 *
 * loops reaches a BOT-mode block whose action is a `regionMove` out of an omsi
 * region, parks it (`isProcessing` stays true), and dispatches
 * `walkTo({kind:'exit', name})` on omsi's PlaybackController. The bridge opens
 * a BOT WINDOW: it engages the fork's Advanced Automation planner, the fork
 * grinds loop after loop under it, and at the first HELD BOUNDARY where
 * `regionExitAvailable()` has become true the bridge installs an exit-only
 * plan and disengages — the fork's own queue does the crossing.
 *
 * ⚠ THE AWARD PATH IS THE CROSSING ITSELF, and that is not a shortcut. Slice 2
 * ruled stamping NONE: `_botExecutedAction` gives loops' strict action gate a
 * blanket `queueExecution` pass BEFORE any `fromLoop` flag is consulted
 * (loopState.evaluateActionGate). A departing synthetic exit carries a REAL
 * exit name, so it is a performed player action the gate would otherwise
 * BLOCK — and `livePlayRegion()` is null while a solver drives, so the
 * `parkedLivePlay` exemption the Manual legs ride is unavailable. If the
 * exemption did not cover the bot window the departure would be swallowed and
 * the block would never complete. Both legs therefore assert the crossing
 * arrived UNSTAMPED (`fromLoop !== true`) with `livePlayRegion()` null, and
 * leg A additionally pins the gate's own verdict on a location check —
 * `queueExecution` inside the window, BLOCKED outside it. That verdict is the
 * award path: an AP location check fired mid-grind rides exactly this
 * exemption.
 *
 * (No AP location can actually fire in this fixture: split worlds emit no
 * unlock locations by arc-C ruling 7, and the one victory location needs town
 * 1 unlocked — thousands of loops away. Asserting the gate verdict is the
 * honest observation available, and it is the mechanism the award depends on.)
 */

/** Wrap a live controller method so calls can be counted, THROWING if it is gone. */
function spyOnOmsiController(controller, method, log) {
    if (!controller) throw new Error('omsi PlaybackController is missing — nothing to observe');
    if (typeof controller[method] !== 'function') {
        throw new Error(`omsi PlaybackController.${method} is missing — cannot observe the bot`);
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

/** MULTI_RUN_HOPS with r0's block in Bot mode. */
const BOT_HOPS = () => hopsWithR0Mode('bot');

/**
 * Leg A's seed: one Wander (200 exp) short of the gate.
 *
 * The planner must still CHOOSE to explore — this only makes the choice cheap
 * enough that a short grind proves engagement without the leg having to sit
 * through the measured 44 loops a from-scratch region costs. Leg B is the one
 * that pays that price on purpose.
 */
const BOT_NEAR_GATE_SEED = EXPLORE_GATE - WANDER_EXP;
/**
 * Leg B's seed: far enough below the gate that no single fork loop can reach
 * it. One fork loop affords ONE Wander (250 of ~350 mana), so a seed TWO
 * Wanders short guarantees a boundary — and therefore a host reset, a
 * teleport, and a re-dispatch — before the crossing.
 *
 * Two, not more, because a bot walk is expensive in WALL TIME and the cost is
 * inherent: the bridge steps the fork at 50 ticks/s of real time, so one
 * ~350-mana loop is ~7 s, and each loop end is followed by a full host round
 * trip (report, reset, teleport, walk back, re-dispatch, re-engage). The
 * planner also does not spend every loop exploring — it invests first — so
 * even a one-Wander gap takes several loops in practice. Measured in-app:
 * ~12 s per round trip, ~1 Wander per 6-7 of them.
 */
const BOT_MULTI_RUN_SEED = EXPLORE_GATE - 2 * WANDER_EXP;

/** The bridge's view of the bot window, or an empty object. */
const botState = () => bridgeState()?.bot ?? {};

/**
 * Poll for `fn`, walking the maze approach block back on EVERY iteration.
 *
 * This is not a convenience — it is the shape a bot leg has to have. An omsi
 * bot walk is a sequence of host round trips, not one continuous grind: the
 * fork ends a loop, reports it, the host resets and teleports the player to
 * the queue's index-0 maze region, and the bot window closes. Nothing moves
 * again until the player walks back and the block re-dispatches. A poll that
 * waits for ANY bot-side condition without walking back therefore waits
 * forever — the first version of these legs did exactly that and timed out
 * with `livePlayRegion` sitting on the maze.
 *
 * `progress.walkBacks` counts the round trips, which is also the multi-reset
 * leg's direct witness that the queue re-drove from index 0.
 */
function pollWalkingBack(testController, loopState, progress, fn, label, timeoutMs, intervalMs = 250) {
    return eventually(testController, () => {
        if (walkBackIfParkedOnMaze(loopState)) progress.walkBacks += 1;
        if (botState().inFlight === false) progress.windowEnded = true;
        return fn();
    }, label, timeoutMs, intervalMs);
}

/**
 * Enter r0, seed its Explore level, and step back out to the maze — the
 * queue's index-0 region and where both legs start.
 *
 * The seed is stashed with the rest of r0's per-region state on the way out
 * and comes back when the bot re-enters; nothing can move it in between,
 * because the bridge clock only runs while an omsi region is active.
 */
async function seedR0Explore(testController, exp) {
    const inR0 = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.assertEqual('entered r0 to seed its Explore level', true, !!inR0);
    if (!inR0) return false;

    // A FRESH game, not just zeroed Explore vars. The planner scores every
    // action against the stats and progress already banked, so an inherited
    // part-played save makes it prefer different plans — and a bot leg that
    // depends on which tests ran first is worthless. `resetOmsiEngineProgress`
    // is no substitute: it zeroes town-progress vars in the live engine and
    // leaves skills, talents and the save alone.
    //
    // It has to happen HERE, with an omsi region already active: the reset
    // reloads the iframe and waits for the bridge clock to run again, and the
    // clock only runs while the player is standing in an omsi region.
    const fresh = await resetOmsiSaveAndReload(testController);
    testController.assertEqual('fresh omsi game active after save reset', true, !!fresh);
    if (!fresh) return false;
    resetOmsiEngineProgress(['Wander']);

    omsiEval(`towns[0].expWander = ${exp}; adjustAll();`);
    omsiClearQueue();
    testController.assertEqual('r0 exit gate CLOSED at the seeded level', false,
        bridgeState()?.regionExitAvailable);
    testController.assertEqual('Explore seeded below the gate', exp,
        Number(omsiEval('towns[0].expWander')));
    moveToRegion(OMSI_REGION_SPLIT_MAZE, OMSI_REGION_SPLIT_R0);
    return true;
}

/** Shared boot for both bot legs. Returns null when the fixture never came up. */
async function bootBotFixture(testController, seed) {
    testController.log(`Loading ${OMSI_REGION_SPLIT_PRESET_PATH}…`);
    await testController.loadRulesFromFile(OMSI_REGION_SPLIT_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return null;

    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const gs = getGameStateSingleton();
    const loopOn = await eventually(testController,
        () => gs.isLoopModeActive === true, 'loop mode active (auto-enabled by loop_costs)', 5000);
    testController.assertEqual('loop mode active (auto-enabled by loop_costs)', true, !!loopOn);
    if (!loopOn) return null;

    if (!(await seedR0Explore(testController, seed))) return null;
    return { loopState, gs };
}

/**
 * The pre-engagement value of the one automation option whose restoration is
 * observable from the host: a Bot visit must not leave the planner armed for
 * the Manual visit that follows.
 */
const readAutomationEnabled = () => omsiEval('options.advancedAutomationEnabled');

async function botCrossesRegion(testController) {
    const booted = await bootBotFixture(testController, BOT_NEAR_GATE_SEED);
    if (!booted) return testController.getOverallResult();
    const { loopState, gs } = booted;

    const controller = substrateRegistry.get('omsi')?.getPlaybackController?.();
    const walkToSpy = spyOnOmsiController(controller, 'walkTo', (m) => testController.log(m));
    const watcher = watchRegionMoves();
    const savedNoReset = gs.noManaDepletionReset;
    // Switch Advanced Automation ON as a player might have, so the restore
    // assertion at the end is a REAL pin. Left at the fork's default it reads
    // false both before and after, and a bot that clobbered the option would
    // pass — which is exactly how the bug this catches would have shipped.
    omsiEval('setOption("advancedAutomation", true); setOption("advancedAutomationEnabled", true);');
    const automationBefore = readAutomationEnabled();
    let park = null;
    try {
        const movesBefore = watcher.moves.length;
        const progress = { walkBacks: 0, windowEnded: false };
        park = await parkManualBlocks(testController, BOT_HOPS());
        testController.assertEqual('parked the maze approach + a Bot block on r0', true, !!park);
        if (!park) return testController.getOverallResult();

        // ── The bot engaged the planner ──────────────────────────────────
        const engaged = await pollWalkingBack(testController, loopState, progress,
            () => loopState._botExecutedAction !== null && botState().inFlight === true,
            'the Bot block dispatched walkTo and the bridge opened its window', 30000, 100);
        testController.assertEqual('a Bot block engaged the walkTo solver', true, !!engaged);
        if (!engaged) return testController.getOverallResult();
        testController.assertEqual('loops dispatched walkTo', true, walkToSpy.calls.length >= 1);
        testController.assertEqual('walkTo targeted an exit', 'exit', walkToSpy.calls[0]?.kind);
        testController.assertEqual('walkTo named the queued r0->r1 exit',
            OMSI_REGION_SPLIT_R0_TO_R1, walkToSpy.calls[0]?.name);
        testController.assertEqual('the bridge is walking toward that exit',
            OMSI_REGION_SPLIT_R0_TO_R1, botState().targetExit);

        // ENGAGEMENT is a fork-side fact, not a host-side one: the bridge wrote
        // the planner options and the planner answered. `plannerArmed` is the
        // saved-options slot (so a disengage really has something to restore)
        // and plannerStatus is the fork's own readout.
        testController.assertEqual('the bridge armed the fork planner', true,
            botState().plannerArmed === true);
        testController.assertEqual('the fork planner is switched on', true,
            readAutomationEnabled() === true);
        // The gate's verdict IS the award path. Read it in the SAME tick the
        // window is observed open: an omsi bot walk is a chain of host round
        // trips, so the window opens and closes repeatedly and a verdict read
        // a poll later would be reading a different moment.
        let gateDuring = null;
        let liveDuring = 'unread';
        const planned = await pollWalkingBack(testController, loopState, progress, () => {
            if (!botState().inFlight) return false;
            liveDuring = loopState.livePlayRegion();
            gateDuring = loopState.evaluateActionGate({
                kind: 'location', regionName: OMSI_REGION_SPLIT_R0,
                eventName: 'user:locationCheck', data: {},
            });
            const status = botState().plannerStatus;
            return typeof status === 'string' && /plan:/iu.test(status);
        }, 'the fork planner produced a plan', 60000, 100);
        testController.assertEqual('the fork planner produced a plan', true, !!planned);
        testController.log(`planner status: ${botState().plannerStatus}`);

        // ── The strict gate's verdict IS the award path ──────────────────
        // Inside the window the only thing letting a substrate publish through
        // is the queueExecution exemption — livePlayRegion is null, so
        // parkedLivePlay is unavailable, and slice 2 ruled NO fromLoop stamp.
        testController.assertEqual('livePlayRegion is null while the solver drives',
            null, liveDuring);
        testController.assertEqual('an AP check fired mid-grind passes the strict gate',
            true, gateDuring?.allowed === true);
        testController.assertEqual('…on the queueExecution exemption, not a fromLoop stamp',
            'queueExecution', gateDuring?.reason);

        // ── The fork really ground, measured where the change is ─────────
        // Explore exp, NOT totalTicks: the clock runs for other reasons, and a
        // bot that engaged but never planned anything useful would still tick.
        const ground = await pollWalkingBack(testController, loopState, progress,
            () => Number(omsiEval('towns[0].expWander')) > BOT_NEAR_GATE_SEED,
            'the planner ground the region\'s Explore var upward', 180000, 250);
        testController.assertEqual('the planner ground Explore exp above the seed', true, !!ground);
        testController.log(`expWander: ${BOT_NEAR_GATE_SEED} -> ${omsiEval('towns[0].expWander')}`);

        // ── …until the gate opened and the exit crossed ──────────────────
        const crossed = await pollWalkingBack(testController, loopState, progress,
            () => watcher.moves.slice(movesBefore).some(
                (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                    && m?.targetRegion === OMSI_REGION_SPLIT_R1
                    && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1),
            'the bot opened the gate and crossed the queued exit', 180000, 250);
        testController.assertEqual('the bot crossed the exit it was sent to', true, !!crossed);
        if (!crossed) {
            testController.log(`DIAG: expWander=${omsiEval('towns[0].expWander')}, `
                + `gate=${bridgeState()?.regionExitAvailable}, bot=${JSON.stringify(botState())}, `
                + `queue=${JSON.stringify(omsiReadQueue())}, pool=${readPool()}, `
                + `region=${readCurrentRegion()}, walkTos=${walkToSpy.calls.length}, `
                + `walkBacks=${progress.walkBacks}, mayStep=${bridgeState()?.mayStep}`);
            return testController.getOverallResult();
        }
        const departure = watcher.moves.slice(movesBefore).find(
            (m) => m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1 && !m?.fromReset);
        testController.assertEqual('the departure was NOT fromLoop-stamped (slice-2 ruling)',
            true, departure?.fromLoop !== true);

        // ── The window closed and the player's options came back ─────────
        const restored = await eventually(testController,
            () => botState().inFlight === false && botState().plannerArmed === false,
            'the bot window closed on the departure', 15000, 200);
        testController.assertEqual('the bot window closed when the departure crossed',
            true, !!restored);
        testController.assertEqual('the player really had the planner switched on beforehand',
            true, automationBefore === true);
        testController.assertEqual(
            'a Manual visit after a Bot visit finds the options exactly as the player left them',
            automationBefore, readAutomationEnabled());
        return testController.getOverallResult();
    } finally {
        walkToSpy.restore();
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

async function botCrossesAcrossResets(testController) {
    const booted = await bootBotFixture(testController, BOT_MULTI_RUN_SEED);
    if (!booted) return testController.getOverallResult();
    const { loopState, gs } = booted;

    const controller = substrateRegistry.get('omsi')?.getPlaybackController?.();
    const walkToSpy = spyOnOmsiController(controller, 'walkTo', (m) => testController.log(m));
    const watcher = watchRegionMoves();
    // No depletion suppression: outrunning the pool is the point of this leg.
    const savedNoReset = gs.noManaDepletionReset;
    gs.noManaDepletionReset = false;
    // AUTO-RESTART IS THE PREREQUISITE FOR A MULTI-RUN WALK, not decoration.
    //
    // A walk bigger than one pool survives only if the queue survives the
    // depletions along the way, and loops has TWO depletion paths that answer
    // to this flag (blockModes.test.js pins both): the drain tick's
    // `_maybeResetForOOM`, which pauses outright when the flag is off, and
    // `_handleManualWake_mana`, whose `_resetLoop()` tears the maze park down
    // and then — flag off — declines to resume. The second one is terminal
    // HERE and nowhere else: the queue is left stopped-but-not-paused with no
    // park, every wake handler bails on the missing park, and the step gate
    // closes on the fork, so the substrate can no longer end a run and fire
    // the reset that would have revived it. The leg then polls a frozen world
    // to its timeout. (Diagnosed 2026-07-26; the same standing deadlock the
    // frozen-substrate breaker exists for.)
    //
    // Leaving it at the default worked only by accident: the depletion usually
    // lands while the BOT is driving (no park ⇒ the wake bails) rather than on
    // the maze park between runs. Which one you get is a race.
    const savedAutoRestart = loopState.autoRestartQueue;
    loopState.autoRestartQueue = true;
    let park = null;
    try {
        const movesBefore = watcher.moves.length;
        const resetsBefore = readLoopResetCount();
        const forkLoopsBefore = Number(omsiEval('totals.loops'));
        testController.log(`pool before the walk: ${readPool()} / ${readMaxPool()}`);

        const progress = { walkBacks: 0, windowEnded: false };
        park = await parkManualBlocks(testController, BOT_HOPS());
        testController.assertEqual('parked the maze approach + a Bot block on r0', true, !!park);
        if (!park) return testController.getOverallResult();

        const engaged = await pollWalkingBack(testController, loopState, progress,
            () => loopState._botExecutedAction !== null && botState().inFlight === true,
            'the Bot block dispatched walkTo and the bridge opened its window', 30000, 100);
        testController.assertEqual('a Bot block engaged the walkTo solver', true, !!engaged);
        if (!engaged) return testController.getOverallResult();

        // ── Grind across resets, walking back each time ──────────────────
        // pollWalkingBack does the walking (and records the window closing on
        // each teleport, a transient the re-dispatch immediately reopens).
        // Counting the walk-backs is the direct witness that the queue
        // re-drove from index 0 — a park that never released could not
        // produce a second one.
        const crossed = await pollWalkingBack(testController, loopState, progress,
            () => watcher.moves.slice(movesBefore).some(
                (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                    && m?.targetRegion === OMSI_REGION_SPLIT_R1
                    && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1),
            'the bot crossed after grinding across loop resets', 360000, 250);
        const moves = watcher.moves.slice(movesBefore);
        const walkBacks = progress.walkBacks;
        const windowEnded = progress.windowEnded;
        const resets = readLoopResetCount() - resetsBefore;
        const forkLoops = Number(omsiEval('totals.loops')) - forkLoopsBefore;
        testController.log(`walk-backs: ${walkBacks}; walkTo dispatches: ${walkToSpy.calls.length}; `
            + `host resets: ${resets}; fork loops: ${forkLoops}`);
        testController.log(`moves: ${JSON.stringify(moves.map((m) => `${m.sourceRegion}->${m.targetRegion}`
            + `${m.exitName ? ` via ${m.exitName}` : ''}${m.fromReset ? ' [reset]' : ''}`))}`);
        testController.assertEqual(
            'the bot crossed the queued exit at a pool too small to open the gate in one run',
            true, !!crossed);
        if (!crossed) {
            testController.log(`DIAG: expWander=${omsiEval('towns[0].expWander')}, `
                + `gate=${bridgeState()?.regionExitAvailable}, bot=${JSON.stringify(botState())}, `
                + `pool=${readPool()}, region=${readCurrentRegion()}, `
                + `manualRegion=${loopState._manualRegionName}, `
                + `isProcessing=${loopState.isProcessing}, `
                + `pausedUntilReset=${loopState._queuePausedUntilReset}, `
                + `isPaused=${loopState.isPaused}, `
                + `index=${loopState.currentActionIndex}`);
            return testController.getOverallResult();
        }

        // ── A reset really interrupted the walk ──────────────────────────
        const resetMoves = moves.filter((m) => m?.fromReset === true);
        testController.assertEqual('a loop reset teleport interrupted the walk', true,
            resetMoves.length >= 1);
        testController.assertEqual('every reset teleport landed on the queue\'s index-0 region',
            true, resetMoves.every((m) => m?.targetRegion === OMSI_REGION_SPLIT_MAZE));
        testController.assertEqual('loops counted the interrupting resets', true, resets >= 1);
        testController.assertEqual('the queue re-parked on index 0 after each reset', true,
            walkBacks >= 2);

        // ── walkTo was RE-dispatched, and the install is idempotent ──────
        // The M6 bot wake releases the park, resumes, and re-dispatches on the
        // fromReset branch. More than one walkTo is that path having run; the
        // crossing above is the proof the repeated install did not corrupt
        // anything.
        testController.assertEqual('the bot wake re-dispatched walkTo after the reset', true,
            walkToSpy.calls.length >= 2);
        testController.assertEqual('every re-dispatch named the same exit', true,
            walkToSpy.calls.every((c) => c?.name === OMSI_REGION_SPLIT_R0_TO_R1));
        testController.assertEqual('the bot window ended on the teleport\'s regionChanged-away',
            true, windowEnded);

        // ── Trap 5: no double reset per fork boundary ────────────────────
        // Both reset producers are live during a bot walk (the mirror's
        // drain-to-zero and the fork's own loop-end report), and a planner
        // pause can interleave a host reset with a held boundary. The router's
        // race guard is what collapses them; a double report would show up
        // here as more host resets than the fork had loops.
        testController.assertEqual(
            `no fork boundary produced two host resets (${resets} resets / ${forkLoops} fork loops)`,
            true, forkLoops > 0 && resets <= forkLoops);

        // ── …and the fork ground rather than being teleported through ────
        const departure = moves.find(
            (m) => m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1 && !m?.fromReset);
        testController.assertEqual('the departure was NOT fromLoop-stamped (slice-2 ruling)',
            true, departure?.fromLoop !== true);
        testController.assertEqual('the gate really opened before the crossing', true,
            Number(omsiEval('towns[0].expWander')) >= EXPLORE_GATE
                || bridgeState()?.activeRegionId !== OMSI_REGION_SPLIT_R0);
        return testController.getOverallResult();
    } finally {
        loopState.autoRestartQueue = savedAutoRestart;
        walkToSpy.restore();
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

/**
 * Bot × Instant (Instant-policy pass, slice 1) — the multi-reset walk again,
 * with the block's Instant checkbox on.
 *
 * COMPLEMENTS `omsi-bot-multi-reset-walk`, never replaces it: that leg is the
 * only real-time coverage of a bot walk, and the pump is precisely the thing
 * that would hide a real-time defect.
 *
 * Deliberately NOT duration-asserted, unlike the Playback leg. An omsi bot
 * walk is a sequence of HOST ROUND TRIPS — report, reset, teleport, walk back,
 * re-dispatch, re-engage, measured in-app at ~12 s each — and Instant collapses
 * only the ticking inside each run, not the round trips between them. A
 * speed-up ratio here would be dominated by machinery Instant does not touch,
 * so the witness is the pump COUNTER instead: the flag reached the bridge, the
 * stepping went through the pump, and the walk still crossed. That is the
 * honest claim, and `instant.botMode` is the thing that would be false if the
 * Bot half had been left as a vacuous checkbox.
 */
async function botInstantCrossesAcrossResets(testController) {
    const booted = await bootBotFixture(testController, BOT_MULTI_RUN_SEED);
    if (!booted) return testController.getOverallResult();
    const { loopState, gs } = booted;

    const controller = substrateRegistry.get('omsi')?.getPlaybackController?.();
    const walkToSpy = spyOnOmsiController(controller, 'walkTo', (m) => testController.log(m));
    const watcher = watchRegionMoves();
    const savedNoReset = gs.noManaDepletionReset;
    gs.noManaDepletionReset = false;
    // AUTO-RESTART IS THE PREREQUISITE FOR A MULTI-RUN WALK, not decoration.
    // See botCrossesAcrossResets for the full reasoning; the Instant leg needs
    // it MORE, because Instant collapses a whole fork run into one synchronous
    // pump and so lands the depletion far more often on the maze park than the
    // paced leg does.
    const savedAutoRestart = loopState.autoRestartQueue;
    loopState.autoRestartQueue = true;
    let park = null;
    try {
        const movesBefore = watcher.moves.length;
        const resetsBefore = readLoopResetCount();
        const pumpBefore = pumpStats();
        testController.log(`pool before the walk: ${readPool()} / ${readMaxPool()}`);

        const progress = { walkBacks: 0, windowEnded: false };
        park = await parkManualBlocks(testController,
            BOT_HOPS().map((h) => (h.from === OMSI_REGION_SPLIT_R0 ? { ...h, instant: true } : h)));
        testController.assertEqual('parked the maze approach + an INSTANT Bot block on r0',
            true, !!park);
        if (!park) return testController.getOverallResult();

        const engaged = await pollWalkingBack(testController, loopState, progress,
            () => loopState._botExecutedAction !== null && botState().inFlight === true,
            'the Bot block dispatched walkTo and the bridge opened its window', 30000, 100);
        testController.assertEqual('a Bot block engaged the walkTo solver', true, !!engaged);
        if (!engaged) return testController.getOverallResult();

        // The mode arrived BEFORE the walk — loopState sets it ahead of every
        // walkTo, and a checkbox that never reached the bridge is exactly the
        // vacuous control this slice exists to avoid.
        testController.assertEqual('the Instant flag reached the bridge as a bot MODE',
            true, bridgeState()?.instant?.botMode === true);

        const crossed = await pollWalkingBack(testController, loopState, progress,
            () => watcher.moves.slice(movesBefore).some(
                (m) => m?.sourceRegion === OMSI_REGION_SPLIT_R0
                    && m?.targetRegion === OMSI_REGION_SPLIT_R1
                    && m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1),
            'the Instant bot crossed after grinding across loop resets', 360000, 250);
        const moves = watcher.moves.slice(movesBefore);
        const resets = readLoopResetCount() - resetsBefore;
        const pump = pumpStats();
        const pumped = {
            ticks: pump.ticks - pumpBefore.ticks,
            batches: pump.batches - pumpBefore.batches,
            collapsed: pump.collapsed - pumpBefore.collapsed,
        };
        testController.log(`walk-backs: ${progress.walkBacks}; walkTo dispatches: `
            + `${walkToSpy.calls.length}; host resets: ${resets}; `
            + `pump: ${pumped.ticks} tick(s) in ${pumped.batches} batch(es), `
            + `${pumped.collapsed} view request(s) collapsed`);
        testController.assertEqual('the Instant bot crossed the queued exit', true, !!crossed);
        if (!crossed) {
            testController.log(`DIAG: expWander=${omsiEval('towns[0].expWander')}, `
                + `gate=${bridgeState()?.regionExitAvailable}, bot=${JSON.stringify(botState())}, `
                + `instant=${JSON.stringify(bridgeState()?.instant)}, pool=${readPool()}, `
                + `region=${readCurrentRegion()}, walkTos=${walkToSpy.calls.length}, `
                + `walkBacks=${progress.walkBacks}, `
                // The QUEUE half, which the paced leg's DIAG has always printed
                // and this one was missing: a walk that stops walking has
                // usually had its queue die under it, and the four ways it can
                // die are all distinguishable HERE and nowhere else — parked,
                // hard-paused, user-paused, completed, or (the 2026-07-26
                // diagnosis) stopped as none of those. Without them the
                // failure is indistinguishable from a fork that simply ground
                // too slowly.
                + `manualRegion=${loopState._manualRegionName}, `
                + `isProcessing=${loopState.isProcessing}, `
                + `pausedUntilReset=${loopState._queuePausedUntilReset}, `
                + `isPaused=${loopState.isPaused}, `
                + `queueCompleted=${loopState._queueCompleted}, `
                + `hasCurrentAction=${!!loopState.currentAction}, `
                + `index=${loopState.currentActionIndex}`);
            return testController.getOverallResult();
        }

        // ── The pump carried the walk ────────────────────────────────────
        testController.assertEqual('the bridge pumped ticks for the Instant bot walk', true,
            pumped.ticks > 0);
        testController.assertEqual('the pump ran in bounded batches', true, pumped.batches > 1);

        // ── …and Instant did not break the multi-reset machinery ─────────
        // The properties the real-time leg pins, re-asserted under the pump:
        // the pump yields at run boundaries precisely so these still hold.
        const resetMoves = moves.filter((m) => m?.fromReset === true);
        testController.assertEqual('a loop reset teleport interrupted the Instant walk', true,
            resetMoves.length >= 1);
        testController.assertEqual('every reset teleport landed on the queue\'s index-0 region',
            true, resetMoves.every((m) => m?.targetRegion === OMSI_REGION_SPLIT_MAZE));
        testController.assertEqual('the queue re-parked on index 0 after each reset', true,
            progress.walkBacks >= 2);
        testController.assertEqual('the bot wake re-dispatched walkTo after the reset', true,
            walkToSpy.calls.length >= 2);
        testController.assertEqual('the bot window ended on the teleport\'s regionChanged-away',
            true, progress.windowEnded);
        const departure = moves.find(
            (m) => m?.exitName === OMSI_REGION_SPLIT_R0_TO_R1 && !m?.fromReset);
        testController.assertEqual('the departure was NOT fromLoop-stamped (slice-2 ruling)',
            true, departure?.fromLoop !== true);
        return testController.getOverallResult();
    } finally {
        loopState.autoRestartQueue = savedAutoRestart;
        walkToSpy.restore();
        watcher.stop();
        gs.noManaDepletionReset = savedNoReset;
        unparkManualBlocks(park);
        omsiClearQueue();
        resetOmsiEngineProgress(['Wander']);
    }
}

registerTest({
    id: 'omsi-bot-crosses-region',
    // category 'Omsi bot walks' (not 'Omsi substrate') is load-bearing, not
    // cosmetic: it is what the `bot-walks` test batch selects on
    // (modules/tests/testBatches.js). These three drive a real game loop at
    // human pace and were ~70% of the whole substrates suite, which is what
    // pushed it past the runner's wall-clock budget. Retagging one of them
    // back to 'Omsi substrate' would silently move minutes into the fast batch.
    name: 'Omsi: a Bot block engages the fork planner and crosses the region exit',
    description: 'Arc D2 slice 3: a BOT-mode loops block on an omsi region hands its queued '
               + 'regionMove to the walkTo solver. Asserts loops dispatched walkTo at the queued '
               + 'exit, the bridge ARMED the fork\'s Advanced Automation planner and the planner '
               + 'produced a plan, the fork really ground (the region\'s Explore exp rises — not a '
               + 'tick counter), the gate opened and the exit crossed UNSTAMPED, and the window '
               + 'closed restoring the player\'s automation options. Also pins the strict action '
               + 'gate\'s own verdict mid-grind: queueExecution, which is the exemption an AP award '
               + 'fired by the planner would ride.',
    testFunction: botCrossesRegion,
    category: 'Omsi bot walks',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-bot-multi-reset-walk',
    name: 'Omsi: a Bot walk too big for one run grinds across loop resets',
    description: 'Arc D2 slice 3, the mandatory multi-reset leg: the Explore gate is seeded far '
               + 'enough away that no single fork loop can reach it, so the walk outlives its run. '
               + 'Each fork loop end reports to the host, the reset teleports the player to the '
               + 'queue\'s index-0 region, the M6 bot wake releases and re-dispatches walkTo, and '
               + 'the leg walks the maze approach back each time. Asserts the reset really '
               + 'interrupted the walk, the queue re-parked on index 0, walkTo was re-dispatched at '
               + 'the same exit (install idempotence), the bot window ended on the teleport\'s '
               + 'regionChanged-away, and no fork boundary produced two host resets (trap 5).',
    testFunction: botCrossesAcrossResets,
    category: 'Omsi bot walks',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-playback-instant',
    name: 'Omsi: Instant drains a Playback replay without changing its results',
    description: 'Instant-policy pass slice 1: the same recorded plan replayed twice, paced then '
               + 'Instant, one flag apart. Asserts the Instant replay drained at least 3x faster '
               + '(the bound a silent fallback to paced stepping fails, scoring ~1x), that the '
               + 'bridge really pumped — non-zero pump ticks in more than one bounded batch, with '
               + 'the view request queue collapsed between them, against a paced control pinned at '
               + 'exactly zero pump ticks — and that both replays produced the SAME effects: same '
               + 'fork actions completed, same Explore level, same exit crossed. The in-app echo of '
               + 'the byte-identity contract clockGate.test.js pins headlessly.',
    testFunction: omsiPlaybackInstant,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

registerTest({
    id: 'omsi-bot-instant-multi-reset-walk',
    name: 'Omsi: an Instant Bot walk still grinds correctly across loop resets',
    description: 'Instant-policy pass slice 1, the Bot half: the multi-reset bot walk with the '
               + 'block\'s Instant checkbox on. COMPLEMENTS omsi-bot-multi-reset-walk (the only '
               + 'real-time bot coverage) rather than replacing it. Asserts the flag reached the '
               + 'bridge as a bot MODE and the stepping went through the pump — the witness that '
               + 'the Bot checkbox is not vacuous — and then re-pins the multi-reset machinery '
               + 'under the pump: resets still interrupt, the queue still re-parks on index 0, '
               + 'walkTo is still re-dispatched, the window still ends on the teleport. No duration '
               + 'bound: a bot walk is host-round-trip-bound (~12 s each), and Instant collapses '
               + 'only the ticking inside a run.',
    testFunction: botInstantCrossesAcrossResets,
    category: 'Omsi bot walks',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
