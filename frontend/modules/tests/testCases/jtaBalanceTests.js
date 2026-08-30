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
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { JTA_PERK_ITEM_NAMES } from '../../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import { vanillaPerkNameByTaskId } from '../../jtaSubstrateWrapper/vanillaDataset.js';
import {
    JTA_LOCTEST_PRESET_PATH,
    JTA_LOCTEST_REGION,
    JTA_LOCTEST_START_REGION,
    JTA_RANDTEST_PRESET_PATH,
    JTA_RANDTEST_REGION,
    JTA_RANDTEST_START_REGION,
    waitForJtaActive,
    resetJtaSaveAndReload,
    moveToRegion,
    getJtaIframe,
    eventually,
    readCurrentRegion,
    readLoopResetCount,
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

// ---------------------------------------------------------------------------
// Phase 4 smoke: a randomized + balanced world actually PLAYS.
// ---------------------------------------------------------------------------

/** taskId -> the perk that task grants in vanilla (null if it grants none). */
const NATIVE_PERK_OF = vanillaPerkNameByTaskId();

/** Region name -> jtaZone, from the preset's sidecars. */
function zoneByRegion(rulesDoc) {
    const playerId = Object.keys(rulesDoc.preset_sidecars ?? {})[0];
    const out = new Map();
    for (const [region, sidecar] of Object.entries(rulesDoc.preset_sidecars?.[playerId] ?? {})) {
        const payload = sidecar.playable_payload ?? sidecar;
        if (typeof payload.jtaZone === 'number') out.set(region, payload.jtaZone);
    }
    return out;
}

/** The exit of `region` that leads one zone deeper, or null. */
function exitToNextZone(rulesDoc, region) {
    const playerId = Object.keys(rulesDoc.preset_sidecars ?? {})[0];
    const zones = zoneByRegion(rulesDoc);
    const payload = rulesDoc.preset_sidecars[playerId][region]?.playable_payload;
    const here = zones.get(region);
    for (const exit of payload?.exits ?? []) {
        if (zones.get(exit.targetRegion) === here + 1) return exit.exitName;
    }
    return null;
}

/**
 * Play one zone under the game's own automation until the host takes the exit.
 * Returns the number of loop resets it took, or -1 on timeout.
 *
 * Two things make this more than a poll. First, a walk SPANS loop resets by
 * design (fresh skills cannot clear a zone on one pool), and a loop reset
 * teleports the player to the resolved start region — off the jta region, which
 * pauses the game and parks the walk. In real usage the loops queue re-issues
 * its regionMove; here we emulate that, exactly as `jta-bot-walkto-exit` does.
 *
 * Second, we pump `stepTick` rather than waiting on the wall clock, and
 * deliberately do NOT enable instant mode: `completeTaskInstantly` is
 * affordability-blind, so it would finish tasks whatever the solved cost and the
 * test would pass on a wedged world. Normal ticking is the same mode the balance
 * pass runs under. Ticks are pumped only while the region is live — ticking a
 * paused, teleported-away game would desync it from the host.
 */
async function walkOneZone(testController, controller, { from, to, exitName }, timeoutMs = 120000) {
    controller.walkTo({ kind: 'exit', name: exitName });
    testController.log(`walkTo ${exitName} — automation playing ${from}…`);

    let lastResets = readLoopResetCount();
    const startResets = lastResets;
    const deadline = Date.now() + timeoutMs;
    let lastContinueAt = 0;
    while (Date.now() < deadline) {
        const w = getJtaIframe()?.contentWindow;
        if (typeof w?.stepTick === 'function' && w.isGameLoopPaused?.() === false) {
            for (let i = 0; i < 200; i++) w.stepTick();
        }
        // Out of energy: the run is over and the fork parks in `is_in_energy_reset`
        // waiting to be continued. Nothing continues it here — `auto_continue_energy_reset`
        // ships OFF, and the loop-mode mana mirror that would drive a host loop
        // reset is inactive on this preset (the bridge gates it on
        // `world.manaEnabled`, which Pass-A payloads do not carry). In the real
        // app the player clicks the fork's own reset button; the test clicks it.
        // `reset` -> doEnergyReset, which cascades into a host loop reset.
        const st = w?.getFullState?.();
        if (st?.isInEnergyReset && Date.now() - lastContinueAt > 500) {
            lastContinueAt = Date.now();
            controller.reset();
        }
        await new Promise((r) => setTimeout(r, 25));
        if (readCurrentRegion() === to) return lastResets - startResets;

        const resets = readLoopResetCount();
        if (resets === lastResets) continue;
        lastResets = resets;
        if (readCurrentRegion() === to) return lastResets - startResets;
        // Teleported off the jta region by the reset — walk back and re-dispatch.
        if (readCurrentRegion() !== from) moveToRegion(from, readCurrentRegion());
        const active = await eventually(testController,
            () => getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === false,
            'jta region active again after loop reset', 10000);
        if (!active) continue;
        controller.walkTo({ kind: 'exit', name: exitName });
    }
    return -1;
}

/**
 * The randomized + balanced world progresses zones 1 -> 3 under the game's own
 * automation, driven by the PlaybackController.
 *
 * This is the in-app counterpart to the Round 8 harness runs: those play the
 * fork headlessly, this proves the same world moves through the REAL stack —
 * jtaBalance solves at rules load, the bridge merges cost + suppression patches
 * on region entry, walkTo arms automation, Travel completions hand the player to
 * the host, and AP location checks land as tasks complete.
 *
 * See walkOneZone for why this uses normal ticking rather than instant mode.
 */
async function randomizedBalancedProgression(testController) {
    const rulesDoc = await (await fetch(JTA_RANDTEST_PRESET_PATH)).json();

    // Leg 0 — the preset really is randomized (a vacuous identity shuffle would
    // make everything below pass while testing nothing).
    const perkNames = new Set(JTA_PERK_ITEM_NAMES);
    const playerId = Object.keys(rulesDoc.regions)[0];
    let perkLocs = 0;
    let movedPerks = 0;
    for (const region of Object.values(rulesDoc.regions[playerId])) {
        for (const loc of region.locations ?? []) {
            const itemName = typeof loc.item === 'string' ? loc.item : loc.item?.name;
            if (!perkNames.has(itemName)) continue;
            perkLocs++;
            if (NATIVE_PERK_OF.get(Number(String(loc.name).split('__')[1])) !== itemName) movedPerks++;
        }
    }
    testController.log(`preset places ${perkLocs} perks, ${movedPerks} off their native task`);
    testController.assertEqual('perk placement is shuffled, not identity', true, movedPerks > 0);

    // Leg 1 — cold solve at rules load (cleared cache, so the worker really runs).
    const key = cacheKey(computeSeedName(rulesDoc));
    localStorage.removeItem(key);
    await testController.loadRulesFromFile(JTA_RANDTEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    const solved = await eventually(testController,
        () => warehouseCostPatches().length > 0,
        'balance solve merged cost patches into the warehouse', 120000, 1000);
    testController.assertEqual('randomized world was balanced at rules load', true, solved);
    testController.log(`solve merged ${warehouseCostPatches().length} cost patches`);

    // Leg 2 — enter zone 0 with a fresh game (the save slot is shared across
    // every jta test in the run).
    testController.eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
    moveToRegion(JTA_RANDTEST_REGION, JTA_RANDTEST_START_REGION);
    if (!await waitForJtaActive(testController)) {
        testController.reportCondition('jta bridge active', false);
        return testController.getOverallResult();
    }
    const gameWin = await resetJtaSaveAndReload(testController);
    testController.reportCondition('fresh jta game active after save reset', !!gameWin);
    if (!gameWin) return testController.getOverallResult();
    testController.assertEqual('fresh game starts in zone 0', 0, gameWin.getFullState().currentZone);

    const controller = substrateRegistry.get('jta')?.getPlaybackController?.();
    testController.assertEqual('registry exposes a live PlaybackController', true, !!controller);
    if (!controller) return testController.getOverallResult();

    // Leg 3 — walk zone 0 -> 1 -> 2 (the 1st through 3rd zones). Each walkTo
    // designates the exit; the game's own automation plays the zone.
    const zones = zoneByRegion(rulesDoc);
    let totalResets = 0;
    for (let target = 1; target <= 2; target++) {
        const from = [...zones.keys()].find((r) => zones.get(r) === target - 1);
        const to = [...zones.keys()].find((r) => zones.get(r) === target);
        const exitName = exitToNextZone(rulesDoc, from);
        testController.assertEqual(`zone ${target - 1} region ${from} has an exit onward`, true, !!exitName);
        if (!exitName) return testController.getOverallResult();

        const resets = await walkOneZone(testController, controller, { from, to, exitName });
        totalResets += Math.max(0, resets);
        testController.assertEqual(`progressed into zone ${target} (region ${to})`, true, resets >= 0);
        if (resets < 0) return testController.getOverallResult();
        testController.log(`reached ${to} after ${resets} loop reset(s)`);
    }
    testController.log(`walked zones 1→3 across ${totalResets} loop reset(s)`);

    // Leg 4 — playing those zones checked their AP locations, and the perks
    // those locations held came back as AP items and were granted in-game.
    await testController.stateManager.pingWorker('after-walk', 3000);
    const snapshot = testController.stateManager.getSnapshot();
    const checked = snapshot?.checkedLocations ?? [];
    const checkedList = Array.isArray(checked) ? checked : Object.keys(checked);
    const jtaChecks = checkedList.filter((n) => String(n).includes('__'));
    testController.log(`${jtaChecks.length} jta AP locations checked while walking`);
    testController.assertEqual('playing the zones checked AP locations', true, jtaChecks.length > 0);

    // Grants are AP-authoritative: local perk grants are suppressed, so every
    // perk held must have arrived as a received AP item, and every received perk
    // item must have been granted. A leaked local grant would make perks EXCEED
    // items; a missed grant would leave them short.
    //
    // Poll rather than sample once: the bridge reconciles inventory into grants
    // on `stateManager:snapshotUpdated`, so an item received on the walk's last
    // tick lands in the snapshot before its grant does.
    const perkCounts = () => {
        const inv = testController.stateManager.getSnapshot()?.inventory ?? {};
        return {
            received: JTA_PERK_ITEM_NAMES.filter((n) => Number(inv[n] ?? 0) > 0).length,
            held: getJtaIframe()?.contentWindow?.getFullState?.().perks?.length ?? -1,
        };
    };
    const converged = await eventually(testController, () => {
        const { received, held } = perkCounts();
        return received > 0 && held === received;
    }, 'perks held == perk items received', 20000, 250);
    const { received, held } = perkCounts();
    testController.log(`perks held ${held}, perk items received ${received}`);
    testController.assertEqual('at least one perk arrived as an AP item', true, received > 0);
    testController.assertEqual('perks held == perk items received (grants are AP-authoritative)',
        true, converged);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-randomized-balanced-progression',
    name: 'JtA balance: a randomized + balanced world progresses zones 1→3 under automation',
    description: 'Loads the shuffled 4-zone jta_randomized_test preset, asserts the perk placement '
               + 'is really shuffled and the Pass-B solve runs at rules load, then drives the '
               + "game's own automation (normal ticking, not instant mode) through zones 1→3 via "
               + 'PlaybackController.walkTo, asserting AP location checks land and every perk held '
               + 'arrived as an AP item.',
    testFunction: randomizedBalancedProgression,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});

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
