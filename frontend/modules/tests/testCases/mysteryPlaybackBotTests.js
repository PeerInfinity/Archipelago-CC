/**
 * In-app tests for the Playback Bot on a `mystery` region (the substrate's `getPlaybackController`
 * and `loopSupport`, `modules/mysteryArchipelago/`).
 *
 * Both rows load the committed `mystery_street_test` world (the long case's office beside a maze
 * street) and let the bot play it to the end from the world's own sphere log; the second adds a
 * `loop_costs` block to the same document, so it is the same world in loop mode. The rows set
 * what they need and put it back. No Mystery Game panel is opened: the bot answers through the
 * host, not through the page.
 */

import { registerTest } from '../testRegistry.js';
import { startAppBotTestSpeed } from '../botTestSpeed.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { generateLoopCosts } from '../../shared/procgen/loopCostGenerator.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../../procgenPipeline/procgenPipelineEngine.js';
import { mysteryPlacedConfigFromSource, substrateRegistryEntry as mysteryEntry } from '../../mysteryArchipelago/mysterySubstrateLibrary.js';

const CATEGORY = 'Playback Bot';
const STREET_PRESET_PATH = './presets/mystery_street_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const SUBSTRATE = 'mystery';
const api = (mod, fn) => centralRegistry.getPublicFunction(mod, fn);

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

export async function mysteryPlaybackBotPlaysTheCase(testController) {
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
            () => (bot.getStatus() || '').startsWith('finished'), 'bot reaches finished status', 60000, 250);
        reportEnd(testController, bot, finished, sphereLocations, questions);
    } finally {
        bot.stop();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-playback-bot-plays-the-case',
    name: 'Playback Bot: a mystery case as a region, played to the end',
    description: 'Loads the committed mystery_street_test world and lets the Playback Bot play it from its sphere log: the '
        + 'street by the maze, the office by the mystery substrate\'s controller, which checks each question through '
        + 'the host. Every sphere-log location ends checked.',
    testFunction: mysteryPlaybackBotPlaysTheCase,
    category: CATEGORY,
});

export async function mysteryPlaybackBotLoopMode(testController) {
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
            () => (bot.getStatus() || '').startsWith('finished'), 'bot finishes the world in loop mode', 120000, 500);
        reportEnd(testController, bot, finished, sphereLocations, questions);
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
export async function mysterySpiralOfficePlayed(testController) {
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
