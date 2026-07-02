/**
 * End-to-end tests for the runnerDemo substrate (auto-runner platformer
 * riding the flashSubstrate panel class + bridge under its own identity
 * — plan §4.7). Mirrors flashSubstrateTests.js, with one runner twist:
 * the game plays ITSELF. An auto-runner needs no click and no input
 * tape to cross a flat floor, so the location-check test just loads a
 * flat level whose pickup maps to a real AP location and waits for the
 * physics to run over it — the full cooperative chain (gameCore pickup
 * event -> __swfBridge.sendLocation -> bridge -> iframeAdapter ->
 * dispatcher -> stateManager) with zero synthesized input.
 *
 * Runs only in the test-substrates mode: registered enabled:false, and
 * the full module config (modules.json) is required for the runnerDemo
 * module to exist at all — test-regression's modules-nograph.json has
 * no substrate runtimes.
 */

import { registerTest } from '../testRegistry.js';

const PROCGEN_RULES_PATH = './presets/procgen_maze/AP_1/AP_1_rules.json';
const RUNNER_PRESET_RULES_PATH =
    './presets/runner_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json';

// Flat strip: the auto-runner touches the pickup at x=12 within ~2s of
// configure, no input needed. Physics omitted — configure falls back to
// the default profile, which is fine for a flat run.
const TEST_LEVEL = {
    id: 'runner_inapp_test',
    size: { width: 30.01, height: 16 },
    platforms: [{ id: 'floor', x: 0, y: 0, w: 30, h: 1, type: 'ground' }],
    hazards: [],
    pickups: [{ id: 'obj_alpha', on: 'floor', x: 12, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floor', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

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

function runnerIframe() {
    return document.querySelector('iframe[src*="runnerDemo/game/index.html"]');
}

async function waitForRunnerBridge(testController) {
    let iframeWin = null;
    const ready = await testController.pollForCondition(
        () => {
            const iframe = runnerIframe();
            if (!iframe?.contentWindow) return false;
            iframeWin = iframe.contentWindow;
            // bridge.js wires sendLocation; the game page owns configure.
            const b = iframeWin.__swfBridge;
            return !!(b && typeof b.sendLocation === 'function'
                && typeof b.configure === 'function');
        },
        'runner iframe mounted + __swfBridge wired',
        15000,
        300,
    );
    testController.reportCondition('runner iframe mounted + __swfBridge wired', !!ready);
    return ready ? iframeWin : null;
}

/**
 * Leg 1 — the auto-runner drives a real location check. Configure the
 * runner iframe via runner:loadRegion with the flat test level mapping
 * its pickup to a real AP location, then just WAIT: the game runs,
 * touches the pickup, and the cooperative chain checks the location.
 */
async function locationCheckRealPhysics(testController) {
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
    testController.log(`Mapping runner pickup 'obj_alpha' -> AP location '${locationName}'`);

    // Activate the panel so its iframe mounts, and tell the substrate
    // panels runner owns the current region (reveals the iframe).
    testController.eventBus.publish('ui:activatePanel', { panelId: 'runnerDemoPanel' });
    testController.eventBus.publish('procgen:activeSubstrateChanged', {
        substrate: 'runner',
        componentType: 'runnerDemoPanel',
        label: 'Runner Demo',
        regionId: regionName,
    });

    if (!(await waitForRunnerBridge(testController))) {
        return testController.getOverallResult();
    }
    // Let the iframe finish registering with the iframeAdapter before
    // driving a publish through it (mirrors the flash/tasw tests).
    await new Promise(r => setTimeout(r, 1000));

    const before = testController.stateManager.getSnapshot();
    testController.assertEqual('location not yet checked before the run', false,
        snapshotHasLocation(before, locationName));

    // Configure the region — what procgenPlayer would publish for a
    // runner region. The bridge relays it into the iframe.
    testController.eventBus.publish('runner:loadRegion', {
        region_id: regionName,
        world: {
            gameId: 'runnerDemo',
            params: { runnerLevel: TEST_LEVEL, sidePortals: { E: 'exit_main' } },
            ap_locations: { obj_alpha: locationName },
            exits: [],
        },
    });

    // Configure must land in the iframe before the run means anything
    // (requires the tests module to be a registered runner:loadRegion
    // publisher — the eventBus DROPS unregistered publishes).
    const configured = await testController.pollForCondition(
        () => runnerIframe()?.contentWindow?.__runnerDebug?.()?.levelId === TEST_LEVEL.id,
        'test level configured into the runner iframe',
        10000,
        300,
    );
    testController.reportCondition('test level configured into the runner iframe', !!configured);
    if (!configured) return testController.getOverallResult();

    // No input: the auto-runner reaches the pickup on its own.
    const checked = await testController.pollForCondition(
        () => snapshotHasLocation(testController.stateManager.getSnapshot(), locationName),
        'auto-runner touched the pickup and the location checked',
        15000,
        300,
    );
    await testController.stateManager.pingWorker('after-auto-run-check', 3000);
    testController.assertEqual(
        `location ${locationName} checked by the auto-runner's own physics`,
        true,
        checked && snapshotHasLocation(testController.stateManager.getSnapshot(), locationName),
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'runner-location-check-real-physics',
    name: 'Runner: the auto-runner itself drives a location check end-to-end',
    description: 'Configures the runner iframe via runner:loadRegion with a flat '
               + 'level whose pickup maps to a real AP location, then waits — the '
               + 'auto-runner touches the pickup with NO synthesized input and the '
               + 'cooperative chain (sendLocation -> bridge -> dispatcher -> '
               + 'stateManager) marks the location checked.',
    testFunction: locationCheckRealPhysics,
    category: 'runnerDemo',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});


/**
 * Leg 2 — the real preset path: loading the runner_worldgen preset must
 * end with the START REGION's generated level configured into the
 * runner iframe by procgenPlayer (warehouse from preset_sidecars,
 * runner:loadRegion, appReady race closed by the entry's iframeId).
 */
async function presetSidecarConfiguresStartRegion(testController) {
    testController.log('Loading runner_worldgen preset…');
    await testController.loadRulesFromFile(RUNNER_PRESET_RULES_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: 'runnerDemoPanel' });
    if (!(await waitForRunnerBridge(testController))) {
        return testController.getOverallResult();
    }

    const configured = await testController.pollForCondition(
        () => {
            const win = runnerIframe()?.contentWindow;
            return win?.__runnerDebug?.()?.levelId === 'gen_z0';
        },
        'start region gen_z0 configured from preset_sidecars',
        20000,
        300,
    );
    testController.assertEqual(
        'runner iframe configured with the start region level (gen_z0)',
        true,
        !!configured,
    );

    return testController.getOverallResult();
}

registerTest({
    id: 'runner-preset-sidecar-configured',
    name: 'Runner: runner_worldgen preset configures the start region into the iframe',
    description: 'Loads the shuffled-spiral runner preset and asserts procgenPlayer '
               + 'builds the warehouse from preset_sidecars and configures the start '
               + 'region\'s generated level (gen_z0) into the runner iframe via '
               + 'runner:loadRegion + the appReady re-publish.',
    testFunction: presetSidecarConfiguresStartRegion,
    category: 'runnerDemo',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
