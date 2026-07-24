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
import {
    OMSI_REGION_SPLIT_PRESET_PATH,
    OMSI_REGION_SPLIT_R0,
    OMSI_REGION_SPLIT_R1,
    OMSI_REGION_SPLIT_R0_TO_R1,
    OMSI_REGION_SPLIT_R1_TO_R0,
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
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

// Gate: expWander >= 0.05 * 505000 = 25250. Pick a value comfortably above.
const EXPLORE_ABOVE = 60000;
const R1_MARK = 40000;   // a distinct expWander value banked in r1

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
