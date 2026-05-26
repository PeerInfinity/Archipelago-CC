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
    enabled: true,
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
    enabled: true,
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
        // Diagnostics: report what we found instead.
        const iframe = document.querySelector('iframe.tasw-iframe');
        const status = iframe?.contentDocument?.getElementById?.('status')?.textContent ?? '(no status)';
        const appHtml = iframe?.contentDocument?.getElementById?.('app')?.innerHTML?.slice(0, 500) ?? '(no app)';
        const dataActionCount = iframe?.contentDocument?.querySelectorAll?.('[data-action]')?.length ?? -1;
        const dataExitCount = iframe?.contentDocument?.querySelectorAll?.('[data-exit-id]')?.length ?? -1;
        testController.log(`iframe status: ${status}`);
        testController.log(`iframe app html (first 500): ${appHtml}`);
        testController.log(`data-action elements: ${dataActionCount}`);
        testController.log(`data-exit-id elements: ${dataExitCount}`);
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
    enabled: true,
});
