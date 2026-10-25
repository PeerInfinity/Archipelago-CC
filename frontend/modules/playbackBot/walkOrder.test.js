/**
 * ⛓ WALK ORDER (`walkOrder.js`) — the bot's non-default walk orders, pure and driven.
 *
 * The graph: Menu -GameStart-> Start; Start <-> East; Start -> Hall -> Pit (one-way into the Pit). Sphere 0 lists the
 * Pit's chest before East's (alphabetical, as the exporter numbers fractional spheres). In order, the bot walks two
 * hops into the Pit and must Restart out for East; by cost it takes East (1 hop) first and walks to the Pit last.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WALK_ORDERS, chooseWalkTarget, frozenFindPath, goalItemOf, hypotheticalFindPath, integerSphereOf, parseWalkOrder, rowMetaOf,
    walkCandidates } from './walkOrder.js';
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

    it('goalItemOf reads a Rule Builder Has of one copy too; several copies or another shape name no goal row', () => {
        const cc = (completion_condition) => ({ game_info: { 1: { completion_condition } } });
        expect(goalItemOf(cc({ rule: 'Has', args: { item_name: 'Victory' } }))).toBe('Victory');
        expect(goalItemOf(cc({ rule: 'Has', args: { item_name: 'Victory', count: 1 } }))).toBe('Victory');
        expect(goalItemOf(cc({ rule: 'Has', args: { item_name: 'Music Sheet', count: 7 } }))).toBeNull();
        expect(goalItemOf(cc({ type: 'and', conditions: [] }))).toBeNull();
        expect(goalItemOf({})).toBeNull();
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

    // ⛓ POCKET-ITEM — a fake PathFinder with the real one's contract: it links only regions the snapshot holds
    //   reachable, under exit rules read through the interface (here: `{item}` = that item held).
    const REGIONS = new Map([
        ['Home', { exits: [{ name: 'toPit', connected_region: 'Pit' }, { name: 'toEast', connected_region: 'East' }] }],
        ['East', { exits: [{ name: 'eastHome', connected_region: 'Home' }] }],
        ['Pit', { exits: [{ name: 'pitLedge', connected_region: 'Ledge', access_rule: { item: 'Key' } }] }],
        ['Ledge', { exits: [{ name: 'ledgeHome', connected_region: 'Home' }] }],
    ]);
    const fakePathFinder = {
        isRegionReachable: (r, snap) => snap.regionReachability?.[r] === true,
        buildAccessibilityMap(staticData, snap, iface) {
            const adj = new Map([...staticData.regions.keys()].map((r) => [r, []]));
            for (const [r, data] of staticData.regions) {
                if (!this.isRegionReachable(r, snap)) continue;
                for (const e of data.exits ?? []) {
                    if (!this.isRegionReachable(e.connected_region, snap)) continue;
                    if (!e.access_rule || evaluate(e.access_rule, iface)) adj.get(r).push({ region: e.connected_region, exitName: e.name });
                }
            }
            return adj;
        },
    };
    const evaluate = (rule, iface) => Number(iface.inventory[rule.item] ?? 0) > 0;
    const liveSnapshot = () => ({ inventory: { Coin: 1 }, regionReachability: { Home: true, East: true, Pit: true } });

    it('hypotheticalFindPath: the Key opens a region the snapshot never reached; the live state is untouched', () => {
        const snapshot = liveSnapshot();
        const before = JSON.stringify(snapshot);
        const interfaces = [];
        const makeInterface = (snap) => { const i = { inventory: snap.inventory }; interfaces.push(snap); return i; };
        const staticData = { regions: REGIONS };
        const live = hypotheticalFindPath(fakePathFinder, { staticData, snapshot, makeInterface, evaluate, extra: [] });
        expect(live('Pit', 'Home')).toBeNull();
        const withKey = hypotheticalFindPath(fakePathFinder, { staticData, snapshot, makeInterface, evaluate, extra: ['Key'] });
        expect(withKey('Pit', 'Home')?.steps.map((st) => st.region)).toEqual(['Pit', 'Ledge', 'Home']);
        expect(JSON.stringify(snapshot)).toBe(before);
        // a fresh state object per interface (the rule engine's helper cache is per context, blind to the inventory)
        expect(new Set(interfaces).size).toBe(interfaces.length);
        expect(interfaces.every((st) => st !== snapshot)).toBe(true);
        expect(hypotheticalFindPath(fakePathFinder, { staticData, snapshot, extra: ['Key'] })).toBeNull();   // no interface maker
    });

    it('+pocket-item: a pocket its own item opens is no pocket; the same pocket holding a Coin is entered last', () => {
        const q = [row('P', 'Pit', '0.1', null), row('E', 'East', '0.2', null)];
        const staticData = { regions: REGIONS };
        const choose = (pitItem) => {
            const meta = new Map([['P', { item: pitItem }], ['E', { item: 'Coin' }]]);
            const isPocket = (entry) => {
                const out = hypotheticalFindPath(fakePathFinder, { staticData, snapshot: liveSnapshot(), evaluate,
                    makeInterface: (snap) => ({ inventory: snap.inventory }), extra: [meta.get(entry.locationName).item] });
                return entry.regionName !== 'Home' && !out(entry.regionName, 'Home');
            };
            return chooseWalkTarget({ order: WALK_ORDERS.reachablePocketItem, queue: q, checked: new Set(), meta,
                price: () => ({ hops: 1, restart: false }), isPocket }).entry.locationName;
        };
        expect(choose('Key')).toBe('P');     // listed first, and its Key walks out
        expect(choose('Coin')).toBe('E');    // a pocket owes a Restart: East first
        // without the modifier the pocket is not priced, and the listed head wins the tie
        expect(chooseWalkTarget({ order: WALK_ORDERS.reachableCheapest, queue: q, checked: new Set(),
            price: () => ({ hops: 1, restart: false }), isPocket: () => true }).entry.locationName).toBe('P');
        expect(parseWalkOrder(WALK_ORDERS.reachablePocketItemGrab)).toEqual({ scope: 'reachable-cheapest', pocketItem: true, grab: true, lookahead: 0 });
    });

    it('+grab: a row on the route at zero detour goes first; a row off it does not', () => {
        // Start -> Hall -> Pit (target, 2 hops); Hall is on the way; Side is 1 hop but 3 hops from the Pit
        const hops = { Start: { Hall: 1, Pit: 2, Side: 1 }, Hall: { Pit: 1 }, Side: { Pit: 3 } };
        const q = [row('T', 'Pit', '0.1', null), row('H', 'Hall', '1.1', null), row('S', 'Side', '1.2', null)];
        const between = (from, to) => (hops[from]?.[to] !== undefined ? { hops: hops[from][to], restart: false } : null);
        const pick = (queue) => chooseWalkTarget({ order: WALK_ORDERS.sphereCheapestGrab, queue, checked: new Set(),
            price: (e) => between('Start', e.regionName), priceBetween: (a, b) => between(a.regionName, b.regionName) });
        expect(pick(q)).toMatchObject({ entry: { locationName: 'H' }, grabbed: { locationName: 'H' } });
        expect(pick(q.filter((e) => e.locationName !== 'H'))).toMatchObject({ entry: { locationName: 'T' }, grabbed: null });
        // the same queue without the modifier: the sphere's own row
        expect(chooseWalkTarget({ order: WALK_ORDERS.sphereCheapest, queue: q, checked: new Set(),
            price: (e) => between('Start', e.regionName) }).entry.locationName).toBe('T');
    });

    // ⛓ LOOKAHEAD (bot-route-chooser-2b) — `step` = one hypothetical step: accessibility and prices from the row's region.
    const hopsTable = { Start: { RA: 1, RB: 2, RN: 5 }, RA: { RB: 10, RN: 0 }, RB: { RA: 2, RN: 9 }, RN: { RB: 10 } };
    const between = (from, to) => (from === to ? { hops: 0, restart: false }
        : hopsTable[from]?.[to] !== undefined ? { hops: hopsTable[from][to], restart: false } : null);
    const lookQueue = [row('A', 'RA', '0.1', null), row('B', 'RB', '0.2', null), row('N', 'RN', '0.3', null)];
    const choose = (order, { accessibleAfterA = false, steps = null } = {}) => chooseWalkTarget({
        order, queue: lookQueue, checked: new Set(), isAccessible: (n) => n !== 'N', price: (e) => between('Start', e.regionName),
        step: (entry, at) => {
            steps?.push([entry.locationName, at]);
            return { at: { region: entry.regionName },
                isAccessible: (n) => n !== 'N' || (accessibleAfterA && entry.locationName === 'A'),
                price: (next) => between(entry.regionName, next.regionName) };
        },
    });

    it('+lookahead: the 2-row sequence beats the nearest row; a row the first item opens counts in the second step', () => {
        expect(parseWalkOrder(WALK_ORDERS.reachableLookahead)).toEqual({ scope: 'reachable-cheapest', pocketItem: false, grab: false, lookahead: 2 });
        expect(parseWalkOrder('reachable-cheapest+lookahead3').lookahead).toBe(3);
        // greedy: A (1). Lookahead: A then B = 11, B then A = 4 → B
        expect(choose(WALK_ORDERS.reachableCheapest).entry.locationName).toBe('A');
        const steps = [];
        const look = choose(WALK_ORDERS.reachableLookahead, { steps });
        expect(look.entry.locationName).toBe('B');
        expect(look.ranked[0].price).toMatchObject({ hops: 4, restarts: 0, lead: 2 });
        expect(steps.map(([n, at]) => [n, at])).toEqual([['A', undefined], ['B', undefined]]);   // one step per candidate (k=2)
        // A's item opens N, 0 hops from A: A then N = 1 beats B then A = 4 — the step's own accessibility counts
        expect(choose(WALK_ORDERS.reachableLookahead, { accessibleAfterA: true }).entry.locationName).toBe('A');
        // no step hook: plain greedy
        expect(chooseWalkTarget({ order: WALK_ORDERS.reachableLookahead, queue: lookQueue, checked: new Set(),
            isAccessible: (n) => n !== 'N', price: (e) => between('Start', e.regionName) }).entry.locationName).toBe('A');
    });

    it('hypotheticalFindPath answers location accessibility in the hypothetical state', () => {
        const staticData = { regions: REGIONS };
        const makeInterface = (snap) => ({ inventory: snap.inventory,
            isLocationAccessible: (name) => name === 'Ledge Chest' && snap.regionReachability?.Ledge === true });
        const live = hypotheticalFindPath(fakePathFinder, { staticData, snapshot: liveSnapshot(), makeInterface, evaluate, extra: [] });
        const withKey = hypotheticalFindPath(fakePathFinder, { staticData, snapshot: liveSnapshot(), makeInterface, evaluate, extra: ['Key'] });
        expect(live.isLocationAccessible('Ledge Chest')).toBe(false);
        expect(withKey.isLocationAccessible('Ledge Chest')).toBe(true);
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
            East: { locations: [{ name: 'B East' }] }, Hall: { locations: [{ name: 'H Hall' }] } } },
        start_regions: { 1: { default: ['Menu'] } },
        exporter: { 1: { return_to_menu: true } },
    };
    const staticData = { regions: new Map([['Pit', { locations: [{ name: 'A Pit' }, { name: 'Z Pit' }] }], ['East', { locations: [{ name: 'B East' }] }],
        ['Hall', { locations: [{ name: 'H Hall' }] }]]) };

    function makeBot({ spheres = null } = {}) {
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
            getSphereData: () => spheres ?? [{ sphereIndex: '0.1', locations: ['A Pit'] }, { sphereIndex: '0.2', locations: ['B East'] },
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

    it('sphere-cheapest+sweep+grab: the Hall row (a later sphere) is grabbed on the way into the Pit — no Restart', async () => {
        const spheres = [{ sphereIndex: '0.1', locations: ['A Pit'] }, { sphereIndex: '0.2', locations: ['B East'] },
            { sphereIndex: '1.1', locations: ['H Hall'] }, { sphereIndex: '2.1', locations: ['Z Pit'] }];
        const plain = makeBot({ spheres });
        plain.bot.setWalkOrder(WALK_ORDERS.sphereCheapest);
        plain.bot.onRegionMove({ targetRegion: 'Start' });
        await plain.bot.play();
        expect(await drive(plain.bot, plain.walkTos)).toEqual(['B East', 'A Pit', 'Z Pit', 'H Hall']);   // swept Z, then Restart
        expect(plain.bot.getRouteStats()).toMatchObject({ restarts: 1 });
        const { bot, walkTos } = makeBot({ spheres });
        bot.setWalkOrder(WALK_ORDERS.sphereCheapestGrab);
        bot.onRegionMove({ targetRegion: 'Start' });
        await bot.play();
        expect(await drive(bot, walkTos)).toEqual(['B East', 'H Hall', 'A Pit', 'Z Pit']);
        expect(bot.getRouteStats()).toEqual({ restarts: 0, transitions: 4, legs: 4 });
        expect(bot.getChoiceTimings()).toMatchObject({ choices: 4, hypotheticals: 0 });
    });

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
