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
 * descriptor gated on 'Wander' at 5% explored, with a direct graph edge
 * between them. Entering a zone swaps its per-region value props live.
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
    let park = null;
    try {
        return await multiRunReplayLegs(testController, {
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
