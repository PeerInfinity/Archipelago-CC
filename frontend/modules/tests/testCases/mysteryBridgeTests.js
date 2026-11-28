/**
 * In-app test for the Mystery Archipelago bridge (`modules/mysteryArchipelago`).
 *
 * The row SETS the state it expects and puts it back: it points the module's page address at the
 * stand-in page `modules/mysteryArchipelago/testPage/` (not the real game, which lives in another
 * repository; a session-only setting), opens the Mystery Game panel the way Quick Launch does
 * (`enableModule`; the module is on by default, its panel is not in the layout), and loads the
 * committed mystery preset, which the panel then frames. It closes the panel it opened.
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
import panelManager from '../../../app/core/panelManager.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';

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
const PANEL_COMPONENT = 'mysteryPanel';
const panelIsOpen = () => !!document.querySelector('.mystery-panel-container');
const closePanel = () => panelManager.destroyPanelByComponentType(PANEL_COMPONENT);

export async function mysteryBridgeRoundTrip(testController) {
    const panelWasOpen = panelIsOpen();
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
        if (!panelWasOpen) await closePanel();
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
    const panelWasOpen = panelIsOpen();
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
        if (!panelWasOpen) await closePanel();
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

const STREET_PRESET_PATH = './presets/mystery_street_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const procgen = (name) => centralRegistry.getPublicFunction('procgenPlayer', name)?.();
const activeRegionId = () => procgen('getActiveSubstrate')?.regionId ?? null;
const moveTo = (sourceRegion, targetRegion, exitName) => loopStateSingleton.dispatcher.publish('user:regionMove', {
    sourceRegion, targetRegion, exitName,
}, { initialTarget: 'bottom' });

/**
 * A case that is ONE REGION of a generated world (the `mystery` substrate): the committed
 * `mystery_street_test` preset, the long case's office beside a maze street. The names come
 * from the loaded world: the case's region is the warehouse's `mystery` entry, the other is where
 * the player starts.
 */
export async function mysteryRegionOfficeAndStreet(testController) {
    const panelWasOpen = panelIsOpen();
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    try {
        await settingsManager.updateSetting(PAGE_URL_SETTING, STAND_IN_PAGE, { persist: false });
        await window.moduleManagerApi.enableModule(MODULE_ID);
        const panel = await testController.pollForValue(
            () => document.querySelector('.mystery-panel-container')?.mysteryPanelUI ?? null,
            'the Mystery Game panel', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the Mystery Game panel is open', !!panel);
        if (!panel) return testController.getOverallResult();

        await testController.loadRulesFromFile(STREET_PRESET_PATH);
        await testController.stateManager.pingWorker('after-rules-load', TIMEOUT_MS);

        // The world: one `mystery` region, and the region the player starts in, which is not it.
        const started = await testController.pollForCondition(
            () => !!activeRegionId(), 'the player is placed in a region', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the generated world placed the player', started);
        const warehouse = procgen('getWarehouse');
        const offices = (warehouse?.keys?.() ?? []).map((id) => [id, warehouse.get(id)]).filter(([, entry]) => entry.substrate === 'mystery');
        testController.assertEqual('the world holds one mystery region', 1, offices.length);
        if (offices.length !== 1) return testController.getOverallResult();
        const [office, officeEntry] = offices[0];
        const street = activeRegionId();
        testController.reportCondition(`the player starts away from the office (in "${street}", the office is "${office}")`,
            !!street && street !== office);
        const payload = officeEntry.world;
        // An exit's name, off the region's own world (the warehouse's exits, keyed by name).
        const exitOf = (from, to) => [...(warehouse.get(from)?.world?.exits?.entries?.() ?? [])]
            .find(([, exit]) => exit?.targetRegion === to)?.[0];
        const wayUp = exitOf(street, office);
        const wayDown = exitOf(office, street);
        testController.reportCondition(`the two regions are joined both ways (${wayUp} / ${wayDown})`, !!wayUp && !!wayDown);
        if (!wayUp || !wayDown) return testController.getOverallResult();

        // 1. The panel frames the region's case, and the state says the lock and that the player is away.
        const framed = await testController.pollForCondition(
            () => String(panel.wantedUrl ?? '').includes(`case=${payload.case}`), 'the panel frames the region\'s case', TIMEOUT_MS, POLL_MS);
        testController.reportCondition(`the panel framed ${panel.wantedUrl}`, framed);
        const stub = await testController.pollForValue(
            () => (stubOf()?.states.length > 0 ? stubOf() : null), 'the page received a mystery:state', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the page asked and the host answered with a state', !!stub);
        if (!stub) return testController.getOverallResult();
        testController.assertEqual('the state names the region\'s story', payload.story, last(stub.states).story);
        testController.assertEqual('the state names the region\'s version', payload.version, last(stub.states).version);
        testController.assertEqual('the state carries the world\'s lock', payload.lock, last(stub.states).lock);
        testController.assertEqual('away from the office the state says so', false, last(stub.states).inOffice);

        // 2. A question solved in the street is not checked.
        const snapshot = stateManagerProxySingleton.getSnapshot();
        const open = Object.entries(payload.ap_locations)
            .find(([, name]) => snapshot?.locationReachability?.[name] === 'reachable');
        testController.reportCondition(`a question of the case is open (${open?.[1]})`, !!open);
        if (!open) return testController.getOverallResult();
        const [questionId, locationName] = open;
        stub.solve(questionId);
        stub.request();
        const answeredAway = stub.states.length;
        await testController.pollForCondition(() => stub.states.length > answeredAway, 'the request after the solve was answered', TIMEOUT_MS, POLL_MS);
        await testController.stateManager.pingWorker('after-solve-away', TIMEOUT_MS);
        testController.reportCondition('a question solved away from the office is not checked',
            !(stateManagerProxySingleton.getSnapshot()?.checkedLocations ?? []).includes(locationName)
            && !last(stub.states).solved.includes(questionId));

        // 3. In the office: the state says so, and the same question is checked.
        moveTo(street, office, wayUp);
        const arrived = await testController.pollForCondition(
            () => activeRegionId() === office && last(stub.states).inOffice === true, 'the state says the player is in the office', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('moving into the office sends a state that says so', arrived);
        if (!arrived) return testController.getOverallResult();
        stub.solve(questionId);
        const landed = await testController.pollForCondition(
            () => last(stub.states).solved.includes(questionId), `the state lists ${questionId} as solved`, TIMEOUT_MS, POLL_MS);
        testController.reportCondition('in the office the question is checked and comes back solved', landed);
        testController.reportCondition('the check is in the app\'s checked locations',
            (stateManagerProxySingleton.getSnapshot()?.checkedLocations ?? []).includes(locationName));

        // 4. Back in the street: the state says so again, and the panel still shows the case (lock `actions`).
        moveTo(office, street, wayDown);
        const left = await testController.pollForCondition(
            () => activeRegionId() === street && last(stub.states).inOffice === false, 'the state says the player left the office', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('leaving the office sends a state that says so', left);
        testController.reportCondition('under this lock the case stays framed away from the office',
            String(panel.wantedUrl ?? '').includes(`case=${payload.case}`) && !!stubOf());
    } finally {
        await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
        if (!panelWasOpen) await closePanel();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-region-office-and-street',
    name: 'Mystery substrate: a case as one region of a generated world',
    description: 'Loads the committed mystery_street_test preset (the long case\'s office beside a maze street): the panel frames '
        + 'the region\'s case, the state carries the world\'s lock and whether the player is in the office, a question solved in '
        + 'the street is not checked, and the same question is checked once the player is in the office.',
    testFunction: mysteryRegionOfficeAndStreet,
    category: CATEGORY,
});

/** Does the game's own page say it is locked? Its mark: `body.ap-locked` with the line `#ap-lock` shown. */
const pageSaysLocked = () => gameFrames().some((frame) => {
    try {
        const doc = frame.contentDocument;
        return !!doc?.body?.classList.contains('ap-locked') && doc.getElementById('ap-lock')?.hidden === false;
    } catch { return false; }
});
/** Has the game's own page started (its bridge state has a first state)? */
const pageStarted = () => gameFrames().some((frame) => {
    try { return !!frame.contentWindow?.__ap?.first; } catch { return false; }
});

/**
 * The page's side of the lock, in the REAL page (this app's copy of the game): on the committed
 * `mystery_street_test` world it says it is locked while the player is in the street, not while in
 * the office, and again after leaving. Only the page's own mark is read; nothing on it is clicked.
 * No server: the page starts on the host's offline state.
 */
export async function mysteryRealPageLock(testController) {
    const panelWasOpen = panelIsOpen();
    const pageBefore = await settingsManager.getSetting(PAGE_URL_SETTING);
    const seen = { states: [], refusals: [] };
    const handlers = {
        'mystery:state': (data) => seen.states.push(data),
        'mystery:refused': (data) => seen.refusals.push(data),
    };
    for (const [event, handler] of Object.entries(handlers)) testController.eventBus.subscribe(event, handler);
    try {
        await settingsManager.updateSetting(PAGE_URL_SETTING, DEFAULT_PAGE_URL, { persist: false });
        await window.moduleManagerApi.enableModule(MODULE_ID);
        const panel = await testController.pollForValue(
            () => document.querySelector('.mystery-panel-container')?.mysteryPanelUI ?? null,
            'the Mystery Game panel', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('the Mystery Game panel is open', !!panel);
        if (!panel) return testController.getOverallResult();

        await testController.loadRulesFromFile(STREET_PRESET_PATH);
        await testController.stateManager.pingWorker('after-rules-load', TIMEOUT_MS);
        const warehouse = procgen('getWarehouse');
        const office = (warehouse?.keys?.() ?? []).find((id) => warehouse.get(id)?.substrate === 'mystery');
        const started = await testController.pollForCondition(() => !!activeRegionId(), 'the player is placed in a region', TIMEOUT_MS, POLL_MS);
        const street = activeRegionId();
        testController.reportCondition(`the player starts away from the office ("${street}" / "${office}")`,
            started && !!office && street !== office);
        if (!started || !office || street === office) return testController.getOverallResult();
        const exitOf = (from, to) => [...(warehouse.get(from)?.world?.exits?.entries?.() ?? [])]
            .find(([, exit]) => exit?.targetRegion === to)?.[0];

        const up = await testController.pollForCondition(pageStarted, 'the game\'s page started with no server', TIMEOUT_MS * 2, POLL_MS);
        testController.reportCondition('the game\'s page started on the host\'s offline state', up);
        testController.assertEqual('nothing was refused', 0, seen.refusals.length);
        testController.assertEqual('the state says the player is away', false, last(seen.states)?.inOffice);
        if (!up) return testController.getOverallResult();

        const lockedAway = await testController.pollForCondition(pageSaysLocked, 'the page says it is locked', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('in the street the game\'s page says it is locked', lockedAway);

        moveTo(street, office, exitOf(street, office));
        const open = await testController.pollForCondition(
            () => last(seen.states)?.inOffice === true && !pageSaysLocked(), 'the page is unlocked in the office', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('in the office the game\'s page is not locked', open);

        moveTo(office, street, exitOf(office, street));
        const lockedAgain = await testController.pollForCondition(
            () => last(seen.states)?.inOffice === false && pageSaysLocked(), 'the page is locked again', TIMEOUT_MS, POLL_MS);
        testController.reportCondition('back in the street the game\'s page says it is locked again', lockedAgain);
    } finally {
        for (const [event, handler] of Object.entries(handlers)) testController.eventBus.unsubscribe?.(event, handler);
        await settingsManager.updateSetting(PAGE_URL_SETTING, pageBefore, { persist: false });
        if (!panelWasOpen) await closePanel();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'mystery-real-page-lock',
    name: 'Mystery substrate: the game\'s own page locks away from the office',
    description: 'Loads the committed mystery_street_test preset at the module\'s default address (this app\'s copy of the '
        + 'game), with no server: the page says it is locked while the player is in the street, is not locked in the office, '
        + 'and is locked again after leaving.',
    testFunction: mysteryRealPageLock,
    category: CATEGORY,
});
