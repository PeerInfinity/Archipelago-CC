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
 * The rule decider the BFS uses, over AP's own evaluator.
 *
 * @param {object} rulesDoc the `_rules.json` export
 * @returns {(rule: ?object, items: Object<string, number>) => boolean}
 */
export function makeRuleHolds(rulesDoc, playerId = '1') {
    const model = buildAccessibilityModel(rulesDoc, playerId);
    const reachedCache = new Map();
    const inventoryOf = (items) => new Map(Object.entries(items).filter(([, n]) => n > 0));
    const reachedFor = (items) => {
        const key = JSON.stringify(Object.entries(items).filter(([, n]) => n > 0).sort());
        if (!reachedCache.has(key)) {
            const undecided = new Map();
            const reached = computeReachableRegions(model, inventoryOf(items), undecided);
            if (undecided.size) {
                const [endpoint, { rule }] = [...undecided][0];
                throw new Error(`AP access rule at ${endpoint} is undecidable over an inventory `
                    + `(${undeterminedRuleKinds(rule, inventoryOf(items), model.playerId).join(', ')}) — `
                    + 'a rule this evaluator cannot decide must never read as SATISFIED, '
                    + 'because a route derived through a door nobody evaluated is a route '
                    + 'nobody derived.');
            }
            reachedCache.set(key, reached);
        }
        return reachedCache.get(key);
    };
    return function ruleHolds(rule, items) {
        if (!rule) return true;
        const reached = reachedFor(items);
        const verdict = evaluateRuleWithInventory(rule, inventoryOf(items), model.playerId,
            (name) => (model.regions.has(name) ? reached.has(name) : undefined),
            model.progressionMapping);
        if (verdict === undefined) {
            throw new Error(`unknown AP access rule '${rule.rule}' — a rule this evaluator `
                + 'does not know must never read as SATISFIED, because a route derived through '
                + 'a door nobody evaluated is a route nobody derived.');
        }
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
 * @returns {{legs: Array<{sphere, goal, item, from, to, itemsHeld, regions}>,
 *            held: Array<Object<string, number>>, hops: Array<string[]>}} the legs
 *          in order, the item COUNTS each was walked with (`itemsHeld` names
 *          them; a second Progressive Sword is a count), and the AP exit NAMES
 *          each leg's hops took (`regionPathHops`); throws by name on a leg AP's rules
 *          give no path for and no remaining row can replace
 */
export function deriveLegs({ regions, ruleHolds, start, pickups, spare = null }) {
    const items = {};
    const legs = [];
    const held = [];
    const hops = [];
    let here = start;
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
        items[pick.item] = (items[pick.item] ?? 0) + 1;
        here = to;
        if (fromWanted >= 0) wanted.splice(fromWanted, 1);
        else extra.splice(extra.indexOf(pick), 1);
    }
    return { legs, held, hops };
}
