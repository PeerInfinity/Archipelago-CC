/**
 * ⛓ CA-S4 EQUIVALENCE (CA-S1's measured method, extended with recorders for Flash's teleport, Discovery, apcalc and
 * vibeCodingSim): a Region Graph click and a Region Map click make the SAME observable calls at the tip as at base
 * d358d50e02, at the DEFAULT config and each of the 6 settings presets that carry a `clickActions`.
 *
 * METHOD: MEASURED, not transcribed.
 *   - BEFORE: the base's listeners, VERBATIM (`legacyNodeSelectedListeners.testkit.js`): Flash's `regionGraph:nodeSelected`
 *     teleport and its "TP on UI click" check handler, Discovery's `handleRegionClicked`, apcalc's and vibeCodingSim's
 *     listeners, subscribed to `regionGraph:nodeSelected` in module order (Discovery, apcalc, vibeCodingSim at
 *     initialize; Flash when its game loads). The registry holds what base registered (the built-ins, `regions.open`).
 *     Each panel's config is the config itself (the Map's: the base's first-run copy of the Graph's, the same object).
 *   - AFTER: the tip's code: the REAL Discovery module (`discovery.discover` registered by its `initialize`), the REAL
 *     apcalc and vibeCodingSim modules (their filtered `regionView:regionClicked` listeners), Flash's REAL actions
 *     (`_setupTeleportUI` on a FlashPanelUI stand-in) and its REAL `handleUserLocationCheck`, `regions.scrollTo` and the
 *     two centre actions. The Graph's config is SEEDED as its strip seeds it (`withInitialValues`, with the Flash box as
 *     it is at the seed: unticked on a real first run, ticked measured too); the Map's is the tip's first-run copy
 *     (`withoutPerPanelInitials`) seeded for the Map.
 *   - Both sides click through the REAL `GraphInteractionManager` / `NavigationManager` (Region Graph) and the REAL
 *     `runRegionMapClick` (Region Map), with the REAL `regionActions` over a recording dispatcher; a `user:locationCheck`
 *     reaches the side's Flash check handler, as Flash's dispatcher receiver does.
 *
 * DIMENSIONS: 7 configs × 2 (box at click time) × 3 (discovery bundle: off, click-discovers, loop mode) × 5 clicks
 * (Graph region "Field", Graph region "C" (apcalc's reset branch), Graph location "chest", Map region "Field", Map
 * location "chest") × 2 (the box at the Graph's seed: unticked = a real first run; ticked).
 *
 * COMPARED, per row: the whole ordered log of observable calls (dispatches, the Regions-panel events and Show-All
 * changes, the selection events, the teleports, the discoveries, apcalc's and vibeCodingSim's calls).
 * THE ALLOWED DELTAS, each named and counted (any other difference fails the row):
 *   G. the generic event: the Region Graph now publishes `regionView:regionClicked` / `locationClicked` (one per click);
 *   F. the Flash box no longer teleports on a map click (⚖ user 2026-11-20T16:29:00Z): a teleport the base made with
 *      the box ticked and the tip does not, on a Graph or a Map click; with the seed-ticked Graph, a teleport the tip
 *      makes through `flash.teleport*` where the base made none (the strip decides, not the check);
 *   I. the interleaving of independent listeners: apcalc / vibeCodingSim now hear the generic event, published before
 *      the actions, so they run before `discovery.discover`; the base ran Discovery first (both on one event). Each
 *      channel's own order is still compared.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'node:fs';

const rec = vi.hoisted(() => ({ log: [], showAll: true, bundle: {}, side: 'base', bus: null }));

vi.mock('../regionGraph/index.js', () => ({
    moduleDispatcher: { id: 'regionGraph', publish: (name, data) => rec.onDispatch('graph', name, data) },
    getModuleEventBus: () => rec.bus,
    getNodeLabelProvider: () => null,
}));
const staticData = { regions: new Map([
    ['Menu', { locations: [], exits: [{ name: 'Go', connected_region: 'Field' }] }],
    ['Field', { locations: [{ name: 'chest' }, { name: 'gem' }, { name: 'locked', access_rule: { ok: false } }] }],
    ['C', { locations: [] }],
]) };
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => staticData,
        getLatestStateSnapshot: () => ({ checkedLocations: [] }),
        getStartRegions: () => ['Menu'],
    },
    getLastRawJsonData: () => null,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => ({ getCurrentRegion: () => 'Menu', getPath: () => [],
    addLocationCheck: (l, r) => rec.log.push({ ch: 'play', name: 'addLocationCheck', args: [l, r] }) }) }));
vi.mock('../discovery/singleton.js', () => ({ default: {
    setDependencies: () => {}, getStartRegions: () => ['Menu'], isLocationDiscovered: () => false,
    isRegionDiscovered: () => false,
    discoverRegion: (r) => { rec.log.push({ ch: 'discover', name: 'discoverRegion', args: [r] }); return false; },
    dispose: () => {},
} }));
vi.mock('../../app/core/centralRegistry.js', () => ({ centralRegistry: { getPublicFunction: () => null, getSchemaDefault: () => ({ found: false }) } }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: {
    getSetting: async (k, d) => {
        const m = /^moduleSettings\.discovery\.(.+)$/.exec(k);
        return m && m[1] in rec.bundle ? rec.bundle[m[1]] : d;
    },
    updateSetting: async () => true,
    hasStoredSetting: async () => false,
    hasOverride: () => false,
} }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));
vi.mock('../flashPanel/index.js', async (importOriginal) => ({ ...(await importOriginal()), getSeedlingRegionGlue: () => null }));

/** A synchronous bus that records every publish (channel by event name) and calls the subscribers. */
function makeBus() {
    const subs = new Map();
    const chOf = (n) => (n.startsWith('regionView:') ? 'generic' : n.endsWith(':nodeSelected') ? 'select' : 'regions');
    return {
        subscribe(n, fn) { (subs.get(n) ?? subs.set(n, []).get(n)).push(fn); return () => {}; },
        publish(n, data) {
            rec.log.push({ ch: chOf(n), name: n, args: [data] });
            for (const fn of subs.get(n) ?? []) fn(data);
        },
    };
}
const busBase = makeBus();
const busTip = makeBus();

const showAllBox = {
    get checked() { return rec.showAll; },
    set checked(v) { if (rec.showAll !== v) { rec.showAll = v; rec.log.push({ ch: 'regions', name: 'showAll', args: [v] }); } },
    dispatchEvent: () => true,
};
globalThis.document = { querySelector: (sel) => (sel === '#show-all-regions' ? showAllBox : null), createElement: () => ({}) };

const CA = await import('./clickActions.js');
const { NavigationManager } = await import('../regionGraph/navigationManager.js');
const { GraphInteractionManager } = await import('../regionGraph/graphInteractionManager.js');
const { runRegionMapClick, withClickHandles, makeRegionMapCentreAction } = await import('../regionMap/regionMapClickActions.js');
const { REGIONS_OPEN_ACTION, REGIONS_SCROLL_TO_ACTION } = await import('../regions/regionsClickActions.js');
const { makeRegionGraphCentreAction } = await import('../regionGraph/regionGraphCentreAction.js');
const { FlashPanelUI } = await import('../flashPanel/flashPanelUI.js');
const legacy = await import('./legacyNodeSelectedListeners.testkit.js');
const { LOOP_MODE_OVERRIDES } = await import('../discovery/worldDiscoveryMode.js');
const discoveryState = (await import('../discovery/singleton.js')).default;

/* ── the two sides' listeners ─────────────────────────────────────────── */

const flashSelf = (side) => ({
    teleportOnClickCheckbox: { checked: false },
    _teleportToRegion: (r) => rec.log.push({ ch: 'flash', name: 'teleportToRegion', args: [r], side }),
    _teleportToLocation: (l) => rec.log.push({ ch: 'flash', name: 'teleportToLocation', args: [l], side }),
});
const apcalcPanel = { setPathFilter: (r) => rec.log.push({ ch: 'apcalc', name: 'setPathFilter', args: [r] }), render() {} };
const vibePanel = { selectFeatureByRegion: (r) => rec.log.push({ ch: 'vibe', name: 'selectFeatureByRegion', args: [r] }) };

// BASE: the verbatim listeners on the base bus, in module order (Discovery, apcalc, vibeCodingSim, then Flash).
const baseFlash = flashSelf('base');
const baseFlashL = legacy.legacyFlash(baseFlash);
const baseDisc = { _settings: {}, discoveryStateSingleton: discoveryState, log: () => {},
    autoDiscoverLocationsInRegion: () => {}, autoDiscoverExitsInRegion: () => {} };
busBase.subscribe('regionGraph:nodeSelected', legacy.legacyDiscovery(baseDisc));
busBase.subscribe('regionGraph:nodeSelected', legacy.legacyApcalc({ gameState: null, panelInstance: apcalcPanel }));
busBase.subscribe('regionGraph:nodeSelected', legacy.legacyVibe({ panelInstance: vibePanel }));
busBase.subscribe('regionGraph:nodeSelected', baseFlashL.onNodeSelected);

// TIP: the real modules on the tip bus.
const api = (bus) => ({ getEventBus: () => bus, getDispatcher: () => ({ publish() {}, publishToNextModule() {} }), getModuleFunction: () => null });
const disc = await import('../discovery/index.js');
const apcalc = await import('../apcalc/index.js');
const vibe = await import('../vibeCodingSim/index.js');
const discSubs = makeBus();
await disc.initialize('discovery', 0, api(discSubs));
await apcalc.initialize('apcalc', 0, api(busTip));
await vibe.initialize('vibeCodingSim', 0, api(busTip));
apcalc.setPanelInstance(apcalcPanel);
vibe.setPanelInstance(vibePanel);
const tipRegistered = ['discovery.discover'].map((id) => CA.getClickAction(id));
const tipFlash = Object.assign(Object.create(FlashPanelUI.prototype), flashSelf('tip'), {
    gameConfig: { teleport: true, region_coords: {}, location_coords: {} }, adapter: {},
    teleportRow: { style: {} }, teleportRegionSelect: { appendChild() {} }, teleportLocationSelect: { appendChild() {} },
    _panelLog: () => {},
});

/** Put the side's registry in place. */
function useRegistry(side) {
    CA.resetClickActionsForTests();
    CA.registerClickAction(REGIONS_OPEN_ACTION);
    if (side === 'base') return;
    for (const d of tipRegistered) CA.registerClickAction(d); // Discovery's, as its initialize registered it
    CA.registerClickAction(REGIONS_SCROLL_TO_ACTION);
    CA.registerClickAction(makeRegionGraphCentreAction(() => []));
    CA.registerClickAction(makeRegionMapCentreAction(() => []));
    tipFlash._setupTeleportUI(); // Flash's, when its teleport-capable game loads
}

/* ── the dispatcher → Flash's check handler (its dispatcher receiver) ─── */
rec.onDispatch = (panel, name, data) => {
    rec.log.push({ ch: 'play', name, args: [panel, data] });
    if (name === 'user:locationCheck' || name === 'system:locationCheck') {
        (rec.side === 'base' ? baseFlashL : tipFlash).handleUserLocationCheck(data);
    }
};

/* ── the panels ───────────────────────────────────────────────────────── */
const pathFinder = {
    stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({}) },
    findPath: () => ({ steps: ['Menu', 'Field'], nextExit: 'Go', length: 1 }),
    findPathWithExits: (from, to) => ({ steps: [{ region: from }, { region: to, exitUsed: 'Go' }], length: 1 }),
    buildAccessibilityMap: () => ({}),
    findExitBetweenRegions: () => 'Go',
};
function graphUi(clickActions, bundle) {
    const ui = { pathFinder, statuses: [], updateStatus: () => {},
        cy: { $: () => ({ removeClass: () => {} }), nodes: () => [], edges: () => [] },
        isDiscoveryModeActive: !!bundle.enableDiscoveryMode, discoverySettings: { ...bundle }, clickActions };
    ui.navigationManager = new NavigationManager(ui);
    return ui;
}
const regionNode = (id) => ({ id: () => id, data: () => ({ id }), addClass: () => {} });
const locationNode = (name, parent) => ({ data: (k) => ({ locationName: name, label: name, parentRegion: parent })[k] });

function mapClick(target, settings, bundle, ui) {
    const h = withClickHandles({ ...ui.navigationManager._handles({ id: 'regionMap', publish: (n, d) => rec.onDispatch('map', n, d) }),
        eventBus: rec.bus });
    const discovery = { active: !!bundle.enableDiscoveryMode, settings: { ...bundle } };
    if (target === 'region') runRegionMapClick(h, 'region', { regionName: 'Field', data: { id: 'Field' } }, settings, discovery);
    else runRegionMapClick(h, 'location', { regionName: 'Field', locationName: 'chest' }, settings, discovery);
}

const CLICKS = {
    'graph region Field': (s, b) => new GraphInteractionManager(graphUi(s.graph, b)).handleRegionNodeClick(regionNode('Field')),
    'graph region C': (s, b) => new GraphInteractionManager(graphUi(s.graph, b)).handleRegionNodeClick(regionNode('C')),
    'graph location chest': (s, b) => new GraphInteractionManager(graphUi(s.graph, b)).handleLocationNodeClick(locationNode('chest', 'Field')),
    'map region Field': (s, b) => mapClick('region', s.map, b, graphUi(s.graph, b)),
    'map location chest': (s, b) => mapClick('location', s.map, b, graphUi(s.graph, b)),
};

/* ── the configs ──────────────────────────────────────────────────────── */
const PRESETS = ['depgraph', 'vibecoding', 'apcalc', 'check-all-from-graph', 'metamath', 'textadventure'];
const CONFIGS = { default: CA.defaultClickActions() };
for (const name of PRESETS) {
    CONFIGS[name] = JSON.parse(fs.readFileSync(new URL(`../../settings/settings-${name}.json`, import.meta.url), 'utf8'))
        .moduleSettings.regionGraph.clickActions;
}
const BUNDLES = {
    off: { enableDiscoveryMode: false },
    'click-discovers': { enableDiscoveryMode: true, clickDiscoversRegion: true, disableLocationCheckUI: false },
    loop: { ...LOOP_MODE_OVERRIDES },
};

async function setBundle(b) {
    rec.bundle = { ...b };
    baseDisc._settings = { enableDiscoveryMode: false, clickDiscoversRegion: false, ...b };
    await discSubs.publish('settings:changed', { key: '*' });
    await new Promise((r) => setTimeout(r, 0));
}

/** One click on one side → its log (the generic events split off). */
function run(side, click, cfg, bundle, boxAtClick, boxAtSeed) {
    useRegistry(side);
    rec.side = side;
    rec.bus = side === 'base' ? busBase : busTip;
    let settings;
    if (side === 'base') settings = { graph: structuredClone(cfg), map: structuredClone(cfg) };
    else {
        tipFlash.teleportOnClickCheckbox.checked = boxAtSeed;
        settings = { graph: CA.withInitialValues('regionGraph', structuredClone(cfg)).settings,
            map: CA.withInitialValues('regionMap', CA.withoutPerPanelInitials(structuredClone(cfg))).settings };
    }
    baseFlash.teleportOnClickCheckbox.checked = boxAtClick;
    tipFlash.teleportOnClickCheckbox.checked = boxAtClick;
    rec.log = [];
    rec.showAll = true;
    CLICKS[click](settings, bundle);
    const log = rec.log.map(({ ch, name, args }) => ({ ch, name, args: JSON.parse(JSON.stringify(args)) }));
    return { log: log.filter((e) => e.ch !== 'generic'), generic: log.filter((e) => e.ch === 'generic'), settings };
}

const key = (e) => JSON.stringify(e);
const byCh = (log, ch) => log.filter((e) => e.ch === ch).map(key);
const CHANNELS = ['play', 'regions', 'select', 'discover', 'apcalc', 'vibe', 'flash'];

const tally = { rows: 0, equal: 0, G: 0, F: 0, Fdetail: {}, I: 0, other: [] };

describe('CA-S4 equivalence: base d358d50e02 vs tip, Region Graph and Region Map clicks', () => {
    for (const [bName, bundle] of Object.entries(BUNDLES)) {
        it(`discovery bundle "${bName}": every config × click × box`, async () => {
            await setBundle(bundle);
            for (const [cName, cfg] of Object.entries(CONFIGS)) {
                for (const click of Object.keys(CLICKS)) {
                    for (const boxAtSeed of [false, true]) {
                        for (const boxAtClick of [false, true]) {
                            const row = `${bName}/${cName}/${click}/seed:${boxAtSeed}/box:${boxAtClick}`;
                            const b = run('base', click, cfg, bundle, boxAtClick, boxAtSeed);
                            const t = run('tip', click, cfg, bundle, boxAtClick, boxAtSeed);
                            tally.rows++;
                            // G: the generic event. The Region Map published it at base already (CA-S3): equal. The
                            // Region Graph's handlers at base are the tip's WITHOUT its two generic publishes (the
                            // file's whole diff, pinned below), so the base side drops that one publish: the tip's
                            // Graph click publishes exactly one, the base none.
                            expect(b.generic, row).toHaveLength(1);
                            expect(t.generic, row).toHaveLength(1);
                            if (click.startsWith('map')) expect(t.generic, row).toEqual(b.generic);
                            const g = t.generic[0];
                            expect(g.args[0].panelId, row).toBe(click.startsWith('graph') ? 'regionGraph' : 'regionMap');
                            if (click.startsWith('graph')) tally.G++;
                            // every channel but Flash's, in its own order
                            for (const ch of CHANNELS.filter((c) => c !== 'flash')) expect(byCh(t.log, ch), `${row} [${ch}]`).toEqual(byCh(b.log, ch));
                            // F: Flash's channel
                            const bf = byCh(b.log, 'flash');
                            const tf = byCh(t.log, 'flash');
                            if (JSON.stringify(bf) !== JSON.stringify(tf)) {
                                // allowed only as the ruled change: a map click with the box ticked (lost), or the
                                // seed-ticked Graph's own option (the strip decides)
                                const ruled = (boxAtClick && tf.length === 0 && bf.length > 0)
                                    || (boxAtSeed && click.startsWith('graph'));
                                if (!ruled) tally.other.push(row);
                                expect(ruled, `${row}: Flash ${JSON.stringify(bf)} → ${JSON.stringify(tf)}`).toBe(true);
                                tally.F++;
                                const k = `${click} seed:${boxAtSeed} box:${boxAtClick}: ${bf.length}→${tf.length}`;
                                tally.Fdetail[k] = (tally.Fdetail[k] ?? 0) + 1;
                            }
                            // the whole order, Flash aside: equal, or I (independent listeners interleaved)
                            const noF = (log) => log.filter((e) => e.ch !== 'flash').map(key);
                            if (JSON.stringify(noF(t.log)) === JSON.stringify(noF(b.log))) {
                                if (JSON.stringify(bf) === JSON.stringify(tf)) tally.equal++;
                            } else {
                                expect([...noF(t.log)].sort(), row).toEqual([...noF(b.log)].sort());
                                const moved = noF(b.log).filter((e, i) => e !== noF(t.log)[i]).map((e) => JSON.parse(e).ch);
                                expect(moved.every((c) => ['discover', 'apcalc', 'vibe'].includes(c)), `${row}: interleaving ${moved}`).toBe(true);
                                tally.I++;
                            }
                        }
                    }
                }
            }
        });
    }

    it('the Region Graph\'s click handlers moved by exactly the two generic publishes (the base side above relies on it)', () => {
        const src = fs.readFileSync(new URL('../regionGraph/graphInteractionManager.js', import.meta.url), 'utf8');
        expect(src.match(/this\.eventBus\.publish\((REGION|LOCATION)_CLICKED/g)).toEqual(['this.eventBus.publish(LOCATION_CLICKED',
            'this.eventBus.publish(REGION_CLICKED']);
    });

    it('the tally (the report\'s table)', () => {
        console.log('CA-S4 EQUIVALENCE', JSON.stringify(tally, null, 1));
        expect(tally.rows).toBe(3 * 7 * 5 * 2 * 2);
        expect(tally.other).toEqual([]);
    });
});

afterAll(() => CA.resetClickActionsForTests());
