/**
 * ⛓ ROUTE EVENTS — the walk clears the route's events a goal's room reads (slice `seedling-walk-route-events`;
 * ⚖ the user 2026-11-11, "Slice it, hammer briefs it"; the second half of the user's 2026-11-05 ruling, "solve in visit
 * after that works").
 *
 * The walk breaks a game-state event first only when an AP rule on its route NAMES it (`procgenCore/eventRoute.js`,
 * goal-first BREAK steps). The game reads more than the rules name: a saved obstacle the AP route cleared earlier still
 * shapes the room a later goal is played in. Measured (WALK-WALLS, 2026-11-11): Seedling's L40 Boss Key 2 refuses at ANY
 * budget without L40 flag 12 (a south door no rule on the way to Boss Key 2 names) and solves at 1,382 units with it;
 * the AP route itself collects flag 12 at sphere 6.1, Boss Key 2 at 6.8.
 *
 * The rule (the page-side twin of the divergence sweep's `routeCarry`, `scripts/procgen/seedling-divergence-legs.mjs`,
 * which STAGES these flags in the test harness; the walk instead WALKS to them):
 *
 *   ROUTE ORDER   the events the AP route COLLECTED before the goal: the sphere log's own collection order (the first
 *                 row naming a location; `routeCollectionRows`), every row strictly before the goal's.
 *   ROOM READS    restricted to the events the goal's SCOPE reads (`scopeReads`): every event whose obstacle is in that
 *                 scope, plus another scope's event a rule of one of the scope's regions names, except a door edge's
 *                 far-side obstacle (an exit rule naming an event of the exit's own TARGET scope: the room it leads to
 *                 reads that one).
 *   NEVER         the goal itself.
 *
 * GENERIC: no game's names or constants. A SCOPE is whatever the slot's own export says it is: an event's
 * `obstacle.level` (the `game_state` event export, `gameStateEventsOf`) and a region's `preset_sidecars[player][region]
 * .playable_payload.level` (the region export) — the same two fields the sweep's `routeCarry` reads
 * (`seedlingAtlasCheckTable.atlasRoomRegions`). A slot that exports neither has no scope, so no route events: the walk
 * is today's. Pure functions; the bot (`playbackBotUI._routeEventFor`) decides what is held and walks.
 */

/**
 * The sphere-log row at which the AP route COLLECTS each location: `sphereData` = the bot's parsed rows
 * (`[{locations: [name, …]}, …]`, in order); the first row naming a location wins.
 * @returns {Map<string, number>}
 */
export function routeCollectionRows(sphereData) {
    const at = new Map();
    (Array.isArray(sphereData) ? sphereData : []).forEach((row, i) => {
        for (const name of row?.locations ?? []) if (typeof name === 'string' && !at.has(name)) at.set(name, i);
    });
    return at;
}

/** A region's scope from the slot's region export (`playable_payload.level`), or undefined. */
export function regionScopeOf(rules, playerId = '1') {
    const sidecars = rules?.preset_sidecars?.[String(playerId)] ?? {};
    return (region) => {
        const v = sidecars?.[region]?.playable_payload?.level;
        return v === undefined || v === null ? undefined : v;
    };
}

/**
 * The event ids (`eventId ?? name`) a SCOPE reads: its own events (`event.level === scope`), plus another scope's event
 * named by an access rule (an exit's or a location's) of one of the scope's regions — except an exit rule naming an
 * event of the exit's own target scope (the far side of a door: the room it leads to reads that one).
 *
 * @param {*} scope
 * @param {object} args
 * @param {Array<object>} args.events   `gameStateEventsOf(rules)` (each `{name, item, level, eventId, …}`)
 * @param {object} args.regions         the slot's rules regions (`rules.regions[player]`)
 * @param {(region: string) => *} args.scopeOf
 * @returns {Set<string>}
 */
export function scopeReads(scope, { events, regions, scopeOf }) {
    const idOf = (e) => e.eventId ?? e.name;
    const out = new Set();
    if (scope === undefined || scope === null) return out;
    for (const e of events ?? []) if (e.level === scope) out.add(idOf(e));
    const byItem = new Map((events ?? []).map((e) => [e.item, e]));
    const named = (node, farScope) => {
        if (Array.isArray(node)) { node.forEach((n) => named(n, farScope)); return; }
        if (!node || typeof node !== 'object') return;
        for (const [k, v] of Object.entries(node)) {
            const names = (k === 'item_name' || k === 'item') ? [v] : (k === 'item_names' || k === 'items') && Array.isArray(v) ? v : [];
            for (const n of names) {
                const e = typeof n === 'string' ? byItem.get(n) : null;
                if (e && e.level !== farScope) out.add(idOf(e));
            }
            if (v && typeof v === 'object') named(v, farScope);
        }
    };
    for (const [name, reg] of Object.entries(regions ?? {})) {
        if (scopeOf(name) !== scope) continue;
        for (const x of reg?.exits ?? []) named(x.access_rule, scopeOf(x.connected_region));
        for (const x of reg?.locations ?? []) named(x.access_rule, undefined);
    }
    return out;
}

/**
 * The route's events before `goal` (a location name) that its scope reads, in the route's collection order (then
 * scope, then name): `events` filtered to a collection row strictly before the goal's (`rows`), to `reads`, and never
 * the goal itself. A goal the route never collects carries none.
 * @returns {Array<object>} the events (the same objects)
 */
export function routeEventsBefore({ goal, rows, events, reads }) {
    const c = rows.get(goal);
    if (c === undefined) return [];
    return (events ?? [])
        .filter((e) => e.name !== goal && rows.has(e.name) && rows.get(e.name) < c && reads.has(e.eventId ?? e.name))
        .sort((a, b) => rows.get(a.name) - rows.get(b.name) || cmp(a.level, b.level) || cmp(a.tag, b.tag)
            || String(a.name).localeCompare(String(b.name)));
}

/** Numbers numerically, anything else as text (a scope or tag may be either). */
function cmp(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a ?? '').localeCompare(String(b ?? ''));
}

/**
 * Every goal's route events for one slot (`goal location name → events`): the census and the bot's cache. Goals are
 * the sphere log's non-event locations whose region has a scope; empty lists are omitted.
 */
export function routeEventsPlan({ rules, playerId = '1', sphereData, events }) {
    const regions = rules?.regions?.[String(playerId)] ?? {};
    const scopeOf = regionScopeOf(rules, playerId);
    const rows = routeCollectionRows(sphereData);
    const regionOfLoc = new Map();
    for (const [r, reg] of Object.entries(regions)) for (const l of reg?.locations ?? []) if (l?.name) regionOfLoc.set(l.name, r);
    const eventNames = new Set((events ?? []).map((e) => e.name));
    const readsCache = new Map();
    const out = new Map();
    for (const goal of rows.keys()) {
        if (eventNames.has(goal)) continue;
        const scope = scopeOf(regionOfLoc.get(goal));
        if (scope === undefined) continue;
        if (!readsCache.has(scope)) readsCache.set(scope, scopeReads(scope, { events, regions, scopeOf }));
        const list = routeEventsBefore({ goal, rows, events, reads: readsCache.get(scope) });
        if (list.length) out.set(goal, list);
    }
    return out;
}
