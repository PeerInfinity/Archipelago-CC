/**
 * Cross-game P2 slice 4 — per-rep award schedules end-to-end (Fork 1.13).
 *
 * Loads the jta_schedule_test preset: the same 3-zone synthetic dataset as
 * jta_dataset_test plus a deterministic hand-authored item_schedule on
 * zone 0's first item-awarding task (rep 0 = the original item, rep 1 = a
 * FOREIGN award omsi/gold x2, later reps original). Asserts, against the
 * real iframes and the real resourceChannels bus:
 *
 *   1. The preset's dataset carries the schedule (derived from the doc, no
 *      hardcoded names — the preset regenerates deterministically).
 *   2. Completing rep 0 deposits the ORIGINAL item locally and delivers
 *      nothing cross-substrate.
 *   3. Completing rep 1 deposits NOTHING locally and lands gold x2 in the
 *      omsi resources bag (bridge foreign-award callback ->
 *      substrate:itemGrant -> router grantItem -> crossSubstrate:itemGranted
 *      -> omsi bridge addResource) — eager delivery, D8/S8.
 *
 * The reps are driven with the fork's own performTask under the region's
 * normal ticking (the game loop runs while the jta region is active).
 */
import { registerTest } from '../testRegistry.js';
import {
    waitForJtaActive,
    resetJtaSaveAndReload,
    moveToRegion,
    getJtaIframe,
    eventually,
} from '../../jtaSubstrateWrapper/test-helpers.js';
import { omsiEval } from '../../omsiSubstrateWrapper/test-helpers.js';

const PRESET_PATH =
    './presets/jta_schedule_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const START_REGION = 'Menu';

function sidecarPayloads(rulesDoc) {
    const playerId = Object.keys(rulesDoc.preset_sidecars ?? {})[0];
    return Object.entries(rulesDoc.preset_sidecars?.[playerId] ?? {})
        .map(([region, sc]) => [region, sc.playable_payload ?? sc]);
}

function itemCount(win, itemEnum) {
    const entry = (win.getFullState?.().items ?? []).find((it) => it.type === itemEnum);
    return entry?.count ?? 0;
}

async function foreignAwardSchedule(testController) {
    const rulesDoc = await (await fetch(PRESET_PATH)).json();
    const payloads = sidecarPayloads(rulesDoc);

    // Leg 1 — the document really carries the schedule (static shape).
    const dataset = payloads.map(([, p]) => p.jta_dataset).find(Boolean);
    testController.assertEqual('preset carries the jta dataset', true, !!dataset);
    if (!dataset) return testController.getOverallResult();
    const task = dataset.zones[0].tasks.find((t) => t.item_schedule);
    testController.assertEqual('a zone-0 task carries item_schedule', true, !!task);
    if (!task) return testController.getOverallResult();
    testController.assertEqual('schedule has exactly max_reps entries',
        task.max_reps, task.item_schedule.length);
    const foreign = task.item_schedule[1];
    testController.assertEqual('rep 1 is the foreign omsi/gold x2 entry',
        JSON.stringify({ substrate: 'omsi', type: 'gold', count: 2 }), JSON.stringify(foreign));
    testController.assertEqual('rep 0 keeps the original item', task.item, task.item_schedule[0]);
    const originalName = dataset.items[task.item]?.name;
    testController.log(`scheduled task ${task.id} "${task.name}" awards '${originalName}' (rep 0), omsi/gold x2 (rep 1)`);

    // Leg 2 — load the world, enter zone 0 with a fresh game.
    const zoneOf = new Map(payloads.map(([r, p]) => [p.jtaZone, r]));
    const region0 = zoneOf.get(0);
    await testController.loadRulesFromFile(PRESET_PATH);
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

    // The dataset's tables are live; resolve the original item's enum by
    // name through the fork's own catalog. (Enum 0 is a legitimate value —
    // the condition must test presence, not truthiness of the type.)
    const catalogReady = await eventually(testController,
        () => (gameWin.getAllItems?.() ?? []).some((it) => it.name === originalName),
        `fork catalog serves '${originalName}'`, 15000, 250);
    testController.assertEqual('original item resolves in the live catalog', true, catalogReady);
    if (!catalogReady) return testController.getOverallResult();
    const itemEnum = gameWin.getAllItems().find((it) => it.name === originalName).type;

    const localBefore = itemCount(gameWin, itemEnum);
    const omsiGoldBefore = omsiEval('resources.gold');
    testController.log(`before: local '${originalName}' x${localBefore}, omsi gold ${omsiGoldBefore}`);

    // Leg 3 — rep 0: the original item lands locally, nothing crosses.
    const started0 = gameWin.performTask(task.id);
    testController.assertEqual('rep 0 starts', true, started0?.success === true);
    const rep0 = await eventually(testController,
        () => itemCount(gameWin, itemEnum) === localBefore + 1,
        `rep 0 deposited '${originalName}' locally`, 30000, 100);
    testController.assertEqual('rep 0 awarded the original item locally', true, rep0);
    testController.assertEqual('rep 0 sent nothing to omsi',
        omsiGoldBefore, omsiEval('resources.gold'));

    // Leg 4 — rep 1: nothing lands locally, omsi receives gold x2 over the
    // full bus (bridge -> router -> omsi arrival handler).
    const started1 = gameWin.performTask(task.id);
    testController.assertEqual('rep 1 starts', true, started1?.success === true);
    const arrived = await eventually(testController,
        () => omsiEval('resources.gold') === omsiGoldBefore + 2,
        'omsi bag gained gold x2 from the foreign award', 30000, 100);
    testController.assertEqual('foreign rep delivered omsi/gold x2 cross-substrate', true, arrived);
    testController.assertEqual('foreign rep deposited nothing locally',
        localBefore + 1, itemCount(gameWin, itemEnum));

    return testController.getOverallResult();
}

registerTest({
    id: 'jta-cross-substrate-foreign-award',
    name: 'JtA: a scheduled foreign award crosses to the omsi bag',
    description: 'Loads jta_schedule_test (dataset with a hand-authored per-rep '
               + 'item_schedule: rep 1 = omsi/gold x2), drives reps 0-1 with the '
               + "fork's performTask under normal region ticking, and asserts rep 0 "
               + 'deposits the original item locally while rep 1 deposits nothing '
               + 'locally and lands gold x2 in the omsi resources bag via the full '
               + 'grant bus (Fork 1.13 foreign-award callback -> substrate:itemGrant '
               + '-> router -> crossSubstrate:itemGranted -> omsi bridge).',
    testFunction: foreignAwardSchedule,
    category: 'JtA substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});
