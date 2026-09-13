/**
 * End-to-end tests for the textAdventureSubstrateWrapper. Each test
 * drives a real load + interaction and asserts on stateManager
 * snapshot state, mirroring the patterns in the README.
 *
 * Current focus: the "click a location, nothing happens" bug. The
 * tests below isolate where the chain breaks by exercising each leg
 * independently:
 *
 *   1. Direct host-side dispatcher publish — verifies the
 *      `user:locationCheck` chain runs end-to-end when the wrapper
 *      is bypassed entirely. If this fails, the bug is in the
 *      host-side handling (stateManager / locationName lookup /
 *      etc.); if it passes, the wrapper's iframe→host pipe is at
 *      fault.
 *
 *   2. Iframe-driven publish — simulates the bridge's actual
 *      publishEventDispatcher call by getting the iframe's
 *      IframeClient and invoking it directly. Verifies the
 *      iframeAdapter relay actually reaches the dispatcher chain.
 */

import { registerTest } from '../testRegistry.js';
import {
    arrangeShuffledSpiral,
    buildRulesJson,
} from '../../procgenPipeline/procgenPipelineEngine.js';
import {
    DEFAULT_ITEMS,
    DEFAULT_OBSTACLES,
} from '../../shared/procgen/library.js';

const PROCGEN_RULES_PATH = './presets/procgen_maze/AP_1/AP_1_rules.json';

/**
 * The fresh shuffled-spiral scenario (6 text_adventure + 3 maze, text_adventure
 * start) — shared by the fresh-procgen location row and the compass row, so the
 * two drive the same generated world.
 */
const TASW_SPIRAL = Object.freeze({
    itemPool: Object.freeze({ victory: 1, key_red: 1, key_green: 1, key_blue: 1 }),
    obstaclePool: Object.freeze({ door_red: 1, door_green: 1, door_blue: 1 }),
    substrateQuotas: Object.freeze({ text_adventure: 6, maze: 3 }),
    seed: 'tasw-test-1',
});

/** Generate + build the TASW_SPIRAL world: `{grid, startCell, stats, rulesJson}`. */
function buildTaswSpiralRules(driver) {
    const { grid, startCell, stats } = arrangeShuffledSpiral({
        regionSize: { width: 7, height: 7 },
        itemPool: { ...TASW_SPIRAL.itemPool },
        obstaclePool: { ...TASW_SPIRAL.obstaclePool },
        seed: TASW_SPIRAL.seed,
        regionParams: {},
        growthParams: {
            substrateQuotas: { ...TASW_SPIRAL.substrateQuotas },
            maxItemsPerRegion: 2,
            startSubstrate: 'text_adventure',
        },
        hazardOpts: {},
    });
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: TASW_SPIRAL.seed,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        completionConditionItem: 'victory',
        procgenMetadata: { driver, stop_reason: stats.stopReason },
    });
    return { grid, startCell, stats, rulesJson };
}

/**
 * Find any uncollected location in the loaded rules and return
 * { locationName, regionName } so the test doesn't hard-code names
 * that might change between presets.
 */
function pickAnyLocation(staticData) {
    if (!staticData?.regions) return null;
    for (const [regionName, regionData] of staticData.regions.entries()) {
        const locs = regionData?.locations ?? [];
        if (locs.length > 0) {
            return { locationName: locs[0].name, regionName };
        }
    }
    return null;
}

async function locationCheckDirectDispatch(testController) {
    testController.log('Loading procgen_maze preset…');
    await testController.loadRulesFromFile(PROCGEN_RULES_PATH);
    testController.reportCondition('rules loaded', true);

    await testController.stateManager.pingWorker('after-rules-load', 3000);

    const staticData = testController.stateManager.getStaticData?.();
    const pick = pickAnyLocation(staticData);
    if (!pick) {
        testController.reportCondition('found a location to check', false);
        return testController.getOverallResult();
    }
    const { locationName, regionName } = pick;
    testController.log(`Selected location: ${locationName} in region ${regionName}`);
    testController.reportCondition('selected location', true);

    const before = testController.stateManager.getSnapshot();
    const beforeCount = (before?.checkedLocations instanceof Set
        ? before.checkedLocations.size
        : (before?.checkedLocations?.length ?? 0));
    const beforeHas = (before?.checkedLocations instanceof Set
        ? before.checkedLocations.has(locationName)
        : (Array.isArray(before?.checkedLocations) && before.checkedLocations.includes(locationName)));
    testController.assertEqual('location not yet checked before publish', false, beforeHas);
    testController.log(`Initial checkedLocations count: ${beforeCount}`);

    // Subscribe to snapshot updates so we can wait for the worker to
    // confirm the check landed.
    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    // Publish via the host's dispatcher directly (same shape the
    // wrapper bridge sends, minus the iframe transport). The raw
    // dispatcher has a 4-arg signature: (originModuleId, eventName,
    // data, options). The iframeAdapter passes 'iframeAdapter' as
    // origin when forwarding from the iframe — match that here so
    // the dispatch path is identical.
    const dispatcher = window.eventDispatcher;
    if (!dispatcher) {
        testController.reportCondition('window.eventDispatcher available', false);
        return testController.getOverallResult();
    }
    dispatcher.publish(
        'iframeAdapter',
        'user:locationCheck',
        {
            locationName,
            regionName,
            originator: 'textAdventureSubstrateWrapper-test',
        },
        { initialTarget: 'bottom' },
    );

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-locationCheck', 3000);

    const after = testController.stateManager.getSnapshot();
    const afterHas = (after?.checkedLocations instanceof Set
        ? after.checkedLocations.has(locationName)
        : (Array.isArray(after?.checkedLocations) && after.checkedLocations.includes(locationName)));
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after publish`,
        true,
        afterHas,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-location-check-direct-dispatch',
    name: 'Wrapper: user:locationCheck via host dispatcher updates checkedLocations',
    description: 'Loads a procgen preset, picks an arbitrary location, '
               + 'publishes user:locationCheck via the host dispatcher (bypassing '
               + 'the iframe), and asserts the snapshot now lists it as checked. '
               + 'Isolates the host-side chain from the iframe transport so we '
               + 'can tell which side the "click does nothing" bug lives on.',
    testFunction: locationCheckDirectDispatch,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/**
 * Same payload, same chain — but published from inside the wrapper's
 * iframe via the bridge's actual IframeClient. If the direct-dispatch
 * test above passes but this one fails, the bug is in the iframe→host
 * transport for user:locationCheck specifically (user:regionMove works
 * via the same transport, so it has to be event-name specific).
 */
async function locationCheckIframeDispatch(testController) {
    testController.log('Loading procgen_maze preset…');
    await testController.loadRulesFromFile(PROCGEN_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    // Activate the wrapper panel so its iframe mounts.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });

    // Wait for the iframe to mount and its bridge to connect. The
    // bridge sets up its IframeClient and publishes loadRegion-style
    // events once connected; we poll for the iframe element + a
    // contentWindow that has the bridge's globals.
    const iframeFound = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.tasw-iframe');
            return !!iframe?.contentWindow;
        },
        'wrapper iframe mounted',
        10000,
        200,
    );
    if (!iframeFound) {
        testController.reportCondition('wrapper iframe mounted', false);
        return testController.getOverallResult();
    }

    const iframe = document.querySelector('iframe.tasw-iframe');
    const iframeWin = iframe.contentWindow;

    // The bridge module doesn't expose its IframeClient on window by
    // default. Wait for it to register (the bridge has to call
    // notifyAppReady before forwarding events work), then dispatch
    // via a postMessage that mirrors what client.publishEventDispatcher
    // sends. We build the message manually so we don't need bridge
    // internals.
    const pick = pickAnyLocation(testController.stateManager.getStaticData?.());
    if (!pick) {
        testController.reportCondition('found a location to check', false);
        return testController.getOverallResult();
    }
    const { locationName, regionName } = pick;
    testController.log(`Selected location: ${locationName} in region ${regionName}`);

    const beforeSnap = testController.stateManager.getSnapshot();
    const beforeChecked = (beforeSnap?.checkedLocations instanceof Set
        ? beforeSnap.checkedLocations.has(locationName)
        : (Array.isArray(beforeSnap?.checkedLocations) && beforeSnap.checkedLocations.includes(locationName)));
    testController.assertEqual('location not yet checked before publish', false, beforeChecked);

    // Give the iframe a moment to register with the iframeAdapter
    // before we send the publish (otherwise the adapter would reject
    // it as "iframe not registered").
    await new Promise(r => setTimeout(r, 1000));

    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    // Send the exact postMessage shape the bridge's
    // client.publishEventDispatcher produces, including the timestamp
    // that validateMessage requires. The host's iframeAdapter
    // recognises the type and forwards to dispatcher.publish.
    iframeWin.postMessage({
        type: 'PUBLISH_EVENT_DISPATCHER',
        clientId: 'textAdventureSubstrateWrapper',
        iframeId: 'textAdventureSubstrateWrapper',
        windowId: 'textAdventureSubstrateWrapper',
        timestamp: Date.now(),
        data: {
            eventName: 'user:locationCheck',
            eventData: {
                locationName,
                regionName,
                originator: 'textAdventureSubstrateWrapper',
            },
            target: undefined,
        },
    }, '*');
    // The iframeAdapter receives via window.postMessage on the parent.
    // Re-post from the iframe so origin checks line up with how the
    // bridge's client.sendToParent() reaches the adapter.
    window.postMessage({
        type: 'PUBLISH_EVENT_DISPATCHER',
        clientId: 'textAdventureSubstrateWrapper',
        iframeId: 'textAdventureSubstrateWrapper',
        windowId: 'textAdventureSubstrateWrapper',
        timestamp: Date.now(),
        data: {
            eventName: 'user:locationCheck',
            eventData: {
                locationName,
                regionName,
                originator: 'textAdventureSubstrateWrapper',
            },
            target: undefined,
        },
    }, '*');

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-iframe-locationCheck', 3000);

    const afterSnap = testController.stateManager.getSnapshot();
    const afterChecked = (afterSnap?.checkedLocations instanceof Set
        ? afterSnap.checkedLocations.has(locationName)
        : (Array.isArray(afterSnap?.checkedLocations) && afterSnap.checkedLocations.includes(locationName)));
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after iframe publish`,
        true,
        afterChecked,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-location-check-iframe-dispatch',
    name: 'Wrapper: user:locationCheck via iframe postMessage updates checkedLocations',
    description: 'Mounts the wrapper iframe, then dispatches user:locationCheck '
               + 'from inside the iframe via the same postMessage shape the bridge '
               + 'uses. If this fails while the direct-dispatch test passes, the '
               + 'bug lives in the iframe→host transport for this event.',
    testFunction: locationCheckIframeDispatch,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/**
 * The real bug-repro: actually click a rendered location link inside
 * the engine. Exercises the engine's click handler → command:examine
 * event → bridge subscriber → IframeClient.publishEventDispatcher
 * → postMessage → iframeAdapter → dispatcher → stateManager. The
 * test the user has been hitting manually, automated.
 */
async function locationCheckRealClick(testController) {
    testController.log('Loading procgen_maze preset…');
    await testController.loadRulesFromFile(PROCGEN_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });

    // The procgen_maze preset starts the player in a region with no
    // locations. Move to one that does (the first region in staticData
    // with locations) so the engine has something to render and click.
    const pickStart = pickAnyLocation(testController.stateManager.getStaticData?.());
    if (!pickStart) {
        testController.reportCondition('found a region with locations', false);
        return testController.getOverallResult();
    }
    const targetRegion = pickStart.regionName;
    testController.log(`Navigating to region with locations: ${targetRegion}`);
    // Move there via the dispatcher to mirror how a real click would.
    window.eventDispatcher?.publish('test', 'user:regionMove', {
        sourceRegion: null,
        targetRegion,
        exitName: null,
    }, { initialTarget: 'bottom' });
    await testController.stateManager.pingWorker('after-region-move', 3000);

    // Wait for the iframe to mount and the engine to render at least
    // one clickable item. The engine renders a `[data-item-id]` span
    // for any uncollected, discovered location in the current room.
    let iframeWin = null;
    let targetSpan = null;
    const ready = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.tasw-iframe');
            if (!iframe?.contentDocument) return false;
            iframeWin = iframe.contentWindow;
            targetSpan = iframe.contentDocument.querySelector('[data-item-id]');
            return targetSpan !== null;
        },
        'wrapper iframe rendered a clickable location',
        15000,
        300,
    );
    if (!ready) {
        testController.reportCondition('wrapper iframe rendered a clickable location', false);
        return testController.getOverallResult();
    }

    const locationName = targetSpan.dataset.itemId;
    const regionName = targetSpan.dataset.roomId;
    testController.log(`Clicking rendered location: ${locationName} in ${regionName}`);

    const beforeSnap = testController.stateManager.getSnapshot();
    const beforeChecked = (beforeSnap?.checkedLocations instanceof Set
        ? beforeSnap.checkedLocations.has(locationName)
        : (Array.isArray(beforeSnap?.checkedLocations) && beforeSnap.checkedLocations.includes(locationName)));
    testController.assertEqual('location not yet checked before click', false, beforeChecked);

    // Subscribe BEFORE the click so we don't race the worker.
    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    // Synthesize a real click — same MouseEvent the engine's
    // delegated handler listens for.
    const evt = new iframeWin.MouseEvent('click', { bubbles: true, cancelable: true });
    targetSpan.dispatchEvent(evt);

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-real-click', 3000);

    const afterSnap = testController.stateManager.getSnapshot();
    const afterChecked = (afterSnap?.checkedLocations instanceof Set
        ? afterSnap.checkedLocations.has(locationName)
        : (Array.isArray(afterSnap?.checkedLocations) && afterSnap.checkedLocations.includes(locationName)));
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after real click`,
        true,
        afterChecked,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-location-check-real-click',
    name: 'Wrapper: clicking a rendered location updates checkedLocations',
    description: 'Mounts the wrapper iframe, waits for the engine to render a '
               + 'clickable location, dispatches a synthetic click on it, and '
               + 'asserts the location ends up in checkedLocations. Reproduces '
               + 'the user-reported bug end-to-end through the real bridge.',
    testFunction: locationCheckRealClick,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/**
 * The actual bug repro: a freshly-generated shuffled-spiral world with
 * text_adventure regions. Mirrors the user's manual flow:
 *
 *   1. Set up scenario (6 text_adventure + 3 maze, text_adventure
 *      start, shuffled spiral).
 *   2. Generate rules via arrangeShuffledSpiral + buildRulesJson —
 *      the same calls the procgenPipeline panel's Generate button
 *      makes.
 *   3. Publish files:jsonLoaded — the same event the Load-into-
 *      frontend button publishes.
 *   4. Wait for the wrapper iframe + bridge to settle.
 *   5. Click [x] explore until at least one [data-item-id] is
 *      rendered (discovery mode is on by default in fresh worlds).
 *   6. Click the rendered location and assert checkedLocations
 *      updates in the snapshot.
 *
 * If this reproduces the bug, we know it's the procgen-generated
 * rules.json + wrapper combination, not procgen_maze loaded from
 * disk. From there we can diff the two rules.json shapes to find
 * what's different.
 */
async function locationCheckFreshProcgen(testController) {
    testController.log('Generating fresh shuffled-spiral rules…');

    let stats, rulesJson;
    try {
        ({ stats, rulesJson } = buildTaswSpiralRules('shuffled-spiral-test'));
    } catch (e) {
        testController.log(`arrangeShuffledSpiral threw: ${e.message}`, 'error');
        testController.reportCondition('generated shuffled-spiral grid', false);
        return testController.getOverallResult();
    }
    testController.log(`Generated grid: ${stats.regionsPlaced} regions, stop=${stats.stopReason}`);
    testController.reportCondition('generated shuffled-spiral grid', true);

    testController.reportCondition('built rules.json', !!rulesJson);

    // Mirror the Load-into-frontend button flow.
    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 8000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesJson,
        selectedPlayerId: '1',
        sourceName: 'procgenPipeline-test',
    });
    await rulesLoadedPromise;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded into frontend', true);

    // Probe loops state pre-disable. Loops auto-enters loop mode when
    // rules.json has loop_costs (procgen "Enable loop mode" toggle).
    // In loop mode, handleUserLocationCheckForLoops INTERCEPTS the
    // user:locationCheck and tries to queue it (or silently swallows
    // it when pathfinding fails). That's the user's bug — fresh
    // procgen worlds with loop_costs have this behavior.
    const { centralRegistry: cr0 } = await import('../../../app/core/centralRegistry.js');
    const loopUI0 = cr0.getPublicFunction?.('loops', 'getLoopState')?.();
    testController.log(`loops state post-load: ${JSON.stringify(loopUI0)}`);

    testController.log('Disabling loop mode to test hypothesis…');
    // loops:setLoopMode → loopUI.toggleLoopMode → gameState.setLoopModeActive
    // → gameState:loopModeChanged, which mana.js subscribes to. (Previously
    // this test also manually published loopUI:modeChanged; that event no
    // longer exists and the manual publish is now redundant.)
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable' });
    await new Promise(r => setTimeout(r, 400));
    const loopUI1 = cr0.getPublicFunction?.('loops', 'getLoopState')?.();
    testController.log(`loops state post-disable: ${JSON.stringify(loopUI1)}`);

    // Make the wrapper panel active so its iframe mounts.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });

    // Wait for the iframe to render its current room. The fresh
    // procgen world starts the player in a text_adventure region;
    // the engine will paint exits and maybe an explore link.
    let iframeWin = null;
    const mounted = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.tasw-iframe');
            if (!iframe?.contentDocument) return false;
            iframeWin = iframe.contentWindow;
            // "tae-actions" div exists once the engine has rendered a
            // room (even with no items). Use that as the readiness
            // signal — not [data-item-id] (which may not exist if
            // discovery mode hides everything).
            return iframe.contentDocument.querySelector('.tae-actions') !== null;
        },
        'wrapper iframe rendered a room',
        15000,
        300,
    );
    if (!mounted) {
        testController.reportCondition('wrapper iframe rendered a room', false);
        return testController.getOverallResult();
    }
    const iframe = document.querySelector('iframe.tasw-iframe');
    testController.log(`Initial room state: ${iframe.contentDocument.querySelector('.tae-actions-title')?.textContent}`);

    // Click [x] explore repeatedly until at least one location link
    // appears. Mirrors the user's "click Explore until everything
    // revealed" step. Cap iterations so a broken explore can't loop
    // forever.
    let foundItem = false;
    for (let i = 0; i < 20; i++) {
        const item = iframe.contentDocument.querySelector('[data-item-id]');
        if (item) { foundItem = true; break; }
        const explore = iframe.contentDocument.querySelector('[data-action="explore"]');
        if (!explore) break;
        const evt = new iframeWin.MouseEvent('click', { bubbles: true, cancelable: true });
        explore.dispatchEvent(evt);
        await new Promise(r => setTimeout(r, 200));
    }
    if (!foundItem) {
        const explore = iframe.contentDocument.querySelector('[data-action="explore"]');
        const itemCount = iframe.contentDocument.querySelectorAll('[data-item-id]').length;
        const actionCount = iframe.contentDocument.querySelectorAll('[data-action]').length;
        testController.log(`After explore loop: items=${itemCount}, actions=${actionCount}, explore-present=${!!explore}`);
        testController.reportCondition('found a clickable location after explore', false);
        return testController.getOverallResult();
    }
    testController.reportCondition('found a clickable location after explore', true);

    const targetSpan = iframe.contentDocument.querySelector('[data-item-id]');
    const locationName = targetSpan.dataset.itemId;
    const regionName = targetSpan.dataset.roomId;
    testController.log(`Clicking location: ${locationName} in ${regionName}`);

    // Verify the location IS known to stateManager before clicking
    // — if this fails, we've isolated the bug to the rules.json /
    // stateManager mismatch.
    const staticData = testController.stateManager.getStaticData?.();
    const regionData = staticData?.regions?.get?.(regionName);
    const knownInRegion = regionData?.locations?.some?.(l => l.name === locationName);
    testController.assertEqual(
        `location ${locationName} is in staticData.regions[${regionName}].locations`,
        true,
        !!knownInRegion,
    );
    // Also check staticData.locations (the worker's lookup map).
    const knownInLocations = staticData?.locations?.has?.(locationName);
    testController.assertEqual(
        `location ${locationName} is in staticData.locations`,
        true,
        !!knownInLocations,
    );

    const beforeSnap = testController.stateManager.getSnapshot();
    const beforeChecked = (beforeSnap?.checkedLocations instanceof Set
        ? beforeSnap.checkedLocations.has(locationName)
        : (Array.isArray(beforeSnap?.checkedLocations) && beforeSnap.checkedLocations.includes(locationName)));
    testController.assertEqual('location not yet checked before click', false, beforeChecked);

    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    const evt = new iframeWin.MouseEvent('click', { bubbles: true, cancelable: true });
    targetSpan.dispatchEvent(evt);

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-fresh-click', 3000);

    const afterSnap = testController.stateManager.getSnapshot();
    const afterChecked = (afterSnap?.checkedLocations instanceof Set
        ? afterSnap.checkedLocations.has(locationName)
        : (Array.isArray(afterSnap?.checkedLocations) && afterSnap.checkedLocations.includes(locationName)));
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after fresh click`,
        true,
        afterChecked,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-location-check-fresh-procgen',
    name: 'Wrapper: clicking a location in a freshly-generated procgen world',
    description: 'Generates a shuffled-spiral world with text_adventure regions, '
               + 'loads it via files:jsonLoaded, mounts the wrapper, clicks Explore '
               + 'until a location is revealed, clicks the location, and asserts '
               + 'it ends up in checkedLocations. The bug-repro for the user-reported '
               + '"click does nothing" issue against fresh procgen worlds.',
    testFunction: locationCheckFreshProcgen,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * M3b strict-action-gate contract (session 66b rulings; rewritten from
 * the pre-M3b "pass-through" regression): with LOOP MODE ACTIVE, a
 * substrate location check is BLOCKED unless the queue is parked on a
 * matching Manual/Record block.
 *
 * Historically this test asserted the opposite (the 2026-06 rework's
 * clickToQueue=off pass-through: any loop-mode click checked
 * immediately). Under M3b that default is retired — free play would
 * bypass the loop economy and corrupt parked blocks — so the same flow
 * now asserts both halves of the new contract:
 *   1. Not parked (queue not running) → the check does NOT happen and
 *      loops:clickIgnored feedback fires.
 *   2. Parked on a Manual block in the region → the same check
 *      performs for real.
 */
async function locationCheckLoopModePassThrough(testController) {
    testController.log('Generating fresh shuffled-spiral rules (loop mode ON)…');

    let grid, startCell, stats;
    try {
        const result = arrangeShuffledSpiral({
            regionSize: { width: 7, height: 7 },
            itemPool: { victory: 1, key_red: 1, key_green: 1, key_blue: 1 },
            obstaclePool: {},
            seed: 'tasw-loop-test-1',
            regionParams: {},
            growthParams: {
                substrateQuotas: { text_adventure: 6, maze: 3 },
                maxItemsPerRegion: 2,
                startSubstrate: 'text_adventure',
            },
            hazardOpts: {},
        });
        grid = result.grid; startCell = result.startCell; stats = result.stats;
    } catch (e) {
        testController.log(`arrangeShuffledSpiral threw: ${e.message}`, 'error');
        testController.reportCondition('generated shuffled-spiral grid', false);
        return testController.getOverallResult();
    }
    testController.reportCondition('generated shuffled-spiral grid', true);

    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: 'tasw-loop-test-1',
        enableLoopMode: true,
        regionXpEffect: 'cost',
        completionConditionItem: 'victory',
        procgenMetadata: { driver: 'shuffled-spiral-test', stop_reason: stats.stopReason },
    });
    testController.reportCondition('built rules.json with loop_costs', !!rulesJson?.loop_costs);

    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 8000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesJson,
        selectedPlayerId: '1',
        sourceName: 'procgenPipeline-test',
    });
    await rulesLoadedPromise;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded into frontend', true);

    // Poll the gameState flag (a prior test may have left loop mode
    // active, in which case no transition event fires).
    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const loopOn = await testController.pollForCondition(
        () => getGameStateSingleton()?.isLoopModeActive === true,
        'loop mode active (auto-enabled by loop_costs)',
        5000, 100,
    );
    testController.assertEqual('loop mode auto-enabled by loop_costs', true, !!loopOn);
    if (!loopOn) return testController.getOverallResult();

    // Make the wrapper panel active so its iframe mounts.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });
    const mounted = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.tasw-iframe');
            return !!iframe?.contentDocument?.querySelector('.tae-actions');
        },
        'wrapper iframe rendered a room',
        15000,
        300,
    );
    testController.reportCondition('wrapper iframe rendered a room', !!mounted);
    if (!mounted) return testController.getOverallResult();

    const gs = getGameStateSingleton();
    const region = gs.getCurrentRegion();
    const staticData = testController.stateManager.getStaticData?.();
    const regionLocations = staticData?.regions?.get(region)?.locations ?? [];
    testController.assertEqual(`region ${region} has a checkable location`, true, regionLocations.length > 0);
    if (regionLocations.length === 0) return testController.getOverallResult();
    const locationName = regionLocations[0].name;

    const isChecked = () => {
        const snap = testController.stateManager.getSnapshot();
        const set = snap?.checkedLocations;
        return set instanceof Set ? set.has(locationName)
            : Array.isArray(set) && set.includes(locationName);
    };
    const dispatchCheck = () => {
        window.eventDispatcher.publish(
            'iframeAdapter', 'user:locationCheck',
            { locationName, regionName: region, originator: 'textAdventureWrapperTests' },
            { initialTarget: 'bottom' },
        );
    };

    // ── Half 1: NOT parked → blocked with feedback ────────────────
    testController.assertEqual('location not yet checked before the blocked click', false, isChecked());
    let ignoredPayload = null;
    const unsubscribe = testController.eventBus.subscribe('loops:clickIgnored', (data) => {
        if (!ignoredPayload) ignoredPayload = data;
    });
    testController.log(`Dispatching check for '${locationName}' with the queue NOT running (must be blocked)`);
    dispatchCheck();
    await new Promise(r => setTimeout(r, 1500));
    await testController.stateManager.pingWorker('after-blocked-click', 3000);
    testController.assertEqual(
        `blocked: '${locationName}' was NOT checked while no Manual/Record block is parked`,
        false, isChecked());
    testController.assertEqual(
        'loops:clickIgnored feedback fired for the blocked click',
        true, !!ignoredPayload);
    if (ignoredPayload) {
        testController.log(`blocked-click feedback: kind=${ignoredPayload.kind}, reason=${ignoredPayload.reason}`);
    }
    try { unsubscribe?.(); } catch { /* ignore */ }

    // ── Half 2: parked Manual block → the same check performs ─────
    const exits = staticData?.regions?.get(region)?.exits ?? [];
    const exit = exits.find(e => e.connected_region);
    testController.assertEqual('an exit was resolvable from staticData', true, !!exit);
    if (!exit) return testController.getOverallResult();

    const loopStateSingleton = (await import('../../loops/loopStateSingleton.js')).default;
    const { resolveQueueBlocks } = await import('../../loops/blockIdentity.js');
    const savedNoReset = gs.noManaDepletionReset;
    try {
        gs.noManaDepletionReset = true;
        gs.updatePath(exit.connected_region, exit.name, region);
        const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue());
        const visit = [...visits].reverse().find(v => v.name === region);
        testController.assertEqual(`resolved a queue block for ${region}`, true, !!visit);
        if (!visit) return testController.getOverallResult();
        loopStateSingleton.setBlockMode(region, visit.instance, 'manual');
        loopStateSingleton.startProcessing();
        const parked = await testController.pollForCondition(
            () => loopStateSingleton._manualActionEntered === true,
            'queue parked on the Manual block',
            8000, 100,
        );
        testController.assertEqual('queue parked on the Manual block', true, !!parked);
        if (!parked) return testController.getOverallResult();

        testController.log(`Dispatching the same check while PARKED (must perform)`);
        const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
            .catch(() => null);
        dispatchCheck();
        await snapshotPromise;
        await testController.stateManager.pingWorker('after-parked-click', 3000);
        testController.assertEqual(
            `allowed: '${locationName}' checked while parked on a matching Manual block`,
            true, isChecked());
    } finally {
        gs.noManaDepletionReset = savedNoReset;
        // Leave loop mode OFF: nothing auto-disables it on preset switch,
        // and a leaked active flag turns the strict gate loose on later
        // tests' (non-loop) worlds.
        gs.setLoopModeActive(false);
    }

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-location-check-loop-mode-passthrough',
    name: 'Wrapper: loop-mode checks are gated — blocked unparked, allowed while parked',
    description: 'M3b strict action gate: with loop mode active, a location check is '
               + 'blocked (with loops:clickIgnored feedback) while no Manual/Record '
               + 'block is parked, and the same check performs for real once the '
               + 'queue parks on a Manual block in the region. Rewritten from the '
               + 'pre-M3b pass-through regression, which asserted the retired '
               + 'free-play default.',
    testFunction: locationCheckLoopModePassThrough,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * ⛓ PRESET SIDECARS G2a — **THE COMPASS GRID RENDERS A PROCGEN ROOM'S SIDES.**
 *
 * The bridge's primary world is built from `staticData.regions`, which carries
 * no side; a procgen room's sides live only in its sidecar payload, and the
 * bridge re-applies them on `textAdventure:loadRegion`. That event carries the
 * DESERIALIZED world (`exits: Map`) — and until G2a the bridge's read guarded
 * `Array.isArray(world.exits)`, so it returned early on every region, no exit
 * carried a side, and the engine fell back to its flat list (`useCompass`
 * false). This row generates the TASW_SPIRAL world, mounts the wrapper, and
 * asserts, against the payload the document itself carries:
 *   1. the engine rendered the compass grid (`.tae-exits-grid`);
 *   2. every exit link of the current room sits in the cell of its payload
 *      `side` — none in the centre cell, none missing;
 *   3. a click on a sided, accessible exit moves the player to that exit's
 *      `targetRegion`.
 */
async function compassGridRendersProcgenSides(testController) {
    let rulesJson;
    try {
        ({ rulesJson } = buildTaswSpiralRules('shuffled-spiral-compass-test'));
    } catch (e) {
        testController.log(`building the spiral threw: ${e.message}`, 'error');
        testController.reportCondition('generated shuffled-spiral rules', false);
        return testController.getOverallResult();
    }
    testController.reportCondition('generated shuffled-spiral rules', true);
    const sidecars = rulesJson.preset_sidecars?.['1'] ?? {};

    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const gs = getGameStateSingleton();
    // A prior row may have left loop mode on, which intercepts region moves.
    if (gs?.isLoopModeActive) gs.setLoopModeActive(false);

    const rulesLoadedPromise = testController.waitForEvent('stateManager:rulesLoaded', 8000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesJson,
        selectedPlayerId: '1',
        sourceName: 'procgenPipeline-test',
    });
    await rulesLoadedPromise;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded into frontend', true);

    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'textAdventureSubstrateWrapperPanel',
    });

    const iframeDoc = () => document.querySelector('iframe.tasw-iframe')?.contentDocument ?? null;
    const currentRoom = () => {
        const region = gs.getCurrentRegion();
        return sidecars[region]?.substrate === 'text_adventure' ? region : null;
    };
    const inRoom = await testController.pollForCondition(
        () => currentRoom() !== null && iframeDoc()?.querySelector('.tae-actions') !== null,
        'the wrapper rendered a text-adventure room of the generated world',
        15000, 300,
    );
    testController.reportCondition('the wrapper rendered a text-adventure room of the generated world', !!inRoom);
    if (!inRoom) return testController.getOverallResult();
    const region = currentRoom();
    const payloadExits = sidecars[region].playable_payload.exits;
    const sideOf = new Map(payloadExits.map((e) => [e.exitName ?? e.exit_id, e.side]));
    testController.log(`room ${region}: payload sides ${JSON.stringify([...sideOf])}`);

    const grid = await testController.pollForCondition(
        () => iframeDoc()?.querySelector('.tae-exits-grid') !== null,
        'the engine rendered the compass grid (useCompass)',
        8000, 200,
    );
    testController.reportCondition('the engine rendered the compass grid (useCompass)', !!grid);
    if (!grid) return testController.getOverallResult();

    // Discovery mode hides an exit until explored; explore until every exit
    // of the room is a real link.
    const exitLinks = () => [...iframeDoc().querySelectorAll('.tae-exits-grid [data-exit-id]')];
    for (let i = 0; i < 20 && exitLinks().length < payloadExits.length; i++) {
        const explore = iframeDoc().querySelector('[data-action="explore"]');
        if (!explore) break;
        explore.dispatchEvent(new explore.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 200));
    }
    const links = exitLinks();
    testController.assertEqual(`every exit of ${region} is a link in the grid`, payloadExits.length, links.length);

    const misplaced = [];
    for (const link of links) {
        const cell = link.closest('.tae-exits-cell');
        const cellSide = [...(cell?.classList ?? [])]
            .map((c) => c.match(/^tae-exits-cell-([a-z])$/)?.[1]?.toUpperCase())
            .find(Boolean);
        const want = sideOf.get(link.dataset.exitId);
        if (!want || cellSide !== want) misplaced.push(`${link.dataset.exitId}: cell ${cellSide} ≠ payload ${want}`);
    }
    testController.assertEqual(`every exit link of ${region} sits in its payload side's cell`, '', misplaced.join('; '));

    const target = links.find((l) => l.classList.contains('tae-link-accessible')
        && sidecars[region].playable_payload.exits.some((e) => (e.exitName ?? e.exit_id) === l.dataset.exitId));
    testController.reportCondition('a sided accessible exit to click', !!target);
    if (!target) return testController.getOverallResult();
    const targetRegion = payloadExits.find((e) => (e.exitName ?? e.exit_id) === target.dataset.exitId).targetRegion;
    testController.log(`clicking ${target.dataset.exitId} (${sideOf.get(target.dataset.exitId)}) → ${targetRegion}`);
    target.dispatchEvent(new target.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
    const moved = await testController.pollForCondition(
        () => gs.getCurrentRegion() === targetRegion,
        `the click moved the player to ${targetRegion}`,
        8000, 200,
    );
    testController.assertEqual(`the click on a sided exit moved the player to ${targetRegion}`, true, !!moved);

    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-compass-grid-renders-procgen-sides',
    name: 'Wrapper: a generated text-adventure room renders its exits on the compass grid by side',
    description: 'Generates the shuffled-spiral world, mounts the wrapper, and asserts the engine '
               + 'rendered the compass grid with every exit of the current room in the cell of its '
               + 'sidecar payload side, then clicks a sided exit and asserts the move. Proves the '
               + 'bridge reads the deserialized world\'s exit Map (G2a).',
    testFunction: compassGridRendersProcgenSides,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * ⛓⛓ PRESET SIDECARS G2b-1 — **A DOCUMENT'S GATE HOLDS AT PLAY.**
 *
 * The ten rows above generate the shuffled SPIRAL, whose text-adventure rooms
 * are ungated (`True_` everywhere — a room places no obstacle), so none of them
 * can see a gate. This row loads the committed gated top-down fixture
 * (`procgen_topdown/AP_11`) and asserts, with every name READ OFF THE DOCUMENT:
 *   1. in the first text-adventure room reached from the start region, every
 *      gated exit link is `tae-link-inaccessible` and a click on each does NOT
 *      move the player (the negative is held for `GATE_SETTLE_MS`, and that
 *      budget is then compared with the measured latency of a real move);
 *   2. granting the items the first gated `Has` exit names makes it
 *      accessible, and a click moves the player to its target;
 *   3. back in that room, a gated location is inaccessible and a click checks
 *      nothing, until every item its rule names is granted — then a click
 *      checks it.
 * ⚠ It proves the DOCUMENT's rule holds at play; the payload's gates equal the
 * document's by the corpus control (`check-sidecar-fields`' rule-agreement
 * layer), not by this row.
 */
const GATED_TA_PRESET_PATH = './presets/procgen_topdown/AP_11/AP_11_rules.json';
/**
 * ⛓ How long a click on an inaccessible link is watched for a move that must
 * not happen. ⛔ A margin is MEASURED: the row times the real move of step 2
 * and reports the ratio, so a budget shorter than the app's own move latency
 * reds instead of passing vacuously.
 */
const GATE_SETTLE_MS = 2000;
const GATE_SETTLE_MIN_RATIO = 4;

/** The item names a `Has` / `HasAll` rule requires, read off the rule; null for any other shape. */
function itemsOfRule(rule) {
    if (rule?.rule === 'Has' && typeof rule.args?.item_name === 'string') return [rule.args.item_name];
    if (rule?.rule === 'HasAll' && Array.isArray(rule.args?.item_names)) return [...rule.args.item_names];
    return null;
}

async function gateHoldsInPlay(testController) {
    const doc = await (await fetch(GATED_TA_PRESET_PATH)).json();
    const slot = '1';
    const regions = doc.regions[slot];
    const sidecars = doc.preset_sidecars?.[slot] ?? {};
    const isRoom = (name) => sidecars[name]?.substrate === 'text_adventure';
    const gated = (r) => !!r && r.rule !== 'True_';

    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive) gs.setLoopModeActive(false);

    const rulesLoaded = testController.waitForEvent('stateManager:rulesLoaded', 10000);
    testController.eventBus.publish('files:jsonLoaded', {
        jsonData: doc, selectedPlayerId: slot, sourceName: 'tasw-gate-holds-in-play',
    });
    await rulesLoaded;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    // ⛔ IDENTITY, not existence (trap 1302): the app may be loading its own default.
    const docRegions = JSON.stringify(Object.keys(regions).sort());
    const loaded = await testController.pollForCondition(() => {
        const sd = testController.stateManager.getStaticData?.();
        return testController.stateManager.getGameName?.() === doc.game_name
            && !!sd?.regions && JSON.stringify([...sd.regions.keys()].sort()) === docRegions;
    }, `the loaded document is ${GATED_TA_PRESET_PATH} (game + region set)`, 10000, 100);
    testController.reportCondition(`the loaded document is ${GATED_TA_PRESET_PATH} (game "${doc.game_name}", `
        + `${Object.keys(regions).length} regions)`, !!loaded);
    if (!loaded) return testController.getOverallResult();

    // ⛓ The room: the first text-adventure region an UNGATED exit of a start region reaches,
    //   holding a gated exit and a gated location.
    const starts = doc.start_regions?.[slot]?.default ?? doc.start_regions?.[slot] ?? [];
    let start = null;
    let entry = null;
    for (const s of [...(Array.isArray(starts) ? starts : []), ...Object.keys(regions)]) {
        const e = (regions[s]?.exits ?? []).find((x) => !gated(x.access_rule) && isRoom(x.connected_region)
            && (regions[x.connected_region].exits ?? []).some((y) => itemsOfRule(y.access_rule)?.length)
            && (regions[x.connected_region].locations ?? []).some((l) => itemsOfRule(l.access_rule)?.length));
        if (e) { start = s; entry = e; break; }
    }
    testController.reportCondition('⛓ premise: the document has a gated text-adventure room behind an open exit',
        !!entry);
    if (!entry) return testController.getOverallResult();
    const room = entry.connected_region;
    const roomExits = regions[room].exits;
    const gatedExits = roomExits.filter((x) => gated(x.access_rule));
    const opener = gatedExits.find((x) => itemsOfRule(x.access_rule)?.length);
    const gatedLocation = regions[room].locations.find((l) => itemsOfRule(l.access_rule)?.length);
    const held = () => {
        const inv = testController.stateManager.getSnapshot()?.inventory ?? {};
        return (name) => (inv[name] ?? 0) > 0;
    };
    const needed = [...new Set([...itemsOfRule(opener.access_rule), ...itemsOfRule(gatedLocation.access_rule)])];
    testController.reportCondition(`⛓ premise: none of the gate items is held at load (${needed.join(', ')})`,
        needed.every((n) => !held()(n)));
    testController.log(`start ${start} --${entry.name}--> ${room}; gated exits ${gatedExits.map((x) => x.name)}; `
        + `opener ${opener.name} → ${opener.connected_region}; gated location "${gatedLocation.name}"`);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'textAdventureSubstrateWrapperPanel' });
    const iframeDoc = () => document.querySelector('iframe.tasw-iframe')?.contentDocument ?? null;
    const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',
        { bubbles: true, cancelable: true }));
    const linkFor = (attr, id) => [...(iframeDoc()?.querySelectorAll(`[${attr}]`) ?? [])]
        .find((l) => l.getAttribute(attr) === id) ?? null;
    const exploreUntil = async (done) => {
        for (let i = 0; i < 20 && !done(); i++) {
            const explore = iframeDoc()?.querySelector('[data-action="explore"]');
            if (!explore) break;
            click(explore);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 200));
        }
        return done();
    };
    /** Hold a NEGATIVE: the region must still be `region` at every poll for `GATE_SETTLE_MS`. */
    const staysIn = async (region) => {
        const until = Date.now() + GATE_SETTLE_MS;
        while (Date.now() < until) {
            if (gs.getCurrentRegion() !== region) return false;
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 100));
        }
        return gs.getCurrentRegion() === region;
    };

    // ⛓ Into the room. MEASURED (G2b-1): on load the app itself moves the player
    //   through the start region's lone open exit, so the wrapper may already be
    //   in the room; when it is still at the start, the exit is clicked as a player would.
    const mounted = await testController.pollForCondition(
        () => [start, room].includes(gs.getCurrentRegion()) && iframeDoc()?.querySelector('.tae-actions') !== null,
        `the wrapper rendered ${start} or ${room}`, 15000, 300);
    testController.reportCondition(`the wrapper rendered ${start} or ${room}`, !!mounted);
    if (!mounted) {
        testController.log(`current region ${JSON.stringify(gs.getCurrentRegion())}; iframe `
            + `${document.querySelector('iframe.tasw-iframe') ? 'present' : 'absent'}`, 'error');
        return testController.getOverallResult();
    }
    if (gs.getCurrentRegion() === start) {
        const atStart = await exploreUntil(() => !!linkFor('data-exit-id', entry.name));
        testController.reportCondition(`the wrapper rendered ${start}'s exit ${entry.name}`, !!atStart);
        if (!atStart) return testController.getOverallResult();
        click(linkFor('data-exit-id', entry.name));
    } else {
        testController.log(`the app entered ${room} from ${start} on load (${entry.name} is open)`);
    }
    const inRoom = await testController.pollForCondition(() => gs.getCurrentRegion() === room,
        `the player is in ${room}`, 8000, 100);
    testController.reportCondition(`the player is in ${room}`, !!inRoom);
    if (!inRoom) return testController.getOverallResult();

    const allRendered = () => roomExits.every((x) => !!linkFor('data-exit-id', x.name))
        && !!linkFor('data-item-id', gatedLocation.name);
    testController.reportCondition(`every exit of ${room} and "${gatedLocation.name}" rendered as a link`,
        await exploreUntil(allRendered));

    // (1) every gated exit: inaccessible, and a click does not move.
    for (const x of gatedExits) {
        const link = linkFor('data-exit-id', x.name);
        testController.reportCondition(`${room}: gated exit ${x.name} is tae-link-inaccessible`,
            !!link && link.classList.contains('tae-link-inaccessible'));
        if (link) click(link);
        testController.reportCondition(`${room}: a click on gated ${x.name} leaves the player in ${room} `
            + `for ${GATE_SETTLE_MS} ms`, await staysIn(room));
    }

    // (2) grant the opener's items → accessible → a click moves.
    for (const n of itemsOfRule(opener.access_rule)) {
        // eslint-disable-next-line no-await-in-loop
        await testController.stateManager.addItemToInventory(n, 1);
    }
    await testController.stateManager.pingWorker('after-opener-items', 3000);
    const opened = await testController.pollForCondition(
        () => linkFor('data-exit-id', opener.name)?.classList.contains('tae-link-accessible'),
        `${opener.name} becomes accessible once ${itemsOfRule(opener.access_rule).join(', ')} is held`, 8000, 100);
    testController.reportCondition(`${opener.name} becomes tae-link-accessible once `
        + `${itemsOfRule(opener.access_rule).join(', ')} is held`, !!opened);
    if (!opened) return testController.getOverallResult();
    const t0 = Date.now();
    click(linkFor('data-exit-id', opener.name));
    const moved = await testController.pollForCondition(() => gs.getCurrentRegion() === opener.connected_region,
        `the click on ${opener.name} moved the player to ${opener.connected_region}`, 8000, 50);
    const moveMs = Date.now() - t0;
    testController.reportCondition(`the click on ${opener.name} moved the player to ${opener.connected_region}`,
        !!moved);
    testController.reportCondition(`⛓ the negative settle (${GATE_SETTLE_MS} ms) is ≥ ${GATE_SETTLE_MIN_RATIO}× `
        + `the measured move latency (${moveMs} ms)`, !!moved && GATE_SETTLE_MS >= GATE_SETTLE_MIN_RATIO * moveMs);
    if (!moved) return testController.getOverallResult();

    // (3) back in the room: the gated location refuses, until its items are held.
    window.eventDispatcher?.publish('test', 'user:regionMove', {
        sourceRegion: opener.connected_region, targetRegion: room, exitName: null,
    }, { initialTarget: 'bottom' });
    const back = await testController.pollForCondition(() => gs.getCurrentRegion() === room
        && !!linkFor('data-item-id', gatedLocation.name), `back in ${room} with "${gatedLocation.name}" rendered`,
    8000, 100) || await exploreUntil(() => gs.getCurrentRegion() === room && !!linkFor('data-item-id', gatedLocation.name));
    testController.reportCondition(`back in ${room} with "${gatedLocation.name}" rendered`, !!back);
    if (!back) return testController.getOverallResult();
    const checked = () => {
        const set = testController.stateManager.getSnapshot()?.checkedLocations;
        return set instanceof Set ? set.has(gatedLocation.name) : (Array.isArray(set) && set.includes(gatedLocation.name));
    };
    const locItems = itemsOfRule(gatedLocation.access_rule);
    const missing = locItems.filter((n) => !held()(n));
    testController.reportCondition(`⛓ premise: "${gatedLocation.name}" still lacks ${missing.join(', ')}`,
        missing.length > 0);
    const locLink = linkFor('data-item-id', gatedLocation.name);
    testController.reportCondition(`"${gatedLocation.name}" is tae-link-inaccessible without ${missing.join(', ')}`,
        !!locLink && locLink.classList.contains('tae-link-inaccessible'));
    if (locLink) click(locLink);
    await new Promise((r) => setTimeout(r, GATE_SETTLE_MS));
    await testController.stateManager.pingWorker('after-blocked-check', 3000);
    testController.reportCondition(`a click on inaccessible "${gatedLocation.name}" checks nothing for `
        + `${GATE_SETTLE_MS} ms`, !checked());
    for (const n of missing) {
        // eslint-disable-next-line no-await-in-loop
        await testController.stateManager.addItemToInventory(n, 1);
    }
    await testController.stateManager.pingWorker('after-location-items', 3000);
    const locOpen = await testController.pollForCondition(
        () => linkFor('data-item-id', gatedLocation.name)?.classList.contains('tae-link-accessible'),
        `"${gatedLocation.name}" becomes accessible once ${locItems.join(', ')} are held`, 8000, 100);
    testController.reportCondition(`"${gatedLocation.name}" becomes tae-link-accessible once `
        + `${locItems.join(', ')} are held`, !!locOpen);
    if (!locOpen) return testController.getOverallResult();
    click(linkFor('data-item-id', gatedLocation.name));
    const didCheck = await testController.pollForCondition(checked,
        `the click checks "${gatedLocation.name}"`, 8000, 100);
    testController.reportCondition(`the click checks "${gatedLocation.name}"`, !!didCheck);
    return testController.getOverallResult();
}

registerTest({
    id: 'tasw-gate-holds-in-play',
    name: 'Wrapper: a committed document\'s exit and location gates hold at play in a text-adventure room',
    description: 'Loads procgen_topdown/AP_11 (identity wait), enters its gated text-adventure room by a click, '
               + 'asserts every gated exit is inaccessible and a click does not move, grants the items the '
               + 'first gated exit names and asserts it opens and moves, then asserts a gated location '
               + 'refuses until its items are held. Every name is read off the document (G2b-1).',
    testFunction: gateHoldsInPlay,
    category: 'textAdventureSubstrateWrapper',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
