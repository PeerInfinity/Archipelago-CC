/**
 * In-app tests for the Playback Bot on a `mystery` region (the substrate's `getPlaybackController`
 * and `loopSupport`, `modules/mysteryArchipelago/`).
 *
 * Both rows load the committed `mystery_street_test` world (the long case's office beside a maze
 * street) and let the bot play it to the end from the world's own sphere log; the second adds a
 * `loop_costs` block to the same document, so it is the same world in loop mode. The rows set
 * what they need and put it back. The bot drives the page: its walk opens the Mystery Game panel,
 * and each question in the log is asked of the page's careful reader.
 */

import { registerTest } from '../testRegistry.js';
import { startAppBotTestSpeed } from '../botTestSpeed.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { generateLoopCosts } from '../../shared/procgen/loopCostGenerator.js';
import settingsManager from '../../../app/core/settingsManager.js';
import panelManager from '../../../app/core/panelManager.js';
import { DEFAULT_PAGE_URL, PAGE_URL_SETTING } from '../../mysteryArchipelago/mysteryPage.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../../procgenPipeline/procgenPipelineEngine.js';
import { mysteryPlacedConfigFromSource, substrateRegistryEntry as mysteryEntry } from '../../mysteryArchipelago/mysterySubstrateLibrary.js';

const CATEGORY = 'Playback Bot';
const STREET_PRESET_PATH = './presets/mystery_street_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const SUBSTRATE = 'mystery';
const api = (mod, fn) => centralRegistry.getPublicFunction(mod, fn);
const STAND_IN_PAGE = './modules/mysteryArchipelago/testPage/index.html';
const panelIsOpen = () => !!document.querySelector('.mystery-panel-container');

/**
 * Run `body` with the module's page address set to `pageUrl` for the session, and put back what was there: the
 * address, and the Mystery Game panel closed again if the run (the bot's own walk) opened it.
 */
async function withMysteryPage(testController, pageUrl, body) {
    const panelWasOpen = panelIsOpen();
    // The page keeps a save of its own for each game (`bridgeStore` in the game's ui/world-case.js: a
    // localStorage key holding `-world-ap-`), on this app's origin. Offline the game is `offline:<seed>:<player>`,
    // the same for every row on the same world, so a row would start on the timeline the row before it solved,
    // and the page sends those questions back as solved (its "start a fresh timeline?" confirm is dismissed
    // under Playwright). Each row starts with none, and the saves that were there are put back after.
    const savesBefore = takePageSaves();
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    await settingsManager.updateSetting(PAGE_URL_SETTING, pageUrl, { persist: false });
    // What the host asked of the page and what the page said, read off the bus (the same for either page).
    const seen = { asks: [], statuses: [], order: [] };
    const handlers = {
        'mystery:autoSolve': (d) => { seen.asks.push(d); seen.order.push(['ask', d.question ?? null, d.stop ? 'stop' : '']); },
        'mystery:autoSolveStatus': (d) => { seen.statuses.push(d); seen.order.push(['status', d.question ?? null, d.state]); },
        'mystery:state': (d) => seen.order.push(['state', d.inOffice ?? null, d.lock ?? null]),
        'mystery:requestState': () => seen.order.push(['requestState']),
    };
    for (const [event, handler] of Object.entries(handlers)) testController.eventBus.subscribe(event, handler);
    try {
        return await body(seen);
    } finally {
        for (const [event, handler] of Object.entries(handlers)) testController.eventBus.unsubscribe?.(event, handler);
        await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
        if (!panelWasOpen && panelIsOpen()) await panelManager.destroyPanelByComponentType('mysteryPanel');
        takePageSaves();
        for (const [k, v] of savesBefore) localStorage.setItem(k, v);
    }
}

/** Remove the mystery page's per-game saves from localStorage, and return what they held. */
function takePageSaves() {
    const taken = [];
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.includes('-world-ap-')) { taken.push([k, localStorage.getItem(k)]); localStorage.removeItem(k); }
        }
    } catch { /* no storage: nothing saved */ }
    return taken;
}

/** What the page was asked: every question in the log, each once, all in one burst or none; and it said done to each. */
function reportAsked(testController, seen, sphereLocations, rulesJson, { instant }) {
    testController.reportCondition('the bot\'s walk opened the Mystery Game panel', panelIsOpen());
    const sidecar = Object.values(rulesJson.preset_sidecars['1']).find((sc) => sc?.substrate === SUBSTRATE);
    const wanted = Object.entries(sidecar.playable_payload.ap_locations).filter(([, name]) => sphereLocations.includes(name)).map(([q]) => q).sort();
    const asked = seen.asks.filter((a) => !a.stop);
    testController.assertEqual('the page was asked for each question in the log, once', JSON.stringify(wanted), JSON.stringify(asked.map((a) => a.question).sort()));
    testController.reportCondition(`every request ${instant ? 'asked for one burst' : 'left the pace to the page'}`,
        asked.length > 0 && asked.every((a) => (a.instant === true) === instant));
    const done = seen.statuses.filter((st) => st.state === 'done').map((st) => st.question).sort();
    testController.assertEqual('the page said done to each', JSON.stringify(wanted), JSON.stringify(done));
    const bad = seen.statuses.filter((st) => ['failed', 'stopped', 'waiting'].includes(st.state));
    testController.reportCondition(`the page never failed, stopped or waited (${JSON.stringify(bad.slice(0, 2))})`, bad.length === 0);
    if (bad.length > 0 || JSON.stringify(wanted) !== JSON.stringify(done)) {
        // Only on a failure: what was asked and what the page said, in order, to attribute it without a rerun.
        testController.log(`asks ${JSON.stringify(seen.asks.map((x) => [x.question, x.instant ?? false, x.stop ?? false]))}`);
        testController.log(`statuses ${JSON.stringify(seen.statuses.map((x) => [x.question, x.state, x.failed ?? x.waiting ?? null]))}`);
        testController.log(`order ${JSON.stringify(seen.order.slice(0, 40))}`);
    }
}

async function botOf(testController) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const panel = await testController.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
    const bot = panel?.getBot?.();
    testController.reportCondition('bot reachable', !!bot);
    bot?.reset?.();
    return bot ?? null;
}

/** Load `rulesJson` as the world, and its embedded sphere log; returns the log's location names. */
async function loadWorld(testController, rulesJson, sourceName) {
    const loaded = testController.waitForEvent('stateManager:rulesLoaded', 15000);
    testController.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName });
    await loaded;
    await testController.stateManager.pingWorker('after-rules-load', 15000);
    const sphereState = getSphereStateSingleton();
    await sphereState.loadSphereLog(`embedded:${sourceName}`, (rulesJson.sphere_log ?? []).map((e) => JSON.stringify(e)).join('\n'));
    return (sphereState.getSphereData() ?? []).flatMap((e) => e?.locations ?? []);
}

function reportEnd(testController, bot, finished, sphereLocations, questions) {
    testController.reportCondition(`bot finished (status: "${bot.getStatus()}")`, finished);
    const checked = new Set(testController.stateManager.getLatestStateSnapshot()?.checkedLocations ?? []);
    const missing = sphereLocations.filter((n) => !checked.has(n));
    testController.reportCondition(
        `every sphere-log location checked (missing: ${missing.slice(0, 5).join(', ') || 'none'})`, missing.length === 0);
    // The bot walks the sphere log, which lists the locations the solution needs, not every question.
    const logged = questions.filter((n) => sphereLocations.includes(n));
    const answered = logged.filter((n) => checked.has(n)).length;
    testController.reportCondition(
        `the case's questions in the log were answered (${answered} of ${logged.length}; the case has ${questions.length})`,
        logged.length > 0 && answered === logged.length);
    if (!finished || missing.length) {
        testController.log(`Bot log (tail): ${JSON.stringify((bot.getLog?.() ?? []).map((e) => e.text ?? e).slice(-30))}`);
    }
}

/** The questions of the world's one mystery region, as AP location names, off the document. */
function questionsOf(rulesJson) {
    const sidecars = Object.values(rulesJson.preset_sidecars?.['1'] ?? {}).filter((s) => s?.substrate === SUBSTRATE);
    return sidecars.flatMap((s) => Object.values(s.playable_payload?.ap_locations ?? {}));
}

export const mysteryPlaybackBotPlaysTheCase = (testController) => withMysteryPage(testController, DEFAULT_PAGE_URL, (seen) => playsTheCase(testController, seen));
async function playsTheCase(testController, seen) {
    const bot = await botOf(testController);
    if (!bot) return testController.getOverallResult();
    const rulesJson = await (await fetch(STREET_PRESET_PATH)).json();
    const questions = questionsOf(rulesJson);
    const sphereLocations = await loadWorld(testController, rulesJson, 'mysteryPlaybackBot');
    testController.reportCondition(`sphere log has locations (${sphereLocations.length})`, sphereLocations.length > 0);
    testController.reportCondition('loop mode is off', api('loops', 'isLoopModeActive')?.() !== true);
    bot.refresh();
    try {
        await bot.instant();
        const finished = await testController.pollForCondition(
            () => (bot.getStatus() || '').startsWith('finished'), 'bot reaches finished status', 180000, 250);
        reportEnd(testController, bot, finished, sphereLocations, questions);
        reportAsked(testController, seen, sphereLocations, rulesJson, { instant: true });
    } finally {
        bot.stop();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-playback-bot-plays-the-case',
    name: 'Playback Bot: a mystery case as a region, played to the end',
    description: 'Loads the committed mystery_street_test world and lets the Playback Bot play it from its sphere log: the '
        + 'street by the maze, the office by the mystery substrate\'s controller, which asks the page\'s careful '
        + 'reader for each question in one burst. Every sphere-log location ends checked.',
    testFunction: mysteryPlaybackBotPlaysTheCase,
    category: CATEGORY,
});

export const mysteryPlaybackBotLoopMode = (testController) => withMysteryPage(testController, DEFAULT_PAGE_URL, (seen) => loopMode(testController, seen));
async function loopMode(testController, seen) {
    const loopModeOn = () => api('loops', 'isLoopModeActive')?.() === true;
    const bot = await botOf(testController);
    if (!bot) return testController.getOverallResult();
    const rulesJson = await (await fetch(STREET_PRESET_PATH)).json();
    const questions = questionsOf(rulesJson);
    // The same world in loop mode, as the pipeline's loop-mode build writes it (`buildRulesJson` with
    // `enableLoopMode`): `manaEnabled` on every region's payload, and the `loop_costs` block.
    for (const sidecar of Object.values(rulesJson.preset_sidecars['1'])) sidecar.playable_payload.manaEnabled = true;
    const block = generateLoopCosts({ rulesJson, sphereLog: rulesJson.sphere_log, playerId: '1', sourceFileName: 'mysteryPlaybackBotLoop' });
    delete block.generatedAt;
    rulesJson.loop_costs = { 1: block };
    const sphereLocations = await loadWorld(testController, rulesJson, 'mysteryPlaybackBotLoop');
    testController.reportCondition(`sphere log has locations (${sphereLocations.length})`, sphereLocations.length > 0);
    const on = await testController.pollForCondition(loopModeOn, 'loop mode on (auto-enabled by loop_costs)', 8000, 100);
    testController.reportCondition('loop mode on (auto-enabled by loop_costs)', on);
    const loopState = api('loops', 'getLoopState')?.();
    if (!on || !loopState) return testController.getOverallResult();
    const office = Object.entries(rulesJson.preset_sidecars['1']).find(([, s]) => s?.substrate === SUBSTRATE)?.[0];
    testController.assertEqual('the office is a coarse region', 'coarse', loopState.getRegionCaptureShape?.(office));
    testController.assertEqual('the office\'s Bot is the walkTo solver', 'walkTo', loopState.regionSolver?.(office));
    bot.refresh();
    const instantBefore = !!loopState.instantMode;
    loopState.setInstantMode(true);
    const restoreSpeed = await startAppBotTestSpeed();
    try {
        await bot.play();
        const finished = await testController.pollForCondition(
            () => (bot.getStatus() || '').startsWith('finished'), 'bot finishes the world in loop mode', 240000, 500);
        reportEnd(testController, bot, finished, sphereLocations, questions);
        // A Bot block's act is the controller's `perform`: one burst.
        reportAsked(testController, seen, sphereLocations, rulesJson, { instant: true });
        testController.log(`loops run: ${bot.getLoopRunner?.()?.getLoopCount?.() ?? '?'}`);
    } finally {
        bot.stop();
        await restoreSpeed();
        loopState.setInstantMode(instantBefore);
        testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-playback-bot-loop-mode',
    name: 'Playback Bot: a mystery case as a region, in loop mode',
    description: 'The mystery_street_test world with a loop_costs block: loop mode comes on, the office is a coarse region '
        + 'whose Bot is the walkTo solver, and the Playback Bot plays the world to the end through the Loops queue.',
    testFunction: mysteryPlaybackBotLoopMode,
    category: CATEGORY,
});

const CASE_PRESET_PATH = './presets/mystery_custom_house_fire/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/**
 * The office placed WHOLE by the shuffled spiral (the entry's content-source half): a world of maze
 * rooms and one office, built here from the committed case world, then played to the end by the bot.
 * The case's papers stand on its own questions, so the office needs nothing from the maze rooms.
 */
export const mysterySpiralOfficePlayed = (testController) => withMysteryPage(testController, STAND_IN_PAGE, (seen) => spiralOfficePlayed(testController, seen));
async function spiralOfficePlayed(testController, seen) {
    const bot = await botOf(testController);
    if (!bot) return testController.getOverallResult();
    const source = await (await fetch(CASE_PRESET_PATH)).json();
    const cfg = mysteryPlacedConfigFromSource(source, '1');
    testController.reportCondition('the committed case world gives a filled case', !!cfg.caseWorld);
    if (!cfg.caseWorld) return testController.getOverallResult();
    try {
        // The stepped driver's first step installs a quota substrate's config; this is the monolithic call.
        mysteryEntry.applyPipelineConfig(cfg);
        const seed = 5;
        const { grid, startCell, stats } = arrangeShuffledSpiral({
            regionSize: { width: 7, height: 7 },
            itemPool: { victory: 1, key_red: 1, key_green: 1 },
            obstaclePool: {},
            seed,
            regionParams: {},
            growthParams: { substrateQuotas: { maze: 3, mystery: 1 }, maxItemsPerRegion: 2, startSubstrate: 'maze', substrateConfig: { mystery: cfg } },
            hazardOpts: {},
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed, completionConditionItem: 'Victory',
            procgenMetadata: { driver: 'mystery-spiral-office-played', stop_reason: stats.stopReason },
        });
        const questions = questionsOf(rulesJson);
        testController.assertEqual('the office holds every question of the case', Object.keys(cfg.caseDoc.locations).length, questions.length);
        const sphereLocations = await loadWorld(testController, rulesJson, 'mysterySpiralOffice');
        const every = Object.values(rulesJson.regions['1']).flatMap((r) => (r.locations ?? []).map((l) => l.name));
        testController.reportCondition(`the sphere log reaches every location (${sphereLocations.length} of ${every.length})`,
            every.length > 0 && every.every((n) => sphereLocations.includes(n)));
        bot.refresh();
        await bot.instant();
        const finished = await testController.pollForCondition(
            () => (bot.getStatus() || '').startsWith('finished'), 'bot reaches finished status', 90000, 250);
        reportEnd(testController, bot, finished, sphereLocations, questions);
        reportAsked(testController, seen, sphereLocations, rulesJson, { instant: true });
    } finally {
        bot.stop();
        mysteryEntry.applyPipelineConfig({});
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-spiral-office-played',
    name: 'Playback Bot: a spiral world with the office placed whole',
    description: 'Builds a shuffled-spiral world of three maze rooms and one mystery office from the committed case world '
        + '(the case\'s papers on its own questions), and lets the Playback Bot play it to the end.',
    testFunction: mysterySpiralOfficePlayed,
    category: CATEGORY,
});
