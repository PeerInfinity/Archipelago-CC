/**
 * ⛓ WALK ORDER (`walkOrder.js`) — the bot's non-default walk orders, pure and driven.
 *
 * The graph: Menu -GameStart-> Start; Start <-> East; Start -> Hall -> Pit (one-way into the Pit). Sphere 0 lists the
 * Pit's chest before East's (alphabetical, as the exporter numbers fractional spheres). In order, the bot walks two
 * hops into the Pit and must Restart out for East; by cost it takes East (1 hop) first and walks to the Pit last.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WALK_ORDERS, chooseWalkTarget, frozenFindPath, goalItemOf, integerSphereOf, rowMetaOf, walkCandidates } from './walkOrder.js';
import { PlaybackBotUI } from './playbackBotUI.js';

const row = (locationName, regionName, sphereIndex, fractionalIndex) => ({ locationName, regionName, sphereIndex, fractionalIndex });

describe('walkOrder — pure', () => {
    const queue = [row('A', 'Pit', 0, 1), row('B', 'East', 0, 2), row('C', 'Far', 1, 1), row('G', 'Pit', 2, 1)];
    const meta = new Map([['G', { item: 'Victory', progression: true, goal: true }], ['C', { progression: true }]]);

    it('candidates: the lowest open integer sphere, or every accessible row', () => {
        const checked = new Set(['A']);
        expect(walkCandidates({ order: WALK_ORDERS.sphereCheapest, queue, checked }).map((e) => e.locationName)).toEqual(['B']);
        expect(walkCandidates({ order: WALK_ORDERS.reachableCheapest, queue, checked, isAccessible: (n) => n !== 'C' })
            .map((e) => e.locationName)).toEqual(['B', 'G']);
    });

    it('the integer sphere reads both shapes: a number, or sphereState\'s whole label ("1.10")', () => {
        expect([0, '0.4', '1.10', '12', null, undefined].map((s) => integerSphereOf({ sphereIndex: s }))).toEqual([0, 0, 1, 12, null, null]);
        const labelled = [row('A', 'Pit', '0.1', null), row('B', 'East', '0.2', null), row('C', 'Far', '1.1', null)];
        expect(walkCandidates({ order: WALK_ORDERS.sphereCheapest, queue: labelled, checked: new Set(['A']) })
            .map((e) => e.locationName)).toEqual(['B']);
    });

    it('cheapest by restarts then hops; the goal last; a candidate with no route falls back to the listed head', () => {
        const prices = { A: { hops: 2, restart: false }, B: { hops: 1, restart: false }, C: { hops: 1, restart: true }, G: { hops: 0, restart: false } };
        const price = (e) => prices[e.locationName] ?? null;
        const pick = (checked, order) => chooseWalkTarget({ order, queue, checked: new Set(checked), meta, price }).entry?.locationName;
        expect(pick([], WALK_ORDERS.reachableCheapest)).toBe('B');
        expect(pick(['B'], WALK_ORDERS.reachableCheapest)).toBe('A');          // G is nearer, but the goal goes last
        expect(pick(['A', 'B'], WALK_ORDERS.reachableCheapest)).toBe('C');     // a Restart beats nothing; G still last
        expect(pick(['A', 'B', 'C'], WALK_ORDERS.reachableCheapest)).toBe('G');
        expect(chooseWalkTarget({ order: WALK_ORDERS.reachableCheapest, queue, checked: new Set(), price: () => null })
            .entry.locationName).toBe('A');
        expect(chooseWalkTarget({ order: WALK_ORDERS.sphereCheapest, queue, checked: new Set(['A', 'B', 'C', 'G']), price })
            .entry).toBeNull();
    });

    it('sphere-cheapest SWEEPS a pocket: before a Restart out, a walkable later row is taken (never the goal)', () => {
        const q = [row('X', 'Far', 0, 1), row('Y', 'Pit', 1, 1), row('G', 'Pit', 2, 1)];
        const price = (e) => (e.regionName === 'Pit' ? { hops: 0, restart: false } : { hops: 3, restart: true });
        const choose = (inPocket, checked = []) => chooseWalkTarget({ order: WALK_ORDERS.sphereCheapest, queue: q,
            checked: new Set(checked), meta, price, inPocket: () => inPocket });
        expect(choose(true)).toMatchObject({ entry: { locationName: 'Y' }, swept: true });
        expect(choose(false)).toMatchObject({ entry: { locationName: 'X' }, swept: false });
        expect(choose(true, ['Y'])).toMatchObject({ entry: { locationName: 'X' }, swept: false });
    });

    it('rowMetaOf / goalItemOf read the rules', () => {
        const rules = { regions: { 1: { R: { locations: [{ name: 'L', item: { name: 'Victory', advancement: true } }, { name: 'M', item: 'Coin' }] } } },
            game_info: { 1: { completion_condition: { type: 'item_check', item: 'Victory' } } } };
        expect(goalItemOf(rules)).toBe('Victory');
        expect(rowMetaOf(rules).get('L')).toEqual({ item: 'Victory', progression: true, goal: true });
        expect(rowMetaOf(rules).get('M')).toEqual({ item: 'Coin', progression: false, goal: false });
    });

    it('frozenFindPath: one accessibility map, the PathFinder BFS shape; per call without the map hook', () => {
        let builds = 0;
        const adjacency = new Map([['S', [{ region: 'A', exitName: 'sa' }]], ['A', [{ region: 'B', exitName: 'ab' }]], ['B', []]]);
        const pf = { buildAccessibilityMap: () => { builds += 1; return adjacency; } };
        const find = frozenFindPath(pf, { staticData: { regions: new Map() }, snapshot: {}, snapshotInterface: {} });
        expect(find('S', 'B')).toEqual({ steps: [{ region: 'S', exitUsed: null }, { region: 'A', exitUsed: 'sa' },
            { region: 'B', exitUsed: 'ab' }], length: 2 });
        expect(find('B', 'S')).toBeNull();
        expect(find('A', 'A').length).toBe(0);
        expect(builds).toBe(1);
        const calls = [];
        const perCall = frozenFindPath({ findPathWithExits: (a, b) => { calls.push([a, b]); return null; } }, {});
        perCall('S', 'B');
        expect(calls).toEqual([['S', 'B']]);
    });
});

// ---- the bot, driven -------------------------------------------------------------------------------------------

class El {
    constructor() { this.children = []; this.value = ''; this.disabled = false; this.textContent = ''; this.className = ''; this.title = ''; this.innerHTML = ''; this.classList = { add() {}, remove() {}, contains() { return false; }, toggle() {} }; }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
    insertBefore(c) { return this.appendChild(c); }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
    addEventListener() {}
    removeEventListener() {}
}
beforeEach(() => { globalThis.document = { createElement: () => new El() }; });
afterEach(() => { delete globalThis.document; });

describe('walkOrder — the bot walks by cost', () => {
    const ADJ = {
        Menu: [['GameStart', 'Start']],
        Start: [['toEast', 'East'], ['toHall', 'Hall']],
        East: [['toStart', 'Start']],
        Hall: [['drop', 'Pit']],
        Pit: [],
    };
    const findPathWithExits = (from, to) => {
        const seen = new Set([from]);
        const q = [[{ region: from, exitUsed: null }]];
        while (q.length) {
            const path = q.shift();
            const here = path[path.length - 1].region;
            if (here === to) return { steps: path, length: path.length - 1 };
            for (const [exit, next] of ADJ[here] ?? []) if (!seen.has(next)) { seen.add(next); q.push([...path, { region: next, exitUsed: exit }]); }
        }
        return null;
    };
    const rules = {
        regions: { 1: { Menu: { exits: [{ name: 'GameStart', connected_region: 'Start' }] }, Pit: { locations: [{ name: 'A Pit' }, { name: 'Z Pit' }] },
            East: { locations: [{ name: 'B East' }] } } },
        start_regions: { 1: { default: ['Menu'] } },
        exporter: { 1: { return_to_menu: true } },
    };
    const staticData = { regions: new Map([['Pit', { locations: [{ name: 'A Pit' }, { name: 'Z Pit' }] }], ['East', { locations: [{ name: 'B East' }] }]]) };

    function makeBot() {
        const calls = [];
        const controller = new Proxy({}, { get: (_t, m) => (m === 'then' ? undefined : (...args) => { calls.push({ method: m, args }); }) });
        const ref = {};
        const restart = () => {
            ref.bot.onRegionMove({ targetRegion: 'Menu' });
            ref.bot.onRegionMove({ targetRegion: 'Start' });
            return { mode: 'world', target: 'Menu' };
        };
        ref.bot = new PlaybackBotUI({
            // sphereState's own shape: the whole label as `sphereIndex` (the live page's; see `integerSphereOf`)
            getSphereData: () => [{ sphereIndex: '0.1', locations: ['A Pit'] }, { sphereIndex: '0.2', locations: ['B East'] },
                { sphereIndex: '1.1', locations: ['Z Pit'] }],
            getStaticData: () => staticData,
            getRulesJson: () => rules,
            getActiveController: () => controller,
            pathFinder: { findPathWithExits },
            restart,
        });
        const walkTos = () => calls.filter((c) => c.method === 'walkTo').map((c) => c.args[0]);
        return { bot: ref.bot, walkTos };
    }
    /** Walk the bot's published exits until its walkTo is a location, then check it; returns the location order. */
    async function drive(bot, walkTos, steps = 20) {
        const visited = [];
        let seen = 0;
        for (let i = 0; i < steps && bot.isActive(); i += 1) {
            const all = walkTos();
            if (all.length === seen) break;
            const t = all[all.length - 1];
            seen = all.length;
            if (t.kind === 'exit') {
                const here = bot.getCurrentRegion();
                bot.onRegionMove({ targetRegion: ADJ[here].find(([e]) => e === t.name)[1], exitName: t.name });
            } else {
                visited.push(t.name);
                bot.onLocationCheck({ locationName: t.name });
            }
        }
        return visited;
    }

    it('the default order is listed: into the Pit first, then a Restart for East', async () => {
        const { bot, walkTos } = makeBot();
        expect(bot.getWalkOrder()).toBe(WALK_ORDERS.inOrder);
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(await drive(bot, walkTos)).toEqual(['A Pit', 'B East', 'Z Pit']);
        expect(bot.getRouteStats()).toMatchObject({ restarts: 1, legs: 3 });
        expect(bot.getStatus()).toMatch(/^finished — 3 locations visited/);
    });

    for (const order of [WALK_ORDERS.sphereCheapest, WALK_ORDERS.reachableCheapest]) {
        it(`${order}: East first, the Pit last, no Restart`, async () => {
            const { bot, walkTos } = makeBot();
            bot.setWalkOrder(order);
            bot.onRegionMove({ targetRegion: 'Start' });
            await bot.play();
            expect(walkTos()[0]).toEqual({ kind: 'exit', name: 'toEast' });
            expect(bot.getCurrentHead().locationName).toBe('B East');
            expect(await drive(bot, walkTos)).toEqual(['B East', 'A Pit', 'Z Pit']);
            expect(bot.getRouteStats()).toEqual({ restarts: 0, transitions: 4, legs: 3 });
            expect(bot.getStatus()).toMatch(/^finished — 3 locations visited/);
        });
    }

    it('the walk order applies to the sphere source only, and a change stops a running walk', async () => {
        const { bot } = makeBot();
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(bot.isActive()).toBe(true);
        bot.setWalkOrder(WALK_ORDERS.reachableCheapest);
        expect(bot.isActive()).toBe(false);
        expect(bot.getWalkOrder()).toBe(WALK_ORDERS.reachableCheapest);
        bot.setWalkOrder('bogus');
        expect(bot.getWalkOrder()).toBe(WALK_ORDERS.reachableCheapest);
    });
});
