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

import { rankCandidates } from '../procgenCore/routeChooser.js';

export const WALK_ORDERS = Object.freeze({
    inOrder: 'sphere-in-order',
    sphereCheapest: 'sphere-cheapest',
    reachableCheapest: 'reachable-cheapest',
});
export const WALK_ORDER_LABELS = Object.freeze({
    'sphere-in-order': 'Sphere log, in order',
    'sphere-cheapest': 'Cheapest in the current sphere',
    'reachable-cheapest': 'Cheapest reachable location',
});

/** The completion condition's item (`game_info[p].completion_condition`, `item_check`), or null. */
export function goalItemOf(rules, playerId = '1') {
    const cond = rules?.game_info?.[String(playerId)]?.completion_condition;
    return cond?.type === 'item_check' && typeof cond.item === 'string' ? cond.item : null;
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
    if (order === WALK_ORDERS.sphereCheapest) {
        const spheres = open.map(integerSphereOf).filter((n) => n !== null);
        if (spheres.length === 0) return open;
        const low = Math.min(...spheres);
        return open.filter((e) => integerSphereOf(e) === low);
    }
    if (order === WALK_ORDERS.reachableCheapest && typeof isAccessible === 'function') {
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
 * @param {number} [args.restartPenalty]
 * @returns {{entry: object|null, ranked: Array, swept: boolean}}
 *   `entry` falls back to the first open row in listed order when no candidate has a route, so the walk loop's own
 *   refusal ("no path …") names it, as it does today.
 */
export function chooseWalkTarget({ order, queue, checked, isAccessible = null, meta = new Map(), price,
    inPocket = () => false, restartPenalty = Infinity }) {
    const open = (queue ?? []).filter((e) => !checked.has(e.locationName));
    if (open.length === 0) return { entry: null, ranked: [], swept: false };
    const decorate = (e) => ({ ...e, ...(meta.get(e.locationName) ?? {}), entry: e });
    const memo = new Map();
    const cost = (c) => {
        if (!memo.has(c.locationName)) memo.set(c.locationName, price(c.entry));
        return memo.get(c.locationName);
    };
    const candidates = walkCandidates({ order, queue, checked, isAccessible }).map(decorate);
    let ranked = rankCandidates(candidates, { cost, restartPenalty });
    let swept = false;
    if (order === WALK_ORDERS.sphereCheapest && ranked[0]?.price?.restart && inPocket()) {
        // ⛓ POCKET SWEEP — no walk leaves this room: take what a walk from here reaches (logic-legal now) first.
        const reachable = walkCandidates({ order: WALK_ORDERS.reachableCheapest, queue, checked, isAccessible })
            .map(decorate).filter((c) => !c.goal || open.length === 1);
        const walkable = rankCandidates(reachable, { cost, restartPenalty: Infinity }).filter((r) => !r.price.restart);
        if (walkable.length > 0) {
            ranked = walkable;
            swept = true;
        }
    }
    return { entry: ranked[0]?.candidate?.entry ?? open[0], ranked, swept };
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
