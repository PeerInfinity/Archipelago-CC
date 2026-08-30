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

    const itemPool = {
        victory: 1,
        key_red: 1,
        key_green: 1,
        key_blue: 1,
    };
    const obstaclePool = {
        door_red: 1,
        door_green: 1,
        door_blue: 1,
    };
    const substrateQuotas = { text_adventure: 6, maze: 3 };
    const seed = 'tasw-test-1';

    let grid, startCell, stats, pool;
    try {
        const result = arrangeShuffledSpiral({
            regionSize: { width: 7, height: 7 },
            itemPool: { ...itemPool },
            obstaclePool: { ...obstaclePool },
            seed,
            regionParams: {},
            growthParams: {
                substrateQuotas,
                maxItemsPerRegion: 2,
                startSubstrate: 'text_adventure',
            },
            hazardOpts: {},
        });
        grid = result.grid; startCell = result.startCell;
        stats = result.stats; pool = result.pool;
    } catch (e) {
        testController.log(`arrangeShuffledSpiral threw: ${e.message}`, 'error');
        testController.reportCondition('generated shuffled-spiral grid', false);
        return testController.getOverallResult();
    }
    testController.log(`Generated grid: ${stats.regionsPlaced} regions, stop=${stats.stopReason}`);
    testController.reportCondition('generated shuffled-spiral grid', true);

    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        completionConditionItem: 'victory',
        procgenMetadata: { driver: 'shuffled-spiral-test', stop_reason: stats.stopReason },
    });
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
