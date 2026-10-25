/**
 * ⛓ WALK ORDER (slice `bot-route-chooser`) — **WHICH SPHERE-LOG ROW THE BOT WALKS TO NEXT.** The walk loop's target
 * source when the bot checks the sphere log (`targetSource === 'sphere'`):
 *
 *  - `sphere-in-order` (the default) — the queue head, in the sphere log's listed order. Today's behaviour: the walk
 *    loop takes its old code path and never calls in here.
 *  - `sphere-cheapest` — the cheapest unchecked row of the LOWEST integer sphere still open (every row of one AP
 *    sphere was reachable before any was collected, so any order inside it is a legal playthrough), with the POCKET
 *    SWEEP: before a Restart out of a room no walk leaves, take any accessible row a walk from here reaches.
 *  - `reachable-cheapest` — the cheapest unchecked row accessible in the live snapshot.
 *
 * Modifiers (slice `bot-route-chooser-2a`), named as the offline orderings are (`scripts/procgen/routeOrders.js`):
 *  - `+pocket-item` — a row whose region no walk leaves for the restart home, even WITH the row's own item (and the
 *    break-first events its route breaks) held, is priced as owing one Restart (`routeChooser`'s `pocket`). The
 *    "could I walk out with it" query is `hypotheticalFindPath`: the live snapshot plus those items, in page, never
 *    touching the live state.
 *  - `+grab` — GRAB-ON-THE-WAY (`routeChooser.grabOnTheWay`): an accessible row the chosen target's route reaches at
 *    zero detour is walked to first. In page `sphere-cheapest` always sweeps, so `sphere-cheapest+sweep+grab` is the
 *    offline twin's name too.
 *
 * Measured offline 2026-10-24 (Restarts / region transitions), today's Seedling playthrough preset: listed 4 / 377,
 * `reachable-cheapest` 0 / 292, `sphere-cheapest` (+sweep) 0 / 360, `sphere-cheapest+sweep+grab` **0 / 306**,
 * `reachable-cheapest+pocket-item` 0 / 318, `+pocket-item+grab` 0 / 310. ⚠ POCKET-ITEM MEASURES WORSE there: plain
 * greedy already takes no Restart, and Seedling's exits are one-way, so most deep rooms cannot walk back to the start
 * and get priced as pockets — the order then detours around them. Grab only pays where the pool is narrower than
 * "every reachable row" (the sphere order; on `reachable-cheapest` the nearest-first pick already takes a zero-detour
 * row). Coding Adventure, sphere order: 137 / 129 / 121 → 127 / 123 / 113 with grab.
 *
 * LOOKAHEAD (slice `bot-route-chooser-2b`): `reachable-cheapest+lookahead` prices each row by the cheapest sequence of
 * TWO rows starting with it (`routeChooser.lookaheadCost`, beam `DEFAULT_LOOKAHEAD.beam`): the second step is priced
 * from the first row's region over a hypothetical state with its item held (`hypotheticalFindPath`), its candidates
 * the rows accessible there. Measured offline 2026-10-25 (`measure-bot-route-orders.mjs`), Restarts / region
 * transitions: Seedling playthrough `reachable-cheapest` 0 / 299 → **0 / 294** (the best order measured there);
 * ⚠ NOT MONOTONE elsewhere — wargroove 44 → 46, Coding Adventure 127 / 123 / 103 → 129 / 127 / 107, and Baking
 * Adventure's greedy-worse seed stays at 27 (listed 23); only a 4-row lookahead fixes that one (21), too costly to
 * ship. On the sphere order lookahead was worse with grab (313 → 333), so it is not offered there.
 *
 * Cheapest = `procgenCore/routeChooser.js` over the bot's own route price (`planRoute`'s hops, and whether it begins
 * with a Restart): fewest Restarts first, then fewest region transitions, the GOAL row last, ties progression-first
 * then listed. Measured offline first (`scripts/procgen/measure-bot-route-orders.mjs`): on the Seedling playthrough,
 * listed order costs 5 Restarts / 392 region transitions; `reachable-cheapest` 1 / 289; `sphere-cheapest` with the
 * sweep 1 / 357.
 *
 * ⚠ LOOP MODE keeps the sphere order: a loop's cost is mana, not region transitions, and the Loop runner reads its
 * own next target (`_nextLoopTarget`). This option never reaches it.
 *
 * Pure: the caller supplies the queue, what is checked, what is accessible and the route price.
 */

import { DEFAULT_LOOKAHEAD, grabOnTheWay, rankCandidates, rankLookahead } from '../procgenCore/routeChooser.js';

export const WALK_ORDERS = Object.freeze({
    inOrder: 'sphere-in-order',
    sphereCheapest: 'sphere-cheapest',
    reachableCheapest: 'reachable-cheapest',
    sphereCheapestGrab: 'sphere-cheapest+sweep+grab',
    reachablePocketItem: 'reachable-cheapest+pocket-item',
    reachablePocketItemGrab: 'reachable-cheapest+pocket-item+grab',
    reachableLookahead: 'reachable-cheapest+lookahead',
});
export const WALK_ORDER_LABELS = Object.freeze({
    'sphere-in-order': 'Sphere log, in order',
    'sphere-cheapest': 'Cheapest in the current sphere',
    'reachable-cheapest': 'Cheapest reachable location',
    'sphere-cheapest+sweep+grab': 'Cheapest in the current sphere, grabbing on the way',
    'reachable-cheapest+pocket-item': 'Cheapest reachable, avoiding pockets its item does not open',
    'reachable-cheapest+pocket-item+grab': 'Cheapest reachable, avoiding pockets, grabbing on the way',
    'reachable-cheapest+lookahead': 'Cheapest reachable, looking two locations ahead',
});

/**
 * A walk order's scope (`sphere-cheapest` / `reachable-cheapest` / `sphere-in-order`) and its `+` modifiers;
 * `lookahead` is the depth `+lookahead` / `+lookaheadK` asks for (0 = none), as `routeOrders.lookaheadDepthOf` reads it.
 */
export function parseWalkOrder(order) {
    const [scope, ...mods] = String(order ?? '').split('+');
    let lookahead = 0;
    for (const m of mods) {
        const hit = /^lookahead(\d*)$/.exec(m);
        if (hit) lookahead = hit[1] ? Number(hit[1]) : DEFAULT_LOOKAHEAD.depth;
    }
    return { scope, pocketItem: mods.includes('pocket-item'), grab: mods.includes('grab'), lookahead };
}

/**
 * The completion condition's item (`game_info[p].completion_condition`), or null: the exporter's `item_check`, or a
 * Rule Builder `Has` of ONE copy (apquest, toem_rule_builder). A `Has` of several copies (musedash's 7 Music Sheets)
 * or any other shape has no single goal row, so it is null and no row is held back.
 */
export function goalItemOf(rules, playerId = '1') {
    const cond = rules?.game_info?.[String(playerId)]?.completion_condition;
    if (cond?.type === 'item_check') return typeof cond.item === 'string' ? cond.item : null;
    if (cond?.rule === 'Has' && typeof cond.args?.item_name === 'string' && (cond.args.count ?? 1) === 1) {
        return cond.args.item_name;
    }
    return null;
}

/** `{item, progression, goal}` per location name, off the rules' regions. */
export function rowMetaOf(rules, playerId = '1') {
    const p = String(playerId);
    const goal = goalItemOf(rules, p);
    const meta = new Map();
    for (const region of Object.values(rules?.regions?.[p] ?? {})) {
        for (const loc of region?.locations ?? []) {
            if (!loc?.name) continue;
            const item = typeof loc.item === 'string' ? loc.item : loc.item?.name ?? null;
            meta.set(loc.name, { item, progression: loc.item?.advancement === true, goal: goal !== null && item === goal });
        }
    }
    return meta;
}

/**
 * A queue row's INTEGER sphere. ⚠ `sphereState` hands the bot the whole label as `sphereIndex` (`"0.4"`, with
 * `fractionalIndex` null), not the integer half — measured on the live page, where reading it as a number made the
 * lowest-sphere filter match nothing and `sphere-cheapest` fell back to the listed order. Either shape reads here.
 */
export function integerSphereOf(entry) {
    const s = entry?.sphereIndex;
    if (s === null || s === undefined || s === '') return null;
    const n = Number(String(s).split('.')[0]);
    return Number.isFinite(n) ? n : null;
}

/** The candidate rows of `order`: unchecked queue rows, scoped to the lowest open integer sphere or to accessible. */
export function walkCandidates({ order, queue, checked, isAccessible = null }) {
    const open = (queue ?? []).filter((e) => !checked.has(e.locationName));
    const { scope } = parseWalkOrder(order);
    if (scope === WALK_ORDERS.sphereCheapest) {
        const spheres = open.map(integerSphereOf).filter((n) => n !== null);
        if (spheres.length === 0) return open;
        const low = Math.min(...spheres);
        return open.filter((e) => integerSphereOf(e) === low);
    }
    if (scope === WALK_ORDERS.reachableCheapest && typeof isAccessible === 'function') {
        return open.filter((e) => isAccessible(e.locationName));
    }
    return open;
}

/**
 * The next target, or null when every queue row is checked.
 *
 * @param {object} args
 * @param {string} args.order a `WALK_ORDERS` value other than `sphere-in-order`
 * @param {Array} args.queue the bot's sphere queue rows (`buildSphereQueue`)
 * @param {Set<string>} args.checked the locations checked so far
 * @param {(name: string) => boolean} [args.isAccessible] the live snapshot's location accessibility
 * @param {Map} [args.meta] `rowMetaOf`
 * @param {(entry: object) => ({hops: number, restart: boolean}|null)} args.price the bot's route price
 * @param {() => boolean} [args.inPocket] no walk leads from where the player stands back to the start
 * @param {(entry: object) => boolean} [args.isPocket] `+pocket-item`: the row's region is a pocket even with its item
 *   held (no walk from it to the restart home). Asked only while more than one row is open.
 * @param {(from: object, to: object) => ({hops: number, restart: boolean}|null)} [args.priceBetween] `+grab`: the
 *   route price from `from`'s region to `to`'s
 * @param {(entry: object, at: any) => ({at: any, isAccessible: Function, price: Function}|null)} [args.step]
 *   `+lookahead`: ONE step of the walk — the state after walking to `entry` (from the state `at`, undefined = now)
 *   and collecting its item: what is accessible there, and the route price from there. Hypothetical; never the live
 *   state.
 * @param {number} [args.restartPenalty]
 * @returns {{entry: object|null, ranked: Array, swept: boolean, grabbed: object|null}}
 *   `entry` falls back to the first open row in listed order when no candidate has a route, so the walk loop's own
 *   refusal ("no path …") names it, as it does today.
 */
export function chooseWalkTarget({ order, queue, checked, isAccessible = null, meta = new Map(), price,
    inPocket = () => false, isPocket = null, priceBetween = null, step = null, restartPenalty = Infinity }) {
    const open = (queue ?? []).filter((e) => !checked.has(e.locationName));
    if (open.length === 0) return { entry: null, ranked: [], swept: false, grabbed: null };
    const { scope, pocketItem, grab, lookahead } = parseWalkOrder(order);
    const decorate = (e) => ({ ...e, ...(meta.get(e.locationName) ?? {}), entry: e });
    const memo = new Map();
    const pocketPriced = pocketItem && typeof isPocket === 'function' && open.length > 1;
    const cost = (c) => {
        if (!memo.has(c.locationName)) {
            const p = price(c.entry);
            memo.set(c.locationName, p && pocketPriced ? { ...p, pocket: isPocket(c.entry) === true } : p);
        }
        return memo.get(c.locationName);
    };
    const candidates = walkCandidates({ order, queue, checked, isAccessible }).map(decorate);
    let ranked;
    if (lookahead > 1 && typeof step === 'function') {
        // ⛓ LOOKAHEAD — each row priced by the cheapest `lookahead`-row sequence starting with it; `next` = one step.
        const next = (c, at) => {
            const done = new Set([...(at?.checked ?? checked), c.locationName]);
            const s = step(c.entry, at?.at);
            if (!s) return null;
            const stepMemo = new Map();
            return {
                state: { checked: done, at: s.at },
                candidates: walkCandidates({ order, queue, checked: done, isAccessible: s.isAccessible }).map(decorate),
                cost: (x) => {
                    if (!stepMemo.has(x.locationName)) stepMemo.set(x.locationName, s.price(x.entry));
                    return stepMemo.get(x.locationName);
                },
            };
        };
        ranked = rankLookahead(candidates, cost, { next, depth: lookahead, beam: DEFAULT_LOOKAHEAD.beam, restartPenalty });
    } else {
        ranked = rankCandidates(candidates, { cost, restartPenalty });
    }
    let swept = false;
    if (scope === WALK_ORDERS.sphereCheapest && ranked[0]?.price?.restart && inPocket()) {
        // ⛓ POCKET SWEEP — no walk leaves this room: take what a walk from here reaches (logic-legal now) first.
        const reachable = walkCandidates({ order: WALK_ORDERS.reachableCheapest, queue, checked, isAccessible })
            .map(decorate).filter((c) => !c.goal || open.length === 1);
        const walkable = rankCandidates(reachable, { cost, restartPenalty: Infinity }).filter((r) => !r.price.restart);
        if (walkable.length > 0) {
            ranked = walkable;
            swept = true;
        }
    }
    let pick = ranked[0]?.candidate ?? null;
    let grabbed = null;
    if (grab && pick && typeof priceBetween === 'function') {
        // ⛓ GRAB-ON-THE-WAY — an accessible row the pick's route reaches at zero detour goes first (never the goal).
        const target = pick;
        const base = cost(target);
        const pool = walkCandidates({ order: WALK_ORDERS.reachableCheapest, queue, checked, isAccessible })
            .filter((e) => e.locationName !== target.locationName).map(decorate);
        const viaMemo = new Map();
        const costVia = (c) => {
            if (!viaMemo.has(c.locationName)) {
                const pc = cost(c);
                const pt = pc && priceBetween(c.entry, target.entry);
                viaMemo.set(c.locationName, pt ? { hops: pc.hops + pt.hops,
                    restarts: (pc.restart ? 1 : 0) + (pt.restart ? 1 : 0) + (base?.pocket ? 1 : 0) } : null);
            }
            return viaMemo.get(c.locationName);
        };
        const g = grabOnTheWay(target, pool, { cost, costVia });
        if (g !== target) { pick = g; grabbed = g.entry; }
    }
    return { entry: pick?.entry ?? open[0], ranked, swept, grabbed };
}

/**
 * ⛓ POCKET-ITEM (slice `bot-route-chooser-2a`) — the PathFinder's walk over a HYPOTHETICAL state: the live snapshot
 * with `extra` items held (+1 each), the live state untouched. "Could I walk out of there WITH this row's item?"
 *
 * The PathFinder only links regions the snapshot holds reachable (`regionReachability`, the worker's, from the
 * start), and an item can make more reachable — so the reachable set is grown first, to a fixpoint, by the exits
 * whose rule holds under the extra items. Every evaluation is on a FRESH snapshot interface per state: the rule
 * engine caches helper results per context with no inventory in the key (a reused context answers stale).
 * Then ONE accessibility map for the state, as `frozenFindPath` builds for the live one.
 *
 * @param {object} pathFinder the bot's `PathFinder` (`buildAccessibilityMap`, `isRegionReachable`)
 * @param {object} args
 * @param {object} args.staticData `{regions: Map}`
 * @param {object} args.snapshot the live snapshot (read, never written)
 * @param {(snapshot: object) => object} args.makeInterface `createSnapshotInterface(snapshot, staticData)`
 * @param {(rule: object, iface: object) => boolean} args.evaluate `evaluateRule`
 * @param {Array<string>} args.extra the items held on top of the snapshot's inventory
 * @returns {(source: string, target: string) => object|null} `frozenFindPath`'s shape, or null on a missing input
 */
export function hypotheticalFindPath(pathFinder, { staticData, snapshot, makeInterface, evaluate, extra = [] }) {
    if (!pathFinder || !staticData?.regions || !snapshot || typeof makeInterface !== 'function' || typeof evaluate !== 'function') {
        return null;
    }
    const inventory = { ...(snapshot.inventory ?? {}) };
    for (const name of extra) if (name) inventory[name] = Number(inventory[name] ?? 0) + 1;
    const reachable = new Set();
    for (const name of staticData.regions.keys()) if (pathFinder.isRegionReachable?.(name, snapshot)) reachable.add(name);
    const stateOf = () => ({ ...snapshot, inventory,
        regionReachability: { ...(snapshot.regionReachability ?? {}), ...Object.fromEntries([...reachable].map((r) => [r, true])) } });
    for (let grew = true; grew;) {
        grew = false;
        const iface = makeInterface(stateOf());
        for (const name of [...reachable]) {
            for (const exit of staticData.regions.get(name)?.exits ?? []) {
                const to = exit?.connected_region;
                if (!to || reachable.has(to) || !staticData.regions.has(to)) continue;
                let ok = true;
                if (exit.access_rule) {
                    try { ok = evaluate(exit.access_rule, iface) === true; } catch { ok = false; }
                }
                if (ok) { reachable.add(to); grew = true; }
            }
        }
    }
    const state = stateOf();
    const iface = makeInterface(state);
    const findPath = frozenFindPath(pathFinder, { staticData, snapshot: state, snapshotInterface: iface });
    // ⛓ LOOKAHEAD — what is accessible in the hypothetical state (the snapshot interface's own test, over its regions)
    findPath.isLocationAccessible = (name) => {
        try { return iface?.isLocationAccessible?.(name) === true; } catch { return false; }
    };
    return findPath;
}

/**
 * ⚡ ONE ACCESSIBILITY MAP PER CHOICE — `PathFinder.findPathWithExits` rebuilds the map on every call; a choice
 * prices every candidate (twice, with the pocket test), so this builds it once (`buildAccessibilityMap`, the
 * PathFinder's own) and runs the same BFS over it. Same `{steps: [{region, exitUsed}], length}` shape. A path finder
 * without `buildAccessibilityMap` (a test double) is asked per call, as before.
 */
export function frozenFindPath(pathFinder, { staticData, snapshot, snapshotInterface }) {
    const perCall = (a, b) => pathFinder?.findPathWithExits?.(a, b) ?? null;
    if (typeof pathFinder?.buildAccessibilityMap !== 'function' || !staticData?.regions || !snapshot || !snapshotInterface) {
        return perCall;
    }
    let adjacency = null;
    try {
        adjacency = pathFinder.buildAccessibilityMap(staticData, snapshot, snapshotInterface);
    } catch (_e) {
        return perCall;
    }
    return (source, target) => {
        if (!source || !target) return null;
        if (source === target) return { steps: [{ region: source, exitUsed: null }], length: 0 };
        const queue = [{ region: source, path: [{ region: source, exitUsed: null }] }];
        const visited = new Set([source]);
        while (queue.length > 0) {
            const { region, path } = queue.shift();
            if (region === target) return { steps: path, length: path.length - 1 };
            for (const c of adjacency.get(region) || []) {
                if (visited.has(c.region)) continue;
                visited.add(c.region);
                queue.push({ region: c.region, path: [...path, { region: c.region, exitUsed: c.exitName }] });
            }
        }
        return null;
    };
}
