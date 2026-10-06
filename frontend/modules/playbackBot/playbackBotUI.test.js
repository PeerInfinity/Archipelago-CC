import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this._listeners = {};
        this.classList = (() => {
            const set = new Set();
            return {
                add: (c) => set.add(c),
                remove: (c) => set.delete(c),
                contains: (c) => set.has(c),
                toggle: (c) => { set.has(c) ? set.delete(c) : set.add(c); },
            };
        })();
        this.parentNode = null;
        this.disabled = false;
        this.value = '';
        this.type = '';
        this.title = '';
        this.textContent = '';
        this.className = '';
        this.onclick = null;
        this.innerHTML = '';
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    insertBefore(child, before) {
        child.parentNode = this;
        const idx = this.children.indexOf(before);
        if (idx === -1) this.children.push(child);
        else this.children.splice(idx, 0, child);
        return child;
    }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
        child.parentNode = null;
        return child;
    }
    addEventListener(name, fn) {
        if (!this._listeners[name]) this._listeners[name] = [];
        this._listeners[name].push(fn);
    }
    removeEventListener() {}
    queryAll(predicate, out = []) {
        for (const child of this.children) {
            if (predicate(child)) out.push(child);
            child.queryAll?.(predicate, out);
        }
        return out;
    }
}

const fakeDocument = {
    createElement(tag) { return new FakeElement(tag); },
};

beforeEach(() => { globalThis.document = fakeDocument; });
afterEach(() => { delete globalThis.document; });

import { PlaybackBotUI, buildLocationIndex, buildSphereQueue, formatSphereTag } from './playbackBotUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

const SAMPLE_SPHERE_DATA = [
    { sphereIndex: 0, fractionalIndex: 0, locations: [], accessibleRegions: ['Menu'], accessibleLocations: ['Free Loc'] },
    { sphereIndex: 0, fractionalIndex: 1, locations: ['Free Loc'], accessibleRegions: [], accessibleLocations: ['Locked Loc'] },
];

function makeFakeController() {
    const calls = [];
    const record = (method) => (...args) => { calls.push({ method, args }); };
    return {
        calls,
        play:    record('play'),
        stop:    record('stop'),
        step:    record('step'),
        instant: record('instant'),
        reset:   record('reset'),
        setRate: record('setRate'),
        walkTo:  record('walkTo'),
    };
}

describe('PlaybackBotUI — initialization', () => {
    it('mounts with control bar and status display', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => makeFakeController() });
        const root = bot.getElement();
        expect(root).toBeTruthy();
        const status = root.queryAll((el) => el.className === 'playback-bot-status')[0];
        expect(status?.textContent).toMatch(/2 entries/);
    });

    it('reports no sphere log when data is empty', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => [], getActiveController: () => makeFakeController() });
        const status = bot.getElement().queryAll((el) => el.className === 'playback-bot-status')[0];
        expect(status?.textContent).toMatch(/No sphere log loaded/);
    });
});

describe('PlaybackBotUI — dispatches to the active substrate controller', () => {
    it('play() invokes controller.play with a rate', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => controller });
        bot.play(7);
        const last = controller.calls.at(-1);
        expect(last.method).toBe('play');
        expect(last.args[0]).toBe(7);
    });

    it('stop() invokes controller.stop', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => controller });
        bot.stop();
        expect(controller.calls.at(-1).method).toBe('stop');
    });

    it('step() invokes controller.step', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => controller });
        bot.step();
        expect(controller.calls.at(-1).method).toBe('step');
    });

    it('reset() invokes controller.reset', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => controller });
        bot.reset();
        expect(controller.calls.at(-1).method).toBe('reset');
    });

    it('setRate() invokes controller.setRate with rate', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => controller });
        bot.setRate(12);
        const last = controller.calls.at(-1);
        expect(last.method).toBe('setRate');
        expect(last.args[0]).toBe(12);
    });

    it('survives a missing controller without throwing', () => {
        // No getActiveController injected and no proxy / region either,
        // so the default _resolveController returns null. Bot must
        // silently no-op rather than throw.
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA });
        expect(() => bot.play()).not.toThrow();
        expect(() => bot.stop()).not.toThrow();
        expect(() => bot.setRate(8)).not.toThrow();
    });
});

describe('buildLocationIndex', () => {
    it('maps every location to its region', () => {
        const staticData = {
            regions: new Map([
                ['Menu', { exits: [], locations: [] }],
                ['region_2_2', {
                    locations: [
                        { name: 'region_2_2__key_red_pickup__4_4', id: 1 },
                        { name: 'region_2_2__key_green_pickup__7_3', id: 2 },
                    ],
                }],
                ['region_3_2', {
                    locations: [{ name: 'region_3_2__key_blue_pickup__5_9', id: 3 }],
                }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(3);
        expect(idx.get('region_2_2__key_red_pickup__4_4')).toBe('region_2_2');
        expect(idx.get('region_2_2__key_green_pickup__7_3')).toBe('region_2_2');
        expect(idx.get('region_3_2__key_blue_pickup__5_9')).toBe('region_3_2');
    });

    it('skips regions without a locations array', () => {
        const staticData = {
            regions: new Map([
                ['Menu', { exits: [{ name: 'GameStart' }] }],   // no `locations`
                ['region_a', { locations: [{ name: 'Loc A' }] }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(1);
        expect(idx.get('Loc A')).toBe('region_a');
    });

    it('skips locations without a name', () => {
        const staticData = {
            regions: new Map([
                ['region_a', { locations: [
                    { name: 'Loc A', id: 1 },
                    { id: 2 },                  // unnamed — defensive
                    { name: 'Loc B', id: 3 },
                ] }],
            ]),
        };
        const idx = buildLocationIndex(staticData);
        expect(idx.size).toBe(2);
        expect(idx.get('Loc A')).toBe('region_a');
        expect(idx.get('Loc B')).toBe('region_a');
    });

    it('returns an empty Map when staticData has no regions', () => {
        expect(buildLocationIndex({}).size).toBe(0);
        expect(buildLocationIndex(null).size).toBe(0);
        expect(buildLocationIndex({ regions: null }).size).toBe(0);
    });
});

describe('buildSphereQueue', () => {
    function idx(...pairs) {
        return new Map(pairs);
    }

    it('flattens multi-sphere entries in order', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A', 'Loc B'] },
            { sphereIndex: 1, fractionalIndex: 0, locations: ['Loc C'] },
            { sphereIndex: 1, fractionalIndex: 1, locations: ['Loc D'] },
        ];
        const queue = buildSphereQueue(data, idx(
            ['Loc A', 'rA'], ['Loc B', 'rB'], ['Loc C', 'rC'], ['Loc D', 'rD'],
        ));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A', 'Loc B', 'Loc C', 'Loc D']);
        expect(queue.map((e) => e.regionName)).toEqual(['rA', 'rB', 'rC', 'rD']);
    });

    it('preserves sphereIndex / fractionalIndex on every entry', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 3, locations: ['Loc A'] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA']));
        expect(queue[0]).toEqual({
            locationName: 'Loc A',
            regionName: 'rA',
            sphereIndex: 0,
            fractionalIndex: 3,
        });
    });

    it('drops locations whose region is not in the index', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 0, locations: ['Loc A', 'Mystery', 'Loc B'] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA'], ['Loc B', 'rB']));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A', 'Loc B']);
    });

    it('skips entries without a locations array (e.g. metadata or empty sphere)', () => {
        const data = [
            { sphereIndex: 0, fractionalIndex: 0 },         // no locations key
            { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
            { sphereIndex: 0, fractionalIndex: 2, locations: [] },
        ];
        const queue = buildSphereQueue(data, idx(['Loc A', 'rA']));
        expect(queue.map((e) => e.locationName)).toEqual(['Loc A']);
    });

    it('returns an empty queue for empty / invalid inputs', () => {
        expect(buildSphereQueue([], new Map())).toEqual([]);
        expect(buildSphereQueue(null, new Map())).toEqual([]);
        expect(buildSphereQueue([{ locations: ['x'] }], null)).toEqual([]);
    });
});

describe('PlaybackBotUI — sphere-log play loop', () => {
    // Helpers shared across this describe block. Each test builds its
    // own bot so module-scope state from prior tests is irrelevant.
    function makeStaticData() {
        return {
            regions: new Map([
                ['region_a', { locations: [{ name: 'Loc A', id: 1 }] }],
                ['region_b', { locations: [{ name: 'Loc B', id: 2 }] }],
                ['region_c', { locations: [{ name: 'Loc C', id: 3 }] }],
            ]),
        };
    }

    function makeSphereData() {
        return [
            { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
            { sphereIndex: 0, fractionalIndex: 2, locations: ['Loc B'] },
            { sphereIndex: 1, fractionalIndex: 0, locations: ['Loc C'] },
        ];
    }

    function makeBot({
        sphereData = makeSphereData(),
        staticData = makeStaticData(),
        pathFinder = { findPathWithExits: () => null },
    } = {}) {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
            pathFinder,
        });
        return { bot, controller };
    }

    it('builds the queue lazily on first play', () => {
        const { bot } = makeBot();
        expect(bot.getQueueLength()).toBe(0);    // not yet built
        bot.play();
        expect(bot.getQueueLength()).toBe(3);
    });

    it('same-region head publishes walkTo location', () => {
        const { bot, controller } = makeBot();
        // Pretend the visualizer is already in region_a — simulate the
        // initial user:regionMove that the procgen player synthesizes
        // on rules-loaded.
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        const walkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(walkTo.args[0]).toEqual({ kind: 'location', name: 'Loc A' });
    });

    it('cross-region head publishes walkTo exit using the first hop from PathFinder', () => {
        const pathFinder = {
            findPathWithExits: (from, to) => {
                expect(from).toBe('region_a');
                expect(to).toBe('region_b');
                return { steps: [
                    { region: 'region_a', exitUsed: null },
                    { region: 'region_b', exitUsed: 'a_to_b_exit' },
                ], length: 1 };
            },
        };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        // Pre-mark Loc A as collected so the head is Loc B (region_b).
        bot.onLocationCheck({ locationName: 'Loc A' });
        bot.play();
        const walkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(walkTo.args[0]).toEqual({ kind: 'exit', name: 'a_to_b_exit' });
    });

    it('advances cursor on system:locationCheck for the matching head', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getCursor()).toBe(0);
        bot.onLocationCheck({ locationName: 'Loc A' });
        expect(bot.getCursor()).toBe(1);
    });

    it('skips queue entries collected incidentally (advance-past-checked)', () => {
        // Bot is walking toward Loc A but the visualizer's path passes
        // over Loc B (a future head); bot should pre-advance past Loc B
        // when it sees that event so the cursor doesn't stall on a
        // location stateManager already considers checked.
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getCursor()).toBe(0);
        bot.onLocationCheck({ locationName: 'Loc B' });   // incidental
        bot.onLocationCheck({ locationName: 'Loc A' });   // matches head
        // After Loc A: cursor past Loc A AND past Loc B (already in
        // _checkedSoFar). New head is Loc C.
        expect(bot.getCursor()).toBe(2);
    });

    it('seeds checked locations from the stateManager snapshot on play', () => {
        // Checks that happened before the bot could observe them
        // (panel mounted late, or an auto-playing substrate like
        // bounce collected pickups before the user pressed Play) must
        // not stall the cursor — walking to an already-checked
        // location never produces a locationCheck event.
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: makeSphereData,
            getStaticData: makeStaticData,
            getActiveController: () => controller,
            pathFinder: { findPathWithExits: () => null },
            stateManagerProxy: {
                getLatestStateSnapshot: () => ({ checkedLocations: ['Loc A'] }),
            },
        });
        bot.onRegionMove({ targetRegion: 'region_b' });
        bot.play();
        // Head skipped Loc A (snapshot-checked) and went straight to
        // Loc B in the current region.
        const walkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(walkTo.args[0]).toEqual({ kind: 'location', name: 'Loc B' });
        expect(bot.getCursor()).toBe(1);
    });

    it('region change retriggers walkTo for the new region', () => {
        const pathFinder = {
            findPathWithExits: () => ({ steps: [
                { region: 'region_a', exitUsed: null },
                { region: 'region_b', exitUsed: 'a_to_b' },
            ], length: 1 }),
        };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.onLocationCheck({ locationName: 'Loc A' });
        bot.play();
        // First walkTo: exit out of region_a.
        const firstWalkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(firstWalkTo.args[0]).toEqual({ kind: 'exit', name: 'a_to_b' });

        // Visualizer crosses into region_b — bot now in same region as
        // head and should publish a walkTo location.
        bot.onRegionMove({ targetRegion: 'region_b' });
        const walkTos = controller.calls.filter((c) => c.method === 'walkTo');
        expect(walkTos.at(-1).args[0]).toEqual({ kind: 'location', name: 'Loc B' });
    });

    it('queue empty -> publishes stop and status reads finished', () => {
        // Single-location queue so we exercise clean-finish without
        // exiting the start region (which would need PathFinder).
        const { bot, controller } = makeBot({
            sphereData: [
                { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
            ],
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.isActive()).toBe(true);
        bot.onLocationCheck({ locationName: 'Loc A' });
        // Cursor advanced past the only entry → bot recognizes done.
        expect(bot.getCursor()).toBe(1);
        expect(bot.getStatus()).toMatch(/^finished — 1 location visited/);
        expect(bot.isActive()).toBe(false);
        const lastCmd = controller.calls.at(-1).method;
        expect(lastCmd).toBe('stop');
    });

    it('PathFinder returning null -> error status, stop event, isActive=false', () => {
        const pathFinder = { findPathWithExits: () => null };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.onLocationCheck({ locationName: 'Loc A' });
        bot.play();   // Head is Loc B (region_b), no path returned
        expect(bot.getStatus()).toMatch(/^error: no path from region_a to region_b/);
        expect(bot.isActive()).toBe(false);
        const lastCmd = controller.calls.at(-1).method;
        expect(lastCmd).toBe('stop');
    });

    it('stop() pauses without resetting cursor', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        bot.onLocationCheck({ locationName: 'Loc A' });
        const cursorBefore = bot.getCursor();
        bot.stop();
        expect(bot.isActive()).toBe(false);
        expect(bot.getCursor()).toBe(cursorBefore);
    });

    it('reset() clears cursor + queue + status', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        bot.onLocationCheck({ locationName: 'Loc A' });
        expect(bot.getCursor()).toBe(1);
        bot.reset();
        expect(bot.getCursor()).toBe(0);
        expect(bot.getQueueLength()).toBe(0);   // queue cleared, will rebuild on next play
        expect(bot.getStatus()).toBe('idle');
        expect(bot.isActive()).toBe(false);
    });

    it('reset() clears the dispatcher event log so a new run starts clean', () => {
        const { bot } = makeBot();
        bot.logDispatcherEvent('user:locationCheck', { locationName: 'Loc A' }, 'propagated');
        bot.logDispatcherEvent('user:regionMove', { targetRegion: 'region_a' }, 'propagated');
        expect(bot.getDispatcherLog().length).toBe(2);
        bot.reset();
        expect(bot.getDispatcherLog()).toEqual([]);
    });

    it('walkTo dedup keys on currentRegion so same-named exits in different regions both publish', () => {
        // Cross-region routing regression: when the bot routes through
        // a chain of regions, each region may have an exit with the
        // SAME name (e.g. region_2_3.exit_1 and region_3_3.exit_1 both
        // exist in AP_3). The bot's dedup must not collapse them, or
        // the second region's walkTo gets silently skipped and the
        // visualizer stalls. This test fakes that exact pattern:
        // currentRegion changes but the head's first-hop exit name
        // happens to be identical.
        const seenWalkTos = [];
        const pathFinder = {
            findPathWithExits: (from, to) => ({ steps: [
                { region: from, exitUsed: null },
                { region: to, exitUsed: 'exit_1' },     // same name in both regions
            ], length: 1 }),
        };
        const { bot, controller } = makeBot({
            sphereData: [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc Z'] }],
            staticData: {
                regions: new Map([
                    ['region_a', { locations: [] }],
                    ['region_b', { locations: [] }],
                    ['region_z', { locations: [{ name: 'Loc Z' }] }],
                ]),
            },
            pathFinder,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        // First walkTo: exit_1 from region_a.
        const firstWalk = controller.calls.find((c) => c.method === 'walkTo');
        expect(firstWalk.args[0]).toEqual({ kind: 'exit', name: 'exit_1' });

        // Cross into region_b. Bot computes new path; first hop is
        // STILL named 'exit_1', but in a different region. Without
        // region-keyed dedup, this second walkTo would be silently
        // skipped.
        bot.onRegionMove({ targetRegion: 'region_b' });
        const walkTos = controller.calls.filter((c) => c.method === 'walkTo');
        expect(walkTos).toHaveLength(2);
        expect(walkTos[1].args[0]).toEqual({ kind: 'exit', name: 'exit_1' });
    });

    it('redundant walkTo publishes are de-duped while head is unchanged', () => {
        const { bot, controller } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        const walkTosAfterPlay = controller.calls.filter((c) => c.method === 'walkTo').length;
        // Mid-leg event for an unrelated location — bot's
        // _publishNextWalkTo runs again but the head/sig hasn't
        // changed, so no second walkTo should fire.
        bot.onLocationCheck({ locationName: 'Unrelated location' });
        const walkTosAfterEvent = controller.calls.filter((c) => c.method === 'walkTo').length;
        expect(walkTosAfterEvent).toBe(walkTosAfterPlay);
    });

    it('thin-remote fallback when no sphere data is loaded', () => {
        const { bot, controller } = makeBot({ sphereData: [] });
        bot.play(7);
        // Empty queue → bot doesn't try to drive; just publishes play.
        expect(bot.getStatus()).toBe('no sphere log');
        const lastCmd = controller.calls.at(-1);
        expect(lastCmd.method).toBe('play');
        expect(lastCmd.args[0]).toBe(7);
    });

    // The active-bot singleton moved to the panel layer in Phase 1
    // of the playback-bot refactor — the bot is now a plain widget
    // owned by PlaybackBotPanel. Tests for that singleton live in
    // playbackBot/index.js / playbackBotPanel.js if/when they grow.
});

describe('PlaybackBotUI — manual walkToTile', () => {
    function makeStaticData() {
        return {
            regions: new Map([
                ['region_a', { locations: [] }],
                ['region_b', { locations: [] }],
                ['region_c', { locations: [] }],
            ]),
        };
    }

    function makeBot({
        pathFinder = { findPathWithExits: () => null },
        staticData = makeStaticData(),
    } = {}) {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => [],
            getStaticData: () => staticData,
            getActiveController: () => controller,
            pathFinder,
        });
        return { bot, controller };
    }

    it('rejects invalid arguments without dispatching', () => {
        const { bot, controller } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        const before = controller.calls.length;
        expect(bot.walkToTile('', 0, 0)).toEqual({ ok: false, reason: 'invalid arguments' });
        expect(bot.walkToTile('region_a', NaN, 0)).toEqual({ ok: false, reason: 'invalid arguments' });
        expect(bot.walkToTile('region_a', 0, NaN)).toEqual({ ok: false, reason: 'invalid arguments' });
        expect(controller.calls.length).toBe(before);
    });

    it('refuses while the sphere queue is active', () => {
        const { bot } = makeBot({
            staticData: { regions: new Map([['region_a', { locations: [{ name: 'Loc A' }] }]]) },
        });
        // Inject a synthetic queue + active state so we don't have to
        // wire up real sphere data just to assert the guard.
        bot._isActive = true;
        const r = bot.walkToTile('region_a', 1, 2);
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/sphere queue is active/);
    });

    it('same-region target publishes kind:tile walkTo and clears pending', () => {
        const { bot, controller } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        const r = bot.walkToTile('region_a', 5, 7);
        expect(r).toEqual({ ok: true });
        const walkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(walkTo.args[0]).toEqual({ kind: 'tile', region: 'region_a', x: 5, y: 7 });
        // Pending cleared so a stray onRegionMove doesn't re-fire.
        expect(bot._pendingManualTarget).toBeNull();
    });

    it('cross-region target routes through PathFinder via exit walkTo', () => {
        const calls = [];
        const pathFinder = {
            findPathWithExits: (from, to) => {
                calls.push([from, to]);
                return { steps: [
                    { region: from, exitUsed: null },
                    { region: to, exitUsed: 'a_to_b' },
                ], length: 1 };
            },
        };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        const r = bot.walkToTile('region_b', 3, 4);
        expect(r.ok).toBe(true);
        expect(calls).toEqual([['region_a', 'region_b']]);
        const walkTo = controller.calls.find((c) => c.method === 'walkTo');
        expect(walkTo.args[0]).toEqual({ kind: 'exit', name: 'a_to_b' });
        // Pending stays set so the next regionMove finishes the route.
        expect(bot._pendingManualTarget).toEqual({ kind: 'tile', region: 'region_b', x: 3, y: 4 });
        expect(bot.getStatus()).toMatch(/routing via "a_to_b" → \(region_b 3,4\)/);
    });

    it('region transition finishes a cross-region tile route', () => {
        const pathFinder = {
            findPathWithExits: () => ({ steps: [
                { region: 'region_a', exitUsed: null },
                { region: 'region_b', exitUsed: 'a_to_b' },
            ], length: 1 }),
        };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.walkToTile('region_b', 3, 4);
        // Simulate the visualizer crossing the exit.
        bot.onRegionMove({ targetRegion: 'region_b' });
        const walkTos = controller.calls.filter((c) => c.method === 'walkTo');
        // Last walkTo: the final-leg tile walk in region_b.
        expect(walkTos.at(-1).args[0]).toEqual({
            kind: 'tile', region: 'region_b', x: 3, y: 4,
        });
        expect(bot._pendingManualTarget).toBeNull();
    });

    it('PathFinder failure surfaces error status and clears pending', () => {
        const pathFinder = { findPathWithExits: () => null };
        const { bot, controller } = makeBot({ pathFinder });
        bot.onRegionMove({ targetRegion: 'region_a' });
        const r = bot.walkToTile('region_b', 0, 0);
        // walkToTile itself returns ok — the PathFinder failure is
        // surfaced via status, matching walkToLocation's behavior.
        expect(r.ok).toBe(true);
        expect(bot.getStatus()).toMatch(/^error: no path from region_a to region_b/);
        expect(bot._pendingManualTarget).toBeNull();
        // No walkTo should have been published.
        expect(controller.calls.find((c) => c.method === 'walkTo')).toBeUndefined();
    });

    it('back-to-back tile walkTos to different (x,y) both publish (dedup respects coords)', () => {
        const { bot, controller } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.walkToTile('region_a', 1, 1);
        bot.walkToTile('region_a', 2, 2);
        const walkTos = controller.calls.filter((c) => c.method === 'walkTo');
        expect(walkTos).toHaveLength(2);
        expect(walkTos[0].args[0]).toMatchObject({ kind: 'tile', x: 1, y: 1 });
        expect(walkTos[1].args[0]).toMatchObject({ kind: 'tile', x: 2, y: 2 });
    });
});

describe('formatSphereTag', () => {
    it('formats integer sphere as "Sphere N → "', () => {
        expect(formatSphereTag({ sphereIndex: 0, fractionalIndex: 0 })).toBe('Sphere 0 → ');
        expect(formatSphereTag({ sphereIndex: 2 })).toBe('Sphere 2 → ');
    });

    it('formats fractional sphere as "Sphere N.M → "', () => {
        expect(formatSphereTag({ sphereIndex: 0, fractionalIndex: 1 })).toBe('Sphere 0.1 → ');
        expect(formatSphereTag({ sphereIndex: 1, fractionalIndex: 8 })).toBe('Sphere 1.8 → ');
    });

    it('returns "" when sphereIndex is missing', () => {
        expect(formatSphereTag({})).toBe('');
        expect(formatSphereTag(null)).toBe('');
        expect(formatSphereTag(undefined)).toBe('');
    });
});

describe('PlaybackBotUI — rendered status line', () => {
    // Same fixture as the play-loop tests, but here we assert what
    // ends up in the status DOM element so the user can see it.
    function makeBotWithSpheres() {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => [
                { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
                { sphereIndex: 0, fractionalIndex: 2, locations: ['Loc B'] },
                { sphereIndex: 1, fractionalIndex: 0, locations: ['Loc C'] },
            ],
            getStaticData: () => ({
                regions: new Map([
                    ['region_a', { locations: [{ name: 'Loc A' }] }],
                    ['region_b', { locations: [{ name: 'Loc B' }] }],
                    ['region_c', { locations: [{ name: 'Loc C' }] }],
                ]),
            }),
            getActiveController: () => controller,
            pathFinder: { findPathWithExits: (from, to) => ({ steps: [
                { region: from, exitUsed: null },
                { region: to, exitUsed: `${from}_to_${to}` },
            ], length: 1 }) },
        });
        return bot;
    }

    function statusText(bot) {
        return bot.getElement().queryAll((el) => el.className === 'playback-bot-status')[0]?.textContent;
    }

    it('shows "Sphere log loaded: N entries" when idle', () => {
        const bot = makeBotWithSpheres();
        expect(statusText(bot)).toMatch(/^Sphere log loaded: 3 entries\.$/);
    });

    it('shows "No sphere log loaded" when there is no sphere data', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => [], getActiveController: () => makeFakeController() });
        expect(statusText(bot)).toMatch(/^No sphere log loaded\.$/);
    });

    it('shows "Sphere X.Y → walking to ..." for a same-region head', () => {
        const bot = makeBotWithSpheres();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(statusText(bot)).toBe('Sphere 0.1 → walking to "Loc A" (1/3)');
    });

    it('shows "Sphere X.Y → routing via ..." for a cross-region head', () => {
        const bot = makeBotWithSpheres();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.onLocationCheck({ locationName: 'Loc A' });   // advance past first head
        bot.play();
        // Head is now Loc B in region_b; bot is in region_a.
        expect(statusText(bot)).toBe('Sphere 0.2 → routing via "region_a_to_region_b" → region_b (2/3)');
    });

    it('shows "waiting for region" when no region move has fired yet', () => {
        const bot = makeBotWithSpheres();
        bot.play();   // no preceding onRegionMove
        expect(statusText(bot)).toBe('Sphere 0.1 → waiting for region (1/3)');
    });

    it('shows "finished — N location(s) visited" after the queue drains', () => {
        const bot = new PlaybackBotUI({
            getSphereData: () => [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] }],
            getStaticData: () => ({ regions: new Map([['region_a', { locations: [{ name: 'Loc A' }] }]]) }),
            getActiveController: () => makeFakeController(),
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        bot.onLocationCheck({ locationName: 'Loc A' });
        expect(statusText(bot)).toBe('finished — 1 location visited');
    });

    it('shows error string when PathFinder returns no path', () => {
        const bot = new PlaybackBotUI({
            getSphereData: () => [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc B'] }],
            getStaticData: () => ({ regions: new Map([
                ['region_a', { locations: [] }],
                ['region_b', { locations: [{ name: 'Loc B' }] }],
            ]) }),
            getActiveController: () => makeFakeController(),
            pathFinder: { findPathWithExits: () => null },
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(statusText(bot)).toBe('error: no path from region_a to region_b');
    });

    it('reverts to the static idle line after reset()', () => {
        const bot = makeBotWithSpheres();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(statusText(bot)).not.toMatch(/^Sphere log loaded/);
        bot.reset();
        expect(statusText(bot)).toMatch(/^Sphere log loaded: 3 entries\.$/);
    });
});

describe('PlaybackBotUI — append-only log', () => {
    function makeBot() {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => [
                { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
                { sphereIndex: 0, fractionalIndex: 2, locations: ['Loc B'] },
            ],
            getStaticData: () => ({ regions: new Map([
                ['region_a', { locations: [{ name: 'Loc A' }] }],
                ['region_b', { locations: [{ name: 'Loc B' }] }],
            ]) }),
            getActiveController: () => controller,
            pathFinder: { findPathWithExits: (from, to) => ({ steps: [
                { region: from, exitUsed: null },
                { region: to, exitUsed: `${from}_to_${to}` },
            ], length: 1 }) },
        });
        return { bot, controller };
    }

    function logEntries(bot) {
        const logEl = bot.getElement().queryAll((el) => el.className === 'playback-bot-log')[0];
        return logEl?.children?.map((c) => c.textContent) ?? [];
    }

    it('appends a new entry when the bot transitions to a new state', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        // play() → walkTo location for queue head Loc A.
        const log = bot.getLog();
        expect(log).toEqual(['Sphere 0.1 → walking to "Loc A" (1/2)']);
    });

    it('records every distinct state transition in order', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();                                    // walking to Loc A
        bot.onLocationCheck({ locationName: 'Loc A' }); // routing via region_a_to_region_b
        bot.onRegionMove({ targetRegion: 'region_b' }); // walking to Loc B
        bot.onLocationCheck({ locationName: 'Loc B' }); // finished
        const log = bot.getLog();
        expect(log).toEqual([
            'Sphere 0.1 → walking to "Loc A" (1/2)',
            'Sphere 0.2 → routing via "region_a_to_region_b" → region_b (2/2)',
            'Sphere 0.2 → walking to "Loc B" (2/2)',
            'finished — 2 locations visited',
        ]);
    });

    it('dedupes consecutive identical status (mid-leg incidental events)', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        // Mid-leg: an unrelated location-check event arrives. The bot
        // re-evaluates _publishNextWalkTo, which would compute the
        // same status string (head unchanged). Log shouldn't grow.
        bot.onLocationCheck({ locationName: 'Some unrelated location' });
        bot.onLocationCheck({ locationName: 'Another unrelated location' });
        const log = bot.getLog();
        expect(log).toEqual(['Sphere 0.1 → walking to "Loc A" (1/2)']);
    });

    it('reset() clears the log', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getLog().length).toBeGreaterThan(0);
        bot.reset();
        expect(bot.getLog()).toEqual([]);
    });

    it('flushes the stateManager worker before cross-region path-finding', async () => {
        // Regression: the bot used to call findPathWithExits synchronously
        // after onLocationCheck, but the stateManager worker applies the
        // pickup asynchronously — without a flush, the snapshot the
        // PathFinder reads still showed the just-unlocked region as
        // 'unreachable' and the route was rejected. Verify that a proxy
        // with pingWorker is round-tripped before findPathWithExits runs,
        // and that findPathWithExits is called only after the ping resolves.
        const calls = [];
        let resolvePing;
        const pingPromise = new Promise((r) => { resolvePing = r; });
        const proxy = {
            pingWorker: (label) => {
                calls.push(`ping:${label}`);
                return pingPromise;
            },
        };
        const bot = new PlaybackBotUI({
            getSphereData: () => [
                { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
                { sphereIndex: 0, fractionalIndex: 2, locations: ['Loc B'] },
            ],
            getStaticData: () => ({ regions: new Map([
                ['region_a', { locations: [{ name: 'Loc A' }] }],
                ['region_b', { locations: [{ name: 'Loc B' }] }],
            ]) }),
            getActiveController: () => makeFakeController(),
            pathFinder: { findPathWithExits: (from, to) => {
                calls.push(`findPath:${from}->${to}`);
                return { steps: [
                    { region: from, exitUsed: null },
                    { region: to, exitUsed: `${from}_to_${to}` },
                ], length: 1 };
            } },
            stateManagerProxy: proxy,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        await bot.play();                                    // walk to Loc A (same region — no ping)
        expect(calls).toEqual([]);
        bot.onLocationCheck({ locationName: 'Loc A' });      // cross-region — should ping then path-find
        // Before the ping resolves, only the ping is recorded.
        expect(calls).toEqual(['ping:playbackBot:flush']);
        resolvePing();
        await pingPromise;
        // Yield once more so the awaited continuation in _publishNextWalkTo runs.
        await Promise.resolve();
        expect(calls).toEqual(['ping:playbackBot:flush', 'findPath:region_a->region_b']);
    });

    it('takes the same-region branch when onRegionMove fires during the flush await', async () => {
        // Race regression: the same-region check happens before the
        // flush await, but onRegionMove can fire while we await
        // pingWorker — the visualizer crosses an exit on its own
        // clock — and currentRegion ends up matching the head region
        // by the time PathFinder is called. Without re-checking after
        // the await, PathFinder sees (X, X), returns a length-0 path,
        // and the bot errors with "no path from X to X".
        const findPathCalls = [];
        let resolvePing;
        const pingPromise = new Promise((r) => { resolvePing = r; });
        const proxy = { pingWorker: () => pingPromise };
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => [
                { sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] },
                { sphereIndex: 0, fractionalIndex: 2, locations: ['Loc B'] },
            ],
            getStaticData: () => ({ regions: new Map([
                ['region_a', { locations: [{ name: 'Loc A' }] }],
                ['region_b', { locations: [{ name: 'Loc B' }] }],
            ]) }),
            getActiveController: () => controller,
            pathFinder: { findPathWithExits: (from, to) => {
                findPathCalls.push(`${from}->${to}`);
                return { steps: [
                    { region: from, exitUsed: null },
                    { region: to, exitUsed: `${from}_to_${to}` },
                ], length: 1 };
            } },
            stateManagerProxy: proxy,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        await bot.play();                                    // walk to Loc A
        bot.onLocationCheck({ locationName: 'Loc A' });      // sphere 0.2 wants region_b — cross-region path
        // While awaiting flush, the visualizer crosses an exit and
        // updates currentRegion to region_b — just as it would in
        // production when the visualizer's clock runs concurrently.
        bot.onRegionMove({ targetRegion: 'region_b' });
        resolvePing();
        await pingPromise;
        await Promise.resolve();
        // PathFinder should NOT have been called (post-flush re-check
        // saw region match), and the bot should have walked to Loc B
        // directly instead of erroring with "no path from X to X".
        expect(findPathCalls).toEqual([]);
        expect(bot.getStatus()).toMatch(/walking to "Loc B"/);
    });

    it('renders log entries as DOM children of .playback-bot-log', () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        bot.onLocationCheck({ locationName: 'Loc A' });
        // After two state transitions, the log container should hold
        // two entries; the header status line shows the most recent.
        expect(logEntries(bot).length).toBe(2);
        expect(logEntries(bot)[0]).toMatch(/walking to "Loc A"/);
        expect(logEntries(bot)[1]).toMatch(/routing via/);
    });
});

describe('PlaybackBotUI — destroy', () => {
    it('detaches from parent and nulls element', () => {
        const bot = new PlaybackBotUI({ getSphereData: () => SAMPLE_SPHERE_DATA, getActiveController: () => makeFakeController() });
        const parent = new FakeElement('div');
        parent.appendChild(bot.getElement());
        expect(parent.children.length).toBe(1);
        bot.destroy();
        expect(parent.children.length).toBe(0);
        expect(bot.getElement()).toBe(null);
    });
});

describe('PlaybackBotUI — substrate-switch stops the previous controller', () => {
    // Test substrates registered into the real registry; the bot's
    // default _resolveController path looks each one up via
    // substrateRegistry.get(id). Cleared in afterEach so the next
    // describe block starts fresh.
    let mazeController;
    let textController;

    beforeEach(() => {
        substrateRegistry.clear();
        mazeController = makeFakeController();
        textController = makeFakeController();
        substrateRegistry.register({
            id: 'maze',
            getPlaybackController: () => mazeController,
        });
        substrateRegistry.register({
            id: 'text_adventure',
            getPlaybackController: () => textController,
        });
    });
    afterEach(() => { substrateRegistry.clear(); });

    function makeBotWithSidecars() {
        const rulesJson = {
            preset_sidecars: {
                '1': {
                    region_maze:    { substrate: 'maze' },
                    region_text:    { substrate: 'text_adventure' },
                    region_maze_2:  { substrate: 'maze' },
                },
            },
        };
        return new PlaybackBotUI({
            getSphereData: () => [],
            getRulesJson: () => rulesJson,
        });
    }

    it('stops the previous substrate controller when crossing maze -> text_adventure', () => {
        const bot = makeBotWithSidecars();
        bot.onRegionMove({ targetRegion: 'region_maze' });
        // Substrate switch on this transition.
        bot.onRegionMove({ targetRegion: 'region_text' });
        const stopCalls = mazeController.calls.filter((c) => c.method === 'stop');
        expect(stopCalls).toHaveLength(1);
        // Text controller (the new active) wasn't stopped.
        expect(textController.calls.filter((c) => c.method === 'stop')).toHaveLength(0);
    });

    it('stops the previous substrate controller when crossing text_adventure -> maze', () => {
        const bot = makeBotWithSidecars();
        bot.onRegionMove({ targetRegion: 'region_text' });
        bot.onRegionMove({ targetRegion: 'region_maze' });
        const stopCalls = textController.calls.filter((c) => c.method === 'stop');
        expect(stopCalls).toHaveLength(1);
    });

    it('does not stop on same-substrate transitions (maze -> maze)', () => {
        const bot = makeBotWithSidecars();
        bot.onRegionMove({ targetRegion: 'region_maze' });
        bot.onRegionMove({ targetRegion: 'region_maze_2' });
        // No substrate change; nothing should have been stopped.
        expect(mazeController.calls.filter((c) => c.method === 'stop')).toHaveLength(0);
    });

    it('does not stop on the very first regionMove (no prior region)', () => {
        const bot = makeBotWithSidecars();
        bot.onRegionMove({ targetRegion: 'region_text' });
        // _currentRegion was null before this call; resolver returns
        // 'maze' as the default, but since there was no actual prior
        // active controller to clean up, calling stop on the maze
        // controller would be a no-op anyway. Either way, no stop on
        // the new (text) controller.
        expect(textController.calls.filter((c) => c.method === 'stop')).toHaveLength(0);
    });
});

describe('PlaybackBotUI — X1 maze collect policy', () => {
    function makeCollectController(tiles) {
        const c = makeFakeController();
        c.listUncollectedConsumables = () => tiles;
        return c;
    }

    function makeBot(controller) {
        const bot = new PlaybackBotUI({
            getSphereData: () => SAMPLE_SPHERE_DATA,
            getStaticData: () => ({ regions: { R: { locations: [{ name: 'Free Loc' }] } } }),
            getActiveController: () => controller,
        });
        bot._currentRegion = 'R';
        return bot;
    }

    it('defaults to never — no detour, playback unchanged (X1-R3)', () => {
        const controller = makeCollectController([{ x: 2, y: 2 }]);
        const bot = makeBot(controller);
        expect(bot.getMazeCollectPolicy()).toBe('never');
        expect(bot._nextCollectDetour()).toBe(null);
    });

    it('never even asks the controller under the default policy', () => {
        // The default must be a true no-op, not "ask then ignore" —
        // otherwise a substrate could observe the bot probing it.
        let asked = 0;
        const controller = makeFakeController();
        controller.listUncollectedConsumables = () => { asked++; return [{ x: 1, y: 1 }]; };
        const bot = makeBot(controller);
        bot._nextCollectDetour();
        expect(asked).toBe(0);
    });

    it('returns the first uncollected tile under always', () => {
        const controller = makeCollectController([{ x: 2, y: 2 }, { x: 3, y: 1 }]);
        const bot = makeBot(controller);
        bot.setMazeCollectPolicy('always');
        expect(bot._nextCollectDetour()).toEqual({ x: 2, y: 2 });
    });

    it('returns null under always when nothing is left to collect', () => {
        const bot = makeBot(makeCollectController([]));
        bot.setMazeCollectPolicy('always');
        expect(bot._nextCollectDetour()).toBe(null);
    });

    it('degrades to a no-op for substrates without the optional slot', () => {
        const bot = makeBot(makeFakeController());
        bot.setMazeCollectPolicy('always');
        expect(bot._nextCollectDetour()).toBe(null);
    });

    it('survives a controller that throws', () => {
        const controller = makeFakeController();
        controller.listUncollectedConsumables = () => { throw new Error('boom'); };
        const bot = makeBot(controller);
        bot.setMazeCollectPolicy('always');
        expect(bot._nextCollectDetour()).toBe(null);
    });

    it('normalises any unrecognised policy value to never', () => {
        const bot = makeBot(makeCollectController([{ x: 1, y: 1 }]));
        expect(bot.setMazeCollectPolicy('sometimes')).toBe('never');
        expect(bot.setMazeCollectPolicy('ALWAYS')).toBe('never');
        expect(bot.setMazeCollectPolicy('always')).toBe('always');
    });

    it('onConsumableCollected is inert when idle or when detours are off', () => {
        const controller = makeCollectController([{ x: 2, y: 2 }]);
        const bot = makeBot(controller);
        bot._isActive = false;
        bot.onConsumableCollected();
        expect(controller.calls.filter((c) => c.method === 'walkTo')).toHaveLength(0);

        bot._isActive = true; // active, but policy still 'never'
        bot.onConsumableCollected();
        expect(controller.calls.filter((c) => c.method === 'walkTo')).toHaveLength(0);
    });
});

describe('PlaybackBotUI — an unresolvable walkTo is a NAMED failure, not a stall', () => {
    // The router routes over the AP region graph; the substrate walks tiles.
    // Those two can disagree: the region-atlas maze projection deliberately
    // WALLS some crossings the AP compiler still emits, so the router can pick
    // an exit the maze world has no tile for. The controller answers `false`;
    // before this the panel logged to the console and returned, and the bot
    // sat waiting for a region transition that could never arrive — a silent
    // stall that reads exactly like slow progress in a timed test.
    function makeRefusingController() {
        const calls = [];
        const record = (method) => (...args) => { calls.push({ method, args }); };
        return {
            calls,
            play: record('play'),
            stop: record('stop'),
            step: record('step'),
            instant: record('instant'),
            reset: record('reset'),
            setRate: record('setRate'),
            walkTo: (...args) => { calls.push({ method: 'walkTo', args }); return false; },
        };
    }

    const sphereData = [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc A'] }];
    const staticData = {
        regions: new Map([['region_a', { locations: [{ name: 'Loc A', id: 1 }] }]]),
    };

    it('reports an error status naming the target the substrate cannot reach', () => {
        const controller = makeRefusingController();
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(controller.calls.some((c) => c.method === 'walkTo')).toBe(true);
        expect(bot.getStatus()).toContain('error:');
        expect(bot.getStatus()).toContain('Loc A');
        // And it did NOT go on to kick the clock as if the target had landed.
        expect(controller.calls.filter((c) => c.method === 'play')).toHaveLength(0);
    });

    it('a refusal that carries its REASON (`lastRefusal`) is shown in the status (Seedling JS J2)', () => {
        const controller = makeRefusingController();
        controller.lastRefusal = 'flash_seedling_gen regions are walked only on the Seedling JS runtime';
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getStatus()).toBe('error: region_a: the bot cannot walk to location "Loc A" — '
            + 'flash_seedling_gen regions are walked only on the Seedling JS runtime');
        expect(controller.calls.filter((c) => c.method === 'play')).toHaveLength(0);
    });

    it('a LATE refusal (playback:walkFailed → onWalkFailed) is the same named error status', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getStatus()).not.toContain('error:');
        bot.onWalkFailed({ substrate: 'flash_seedling_gen', target: { kind: 'location', name: 'Loc A' },
            reason: 'the JS runtime\'s walk failed: not reached within 1800 ticks' });
        expect(bot.getStatus()).toBe('error: region_a: the bot cannot walk to location "Loc A" — '
            + 'the JS runtime\'s walk failed: not reached within 1800 ticks');
        bot.onWalkFailed({});
        expect(bot.getStatus()).toContain('not reached within 1800 ticks');
    });

    it('⛓ S2 — a live walk\'s note (playback:walkNote → onWalkNote) rides after the status and clears', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        const status = bot.getStatus();
        bot.onWalkNote({ substrate: 'flash_seedling', target: { kind: 'location', name: 'Loc A' }, note: 'solving… (budget 5 s)' });
        expect(bot.getWalkNote()).toBe('solving… (budget 5 s)');
        expect(bot.getStatus()).toBe(status);
        expect(bot.getLog()).toContain(`${status} — solving… (budget 5 s)`);
        bot.onWalkNote({ note: null });
        expect(bot.getWalkNote()).toBeNull();
        expect(bot.getStatus()).not.toContain('error:');
    });

    it('a controller that accepts the target is unaffected', () => {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => sphereData,
            getStaticData: () => staticData,
            getActiveController: () => controller,
        });
        bot.onRegionMove({ targetRegion: 'region_a' });
        bot.play();
        expect(bot.getStatus()).not.toContain('error:');
        expect(controller.calls.some((c) => c.method === 'play')).toBe(true);
    });
});

describe('PlaybackBotUI — a substrate that declares no controller', () => {
    // The flash entries (and both Seedling entries built on them) omit
    // `getPlaybackController` on purpose. A walkTo into such a region used
    // to wait forever with no status; it is now a NAMED error. A declared
    // controller that returns null (a panel still mounting) stays silent.
    beforeEach(() => {
        substrateRegistry.clear();
        substrateRegistry.register({ id: 'flash_seedling_gen' });
        substrateRegistry.register({ id: 'maze', getPlaybackController: () => null });
    });
    afterEach(() => { substrateRegistry.clear(); });

    function makeBot(regionSubstrate) {
        const rulesJson = { preset_sidecars: { '1': { region_x: { substrate: regionSubstrate } } } };
        return new PlaybackBotUI({
            getSphereData: () => [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc X'] }],
            getStaticData: () => ({ regions: new Map([['region_x', { locations: [{ name: 'Loc X' }] }]]) }),
            getRulesJson: () => rulesJson,
        });
    }
    const statusText = (bot) => bot.getElement()
        .queryAll((el) => el.className === 'playback-bot-status')[0]?.textContent;

    it('names the substrate when its entry has no getPlaybackController', () => {
        const bot = makeBot('flash_seedling_gen');
        bot.onRegionMove({ targetRegion: 'region_x' });
        bot.play();
        expect(statusText(bot)).toBe('error: region_x is a flash_seedling_gen region, and '
            + 'flash_seedling_gen has no playback controller — the bot cannot walk it');
    });

    it('stays silent when the controller is declared but not yet available', () => {
        const bot = makeBot('maze');
        bot.onRegionMove({ targetRegion: 'region_x' });
        bot.play();
        expect(statusText(bot)).toBe('Sphere 0.1 → walking to "Loc X" (1/1)');
    });
});

/**
 * ⛓ RETURN TO MENU (procgenCore/restartRoute.js) — the bot's RESTART step. Where the slot declares
 * `exporter[p].return_to_menu` and no walk leads from the player's region to the head's, the bot takes the Menu
 * panel's Restart (stubbed here: the reset move to `Menu`, then the substrate's start hop) and routes on from the
 * arrival. It never publishes an exit walkTo for it.
 */
describe('PlaybackBotUI — the RESTART step (return_to_menu)', () => {
    // Menu -GameStart-> Start; Start -toB-> region_b; Start -drop-> Pit (one-way).
    const ADJ = {
        Menu: [['GameStart', 'Start']],
        Start: [['toB', 'region_b'], ['drop', 'Pit']],
        Pit: [],
        region_b: [['backS', 'Start']],
        region_c: [['cToB', 'region_b']],
    };
    const findPathWithExits = (from, to) => {
        const seen = new Set([from]);
        const queue = [[{ region: from, exitUsed: null }]];
        while (queue.length) {
            const path = queue.shift();
            const here = path[path.length - 1].region;
            if (here === to) return { steps: path, length: path.length - 1 };
            for (const [exit, next] of ADJ[here] ?? []) {
                if (!seen.has(next)) { seen.add(next); queue.push([...path, { region: next, exitUsed: exit }]); }
            }
        }
        return null;
    };
    const staticData = {
        regions: new Map([
            ['Pit', { locations: [] }],
            ['region_b', { locations: [{ name: 'Loc B' }] }],
        ]),
    };
    const rulesWith = (flag) => ({ start_regions: { 1: ['Menu'] }, exporter: { 1: flag ? { return_to_menu: true } : {} } });

    function makeBot({ flag = true, restart } = {}) {
        const controller = makeFakeController();
        const bot = new PlaybackBotUI({
            getSphereData: () => [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc B'] }],
            getStaticData: () => staticData,
            getRulesJson: () => rulesWith(flag),
            getActiveController: () => controller,
            pathFinder: { findPathWithExits },
            restart,
        });
        return { bot, controller };
    }
    /** The stubbed warp: the Menu panel's reset move, then (unless `hop: false`) the start hop. */
    function stubRestart(botRef, { hop = true, answer = { mode: 'world', target: 'Menu' } } = {}) {
        const calls = [];
        const fn = () => {
            calls.push(botRef.bot.getRestartPending());
            botRef.bot.onRegionMove({ targetRegion: 'Menu' });
            if (hop) botRef.bot.onRegionMove({ targetRegion: 'Start' });
            return answer;
        };
        return { fn, calls };
    }
    const walkTos = (controller) => controller.calls.filter((c) => c.method === 'walkTo').map((c) => c.args[0]);

    it('flag ON, stranded in the pit: Restart, land past Menu, then walk the start\'s exit', async () => {
        const ref = {};
        const r = stubRestart(ref);
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        await ref.bot.play();
        expect(r.calls).toEqual([{ from: 'Pit', target: 'Menu' }]);
        expect(walkTos(ref.controller)).toEqual([{ kind: 'exit', name: 'toB' }]);
        expect(ref.bot.getRestartPending()).toBeNull();
        expect(ref.bot.isActive()).toBe(true);
        expect(ref.bot.getLog().some((l) => /restarting \(no walk from Pit\) → region_b/.test(l))).toBe(true);
    });

    it('the bot WAITS on Menu for the start hop: no walkTo there, then routes on from the arrival', async () => {
        const ref = {};
        const r = stubRestart(ref, { hop: false });
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        await ref.bot.play();
        expect(walkTos(ref.controller)).toEqual([]);
        expect(ref.bot.getStatus()).toBe('restarted at Menu — waiting for the start hop');
        expect(ref.bot.getRestartPending()).toEqual({ from: 'Pit', target: 'Menu' });
        ref.bot.onRegionMove({ targetRegion: 'Start' });   // the substrate's start hop lands
        expect(walkTos(ref.controller)).toEqual([{ kind: 'exit', name: 'toB' }]);
        expect(ref.bot.getRestartPending()).toBeNull();
    });

    it('⛔ a RESTART step is never an exit crossing: no walkTo names Menu, GameStart or a null exit', async () => {
        const ref = {};
        const r = stubRestart(ref);
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        await ref.bot.play();
        for (const t of walkTos(ref.controller)) {
            expect(t.name).not.toBeNull();
            expect(['Menu', 'GameStart']).not.toContain(t.name);
        }
        expect(r.calls).toHaveLength(1);
    });

    it('flag OFF: today\'s refusal, and no Restart', async () => {
        const ref = {};
        const r = stubRestart(ref);
        Object.assign(ref, makeBot({ flag: false, restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        await ref.bot.play();
        expect(ref.bot.getStatus()).toBe('error: no path from Pit to region_b');
        expect(ref.bot.isActive()).toBe(false);
        expect(r.calls).toEqual([]);
    });

    it('a walk is preferred: from region_c the bot walks, never restarts', async () => {
        const ref = {};
        const r = stubRestart(ref);
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'region_c' });
        await ref.bot.play();
        expect(r.calls).toEqual([]);
        expect(walkTos(ref.controller)).toEqual([{ kind: 'exit', name: 'cToB' }]);
    });

    it('a manual target routes through the Restart too (walkToLocation)', async () => {
        const ref = {};
        const r = stubRestart(ref, { hop: false });
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        ref.bot.walkToLocation('Loc B');
        await Promise.resolve();
        expect(r.calls).toEqual([{ from: 'Pit', target: 'Menu' }]);
        expect(walkTos(ref.controller)).toEqual([]);
        ref.bot.onRegionMove({ targetRegion: 'Start' });
        await Promise.resolve();
        expect(walkTos(ref.controller)).toEqual([{ kind: 'exit', name: 'toB' }]);
    });

    it('named refusals: no Restart wired; a Restart that does not answer; a loop-mode Restart', async () => {
        const none = makeBot({ restart: null });
        none.bot.onRegionMove({ targetRegion: 'Pit' });
        await none.bot.play();
        expect(none.bot.getStatus()).toBe('error: Pit: the route needs a Restart and no Restart is wired');
        expect(none.bot.isActive()).toBe(false);

        const silent = makeBot({ restart: () => null });
        silent.bot.onRegionMove({ targetRegion: 'Pit' });
        await silent.bot.play();
        expect(silent.bot.getStatus()).toMatch(/Menu panel's Restart did not answer/);
        expect(silent.bot.getRestartPending()).toBeNull();

        const loop = makeBot({ restart: () => ({ mode: 'loop', target: null }) });
        loop.bot.onRegionMove({ targetRegion: 'Pit' });
        await loop.bot.play();
        expect(loop.bot.getStatus()).toMatch(/mode "loop", which does not return to the menu/);
        expect(loop.bot.isActive()).toBe(false);
    });

    it('stop() and reset() drop a pending Restart', async () => {
        const ref = {};
        const r = stubRestart(ref, { hop: false });
        Object.assign(ref, makeBot({ restart: r.fn }));
        ref.bot.onRegionMove({ targetRegion: 'Pit' });
        await ref.bot.play();
        expect(ref.bot.getRestartPending()).not.toBeNull();
        ref.bot.stop();
        expect(ref.bot.getRestartPending()).toBeNull();
    });
});

/**
 * ⛓ WAVE-6 CONSUMER — a walk that fails because the player's box ARRIVED INSIDE A SOLID (fidelity ARRIVAL's
 * `arrival-inside-solid`; the controller hands the bot `escape` = the refusal's `wayOut` in AP terms). No walk
 * leaves a solid: the bot takes the EXISTING Restart step when the refusal offers it and the slot declares
 * `return_to_menu`, and every later route avoids the entrance that landed inside, going by one of the refusal's
 * other arrivals. Otherwise a named stop. ⚖ No swing from inside.
 */
describe('PlaybackBotUI — an arrival inside a solid escapes by its wayOut', () => {
    // Menu -GameStart-> Start; Start -toL12-> L12 -inRock-> Pocket -toGoal-> region_g (the short way, through the
    // rock's landing); Start -toSide-> Side -sideDoor-> Hall -hallA-> HallB -toG-> region_g (the long way in).
    const ADJ = {
        Menu: [['GameStart', 'Start']],
        Start: [['toL12', 'L12'], ['toSide', 'Side']],
        L12: [['inRock', 'Pocket']],
        Pocket: [['toGoal', 'region_g']],
        Side: [['sideDoor', 'Hall']],
        Hall: [['hallA', 'HallB']],
        HallB: [['toG', 'region_g']],
        region_g: [],
    };
    const findPathWithExits = (from, to) => {
        const seen = new Set([from]);
        const queue = [[{ region: from, exitUsed: null }]];
        while (queue.length) {
            const path = queue.shift();
            const here = path[path.length - 1].region;
            if (here === to) return { steps: path, length: path.length - 1 };
            for (const [exit, next] of ADJ[here] ?? []) {
                if (!seen.has(next)) { seen.add(next); queue.push([...path, { region: next, exitUsed: exit }]); }
            }
        }
        return null;
    };
    const staticData = { regions: new Map([['region_g', { locations: [{ name: 'Loc G' }] }]]) };
    const rulesWith = (flag) => ({ start_regions: { 1: ['Menu'] }, exporter: { 1: flag ? { return_to_menu: true } : {} } });
    const ESCAPE = Object.freeze({
        kind: 'arrival-inside-solid', solids: ['breakablerock@288,176'], at: { level: 0, x: 296, y: 184 },
        restart: true, arrivals: [{ region: 'Side', exit: 'sideDoor', landing: 'Hall', from: 2, door: 'stairs@48,16' }],
        unmapped: [],
    });
    const FAILED = (escape = ESCAPE) => ({
        substrate: 'flash_seedling', target: { kind: 'exit', name: 'toGoal' },
        reason: 'the wasm playback failed: the solver declined toGoal in level 0 (refusal): … arrival-inside-solid …',
        ...(escape ? { escape } : {}),
    });

    function makeBot({ flag = true } = {}) {
        const controller = makeFakeController();
        const calls = [];
        const ref = {};
        ref.restart = () => {
            calls.push(ref.bot.getRestartPending());
            ref.bot.onRegionMove({ targetRegion: 'Menu' });
            ref.bot.onRegionMove({ targetRegion: 'Start' });
            return { mode: 'world', target: 'Menu' };
        };
        ref.bot = new PlaybackBotUI({
            getSphereData: () => [{ sphereIndex: 0, fractionalIndex: 1, locations: ['Loc G'] }],
            getStaticData: () => staticData,
            getRulesJson: () => rulesWith(flag),
            getActiveController: () => controller,
            pathFinder: { findPathWithExits },
            restart: () => ref.restart(),
        });
        return { bot: ref.bot, controller, calls };
    }
    const walkTos = (controller) => controller.calls.filter((c) => c.method === 'walkTo').map((c) => c.args[0].name);
    /** Walk the short way in: Start → L12 → (inRock) Pocket, as the crossings report them. */
    async function intoThePocket(t) {
        t.bot.onRegionMove({ targetRegion: 'Start' });
        await t.bot.play();
        t.bot.onRegionMove({ targetRegion: 'L12', exitName: 'toL12' });
        t.bot.onRegionMove({ targetRegion: 'Pocket', exitName: 'inRock' });
        expect(walkTos(t.controller)).toEqual(['toL12', 'inRock', 'toGoal']);
    }

    it('flag ON + a Restart offer: Restart, then route AROUND the entrance that landed inside (another arrival)', async () => {
        const t = makeBot();
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED());
        expect(t.calls).toEqual([{ from: 'Pocket', target: 'Menu' }]);
        // from the start the short way would cross `inRock` again: the route goes by the refusal's other arrival
        expect(walkTos(t.controller).slice(3)).toEqual(['toSide']);
        expect(t.bot.isActive()).toBe(true);
        expect(t.bot.getLog().some((l) => /escaping arrival-inside-solid \(breakablerock@288,176 at L0 \(296,184\)\) in Pocket — Restart, then routing around "inRock"/.test(l))).toBe(true);
        expect(t.bot.getEscapes()).toEqual({ escapes: [{ from: 'Pocket', exit: 'inRock', solids: ['breakablerock@288,176'],
            at: { level: 0, x: 296, y: 184 } }], avoided: ['inRock'] });
        t.bot.onRegionMove({ targetRegion: 'Side', exitName: 'toSide' });
        expect(walkTos(t.controller).at(-1)).toBe('sideDoor');
    });

    it('flag OFF: a NAMED stop carrying the way out, and no Restart', async () => {
        const t = makeBot({ flag: false });
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED());
        expect(t.calls).toEqual([]);
        expect(t.bot.getStatus()).toMatch(/^error: Pocket: the bot cannot walk to exit "toGoal" — .* — arrival-inside-solid: the player's box in Pocket is inside breakablerock@288,176 and no walk leaves it; the way out is the Menu's Restart, and this slot does not declare return_to_menu; other arrivals: sideDoor$/);
        expect(t.bot.getEscapes().escapes).toEqual([]);
    });

    it('no Restart in the wayOut: a named stop (the other arrivals cannot be walked to from inside a solid)', async () => {
        const t = makeBot();
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED({ ...ESCAPE, restart: false }));
        expect(t.calls).toEqual([]);
        expect(t.bot.getStatus()).toMatch(/the refusal offers no Restart; other arrivals: sideDoor$/);
    });

    it('a failure with no escape (no wayOut) is today\'s named status, word for word', async () => {
        const t = makeBot();
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED(null));
        expect(t.calls).toEqual([]);
        expect(t.bot.getStatus()).toBe(`error: Pocket: the bot cannot walk to exit "toGoal" — ${FAILED(null).reason}`);
    });

    it('landing inside AGAIN after an escape is a named stop, never a loop of Restarts', async () => {
        const t = makeBot();
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED());
        t.bot.onRegionMove({ targetRegion: 'Pocket', exitName: 'inRock' });   // something put it back in the pocket
        t.bot.onWalkFailed(FAILED());
        expect(t.calls).toHaveLength(1);
        expect(t.bot.getStatus()).toMatch(/the route landed inside it again after a Restart/);
    });

    it('no other arrival and no clean route from the start: Restart, then the route\'s own named refusal', async () => {
        const t = makeBot();
        await intoThePocket(t);
        t.bot.onWalkFailed(FAILED({ ...ESCAPE, arrivals: [] }));
        expect(t.calls).toHaveLength(1);
        // the long way exists in this graph, but the refusal names no arrival on it: the detours are the solver's
        // `wayOut` only (no second graph search), so the avoided route is refused by name
        expect(t.bot.getStatus()).toBe('error: no path from Start to region_g, nor from the restart target Menu');
        expect(t.bot.isActive()).toBe(false);
    });
});

/**
 * ⛓ OBSTACLE EVENTS (procgenCore/eventRoute.js) — BREAK BEFORE FIRST USE in the bot. A game-state event is never a
 * queue row (the game breaks it; walking to it would break it eagerly); where the graph's walk has none, the route
 * meets the event by CROSSING CREDIT (a hop through the obstacle at its own cost — remembered until the collector
 * sees the flag) or by a goal-first BREAK step, before any Restart.
 */
describe('PlaybackBotUI — obstacle events (break before first use)', () => {
    const SWORD = { rule: 'Has', args: { item_name: 'Sword' } };
    const ROCK = 'L9 flag 1: breakablerock@16,16 cleared';
    const WALL = 'L9 flag 2: breakablerock@64,16 cleared';
    const ev = (name, tag, across) => ({ name, id: null, event: true, event_kind: 'game_state', event_id: `flag:L9:${tag}`,
        access_rule: SWORD, item: { name }, obstacle: { level: 9, tag, class: 'breakablerock', x: tag === 1 ? 16 : 64, y: 16 },
        action: { verb: 'broken by a sword strike', item: 'hasSword' }, side: 'Start', across });
    const x = (name, to, rule = null) => ({ name, connected_region: to, ...(rule ? { access_rule: rule } : {}) });
    const has = (item) => ({ rule: 'Has', args: { item_name: item } });
    const RULES = {
        start_regions: { 1: ['Menu'] },
        exporter: { 1: {} },
        regions: { 1: {
            Menu: { exits: [x('GameStart', 'Start')], locations: [] },
            Start: { exits: [x('Start -> Pocket', 'Pocket', SWORD), x('Start -> Far2', 'Far2')],
                locations: [ev(ROCK, 1, ['Pocket']), ev(WALL, 2, []),
                    { name: 'Odd', id: null, event: true, event_kind: 'future_kind', item: { name: 'Odd' } }] },
            Pocket: { exits: [x('Pocket -> Gem', 'Gem')], locations: [] },
            Gem: { exits: [x('Gem -> Lander', 'Lander')], locations: [] },
            Lander: { exits: [x('Lander -> Vault2', 'Vault2', has(ROCK))], locations: [] },
            Vault2: { exits: [], locations: [{ name: 'Loc V2', id: 2 }] },
            Far2: { exits: [x('Far2 -> Vault', 'Vault', has(WALL)), x('Far2 -> Start', 'Start')], locations: [] },
            Vault: { exits: [], locations: [{ name: 'Loc V', id: 1 }] },
        } },
    };
    const REGIONS = RULES.regions[1];
    const staticData = { regions: new Map(Object.entries(REGIONS)) };

    function makeBot({ sphere, inventory = { Sword: 1 }, proxy = true } = {}) {
        const controller = makeFakeController();
        const snapshot = { inventory: { ...inventory } };
        // The graph's own walk (PathFinder's role): only exits whose rule the SNAPSHOT satisfies.
        const findPathWithExits = (from, to) => {
            const ok = (rule) => !rule || (snapshot.inventory[rule.args.item_name] ?? 0) > 0;
            const seen = new Set([from]);
            const queue = [[{ region: from, exitUsed: null }]];
            while (queue.length) {
                const path = queue.shift();
                const here = path[path.length - 1].region;
                if (here === to) return { steps: path, length: path.length - 1 };
                for (const e of REGIONS[here]?.exits ?? []) {
                    if (!seen.has(e.connected_region) && ok(e.access_rule)) {
                        seen.add(e.connected_region);
                        queue.push([...path, { region: e.connected_region, exitUsed: e.name }]);
                    }
                }
            }
            return null;
        };
        const bot = new PlaybackBotUI({
            getSphereData: () => sphere,
            getStaticData: () => staticData,
            getRulesJson: () => RULES,
            getActiveController: () => controller,
            pathFinder: { findPathWithExits },
            stateManagerProxy: proxy ? { getLatestStateSnapshot: () => snapshot } : null,
        });
        return { bot, controller, snapshot };
    }
    const walkTos = (controller) => controller.calls.filter((c) => c.method === 'walkTo').map((c) => c.args[0]);
    const sphereOf = (...locations) => [{ sphereIndex: 1, fractionalIndex: 1, locations }];

    it('the queue LEAVES game-state events to the game (never walked eagerly); an unknown kind stays a row (refused by name)', async () => {
        const { bot } = makeBot({ sphere: sphereOf(ROCK, 'Loc V2', WALL, 'Odd') });
        bot.onRegionMove({ targetRegion: 'Start' });
        bot._ensureQueueBuilt();
        expect(bot._queue.map((q) => q.locationName)).toEqual(['Loc V2', 'Odd']);
        expect(bot.getEventState().leftToGame).toEqual([ROCK, WALL]);
    });

    it('GOAL FIRST: the graph has no walk to the Vault (its landing is inside the wall) → the bot walks to the wall to break it', async () => {
        const { bot, controller } = makeBot({ sphere: sphereOf('Loc V') });
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(walkTos(controller)).toEqual([{ kind: 'location', name: WALL }]);
        expect(bot.getStatus()).toMatch(/breaking breakablerock@64,16 first \(flag:L9:2\) — the route to Vault/);
    });

    it('CROSSING CREDIT: Start → Pocket passes through the rock at its own cost — walked, credited, and the gated landing is taken later', async () => {
        const { bot, controller } = makeBot({ sphere: sphereOf('Loc V2') });
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(walkTos(controller)).toEqual([{ kind: 'exit', name: 'Start -> Pocket' }]);
        expect(bot.getEventState().credited).toEqual([ROCK]);
        bot.onRegionMove({ targetRegion: 'Pocket', exitName: 'Start -> Pocket' });
        await Promise.resolve();
        bot.onRegionMove({ targetRegion: 'Gem', exitName: 'Pocket -> Gem' });
        await Promise.resolve();
        bot.onRegionMove({ targetRegion: 'Lander', exitName: 'Gem -> Lander' });
        await Promise.resolve();
        // the snapshot still lacks the event (the collector has not seen the flag): the credit routes the gated landing
        expect(walkTos(controller).at(-1)).toEqual({ kind: 'exit', name: 'Lander -> Vault2' });
        expect(bot.getLog().some((l) => /credits "L9 flag 1: breakablerock@16,16 cleared"/.test(l))).toBe(true);
        bot.reset();
        expect(bot.getEventState().credited).toEqual([]);
    });

    it('no snapshot (no state manager) → no event path: today\'s named refusal', async () => {
        const { bot } = makeBot({ sphere: sphereOf('Loc V'), proxy: false });
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(bot.getStatus()).toBe('error: no path from Start to Vault');
    });

    it('without the breaking item no event route exists: today\'s refusal', async () => {
        const { bot } = makeBot({ sphere: sphereOf('Loc V'), inventory: {} });
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(bot.getStatus()).toBe('error: no path from Start to Vault');
    });
});
