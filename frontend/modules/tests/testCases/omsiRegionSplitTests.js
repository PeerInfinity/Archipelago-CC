/**
 * Region splitting, end to end (arc C). This is the INDEPENDENT STRATUM the
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
 * The leg drives one full round-trip:
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
 */

import { registerTest } from '../testRegistry.js';
import {
    OMSI_REGION_SPLIT_PRESET_PATH,
    OMSI_REGION_SPLIT_R0,
    OMSI_REGION_SPLIT_R1,
    waitForOmsiActive,
    waitForOmsiBridge,
    resetOmsiEngineProgress,
    moveToRegion,
    omsiEval,
    omsiClearQueue,
    bridgeState,
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
    let win = await enterRegion(testController, OMSI_REGION_SPLIT_R0);
    testController.reportCondition('entered r0', !!win);
    if (!win) return testController.getOverallResult();
    testController.assertEqual('bridge active in r0', OMSI_REGION_SPLIT_R0, bridgeState()?.activeRegionId);
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
