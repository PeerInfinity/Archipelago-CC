/**
 * End-to-end tests for the flashSubstrate (SWFRecomp Flash game as a
 * procgen substrate, Mode 1 — opaque fixed minigame). Each test drives a
 * real load + interaction and asserts on stateManager snapshot state,
 * mirroring textAdventureWrapperTests.js (the directly-analogous
 * iframe-substrate precedent).
 *
 * The substrate has no procgen build-time hooks (Mode 1), so these tests
 * load an existing procgen preset to get a real stateManager world, then
 * exercise the substrate's runtime legs against it:
 *
 *   1. Direct host-side dispatcher publish of user:locationCheck — proves
 *      the host-side chain (dispatcher -> stateManager -> checkedLocations)
 *      runs end-to-end with the payload shape the bridge produces
 *      (locationName-keyed). Isolates host handling from the iframe.
 *
 *   2. Placeholder-driven flow — activates the panel so the iframe mounts,
 *      configures it via flash:loadRegion with an ap_locations map,
 *      clicks a rendered objective button, and asserts the mapped AP
 *      location lands in checkedLocations. Exercises the real chain:
 *      placeholder button -> __swfBridge.sendLocation -> bridge ->
 *      IframeClient.publishEventDispatcher -> iframeAdapter -> dispatcher
 *      -> stateManager.
 */

import { registerTest } from '../testRegistry.js';

const PROCGEN_RULES_PATH = './presets/procgen_maze/AP_1/AP_1_rules.json';

/**
 * Find any location in the loaded rules and return
 * { locationName, regionName } so tests don't hard-code names that vary
 * between presets. We map an arbitrary flash_name to this real AP
 * location name so the locationCheck actually lands in stateManager.
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

function snapshotHasLocation(snapshot, locationName) {
    const checked = snapshot?.checkedLocations;
    if (checked instanceof Set) return checked.has(locationName);
    if (Array.isArray(checked)) return checked.includes(locationName);
    return false;
}

/**
 * Leg 1 — publish user:locationCheck via the host dispatcher with the
 * exact payload shape the bridge sends (locationName / regionName), and
 * assert the snapshot lists it as checked. If this fails, the bug is in
 * host-side handling, not the iframe transport.
 */
async function locationCheckDirectDispatch(testController) {
    testController.log('Loading procgen_maze preset…');
    await testController.loadRulesFromFile(PROCGEN_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    const staticData = testController.stateManager.getStaticData?.();
    const pick = pickAnyLocation(staticData);
    if (!pick) {
        testController.reportCondition('found a location to check', false);
        return testController.getOverallResult();
    }
    const { locationName, regionName } = pick;
    testController.log(`Selected location: ${locationName} in region ${regionName}`);

    const before = testController.stateManager.getSnapshot();
    testController.assertEqual('location not yet checked before publish', false,
        snapshotHasLocation(before, locationName));

    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    const dispatcher = window.eventDispatcher;
    if (!dispatcher) {
        testController.reportCondition('window.eventDispatcher available', false);
        return testController.getOverallResult();
    }
    // Same shape flashSubstrate/bridge.js's _onSendLocation produces.
    dispatcher.publish(
        'iframeAdapter',
        'user:locationCheck',
        {
            locationName,
            regionName,
            originator: 'flashSubstrate-test',
        },
        { initialTarget: 'bottom' },
    );

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-locationCheck', 3000);

    const after = testController.stateManager.getSnapshot();
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after publish`,
        true,
        snapshotHasLocation(after, locationName),
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'swf-location-check-direct-dispatch',
    name: 'Flash: user:locationCheck via host dispatcher updates checkedLocations',
    description: 'Loads a procgen preset, picks an arbitrary location, publishes '
               + 'user:locationCheck via the host dispatcher with the bridge\'s '
               + 'locationName-keyed payload, and asserts the snapshot lists it as '
               + 'checked. Isolates the host-side chain from the iframe transport.',
    testFunction: locationCheckDirectDispatch,
    category: 'flashSubstrate',
    enabled: true,
});


/**
 * Leg 2 — the real placeholder flow. Activate the panel, configure the
 * region via flash:loadRegion (mapping a flash_name to a real AP
 * location name), click the rendered objective button, and assert the AP
 * location lands in checkedLocations through the full bridge chain.
 */
async function locationCheckPlaceholderClick(testController) {
    testController.log('Loading procgen_maze preset…');
    await testController.loadRulesFromFile(PROCGEN_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    const pick = pickAnyLocation(testController.stateManager.getStaticData?.());
    if (!pick) {
        testController.reportCondition('found a location to map', false);
        return testController.getOverallResult();
    }
    const { locationName, regionName } = pick;
    const flashName = 'objective_alpha';
    testController.log(`Mapping flash objective '${flashName}' -> AP location '${locationName}'`);

    // Activate the panel so its iframe mounts.
    testController.eventBus.publish('ui:activatePanel', {
        panelId: 'flashSubstratePanel',
    });

    // Tell every substrate panel that flash owns the current region,
    // so the panel reveals its iframe (the overlay otherwise hides it).
    testController.eventBus.publish('procgen:activeSubstrateChanged', {
        substrate: 'flash',
        componentType: 'flashSubstratePanel',
        label: 'Flash',
        regionId: regionName,
    });

    // Wait for the iframe to mount and its bridge to wire __swfBridge.
    let iframeWin = null;
    const bridgeReady = await testController.pollForCondition(
        () => {
            const iframe = document.querySelector('iframe.flashsub-iframe');
            if (!iframe?.contentWindow) return false;
            iframeWin = iframe.contentWindow;
            // bridge.js wires sendLocation; the placeholder defines
            // configure. Both present == ready.
            const b = iframeWin.__swfBridge;
            return !!(b && typeof b.sendLocation === 'function' && typeof b.configure === 'function');
        },
        'flash iframe mounted + __swfBridge wired',
        15000,
        300,
    );
    if (!bridgeReady) {
        testController.reportCondition('flash iframe mounted + __swfBridge wired', false);
        return testController.getOverallResult();
    }
    testController.reportCondition('flash iframe mounted + __swfBridge wired', true);

    // Give the iframe a moment to register with the iframeAdapter before
    // we drive a publish through it (otherwise the adapter rejects it as
    // "iframe not registered"). Mirrors the textAdventure wrapper test.
    await new Promise(r => setTimeout(r, 1000));

    // Configure the region — this is what procgenPlayer.publishLoadRegion
    // would send. The host relays it into the iframe via iframeAdapter.
    testController.eventBus.publish('flash:loadRegion', {
        region_id: regionName,
        world: {
            gameId: 'placeholder-demo',
            ap_locations: { [flashName]: locationName },
        },
    });

    // Wait for the placeholder to render the objective button for our
    // flash_name.
    const iframe = document.querySelector('iframe.flashsub-iframe');
    let targetBtn = null;
    const rendered = await testController.pollForCondition(
        () => {
            const doc = iframe?.contentDocument;
            if (!doc) return false;
            const buttons = [...doc.querySelectorAll('button.obj')];
            targetBtn = buttons.find(b => b.textContent.includes(flashName)) ?? null;
            return targetBtn !== null;
        },
        'placeholder rendered the objective button',
        10000,
        300,
    );
    if (!rendered) {
        testController.reportCondition('placeholder rendered the objective button', false);
        return testController.getOverallResult();
    }
    testController.reportCondition('placeholder rendered the objective button', true);

    const before = testController.stateManager.getSnapshot();
    testController.assertEqual('location not yet checked before click', false,
        snapshotHasLocation(before, locationName));

    const snapshotPromise = testController.waitForEvent('stateManager:snapshotUpdated', 5000)
        .catch(() => null);

    // Real click — same MouseEvent path a user would trigger.
    const evt = new iframeWin.MouseEvent('click', { bubbles: true, cancelable: true });
    targetBtn.dispatchEvent(evt);

    await snapshotPromise;
    await testController.stateManager.pingWorker('after-placeholder-click', 3000);

    const after = testController.stateManager.getSnapshot();
    testController.assertEqual(
        `location ${locationName} appears in checkedLocations after placeholder click`,
        true,
        snapshotHasLocation(after, locationName),
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'swf-location-check-placeholder-click',
    name: 'Flash: clicking a placeholder objective updates checkedLocations',
    description: 'Activates the panel, configures a region via flash:loadRegion '
               + 'mapping a flash objective to a real AP location name, clicks the '
               + 'rendered objective button, and asserts the AP location ends up in '
               + 'checkedLocations through the full bridge chain (sendLocation -> '
               + 'iframeAdapter -> dispatcher -> stateManager).',
    testFunction: locationCheckPlaceholderClick,
    category: 'flashSubstrate',
    enabled: true,
});
