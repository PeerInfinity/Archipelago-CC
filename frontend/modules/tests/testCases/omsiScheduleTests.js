/**
 * Cross-game P2-omsi slice 2 — the award carrier end-to-end (fork
 * xml-migration P2 slices 1-2).
 *
 * Loads the omsi_schedule_test preset: the same world as
 * omsi_substrate_test plus a hand-authored award schedule riding the omsi
 * region's payload (Buy Mana Z1's mana grants: grant 1 = FOREIGN jta/Food
 * x2, grant 2 = local re-route herbs x3, later grants vanilla). Asserts,
 * against the real iframes and the real resourceChannels bus:
 *
 *   1. The preset payload carries the schedule (static shape).
 *   2. Entering the omsi region installs it (bridge omsi:loadRegion ->
 *      IdleLoopsManaged.setAwardSchedule), which turns the compiled
 *      reward path on.
 *   3. Grant 1 deposits NOTHING locally and lands Food x2 in the jta
 *      inventory over the full bus (fork foreign-award hook -> bridge
 *      substrate:itemGrant -> router grantItem ->
 *      crossSubstrate:itemGranted -> jta bridge grantItem) — eager
 *      delivery, D8/S8; the jta iframe is mounted-but-inactive (S1).
 *   4. Grant 2 re-routes locally (herbs x3, no mana).
 *   5. A loop restart rewinds the grant index (grant 1 semantics again)
 *      and wipes the herbs (D4 native clearing).
 *
 * The inbound direction (foreign grants INTO omsi) is covered by the P1
 * test omsi-cross-substrate-item-grant.
 */
import { registerTest } from '../testRegistry.js';
import {
    waitForOmsiActive,
    moveToRegion,
    omsiEval,
    eventually,
    OMSI_TEST_REGION,
    OMSI_TEST_START_REGION,
} from '../../omsiSubstrateWrapper/test-helpers.js';
import { getJtaIframe } from '../../jtaSubstrateWrapper/test-helpers.js';

const PRESET_PATH =
    './presets/omsi_schedule_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';

function jtaItemCount(itemEnum) {
    const win = getJtaIframe()?.contentWindow;
    const entry = (win?.getFullState?.().items ?? []).find((it) => it.type === itemEnum);
    return entry?.count ?? 0;
}

async function omsiAwardSchedule(testController) {
    // Leg 1 — the preset payload really carries the schedule.
    const rulesDoc = await (await fetch(PRESET_PATH)).json();
    const playerId = Object.keys(rulesDoc.preset_sidecars ?? {})[0];
    const omsiEntry = Object.entries(rulesDoc.preset_sidecars?.[playerId] ?? {})
        .find(([, sc]) => sc.substrate === 'omsi');
    const schedule = omsiEntry?.[1]?.playable_payload?.awardSchedule;
    testController.assertEqual('preset carries the award schedule', true, !!schedule);
    if (!schedule) return testController.getOverallResult();
    const entries = schedule.awards?.BuyManaZ1?.mana ?? [];
    testController.assertEqual('grant 1 is the foreign jta/Food x2 entry',
        JSON.stringify({ substrate: 'jta', type: 'Food', count: 2 }), JSON.stringify(entries[0]));
    testController.assertEqual('grant 2 is the local herbs x3 re-route',
        JSON.stringify({ name: 'herbs', count: 3 }), JSON.stringify(entries[1]));

    // Leg 2 — load the world and enter the omsi region.
    await testController.loadRulesFromFile(PRESET_PATH);
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    moveToRegion(OMSI_TEST_REGION, OMSI_TEST_START_REGION);
    const win = await waitForOmsiActive(testController);
    testController.reportCondition('omsi bridge active in the omsi region', !!win);
    if (!win) return testController.getOverallResult();

    const installed = await eventually(testController,
        () => omsiEval('typeof ActionListXml !== "undefined" && ActionListXml.getAwardSchedule() !== null'),
        'award schedule installed in the fork carrier', 10000, 200);
    testController.assertEqual('schedule installed on region entry', true, installed);
    if (!installed) return testController.getOverallResult();
    testController.assertEqual('compiled reward path is live (useActionListXml)',
        true, omsiEval('options.useActionListXml'));

    // An earlier suite test may have left the jta iframe on a SYNTHETIC
    // dataset world (renamed items — no 'Food' in its live catalog, and the
    // fork's grantItem would reject the name). This world has no jta
    // region, so a fresh boot serves the VANILLA catalog: clear the
    // substrate save slots and reload the iframe (resetJtaSaveAndReload's
    // key-clear, without its waitForJtaActive — with no jta region the
    // loop stays paused, which grants don't need).
    try {
        const ls = getJtaIframe()?.contentWindow?.localStorage;
        for (let i = (ls?.length ?? 0) - 1; i >= 0; i--) {
            const key = ls.key(i);
            if (key?.startsWith('incrementalGameSave_substrate')) ls.removeItem(key);
        }
    } catch { /* same-origin here; ignore */ }
    getJtaIframe()?.contentWindow?.location?.reload();

    // Resolve jta's Food enum through the live jta catalog (enum 0 is a
    // legitimate value — presence-test, never truthiness).
    const jtaReady = await eventually(testController,
        () => {
            const w = getJtaIframe()?.contentWindow;
            return (w?.getAllItems?.() ?? []).some((it) => it.name === 'Food');
        },
        "jta catalog serves 'Food' (vanilla boot)", 20000, 250);
    testController.assertEqual('jta iframe serves its item catalog', true, jtaReady);
    if (!jtaReady) return testController.getOverallResult();
    const foodEnum = getJtaIframe().contentWindow.getAllItems()
        .find((it) => it.name === 'Food').type;
    const foodBefore = jtaItemCount(foodEnum);

    // A loop restart pins the grant index to a known start (the world may
    // have restarted while the harness settled).
    omsiEval('IdleLoopsManaged.restartLoop()');

    // Leg 3 — grant 1: foreign. Nothing lands locally; Food x2 crosses.
    omsiEval('resources.gold = 10; Action.BuyManaZ1.finish()');
    const crossed = await eventually(testController,
        () => jtaItemCount(foodEnum) === foodBefore + 2,
        'jta inventory gained Food x2 from the foreign grant', 15000, 200);
    testController.assertEqual('foreign grant delivered jta/Food x2', true, crossed);
    testController.assertEqual('foreign grant deposited no local herbs',
        0, omsiEval('resources.herbs'));

    // Leg 4 — grant 2: local re-route (herbs x3, no second delivery).
    omsiEval('resources.gold = 10; Action.BuyManaZ1.finish()');
    const rerouted = await eventually(testController,
        () => omsiEval('resources.herbs') === 3,
        'grant 2 re-routed to herbs x3 locally', 8000, 200);
    testController.assertEqual('local re-route landed', true, rerouted);
    testController.assertEqual('local re-route sent nothing to jta',
        foodBefore + 2, jtaItemCount(foodEnum));

    // Leg 5 — restart: the index rewinds (foreign again) and D4 wipes herbs.
    omsiEval('IdleLoopsManaged.restartLoop()');
    testController.assertEqual('loop reset wiped the granted herbs (D4)',
        0, omsiEval('resources.herbs'));
    omsiEval('resources.gold = 10; Action.BuyManaZ1.finish()');
    const crossedAgain = await eventually(testController,
        () => jtaItemCount(foodEnum) === foodBefore + 4,
        'after restart the grant index rewound: foreign again', 15000, 200);
    testController.assertEqual('per-loop index semantics across restart', true, crossedAgain);

    return testController.getOverallResult();
}

registerTest({
    id: 'omsi-award-schedule',
    name: 'Omsi: the award carrier routes local, foreign and per-loop',
    description: 'Loads omsi_schedule_test (award schedule on the omsi region '
               + 'payload), enters the region, and asserts the fork carrier '
               + 'routes Buy Mana Z1 grant 1 to jta (Food x2 over the full '
               + 'grant bus), grant 2 to a local herbs re-route, and rewinds '
               + 'the grant index on loop restart with D4 wiping the grants.',
    testFunction: omsiAwardSchedule,
    category: 'Omsi substrate',
    enabled: false, // off by default — runs only in the test-substrates mode
});
