/**
 * In-app test for the JtA synthetic-dataset path (Phase 5d,
 * jta-synthetic-data-plan §5.3) — the bridge-seam integration proof.
 * Neither parity layer exercises bridge.js: this is the one place the
 * whole runtime chain is driven — preset sidecars carry the dataset
 * (single-carrier + refs), procgenPlayer's warehouse resolves the refs,
 * the bridge applies the dataset via window.loadGameData before task
 * patches, and the world PLAYS: automation clears the themed zone,
 * task completions land as AP location checks, and the dataset's perk
 * comes back as an AP item and is granted in-game (grants stay
 * AP-authoritative under the dataset's own suppression sentinel).
 *
 * Loads the jta_dataset_test preset (3 zones from the deterministic
 * synthetic dataset generateDataset.js seed 1 z3; identity perk
 * placement). Runs only in the test-substrates mode.
 *
 * Hard-won test facts honored here (memory: project_jta_zone_randomization):
 *   1. Normal ticking with a stepTick pump — never instant mode
 *      (completeTaskInstantly is affordability-blind). Pump only while
 *      the game loop is unpaused.
 *   2. Nothing continues an exhausted run on a Pass-A preset (no
 *      manaEnabled in the payload) — on is_in_energy_reset the test
 *      clicks the game's own reset via controller.reset().
 *   3. A walk spans loop resets, and a reset teleports the player off
 *      the jta region — the test re-moveToRegion's and re-dispatches
 *      walkTo, exactly as the real loops queue would.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { detectJtaWorld } from '../../jtaBalance/hostGlue.js';
import {
    waitForJtaActive,
    resetJtaSaveAndReload,
    moveToRegion,
    getJtaIframe,
    eventually,
    readCurrentRegion,
    readLoopResetCount,
} from '../../jtaSubstrateWrapper/test-helpers.js';

export const JTA_DATASETTEST_PRESET_PATH =
    './presets/jta_dataset_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const START_REGION = 'Menu';

/** Region payloads [regionName, payload] of the first player's sidecars. */
function sidecarPayloads(rulesDoc) {
    const playerId = Object.keys(rulesDoc.preset_sidecars ?? {})[0];
    return Object.entries(rulesDoc.preset_sidecars?.[playerId] ?? {})
        .map(([region, sc]) => [region, sc.playable_payload ?? sc]);
}

function snapshotHasLocation(snapshot, name) {
    const checked = snapshot?.checkedLocations ?? [];
    const list = Array.isArray(checked) ? checked : Object.keys(checked);
    return list.includes(name);
}

/**
 * Play one zone under the game's own automation (normal ticking) until the
 * host takes the exit into `to`. Mirrors jtaBalanceTests' walkOneZone —
 * see the test facts in the file header for why every branch exists.
 * Returns true when `to` was reached.
 */
async function walkOneZone(testController, controller, { from, to, exitName }, timeoutMs = 120000) {
    controller.walkTo({ kind: 'exit', name: exitName });
    testController.log(`walkTo ${exitName} — automation playing ${from}…`);

    let lastResets = readLoopResetCount();
    const deadline = Date.now() + timeoutMs;
    let lastContinueAt = 0;
    while (Date.now() < deadline) {
        const w = getJtaIframe()?.contentWindow;
        if (typeof w?.stepTick === 'function' && w.isGameLoopPaused?.() === false) {
            for (let i = 0; i < 200; i++) w.stepTick();
        }
        const st = w?.getFullState?.();
        if (st?.isInEnergyReset && Date.now() - lastContinueAt > 500) {
            lastContinueAt = Date.now();
            controller.reset();
        }
        await new Promise((r) => setTimeout(r, 25));
        if (readCurrentRegion() === to) return true;

        const resets = readLoopResetCount();
        if (resets === lastResets) continue;
        lastResets = resets;
        if (readCurrentRegion() === to) return true;
        // Teleported off the jta region by the reset — walk back and re-dispatch.
        if (readCurrentRegion() !== from) moveToRegion(from, readCurrentRegion());
        const active = await eventually(testController,
            () => getJtaIframe()?.contentWindow?.isGameLoopPaused?.() === false,
            'jta region active again after loop reset', 10000);
        if (!active) continue;
        controller.walkTo({ kind: 'exit', name: exitName });
    }
    return false;
}

async function datasetWorldProgression(testController) {
    const rulesDoc = await (await fetch(JTA_DATASETTEST_PRESET_PATH)).json();
    const payloads = sidecarPayloads(rulesDoc);

    // Leg 0 — the preset really carries the dataset (single-carrier + refs)
    // and the balance module correctly skips it (Pass-B datasets are 5e).
    const carriers = payloads.filter(([, p]) => p.jta_dataset);
    testController.assertEqual('exactly one sidecar carries the full jta_dataset', 1, carriers.length);
    testController.assertEqual('every jta sidecar carries jta_dataset_ref',
        payloads.length, payloads.filter(([, p]) => p.jta_dataset_ref).length);
    if (carriers.length !== 1) return testController.getOverallResult();
    const dataset = carriers[0][1].jta_dataset;
    testController.log(`dataset '${dataset.dataset_id}' (${dataset.zones.length} zones, "${dataset.theme?.title}")`);
    testController.assertEqual('jtaBalance skips dataset worlds (5e)', false, detectJtaWorld(rulesDoc).isJta);

    // Geometry + the dataset's zone-0 perk, derived from the doc, never
    // hardcoded — the preset regenerates deterministically but names are
    // the generator's business.
    const zoneOf = new Map(payloads.map(([r, p]) => [p.jtaZone, r]));
    const region0 = zoneOf.get(0);
    const region1 = zoneOf.get(1);
    const perkTask = dataset.zones[0].tasks.find((t) => t.perk != null);
    const perkItemName = dataset.perks[perkTask.perk].name;
    const perkLocation = `${region0}__${perkTask.id}`;
    const exitName = (payloads.find(([r]) => r === region0)[1].exits ?? [])
        .find((e) => e.targetRegion === region1)?.exitName;
    testController.assertEqual('zone 0 region has an exit toward zone 1', true, !!exitName);
    if (!exitName) return testController.getOverallResult();
    testController.log(`zone-0 perk task ${perkTask.id} "${perkTask.name}" holds '${perkItemName}' at ${perkLocation}`);

    // Leg 1 — load and enter with a fresh game.
    await testController.loadRulesFromFile(JTA_DATASETTEST_PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
    moveToRegion(region0, START_REGION);
    if (!await waitForJtaActive(testController)) {
        testController.reportCondition('jta bridge active', false);
        return testController.getOverallResult();
    }
    const gameWin = await resetJtaSaveAndReload(testController);
    testController.reportCondition('fresh jta game active after save reset', !!gameWin);
    if (!gameWin) return testController.getOverallResult();

    // Leg 2 — the fork is actually running the DATASET's tables: every real
    // (non-synthetic) available task is a dataset zone-0 task by name.
    const zone0Names = new Set(dataset.zones[0].tasks.map((t) => t.name));
    const datasetLive = await eventually(testController, () => {
        const tasks = (gameWin.getAvailableTasks?.() ?? []).filter((t) => t.id < 10000);
        return tasks.length > 0 && tasks.every((t) => zone0Names.has(t.name));
    }, 'available tasks are the dataset zone-0 tasks', 15000, 250);
    testController.assertEqual('loadGameData applied — the game serves dataset tasks', true, datasetLive);
    testController.assertEqual('fresh game holds no perks', 0, gameWin.getFullState().perks.length);

    // Leg 3 — the themed world PLAYS: automation walks zone 0 -> zone 1.
    const controller = substrateRegistry.get('jta')?.getPlaybackController?.();
    testController.assertEqual('registry exposes a live PlaybackController', true, !!controller);
    if (!controller) return testController.getOverallResult();
    const arrived = await walkOneZone(testController, controller,
        { from: region0, to: region1, exitName });
    testController.assertEqual('progressed into zone 1 under automation', true, arrived);
    if (!arrived) return testController.getOverallResult();

    // Leg 4 — the perk-task completion landed as an AP location check
    // (durable), the dataset's perk item came back, and it was granted
    // in-game. Poll: an item received on the walk's last tick reaches the
    // snapshot before its grant does.
    const checked = await eventually(testController,
        () => snapshotHasLocation(testController.stateManager.getSnapshot(), perkLocation),
        `perk location ${perkLocation} checked`, 30000, 500);
    testController.assertEqual('dataset perk-task completion checked its AP location', true, checked);
    const gotItem = await eventually(testController,
        () => Number(testController.stateManager.getSnapshot()?.inventory?.[perkItemName] ?? 0) > 0,
        `received AP item '${perkItemName}'`, 12000, 300);
    testController.assertEqual('dataset perk item received from AP', true, gotItem);
    const granted = await eventually(testController,
        () => (getJtaIframe()?.contentWindow?.getFullState?.().perks ?? []).includes(perkTask.perk),
        'dataset perk granted in-game', 12000, 300);
    testController.assertEqual('received item granted the dataset perk in-game', true, granted);

    // AP-authoritative under the DATASET's suppression sentinel: every perk
    // held arrived as a received AP item (a leaked local grant would make
    // perks exceed items).
    const datasetPerkNames = dataset.zones
        .flatMap((z) => z.tasks.filter((t) => t.perk != null).map((t) => dataset.perks[t.perk].name));
    const converged = await eventually(testController, () => {
        const inv = testController.stateManager.getSnapshot()?.inventory ?? {};
        const received = datasetPerkNames.filter((n) => Number(inv[n] ?? 0) > 0).length;
        const held = getJtaIframe()?.contentWindow?.getFullState?.().perks?.length ?? -1;
        return held === received;
    }, 'perks held == dataset perk items received', 20000, 250);
    testController.assertEqual('perks held == perk items received (grants AP-authoritative)', true, converged);

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-dataset-world-progression',
    name: 'JtA dataset: a synthetic-dataset world loads through the bridge and plays',
    description: 'Loads the jta_dataset_test preset (generated synthetic dataset embedded as '
               + 'single-carrier + refs), asserts the warehouse/bridge chain applies it via '
               + "loadGameData (the fork serves the dataset's themed tasks), walks zone 0->1 "
               + "under the game's own automation (normal ticking), and asserts the dataset "
               + "perk's location check, AP item receipt, and in-game grant — AP-authoritative "
               + "under the dataset's own suppression sentinel.",
    testFunction: datasetWorldProgression,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});
