/**
 * ⛓⛓ RULES ARC, `rules-route-survey` — **THE ROUTE'S LEGS, DERIVED FROM THE
 * SPHERE ORDER, OVER AP'S OWN EVALUATOR.**
 *
 * `survey-seedling-route.mjs` derives the route at module scope, so importing
 * it to test one function would RUN the survey (`surveyFamily.js`' reason,
 * and `surveyGrants.js`'). The two pure halves of the derivation live here:
 *
 *  1. **WHICH LEGS** — `pickupsThrough(order, through)`: the sphere order's own
 *     rows, in AP's collection order, up to and including the row labelled
 *     `through` (or every row, for `end`). Nothing is typed: a leg is a row.
 *  2. **WHICH DOORS ARE OPEN** — `makeRuleHolds(rulesDoc)`: a rule decided by
 *     the SHARED evaluator (`library.evaluateRuleWithInventory`), with
 *     `CanReachRegion(X)` read from `forwardSimulator.computeReachableRegions`'
 *     fixed point — AP's `CollectionState.can_reach_region`, the same set
 *     `generateSphereLog` reads. ⛔ Not a third copy: the survey's own
 *     six-rule switch is gone, and a rule kind the shared engine cannot decide
 *     still THROWS by name rather than reading as satisfied.
 *
 * ⚠ `CanReachRegion` IS GLOBAL. It asks whether X is reachable FROM THE START
 * with the items held, not from where a leg begins — that is AP's meaning (a
 * one-sided lock opened from its far side earlier in the run), and a leg's
 * BFS reads it that way.
 */

import { buildAccessibilityModel, computeReachableRegions }
    from '../../frontend/modules/shared/procgen/forwardSimulator.js';
import { evaluateRuleWithInventory, undeterminedRuleKinds }
    from '../../frontend/modules/shared/procgen/library.js';

/** `"1.10"` → `[1, 10]`; the sphere label's two halves compare as numbers. */
const labelOf = (s) => String(s).split('.').map(Number);

/**
 * The sphere order's rows up to and including `through`.
 *
 * @param {Array<{sphere:string, location:string, item:string, level:number}>} order
 *        `seedling-sphere-order.json`'s `order`, in AP's collection order
 * @param {string} through a sphere label that IS a row (`"2.2"`), or `"end"`
 * @returns {Array} the rows, in order — one leg each
 */
export function pickupsThrough(order, through) {
    if (!Array.isArray(order) || order.length === 0) {
        throw new Error('pickupsThrough: the sphere order is empty — there is no route to derive');
    }
    if (through === 'end') return order.slice();
    const at = order.findIndex((o) => o.sphere === String(through));
    if (at < 0) {
        const [maj] = labelOf(through);
        const inSphere = order.filter((o) => labelOf(o.sphere)[0] === maj).map((o) => o.sphere);
        throw new Error(`--through=${through}: no sphere-order row is labelled '${through}' `
            + `(the order runs ${order[0].sphere} … ${order[order.length - 1].sphere}`
            + (inSphere.length ? `; sphere ${maj} has ${inSphere.join(', ')}` : '')
            + '). Name a row, or `end`.');
    }
    return order.slice(0, at + 1);
}

/**
 * ⛓⛓ FRONTIER2 — **THE TWO ROUTE MODES** (⚖ user 2026-10-05: *"Both, report
 * separately."*).
 *
 *  · `full` — every sphere-order row is a leg (`pickupsThrough` as is): the
 *    Seal chests, the Light, the Totem Shards included. The rules arc's
 *    `--through=end` reads this, and it stays the default.
 *  · `route-only` — ⚖ §12 item 6, the user's ROUTE-ONLY correction: only the
 *    PROGRESSION pickups. The survey before `a261ef7fd9` spelled them as typed
 *    regexes (sword L10 → Boss Key 0 L19 → shield L20, + L29's key and L32's
 *    Fire for 2.2); here they are DERIVED: a row is a progression pickup when
 *    its item is a KEY — one some AP access rule asks for by a single-copy
 *    `Has` (count 1), so collecting that one row opens something. Skipped, and
 *    named: counted collectibles (`Seal` ×16, `Totem Shard` ×5 — a rule asks
 *    only for the whole pool) and items no rule asks for (`Light`, `Health`).
 *    Over seed 1's order through 3.1 this is exactly the old typed five.
 *    ⛓ AND IT IS WALKED (`deriveLegs({walk: true})`): `CanReachRegion(X)`
 *    holds only once the route has STOOD in X — see `makeRuleHolds`' `stood`.
 */
export const ROUTE_MODES = Object.freeze(['full', 'route-only']);

/**
 * The items AP's rules ask for by a single-copy `Has` — the route-only mode's
 * KEYS. Read off every exit and location rule of the export; nothing typed.
 *
 * @returns {Set<string>}
 */
export function keyItemsOf(rulesDoc, playerId = '1') {
    const keys = new Set();
    const walk = (r) => {
        if (!r || typeof r !== 'object') return;
        if (Array.isArray(r)) { r.forEach(walk); return; }
        if (r.rule === 'Has' && (r.args?.count ?? 1) === 1) keys.add(r.args.item_name);
        Object.values(r).forEach(walk);
    };
    for (const reg of Object.values(rulesDoc.regions[playerId])) {
        for (const e of reg.exits ?? []) walk(e.access_rule);
        for (const l of reg.locations ?? []) walk(l.access_rule);
    }
    return keys;
}

/**
 * The route-only subset of `rows`: the rows whose item is a key
 * (`keyItemsOf`), in order. `bound` (a sphere label) is kept whatever it
 * grants — the route ends there because it was asked to.
 *
 * @returns {{rows: Array, skipped: Array<{sphere, location, item}>}}
 */
export function routeOnlyRows(rows, keyItems, bound = null) {
    const kept = [];
    const skipped = [];
    for (const r of rows) {
        if (keyItems.has(r.item) || (bound !== null && r.sphere === String(bound))) kept.push(r);
        else skipped.push({ sphere: r.sphere, location: r.location, item: r.item });
    }
    return { rows: kept, skipped };
}

/**
 * ⛓⛓ FRONTIER2 — **THE FRONTIER'S BOUND, READ OFF THE CHAIN.** The census
 * typed `through-2.2` and the label moved under it (`70d9a87c` re-sphered 35
 * locations: L32's Bob Boss went 2.2 → 3.1, and 2.2 became L25's Seal chest).
 * The bound is the sphere row the chain's TERMINAL segment ends on — its room
 * and the item it carries away (`encounter` or `item`). A chain with no
 * terminal segment has no bound this can name, and it throws by name.
 *
 * @param {Array} order the sphere order's rows
 * @param {Array<{name, level, to, encounter?, item?}>} segments the chain declaration
 * @returns {string} the sphere label
 */
export function chainBound(order, segments) {
    const tail = segments[segments.length - 1];
    const item = tail?.encounter ?? tail?.item ?? null;
    if (!tail || tail.to !== null || item === null) {
        throw new Error(`chainBound: the chain's tail ${tail?.name ?? '(none)'} is not a terminal `
            + 'segment that carries an item away — the frontier\'s route bound is read off it, '
            + 'and there is nothing to read. Name one with --through=<sphere>.');
    }
    const hits = order.filter((o) => o.level === tail.level && o.item === item);
    if (hits.length !== 1) {
        throw new Error(`chainBound: ${hits.length} sphere-order rows grant '${item}' in L${tail.level} `
            + `(the tail ${tail.name}) — the bound would be a guess.`);
    }
    return hits[0].sphere;
}

/**
 * The rule decider the BFS uses, over AP's own evaluator.
 *
 * ⛓⛓ FRONTIER2 — **`stood`, THE WALK'S READING OF `CanReachRegion`.** AP's
 * meaning is global (above), and RULES (A) spells a one-way lock as
 * `CanReachRegion(far side) ∧ key` from the near side: open once anybody
 * COULD have opened it. A playthrough is a walk, and the game opens the lock
 * only for a player who went round to the far side. Measured at seed 1: from
 * L29 the AP reading takes L22's teleporter into L30's north pocket and
 * through the r0c4 → r2c10 lock (the far side is reachable from the START via
 * L31), a door the route never opened; the walk reading goes L29 → L31 → L30,
 * which is the room sequence the campaign chain was recorded on. With `stood`
 * (a Set of region names), `CanReachRegion(X)` is `stood.has(X)`. ⚠ BOUND,
 * NAMED: `stood` is what EARLIER legs walked; a leg's own BFS does not count
 * the region it is passing through as stood.
 *
 * @param {object} rulesDoc the `_rules.json` export
 * @returns {(rule: ?object, items: Object<string, number>, stood?: Set<string>) => boolean}
 */
export function makeRuleHolds(rulesDoc, playerId = '1') {
    const model = buildAccessibilityModel(rulesDoc, playerId);
    /**
     * ⚡ ONE fixed point and one inventory per item set, and one verdict per
     * (rule, item set). A leg's alternatives re-run the BFS once per banned
     * region, so the same rules are asked of the same items thousands of
     * times; without these caches `--through=end`'s derivation took ~22 s,
     * paid again by every one of its 265 step children.
     */
    const byItems = new Map();
    const verdicts = new WeakMap();
    /** one id per `stood` Set — the verdict cache is keyed on it (a Set is never mutated once handed in) */
    const stoodIds = new WeakMap();
    let nextStoodId = 0;
    const stoodKey = (stood) => {
        if (!stood) return '';
        if (!stoodIds.has(stood)) stoodIds.set(stood, nextStoodId++);
        return `\u0002${stoodIds.get(stood)}`;
    };
    const stateFor = (items) => {
        let key = '';
        for (const name of Object.keys(items).sort()) {
            if (items[name] > 0) key += `${name}\u0000${items[name]}\u0001`;
        }
        let state = byItems.get(key);
        if (state) return state;
        const inventory = new Map(Object.entries(items).filter(([, n]) => n > 0));
        const undecided = new Map();
        const reached = computeReachableRegions(model, inventory, undecided);
        if (undecided.size) {
            const [endpoint, { rule }] = [...undecided][0];
            throw new Error(`AP access rule at ${endpoint} is undecidable over an inventory `
                + `(${undeterminedRuleKinds(rule, inventory, model.playerId).join(', ')}) — `
                + 'a rule this evaluator cannot decide must never read as SATISFIED, '
                + 'because a route derived through a door nobody evaluated is a route '
                + 'nobody derived.');
        }
        state = {
            key,
            inventory,
            isRegionReachable: (name) => (model.regions.has(name) ? reached.has(name) : undefined),
        };
        byItems.set(key, state);
        return state;
    };
    return function ruleHolds(rule, items, stood = null) {
        if (!rule) return true;
        const state = stateFor(items);
        const key = state.key + stoodKey(stood);
        let memo = verdicts.get(rule);
        if (!memo) verdicts.set(rule, (memo = new Map()));
        if (memo.has(key)) return memo.get(key);
        const reachable = stood
            ? (name) => (model.regions.has(name) ? stood.has(name) : undefined)
            : state.isRegionReachable;
        const verdict = evaluateRuleWithInventory(rule, state.inventory, model.playerId,
            reachable, model.progressionMapping);
        if (verdict === undefined) {
            throw new Error(`unknown AP access rule '${rule.rule}' — a rule this evaluator `
                + 'does not know must never read as SATISFIED, because a route derived through '
                + 'a door nobody evaluated is a route nobody derived.');
        }
        memo.set(key, verdict);
        return verdict;
    };
}

/**
 * Shortest region path under a fixed item set, with the NAME of the AP exit
 * each hop took (`exits[i]` leaves `path[i]` for `path[i + 1]`); null when
 * there is none. Two exits between one pair of regions (`… #2`, a double-wide
 * door) are told apart by the exit the BFS actually passed — the first listed
 * whose rule holds.
 */
export function regionPathHops(regions, ruleHolds, src, dst, items, banned = new Set()) {
    const prev = new Map([[src, null]]);
    const queue = [src];
    while (queue.length) {
        const u = queue.shift();
        if (u === dst) break;
        for (const e of regions[u]?.exits ?? []) {
            const v = e.connected_region;
            if (prev.has(v) || banned.has(v)) continue;
            if (!ruleHolds(e.access_rule, items)) continue;
            prev.set(v, { u, exit: e.name });
            queue.push(v);
        }
    }
    if (!prev.has(dst)) return null;
    const path = [];
    const exits = [];
    for (let v = dst; v !== src; v = prev.get(v).u) {
        path.push(v);
        exits.push(prev.get(v).exit);
    }
    path.push(src);
    return { path: path.reverse(), exits: exits.reverse() };
}

/** Shortest region path under a fixed item set; null when there is none. */
export function regionPath(regions, ruleHolds, src, dst, items, banned = new Set()) {
    return regionPathHops(regions, ruleHolds, src, dst, items, banned)?.path ?? null;
}

/** The AP region that holds a location. */
export function regionOfLocation(regions, locationName) {
    for (const [name, reg] of Object.entries(regions)) {
        if ((reg.locations ?? []).some((l) => l.name === locationName)) return name;
    }
    throw new Error(`no AP region holds location '${locationName}'`);
}

/** The exits a BFS from `src` under `items` cannot pass, each with its rule. */
export function blockedFrontier(regions, ruleHolds, src, items) {
    const seen = new Set([src]);
    const queue = [src];
    const blocked = [];
    while (queue.length) {
        const u = queue.shift();
        for (const e of regions[u]?.exits ?? []) {
            const v = e.connected_region;
            if (seen.has(v)) continue;
            if (!ruleHolds(e.access_rule, items)) {
                blocked.push({ from: u, to: v, rule: e.access_rule });
                continue;
            }
            seen.add(v);
            queue.push(v);
        }
    }
    return blocked.filter((b) => !seen.has(b.to));
}

/**
 * One BFS leg per pickup, each with exactly the items the earlier legs earned.
 *
 * ⛓⛓ **`spare` — AP'S ORDER IS NOT A WALK.** AP's reachability is from the
 * START (`CanReachRegion`, `update_reachable_regions`): it never asks where the
 * player is standing. On a directed graph the next row can be unreachable from
 * where the previous one left the route (measured: after 3.2, the Conch at L49,
 * the only way back out of L49–L56 is a Blue Key lock, and the Blue Key is
 * 4.7). Without `spare` such a leg THROWS — the default route's contract.
 * With `spare` (an array, possibly empty: the order's rows PAST the bound), a
 * leg takes the EARLIEST remaining row — the bound's rows first, then
 * `spare`'s — that is reachable from here AND whose location rule holds, and
 * records what it jumped as `outOfOrder: {deferred, blocked}` (`blocked` = the
 * exits the BFS from here could not pass). A row pulled from `spare` is
 * marked `pulledForward`. The route still ends when every row of `pickups` is
 * collected; nothing is typed, and an in-order route is unchanged.
 *
 * ⛓ FRONTIER2 — **`walk`** (the route-only mode's): each leg decides
 * `CanReachRegion` by the regions the EARLIER legs stood in (`makeRuleHolds`'
 * `stood`; the start counts) instead of AP's start-anchored fixed point. Off,
 * nothing here changes. `legHolds[i]` is the rule decider leg i was walked
 * with, so a caller asking about that leg (its alternatives) asks the same one.
 *
 * @returns {{legs: Array<{sphere, goal, item, from, to, itemsHeld, regions}>,
 *            held: Array<Object<string, number>>, hops: Array<string[]>,
 *            legHolds: Array<Function>}} the legs
 *          in order, the item COUNTS each was walked with (`itemsHeld` names
 *          them; a second Progressive Sword is a count), and the AP exit NAMES
 *          each leg's hops took (`regionPathHops`); throws by name on a leg AP's rules
 *          give no path for and no remaining row can replace
 */
export function deriveLegs({ regions, ruleHolds: apHolds, start, pickups, spare = null, walk = false }) {
    const items = {};
    const legs = [];
    const held = [];
    const hops = [];
    const legHolds = [];
    let here = start;
    let stood = walk ? Object.freeze(new Set([start])) : null;
    const wanted = pickups.slice();
    const extra = (spare ?? []).slice();
    const locationRule = (name) => {
        for (const reg of Object.values(regions)) {
            const loc = (reg.locations ?? []).find((l) => l.name === name);
            if (loc) return loc.access_rule ?? null;
        }
        return null;
    };
    while (wanted.length) {
        const legStood = stood;
        const ruleHolds = walk ? (rule, its) => apHolds(rule, its, legStood) : apHolds;
        const pool = spare === null ? [wanted[0]] : [...wanted, ...extra];
        let pick = null;
        let path = null;
        for (const cand of pool) {
            const to = regionOfLocation(regions, cand.location);
            const p = regionPathHops(regions, ruleHolds, here, to, items);
            if (p && (spare === null || ruleHolds(locationRule(cand.location), items))) {
                pick = cand;
                path = p;
                break;
            }
        }
        if (!pick) {
            const to = regionOfLocation(regions, wanted[0].location);
            throw new Error(`AP's own rules give NO path from ${here} to `
                + `${to} with items {${Object.keys(items).join(', ') || 'none'}} — `
                + 'the route is not derivable and nothing below it means anything.'
                + (spare === null ? '' : ` (and no remaining sphere-order row is reachable from `
                    + `${here}: blocked ${blockedFrontier(regions, ruleHolds, here, items)
                        .map((b) => `${b.from} -> ${b.to} ${JSON.stringify(b.rule)}`).join('; ')})`));
        }
        const to = regionOfLocation(regions, pick.location);
        const fromWanted = wanted.indexOf(pick);
        const deferred = fromWanted < 0 ? wanted.slice() : wanted.slice(0, fromWanted);
        legs.push({
            sphere: pick.sphere,
            goal: pick.location,
            item: pick.item,
            from: here,
            to,
            itemsHeld: Object.keys(items).slice(),
            regions: path.path,
            ...(deferred.length ? {
                outOfOrder: {
                    deferred: deferred.map((d) => d.sphere),
                    // why the FIRST deferred row was not taken
                    because: regionPath(regions, ruleHolds, here,
                        regionOfLocation(regions, deferred[0].location), items)
                        ? 'its location rule does not hold' : `no path from ${here}`,
                    blocked: blockedFrontier(regions, ruleHolds, here, items),
                },
            } : {}),
            ...(fromWanted < 0 ? { pulledForward: true } : {}),
        });
        held.push({ ...items });
        hops.push(path.exits);
        legHolds.push(ruleHolds);
        if (walk) stood = Object.freeze(new Set([...stood, ...path.path]));
        items[pick.item] = (items[pick.item] ?? 0) + 1;
        here = to;
        if (fromWanted >= 0) wanted.splice(fromWanted, 1);
        else extra.splice(extra.indexOf(pick), 1);
    }
    return { legs, held, hops, legHolds };
}
