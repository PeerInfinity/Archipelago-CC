/**
 * In-app test for the Mystery Archipelago bridge (`modules/mysteryArchipelago`).
 *
 * The row SETS the state it expects and puts it back: it points the module's page address at the
 * stand-in page `modules/mysteryArchipelago/testPage/` (not the real game, which lives in another
 * repository; a session-only setting), enables the module (disabled by default), which opens the
 * Mystery Game panel, and loads the committed mystery preset, which the panel then frames.
 * It runs with no server, so it covers the host's offline answers; the names it checks come from
 * the loaded world's own `slot_data.mystery`, never from this file.
 *
 * A second row frames the REAL page, from this app's own copy of the game (the submodule
 * `modules/mystery-clue-game`, the module's default address), and reads only the host's side: the
 * page asked with the version the world has, a state went back, and nothing was refused.
 */

import { registerTest } from '../testRegistry.js';
import stateManagerProxySingleton from '../../stateManager/stateManagerProxySingleton.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { DEFAULT_PAGE_URL, PAGE_URL_SETTING } from '../../mysteryArchipelago/mysteryPage.js';

const CATEGORY = 'Mystery Bridge';
const MODULE_ID = 'mysteryArchipelago';
const PRESET_PATH = './presets/mystery_custom_house_fire/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const STAND_IN_PAGE = './modules/mysteryArchipelago/testPage/index.html';
const TIMEOUT_MS = 15000;
const POLL_MS = 50;

const stubOf = () => {
    for (const frame of document.querySelectorAll('.mystery-panel-container iframe')) {
        try {
            if (frame.contentWindow?.__mysteryStub) return frame.contentWindow.__mysteryStub;
        } catch { /* another origin: not ours */ }
    }
    return null;
};
const last = (list) => list[list.length - 1];

export async function mysteryBridgeRoundTrip(testController) {
    const states = window.moduleManagerApi?.getAllModuleStates?.() ?? {};
    const wasEnabled = states[MODULE_ID]?.enabled === true;
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    try {
        // Before the module is on: the panel reads the address when it frames a world.
        await settingsManager.updateSetting(PAGE_URL_SETTING, STAND_IN_PAGE, { persist: false });
        await window.moduleManagerApi.enableModule(MODULE_ID);
        const panel = await testController.pollForValue(
            () => document.querySelector('.mystery-panel-container')?.mysteryPanelUI ?? null,
            'the Mystery Game panel', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('enabling the module opens the Mystery Game panel', !!panel);
        if (!panel) return testController.getOverallResult();

        testController.log(`Loading ${PRESET_PATH}…`);
        await testController.loadRulesFromFile(PRESET_PATH);
        await testController.stateManager.pingWorker('after-rules-load', TIMEOUT_MS);

        const staticData = stateManagerProxySingleton.getStaticData();
        const player = String(staticData?.playerId ?? '1');
        const mystery = staticData?.world?.[player]?.slot_data?.mystery;
        testController.reportCondition('the loaded world carries slot_data.mystery',
            typeof mystery?.story === 'string' && Object.keys(mystery?.locations ?? {}).length > 0);
        if (!mystery) return testController.getOverallResult();

        // The panel frames the loaded world's case by itself: nothing here tells it a URL.
        const framed = await testController.pollForCondition(
            () => String(panel.wantedUrl ?? '').includes(`case=cases/${mystery.story}`),
            'the panel frames the case of the loaded world', TIMEOUT_MS, POLL_MS);
        testController.reportCondition(`the panel framed ${panel.wantedUrl}`, framed);

        const stub = await testController.pollForValue(
            () => (stubOf()?.states.length > 0 ? stubOf() : null), 'the page received a mystery:state', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the page asked and the host answered with a state', !!stub);
        if (!stub) return testController.getOverallResult();

        // 1. The first state: this slot's story and version, offline, whole sets.
        const first = stub.states[0];
        testController.assertEqual('the state names the slot\'s story', mystery.story, first.story);
        testController.assertEqual('the state names the slot\'s version', mystery.version, first.version);
        testController.assertEqual('with no server the state is not connected', false, first.connected);
        testController.reportCondition(`the offline game key names the seed (${first.game})`,
            first.game === `offline:${staticData.seed_name}:${player}`);
        testController.reportCondition('papers and solved are lists', Array.isArray(first.papers) && Array.isArray(first.solved));
        testController.assertEqual('no question is solved at the start', 0, first.solved.length);

        // 2. A solved question becomes a check, and comes back in `solved` with the paper it brought.
        const snapshot = stateManagerProxySingleton.getSnapshot();
        const openLocation = Object.keys(mystery.locations)
            .find((name) => snapshot?.locationReachability?.[name] === 'reachable');
        testController.reportCondition(`a question is open at the start (${openLocation})`, !!openLocation);
        if (!openLocation) return testController.getOverallResult();
        const questionId = mystery.locations[openLocation];
        const before = stub.states.length;
        stub.solve(questionId);
        const landed = await testController.pollForCondition(
            () => last(stub.states).solved.includes(questionId), `the state lists ${questionId} as solved`, TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the solved question was checked and came back in the state', landed);
        testController.reportCondition('the check is in the app\'s checked locations',
            (stateManagerProxySingleton.getSnapshot()?.checkedLocations ?? []).includes(openLocation));
        const paperIds = new Set(Object.values(mystery.items));
        testController.reportCondition('every paper in the state is one of the case\'s paper ids',
            last(stub.states).papers.every((id) => paperIds.has(id)));

        // 3. A repeat is taken and changes nothing.
        const afterSolve = stub.states.length;
        testController.reportCondition('the solve brought at least one new state', afterSolve > before);
        stub.solve(questionId);
        stub.request();
        await testController.pollForCondition(
            () => stub.states.length > afterSolve, 'the page\'s second request was answered', TIMEOUT_MS, POLL_MS);
        testController.assertEqual('a repeated solve leaves solved as it was',
            JSON.stringify(stub.states[afterSolve - 1].solved), JSON.stringify(last(stub.states).solved));

        // 4. Another version and another story are refused by name, with no state.
        const statesBefore = stub.states.length;
        stub.request({ version: 'not-this-version' });
        stub.request({ story: 'not-this-story' });
        const refused = await testController.pollForCondition(
            () => stub.refusals.length >= 2, 'two refusals arrived', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('both requests were refused', refused);
        testController.assertEqual('the refusals are named',
            'other-version,other-story', stub.refusals.map((r) => r.reason).join(','));
        testController.assertEqual('a refusal carries the slot\'s version', mystery.version, stub.refusals[0]?.version);
        testController.assertEqual('a refused request brings no state', statesBefore, stub.states.length);
    } finally {
        await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
        if (!wasEnabled) await window.moduleManagerApi.disableModule?.(MODULE_ID);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-bridge-round-trip',
    name: 'Mystery bridge: a solved question round trip',
    description: 'Enables the Mystery Game module (its panel opens), loads the committed mystery preset, which the '
        + 'panel frames from a stand-in page: the host answers a request with the whole state, turns a solved question into a location check that '
        + 'comes back as solved, takes a repeat, and refuses another story or version by name.',
    testFunction: mysteryBridgeRoundTrip,
    category: CATEGORY,
});

/** The frames of the Mystery Game panel whose page is this app's copy of the game. */
const gameFrames = () => [...document.querySelectorAll('.mystery-panel-container iframe')].filter((frame) => {
    try { return frame.contentWindow.location.pathname.includes('/modules/mystery-clue-game/'); } catch { return false; }
});

export async function mysteryRealPageHandshake(testController) {
    const states = window.moduleManagerApi?.getAllModuleStates?.() ?? {};
    const wasEnabled = states[MODULE_ID]?.enabled === true;
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    const seen = { requests: [], states: [], refusals: [] };
    const handlers = {
        'mystery:requestState': (data) => seen.requests.push(data),
        'mystery:state': (data) => seen.states.push(data),
        'mystery:refused': (data) => seen.refusals.push(data),
    };
    for (const [event, handler] of Object.entries(handlers)) testController.eventBus.subscribe(event, handler);
    try {
        // The module's own default: this app's copy of the game. Set outright, so a stored address cannot stand in.
        await settingsManager.updateSetting(PAGE_URL_SETTING, DEFAULT_PAGE_URL, { persist: false });
        await window.moduleManagerApi.enableModule(MODULE_ID);
        const panel = await testController.pollForValue(
            () => document.querySelector('.mystery-panel-container')?.mysteryPanelUI ?? null,
            'the Mystery Game panel', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('enabling the module opens the Mystery Game panel', !!panel);
        if (!panel) return testController.getOverallResult();

        await testController.loadRulesFromFile(PRESET_PATH);
        await testController.stateManager.pingWorker('after-rules-load', TIMEOUT_MS);
        const staticData = stateManagerProxySingleton.getStaticData();
        const mystery = staticData?.world?.[String(staticData?.playerId ?? '1')]?.slot_data?.mystery;
        testController.reportCondition('the loaded world carries slot_data.mystery', typeof mystery?.story === 'string');
        if (!mystery) return testController.getOverallResult();

        const framed = await testController.pollForCondition(
            () => gameFrames().length > 0, 'the panel frames the game from this app\'s copy', TIMEOUT_MS, POLL_MS);
        testController.reportCondition(`the panel framed the game's own page (${panel.wantedUrl})`, framed);

        const asked = await testController.pollForCondition(
            () => seen.requests.length > 0 && (seen.states.length > 0 || seen.refusals.length > 0),
            'the game\'s page asked and the host answered', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the game\'s page asked for the state and was answered', asked);
        if (!asked) return testController.getOverallResult();
        const request = seen.requests[0];
        testController.assertEqual('the page asked for the world\'s story', mystery.story, request.story);
        // The page reads its version from its own export of the case: equal means the pin holds in the running app.
        testController.assertEqual('the page\'s version of the case is the world\'s', mystery.version, request.version);
        testController.assertEqual('nothing was refused', 0, seen.refusals.length);
        testController.assertEqual('the state that went back names the world\'s version', mystery.version, seen.states[0]?.version);
    } finally {
        for (const [event, handler] of Object.entries(handlers)) testController.eventBus.unsubscribe?.(event, handler);
        await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
        if (!wasEnabled) await window.moduleManagerApi.disableModule?.(MODULE_ID);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-real-page-handshake',
    name: 'Mystery bridge: the game\'s own page asks and is answered',
    description: 'Enables the Mystery Game module at its default address (this app\'s copy of the game, the submodule '
        + 'modules/mystery-clue-game) and loads the committed mystery preset: the game\'s page asks for the state with the '
        + 'version the world has, a state goes back, and nothing is refused.',
    testFunction: mysteryRealPageHandshake,
    category: CATEGORY,
});
