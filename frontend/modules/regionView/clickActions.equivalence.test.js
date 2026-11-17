/**
 * ⛓ CA-S1 EQUIVALENCE — the migrated click config, run through `runClickActions`, makes the SAME `regionActions` calls
 * as today's Region Graph handlers, for every combination of the seven `moduleSettings.regionGraph.*` booleans.
 *
 * METHOD: MEASURED, not transcribed. Today's side drives the REAL handler functions —
 * `GraphInteractionManager.handleRegionNodeClick` / `handleLocationNodeClick` (`regionGraph/graphInteractionManager.js`)
 * over a REAL `NavigationManager` (`regionGraph/navigationManager.js`) — with no DOM: the checkboxes are
 * `{ checked }` stubs keyed by id, `addLocationsToPath` comes from a stubbed `settingsManager`. `regionActions.js` is
 * replaced by a recorder (shared by both sides) that logs each call's name and arguments. The new side runs
 * `migrateRegionGraphClickKeys(bits)` through `runClickActions('regionGraph', …)`. No expected list is written by
 * hand: each row compares the two recorded logs.
 *
 * WHAT IS COMPARED, per combination:
 *   1. the `play` channel IN ORDER — every call that dispatches or edits the path (`publishRegionMove`, `addToPath`,
 *      `overwritePath`, `checkLocation`, `checkAccessibleLocationsInRegion`, `addLocationCheckToPath`), args included;
 *   2. the `regions` channel IN ORDER — `showRegionInRegionsPanel` and every CHANGE of the Regions panel's
 *      "Show All Regions" box (`navigationManager.setShowAllRegions` only fires when the value changes);
 *   3. the multiset of ALL calls, the read-only ones too (`planOneStepMove`, `planDirectMove`,
 *      `locationChecksAllowed`), args included.
 *   The interleaving BETWEEN the two channels is not compared: today's is set by the handlers' dynamic imports (the
 *   Regions-panel publishes are synchronous, the moves and checks run after `import('./index.js')` resolves), the new
 *   one by R8 (path, then checks, then panel actions). The row counts the combinations where it differs.
 *
 * THE EXPECTED DELTA — the only one: a path move's `source` is `regionView-path-regionGraph` (R7) where today it is
 * one of `REGION_GRAPH_SOURCES`. Each row swaps today's source strings for it and counts the swaps.
 *
 * `regions.open` belongs to the Regions panel (CA-S4); here a STAND-IN registers it with today's behaviour (Show All
 * = !(add || overwrite path), then activate + navigate), to show the settings carry what it needs.
 * `publishNodeSelected` is the Region Graph's own publish (it stays with the panel, design §4.3) and is not compared.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const rec = vi.hoisted(() => ({
    log: [],
    showAll: true,
    bits: {},
}));

/** Record one call. `channel`: 'play' | 'regions' | 'read' | 'select'. Functions in args become '[fn]'. */
function norm(v) {
    if (typeof v === 'function') return '[fn]';
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
    return v;
}

vi.mock('./regionActions.js', async (importOriginal) => {
    const real = await importOriginal();
    const push = (channel, name, args) => rec.log.push({ channel, name, args: norm(args) });
    return {
        ...real,
        planOneStepMove: (h, target, opts) => {
            push('read', 'planOneStepMove', [target, opts]);
            return { ok: true, kind: 'move', from: 'Here', path: { steps: ['Here', target], length: 1, nextExit: 'e1' },
                move: { sourceRegion: 'Here', targetRegion: target, exitName: `one:${target}` } };
        },
        planDirectMove: (h, target, opts) => {
            push('read', 'planDirectMove', [target, opts]);
            return { ok: true, kind: 'move', from: 'Here', path: { steps: ['Here', 'Pen', target], length: 2 },
                move: { sourceRegion: 'Pen', targetRegion: target, exitName: `direct:${target}` } };
        },
        publishRegionMove: (h, move, source) => { push('play', 'publishRegionMove', [move, source]); },
        addToPath: (h, target, opts) => {
            push('play', 'addToPath', [target, opts]);
            opts?.beforeExecute?.();
            return { ok: true, kind: 'path', from: 'End', dispatched: 1, regions: [target] };
        },
        overwritePath: (h, target, opts) => {
            push('play', 'overwritePath', [target, opts]);
            opts?.beforeExecute?.();
            return { ok: true, kind: 'path', from: 'Menu', dispatched: 1, regions: [target] };
        },
        locationChecksAllowed: (d) => { push('read', 'locationChecksAllowed', [d]); return real.locationChecksAllowed(d); },
        checkLocation: (h, a) => { push('play', 'checkLocation', [a]); return { ok: true }; },
        checkAccessibleLocationsInRegion: (h, region, o) => {
            push('play', 'checkAccessibleLocationsInRegion', [region, o]);
            return { ok: true, checked: 1 };
        },
        addLocationCheckToPath: (h, loc, region) => { push('play', 'addLocationCheckToPath', [loc, region]); return { ok: true }; },
        showRegionInRegionsPanel: (h, region) => { push('regions', 'showRegionInRegionsPanel', [region]); },
        publishNodeSelected: (h, ev, region, data) => { push('select', 'publishNodeSelected', [ev, region, data]); },
    };
});

const staticData = { regions: new Map([
    ['Field', { locations: [{ name: 'chest' }, { name: 'locked', access_rule: { ok: false } }] }],
    ['Empty', { locations: [] }],
]) };
const snapshot = { checkedLocations: [] };
const sm = vi.hoisted(() => ({ value: null }));
vi.mock('../stateManager/index.js', () => ({ stateManagerProxySingleton: {
    getStaticData: () => sm.value.staticData,
    getLatestStateSnapshot: () => sm.value.snapshot,
    getStartRegions: () => ['Menu'],
}, getLastRawJsonData: () => null }));
sm.value = { staticData, snapshot };

const bus = { publish: vi.fn() };
vi.mock('../regionGraph/index.js', () => ({
    moduleDispatcher: { id: 'regionGraph', publish: vi.fn() },
    getModuleEventBus: () => bus,
    getNodeLabelProvider: () => null,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => ({ tag: 'gameState' }) }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../../app/core/centralRegistry.js', () => ({ centralRegistry: { getPublicFunction: () => null } }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: {
    getSetting: async (k, d) => (k === 'moduleSettings.regionGraph.addLocationsToPath' ? rec.bits.addLocationsToPath : d),
    updateSetting: () => {},
} }));

const { GraphInteractionManager } = await import('../regionGraph/graphInteractionManager.js');
const { NavigationManager } = await import('../regionGraph/navigationManager.js');
const { REGION_GRAPH_SOURCES, REGION_GRAPH_ORIGINATORS } = await import('../regionGraph/regionGraphOriginators.js');
const actions = await import('./regionActions.js');
const CA = await import('./clickActions.js');

const KEYS = Object.keys(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS);
const NEW_SOURCE = CA.pathSourceFor('regionGraph');
const OLD_SOURCES = new Set(Object.values(REGION_GRAPH_SOURCES));

/** The Regions panel's Show All box: `navigationManager.setShowAllRegions` changes (and fires) only on a change. */
function setShowAll(enabled) {
    if (rec.showAll !== enabled) {
        rec.showAll = enabled;
        rec.log.push({ channel: 'regions', name: 'showAll', args: [enabled] });
    }
}

const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); };

function combos() {
    const out = [];
    for (let m = 0; m < 1 << KEYS.length; m++) out.push(Object.fromEntries(KEYS.map((k, i) => [k, !!(m & (1 << i))])));
    return out;
}

/**
 * Today: drive the real handler.
 *
 * ⚠ VITEST ARTEFACT, worked around: two `import()`s in flight at once inside a test resolve only once (measured: the
 * second never settles; `regionGraph/regionGraphDispatch.test.js` notes the same). The handler issues one per move
 * (`navigationManager.js` `attemptMovePlayer…` / `addToPath` / `overwritePath`) plus its own for a check, so a click with
 * two of them would lose one. So the handler runs with `ui`'s navigation methods as RECORDERS, its own async
 * work settles alone, and then each recorded navigation call is REPLAYED on a real `NavigationManager`, one at a time.
 * The log is put back in the browser's order: the handler's synchronous part, then the navigation calls' effects (their
 * imports were issued first), then the handler's own async checks (`checkAllLocationsInRegion`,
 * `dispatchLocationCheckEvent`, the path check), which were issued after them.
 */
async function measureToday(target, bits, { region, discovery, showAll }) {
    rec.log = []; rec.bits = bits; rec.showAll = showAll;
    const navCalls = [];
    const ui = {
        pathFinder: {}, updateStatus: () => {},
        cy: { $: () => ({ removeClass: () => {} }) },
        isDiscoveryModeActive: discovery.active, discoverySettings: discovery.settings,
        controlPanel: { querySelector: (sel) => ({ checked: !!bits[sel.slice(1)] }) },
        setShowAllRegions: setShowAll,
        addToPath: (...a) => { navCalls.push(['addToPath', a]); },
        overwritePath: (...a) => { navCalls.push(['overwritePath', a]); },
        attemptMovePlayerOneStepToRegion: (...a) => { navCalls.push(['attemptMovePlayerOneStepToRegion', a]); },
        attemptMovePlayerDirectlyToRegion: (...a) => { navCalls.push(['attemptMovePlayerDirectlyToRegion', a]); },
    };
    const im = new GraphInteractionManager(ui);
    if (target === 'region') {
        im.handleRegionNodeClick({ id: () => region, data: () => ({ id: region }), addClass: () => {} });
    } else {
        const d = { locationName: 'chest', parentRegion: region, label: 'chest' };
        im.handleLocationNodeClick({ data: (k) => d[k] });
    }
    const syncPart = rec.log;
    rec.log = [];
    // The location handler reads addLocationsToPath through a promise, so ITS navigation calls are async too: they are
    // issued (in the handler's order) before its path-check import, so they still come first.
    await flush();
    const handlerAsync = rec.log;
    const replayed = [];
    for (const [name, args] of navCalls) {
        rec.log = [];
        const nav = new NavigationManager(ui);
        nav.setShowAllRegions = setShowAll;
        await nav[name](...args);
        await flush();
        replayed.push(...rec.log);
    }
    rec.log = [...syncPart, ...replayed, ...handlerAsync];
    return rec.log;
}

/** The stand-in for the Regions panel's own action (CA-S4): today's showRegionInPanel branch. */
const STAND_IN_REGIONS_OPEN = {
    id: CA.REGIONS_OPEN_ID, owner: 'regions', label: 'Open in the Regions panel', target: 'region', kind: 'toggle',
    run: (h, ctx) => {
        const route = ctx.settings.region[CA.BUILT_IN_IDS.route];
        h.setShowAllRegions(!(route && (route.from === 'pathEnd' || route.from === 'start')));
        actions.showRegionInRegionsPanel(h, ctx.regionName);
        return { ok: true };
    },
};

/** New: the migrated config through runClickActions. */
function measureNew(target, bits, { region, discovery, showAll }) {
    rec.log = []; rec.showAll = showAll;
    const h = {
        stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => snapshot },
        originators: REGION_GRAPH_ORIGINATORS,
        beforePathExecute: () => setShowAll(false),
        onError: () => {},
        setShowAllRegions: setShowAll,
    };
    const ctx = target === 'region' ? { regionName: region, discovery } : { regionName: region, locationName: 'chest', discovery };
    const settings = CA.migrateRegionGraphClickKeys(bits);
    const r = CA.runClickActions('regionGraph', target, ctx, settings, h);
    return { log: rec.log, result: r };
}

/** Swap today's path sources for the new one, counting the swaps (the expected delta). */
function swapSources(log) {
    let swapped = 0;
    const out = log.map((e) => {
        const s = JSON.stringify(e.args);
        let t = s;
        for (const old of OLD_SOURCES) {
            const n = t.split(`"${old}"`).length - 1;
            if (n) { swapped += n; t = t.split(`"${old}"`).join(`"${NEW_SOURCE}"`); }
        }
        return t === s ? e : { ...e, args: JSON.parse(t) };
    });
    return { out, swapped };
}

const channel = (log, c) => log.filter((e) => e.channel === c).map((e) => [e.name, e.args]);
const multiset = (log) => log.filter((e) => e.channel !== 'select').map((e) => JSON.stringify([e.name, e.args])).sort();
const crossOrder = (log) => log.filter((e) => e.channel === 'play' || e.channel === 'regions').map((e) => e.name);

const DISCOVERY = {
    allowed: { active: false, settings: {} },
    blocked: { active: true, settings: { disableLocationCheckUI: true } },
};

const summary = { rows: 0, swappedSources: 0, crossOrderDiffers: 0, nonEmptyPlay: 0, newSourceSeen: 0 };

beforeAll(() => {
    CA.resetClickActionsForTests();
    CA.registerClickAction(STAND_IN_REGIONS_OPEN);
});
afterAll(() => {
    CA.resetClickActionsForTests();
    // The table's summary, for the report (stdout of the vitest run).
    console.log(`[CA-S1 equivalence] ${JSON.stringify(summary)}`);
});

const SCENARIOS = [];
for (const target of ['region', 'location']) {
    for (const region of target === 'region' ? ['Field', 'Empty'] : ['Field']) {
        for (const disc of Object.keys(DISCOVERY)) {
            for (const showAll of [true, false]) SCENARIOS.push({ target, region, disc, showAll });
        }
    }
}

describe('⛓ 128 combinations × {region, location}: migrated config ≡ today\'s Region Graph handlers', () => {
    it('the seven keys and defaults are regionGraph/layoutControlsManager.js\'s (the source of the 2^7 table)', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('../regionGraph/layoutControlsManager.js', import.meta.url), 'utf8');
        const rg = {};
        for (const m of src.matchAll(/setting: 'moduleSettings\.regionGraph\.(\w+)', default: (true|false)/g)) rg[m[1]] = m[2] === 'true';
        expect(Object.fromEntries(KEYS.map((k) => [k, rg[k]]))).toEqual({ ...CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS });
        expect(KEYS).toHaveLength(7);
    });

    for (const sc of SCENARIOS) {
        const name = `${sc.target} click on ${sc.region}, discovery ${sc.disc}, Show All starts ${sc.showAll}`;
        it(`${name}: all 128 combinations`, async () => {
            const opts = { region: sc.region, discovery: DISCOVERY[sc.disc], showAll: sc.showAll };
            for (const bits of combos()) {
                const today = await measureToday(sc.target, bits, opts);
                const { log: next } = measureNew(sc.target, bits, opts);
                const { out: todaySwapped, swapped } = swapSources(today);
                const label = `${name} ${JSON.stringify(bits)}`;
                expect(channel(next, 'play'), `play channel: ${label}`).toEqual(channel(todaySwapped, 'play'));
                expect(channel(next, 'regions'), `regions channel: ${label}`).toEqual(channel(todaySwapped, 'regions'));
                expect(multiset(next), `all calls: ${label}`).toEqual(multiset(todaySwapped));
                // The delta is exactly the source: no new-source string was in today's log before the swap.
                expect(JSON.stringify(today)).not.toContain(NEW_SOURCE);
                summary.rows++;
                summary.swappedSources += swapped;
                if (channel(next, 'play').length) summary.nonEmptyPlay++;
                if (JSON.stringify(next).includes(NEW_SOURCE)) summary.newSourceSeen++;
                if (JSON.stringify(crossOrder(next)) !== JSON.stringify(crossOrder(todaySwapped))) summary.crossOrderDiffers++;
            }
        }, 60_000); // 128 handler drives with timer flushes: well over vitest's 5 s default under load
    }

    it('the table really exercised the handlers (not a vacuous equality)', () => {
        // 128 × (region: 2 regions × 2 discovery × 2 Show All; location: 2 × 2) = 1536 rows.
        expect(summary.rows).toBe(128 * 12);
        expect(summary.nonEmptyPlay).toBeGreaterThan(1000);
        expect(summary.swappedSources).toBeGreaterThan(0);
        expect(summary.newSourceSeen).toBeGreaterThan(0);
    });
});
