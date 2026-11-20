/**
 * ⛓ CA-S3 EQUIVALENCE (CA-S1's measured method) — the Region Map's ADOPTED click path (`RegionMapUI.clickAt` →
 * `runRegionMapClick` → `runClickActions` over the Map's FIRST-RUN COPY of the Region Graph's resolved config) makes
 * the SAME `regionActions` calls as step 4's interim reader at base (`regionMapClicks.js` `onRegionClick` /
 * `onLocationClick` over the seven `moduleSettings.regionGraph.*` keys), for every combination of the seven keys with
 * `movePlayerOneStep` FORCED FALSE (⚖ user, 2026-11-17T23:00:54Z: "move player one step" is removed).
 *
 * METHOD: MEASURED, not transcribed.
 *   - BEFORE = `legacyRegionMapClicks.testkit.js` (base 3a1909b2dc's `regionMapClicks.js`, verbatim): `readClickOptions`
 *     over a settings manager holding the keys, then `onRegionClick` / `onLocationClick`, with the base's status callback.
 *   - AFTER = the REAL `RegionMapUI.prototype.clickAt` (and `_handles`) on a stand-in panel whose `clickActions` is
 *     what `loadRegionMapClickActions` returns over THE SAME settings (no Map value, no Graph `clickActions` stored:
 *     the Graph's migration path, case 2 of the first-run rule). So the table also proves that R4's copy is exact.
 *     The REAL `regions.open` (`regions/regionsClickActions.js`) is registered.
 *   - `regionActions.js` is replaced by one recorder shared by both sides. No expected list is written by hand.
 *
 * COMPARED, per row: the `play` channel IN ORDER (moves, path edits, the locations a check or bulk check dispatches),
 * the `regions` channel IN ORDER (`showRegionInRegionsPanel` and every CHANGE of "Show All Regions"), the `select`
 * channel (`regionMap:nodeSelected`), the multiset of ALL calls (the read-only ones too), and the status text.
 *
 * THE NAMED DELTAS, counted:
 *   1. `source` — a path move carries `regionView-path-regionMap` (R7) where the base carried a `regionMap-*` source.
 *   2. the R8 interleaving BETWEEN the channels (base: moves, Regions panel, bulk check; now: path, checks, panel
 *      actions) — not compared, counted.
 *   3. the generic event (design §4.3) — every AFTER click publishes `regionView:regionClicked` /
 *      `regionView:locationClicked` once; the base published none. Asserted, counted, and excluded from the compare.
 * NORMALISED (the same behaviour, a different call shape — named in the report):
 *   - the bulk check is compared by the locations it DISPATCHES (base passed `{ originator }` and let the action read
 *     the latest state; the registry reads the same state first, and skips a region with no locations);
 *   - `planDirectMove` is compared by its target (the registry passes an `onError` the base did not);
 *   - a path edit's options are compared as `{ source, beforeExecute }` (`moveOnlyOneStep` left `regionActions` in CA-S3;
 *     the base passed it `false`).
 * Any other difference fails the row.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const rec = vi.hoisted(() => ({ log: [], showAll: true }));

function norm(v) {
    if (typeof v === 'function') return '[fn]';
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
    return v;
}

vi.mock('../regionView/regionActions.js', async (importOriginal) => {
    const real = await importOriginal();
    const push = (channel, name, args) => rec.log.push({ channel, name, args: norm(args) });
    const pathOpts = (o) => ({ source: o?.source, beforeExecute: o?.beforeExecute ? '[fn]' : null,
        ...(o?.moveOnlyOneStep ? { moveOnlyOneStep: true } : {}) });
    return {
        ...real,
        planOneStepMove: (h, target) => {
            push('read', 'planOneStepMove', [target]);
            return { ok: true, kind: 'move', from: 'Here', path: { steps: ['Here', target], length: 1, nextExit: 'e1' },
                move: { sourceRegion: 'Here', targetRegion: target, exitName: `one:${target}` } };
        },
        moveOneStep: () => { throw new Error('moveOneStep: never reached with movePlayerOneStep forced false'); },
        planDirectMove: (h, target) => {
            push('read', 'planDirectMove', [target]);
            return { ok: true, kind: 'move', from: 'Here', path: { steps: ['Here', 'Pen', target], length: 2 },
                move: { sourceRegion: 'Pen', targetRegion: target, exitName: `direct:${target}` } };
        },
        // The base's `moveDirectly` = plan + publish (`regionActions.js`), over the recorders above.
        moveDirectly: (h, target, source) => {
            push('read', 'planDirectMove', [target]);
            const move = { sourceRegion: 'Pen', targetRegion: target, exitName: `direct:${target}` };
            push('play', 'publishRegionMove', [move, source]);
            return { ok: true, kind: 'move', from: 'Here', path: { steps: ['Here', 'Pen', target], length: 2 }, move };
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
        // By what it dispatches: the real candidate list, one entry per location it would check.
        checkAccessibleLocationsInRegion: (h, region, o) => {
            const names = real.bulkCheckCandidates(h, region, { snapshot: o?.snapshot ?? null, staticData: o?.staticData ?? null });
            for (const locationName of names) push('play', 'bulkCheck', [{ locationName, regionName: region, originator: o?.originator }]);
            return { ok: true, checked: names.length };
        },
        addLocationCheckToPath: (h, loc, region) => { push('play', 'addLocationCheckToPath', [loc, region]); return { ok: true }; },
        showRegionInRegionsPanel: (h, region) => { push('regions', 'showRegionInRegionsPanel', [region]); },
        publishNodeSelected: (h, ev, region, data) => { push('select', 'publishNodeSelected', [ev, region, data]); },
    };
});

const disc = vi.hoisted(() => ({ value: { enableDiscoveryMode: false } }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: {
    getSetting: async (k, d) => {
        const m = /^moduleSettings\.discovery\.(.+)$/.exec(k);
        return m && m[1] in disc.value ? disc.value[m[1]] : d;
    },
    updateSetting: async () => true,
    hasStoredSetting: async () => false,
} }));

const { stateManagerProxySingleton } = await import('../stateManager/index.js');
const staticData = { regions: new Map([
    ['Field', { locations: [{ name: 'chest' }, { name: 'locked', access_rule: { type: 'constant', value: false } }] }],
    ['Empty', { locations: [] }],
]) };
vi.spyOn(stateManagerProxySingleton, 'getStaticData').mockImplementation(() => staticData);
vi.spyOn(stateManagerProxySingleton, 'getLatestStateSnapshot').mockImplementation(() => ({ checkedLocations: [] }));

const { RegionMapUI } = await import('./regionMapUI.js');
const { moduleHandles } = await import('./regionMapSettings.js');
const { loadRegionMapClickActions, REGION_CLICKED, LOCATION_CLICKED } = await import('./regionMapClickActions.js');
const legacy = await import('./legacyRegionMapClicks.testkit.js');
const { REGIONS_OPEN_ACTION } = await import('../regions/regionsClickActions.js');
const CA = await import('../regionView/clickActions.js');
const { readDiscoverySettings } = await import('../regionView/regionViewState.js');
const settingsManager = (await import('../../app/core/settingsManager.js')).default;

const KEYS = Object.keys(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS);
const OTHER_KEYS = KEYS.filter((k) => k !== 'movePlayerOneStep');
const NEW_SOURCE = CA.pathSourceFor('regionMap');
const OLD_SOURCES = new Set(Object.values(legacy.REGION_MAP_SOURCES));

/** The Regions panel's Show All box: both sides change (and fire) it only on a change. */
const showAllBox = {
    get checked() { return rec.showAll; },
    set checked(v) {
        if (rec.showAll !== v) { rec.showAll = v; rec.log.push({ channel: 'regions', name: 'showAll', args: [v] }); }
    },
    dispatchEvent: () => true,
};
globalThis.document = { querySelector: (sel) => (sel === '#show-all-regions' ? showAllBox : null) };

/** A settings manager holding `regionGraph` keys only (stored values; nothing else stored). */
function fakeSettings(regionGraph) {
    const tree = { moduleSettings: { regionGraph: { ...regionGraph } } };
    const writes = [];
    const lookup = (key) => {
        let cur = tree;
        for (const k of key.split('.')) {
            if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
            else return { found: false };
        }
        return { found: true, value: cur };
    };
    return {
        writes, tree,
        async hasStoredSetting(key) { return lookup(key).found; },
        async getSetting(key, dflt) { const l = lookup(key); return l.found ? l.value : dflt; },
        async updateSetting(key, value) {
            writes.push(key);
            const ks = key.split('.');
            let cur = tree;
            for (const k of ks.slice(0, -1)) cur = (cur[k] ??= {});
            cur[ks.at(-1)] = value;
        },
    };
}

const bus = { events: [], publish(ev, data) { this.events.push([ev, data]); } };
moduleHandles.dispatcher = { publish: () => { throw new Error('the recorder replaces every dispatch'); } };
moduleHandles.eventBus = bus;

/** A stand-in panel: the real `clickAt` / `_handles` run on it. One cell per region, no sub-regions. */
function standIn(clickActions) {
    const statuses = [];
    const ui = {
        clickActions, clickCount: 0, lastClick: null, statuses,
        view: { get: () => ({ displayGroups: new Map([['Field', { members: ['Field'] }], ['Empty', { members: ['Empty'] }]]),
            locations: new Map([['chest', { region: 'Field' }]]) }) },
        model: null,
        pathFinder: { tag: 'pathFinder' },
        _rulesOf: () => null,
        _flashStatus: (text) => statuses.push(text),
    };
    ui._handles = RegionMapUI.prototype._handles.bind(ui);
    return ui;
}

async function measureBefore(target, bits, { region, discovery, showAll }) {
    // The base's `clickAt`: the toggles and the discovery settings, read at click time.
    disc.value = { enableDiscoveryMode: discovery.active, ...discovery.settings };
    const opts = await legacy.readClickOptions(fakeSettings(bits));
    discovery = await readDiscoverySettings(settingsManager);
    rec.log = []; rec.showAll = showAll;
    const statuses = [];
    const h = standIn(null)._handles();
    if (target === 'region') {
        legacy.onRegionClick(h, region, opts, discovery, { onStatus: (s) => statuses.push(s), data: { id: region, displayKey: region } });
    } else {
        legacy.onLocationClick(h, { locationName: 'chest', regionName: region }, opts, discovery, { onStatus: (s) => statuses.push(s) });
    }
    return { log: rec.log, statuses };
}

async function measureAfter(target, bits, { region, discovery, showAll }) {
    const sm = fakeSettings(bits);
    const loaded = await loadRegionMapClickActions(sm);
    rec.log = []; rec.showAll = showAll; bus.events = [];
    disc.value = { enableDiscoveryMode: discovery.active, ...discovery.settings };
    const ui = standIn(loaded.clickActions);
    const click = await RegionMapUI.prototype.clickAt.call(ui, { key: region }, target === 'location' ? { location: 'chest' } : null);
    return { log: rec.log, statuses: ui.statuses, events: bus.events, loaded, sm, click };
}

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

const summary = { rows: 0, swappedSources: 0, crossOrderDiffers: 0, nonEmptyPlay: 0, newSourceSeen: 0, genericEvents: 0,
    statusRows: 0, regionsOpened: 0, graphMigratedOnCopy: 0, rowsWithOldSource: 0 };

beforeAll(() => {
    CA.resetClickActionsForTests();
    CA.registerClickAction(REGIONS_OPEN_ACTION);
});
afterAll(() => {
    CA.resetClickActionsForTests();
    console.log(`[CA-S3 equivalence] ${JSON.stringify(summary)}`);
});

const SCENARIOS = [];
for (const target of ['region', 'location']) {
    for (const region of target === 'region' ? ['Field', 'Empty'] : ['Field']) {
        for (const d of Object.keys(DISCOVERY)) {
            for (const showAll of [true, false]) SCENARIOS.push({ target, region, disc: d, showAll });
        }
    }
}

function combos(oneStep) {
    const out = [];
    for (let m = 0; m < 1 << OTHER_KEYS.length; m++) {
        out.push({ movePlayerOneStep: oneStep, ...Object.fromEntries(OTHER_KEYS.map((k, i) => [k, !!(m & (1 << i))])) });
    }
    return out;
}

describe(`⛓ 2^${OTHER_KEYS.length} combinations (movePlayerOneStep forced false) × the Map's click scenarios: adopted ≡ base`, () => {
    it('the base reader read the same seven keys and defaults the migration does (the oracle is the right one)', () => {
        expect(JSON.stringify(legacy.CLICK_OPTION_DEFAULTS)).toBe(JSON.stringify(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS));
        expect(legacy.CLICK_OPTIONS_PREFIX).toBe('moduleSettings.regionGraph');
    });

    for (const sc of SCENARIOS) {
        const name = `${sc.target} click on ${sc.region}, discovery ${sc.disc}, Show All starts ${sc.showAll}`;
        it(`${name}: all ${1 << OTHER_KEYS.length} combinations`, async () => {
            const opts = { region: sc.region, discovery: DISCOVERY[sc.disc], showAll: sc.showAll };
            for (const bits of combos(false)) {
                const before = await measureBefore(sc.target, bits, opts);
                const after = await measureAfter(sc.target, bits, opts);
                const label = `${name} ${JSON.stringify(bits)}`;
                // R4's copy: the Graph's resolved config (here: its migration of these keys), saved once as the Map's.
                expect(after.loaded.clickActions, `copy: ${label}`).toEqual(CA.migrateRegionGraphClickKeys(bits));
                expect(after.loaded.copied).toBe(true);
                expect(after.sm.writes).toEqual(['moduleSettings.regionGraph.clickActions', 'moduleSettings.regionMap.clickActions']);
                const { out: beforeSwapped, swapped } = swapSources(before.log);
                expect(channel(after.log, 'play'), `play channel: ${label}`).toEqual(channel(beforeSwapped, 'play'));
                expect(channel(after.log, 'regions'), `regions channel: ${label}`).toEqual(channel(beforeSwapped, 'regions'));
                expect(channel(after.log, 'select'), `select channel: ${label}`).toEqual(channel(beforeSwapped, 'select'));
                expect(multiset(after.log), `all calls: ${label}`).toEqual(multiset(beforeSwapped));
                expect(after.statuses, `status: ${label}`).toEqual(before.statuses);
                expect(JSON.stringify(before.log)).not.toContain(NEW_SOURCE);
                // Named delta 3: exactly one generic event, with its payload.
                const want = sc.target === 'region'
                    ? [[REGION_CLICKED, { panelId: 'regionMap', regionName: sc.region }]]
                    : [[LOCATION_CLICKED, { panelId: 'regionMap', regionName: sc.region, locationName: 'chest' }]];
                expect(after.events, `generic event: ${label}`).toEqual(want);
                expect(after.click.target).toBe(sc.target);
                summary.rows++;
                summary.genericEvents += after.events.length;
                summary.swappedSources += swapped;
                if (swapped) summary.rowsWithOldSource++;
                if (before.statuses.length) summary.statusRows++;
                if (channel(after.log, 'play').length) summary.nonEmptyPlay++;
                if (channel(after.log, 'regions').some(([n]) => n === 'showRegionInRegionsPanel')) summary.regionsOpened++;
                if (after.loaded.graphMigrated) summary.graphMigratedOnCopy++;
                if (JSON.stringify(after.log).includes(NEW_SOURCE)) summary.newSourceSeen++;
                if (JSON.stringify(crossOrder(after.log)) !== JSON.stringify(crossOrder(beforeSwapped))) summary.crossOrderDiffers++;
            }
        }, 60_000);
    }

    it('the table really exercised the handlers (not a vacuous equality)', () => {
        expect(summary.rows).toBe((1 << OTHER_KEYS.length) * SCENARIOS.length);
        expect(summary.genericEvents).toBe(summary.rows);
        expect(summary.graphMigratedOnCopy).toBe(summary.rows);
        expect(summary.nonEmptyPlay).toBeGreaterThan(summary.rows / 2);
        expect(summary.swappedSources).toBeGreaterThan(0);
        expect(summary.newSourceSeen).toBe(summary.rowsWithOldSource);
        expect(summary.regionsOpened).toBeGreaterThan(0);
        expect(summary.statusRows).toBeGreaterThan(0);
    });
});
