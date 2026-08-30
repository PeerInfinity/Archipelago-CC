/**
 * In-app tests for the loops block-mode system on the text-adventure
 * wrapper — the automated replacement for the M3 manual sanity legs
 * (plan: CC/docs/plans/loops-coarse-capture-plan.md, "Test-first").
 *
 * Rewired for M3b (loops-owned coarse capture): the wrapper's internal
 * recorder/replay machinery is gone, so Playback drives the loops
 * GENERIC EXECUTOR over the block's own interior, Record captures
 * host-side during parked live play, and the strict action gate blocks
 * substrate actions outside parked Manual/Record blocks. The tests pin
 * the same observable outcomes as the Phase A originals (region
 * changes, path/queue shape, timing) against the new paths:
 *
 *   1. tasw-playback-no-double-append — a Playback block (interior
 *      explore + boundary move) runs via the generic executor, crosses
 *      the exit, and the gameState path length stays constant.
 *   2. tasw-playback-instant — the same block with the per-block
 *      Instant flag drains interior + departure in a bounded burst,
 *      far under the paced-timer wall clock.
 *   3. tasw-record-coarse-autoswitch — a parked Record block captures
 *      live explore clicks (charging mana — one economy), rewrites the
 *      block interior on the expected exit, and auto-switches to
 *      Playback.
 *   4. tasw-queue-integrity-parked — a location check performed while
 *      parked on a Manual block performs for real, drains mana,
 *      captures nothing, and appends nothing outside the parked block.
 *      (The former KNOWN-RED stray-append diagnostic — green since the
 *      M3b loop-mode end-append retirement.)
 *
 * Setup mirrors tasw-location-check-loop-mode-passthrough
 * (textAdventureWrapperTests.js): fresh shuffled-spiral rules with
 * loop_costs (loops auto-enters loop mode), wrapper iframe mounted,
 * real DOM clicks inside the engine. Worlds here use an EMPTY obstacle
 * pool so no exit is rule-gated (departure clicks can't be blocked).
 * Under the strict gate, exits are planned from staticData (free-walk
 * discovery is no longer possible before a block parks).
 */

import { registerTest } from '../testRegistry.js';
import {
    arrangeShuffledSpiral,
    buildRulesJson,
} from '../../procgenPipeline/procgenPipelineEngine.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';

// ─── Shared setup ─────────────────────────────────────────────────

/**
 * Generate a small all-open (no obstacles) loop-mode world dominated by
 * text_adventure regions, load it, and wait for loop mode to
 * auto-enable. Returns false on failure (conditions already reported).
 */
async function loadLoopWorld(testController, seed) {
    testController.log(`Generating shuffled-spiral rules (loop mode ON, seed ${seed})…`);
    let grid, startCell, stats;
    try {
        const result = arrangeShuffledSpiral({
            regionSize: { width: 7, height: 7 },
            itemPool: { victory: 1, key_red: 2, key_green: 2, key_blue: 2 },
            obstaclePool: {},
            seed,
            regionParams: {},
            growthParams: {
                substrateQuotas: { text_adventure: 6 },
                maxItemsPerRegion: 2,
                startSubstrate: 'text_adventure',
            },
            hazardOpts: {},
        });
        grid = result.grid; startCell = result.startCell; stats = result.stats;
    } catch (e) {
        testController.log(`arrangeShuffledSpiral threw: ${e.message}`, 'error');
        testController.reportCondition('generated shuffled-spiral grid', false);
        return false;
    }
    testController.reportCondition('generated shuffled-spiral grid', true);

    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed,
        enableLoopMode: true,
        regionXpEffect: 'cost',
        completionConditionItem: 'victory',
        procgenMetadata: { driver: 'shuffled-spiral-test', stop_reason: stats.stopReason },
    });

    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 8000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesJson,
        selectedPlayerId: '1',
        sourceName: 'taswBlockModeTests',
    });
    await rulesLoadedPromise;
    await testController.stateManager.pingWorker('after-rules-load', 3000);

    // Poll the gameState flag rather than the loopModeChanged event —
    // when a previous test already left loop mode active, auto-enable
    // is a no-op and the transition event never fires.
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)',
        5000, 100,
    );
    testController.reportCondition('loop mode active (auto-enabled by loop_costs)', !!loopOn);
    return !!loopOn;
}

/** Activate the wrapper panel and wait for the engine to render a room. */
async function mountIframe(testController) {
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });
    let iframeWin = null;
    const mounted = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.tasw-iframe');
            if (!iframe?.contentDocument) return false;
            iframeWin = iframe.contentWindow;
            return iframe.contentDocument.querySelector('.tae-actions') !== null;
        },
        'wrapper iframe rendered a room',
        15000, 300,
    );
    testController.reportCondition('wrapper iframe rendered a room', !!mounted);
    if (!mounted) return null;
    return { iframe: document.querySelector('iframe.tasw-iframe'), iframeWin };
}

function clickInIframe({ iframeWin }, el) {
    const evt = new iframeWin.MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(evt);
}

function currentRegion() {
    try { return getGameStateSingleton()?.getCurrentRegion?.() ?? null; } catch { return null; }
}

function pathLength() {
    try { return getGameStateSingleton()?.path?.length ?? -1; } catch { return -1; }
}

function dumpQueue(testController, label) {
    const queue = loopStateSingleton.getActionQueue?.() ?? [];
    const brief = queue.map((a, i) => {
        if (a.type === 'regionMove') return `${i}:move(${a.sourceRegion}→${a.destinationRegion})`;
        if (a.type === 'locationCheck') return `${i}:check(${a.locationName})`;
        if (a.type === 'customAction') return `${i}:${a.actionName}(${a.sourceRegion ?? ''})`;
        return `${i}:${a.type}`;
    });
    testController.log(`${label} queue[${queue.length}]: ${brief.join(' | ') || '(empty)'}`);
    return queue;
}

/**
 * Pick an exit of `region` (and its target) straight from staticData —
 * under the strict gate a departure must be PLANNED before the block
 * can park, so discovery can't be used to find one first.
 */
function pickExitFromStaticData(testController, region) {
    const staticData = testController.stateManager.getStaticData?.();
    const exits = staticData?.regions?.get(region)?.exits ?? [];
    const exit = exits.find(e => e.connected_region);
    return exit ? { exitId: exit.name, target: exit.connected_region } : null;
}

/** Resolve the queue block (visit) for `region`, newest instance first. */
function resolveBlockFor(region) {
    const queue = loopStateSingleton.getActionQueue?.() ?? [];
    const { visits } = resolveQueueBlocks(queue);
    return [...visits].reverse().find(v => v.name === region) ?? null;
}

async function eventually(testController, fn, label, timeoutMs = 15000, intervalMs = 100) {
    const ok = await testController.pollForCondition(fn, label, timeoutMs, intervalMs);
    return !!ok;
}

/**
 * Author a queue for the current region entirely via the gameState
 * planning APIs: `exploreCount` interior explores followed by the
 * departure through `exitId` → `target`. Returns the block descriptor.
 */
function authorExploresAndDeparture(testController, region, { exploreCount, exitId, target }) {
    const gs = getGameStateSingleton();
    for (let i = 0; i < exploreCount; i++) {
        gs.addCustomAction('explore', { regionName: region });
    }
    gs.updatePath(target, exitId, region);
    dumpQueue(testController, 'authored');
    return resolveBlockFor(region);
}

// ─── 1. Playback (generic executor) must not grow the path ────────

async function playbackNoDoubleAppend(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-replay-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    testController.log(`current region: ${region}`);

    const picked = pickExitFromStaticData(testController, region);
    testController.assertEqual('an exit was resolvable from staticData', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { exitId, target } = picked;

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    const savedSpeed = loopStateSingleton.gameSpeed;
    try {
        gs.noManaDepletionReset = true;
        loopStateSingleton.setGameSpeed(10000);

        const block = authorExploresAndDeparture(testController, region, {
            exploreCount: 1, exitId, target,
        });
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        // M4 flipped defaultBlockMode to Record, which PARKS the block —
        // this test is about the Playback path, so ask for it explicitly.
        // With no substrate recorder the generic executor runs the interior
        // + boundary move host-side.
        loopStateSingleton.setBlockMode(region, block.instance, 'playback');

        const before = pathLength();
        testController.log(`path length after authoring: ${before}`);

        loopStateSingleton.startProcessing();
        const crossed = await eventually(testController,
            () => currentRegion() === target,
            `generic executor crossed '${exitId}' into '${target}'`);
        testController.assertEqual(
            'Playback ran the block and crossed its boundary move (region changed)',
            true, crossed);

        await testController.stateManager.pingWorker('after-playback', 3000);
        const after = pathLength();
        testController.log(`path length after run: ${after}`);
        dumpQueue(testController, 'post-run');
        testController.assertEqual(
            'the run did not append path entries (no fromLoop double-append)',
            before, after);
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        loopStateSingleton.setGameSpeed(savedSpeed);
        // Leave loop mode OFF: nothing auto-disables it on preset switch,
        // and a leaked active flag turns the strict gate loose on later
        // tests' (non-loop) worlds.
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-playback-no-double-append',
    name: 'TA blocks: Playback runs the block interior without growing the queue',
    description: 'Authors a TA block (interior explore + planned departure), runs it '
               + 'in Playback via the loops generic executor (M3b: no substrate '
               + 'recorder), and asserts the region changes while the gameState path '
               + 'length stays constant — the fromLoop double-append guard.',
    testFunction: playbackNoDoubleAppend,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 2. Instant block drains in one burst ─────────────────────────

const INSTANT_INTERIOR_EXPLORES = 6;
// The paced generic timer at default speed needs seconds per action; an
// Instant block completes one action per animation frame. 1200 ms from
// the first TA-block action to the region change leaves generous slack
// while still cleanly distinguishing the two.
const INSTANT_MAX_MS = 1200;

async function playbackInstant(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-instant-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const picked = pickExitFromStaticData(testController, region);
    testController.assertEqual('an exit was resolvable from staticData', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { exitId, target } = picked;

    const gs = getGameStateSingleton();
    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true;

        const block = authorExploresAndDeparture(testController, region, {
            exploreCount: INSTANT_INTERIOR_EXPLORES, exitId, target,
        });
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!block);
        if (!block) return testController.getOverallResult();
        // Instant applies to Playback blocks; M4's Record default would park
        // this one instead of running it.
        loopStateSingleton.setBlockMode(region, block.instance, 'playback');
        loopStateSingleton.setBlockInstant(region, block.instance, true);

        const before = pathLength();

        // Measure from the first TA-block action (the initial Menu→start
        // hop runs on the paced timer at default speed and is not part of
        // the Instant block under test).
        let tFirstAction = null;
        const unsubscribe = testController.eventBus.subscribe('loopState:newActionStarted', ({ action }) => {
            if (tFirstAction === null && action?.sourceRegion === region) {
                tFirstAction = performance.now();
            }
        });

        loopStateSingleton.startProcessing();
        const crossed = await eventually(testController,
            () => currentRegion() === target,
            `instant block crossed '${exitId}' into '${target}'`,
            20000, 50);
        const tEnd = performance.now();
        try { unsubscribe?.(); } catch { /* ignore */ }

        testController.assertEqual('instant block crossed the departure exit', true, crossed);
        testController.assertEqual('first TA-block action was observed', true, tFirstAction !== null);
        if (crossed && tFirstAction !== null) {
            const elapsed = Math.round(tEnd - tFirstAction);
            testController.log(`instant TA block completed in ${elapsed}ms `
                + `(${INSTANT_INTERIOR_EXPLORES} interior explores + departure; `
                + `the paced timer needs seconds per action at default speed)`);
            testController.assertEqual(
                `instant block finished in one burst (<${INSTANT_MAX_MS}ms)`,
                true, elapsed < INSTANT_MAX_MS);
        }

        await testController.stateManager.pingWorker('after-instant', 3000);
        testController.assertEqual(
            'instant run did not append path entries',
            before, pathLength());
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        // Leave loop mode OFF (see test 1's cleanup note).
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-playback-instant',
    name: 'TA blocks: Instant block drains interior + departure in one burst',
    description: 'Authors six interior explores plus a departure, flags the block '
               + 'Instant, and asserts the whole block completes far under the paced '
               + 'timer\'s wall clock with no path growth — the M3 Instant seam on '
               + 'the M3b generic-executor path.',
    testFunction: playbackInstant,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 3. Record: parked live capture + auto-switch ─────────────────

async function recordCoarseAutoswitch(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-record-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const gs = getGameStateSingleton();

    // Under the strict gate the departure must be planned BEFORE the
    // block parks (free-walk discovery is retired) — pick it from
    // staticData.
    const picked = pickExitFromStaticData(testController, region);
    testController.assertEqual('an exit was resolvable from staticData', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { exitId, target } = picked;

    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true;

        gs.updatePath(target, exitId, region);
        const queue = dumpQueue(testController, 'planned');
        const { visits } = resolveQueueBlocks(queue);
        const visit = [...visits].reverse().find(v => v.name === region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!visit);
        if (!visit) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, visit.instance, 'record');
        testController.log(`block (${region}, ${visit.instance}) set to record; starting processing`);

        loopStateSingleton.startProcessing();
        const parked = await eventually(testController,
            () => loopStateSingleton._manualActionEntered === true,
            'queue parked on the Record block',
            8000, 100);
        testController.assertEqual('queue parked on the Record block', true, parked);
        if (!parked) {
            dumpQueue(testController, 'not-parked');
            return testController.getOverallResult();
        }

        const manaAtPark = gs.getCurrentMana();

        // Perform live explore clicks while parked (each click is a real
        // engine explore — observed, charged, and captured by loops). At
        // least two always run (the capture/drain assertions need
        // material); then keep exploring until the PLANNED exit's link is
        // revealed, in case it wasn't already (the start region often has
        // its arrival exit pre-discovered). Bounded by the region content.
        let parkedClicks = 0;
        let exitEl = null;
        for (let i = 0; i < 25; i++) {
            exitEl = mount.iframe.contentDocument.querySelector(`[data-exit-id="${exitId}"]`);
            if (exitEl && parkedClicks >= 2) break;
            const explore = mount.iframe.contentDocument.querySelector('[data-action="explore"]');
            if (!explore) break;
            clickInIframe(mount, explore);
            parkedClicks += 1;
            await new Promise(r => setTimeout(r, 250));
        }
        exitEl = mount.iframe.contentDocument.querySelector(`[data-exit-id="${exitId}"]`);
        testController.log(`parked explores this visit: ${parkedClicks}`);
        testController.assertEqual('performed at least one parked explore', true, parkedClicks > 0);
        testController.assertEqual('planned departure exit link was revealed', true, !!exitEl);
        if (!exitEl) return testController.getOverallResult();

        // Rule 2 (one economy): parked live play drains mana.
        const manaAfterExplores = gs.getCurrentMana();
        testController.assertEqual(
            'parked live explores drained mana (Record drains)',
            true, manaAfterExplores < manaAtPark);
        testController.log(`mana: ${manaAtPark.toFixed(1)} → ${manaAfterExplores.toFixed(1)} after ${parkedClicks} explores`);

        clickInIframe(mount, exitEl);

        const crossed = await eventually(testController,
            () => currentRegion() === target,
            `player crossed '${exitId}' into '${target}'`);
        testController.assertEqual('Record exit reached the expected region', true, crossed);
        if (!crossed) return testController.getOverallResult();
        await testController.stateManager.pingWorker('after-record-exit', 3000);

        // Coarse layer (loops-owned, M3b): the block interior must now be
        // exactly the performed explores (inserted before the boundary move).
        const afterQueue = dumpQueue(testController, 'post-record');
        const { visits: afterVisits } = resolveQueueBlocks(afterQueue);
        const afterVisit = afterVisits.find(v => v.name === region && v.instance === visit.instance);
        // visit.actions holds wrappers { pathEntry, index, instanceNumber }.
        const interior = (afterVisit?.actions ?? [])
            .map(w => w.pathEntry ?? w)
            .filter(a => a.type === 'customAction' && a.actionName === 'explore'
                && (a.sourceRegion == null || a.sourceRegion === region));
        testController.assertEqual(
            `coarse capture wrote ${parkedClicks} explore entries into the block interior`,
            parkedClicks, interior.length);

        // Auto-switch (default ON): the block is now Playback.
        testController.assertEqual(
            'block auto-switched to playback after the successful Record exit',
            'playback', loopStateSingleton.getBlockMode(region, visit.instance));
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        // Leave loop mode OFF (see test 1's cleanup note).
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-record-coarse-autoswitch',
    name: 'TA blocks: Record captures parked live explores and auto-switches to Playback',
    description: 'Plans a departure from staticData, parks a Record block, performs '
               + 'real explore clicks in the engine (charged — live play drains), '
               + 'departs through the planned exit, and asserts the loops-owned '
               + 'coarse capture rewrote the block interior to the performed actions '
               + 'and the block auto-switched to Playback.',
    testFunction: recordCoarseAutoswitch,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 4. Parked Manual live play: performs, drains, leaks nothing ──

async function queueIntegrityParked(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-integrity-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const gs = getGameStateSingleton();

    const picked = pickExitFromStaticData(testController, region);
    testController.assertEqual('an exit was resolvable from staticData', true, !!picked);
    if (!picked) return testController.getOverallResult();
    const { exitId, target } = picked;

    const staticData = testController.stateManager.getStaticData?.();
    const regionLocations = staticData?.regions?.get(region)?.locations ?? [];
    if (regionLocations.length === 0) {
        // Region has no locations at all — nothing to check; the
        // diagnostic can't run on this seed. Fail loudly rather than
        // pass vacuously.
        testController.reportCondition(`region ${region} has a checkable location`, false);
        return testController.getOverallResult();
    }

    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true;

        // Plan the departure, park the block in Manual.
        gs.updatePath(target, exitId, region);
        const queue = dumpQueue(testController, 'planned');
        const queueLenPlanned = queue.length;
        const { visits } = resolveQueueBlocks(queue);
        const visit = [...visits].reverse().find(v => v.name === region);
        if (!visit) {
            testController.reportCondition(`resolved a queue block for ${region}`, false);
            return testController.getOverallResult();
        }
        loopStateSingleton.setBlockMode(region, visit.instance, 'manual');
        loopStateSingleton.startProcessing();
        const parked = await eventually(testController,
            () => loopStateSingleton._manualActionEntered === true,
            'queue parked on the Manual block',
            8000, 100);
        testController.assertEqual('queue parked on the Manual block', true, parked);
        if (!parked) return testController.getOverallResult();

        const manaAtPark = gs.getCurrentMana();

        // Perform a location check while parked. The strict gate allows it
        // (parked Manual block, matching region) and it must perform for
        // real. Dispatch through the host dispatcher — a rendered location
        // link would need discovery explores first, which this diagnostic
        // doesn't require.
        const checkedName = regionLocations[0].name;
        testController.log(`dispatching parked check for '${checkedName}'`);
        window.eventDispatcher.publish(
            'iframeAdapter', 'user:locationCheck',
            { locationName: checkedName, regionName: region, originator: 'taswBlockModeTests' },
            { initialTarget: 'bottom' },
        );

        const checked = await eventually(testController, () => {
            const snap = testController.stateManager.getSnapshot();
            const set = snap?.checkedLocations;
            return set instanceof Set ? set.has(checkedName)
                : Array.isArray(set) && set.includes(checkedName);
        }, `'${checkedName}' was actually checked`, 8000);
        testController.assertEqual('the parked check was performed for real', true, checked);

        // Rule 2: Manual live play drains mana too.
        testController.assertEqual(
            'the parked check drained mana (Manual drains)',
            true, gs.getCurrentMana() < manaAtPark);

        // THE INTEGRITY ASSERTIONS: Manual captures NOTHING and nothing
        // end-appends in loop mode — the queue is byte-identical to the
        // planned one, still ending with the boundary regionMove.
        const afterQueue = dumpQueue(testController, 'post-check');
        testController.assertEqual(
            'queue length unchanged by parked Manual live play (captures nothing)',
            queueLenPlanned, afterQueue.length);
        const last = afterQueue[afterQueue.length - 1];
        const lastIsBoundary = last?.type === 'regionMove'
            && last?.sourceRegion === region
            && last?.destinationRegion === target;
        testController.assertEqual(
            'no entry appended after the planned boundary regionMove '
            + '(loop-mode end-appends are retired)',
            true, lastIsBoundary);
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        // Leave loop mode OFF (see test 1's cleanup note).
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-queue-integrity-parked',
    name: 'TA blocks: parked Manual live play performs + drains but leaks no entries',
    description: 'Parks a Manual block, performs a real location check while parked, '
               + 'and asserts the check happened (gate allows parked live play), mana '
               + 'drained (one economy), and the queue is untouched — Manual captures '
               + 'nothing and loop-mode end-appends are retired (the former '
               + 'KNOWN-RED stray-append diagnostic, green since M3b).',
    testFunction: queueIntegrityParked,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});
