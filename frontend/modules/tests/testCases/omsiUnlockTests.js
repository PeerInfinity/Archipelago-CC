/**
 * AP-V1 unlock randomization, end to end (unlock-discretization plan
 * §7). This is the INDEPENDENT STRATUM for the pool work: the vitest
 * suite (omsiUnlockPool.test.js) checks what the library EMITS, while
 * these tests drive the REAL fork engine through the REAL bridge and
 * check what the game actually does with it.
 *
 * Fixture: the omsi_randomized_test preset (2 maze regions + 1 omsi
 * Beginnersville region carrying town 0's full 90-location discovery
 * pool plus `travel_onward` holding 'Victory'; regenerate with
 * scripts/test/generate-omsi-randomized-test-preset.mjs).
 *
 * Legs:
 *   1. omsi-unlock-overlay-boot — the ruled boot push lands; with zero
 *      supply-step items held, every managed var's capacity is pinned
 *      to 0 (presence in qBatches is what makes a var managed, so this
 *      is the observable proof the overlay took).
 *   2. omsi-unlock-seed-before-fanout — a pre-checked row does NOT
 *      re-report when the overlay's check() fans out on load, while an
 *      un-checked locally-satisfied row DOES.
 *   3. omsi-unlock-grant-raises-capacity — AP item copies arriving
 *      raise capacity by min(batches, rowCount) x ratio.
 *   4. omsi-unlock-check-fires-once — crossing a row's base-rate
 *      dimension checks its location exactly once, and re-crossing
 *      dedupes.
 *   5. omsi-unlock-survives-prestige — a prestige through the game's
 *      own path leaves the overlay and the banked checks intact (no
 *      re-push, no re-report) — the U5 survival property the boot
 *      order depends on.
 *   6. omsi-unlock-victory-town — victory fires on town N JOINING
 *      townsUnlocked, and NOT on an unrelated town unlocking.
 *
 * Engine facts these rely on (fork @ e5ef307):
 *   - Effective capacity for var V in town t is the plain field
 *     `towns[t]['total' + V]`; the managed substitution is
 *     min(batches, rowCount) x ratio, applied at the END of adjustAll().
 *   - A quantity row fires on `dot(coeffs, dims.map(getLevel)) >=
 *     trigger.baseTotalAtLeast` — LEVELS, not totals. So row
 *     `q:0:Pots:1` (dims ["Wander"], coeffs [5], trigger 10) needs
 *     `towns[0].getLevel("Wander") >= 2`, i.e. expWander >= 300.
 *     Deliberately grindable with zero items — which is exactly why
 *     the access-rule logic is conservative.
 *   - `towns[t].finishProgress(v, exp)` is the game's OWN progress
 *     path and runs adjustAll + a targeted Unlocks.check on level
 *     change, so it is both the realistic and the sufficient driver.
 */

import { registerTest } from '../testRegistry.js';
import {
    OMSI_RANDOMIZED_PRESET_PATH,
    OMSI_RANDOMIZED_VICTORY_LOCATION,
    OMSI_SCALED_PRESET_PATH,
    OMSI_TEST_REGION,
    OMSI_TEST_MAZE_REGION,
    waitForOmsiActive,
    waitForOmsiBridge,
    resetOmsiEngineProgress,
    moveToRegion,
    omsiEval,
    omsiClearQueue,
    bridgeState,
    isBridgeClockRunning,
    watchLocationChecks,
    eventually,
} from '../../omsiSubstrateWrapper/test-helpers.js';

// Town 0's four managed vars, with the fork's own (ratio, rowCount).
// ratio = grant.batch = "oneInEvery"; capacity = min(batches, rowCount) x ratio.
const TOWN0_VARS = {
    Pots: { ratio: 10, rowCount: 50 },
    Locks: { ratio: 10, rowCount: 10 },
    SQuests: { ratio: 5, rowCount: 20 },
    LQuests: { ratio: 5, rowCount: 10 },
};

// The first Pots row: dims ["Wander"], coeffs [5], baseTotalAtLeast 10.
const POTS_ROW_1 = 'q:0:Pots:1';
const POTS_ROW_1_LOCATION = 'region_1_1__q_0_Pots_1';
// getLevel is floor((sqrt(8*exp/100 + 1) - 1)/2): level 2 needs exp >= 300.
const EXP_FOR_WANDER_LEVEL_2 = 300;

/** True if the snapshot lists `name` among its checked locations. */
function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations;
    if (Array.isArray(checked)) return checked.includes(name);
    if (checked && typeof checked === 'object') return !!checked[name];
    return false;
}

/** The engine's live effective capacity for a town-0 var. */
function readCapacity(varName) {
    return Number(omsiEval(`towns[0].total${varName}`));
}

/** The fork's structured view of what it currently holds. */
function readQuantityState(varName) {
    return omsiEval(`IdleLoopsManaged.getUnlockState().quantities.${varName}`);
}

function readTownsUnlocked() {
    return omsiEval('IdleLoopsManaged.getFullState().townsUnlocked');
}

/**
 * Load the randomized preset, mount the panel, and walk into the omsi
 * region. Returns the iframe contentWindow (or null).
 */
async function enterRandomizedOmsiRegion(testController, presetPath = OMSI_RANDOMIZED_PRESET_PATH) {
    testController.log(`Loading omsi preset ${presetPath}…`);
    await testController.loadRulesFromFile(presetPath);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'omsiSubstrateWrapperPanel',
    });

    // The managed game outlives individual tests (its own save slot,
    // one booted iframe per suite run), so normalize the persistent
    // dims these tests set up BEFORE entering the region — otherwise a
    // previous test's unlockTown/progress pre-satisfies our milestones.
    const booted = await waitForOmsiBridge(testController);
    testController.reportCondition('omsi bridge booted', !!booted);
    if (!booted) return null;
    resetOmsiEngineProgress(['Wander']);

    testController.log(`Moving into omsi region ${OMSI_TEST_REGION}…`);
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);

    const win = await waitForOmsiActive(testController);
    testController.reportCondition('omsi bridge active in region', !!win);
    if (win) omsiClearQueue();
    return win;
}

/** Give the engine enough Wander progress to fire the first Pots row. */
function driveWanderToLevel2() {
    omsiEval(`towns[0].finishProgress("Wander", ${EXP_FOR_WANDER_LEVEL_2})`);
}

function resetWanderProgress() {
    omsiEval('towns[0].expWander = 0; adjustAll()');
}

// ────────────────────────────────────────────────────────────────
// 1. Boot push
// ────────────────────────────────────────────────────────────────

async function unlockOverlayBoot(testController) {
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const state = bridgeState();
    testController.assertEqual('bridge recognizes an unlock world', true, !!state?.hasUnlockPool);
    testController.assertEqual('victoryTown carried on the payload', 1, state?.victoryTown);

    // Every town-0 var must be MANAGED — present in qBatches. A var
    // that is merely omitted keeps running NATIVE capacity, which is
    // the silent-failure mode this leg exists to catch.
    for (const varName of Object.keys(TOWN0_VARS)) {
        const q = readQuantityState(varName);
        testController.assertEqual(
            `${varName} is managed (batches present, not null)`,
            true,
            q != null && q.batches !== null,
        );
        testController.assertEqual(
            `${varName} rowCount matches the table`,
            TOWN0_VARS[varName].rowCount,
            q?.rowCount,
        );
    }

    // With zero supply-step items held, capacity is pinned to 0 —
    // min(0, rowCount) * ratio. Vanilla town 0 would give Pots
    // level("Wander") * 5, so a nonzero value here means the overlay
    // did not take (or adjustAll never re-ran after the push).
    const capacityPinned = await eventually(
        testController,
        () => Object.keys(TOWN0_VARS).every((v) => readCapacity(v) === 0),
        'every managed town-0 capacity pinned to 0',
    );
    testController.assertEqual('capacity pinned to 0 by the overlay', true, capacityPinned);

    // And the pin must SURVIVE the game recomputing totals on its own.
    driveWanderToLevel2();
    testController.assertEqual(
        'Pots capacity still pinned after a natural adjustAll (level up)',
        0,
        readCapacity('Pots'),
    );
    resetWanderProgress();

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-overlay-boot',
    name: 'Omsi unlocks: boot pushes the overlay and pins native capacity',
    description: 'Entering an emission-ON omsi region pushes the AP unlock overlay; '
               + 'every town-0 var becomes managed and its capacity is pinned to 0 '
               + 'with no supply-step items held, surviving a natural adjustAll.',
    testFunction: unlockOverlayBoot,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 2. Seed before fan-out
// ────────────────────────────────────────────────────────────────

async function unlockSeedBeforeFanout(testController) {
    // Satisfy the first Pots row BEFORE the overlay push, so the
    // push's full check() would fan it out if the seeding were
    // skipped or mis-ordered.
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    // The watcher is installed for BOTH phases so the negative
    // assertion is meaningful: a watcher that observes nothing would
    // make "not re-reported" pass for the wrong reason, so we require
    // it to have counted the positive case first.
    const watch = watchLocationChecks(POTS_ROW_1_LOCATION);
    try {
        // Leg A: an un-checked, locally-satisfied row DOES report.
        testController.assertEqual(
            'Pots row 1 not yet checked',
            false,
            snapshotHasLocation(testController.stateManager.getSnapshot(), POTS_ROW_1_LOCATION),
        );
        driveWanderToLevel2();
        const fired = await eventually(
            testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), POTS_ROW_1_LOCATION),
            `${POTS_ROW_1} reported as an AP check`,
            10000,
        );
        testController.assertEqual('locally-satisfied row reported', true, fired);
        testController.assertEqual(
            'watcher observed the original dispatch (so a zero below is meaningful)',
            1,
            watch.count,
        );

        // Leg B: now that it is banked, a fresh region load must NOT
        // re-report it — seedReportedLocations runs before the overlay
        // push whose check() would otherwise fan it back out.
        moveToRegion(OMSI_TEST_MAZE_REGION, OMSI_TEST_REGION);
        await eventually(testController, () => !isBridgeClockRunning(), 'clock stopped after leaving');
        moveToRegion(OMSI_TEST_REGION, OMSI_TEST_MAZE_REGION);
        await eventually(testController, () => isBridgeClockRunning(), 'clock resumed on re-entry');
        // Give the post-load overlay push + its check() fan-out time to land.
        await eventually(testController, () => false, 'settle window (expected timeout)', 1500, 500);

        testController.assertEqual(
            'already-checked row was NOT re-reported after the overlay push',
            1,
            watch.count,
        );
    } finally {
        watch.stop();
    }
    testController.assertEqual(
        'row stays checked',
        true,
        snapshotHasLocation(testController.stateManager.getSnapshot(), POTS_ROW_1_LOCATION),
    );

    resetWanderProgress();
    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-seed-before-fanout',
    name: 'Omsi unlocks: seeding precedes the overlay fan-out',
    description: 'A locally-satisfied unlock row reports as an AP check; once banked, '
               + 'reloading the region does not re-report it, proving '
               + 'seedReportedLocations runs before setUnlockOverlay\'s check().',
    testFunction: unlockSeedBeforeFanout,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 3. Grants raise capacity
// ────────────────────────────────────────────────────────────────

async function unlockGrantRaisesCapacity(testController) {
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    testController.assertEqual('Pots capacity starts pinned at 0', 0, readCapacity('Pots'));

    // Supply-step items are progressive duplicate copies of ONE name;
    // the bridge only ever counts them. Deliver them the way AP does
    // (inventory mutation -> snapshotUpdated -> bridge reconcile).
    const { ratio, rowCount } = TOWN0_VARS.Pots;
    testController.log('Delivering 3x "Pots Supply Step"…');
    await testController.stateManager.addItemToInventory('Pots Supply Step', 3);

    const rose = await eventually(
        testController,
        () => readCapacity('Pots') === Math.min(3, rowCount) * ratio,
        `Pots capacity = min(3, ${rowCount}) x ${ratio}`,
        10000,
    );
    testController.assertEqual('capacity rose with the granted batches', true, rose);
    testController.assertEqual('fork batch count matches', 3, readQuantityState('Pots')?.batches);

    // Another copy is another batch — and the OTHER vars stay pinned,
    // proving grants are per-var and not a blanket unpin.
    await testController.stateManager.addItemToInventory('Pots Supply Step', 1);
    const rose2 = await eventually(
        testController,
        () => readCapacity('Pots') === Math.min(4, rowCount) * ratio,
        'Pots capacity followed the 4th copy',
        10000,
    );
    testController.assertEqual('capacity followed the incremental grant', true, rose2);
    testController.assertEqual('Locks still pinned at 0', 0, readCapacity('Locks'));

    // Reconcile is idempotent: no new items means no new batches.
    await testController.stateManager.pingWorker('reconcile-idempotence', 3000);
    testController.assertEqual(
        'no phantom batches from a repeat reconcile',
        4,
        readQuantityState('Pots')?.batches,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-grant-raises-capacity',
    name: 'Omsi unlocks: AP supply-step copies raise managed capacity',
    description: 'Duplicate "Pots Supply Step" copies arriving as AP items raise the '
               + 'engine\'s effective Pots capacity by min(batches, rowCount) x ratio, '
               + 'per var, idempotently.',
    testFunction: unlockGrantRaisesCapacity,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 4. Check path fires once
// ────────────────────────────────────────────────────────────────

async function unlockCheckFiresOnce(testController) {
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const watch = watchLocationChecks(POTS_ROW_1_LOCATION);
    try {
        // Cross the row's base-rate dimension through the game's own
        // progress path. Note this needs ZERO items — the row triggers
        // on LEVELS, which is precisely why the emitted access-rule
        // logic understates reachability (the safe direction).
        driveWanderToLevel2();
        const fired = await eventually(
            testController,
            () => watch.count > 0,
            `${POTS_ROW_1} location check dispatched`,
            10000,
        );
        testController.assertEqual('crossing the dimension checked the location', true, fired);

        // Re-crossing must not re-dispatch: the fork's achievedReported
        // and the bridge's _reportedLocationNames are both once-only.
        omsiEval('Unlocks.check()');
        omsiEval(`towns[0].finishProgress("Wander", ${EXP_FOR_WANDER_LEVEL_2})`);
        await eventually(testController, () => false, 'settle window (expected timeout)', 1500, 500);

        testController.assertEqual('location fired exactly once', 1, watch.count);
    } finally {
        watch.stop();
    }

    resetWanderProgress();
    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-check-fires-once',
    name: 'Omsi unlocks: crossing a row checks its location exactly once',
    description: 'Driving the base-rate dimension of q:0:Pots:1 dispatches its AP '
               + 'location check; re-crossing and a forced recheck do not re-dispatch.',
    testFunction: unlockCheckFiresOnce,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 5. Prestige survival
// ────────────────────────────────────────────────────────────────

async function unlockSurvivesPrestige(testController) {
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    const watch = watchLocationChecks(POTS_ROW_1_LOCATION);
    try {
        // Bank a check and some capacity first. Capacity is
        // min(batches, rowCount) x ratio, so 2 copies of a ratio-10 var
        // is 20 — the batches count is what the overlay carries.
        const potsCapacityAt2 = 2 * TOWN0_VARS.Pots.ratio;
        await testController.stateManager.addItemToInventory('Pots Supply Step', 2);
        await eventually(
            testController,
            () => readCapacity('Pots') === potsCapacityAt2,
            `Pots capacity ${potsCapacityAt2}`,
            10000,
        );
        driveWanderToLevel2();
        await eventually(
            testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), POTS_ROW_1_LOCATION),
            'Pots row 1 banked before prestige',
            10000,
        );
        testController.assertEqual(
            'watcher observed the pre-prestige dispatch (so the count below is meaningful)',
            1,
            watch.count,
        );

        // Placement is canonical, so checking q_0_Pots_1 delivered a
        // THIRD 'Pots Supply Step'. Read the real held count rather
        // than assuming — the batches the overlay carries track
        // inventory, not the number we injected.
        const heldCopies = Number(
            testController.stateManager.getSnapshot()?.inventory?.['Pots Supply Step'] ?? 0,
        );
        const expectedCapacity = Math.min(heldCopies, TOWN0_VARS.Pots.rowCount)
            * TOWN0_VARS.Pots.ratio;
        await eventually(
            testController,
            () => readQuantityState('Pots')?.batches === heldCopies,
            `Pots batches caught up to ${heldCopies} held copies`,
            10000,
        );

        // Prestige through the game's OWN core — the same function the
        // UI button reaches after its confirm(). The second argument is
        // the next-buffs map; Imbue Soul is the only buff that carries
        // over, and 0 is the "nothing carried" case (the fork's own
        // managed-unlocks suite drives it the same way).
        //
        // The bridge deliberately does NOT re-push the overlay here —
        // U5 proved both the overlay and the fork's achievedReported
        // survive a prestige, and this leg is what keeps that
        // assumption honest rather than assumed.
        testController.log('Prestiging via prestigeWithNewValues…');
        omsiEval('prestigeWithNewValues(prestigeValues, { Imbuement3: 0 })');

        await eventually(testController, () => false, 'settle window (expected timeout)', 2000, 500);

        testController.assertEqual(
            `overlay survived the prestige (Pots still managed at ${heldCopies} batches)`,
            heldCopies,
            readQuantityState('Pots')?.batches,
        );
        testController.assertEqual(
            'substituted capacity survived the prestige',
            expectedCapacity,
            readCapacity('Pots'),
        );
        testController.assertEqual('banked check was not re-reported', 1, watch.count);
    } finally {
        watch.stop();
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-survives-prestige',
    name: 'Omsi unlocks: the overlay and banked checks survive a prestige',
    description: 'A prestige through the game\'s own prestigeWithNewValues leaves the '
               + 'AP unlock overlay, the substituted capacity and the reported-row set '
               + 'intact — no re-push and no re-report.',
    testFunction: unlockSurvivesPrestige,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 6. Victory on the last included town
// ────────────────────────────────────────────────────────────────

async function unlockVictoryTown(testController) {
    const win = await enterRandomizedOmsiRegion(testController);
    if (!win) return testController.getOverallResult();

    testController.assertEqual(
        'victory location not yet checked',
        false,
        snapshotHasLocation(testController.stateManager.getSnapshot(),
            OMSI_RANDOMIZED_VICTORY_LOCATION),
    );

    // Satisfy the victory location's ACCESS RULE first. It requires
    // K_total - 1 = 89 supply-step copies, and the host rejects a check
    // on a location that is not accessible — so without the items the
    // town predicate below would be untestable (every unlock would look
    // like "no victory" for the wrong reason). HasFromList sums copies,
    // so 89 of one name satisfies the 4-name list.
    testController.log('Delivering 89 supply-step copies to satisfy the victory rule…');
    await testController.stateManager.addItemToInventory('Pots Supply Step', 89);
    await eventually(
        testController,
        () => Number(testController.stateManager.getSnapshot()?.inventory?.['Pots Supply Step'] ?? 0) >= 89,
        '89 supply-step copies held',
        10000,
    );
    testController.assertEqual(
        'victory still unchecked with the rule satisfied but no town unlocked',
        false,
        snapshotHasLocation(testController.stateManager.getSnapshot(),
            OMSI_RANDOMIZED_VICTORY_LOCATION),
    );

    // A DIFFERENT town joining must not satisfy an N=1 world. With the
    // access rule already satisfied, the ONLY thing under test here is
    // the town predicate. This is the latent v0 hole the includes(N)
    // form closes: Open Rift takes 0 -> 5, which the old
    // `townsUnlocked.length > 1` test would have read as victory even
    // though town 1 never joined.
    testController.log('Unlocking town 5 (the Open Rift shape) — must NOT win…');
    omsiEval('unlockTown(5)');
    await eventually(testController, () => false, 'settle window (expected timeout)', 1500, 500);
    testController.assertEqual(
        'unrelated town did not fire victory',
        false,
        snapshotHasLocation(testController.stateManager.getSnapshot(),
            OMSI_RANDOMIZED_VICTORY_LOCATION),
    );
    testController.assertEqual(
        'town 5 really is unlocked (the negative is meaningful)',
        true,
        (readTownsUnlocked() ?? []).includes(5),
    );

    // Town N = 1 joining IS the milestone.
    testController.log('Unlocking town 1 — the victory milestone…');
    omsiEval('unlockTown(1)');
    const checked = await eventually(
        testController,
        () => snapshotHasLocation(testController.stateManager.getSnapshot(),
            OMSI_RANDOMIZED_VICTORY_LOCATION),
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

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-victory-town',
    name: 'Omsi unlocks: victory fires on the last included town joining',
    description: 'Victory rides travel_onward on town N-1 and fires on '
               + 'townsUnlocked.includes(N) — an unrelated town (the Open Rift 0->5 '
               + 'shape) does not trigger it, town 1 does.',
    testFunction: unlockVictoryTown,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

// ────────────────────────────────────────────────────────────────
// 7. arc A: a SCALED world — moved percentages + capacity mapping
// ────────────────────────────────────────────────────────────────

// The scaled preset (unlockScale 0.2): Pots keeps 10 of its 50 rows, at
// steps 5,10,…,50 → the first selected Pots location fires at Explore
// LEVEL 10 (baseTotal 50), not level 2 (the full pool's q:0:Pots:1). The
// full pool would fire FIVE Pots checks by level 10 (q:0:Pots:1..5); the
// scaled world fires exactly ONE (q:0:Pots:5). Item→capacity rides the
// round(count·R/I) multiplier, so a full set of I=10 copies = baseMax.
const SCALED_POTS = { ratio: 10, rowCount: 50, itemCount: 10 };
const SCALED_POTS_STEP_5_LOCATION = 'region_1_1__q_0_Pots_5';
const SCALED_POTS_STEP_10_LOCATION = 'region_1_1__q_0_Pots_10';
// expWander for a Wander level (sqrt scaling): level L needs 50·L·(L+1).
const EXP_FOR_WANDER_LEVEL_10 = 5500;   // fires q:0:Pots:5 (baseTotal 50)
const EXP_FOR_WANDER_LEVEL_20 = 21000;  // fires q:0:Pots:10 (baseTotal 100)

async function unlockScaledWorld(testController) {
    const win = await enterRandomizedOmsiRegion(testController, OMSI_SCALED_PRESET_PATH);
    if (!win) return testController.getOverallResult();

    const state = bridgeState();
    testController.assertEqual('bridge recognizes an unlock world', true, !!state?.hasUnlockPool);
    testController.assertEqual('victoryTown carried on the payload', 1, state?.victoryTown);

    // Pots stays managed at its NATIVE rowCount (50) even though only 10
    // rows are AP locations — the capacity grain never shrinks with scale.
    const q = readQuantityState('Pots');
    testController.assertEqual('Pots managed', true, q != null && q.batches !== null);
    testController.assertEqual('Pots rowCount stays native (50)', SCALED_POTS.rowCount, q?.rowCount);

    // ── (2)/(3) capacity mapping: round(count·R/I) × ratio ───────────
    testController.assertEqual('Pots capacity starts pinned at 0', 0, readCapacity('Pots'));

    // 3 copies → batches = round(3·50/10) = 15 → totalPots = 15·10 = 150
    // (an INTERMEDIATE item count lands the multiplied batches).
    await testController.stateManager.addItemToInventory('Pots Supply Step', 3);
    const midCapacity = Math.round((3 * SCALED_POTS.rowCount) / SCALED_POTS.itemCount)
        * SCALED_POTS.ratio;
    const roseMid = await eventually(
        testController,
        () => readCapacity('Pots') === midCapacity,
        `Pots capacity = round(3·50/10)·10 = ${midCapacity}`,
        10000,
    );
    testController.assertEqual('intermediate copies land the multiplied capacity', true, roseMid);
    testController.assertEqual('fork batches = round(3·50/10) = 15', 15, readQuantityState('Pots')?.batches);

    // A FULL set (I = 10 copies) → batches = round(10·50/10) = 50 = rowCount
    // → totalPots = 50·10 = 500 = native baseMax (rowCount·ratio).
    await testController.stateManager.addItemToInventory('Pots Supply Step', 7);
    const baseMax = SCALED_POTS.rowCount * SCALED_POTS.ratio;   // 500
    const roseFull = await eventually(
        testController,
        () => readCapacity('Pots') === baseMax,
        `full set (10 copies) lands baseMax ${baseMax}`,
        10000,
    );
    testController.assertEqual('a full supply-step set reaches native baseMax', true, roseFull);
    testController.assertEqual('fork batches = round(10·50/10) = 50', 50, readQuantityState('Pots')?.batches);

    // ── (1) the percentages MOVED ────────────────────────────────────
    // Deliver up to 17 copies so every town-0 location satisfies its
    // HasFromList access rule (max count 17) — checkLocation REJECTS an
    // inaccessible location, which would make the observation below a
    // false negative. Capacity is already capped at baseMax, so this is
    // free.
    await testController.stateManager.addItemToInventory('Pots Supply Step', 7);
    await eventually(
        testController,
        () => Number(testController.stateManager.getSnapshot()?.inventory?.['Pots Supply Step'] ?? 0) >= 17,
        '17 Pots supply-step copies held (all town-0 locations accessible)',
        10000,
    );

    // Count EVERY Pots check, not just one location — the whole point is
    // that only the SELECTED steps fire.
    const watch = watchLocationChecks((name) => typeof name === 'string'
        && name.startsWith('region_1_1__q_0_Pots_'));
    try {
        // Level 10 (baseTotal 50): the fork fires q:0:Pots:1..5, but only
        // q:0:Pots:5 is an AP location — so exactly ONE check, not five.
        omsiEval(`towns[0].finishProgress("Wander", ${EXP_FOR_WANDER_LEVEL_10})`);
        const firstFired = await eventually(
            testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), SCALED_POTS_STEP_5_LOCATION),
            'q:0:Pots:5 checked at Wander level 10',
            10000,
        );
        testController.assertEqual('the first SELECTED Pots location checked', true, firstFired);
        // Positive-and-exact: 1, not the 5 the full pool would have fired
        // by this level. This is the moved-percentages proof.
        testController.assertEqual(
            'exactly one Pots check by level 10 (intermediate steps dropped)',
            1,
            watch.count,
        );

        // Level 20 (baseTotal 100): q:0:Pots:10 now fires; q:0:Pots:6..9
        // are not locations, so the count rises by exactly one.
        omsiEval(`towns[0].finishProgress("Wander", ${EXP_FOR_WANDER_LEVEL_20 - EXP_FOR_WANDER_LEVEL_10})`);
        const secondFired = await eventually(
            testController,
            () => snapshotHasLocation(testController.stateManager.getSnapshot(), SCALED_POTS_STEP_10_LOCATION),
            'q:0:Pots:10 checked at Wander level 20',
            10000,
        );
        testController.assertEqual('the next SELECTED Pots location checked', true, secondFired);
        testController.assertEqual(
            'exactly two Pots checks by level 20 (steps 5 and 10 only)',
            2,
            watch.count,
        );
    } finally {
        watch.stop();
    }

    resetWanderProgress();
    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-unlock-scaled-world',
    name: 'Omsi unlocks: a scaled world moves check percentages and maps capacity',
    description: 'At unlockScale 0.2 the selected Pots steps fire AP checks at Explore '
               + 'level 10/20 (not 2/4), exactly one check per selected step; item copies '
               + 'map to capacity as round(count·R/I)·ratio, a full I-set reaching baseMax.',
    testFunction: unlockScaledWorld,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
