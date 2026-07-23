/**
 * In-app tests for the loops block-mode system on the text-adventure
 * wrapper — the automated replacement for the M3 manual sanity legs
 * (plan: CC/docs/plans/loops-coarse-capture-plan.md, "Test-first").
 *
 * Phase A scope: pin CURRENT observable behavior as specs that must
 * survive the M3b coarse-capture refactor:
 *
 *   1. tasw-playback-no-double-append — replaying a recorded visit
 *      (interior + departureExitId) crosses the exit WITHOUT growing
 *      the gameState path (the M3 1/n fromLoop fix, never
 *      sanity-confirmed).
 *   2. tasw-playback-instant — the same replay with instant:true
 *      completes in one synchronous drain (bounded wall-clock well
 *      under the per-tick pacing a non-instant replay would need).
 *   3. tasw-record-coarse-autoswitch — a parked Record block captures
 *      live explores, rewrites the block interior on the expected
 *      exit, and auto-switches the block to Playback.
 *   4. tasw-queue-integrity-parked — DIAGNOSTIC: a location check
 *      performed while parked must not append entries outside the
 *      parked block. Expected RED against current code (gameState
 *      end-appends non-fromLoop checks; the suspected M3 symptom);
 *      goes green with the M3b refactor (Manual captures nothing,
 *      Record inserts at the block).
 *
 * Setup mirrors tasw-location-check-loop-mode-passthrough
 * (textAdventureWrapperTests.js): fresh shuffled-spiral rules with
 * loop_costs (loops auto-enters loop mode), wrapper iframe mounted,
 * real DOM clicks inside the engine. Worlds here use an EMPTY obstacle
 * pool so no exit is rule-gated (departure clicks can't be blocked).
 */

import { registerTest } from '../testRegistry.js';
import {
    arrangeShuffledSpiral,
    buildRulesJson,
} from '../../procgenPipeline/procgenPipelineEngine.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';

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

/**
 * Click explore until an exit link is revealed (fog discovery), then
 * return { exitId, clicks } — clicks = number of explore commands
 * actually issued (each is recorded by the visit recorder).
 */
async function exploreUntilExitRevealed(testController, mount, maxClicks = 25) {
    let clicks = 0;
    for (let i = 0; i < maxClicks; i++) {
        const exitEl = mount.iframe.contentDocument.querySelector('[data-exit-id]');
        if (exitEl) return { exitId: exitEl.dataset.exitId, clicks };
        const explore = mount.iframe.contentDocument.querySelector('[data-action="explore"]');
        if (!explore) break;
        clickInIframe(mount, explore);
        clicks += 1;
        await new Promise(r => setTimeout(r, 200));
    }
    const exitEl = mount.iframe.contentDocument.querySelector('[data-exit-id]');
    return { exitId: exitEl?.dataset.exitId ?? null, clicks };
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

/** Resolve the exit's target region from staticData. */
function exitTarget(testController, region, exitId) {
    const staticData = testController.stateManager.getStaticData?.();
    const exits = staticData?.regions?.get(region)?.exits ?? [];
    return exits.find(e => e.name === exitId)?.connected_region ?? null;
}

/** The wrapper's PlaybackController (host-side proxy). */
function taswController() {
    return substrateRegistry.get('text_adventure')?.getPlaybackController?.() ?? null;
}

async function eventually(testController, fn, label, timeoutMs = 15000, intervalMs = 100) {
    const ok = await testController.pollForCondition(fn, label, timeoutMs, intervalMs);
    return !!ok;
}

// ─── 1. Playback replay must not grow the path ────────────────────

async function playbackNoDoubleAppend(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-replay-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    testController.log(`current region: ${region}`);

    // Reveal an exit so its id is known-valid for the replay departure.
    const { exitId } = await exploreUntilExitRevealed(testController, mount);
    testController.assertEqual('an exit was revealed by exploring', true, !!exitId);
    if (!exitId) return testController.getOverallResult();
    const target = exitTarget(testController, region, exitId);
    testController.assertEqual('the revealed exit maps to a target region', true, !!target);
    if (!target) return testController.getOverallResult();

    dumpQueue(testController, 'pre-replay');
    const before = pathLength();
    testController.log(`path length before replay: ${before}`);

    // Replay a recorded-visit shape: one interior explore + the
    // departure. The bridge dispatches the same events live play
    // would, with fromLoop:true — so the path must not grow.
    const controller = taswController();
    testController.assertEqual('wrapper PlaybackController available', true, !!controller);
    if (!controller) return testController.getOverallResult();
    controller.replayActions(
        [{ type: 'explore', regionName: region }],
        { departureExitId: exitId },
    );

    const crossed = await eventually(testController,
        () => currentRegion() === target,
        `replay crossed '${exitId}' into '${target}'`);
    testController.assertEqual(
        'replaying a recording crossed its departure exit (region changed)',
        true, crossed);

    await testController.stateManager.pingWorker('after-replay', 3000);
    const after = pathLength();
    testController.log(`path length after replay: ${after}`);
    dumpQueue(testController, 'post-replay');
    testController.assertEqual(
        'replay did not append path entries (no fromLoop double-append)',
        before, after);

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-playback-no-double-append',
    name: 'TA blocks: Playback replay crosses its exit without growing the queue',
    description: 'Replays a recorded-visit shape (interior explore + departureExitId) '
               + 'through the wrapper PlaybackController under active loop mode and '
               + 'asserts the region changes while the gameState path length stays '
               + 'constant — the M3 1/n fromLoop double-append fix.',
    testFunction: playbackNoDoubleAppend,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 2. Instant replay drains in one pass ─────────────────────────

const INSTANT_INTERIOR_EXPLORES = 6;
// A non-instant replay paces one action per tick at 4 Hz: 6 interior
// explores + the departure ≥ ~1750 ms. Instant must come in far under
// that; 1200 ms leaves slack for postMessage + engine latency while
// still cleanly distinguishing the two.
const INSTANT_MAX_MS = 1200;

async function playbackInstant(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-instant-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const { exitId } = await exploreUntilExitRevealed(testController, mount);
    testController.assertEqual('an exit was revealed by exploring', true, !!exitId);
    if (!exitId) return testController.getOverallResult();
    const target = exitTarget(testController, region, exitId);
    if (!target) {
        testController.reportCondition('revealed exit maps to a target region', false);
        return testController.getOverallResult();
    }

    const before = pathLength();
    const interior = Array.from(
        { length: INSTANT_INTERIOR_EXPLORES },
        () => ({ type: 'explore', regionName: region }),
    );

    const controller = taswController();
    const t0 = performance.now();
    controller.replayActions(interior, { departureExitId: exitId, instant: true });

    const crossed = await eventually(testController,
        () => currentRegion() === target,
        `instant replay crossed '${exitId}' into '${target}'`,
        10000, 50);
    const elapsed = Math.round(performance.now() - t0);
    testController.log(`instant replay completed in ${elapsed}ms `
        + `(${INSTANT_INTERIOR_EXPLORES} interior actions + departure; `
        + `non-instant pacing would need ≥${(INSTANT_INTERIOR_EXPLORES + 1) * 250}ms)`);

    testController.assertEqual('instant replay crossed the departure exit', true, crossed);
    testController.assertEqual(
        `instant replay finished in one drain (<${INSTANT_MAX_MS}ms)`,
        true, crossed && elapsed < INSTANT_MAX_MS);

    await testController.stateManager.pingWorker('after-instant-replay', 3000);
    testController.assertEqual(
        'instant replay did not append path entries',
        before, pathLength());

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-playback-instant',
    name: 'TA blocks: Instant replay drains interior + departure in one pass',
    description: 'Replays six interior explores plus a departure with instant:true '
               + 'and asserts the region change lands well under the per-tick pacing '
               + 'a non-instant replay would need, with no path growth — the M3 '
               + 'Instant drain path.',
    testFunction: playbackInstant,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 3. Record: coarse capture + auto-switch ──────────────────────

async function recordCoarseAutoswitch(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-record-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const gs = getGameStateSingleton();

    // Reveal an exit first — the departure click needs a rendered link,
    // and planning needs its id. These discovery explores happen inside
    // the SAME visit, so the recorder buffers them; they are part of
    // the expected captured interior.
    const { exitId, clicks: discoveryClicks } = await exploreUntilExitRevealed(testController, mount);
    testController.assertEqual('an exit was revealed by exploring', true, !!exitId);
    if (!exitId) return testController.getOverallResult();
    const target = exitTarget(testController, region, exitId);
    testController.assertEqual('revealed exit maps to a target region', true, !!target);
    if (!target) return testController.getOverallResult();

    // Plan the departure so the region has a block with an expected
    // exit, then flag that block Record.
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

    // Perform two more interior explores while parked, then depart
    // through the planned exit.
    let parkedClicks = 0;
    for (let i = 0; i < 2; i++) {
        const explore = mount.iframe.contentDocument.querySelector('[data-action="explore"]');
        if (!explore) break;
        clickInIframe(mount, explore);
        parkedClicks += 1;
        await new Promise(r => setTimeout(r, 250));
    }
    const totalExplores = discoveryClicks + parkedClicks;
    testController.log(`explores this visit: ${discoveryClicks} discovery + ${parkedClicks} parked = ${totalExplores}`);
    testController.assertEqual('performed at least one interior explore', true, totalExplores > 0);

    const exitEl = mount.iframe.contentDocument.querySelector(`[data-exit-id="${exitId}"]`)
        ?? mount.iframe.contentDocument.querySelector('[data-exit-id]');
    testController.assertEqual('departure exit link still rendered', true, !!exitEl);
    if (!exitEl) return testController.getOverallResult();
    clickInIframe(mount, exitEl);

    const crossed = await eventually(testController,
        () => currentRegion() === target,
        `player crossed '${exitId}' into '${target}'`);
    testController.assertEqual('Record exit reached the expected region', true, crossed);
    if (!crossed) return testController.getOverallResult();
    await testController.stateManager.pingWorker('after-record-exit', 3000);

    // Coarse layer: the block interior must now be the performed
    // explores (inserted before the boundary regionMove).
    const afterQueue = dumpQueue(testController, 'post-record');
    const { visits: afterVisits } = resolveQueueBlocks(afterQueue);
    const afterVisit = afterVisits.find(v => v.name === region && v.instance === visit.instance);
    // visit.actions holds wrappers { pathEntry, index, instanceNumber }.
    const interior = (afterVisit?.actions ?? [])
        .map(w => w.pathEntry ?? w)
        .filter(a => a.type === 'customAction' && a.actionName === 'explore'
            && (a.sourceRegion == null || a.sourceRegion === region));
    testController.assertEqual(
        `coarse replacement wrote ${totalExplores} explore entries into the block interior`,
        totalExplores, interior.length);

    // Auto-switch (default ON): the block is now Playback.
    testController.assertEqual(
        'block auto-switched to playback after the successful Record exit',
        'playback', loopStateSingleton.getBlockMode(region, visit.instance));

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-record-coarse-autoswitch',
    name: 'TA blocks: Record captures live explores and auto-switches to Playback',
    description: 'Parks a Record block in a TA region, performs real explore clicks '
               + 'in the engine, departs through the planned exit, and asserts the '
               + 'coarse replacement rewrote the block interior to the performed '
               + 'actions and the block auto-switched to Playback.',
    testFunction: recordCoarseAutoswitch,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});

// ─── 4. DIAGNOSTIC: parked live play must not leak entries ────────

async function queueIntegrityParked(testController) {
    if (!await loadLoopWorld(testController, 'tasw-bm-integrity-1')) {
        return testController.getOverallResult();
    }
    const mount = await mountIframe(testController);
    if (!mount) return testController.getOverallResult();

    const region = currentRegion();
    const gs = getGameStateSingleton();

    const { exitId } = await exploreUntilExitRevealed(testController, mount);
    testController.assertEqual('an exit was revealed by exploring', true, !!exitId);
    if (!exitId) return testController.getOverallResult();
    const target = exitTarget(testController, region, exitId);
    if (!target) {
        testController.reportCondition('revealed exit maps to a target region', false);
        return testController.getOverallResult();
    }

    // Plan the departure, park the block in Manual.
    gs.updatePath(target, exitId, region);
    const queue = dumpQueue(testController, 'planned');
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

    // Perform a location check while parked — a real engine click if a
    // location is revealed, else a host-dispatcher publish for a
    // location of this region from staticData.
    const staticData = testController.stateManager.getStaticData?.();
    const regionLocations = staticData?.regions?.get(region)?.locations ?? [];
    let checkedName = null;
    const domItem = mount.iframe.contentDocument.querySelector('[data-item-id]');
    if (domItem) {
        checkedName = domItem.dataset.itemId;
        testController.log(`clicking revealed location '${checkedName}' while parked`);
        clickInIframe(mount, domItem);
    } else if (regionLocations.length > 0) {
        checkedName = regionLocations[0].name;
        testController.log(`no revealed location link; dispatching check for '${checkedName}'`);
        window.eventDispatcher.publish(
            'iframeAdapter', 'user:locationCheck',
            { locationName: checkedName, regionName: region, originator: 'taswBlockModeTests' },
            { initialTarget: 'bottom' },
        );
    } else {
        // Region has no locations at all — nothing to check; the
        // diagnostic can't run on this seed. Fail loudly rather than
        // pass vacuously.
        testController.reportCondition(`region ${region} has a checkable location`, false);
        return testController.getOverallResult();
    }

    const checked = await eventually(testController, () => {
        const snap = testController.stateManager.getSnapshot();
        const set = snap?.checkedLocations;
        return set instanceof Set ? set.has(checkedName)
            : Array.isArray(set) && set.includes(checkedName);
    }, `'${checkedName}' was actually checked`, 8000);
    testController.assertEqual('the parked check was performed for real', true, checked);

    // THE DIAGNOSTIC: nothing may have appended outside the parked
    // block. The path must still END with the planned boundary
    // regionMove — a trailing locationCheck entry is the stray-append
    // bug (gameState end-appends non-fromLoop checks while parked).
    const afterQueue = dumpQueue(testController, 'post-check');
    const last = afterQueue[afterQueue.length - 1];
    const lastIsBoundary = last?.type === 'regionMove'
        && last?.sourceRegion === region
        && last?.destinationRegion === target;
    testController.assertEqual(
        'no entry appended after the planned boundary regionMove '
        + '(parked live play must not leak queue entries — expected RED '
        + 'until the M3b coarse-capture refactor lands)',
        true, lastIsBoundary);

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-queue-integrity-parked',
    name: 'TA blocks: parked live play does not leak entries outside the block',
    description: 'DIAGNOSTIC for the stray-append symptom: parks a Manual block, '
               + 'performs a real location check, and asserts the queue still ends '
               + 'with the planned boundary regionMove. Expected RED against current '
               + 'code (gameState end-appends non-fromLoop checks while parked); '
               + 'goes green with the M3b coarse-capture refactor.',
    testFunction: queueIntegrityParked,
    category: 'TA block modes',
    enabled: false, // off by default — runs only in the test-substrates mode
});
