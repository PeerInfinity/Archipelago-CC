/**
 * In-app rows for the mystery page's bridge in an ActionNodes world (AN-MYST-1): the committed The Same Monday preset,
 * whose `slot_data.mystery` the ActionNodes compiler writes from the graph's mystery link.
 *
 * Every row SETS the state it expects and puts it back: it sets the Mystery Game page address (a session-only
 * setting), enables the module (its panel opens) and loads the preset, which the panel then frames; it closes the
 * panel it opened. They run with no server, so they read the HOST's side of the protocol (what the page is sent); the
 * real page waits for a connected state before it shows anything. Every name and id comes from the loaded world.
 *
 * - `an-mystery-bridge-papers-loop` frames the REAL page (this app's copy of the game): it asks with the world's
 *   version (the pin holds in the running app), and each state carries `loop` (the runtime's loop number) and the
 *   papers held (a visit's item, by `items`).
 * - `an-mystery-goal-pending` (⚑ PENDING, superseded by Robert's 2026-11-26 ruling: page questions are the locations,
 *   q.who the goal; the world-side goal is AN-MYST-2) frames the stand-in page and sends the goal question solved:
 *   nothing is checked and no state is sent back; the Playback Bot then plays the world, the goal NODE checks the
 *   goal, and `solved` still lacks the question.
 */

import { registerTest } from '../testRegistry.js';
import stateManagerProxySingleton from '../../stateManager/stateManagerProxySingleton.js';
import settingsManager from '../../../app/core/settingsManager.js';
import panelManager from '../../../app/core/panelManager.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { getActionNodesRuntime } from '../../actionNodes/actionNodesRuntime.js';
import { HISTORY_STORAGE_PREFIX } from '../../actionNodes/historyStore.js';
import { DEFAULT_PAGE_URL, PAGE_URL_SETTING } from '../../mysteryArchipelago/mysteryPage.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { startAppBotTestSpeed } from '../botTestSpeed.js';

const RULES = './presets/action_nodes_same_monday/AP_1/AP_1_rules.json';
const STAND_IN_PAGE = './modules/mysteryArchipelago/testPage/index.html';
const MODULE_ID = 'mysteryArchipelago';
const PANEL_COMPONENT = 'mysteryPanel';
const P = '1';
const TIMEOUT_MS = 15000;
const POLL_MS = 50;
const QUIET_MS = 400;

const gs = () => getGameStateSingleton();
const runtime = () => getActionNodesRuntime();
const last = (list) => list[list.length - 1];
const panelIsOpen = () => !!document.querySelector('.mystery-panel-container');
const checkedNow = () => new Set(stateManagerProxySingleton.getSnapshot()?.checkedLocations ?? []);
const stubOf = () => {
    for (const frame of document.querySelectorAll('.mystery-panel-container iframe')) {
        try {
            if (frame.contentWindow?.__mysteryStub) return frame.contentWindow.__mysteryStub;
        } catch { /* another origin: not ours */ }
    }
    return null;
};
const clearHistory = (graphId) => {
    try {
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith(HISTORY_STORAGE_PREFIX) && key.includes(graphId)) localStorage.removeItem(key);
        }
    } catch { /* no storage */ }
};

/** The loop state this row sets: Instant, no auto restart, an empty queue at the loop's start. Returns the restore. */
function freshQueue() {
    const ls = loopStateSingleton;
    const saved = { instant: ls.instantMode, autoRestart: ls.autoRestartQueue, noReset: gs().noManaDepletionReset };
    ls.clearQueue();
    ls.instantMode = true;
    ls.setAutoRestartQueue?.(false);
    gs().noManaDepletionReset = false;
    ls._resetLoop();
    return () => {
        ls.stopProcessing?.();
        ls.instantMode = saved.instant;
        ls.setAutoRestartQueue?.(saved.autoRestart);
        gs().noManaDepletionReset = saved.noReset;
        gs().clearPath();
        gs().setLoopModeActive(false);
    };
}

/**
 * Point the page address, enable the module, load the preset; resolve to `{rules, block, mystery, panel}` or null
 * (a failed condition is already reported). `seen` collects the bus's mystery events.
 */
async function openOnSameMonday(tc, pageUrl) {
    const rules = await (await fetch(RULES, { cache: 'no-store' })).json();
    const block = rules.action_nodes[P];
    clearHistory(block.graph_id);
    await settingsManager.updateSetting(PAGE_URL_SETTING, pageUrl, { persist: false });
    await window.moduleManagerApi.enableModule(MODULE_ID);
    const panel = await tc.pollForValue(() => document.querySelector('.mystery-panel-container')?.mysteryPanelUI ?? null,
        'the Mystery Game panel', TIMEOUT_MS, POLL_MS);
    tc.reportCondition('enabling the module opens the Mystery Game panel', !!panel);
    if (!panel) return null;
    await tc.loadRulesFromFile(RULES);
    await tc.stateManager.pingWorker('after-rules-load', TIMEOUT_MS);
    const loaded = await tc.pollForCondition(
        () => runtime().isLoaded() && runtime().model.block.graph_id === block.graph_id && gs()?.isLoopModeActive === true,
        `the runtime holds ${block.graph_id} and loop mode is on`, 8000, 100);
    tc.reportCondition(`the runtime holds ${block.graph_id} and loop mode is on`, !!loaded);
    const staticData = stateManagerProxySingleton.getStaticData();
    const mystery = staticData?.world?.[String(staticData?.playerId ?? P)]?.slot_data?.mystery;
    tc.reportCondition('the loaded ActionNodes world carries slot_data.mystery', typeof mystery?.story === 'string');
    if (!loaded || !mystery) return null;
    const framed = await tc.pollForCondition(() => String(panel.wantedUrl ?? '').includes(`case=${mystery.case}`),
        'the panel frames the world\'s case', TIMEOUT_MS, POLL_MS);
    tc.reportCondition(`the panel framed ${panel.wantedUrl}`, framed);
    return framed ? { rules, block, mystery, panel } : null;
}

async function closeUp(panelWasOpen, pageBefore, graphId) {
    await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
    if (!panelWasOpen) await panelManager.destroyPanelByComponentType(PANEL_COMPONENT);
    if (graphId) clearHistory(graphId);
}

function subscribeMystery(tc) {
    const seen = { requests: [], states: [], refusals: [], solved: [] };
    const handlers = {
        'mystery:questionSolved': (data) => seen.solved.push(data),
        'mystery:requestState': (data) => seen.requests.push(data),
        'mystery:state': (data) => seen.states.push(data),
        'mystery:refused': (data) => seen.refusals.push(data),
    };
    for (const [event, handler] of Object.entries(handlers)) tc.eventBus.subscribe(event, handler);
    seen.stop = () => { for (const [event, handler] of Object.entries(handlers)) tc.eventBus.unsubscribe?.(event, handler); };
    return seen;
}

// ─── 1. The framed real page gets papers and loop ───────────────────────────

async function papersAndLoop(tc) {
    const panelWasOpen = panelIsOpen();
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    const seen = subscribeMystery(tc);
    let graphId = null;
    let restore = () => {};
    try {
        const opened = await openOnSameMonday(tc, DEFAULT_PAGE_URL);
        if (!opened) return tc.getOverallResult();
        const { rules, block, mystery } = opened;
        graphId = block.graph_id;
        const asked = await tc.pollForCondition(() => seen.requests.length > 0 && seen.states.length > 0,
            'the game\'s page asked and a state went back', TIMEOUT_MS, POLL_MS);
        tc.reportCondition('the game\'s page asked for the state and was answered', asked);
        if (!asked) return tc.getOverallResult();
        tc.assertEqual('the page asked for the world\'s story', mystery.story, seen.requests[0].story);
        tc.assertEqual('the page\'s version of the case is the world\'s (the pin holds)', mystery.version, seen.requests[0].version);
        tc.assertEqual('nothing was refused', 0, seen.refusals.length);
        tc.assertEqual('the first state is loop 1', 1, last(seen.states).loop);
        tc.assertEqual('no paper is held at the start', '[]', JSON.stringify(last(seen.states).papers));

        // One visit from the start: its check brings the item placed there; when that item is a paper, the state holds it.
        restore = freshQueue();
        const payloads = Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
        const locations = Object.values(rules.regions[P]).flatMap((r) => r.locations);
        const itemAt = (locationName) => locations.find((l) => l.name === locationName)?.item?.name;
        const [visitId, visit] = Object.entries(payloads).find(([, p]) => p.kind === 'check'
            && !Object.keys(p.requires?.stats ?? {}).length && p.after.some((s) => s.includes(block.start))
            && mystery.items[itemAt(p.location)] !== undefined);
        const paper = mystery.items[itemAt(visit.location)];
        tc.reportCondition(`a visit one hop from the start holds a paper (${visit.name} → ${paper})`, !!paper);
        gs().updatePath(visitId, `${block.start} -> ${visitId}`, block.start);
        gs().addCustomAction('act', { nodeId: visitId, label: visit.name, regionName: visitId });
        loopStateSingleton.startProcessing();
        const ran = await tc.pollForCondition(() => !loopStateSingleton.isProcessing, 'the queue ran', TIMEOUT_MS, POLL_MS);
        tc.reportCondition('the queue ran to its end', !!ran);
        const held = await tc.pollForCondition(() => (last(seen.states)?.papers ?? []).includes(paper),
            `the state holds the paper ${paper}`, TIMEOUT_MS, POLL_MS);
        tc.reportCondition(`after ${visit.name} the page is sent the paper ${paper} (by slot_data.mystery.items)`, held);
        tc.assertEqual('still loop 1 after the visit', 1, last(seen.states).loop);

        // A loop reset after a loop with progress: the runtime numbers the next loop, and the state says so.
        loopStateSingleton._resetLoop();
        const day2 = await tc.pollForCondition(() => last(seen.states)?.loop === 2, 'the state says loop 2', TIMEOUT_MS, POLL_MS);
        tc.reportCondition(`after a loop reset the state carries loop 2 (runtime loopNumber ${runtime().loopNumber})`, day2);
        tc.reportCondition('the paper is still held on day 2', (last(seen.states)?.papers ?? []).includes(paper));
        tc.reportCondition(`every state carried an integer loop ≥ 1 (${seen.states.length} states)`,
            seen.states.every((s) => Number.isInteger(s.loop) && s.loop >= 1));
        tc.assertEqual('nothing was refused at the end', 0, seen.refusals.length);
    } finally {
        restore();
        seen.stop();
        await closeUp(panelWasOpen, pageBefore, graphId);
    }
    return tc.getOverallResult();
}

// ─── 2. ⚑ PENDING: questionSolved checks nothing; the goal node checks the goal ─────

async function goalPending(tc) {
    const panelWasOpen = panelIsOpen();
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    const seen = subscribeMystery(tc);
    let graphId = null;
    let restore = () => {};
    let bot = null;
    let restoreSpeed = async () => {};
    try {
        tc.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
        const botPanel = await tc.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
        bot = botPanel?.getBot?.() ?? null;
        tc.reportCondition('bot reachable', !!bot);
        if (!bot) return tc.getOverallResult();
        bot.reset();
        const opened = await openOnSameMonday(tc, STAND_IN_PAGE);
        if (!opened) return tc.getOverallResult();
        const { rules, block, mystery } = opened;
        graphId = block.graph_id;
        const goalLocation = rules.preset_sidecars[P][block.goal].playable_payload.location;
        const stub = await tc.pollForValue(() => (stubOf()?.states.length > 0 ? stubOf() : null),
            'the stand-in page received a mystery:state', TIMEOUT_MS, POLL_MS);
        tc.reportCondition('the stand-in page asked and was answered', !!stub);
        if (!stub) return tc.getOverallResult();
        tc.assertEqual('the world names no question location (⚑ PENDING)', 0, Object.keys(mystery.locations).length);

        // The page sends the goal question solved: nothing is checked, and nothing comes back. First let the load's
        // own states settle (none for QUIET_MS), so a state after the solve could only be the solve's.
        const quiet = async () => {
            for (let n = seen.states.length; ; n = seen.states.length) {
                await new Promise((r) => setTimeout(r, QUIET_MS));
                if (seen.states.length === n) return;
            }
        };
        await quiet();
        const busStatesBefore = seen.states.length;
        const checkedBefore = checkedNow().size;
        stub.solve(mystery.goal);
        const arrived = await tc.pollForCondition(() => seen.solved.length > 0, 'the host received the questionSolved',
            TIMEOUT_MS, POLL_MS);
        tc.reportCondition(`the host received questionSolved ${JSON.stringify(seen.solved[0] ?? null)}`, arrived);
        await new Promise((r) => setTimeout(r, QUIET_MS));
        tc.assertEqual('questionSolved brought ZERO mystery:state back (no echo with the page)', 0, seen.states.length - busStatesBefore);
        tc.assertEqual('questionSolved checked nothing', checkedBefore, checkedNow().size);
        tc.assertEqual(`the goal (${goalLocation}) is unchecked`, false, checkedNow().has(goalLocation));
        tc.assertEqual('nothing was refused', 0, stub.refusals.length);

        // The goal NODE checks the goal: the Playback Bot plays the world in Loop mode.
        await getSphereStateSingleton().loadSphereLog('embedded:actionNodesSameMonday',
            (rules.sphere_log ?? []).map((e) => JSON.stringify(e)).join('\n'));
        bot.refresh();
        restore = freshQueue();
        gs().setLoopModeActive(true);
        restoreSpeed = await startAppBotTestSpeed();
        await bot.play();
        const finished = await tc.pollForCondition(() => (bot.getStatus() || '').startsWith('finished'),
            'the bot finishes the world in Loop mode', 60000, 200);
        tc.reportCondition(`the bot finished (status: "${bot.getStatus()}")`, !!finished);
        tc.assertEqual(`the goal (${goalLocation}) is checked by its node`, true, checkedNow().has(goalLocation));
        const solvedNow = await tc.pollForCondition(() => last(stub.states)?.papers?.length > 0,
            'the page holds papers at the end', TIMEOUT_MS, POLL_MS);
        tc.reportCondition('the page was sent the papers the visits found', solvedNow);
        tc.assertEqual(`the state's solved still lacks ${mystery.goal} (⚑ PENDING)`, false,
            (last(stub.states)?.solved ?? []).includes(mystery.goal));
    } finally {
        bot?.stop();
        await restoreSpeed();
        restore();
        seen.stop();
        await closeUp(panelWasOpen, pageBefore, graphId);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'an-mystery-bridge-papers-loop',
    name: 'ActionNodes mystery bridge: The Same Monday\'s page gets the papers held and the loop',
    description: 'AN-MYST-1: enables the Mystery Game module at its default address (this app\'s copy of the game) and loads '
        + 'the committed The Same Monday preset: the game\'s page asks with the world\'s version, every state carries loop 1, a '
        + 'visit\'s paper arrives in the state by slot_data.mystery.items, and after a loop reset the state says loop 2.',
    testFunction: papersAndLoop,
    category: 'ActionNodes',
    enabled: false,
});

registerTest({
    id: 'an-mystery-goal-pending',
    name: 'ActionNodes mystery bridge: ⚑ PENDING goal — questionSolved checks nothing; the goal node checks the goal',
    description: 'AN-MYST-1 (pending; superseded by Robert\'s 2026-11-26 ruling, the world-side goal is AN-MYST-2): on The Same '
        + 'Monday with the stand-in page, the goal question sent solved checks nothing and brings no state back; the Playback '
        + 'Bot then plays the world, the goal node checks the goal, and the state\'s solved still lacks the question.',
    testFunction: goalPending,
    category: 'Playback Bot',
    enabled: false,
});
