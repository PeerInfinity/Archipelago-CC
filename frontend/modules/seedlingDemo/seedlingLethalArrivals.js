// ⛓ RULES game-truth-gaps (R2) — **AN ARRIVAL ON LETHAL TERRAIN COSTS THE ITEM THAT SURVIVES IT.**
//
// The playthrough generator charges a DEPARTURE door its own sealed cell (`chargeSealedDoor`) and leaves
// every ARRIVAL uncharged (`arrivalsUncharged`): the analyzer's binding answers "which component can REACH
// this tile", the departure question. The arrival question is narrower and always sound: the game puts the
// body ON the landing (`new Game(level, x, y)`), so if the landing is lethal terrain the player cannot hold
// that region at all without the item that survives it. Ten landing edges shipped open without Swim and
// drop the player in water (L0<->L89, L3<-L111, L48<-L53, L49-L51, L115<-L113): `Player.drown()` ends in
// `die()` -> `Game.restartLevel()` -> `new Game(level, playerPosition)`, the SAME landing, a drown loop.
//
// Two questions, each asked of its authority:
//   - TERRAIN: the tile under the player's probe point at the landing is one of the model's lethal tiles
//     (`levelWorld.lethalTerrainTiles`: water and lava, the two `checkDrowning` arms). What it COSTS is the
//     transcription's (`seedlingSemantics.TILE_TYPE_SEMANTICS` for that tile type), never typed here.
//   - LETHAL: the physics model, booted at the landing with NO items, dies IDLE within `ticks`.
//     ⚖ GAME TRUTH FIRST (planner ruling on the user's terms, 2026-10-06): an earlier cut also asked the model
//     whether a HELD direction walks off the landing, and exempted the two it said did (L54 (144,16) and the
//     mouth's landing in L58, west onto land). The wasm game DROWNS both under the same input
//     (`probe-seedling-lethal-landings.mjs`, tips e63912d970 / 43936cbff6), so that answer was a model-fidelity
//     gap, not a way: it is dropped, and the walk-off defect is the fidelity arc's. The only arrival that is
//     not charged is one that is not lethal idle; stepping back out of the door is no arrival and needs no rule.
//
// ⛓ The firewall's allowed direction (§6.3): an atlas producer reads the model; the model reads nothing
// back. Imported by the generator only (the model's run is heavy; nothing in the browser asks this).

import { buildLevelWorld, TILE_SIZE } from './levelWorld.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import { createLevelRun } from './levelRun.js';

/** How long an arrival is watched, per input. The drown latch is 11 cumulative water ticks + 20 `drown()` ticks. */
export const LETHAL_ARRIVAL_TICKS = 180;


const worlds = new WeakMap();
const worldOf = (level) => {
    if (!worlds.has(level)) worlds.set(level, buildLevelWorld(level));
    return worlds.get(level);
};

/**
 * The lethal terrain tile under an arrival at (x, y) (OEL pixels, a `new Game` boot), or null. The probe
 * point is `arrivalStandRefusal`'s (the boot's spawn, one pixel down).
 *
 * @returns {{tile:[number, number], type:number}|null}
 */
export function lethalTerrainUnder(level, x, y, { tileSize = TILE_SIZE } = {}) {
    const at = spawnFromBoot({ x, y });
    const tx = Math.floor(at.x / tileSize);
    const ty = Math.floor((at.y + 1) / tileSize);
    const hit = worldOf(level).lethalTerrainTiles.find((t) => t.tx === tx && t.ty === ty);
    return hit ? { tile: [tx, ty], type: hit.t } : null;
}

/**
 * Does an item-less arrival at (x, y) in `level` die IDLE within `ticks`? Returns `{lethal, outcome}`
 * (`die@t:<source>` or `alive`) so the generator prints what it measured.
 *
 * @param {object} level the map document's level record (the run reads it through `levelSource`)
 * @param {(id:number) => object} levelSource
 */
export function arrivalIsLethal(level, x, y, { levelSource, ticks = LETHAL_ARRIVAL_TICKS } = {}) {
    const run = createLevelRun({ levelSource, boot: { level: level.level, x, y }, pins: ['sound', 'dead_frames'], grants: [] });
    for (let t = 0; t < ticks; t += 1) {
        run.advance(new Set());
        const deaths = run.playerDeaths ?? [];
        if (deaths.length > 0) return { lethal: true, outcome: `die@${deaths[0].t}:${deaths[0].source}` };
    }
    return { lethal: false, outcome: 'alive' };
}
