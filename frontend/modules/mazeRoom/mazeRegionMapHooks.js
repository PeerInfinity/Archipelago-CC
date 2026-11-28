/**
 * mazeRoom/mazeRegionMapHooks — **WHAT A MAZE LEVEL TELLS THE REGION MAP** (region-map-maze-hooks).
 *
 * ⚖ The user, session 84c8ab35, 2026-11-27T17:15:27.263Z: *"the region drawing code for the maze substrate is still
 * unfinished. There are features that it still needs from the Seedling region drawing code."*; 2026-11-27T17:17:15.342Z
 * picked "Location squares", "Level size", "Exit directions" and "Sub-region dimming" (the last droppable). Session
 * dff9eebc, 2026-11-27T17:24:33.938Z: maze sub-regions **"Fold, no dimming"** — they fold onto their level as
 * Seedling's do, and nothing is dimmed (the Region Map and the Region Graph draw a level whole, undimmed, for Seedling
 * too: `regionMap/regionMapModel.js`'s step-1 residue).
 *
 * The same `compositeMap` hooks `flashPanel/seedlingCompositeMap.js` declares, answered from a maze sidecar. The readers
 * are substrate-agnostic and find these through the registry (`mazeRoomLibrary.js` declares them):
 *   · `regionMap/regionMapModel.js` — `regionExtent`, `locationTiles`, `displayRegionOf`;
 *   · `procgenCore/regionLayoutResolve.js` — `layoutGraph`, `displayRegionOf`;
 *   · `regionGraph/directionLayout.js` — the exit directions, from the door tiles (`x, y`) and the model's extent.
 *
 * ── THE SOURCE OF TRUTH: THE SIDECAR'S JSON PAYLOAD (`preset_sidecars[p][region].playable_payload`) ──
 * Every hook reads the payload as stored in rules.json, the shape the readers hand DATA hooks (the model hydrates
 * only the painter's copy). ⛔ The deserialized world cannot answer `locationTiles`: its `items` Map is `key → item id`
 * and drops each item's `locationName`.
 *   · size      — `width` × `height` (tiles): exactly the grid `mazeCompositeMap.drawMazeCompositeRegion` paints.
 *   · locations — `items[] {x, y, locationName}` (`serializeMazeWorld` bakes the AP name in), plus a placed rope's
 *                 event (`obstacles[] {x, y, id}` whose `obstacleLib[id]` `activates` and names an `event`) — the
 *                 names `mazeSerializer.tileGridApLocationNames` lists, now with their tiles — plus each event an
 *                 atlas obstacle's `obstacleLib[id].events[].name` fires when it is cleared, on that obstacle's tile,
 *                 and each event a button latches (`buttons[]`, `buttonLib[id].latch.event`), on the button. An
 *                 event's square is where the player FIRES it (the rope, the lock, the button).
 *   · exits     — `exits[] {x, y, side?, targetRegion, isTeleporter?, atlas_exit_id?, arrivalTile?}`: the door tile, and its `side` when the
 *                 generator wrote one; else the side of the level border the door tile sits on (`mazeExitLayout`).
 *   · levels    — the payload's `atlas_region` (a maze laid on a Seedling atlas), else the sidecar's `shared_world`
 *                 key (a SHARED LEVEL WORLD member with no payload of its own), else the region itself.
 *
 * ⛔ PURE: no DOM, no engine import (this file is not in the engine closure, and needs nothing from it), never a
 * preset or region name. Its one import is Seedling's imports-free exit classifier (`flashPanel/seedlingExitKind.js`).
 */

import { seedlingExitLayoutKind, seedlingEdgeTransitionOf } from '../flashPanel/seedlingExitKind.js';

const SIDES = Object.freeze(['N', 'E', 'S', 'W']);

const payloadOf = (sidecarOrPayload) => sidecarOrPayload?.playable_payload ?? sidecarOrPayload ?? null;

/**
 * ⛓ `compositeMap.displayRegionOf(regionName, sidecar)` — the LEVEL a maze region belongs to (⚖ "Fold, no dimming").
 * `sidecar` is the region's sidecar entry (or its payload). A region with neither key is its own level, so every maze
 * world without sub-regions folds nothing.
 */
export function mazeDisplayRegionOf(regionName, sidecar) {
    const payload = payloadOf(sidecar);
    if (typeof payload?.atlas_region === 'string' && payload.atlas_region !== '') return payload.atlas_region;
    const shared = sidecar?.shared_world;
    if (typeof shared === 'string' && shared !== '') return shared;
    return regionName;
}

/**
 * ⛓ `compositeMap.regionExtent(region)` → `{w, h}` in tiles, or null: the payload's `width` × `height`, the grid the
 * maze painter draws (so "Cells: sized by level" gives a maze cell its real size).
 */
export function mazeRegionExtent(region) {
    const p = region?.playable_payload ?? null;
    const w = p?.width;
    const h = p?.height;
    return Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 ? { w, h } : null;
}

/** The rules' location names for one slot, or null when the caller handed no rules (then nothing is filtered). */
const locationNameCache = new WeakMap();
function rulesLocationNames(rules, playerId) {
    const regions = rules?.regions?.[String(playerId)];
    if (!regions || typeof regions !== 'object') return null;
    let set = locationNameCache.get(regions);
    if (!set) {
        set = new Set();
        for (const r of Object.values(regions)) for (const l of r?.locations ?? []) if (typeof l?.name === 'string') set.add(l.name);
        locationNameCache.set(regions, set);
    }
    return set;
}

/**
 * ⛓ `compositeMap.locationTiles(region, ctx)` → `[{location, x, y, kind}]` in the level's tiles: each placed item's
 * `locationName` at its tile (`kind: 'item'`), then each placed rope's `event` and each atlas obstacle's `events[].name`
 * at that obstacle's tile, then each button's latched event at the button (`kind: 'event'`).
 * With `ctx.rules`, only names the slot's rules list as locations (any region: a shared level's payload carries
 * every member's items), so a square always selects a real location. One tile per name (the first).
 * @param {{region_id, playable_payload}} region
 * @param {{rules?, playerId?}} [ctx]
 */
export function mazeLocationTiles(region, { rules = null, playerId = null } = {}) {
    const p = region?.playable_payload ?? null;
    const known = rulesLocationNames(rules, playerId);
    const out = [];
    const seen = new Set();
    const push = (location, x, y, kind) => {
        if (typeof location !== 'string' || location === '' || seen.has(location)) return;
        if (!Number.isInteger(x) || !Number.isInteger(y)) return;
        if (known && !known.has(location)) return;
        seen.add(location);
        out.push({ location, x, y, kind });
    };
    for (const it of Array.isArray(p?.items) ? p.items : []) push(it?.locationName, it?.x, it?.y, 'item');
    const lib = p?.obstacleLib ?? {};
    for (const o of Array.isArray(p?.obstacles) ? p.obstacles : []) {
        const def = lib[o?.id];
        if (def?.activates) push(def.event, o.x, o.y, 'event');
        // ⛓ an atlas lock / rock / tree whose clearing IS an AP event (`events[] {name, side}`, the atlas maze
        //   projection's shape): the event sits on the obstacle's own tile. Two events on one obstacle share it.
        for (const ev of Array.isArray(def?.events) ? def.events : []) push(ev?.name, o.x, o.y, 'event');
    }
    // ⛓ a button whose press latches an AP event (`buttons[] {x, y, id}`, `buttonLib[id].latch.event`): on the button.
    const buttonLib = p?.buttonLib ?? {};
    for (const b of Array.isArray(p?.buttons) ? p.buttons : []) push(buttonLib[b?.id]?.latch?.event, b?.x, b?.y, 'event');
    return out;
}

/**
 * ⛓ The SIDE of a maze exit → `'N' | 'E' | 'S' | 'W'`, or null: its `side` when the generator wrote one, else the
 * border its door tile `(x, y)` sits on in a `w × h` level (a corner: the axis it is further out along, as
 * `regionGraph/directionLayout.doorOffset` decides; E/W on a tie). An interior door, or no tile or extent, has none.
 */
export function mazeExitSide(exit, extent) {
    if (SIDES.includes(exit?.side)) return exit.side;
    const { x, y } = exit ?? {};
    if (!Number.isInteger(x) || !Number.isInteger(y) || !extent) return null;
    const { w, h } = extent;
    const onBorder = x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1;
    if (!onBorder) return null;
    const u = (x + 0.5) / w - 0.5;
    const v = (y + 0.5) / h - 0.5;
    if (Math.abs(u) >= Math.abs(v)) return u > 0 ? 'E' : 'W';
    return v > 0 ? 'S' : 'N';
}

/**
 * ⛓ The layout KIND of a maze exit (`regionLayout.LINK_KINDS`), by who wrote it:
 *   · a GENERATED exit (it carries `side`): the pipeline sets `isTeleporter` when the target's grid cell is not
 *     adjacent (`procgenPipelineEngine.js`), so a teleporter is a `warp`, every other exit a `join` with `dir: side`;
 *   · an ATLAS exit (no `side`; projected from a Seedling level) is judged by **SEEDLING'S OWN RULE**
 *     (`flashPanel/seedlingExitKind.js`, the same functions `seedlingCompositeMap.seedlingLayoutGraph` calls — never a
 *     copy; maze-arrival-spawns, ⚖ user 2026-11-28T03:38:16.825Z "Copy Seedling's real ones", "Maps only for now"):
 *       – `seedlingExitLayoutKind(atlas_exit_id)`: a staircase / pit is `down` / `up`, with no `dir`;
 *       – else the ARRIVAL decides whether a border door is a walk-off edge (`seedlingEdgeTransitionOf`, in tiles,
 *         `ts = 1`): the exit's own `arrivalTile` (the projection carries Seedling's `target_spawn` there), else — the
 *         PAIR RULE, for a maze that carries none — the tile of the door back (`back`: the target payload's exit
 *         `targetExitId`). An edge is a `join` with the border's side; not an edge (an interior door, or an arrival away
 *         from the opposite border) is a `warp`; one the data cannot judge (no target extent) stays a `join`.
 *       – with neither arrival (⛔ `isTeleporter` is NOT a signal: every atlas exit is Seedling's Teleporter object),
 *         as before: a border door is a `join` with the border's side, an interior door a `warp`;
 *   · an exit the data cannot judge (no tile, no extent) stays a `join` with no `dir`.
 * `targetExtent` is the target level's `{w, h}` (`backExtent` is its older name, still read).
 */
export function mazeExitLayout(exit, extent, { back = null, targetExtent = null, backExtent = null } = {}) {
    if (SIDES.includes(exit?.side)) return exit.isTeleporter === true ? { kind: 'warp', dir: null } : { kind: 'join', dir: exit.side };
    const stair = typeof exit?.atlas_exit_id === 'string' ? seedlingExitLayoutKind(exit.atlas_exit_id) : 'join';
    if (stair !== 'join') return { kind: stair, dir: null };
    const dir = mazeExitSide(exit, extent);
    const tgt = targetExtent ?? backExtent;
    const arrival = mazeExitArrival(exit, back);
    if (arrival && Number.isInteger(exit?.x) && Number.isInteger(exit?.y)) {
        const edge = seedlingEdgeTransitionOf({ exit_tiles: [[exit.x, exit.y]], target_spawn: arrival }, extent, tgt, 1);
        if (edge === false) return { kind: 'warp', dir: null };
        return { kind: 'join', dir };
    }
    if (dir) return { kind: 'join', dir };
    const judged = Number.isInteger(exit?.x) && Number.isInteger(exit?.y) && extent;
    return { kind: judged ? 'warp' : 'join', dir: null };
}

/**
 * ⛓ Where a maze exit lands the player, `{x, y}` in the target level's tiles, or null: its `arrivalTile` (the atlas
 * projection's copy of Seedling's `target_spawn`), else the door back's tile (`back`, the pair rule), else null.
 * `source` says which. ⛔ Display only: play resolves arrivals in `mazeArrival.js`, which this never touches.
 */
export function mazeExitArrival(exit, back = null) {
    const a = exit?.arrivalTile;
    if (a && Number.isInteger(a.x) && Number.isInteger(a.y)) return { x: a.x, y: a.y, source: 'arrivalTile' };
    if (back && Number.isInteger(back.x) && Number.isInteger(back.y)) return { x: back.x, y: back.y, source: 'pair' };
    return null;
}

/**
 * ⛓⛓ `compositeMap.layoutGraph(ctx)` — the maze's adapter for `procgenCore/regionLayoutResolve.js` (step 2 of its
 * resolution; a world whose every region has a stored `grid_cell` is placed as stored and never asks).
 * `ctx = {sidecars, displayRegionOf}` → `{nodes, links}`:
 *   · nodes = the DISPLAY regions, in sidecar order (a shared level's members fold onto it);
 *   · links = every payload exit whose `targetRegion` has a sidecar, display-folded (a link inside one level is
 *     dropped), `kind` / `dir` by `mazeExitLayout` against the holder's and the target's extents (the exit's
 *     `arrivalTile`, else the door back, when named).
 * ⚠ ONE hook per world: the resolver uses it only when EVERY sidecar's substrate declares this same function, so a
 * world mixing the maze with another substrate is laid out generically (every committed mixed world has `grid_cell`).
 */
export function mazeLayoutGraph({ sidecars = {}, displayRegionOf = mazeDisplayRegionOf } = {}) {
    const displayOf = (name) => displayRegionOf(name, sidecars[name]);
    const nodes = [];
    const seen = new Set();
    for (const name of Object.keys(sidecars)) {
        const d = displayOf(name);
        if (!seen.has(d)) {
            seen.add(d);
            nodes.push(d);
        }
    }
    // ⛓ A SHARED LEVEL WORLD member carries no payload of its own (its level's payload sits on one member): the
    //   target's extent and door back are read from the payload of its LEVEL (the first sidecar of the same display
    //   region that has one). MEASURED on seedling_playthrough_maze: without this, 21 of its 320 links had no target
    //   extent, and Seedling's rule could not judge them.
    const levelPayload = new Map();
    for (const [name, sc] of Object.entries(sidecars)) {
        const d = displayOf(name);
        if (sc?.playable_payload && !levelPayload.has(d)) levelPayload.set(d, sc.playable_payload);
    }
    const payloadFor = (name) => sidecars[name]?.playable_payload ?? levelPayload.get(displayOf(name)) ?? null;
    const links = [];
    for (const [name, sc] of Object.entries(sidecars)) {
        const payload = sc?.playable_payload;
        const extent = mazeRegionExtent({ playable_payload: payload });
        for (const e of Array.isArray(payload?.exits) ? payload.exits : []) {
            const to = e?.targetRegion;
            if (typeof to !== 'string' || !sidecars[to]) continue;
            const from = displayOf(name);
            const target = displayOf(to);
            if (from === target) continue;
            const tp = payloadFor(to);
            const back = e.targetExitId == null ? null
                : (Array.isArray(tp?.exits) ? tp.exits : []).find((x) => x?.exit_id === e.targetExitId) ?? null;
            links.push({ from, to: target, ...mazeExitLayout(e, extent, { back, targetExtent: mazeRegionExtent({ playable_payload: tp }) }) });
        }
    }
    return { nodes, links };
}
