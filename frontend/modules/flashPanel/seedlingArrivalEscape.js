/**
 * ⛓⛓ **AN ARRIVAL INSIDE A SOLID, AND ITS WAY OUT, IN THE AP'S TERMS** (JS arc, the wave-6 consumer).
 *
 * Fidelity wave 6 (ARRIVAL) refuses a solve whose box arrived INSIDE a solid that a saved flag still holds
 * (`solverBot.solveSegment`'s entry; `arrivalSolid.arrivalInsideSolid`): `SolverRefusal.obstacle` =
 * `{kind: 'arrival-inside-solid', id, solids, flags, at, latchedOn?, wayOut}` with
 *
 *   wayOut[] = {kind: 'restart', via: 'seedlingStartSpawn', why}
 *            | {kind: 'another-route', level, arrivals: [{from, door, at}]}
 *
 * The solver speaks in LEVELS and DOORS (`teleporter@x,y` / `stairs@x,y` of level `from`); the Playback Bot
 * routes on AP regions and exits. This module is the one translation: each other arrival → the AP exit whose
 * sidecar door it is (the region of level `from` that lists an exit with that door's coordinates into the
 * refusal's level, `exitName` set). ⚖ The user: no swing from inside — nothing here acts in the room.
 *
 * Pure: no panel, no bus. The controller calls it with its atlas map's `regions` (regionId → the
 * `flash_seedling` payload) and hands the answer to the bot with the walk's failure.
 */

/** The obstacle kind this module reads (wave 6's ARRIVAL). */
export const ARRIVAL_INSIDE_SOLID = 'arrival-inside-solid';

/** Is `obstacle` an arrival inside a solid? */
export function isArrivalInsideSolid(obstacle) {
    return obstacle?.kind === ARRIVAL_INSIDE_SOLID;
}

/** `teleporter@48,96` / `stairs@48,16` → `{x, y}`, or null. */
export function doorXY(door) {
    const m = /^(?:teleporter|stairs)@(-?\d+),(-?\d+)$/.exec(String(door ?? ''));
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/**
 * The AP exits a solver door is: every `{region, exit}` whose sidecar (level `from`) lists an exit with
 * `exitName`, that door's coordinates (the `exit_id`'s `_x_y` tail) and `target_level === to`.
 *
 * @param {Map<string, object>|object} regions  regionId → `flash_seedling` payload
 * @param {{from:number, door:string, to:number}} arrival
 * @returns {Array<{region:string, exit:string, landing:string|null}>}
 */
export function doorExitsOf(regions, { from, door, to }) {
    const xy = doorXY(door);
    if (!xy) return [];
    const payloads = regions instanceof Map ? regions : new Map(Object.entries(regions ?? {}));
    const out = [];
    for (const [region, p] of payloads) {
        if (p?.level !== from) continue;
        for (const x of p.exits ?? []) {
            if (!x?.exitName || x.target_level !== to) continue;
            const m = /_(-?\d+)_(-?\d+)$/.exec(String(x.exit_id ?? ''));
            if (!m || Number(m[1]) !== xy.x || Number(m[2]) !== xy.y) continue;
            if (!out.some((o) => o.region === region && o.exit === x.exitName)) {
                out.push({ region, exit: x.exitName, landing: x.targetRegion ?? null });
            }
        }
    }
    return out;
}

/**
 * The refusal's way out, for the Playback Bot: null unless `obstacle` is an arrival inside a solid.
 *
 *   restart    the refusal offers the Menu's Restart (`wayOut` `{kind: 'restart'}`)
 *   arrivals   the other arrivals into the level, as AP exits (`{region, exit, landing, from, door}`); a door
 *              no sidecar names is kept in `unmapped` (named, never dropped)
 *   solids / at / latchedOn   the refusal's own fields, for the status
 *
 * @param {object} obstacle  `SolverRefusal.obstacle` (plain data)
 * @param {Map<string, object>|object|null} regions  regionId → `flash_seedling` payload
 */
export function arrivalEscape(obstacle, regions) {
    if (!isArrivalInsideSolid(obstacle)) return null;
    const wayOut = Array.isArray(obstacle.wayOut) ? obstacle.wayOut : [];
    const restart = wayOut.some((w) => w?.kind === 'restart');
    const arrivals = [];
    const unmapped = [];
    for (const w of wayOut) {
        if (w?.kind !== 'another-route') continue;
        for (const a of w.arrivals ?? []) {
            const exits = regions ? doorExitsOf(regions, { from: a.from, door: a.door, to: w.level }) : [];
            if (exits.length === 0) unmapped.push(`L${a.from} ${a.door}`);
            for (const e of exits) arrivals.push({ ...e, from: a.from, door: a.door });
        }
    }
    return {
        kind: ARRIVAL_INSIDE_SOLID,
        solids: Array.isArray(obstacle.solids) ? [...obstacle.solids] : (obstacle.id ? [obstacle.id] : []),
        at: obstacle.at ?? null,
        ...(obstacle.latchedOn ? { latchedOn: obstacle.latchedOn } : {}),
        restart,
        arrivals,
        unmapped,
    };
}
