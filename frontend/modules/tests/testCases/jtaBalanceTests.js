/**
 * In-app tests for the jtaBalance module (Phase 3e) — the Pass-B balance
 * solve wired into the running app.
 *
 *   • jta-balance-solve-at-rules-load — loading a procgen jta world with a
 *     cleared cache runs the balance worker at stateManager:rulesLoaded,
 *     merges {id, cost_multiplier} patches into the procgenPlayer warehouse
 *     world.task_patches, and caches them by seed; re-loading the same rules
 *     merges from the cache (fast path, no worker); entering the region
 *     applies the patched cost to the live fork def (bridge applyTaskPatches
 *     path).
 *
 * Loads the jta_locations_test preset (embedded Pass-A sphere log; per-task
 * AP locations + grant-suppression task_patches sidecars). Runs only in the
 * test-substrates mode (full module config — jtaBalance registers there).
 */

import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { computeSeedName, cacheKey } from '../../jtaBalance/hostGlue.js';
import {
    JTA_LOCTEST_PRESET_PATH,
    JTA_LOCTEST_REGION,
    JTA_LOCTEST_START_REGION,
    waitForJtaActive,
    moveToRegion,
    getJtaIframe,
    eventually,
} from '../../jtaSubstrateWrapper/test-helpers.js';

/** The live procgenPlayer warehouse (Map regionId -> {substrate, world, ...}). */
function getWarehouse() {
    return centralRegistry.getPublicFunction?.('procgenPlayer', 'getWarehouse')?.() ?? null;
}

/** All {id, cost_multiplier} patches across the warehouse's jta regions. */
function warehouseCostPatches() {
    const warehouse = getWarehouse();
    if (!warehouse || typeof warehouse.keys !== 'function') return [];
    const out = [];
    for (const regionId of warehouse.keys()) {
        const entry = warehouse.get(regionId);
        if (entry?.substrate !== 'jta') continue;
        for (const p of entry.world?.task_patches ?? []) {
            if (Object.prototype.hasOwnProperty.call(p, 'cost_multiplier')) out.push(p);
        }
    }
    return out;
}

async function balanceSolveAtRulesLoad(testController) {
    // The preset's seed is fixed; clear its cache so the COLD path actually
    // solves rather than replaying a previous test run's cache.
    const rulesResp = await fetch(JTA_LOCTEST_PRESET_PATH);
    const rulesDoc = await rulesResp.json();
    const seed = computeSeedName(rulesDoc);
    const key = cacheKey(seed);
    localStorage.removeItem(key);
    testController.log(`cleared balance cache for seed ${seed} (${key})`);

    testController.log('Loading jta_locations_test preset (cold cache)…');
    await testController.loadRulesFromFile(JTA_LOCTEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.reportCondition('rules loaded', true);

    // Leg 1 — the worker solve completes and merges cost patches into the
    // warehouse's jta region worlds (task_patches gains {id, cost_multiplier}
    // entries alongside the grant-suppression {id, perk} ones).
    const solved = await eventually(testController,
        () => warehouseCostPatches().length > 0,
        'warehouse task_patches gained cost_multiplier patches', 120000, 1000);
    testController.assertEqual('balance solve merged cost patches into the warehouse', true, solved);
    const coldPatches = warehouseCostPatches();
    testController.log(`cold solve merged ${coldPatches.length} cost patches`);

    // Leg 2 — the solve is cached by seed.
    let cachedRaw = null;
    const cached = await eventually(testController, () => {
        cachedRaw = localStorage.getItem(key);
        return !!cachedRaw;
    }, `balance cache present at ${key}`, 15000, 500);
    testController.assertEqual('patches cached in localStorage by seed', true, cached);
    if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        testController.assertEqual('cache holds the merged patch count',
            coldPatches.length, parsed.length);
    }

    // Leg 3 — cache hit: re-loading the same rules rebuilds the warehouse
    // (sidecar-only task_patches) and the rulesLoaded handler merges from the
    // cache synchronously — no worker, so this lands fast.
    testController.log('Re-loading the same preset (cache hit)…');
    await testController.loadRulesFromFile(JTA_LOCTEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-reload', 3000);
    const rehit = await eventually(testController,
        () => warehouseCostPatches().length === coldPatches.length,
        'cost patches re-merged from cache after reload', 15000, 250);
    testController.assertEqual('cache-hit merge restored the cost patches', true, rehit);

    // Leg 4 — end to end: entering the jta region applies the merged patches
    // to the live fork defs (bridge _applyTaskPatches -> window.applyTaskPatches).
    testController.eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
    testController.log(`Moving into jta region ${JTA_LOCTEST_REGION}…`);
    moveToRegion(JTA_LOCTEST_REGION, JTA_LOCTEST_START_REGION);
    const win = await waitForJtaActive(testController);
    testController.reportCondition('jta bridge active', !!win);
    if (!win) return testController.getOverallResult();

    const patchById = new Map(coldPatches.map((p) => [p.id, p.cost_multiplier]));
    const applied = await eventually(testController, () => {
        const tasks = getJtaIframe()?.contentWindow?.getAvailableTasks?.() ?? [];
        return tasks.some((t) => patchById.has(t.id)
            && Math.abs(t.costMult - patchById.get(t.id)) / patchById.get(t.id) < 1e-6);
    }, 'a live task def carries its solved cost_multiplier', 20000, 500);
    testController.assertEqual('solved cost applied to the live fork def on region entry', true, applied);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-balance-solve-at-rules-load',
    name: 'JtA balance: Pass-B solve runs at rules load, caches by seed, patches live costs',
    description: 'Cold-loads the jta_locations_test preset with a cleared cache and asserts the '
               + 'balance worker merges cost patches into the warehouse, caches them by seed, '
               + 're-merges from the cache on reload, and the bridge applies the solved cost to '
               + 'the live fork def on region entry.',
    testFunction: balanceSolveAtRulesLoad,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
