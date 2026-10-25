/**
 * ⛓ TIMER CHECK ORDER (slice `bot-route-chooser-2b`) — **WHICH ACCESSIBLE LOCATION THE NO-BATCH TICK CHECKS.** With
 * **Batch location checks** off, the timer dispatches ONE `user:locationCheck` per tick. Which one is the setting
 * `moduleSettings.timer.checkOrder`, which reuses the Playback Bot's walk-order values (`playbackBot/walkOrder.js`):
 *
 *  - `sphere-in-order` (the default) — the first accessible unchecked location in the timer's own order (the static
 *    data's). The timer's code path is unchanged: it never calls in here.
 *  - `reachable-cheapest` — `procgenCore/routeChooser.chooseNext` over the accessible locations, priced by the
 *    PathFinder's walk from the player's current region (`gameState.getCurrentRegion`): fewest region transitions,
 *    ties progression-first then the timer's order (a `meta` that marks a `goal` puts it last).
 *
 * ⚠ BOUNDS, NAMED: the timer has no Restart planner — a location with no walk from here is priced as owing one
 * Restart, so it ranks after every walk; with no current region (no substrate moving a player) every price is 0 and
 * the ties decide. The timer sees no completion condition (no rules JSON), so the goal location is NOT held back
 * here (the timer keeps checking after a goal anyway); `progression` is the static data's `item.advancement`. The
 * lookahead orders are the bot's only; the timer offers the plain one.
 *
 * ⚠ LOOP MODE: the loops panel steers the dispatched check (it builds the path); this only chooses which check is
 * dispatched, and only when the setting names a chooser order.
 *
 * Pure: the caller supplies the candidates, where the player stands, the walk and the goal/progression metadata.
 */

import { chooseNext } from '../procgenCore/routeChooser.js';
import { WALK_ORDERS } from '../playbackBot/walkOrder.js';

/** The `moduleSettings.timer.checkOrder` values (the default first). */
export const TIMER_CHECK_ORDERS = Object.freeze([WALK_ORDERS.inOrder, WALK_ORDERS.reachableCheapest]);
export const DEFAULT_TIMER_CHECK_ORDER = WALK_ORDERS.inOrder;

/** The setting names a chooser order (anything else keeps the timer's own pick). */
export function picksByCost(order) {
    return order !== DEFAULT_TIMER_CHECK_ORDER && TIMER_CHECK_ORDERS.includes(order);
}

/**
 * The location the no-batch tick checks.
 *
 * @param {Array<object>} locations the accessible unchecked locations, in the timer's order (`{name, region|parent_region}`)
 * @param {object} args
 * @param {string} args.order a `TIMER_CHECK_ORDERS` value
 * @param {string|null} args.here the player's current region
 * @param {(from: string, to: string) => ({length: number}|null)} args.findPath the PathFinder's walk
 * @param {Map<string, {progression?: boolean, goal?: boolean}>} [args.meta] per location name; default = the
 *   location's own `item.advancement` as `progression`
 * @returns {object|null} one of `locations` (the first when the order is the default or nothing is priced)
 */
export function pickTimerCheck(locations, { order, here = null, findPath = null, meta = new Map() } = {}) {
    if (!Array.isArray(locations) || locations.length === 0) return null;
    if (!picksByCost(order)) return locations[0];
    const regionOf = (loc) => loc.region || loc.parent_region || null;
    const candidates = locations.map((loc) => ({ progression: loc.item?.advancement === true, ...(meta.get(loc.name) ?? {}), loc }));
    const cost = (c) => {
        const to = regionOf(c.loc);
        if (!here || !to || to === here) return { hops: 0, restart: false };
        const walk = typeof findPath === 'function' ? findPath(here, to) : null;
        return walk && Number.isFinite(walk.length) ? { hops: walk.length, restart: false } : { hops: 0, restart: true };
    };
    return chooseNext(candidates, { cost })?.loc ?? locations[0];
}
