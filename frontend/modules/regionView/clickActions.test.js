/**
 * clickActions — the click-action registry, its settings model and the migration from the Region Graph's seven keys
 * (mode-toggle design §4, slice CA-S1). Real `regionActions` with recording handles. The 2^7 equivalence against
 * today's Region Graph handlers is `clickActions.equivalence.test.js`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));

const CA = await import('./clickActions.js');
const { BUILT_IN_IDS: ID, ORDER } = CA;

const staticData = { regions: new Map([
    ['Menu', { locations: [], exits: [{ name: 'Go', connected_region: 'Field' }] }],
    ['Field', { locations: [{ name: 'chest' }, { name: 'locked', access_rule: { ok: false } }] }],
]) };

/** Handles whose dispatcher, event bus and game state record every call, in one ordered log. */
function handles({ path = [], current = 'Menu' } = {}) {
    const log = [];
    const pathFinder = {
        stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({}) },
        findPath: (a, b) => ({ steps: [a, b], nextExit: 'Go', length: 1 }),
        findPathWithExits: (a, b) => ({ steps: [{ region: a }, { region: b, exitUsed: 'Go' }], length: 1 }),
        buildAccessibilityMap: () => ({}),
        findExitBetweenRegions: () => 'Go',
    };
    const h = {
        log,
        dispatcher: { publish: (ev, payload, target) => log.push(['dispatch', ev, payload, target]) },
        eventBus: { publish: (ev, payload) => log.push(['bus', ev, payload]) },
        stateManager: {
            getStaticData: () => staticData,
            getLatestStateSnapshot: () => ({ checkedLocations: [] }),
            getStartRegions: () => ['Menu'],
        },
        gameState: {
            getPath: () => path,
            getCurrentRegion: () => current,
            getLastRegionInPath: () => path.at(-1)?.region ?? null,
            setCurrentRegion: (r) => log.push(['gameState.setCurrentRegion', r]),
            trimPath: (r, n) => log.push(['gameState.trimPath', r, n]),
            addLocationCheck: (l, r) => log.push(['gameState.addLocationCheck', l, r]),
            updatePath: () => {},
        },
        pathFinder,
        originators: { check: 'testCheck', bulkCheck: 'testBulkCheck' },
    };
    return h;
}

const ALLOWED = { active: false, settings: {} };
const BLOCKED = { active: true, settings: { disableLocationCheckUI: true } };
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };

beforeEach(() => CA.resetClickActionsForTests());
afterAll(() => CA.resetClickActionsForTests());

describe('⛓ the registry', () => {
    it('registers the three built-ins at load, owned by "path", in the R8 order', () => {
        expect(CA.listClickActions('region').map((d) => [d.id, d.owner, d.kind, d.order]))
            .toEqual([[ID.route, 'path', 'choice', ORDER.path], [ID.checkAll, 'path', 'toggle', ORDER.check]]);
        expect(CA.listClickActions('location').map((d) => [d.id, d.owner, d.kind]))
            .toEqual([[ID.check, 'path', 'choice']]);
        expect(ID).toEqual({ route: 'path.route', checkAll: 'path.checkAll', check: 'path.check' });
    });

    it('register / list / unregister a panel action; a panel action defaults to ORDER.panel', () => {
        const d = CA.registerClickAction({ id: 'regions.open', owner: 'regions', label: 'Open', target: 'region',
            kind: 'toggle', run: () => ({ ok: true }) });
        expect(d.order).toBe(ORDER.panel);
        expect(Object.isFrozen(d)).toBe(true);
        expect(CA.listClickActions('region').map((x) => x.id)).toEqual([ID.route, ID.checkAll, 'regions.open']);
        expect(CA.listClickActions('location').map((x) => x.id)).toEqual([ID.check]);
        expect(CA.unregisterClickAction('regions.open')).toBe(true);
        expect(CA.unregisterClickAction('regions.open')).toBe(false);
        expect(CA.listClickActions('region').map((x) => x.id)).toEqual([ID.route, ID.checkAll]);
    });

    it('a duplicate id refuses BY NAME, naming the owner that holds it', () => {
        const desc = { id: 'flash.teleport', owner: 'flash', target: 'region', kind: 'toggle', run: () => ({ ok: true }) };
        CA.registerClickAction(desc);
        expect(() => CA.registerClickAction(desc)).toThrow('duplicate id "flash.teleport" (already registered by "flash")');
        expect(() => CA.registerClickAction({ ...CA.BUILT_IN_ACTIONS[0] }))
            .toThrow('duplicate id "path.route" (already registered by "path")');
    });

    it('refuses a malformed descriptor, and an id not namespaced by its owner', () => {
        const ok = { id: 'x.a', owner: 'x', target: 'region', kind: 'toggle', run: () => ({}) };
        expect(() => CA.registerClickAction({ ...ok, id: 'a' })).toThrow('namespaced by its owner');
        expect(() => CA.registerClickAction({ ...ok, id: 'y.a' })).toThrow('namespaced by its owner');
        expect(() => CA.registerClickAction({ ...ok, target: 'exit' })).toThrow('`target`');
        expect(() => CA.registerClickAction({ ...ok, kind: 'radio' })).toThrow('`kind`');
        expect(() => CA.registerClickAction({ ...ok, kind: 'choice' })).toThrow('needs `choices`');
        expect(() => CA.registerClickAction({ ...ok, run: null })).toThrow('`run`');
        expect(() => CA.registerClickAction({ ...ok, order: 'first' })).toThrow('`order`');
        expect(() => CA.registerClickAction(null)).toThrow('descriptor');
        expect(CA.listClickActions('region').map((x) => x.id)).toEqual([ID.route, ID.checkAll]);
    });
});

describe('⛓ runClickActions', () => {
    it('R8: path first, then checks, then panel actions — whatever the registration order', () => {
        for (const id of [ID.route, ID.checkAll, ID.check]) CA.unregisterClickAction(id);
        const ran = [];
        CA.registerClickAction({ id: 'regions.open', owner: 'regions', target: 'region', kind: 'toggle',
            run: () => { ran.push('regions.open'); return { ok: true }; } });
        CA.registerClickAction({ id: 'flash.teleport', owner: 'flash', target: 'region', kind: 'toggle',
            run: () => { ran.push('flash.teleport'); return { ok: true }; } });
        for (const d of [...CA.BUILT_IN_ACTIONS].reverse()) CA.registerClickAction(d);
        const h = handles();
        const settings = { enabled: true, region: { 'flash.teleport': true, 'regions.open': true, [ID.checkAll]: true,
            [ID.route]: { from: 'player', distance: 'all' } } };
        const r = CA.runClickActions('regionMap', 'region', { regionName: 'Field', discovery: ALLOWED }, settings, h);
        expect(r.results.map((x) => x.id)).toEqual([ID.route, ID.checkAll, 'regions.open', 'flash.teleport']);
        expect(ran).toEqual(['regions.open', 'flash.teleport']);
        // The move went out before the bulk check.
        expect(h.log.map((e) => e[1])).toEqual(['user:regionMove', 'user:locationCheck']);
    });

    it('the master switch: enabled === false runs nothing', () => {
        const h = handles();
        const settings = { ...CA.defaultClickActions(), enabled: false };
        settings.region[ID.checkAll] = true;
        expect(CA.runClickActions('regionGraph', 'region', { regionName: 'Field', discovery: ALLOWED }, settings, h))
            .toEqual({ ran: false, reason: 'disabled', results: [], skipped: [] });
        expect(CA.runClickActions('regionGraph', 'location',
            { regionName: 'Field', locationName: 'chest', discovery: ALLOWED }, settings, h))
            .toEqual({ ran: false, reason: 'disabled', results: [], skipped: [] });
        expect(h.log).toEqual([]);
        // The same settings switched on do act.
        CA.runClickActions('regionGraph', 'region', { regionName: 'Field', discovery: ALLOWED }, { ...settings, enabled: true }, h);
        expect(h.log.length).toBeGreaterThan(0);
    });

    it('an enabled id with no registered action is skipped and REPORTED, and settings keep it', () => {
        const settings = deepFreeze({ enabled: true, region: {
            [ID.route]: false, 'flash.teleport': true, 'discovery.discover': { mode: 'x' }, 'apcalc.focus': false,
        }, location: { [ID.check]: 'now', 'regions.scrollTo': true } });
        const before = JSON.stringify(settings);
        const h = handles();
        const r = CA.runClickActions('regionGraph', 'region', { regionName: 'Field', discovery: ALLOWED }, settings, h);
        expect(r).toEqual({ ran: true, results: [], skipped: [
            { id: 'flash.teleport', reason: 'unregistered' }, { id: 'discovery.discover', reason: 'unregistered' }] });
        const l = CA.runClickActions('regionGraph', 'location',
            { regionName: 'Field', locationName: 'chest', discovery: ALLOWED }, settings, h);
        expect(l.skipped).toEqual([{ id: 'regions.scrollTo', reason: 'unregistered' }]);
        expect(l.results.map((x) => x.id)).toEqual([ID.check]);
        expect(JSON.stringify(settings)).toBe(before);
        // Registered later (its panel loaded), the same kept id runs.
        CA.registerClickAction({ id: 'flash.teleport', owner: 'flash', target: 'region', kind: 'toggle', run: () => ({ ok: true }) });
        expect(CA.runClickActions('regionGraph', 'region', { regionName: 'Field', discovery: ALLOWED }, settings, h).results)
            .toEqual([{ id: 'flash.teleport', owner: 'flash', result: { ok: true } }]);
    });

    it('locationChecksAllowed still blocks the check actions (discovery\'s disableLocationCheckUI), not the route', () => {
        const h = handles();
        const settings = { enabled: true,
            region: { [ID.route]: { from: 'player', distance: 'all' }, [ID.checkAll]: true },
            location: { [ID.check]: 'now' } };
        const r = CA.runClickActions('regionGraph', 'region', { regionName: 'Field', discovery: BLOCKED }, settings, h);
        expect(r.results.map((x) => [x.id, x.result.ok, x.result.reason])).toEqual([
            [ID.route, true, undefined], [ID.checkAll, false, 'checks-disabled']]);
        expect(h.log.map((e) => e[1])).toEqual(['user:regionMove']);
        for (const value of ['now', 'addToPath']) {
            const hl = handles();
            const l = CA.runClickActions('regionGraph', 'location', { regionName: 'Field', locationName: 'chest', discovery: BLOCKED },
                { ...settings, location: { [ID.check]: value } }, hl);
            expect(l.results).toEqual([{ id: ID.check, owner: 'path', result: { ok: false, reason: 'checks-disabled' } }]);
            expect(hl.log).toEqual([]); // no check, no path check, and no move (today's handler returns first)
        }
    });
});

describe('⛓ the built-ins, through the real regionActions: payloads and the R7 source', () => {
    const run = (target, settings, ctx, h) => CA.runClickActions('regionMap', target,
        { regionName: 'Field', discovery: ALLOWED, ...ctx }, { enabled: true, ...settings }, h);
    const SRC = 'regionView-path-regionMap';

    it('route from path end, no path yet: one user:regionMove under regionView-path-<panelId>', () => {
        const h = handles();
        run('region', { region: { [ID.route]: { from: 'pathEnd', distance: 'all' } } }, {}, h);
        expect(h.log).toEqual([['dispatch', 'user:regionMove', { targetRegion: 'Field', sourceRegion: 'Menu', source: SRC },
            { initialTarget: 'bottom' }]]);
    });

    it('route from start: reset to the start region, trim, then walk; beforePathExecute runs after the reset', () => {
        const h = handles({ current: 'Field' });
        h.beforePathExecute = () => h.log.push(['beforePathExecute']);
        run('region', { region: { [ID.route]: { from: 'start', distance: 'one' } } }, {}, h);
        expect(h.log.map((e) => e[0] === 'dispatch' ? [e[1], e[2].source] : e)).toEqual([
            ['gameState.setCurrentRegion', 'Menu'], ['gameState.trimPath', 'Menu', 1], ['beforePathExecute'],
            ['user:regionMove', SRC]]);
    });

    it('route from player: one step / all the way (direct) / the legacy oneAndAll', () => {
        for (const [distance, n] of [['one', 1], ['all', 1], ['oneAndAll', 2]]) {
            const h = handles();
            run('region', { region: { [ID.route]: { from: 'player', distance } } }, {}, h);
            expect(h.log).toHaveLength(n);
            for (const e of h.log) {
                expect(e).toEqual(['dispatch', 'user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined,
                    targetRegion: 'Field', exitName: 'Go', updatePath: false, source: SRC }, 'bottom']);
            }
        }
    });

    it('an invalid route value is refused, not guessed', () => {
        const h = handles();
        const r = run('region', { region: { [ID.route]: { from: 'nowhere', distance: 'all' } } }, {}, h);
        expect(r.results[0].result).toEqual({ ok: false, reason: 'invalid-route' });
        expect(h.log).toEqual([]);
    });

    it('checkAll: the accessible unchecked locations, under the panel\'s bulkCheck originator', () => {
        const h = handles();
        run('region', { region: { [ID.checkAll]: true } }, {}, h);
        expect(h.log).toEqual([['dispatch', 'user:locationCheck',
            { locationName: 'chest', regionName: 'Field', originator: 'testBulkCheck', originalDOMEvent: true },
            { initialTarget: 'bottom' }]]);
    });

    it('location check now: one user:locationCheck under the panel\'s check originator', () => {
        const h = handles();
        run('location', { location: { [ID.check]: 'now' } }, { locationName: 'chest' }, h);
        expect(h.log).toEqual([['dispatch', 'user:locationCheck',
            { locationName: 'chest', regionName: 'Field', originator: 'testCheck', originalDOMEvent: true },
            { initialTarget: 'bottom' }]]);
    });

    it('location check addToPath: the parent region\'s route (by the REGION route setting), then the path check', () => {
        const h = handles();
        run('location', { region: { [ID.route]: { from: 'pathEnd', distance: 'all' } }, location: { [ID.check]: 'addToPath' } },
            { locationName: 'chest' }, h);
        expect(h.log.map((e) => e.slice(0, 2))).toEqual([['dispatch', 'user:regionMove'], ['gameState.addLocationCheck', 'chest']]);
        const h2 = handles();
        run('location', { region: { [ID.route]: false }, location: { [ID.check]: 'addToPath' } }, { locationName: 'chest' }, h2);
        expect(h2.log).toEqual([['gameState.addLocationCheck', 'chest', 'Field']]);
    });
});

describe('⛓ the migration from the seven regionGraph keys (design §4.4)', () => {
    const M = CA.migrateRegionGraphClickKeys;
    const off = { movePlayerOneStep: false, movePlayerDirectly: false, showRegionInPanel: false, addToPath: false,
        overwritePath: false, addLocationsToPath: false, checkAllLocationsInRegion: false };
    const route = (o) => M({ ...off, ...o }).region[ID.route];

    it('defaultClickActions() = the migration of today\'s seven defaults: extend the path, open the Regions panel', () => {
        expect(CA.defaultClickActions()).toEqual(M(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS));
        expect(CA.defaultClickActions()).toEqual({ enabled: true,
            region: { [ID.route]: { from: 'pathEnd', distance: 'all' }, [ID.checkAll]: false, 'regions.open': true },
            location: { [ID.check]: 'now' } });
        expect(CA.defaultClickActions()).not.toBe(CA.defaultClickActions());
        expect(M({})).toEqual(CA.defaultClickActions()); // a missing key takes its default
        expect(M(undefined)).toEqual(CA.defaultClickActions());
    });

    it('the route: add wins over overwrite, both win over the move boxes; all four off → no route', () => {
        expect(route({ addToPath: true })).toEqual({ from: 'pathEnd', distance: 'all' });
        expect(route({ addToPath: true, overwritePath: true })).toEqual({ from: 'pathEnd', distance: 'all' });
        expect(route({ overwritePath: true })).toEqual({ from: 'start', distance: 'all' });
        expect(route({ overwritePath: true, movePlayerDirectly: true })).toEqual({ from: 'start', distance: 'all' });
        expect(route({ movePlayerDirectly: true })).toEqual({ from: 'player', distance: 'all' });
        expect(route({ movePlayerOneStep: true })).toEqual({ from: 'player', distance: 'one' });
        expect(route({})).toBe(false);
    });

    it('distance: one-step → one (on a path edit too); both move boxes and no path box → the legacy oneAndAll', () => {
        expect(route({ addToPath: true, movePlayerOneStep: true })).toEqual({ from: 'pathEnd', distance: 'one' });
        expect(route({ addToPath: true, movePlayerOneStep: true, movePlayerDirectly: true })).toEqual({ from: 'pathEnd', distance: 'one' });
        expect(route({ overwritePath: true, movePlayerOneStep: true })).toEqual({ from: 'start', distance: 'one' });
        expect(route({ movePlayerOneStep: true, movePlayerDirectly: true })).toEqual({ from: 'player', distance: 'oneAndAll' });
    });

    it('the add-ons: showRegionInPanel → regions.open, checkAll → path.checkAll, addLocationsToPath → check addToPath', () => {
        expect(M({ ...off, showRegionInPanel: true }).region['regions.open']).toBe(true);
        expect(M({ ...off, checkAllLocationsInRegion: true }).region[ID.checkAll]).toBe(true);
        expect(M({ ...off, addLocationsToPath: true }).location).toEqual({ [ID.check]: 'addToPath' });
        expect(M(off).location).toEqual({ [ID.check]: 'now' });
        expect(M(off)).toEqual({ enabled: true, region: { [ID.route]: false, [ID.checkAll]: false, 'regions.open': false },
            location: { [ID.check]: 'now' } });
    });

    it('a non-boolean value is ignored (the default stands)', () => {
        expect(M({ addToPath: 'yes', showRegionInPanel: 0 })).toEqual(CA.defaultClickActions());
    });
});
