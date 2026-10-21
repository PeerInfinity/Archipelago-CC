/**
 * ⛓ ROUTE CHOOSER, slice `bot-route-chooser` M — **THE ORDERINGS, PRICED OFFLINE.** The pure half of
 * `measure-bot-route-orders.mjs` (that script reads presets and prints; this one is what its test calls).
 *
 * A route here is the Playback Bot's: one leg per sphere-log row (the slot's game-state events left to the walk, as
 * the bot's `buildSphereQueue` leaves them), each walked from where the last one ended, with Restart where the slot
 * declares `return_to_menu`. The legs are `surveyRoute.deriveLegs`' own — an ordering is only ever a different
 * `pickups` list handed to it — so a route this prices is a route the survey can derive. The greedy orderings pick
 * the next row with `procgenCore/routeChooser.js`, the same function the bot's walk loop calls.
 *
 * The four orderings (the brief's M list):
 *  - `listed` — the sphere log as listed (today's bot);
 *  - `sphere-cheapest` — greedy WITHIN each integer sphere (every row of one AP sphere was reachable before any of
 *    them was collected, so any order inside it is a legal playthrough);
 *  - `reachable-cheapest` — greedy over EVERY remaining row whose location rule holds with the items held;
 *  - `+sweep` on either — before a Restart out of a pocket the walk cannot leave, take every remaining row a WALK
 *    from here reaches (logic-legal now) first;
 *  - `+pocket` on either — price a row whose region no walk leaves (with the items held now) as owing one Restart
 *    (`routeChooser`'s `pocket`), so pockets are entered last;
 *  - `+pocket-item` — the same, with the row's OWN item (and its break-first events) counted as held: a room its
 *    pickup opens the way out of is no pocket. The bot's live snapshot cannot ask this; the offline measure can.
 *
 * Every greedy ordering takes a row holding the completion condition's item (`game_info[p].completion_condition`)
 * last (`routeChooser`'s `goal`).
 */

import { RESTART_TARGET, deriveLegs, eventPrerequisites, eventCrossingsOnPath, gameStateEventsOf, regionOfLocation,
    regionPathHops } from './surveyRoute.js';
import { RESTART_WARP } from '../../frontend/modules/procgenCore/restartWarp.js';
import { rankCandidates } from '../../frontend/modules/procgenCore/routeChooser.js';
import { detectBidirectionalMode } from '../../frontend/modules/shared/bidirectionalDetector.js';

export const ORDERINGS = Object.freeze(['listed', 'sphere-cheapest', 'reachable-cheapest',
    'sphere-cheapest+sweep', 'reachable-cheapest+sweep', 'sphere-cheapest+pocket', 'reachable-cheapest+pocket',
    'sphere-cheapest+pocket-item', 'reachable-cheapest+pocket-item']);

/**
 * The bot's queue rows, from a sphere log's entries (`{type, sphere_index, player_data}`): every `state_update`'s
 * `sphere_locations`, in listed order, minus the slot's game-state events. `goal` (the completion condition's item,
 * `goalItemOf`) marks the row that holds it.
 */
export function rowsOfSphereLog(entries, regions, playerId = '1', goal = null) {
    const events = new Set(gameStateEventsOf(regions).map((e) => e.name));
    const locs = new Map();
    for (const reg of Object.values(regions)) for (const l of reg.locations ?? []) locs.set(l.name, l);
    const rows = [];
    for (const e of entries) {
        if (e?.type !== 'state_update') continue;
        for (const name of e.player_data?.[playerId]?.sphere_locations ?? []) {
            const loc = locs.get(name);
            if (!loc || events.has(name)) continue;
            const item = loc.item?.name ?? null;
            rows.push({ sphere: String(e.sphere_index), location: name, item,
                progression: loc.item?.advancement === true, ...(goal !== null && item === goal ? { goal: true } : {}) });
        }
    }
    return rows;
}

/** The completion condition's item (`game_info[p].completion_condition`, `item_check`), or null. */
export function goalItemOf(rules, playerId = '1') {
    const cond = rules?.game_info?.[String(playerId)]?.completion_condition;
    return cond?.type === 'item_check' && typeof cond.item === 'string' ? cond.item : null;
}

/**
 * The region graph the bot's PathFinder walks (`shared/pathfinder.js` `buildAccessibilityMap`): where the slot assumes
 * bidirectional exits — `exporter[p].assume_bidirectional_exits`, else `detectBidirectionalMode`, as
 * `StateManagerProxy.getEffectiveBidirectionalSetting` decides — every exit with no explicit reverse gets one, under
 * the forward exit's own rule and name. ⚠ BOUND, NAMED: the PathFinder also asks that both ends be reachable from
 * the start; a walk standing in one end with the forward rule held has that already, except for an end reached only
 * by a Restart-free one-way drop, which this does not model.
 *
 * @returns {{regions: object, assumeBidirectional: boolean, source: string}}
 */
export function walkGraphOf(rules, playerId = '1') {
    const p = String(playerId);
    const regions = rules.regions[p];
    const explicit = rules.exporter?.[p]?.assume_bidirectional_exits;
    const assumeBidirectional = explicit === undefined || explicit === null
        ? detectBidirectionalMode(regions).assumeBidirectional : explicit === true;
    const source = explicit === undefined || explicit === null ? 'auto-detected' : 'explicit';
    if (!assumeBidirectional) return { regions, assumeBidirectional, source };
    const out = {};
    for (const [name, reg] of Object.entries(regions)) out[name] = { ...reg, exits: [...(reg.exits ?? [])] };
    for (const [name, reg] of Object.entries(regions)) {
        for (const e of reg.exits ?? []) {
            const back = out[e.connected_region];
            if (!back || (regions[e.connected_region].exits ?? []).some((x) => x.connected_region === name)) continue;
            back.exits.push({ name: e.name, connected_region: name, access_rule: e.access_rule ?? null, reverse: true });
        }
    }
    return { regions: out, assumeBidirectional, source };
}

const majorOf = (row) => Number(String(row.sphere).split('.')[0]);

/**
 * One ordering of `rows`, as the list `deriveLegs` is then handed. Greedy orderings simulate the walk the way
 * `deriveLegs` takes a leg (walk, else Restart, else break-before-first-use prerequisites), price each candidate
 * by its hops, and ask the chooser.
 */
export function orderRows({ regions, ruleHolds, start, rows, ordering, restart = false, restartPenalty = Infinity,
    tieBreak = 'progression-first' }) {
    if (ordering === 'listed') return rows.slice();
    const [scope, ...mods] = ordering.split('+');
    const sweep = mods.includes('sweep');
    const pocketItem = mods.includes('pocket-item');
    const pocketAware = pocketItem || mods.includes('pocket');
    const events = gameStateEventsOf(regions);
    const menuStart = regions[RESTART_TARGET]?.exits?.find((e) => e.name === 'GameStart')?.connected_region ?? null;
    const locRule = new Map();
    for (const reg of Object.values(regions)) for (const l of reg.locations ?? []) locRule.set(l.name, l.access_rule ?? null);
    const items = {};
    const wanted = rows.slice();
    const order = [];
    let here = start;
    const plan = (row) => {
        const to = regionOfLocation(regions, row.location);
        if (!ruleHolds(locRule.get(row.location), items)) return null;
        const walk = here === to ? { path: [here], exits: [] } : regionPathHops(regions, ruleHolds, here, to, items);
        if (walk) return { legs: [walk], restart: false };
        if (restart && menuStart) {
            const onward = regionPathHops(regions, ruleHolds, menuStart, to, items);
            if (onward) {
                return { legs: [{ path: [here, RESTART_TARGET, ...onward.path],
                    exits: [RESTART_WARP.label, 'GameStart', ...onward.exits] }], restart: true };
            }
        }
        const pre = events.length === 0 ? null
            : eventPrerequisites({ regions, ruleHolds, here, items, events, target: to, targetRule: locRule.get(row.location) });
        if (!pre) return null;
        const legs = [];
        const its = { ...items };
        let cur = here;
        for (const e of pre) {
            const p = regionPathHops(regions, ruleHolds, cur, e.region, its);
            if (!p) return null;
            legs.push(p);
            its[e.item] = 1;
            cur = e.region;
        }
        const last = regionPathHops(regions, ruleHolds, cur, to, its);
        if (!last) return null;
        legs.push(last);
        return { legs, restart: false, prereqs: pre };
    };
    const price = (p, row) => p && { hops: p.legs.reduce((n, l) => n + l.path.length - 1, 0), restart: p.restart,
        pocket: pocketAware && restart && !!menuStart && wanted.length > 1 && isPocket(p, row) };
    // ⛓ POCKET — no walk leads from the row's region back to the start with the items held NOW (the bot's live
    //   snapshot has no more than that): leaving it owes a Restart.
    const isPocket = (p, row) => {
        const last = p.legs[p.legs.length - 1].path;
        const to = last[last.length - 1];
        const its = { ...items };
        if (pocketItem) {
            its[row.item] = (its[row.item] ?? 0) + 1;
            for (const e of p.prereqs ?? []) its[e.item] = 1;
        }
        return to !== menuStart && !regionPathHops(regions, ruleHolds, to, menuStart, its);
    };
    while (wanted.length) {
        const low = Math.min(...wanted.map(majorOf));
        const pool = scope === 'sphere-cheapest' ? wanted.filter((r) => majorOf(r) === low) : wanted;
        const plans = new Map();
        const cost = (row) => {
            if (!plans.has(row)) plans.set(row, plan(row));
            return price(plans.get(row), row);
        };
        let ranked = rankCandidates(pool, { cost, restartPenalty, tieBreak });
        if (sweep && ranked[0]?.price.restart && menuStart && !regionPathHops(regions, ruleHolds, here, menuStart, items)) {
            // ⛓ POCKET SWEEP — no walk leaves this pocket: take what a walk from here reaches before the Restart.
            const walkable = rankCandidates(wanted, { cost, restartPenalty: Infinity, tieBreak })
                .filter((r) => !r.price.restart && !r.candidate.goal);
            if (walkable.length) ranked = walkable;
        }
        if (!ranked.length) {
            throw new Error(`orderRows(${ordering}): no remaining row has a route from ${here} `
                + `(remaining: ${wanted.slice(0, 5).map((r) => r.sphere).join(', ')}…)`);
        }
        const pick = ranked[0].candidate;
        const p = plans.get(pick);
        // the walk's own credits, as deriveLegs takes them: events crossed on the way, then the prerequisites broken
        (p.prereqs ?? []).forEach((e, i) => {
            for (const c of eventCrossingsOnPath(regions, p.legs[i].path, p.legs[i].exits, events, items)) items[c.event.item] = 1;
            items[e.item] = 1;
        });
        const last = p.legs[p.legs.length - 1];
        for (const c of eventCrossingsOnPath(regions, last.path, last.exits, events, items)) items[c.event.item] = 1;
        items[pick.item] = (items[pick.item] ?? 0) + 1;
        here = last.path[last.path.length - 1];
        order.push(pick);
        wanted.splice(wanted.indexOf(pick), 1);
    }
    return order;
}

/** `level_17__r1c5` → 17; null for a region that names no level (`Menu`, or a world without levels). */
export function levelOfRegion(region) {
    const m = /^level_(\d+)(?:__|$)/.exec(String(region));
    return m ? Number(m[1]) : null;
}

/**
 * The route's metrics, off `deriveLegs`' legs and hops (the exit names): legs, Restarts, region transitions (hops; a Restart's own two
 * moves — to the restart target, then its `GameStart` — count), and level visits where regions name levels.
 */
export function routeMetrics(legs, hops = []) {
    let transitions = 0;
    let restarts = 0;
    let levelVisits = 0;
    let lastLevel = null;
    legs.forEach((leg, i) => {
        transitions += Math.max(0, leg.regions.length - 1);
        // a Restart leg's first move is the warp itself (deriveLegs' restartPath); a walk through a `Menu` hub is not one
        if (hops[i]?.[0] === RESTART_WARP.label) restarts += 1;
        for (const r of leg.regions) {
            const n = levelOfRegion(r);
            if (r === RESTART_TARGET) { lastLevel = null; continue; }
            if (n === null) continue;
            if (n !== lastLevel) levelVisits += 1;
            lastLevel = n;
        }
    });
    return { legs: legs.length, restarts, hops: transitions, levelVisits };
}

/** One ordering's route: the order, `deriveLegs`' legs for it, and their metrics (or the refusal, by name). */
export function priceOrdering({ regions, ruleHolds, start, rows, ordering, restart, restartPenalty, tieBreak }) {
    let order;
    try {
        order = orderRows({ regions, ruleHolds, start, rows, ordering, restart, restartPenalty, tieBreak });
    } catch (e) {
        return { ordering, error: `order: ${e.message}` };
    }
    try {
        const { legs, hops } = deriveLegs({ regions, ruleHolds, start, pickups: order, restart, events: gameStateEventsOf(regions) });
        return { ordering, order, legs, hops, metrics: routeMetrics(legs, hops) };
    } catch (e) {
        return { ordering, order, error: `deriveLegs: ${e.message.slice(0, 300)}` };
    }
}
