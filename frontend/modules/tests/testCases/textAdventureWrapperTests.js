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
