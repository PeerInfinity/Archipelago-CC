/**
 * ⛓ CA-S2 EQUIVALENCE (re-run of CA-S1's measured method) — the Region Graph's ADOPTED click handlers
 * (`runClickActions` over `moduleSettings.regionGraph.clickActions`) make the SAME `regionActions` calls as its
 * handlers BEFORE CA-S2, for every combination of the seven old keys with `movePlayerOneStep` FORCED FALSE
 * (⚖ user, 2026-11-17T23:00:54Z: "move player one step" is removed). The combinations WITH it true are measured too,
 * and classified: they are the user-visible change of the removal (the report's table).
 *
 * METHOD: MEASURED, not transcribed. BEFORE = `legacyRegionGraphClicks.testkit.js`, the base's handler and navigation
 * methods kept VERBATIM (base 41561f80944b, extracted with `git show`), driven with `{ checked }` checkbox stubs and a
 * stubbed `settingsManager` for `addLocationsToPath`, exactly as CA-S1 drove them. AFTER = the REAL
 * `GraphInteractionManager.handleRegionNodeClick` / `handleLocationNodeClick` over a REAL `NavigationManager`, with
 * `ui.clickActions = migrateRegionGraphClickKeys(bits)`, and the REAL `regions.open` (`regions/regionsClickActions.js`).
 * `regionActions.js` is replaced by a recorder shared by both sides. No expected list is written by hand.
 *
 * COMPARED, per combination: the `play` channel IN ORDER (moves, path edits, checks), the `regions` channel IN ORDER
 * (`showRegionInRegionsPanel` and every CHANGE of "Show All Regions"), the `select` channel (`regionGraph:nodeSelected`,
 * published before any action), and the multiset of ALL calls (the read-only ones too).
 *
 * THE NAMED DELTAS, counted:
 *   1. `source` — a path move carries `regionView-path-regionGraph` (R7) where the base carried a `regionGraph-*`
 *      source. Each row swaps the base's strings for it (and asserts the new string was not in the base's log).
 *   2. the R8 interleaving BETWEEN the channels (the base's was set by its dynamic imports) — not compared, counted.
 *   With `movePlayerOneStep` false there is NO third kind: any other difference fails the row.
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
    // CA-S3: `moveOnlyOneStep` left `regionActions` (the base passed it `false`; the click actions pass nothing). A
    // `false` is dropped on both sides; a `true` (the base's one-step rows) is kept, so `classify` still sees it.
    const pathOpts = (o) => {
        if (!o || o.moveOnlyOneStep !== false) return o;
        const { moveOnlyOneStep, ...rest } = o;
        return rest;
    };
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
            push('play', 'addToPath', [target, pathOpts(opts)]);
            opts?.beforeExecute?.();
            return { ok: true, kind: 'path', from: 'End', dispatched: 1, regions: [target] };
        },
        overwritePath: (h, target, opts) => {
            push('play', 'overwritePath', [target, pathOpts(opts)]);
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
const { LegacyGraphInteraction, LegacyNavigation, REGION_GRAPH_SOURCES } = await import('./legacyRegionGraphClicks.testkit.js');
const { REGIONS_OPEN_ACTION } = await import('../regions/regionsClickActions.js');
const CA = await import('./clickActions.js');

const KEYS = Object.keys(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS);
const OTHER_KEYS = KEYS.filter((k) => k !== 'movePlayerOneStep');
const NEW_SOURCE = CA.pathSourceFor('regionGraph');
const OLD_SOURCES = new Set(Object.values(REGION_GRAPH_SOURCES));

/** The Regions panel's Show All box: both sides change (and fire) it only on a change. */
function setShowAll(enabled) {
    if (rec.showAll !== enabled) {
        rec.showAll = enabled;
        rec.log.push({ channel: 'regions', name: 'showAll', args: [enabled] });
    }
}
/** The page's `#show-all-regions`, for the code that reads the DOM (`navigationManager.setShowAllRegions`, `regions.open`). */
const showAllBox = {
    get checked() { return rec.showAll; },
    set checked(v) { setShowAll(v); },
    dispatchEvent: () => true,
};
globalThis.document = { querySelector: (sel) => (sel === '#show-all-regions' ? showAllBox : null) };

const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); };

/** Every combination of the six keys other than movePlayerOneStep, with movePlayerOneStep = `oneStep`. */
function combos(oneStep) {
    const out = [];
    for (let m = 0; m < 1 << OTHER_KEYS.length; m++) {
        out.push({ movePlayerOneStep: oneStep, ...Object.fromEntries(OTHER_KEYS.map((k, i) => [k, !!(m & (1 << i))])) });
    }
    return out;
}

/**
 * BEFORE: drive the base's handler (CA-S1's method). ⚠ The vitest artefact CA-S1 recorded still applies (two
 * `import()`s in flight at once resolve once), so the handler runs with `ui`'s navigation methods as RECORDERS, its own
 * async work settles alone, and each recorded navigation call is REPLAYED on the base's navigation methods, one at a
 * time; the log is put back in the browser's order (sync part, navigation effects, the handler's own async checks).
 */
async function measureBefore(target, bits, { region, discovery, showAll }) {
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
    const im = new LegacyGraphInteraction(ui, bus);
    if (target === 'region') {
        im.handleRegionNodeClick({ id: () => region, data: () => ({ id: region }), addClass: () => {} });
    } else {
        const d = { locationName: 'chest', parentRegion: region, label: 'chest' };
        im.handleLocationNodeClick({ data: (k) => d[k] });
    }
    const syncPart = rec.log;
    rec.log = [];
    await flush();
    const handlerAsync = rec.log;
    const replayed = [];
    for (const [name, args] of navCalls) {
        rec.log = [];
        await new LegacyNavigation(ui)[name](...args);
        await flush();
        replayed.push(...rec.log);
    }
    rec.log = [...syncPart, ...replayed, ...handlerAsync];
    return rec.log;
}

/** AFTER: the adopted handler, with the migrated settings. Synchronous (no dynamic import left in the click path). */
function measureAfter(target, bits, { region, discovery, showAll }) {
    rec.log = []; rec.showAll = showAll;
    const ui = {
        pathFinder: {}, updateStatus: () => {},
        cy: { $: () => ({ removeClass: () => {} }), nodes: () => [], edges: () => [] },
        isDiscoveryModeActive: discovery.active, discoverySettings: discovery.settings,
        clickActions: CA.migrateRegionGraphClickKeys(bits),
    };
    ui.navigationManager = new NavigationManager(ui);
    const im = new GraphInteractionManager(ui);
    const result = target === 'region'
        ? im.handleRegionNodeClick({ id: () => region, data: () => ({ id: region }), addClass: () => {} })
        : im.handleLocationNodeClick({ data: (k) => ({ locationName: 'chest', parentRegion: region, label: 'chest' })[k] });
    return { log: rec.log, result };
}

/** Swap the base's path sources for the new one, counting the swaps (named delta 1). */
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
const multiset = (log) => log.map((e) => JSON.stringify([e.name, e.args])).sort();
const crossOrder = (log) => log.filter((e) => e.channel === 'play' || e.channel === 'regions').map((e) => e.name);

const DISCOVERY = {
    allowed: { active: false, settings: {} },
    blocked: { active: true, settings: { disableLocationCheckUI: true } },
};

const summary = { rows: 0, swappedSources: 0, crossOrderDiffers: 0, nonEmptyPlay: 0, newSourceSeen: 0 };
/** The movePlayerOneStep=true rows, classified (the user-visible change). */
const oneStep = { rows: 0, same: 0, classes: {}, table: {} };

beforeAll(() => {
    CA.resetClickActionsForTests();
    CA.registerClickAction(REGIONS_OPEN_ACTION);
});
afterAll(() => {
    CA.resetClickActionsForTests();
    console.log(`[CA-S2 equivalence] ${JSON.stringify(summary)}`);
    console.log(`[CA-S2 one-step=true] ${JSON.stringify({ rows: oneStep.rows, same: oneStep.same, classes: oneStep.classes })}`);
    console.log(`[CA-S2 one-step table] ${JSON.stringify(oneStep.table)}`);
});

const SCENARIOS = [];
for (const target of ['region', 'location']) {
    for (const region of target === 'region' ? ['Field', 'Empty'] : ['Field']) {
        for (const disc of Object.keys(DISCOVERY)) {
            for (const showAll of [true, false]) SCENARIOS.push({ target, region, disc, showAll });
        }
    }
}

/** A compact, comparable view of a play channel: name + the move's target / one-step flag / source kind. */
function playShape(log) {
    return channel(log, 'play').map(([name, args]) => {
        if (name === 'addToPath' || name === 'overwritePath') return `${name}${args[1]?.moveOnlyOneStep ? '(one step)' : ''}`;
        if (name === 'publishRegionMove') return `move(${String(args[0]?.exitName ?? '').split(':')[0]})`;
        return name;
    });
}

/**
 * Classify a movePlayerOneStep=true row: what the base did that the adopted handler no longer does.
 *   path-edit-one-step→all   a path edit walked ONE step; it now walks the whole path;
 *   one-step-move→none       "one step" alone made a one-step move; the route is now off;
 *   one-step+direct→direct   both move boxes made a one-step AND a direct move; now the direct move only;
 *   unchanged                 the row's play channel is the same (one-step had no effect there).
 */
function classify(before, after) {
    const b = playShape(before).join(' ');
    const a = playShape(after).join(' ');
    if (b === a) return 'unchanged';
    if (b.includes('(one step)') && b.replace(/\(one step\)/g, '') === a) return 'path-edit-one-step→all';
    if (b.includes('move(one)') && b.includes('move(direct)') && b.replace(/move\(one\) ?/g, '').trim() === a) return 'one-step+direct→direct';
    if (b.includes('move(one)') && b.replace(/move\(one\) ?/g, '').trim() === a) return 'one-step-move→none';
    return `UNEXPECTED: ${b} → ${a}`;
}

describe(`⛓ 2^${OTHER_KEYS.length} combinations (movePlayerOneStep forced false) × {region, location}: adopted handlers ≡ the base's`, () => {
    it('the base\'s seven keys and defaults are the migration\'s (the frozen oracle is the right one)', () => {
        expect(KEYS).toEqual(['movePlayerOneStep', 'movePlayerDirectly', 'showRegionInPanel', 'addToPath',
            'overwritePath', 'addLocationsToPath', 'checkAllLocationsInRegion']);
    });

    for (const sc of SCENARIOS) {
        const name = `${sc.target} click on ${sc.region}, discovery ${sc.disc}, Show All starts ${sc.showAll}`;
        it(`${name}: all ${1 << OTHER_KEYS.length} combinations`, async () => {
            const opts = { region: sc.region, discovery: DISCOVERY[sc.disc], showAll: sc.showAll };
            for (const bits of combos(false)) {
                const before = await measureBefore(sc.target, bits, opts);
                const { log: after } = measureAfter(sc.target, bits, opts);
                const { out: beforeSwapped, swapped } = swapSources(before);
                const label = `${name} ${JSON.stringify(bits)}`;
                expect(channel(after, 'play'), `play channel: ${label}`).toEqual(channel(beforeSwapped, 'play'));
                expect(channel(after, 'regions'), `regions channel: ${label}`).toEqual(channel(beforeSwapped, 'regions'));
                expect(channel(after, 'select'), `select channel: ${label}`).toEqual(channel(beforeSwapped, 'select'));
                expect(multiset(after), `all calls: ${label}`).toEqual(multiset(beforeSwapped));
                expect(JSON.stringify(before)).not.toContain(NEW_SOURCE);
                summary.rows++;
                summary.swappedSources += swapped;
                if (channel(after, 'play').length) summary.nonEmptyPlay++;
                if (JSON.stringify(after).includes(NEW_SOURCE)) summary.newSourceSeen++;
                if (JSON.stringify(crossOrder(after)) !== JSON.stringify(crossOrder(beforeSwapped))) summary.crossOrderDiffers++;
            }
        }, 60_000);
    }

    it('the table really exercised the handlers (not a vacuous equality)', () => {
        expect(summary.rows).toBe((1 << OTHER_KEYS.length) * SCENARIOS.length);
        expect(summary.nonEmptyPlay).toBeGreaterThan(summary.rows / 2);
        expect(summary.swappedSources).toBeGreaterThan(0);
        expect(summary.newSourceSeen).toBeGreaterThan(0);
    });
});

describe(`⛓ movePlayerOneStep = true: what each of the 2^${OTHER_KEYS.length} combinations now does (the removal's user-visible change)`, () => {
    it('every row is unchanged or one of the named changes (classify), and the adopted side equals one-step=false\'s', async () => {
        const opts = { region: 'Field', discovery: DISCOVERY.allowed, showAll: true };
        for (const target of ['region', 'location']) {
            for (const bits of combos(true)) {
                const before = await measureBefore(target, bits, opts);
                const { log: after } = measureAfter(target, bits, opts);
                const { log: afterOff } = measureAfter(target, { ...bits, movePlayerOneStep: false }, opts);
                expect(multiset(after)).toEqual(multiset(afterOff));
                const cls = classify(swapSources(before).out, after);
                expect(cls, `${target} ${JSON.stringify(bits)}`).not.toMatch(/^UNEXPECTED/);
                oneStep.rows++;
                if (cls === 'unchanged') oneStep.same++;
                oneStep.classes[cls] = (oneStep.classes[cls] ?? 0) + 1;
                const key = `${target} ${OTHER_KEYS.filter((k) => bits[k]).join('+') || '(none)'}`;
                oneStep.table[key] = { cls, before: playShape(before).join(' ') || '—', after: playShape(after).join(' ') || '—' };
            }
        }
        expect(oneStep.rows).toBe(2 << OTHER_KEYS.length);
    }, 60_000);
});
