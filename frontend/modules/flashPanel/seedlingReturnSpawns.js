/**
 * flashPanel/seedlingReturnSpawns — **WHERE THE GAME ITSELF PUTS YOU WHEN YOU
 * COME BACK OUT THROUGH A DOOR** (seedling-pipeline T2b, U2b; ⚖ planner
 * 2026-09-23: design A).
 *
 * ⛔ THE REASON, MEASURED (plan §15.0). An arrival used to land ON the door's
 * own tile (`entrance_spawn` = the atlas's `entrance_tile`). On the house door
 * (level 0, 160,272) the game does NOT DRAW the player: two jumps there showed
 * no sprite, while the stairs and open tiles did, and one step off (y 288.7)
 * showed it again. Vanilla never lands there. Leaving the house (level 86 → 0)
 * puts the player at (160,288), and coming up the owl's-nest stairs from level 2
 * puts them at (256,256): one tile OFF the door each time. That spot is the
 * `playerx/playery` of the link in the door's DESTINATION level that leads back
 * to this level. It also clears the door's `check()` latch, so the player can
 * walk straight back in.
 *
 * ⇒ `returnSpawnTable(mapDoc)` indexes, for every link entity on every level,
 * the spawn of the nearest reverse link: in the destination level `to`, a link
 * whose own `to` is this level, and whose `(playerx, playery)` lies within
 * `MAX_RETURN_DISTANCE_TILES` of the door. With no such link (a one-way door,
 * or a reverse link that lands far away, i.e. another door's) the door has no
 * entry, and the binding falls back to `entrance_spawn`.
 *
 * Pure: no fetch, no DOM. The panel fetches the map document the preset names
 * (`mapDocumentPath`) and hands the table to the binding.
 */

/**
 * The map's link entities. ⛔ SPELLED HERE, PINNED THERE: the canonical list is
 * `seedlingAtlasDerivation.LINK_TAGS`, which this module must not import (it is
 * in the panel's static closure, and the derivation is ~1.2 MB of it; see
 * `seedlingRegionBinding.outExitIdOf`). `seedlingReturnSpawns.test.js` asserts
 * the two agree.
 */
export const RETURN_LINK_TYPES = Object.freeze(['teleporter', 'stairsup', 'stairsdown']);

/** A reverse link further than this from the door is another door's, not this one's. */
export const MAX_RETURN_DISTANCE_TILES = 2;

/** The key a door is looked up by: its level and its TILE. */
export const returnKey = (level, tx, ty) => `${level}|${tx}|${ty}`;

/**
 * @param {{tile_size:number, levels:Array<{level:number, entities:Array}>}} mapDoc
 * @returns {Map<string, {x:number, y:number, via:{level:number, type:string, x:number, y:number}}>}
 */
export function returnSpawnTable(mapDoc) {
    const table = new Map();
    const size = mapDoc?.tile_size;
    if (!Number.isInteger(size) || size <= 0 || !Array.isArray(mapDoc?.levels)) return table;
    const links = new Map();
    for (const L of mapDoc.levels) {
        links.set(L.level, (L.entities ?? []).filter((e) => RETURN_LINK_TYPES.includes(e.type)));
    }
    const limit = MAX_RETURN_DISTANCE_TILES * size;
    for (const [level, doors] of links) {
        for (const door of doors) {
            const to = Number(door.attrs?.to);
            if (!Number.isInteger(to) || to === level) continue;
            let best = null;
            for (const back of links.get(to) ?? []) {
                if (Number(back.attrs?.to) !== level) continue;
                const x = Number(back.attrs?.playerx);
                const y = Number(back.attrs?.playery);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                const d = Math.hypot(x - door.x, y - door.y);
                if (d <= limit && (!best || d < best.d)) {
                    best = { d, x, y, via: { level: to, type: back.type, x: back.x, y: back.y } };
                }
            }
            if (best) {
                table.set(returnKey(level, Math.floor(door.x / size), Math.floor(door.y / size)),
                    { x: best.x, y: best.y, via: best.via });
            }
        }
    }
    return table;
}
