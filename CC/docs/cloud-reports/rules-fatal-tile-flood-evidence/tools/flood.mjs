// ⛓ rules-fatal-tile-flood — THE PROTOTYPE (report only; never wired here). Pure: a level record, one counted body,
// its class row and the caller's `wall(x, y)` in; the tiles the body can stand on and the tile types it can touch out.
//
// What moves an Enemy, read from the AS3 (vendor/seedling/src):
//   · Mobile.as:39-40,86-118 — every voluntary move (chase, wander, knockback: `Enemy.knockback` sets `v`, and
//     `mobileUpdate` spends it through moveX/moveY) is a 1 px step refused by `collideTypes(solids, …)`.
//   · Mobile.as:17 — the base `solids` = ["Solid", "Tree", "Rock", "Rope", "ShieldBoss"]. Every counted class here
//     only PUSHES onto it (Bob.as:39 "Enemy"; LavaRunner.as:43 "LavaBoss","Enemy"; Puncher.as:48 "Enemy","Player";
//     Jellyfish.as:35 "Enemy"; IceTurret.as:148 "Enemy","Player"), never removes a base entry, so the base list is the
//     floor of every class's solids. The pushed extras are BODIES (enemies, the player, the LavaBoss), which move or
//     die; ignoring them only widens the flood (the over-approximation the brief asks for).
//   · Enemy.as:92-103 — the pit fall re-centres x/y with NO collision test, but only on the pit the body already
//     stands on: it moves no body to a new tile.
//   · Enemy.as:131-139 `getState` — the tile a body "is on" is `nearestToPoint("Tile", x, y)`; a "Solid" tile is not a
//     "Tile" (Tile.as:24-27), so a body is only ever ON a non-Solid tile. Fatal: Enemy.as:63-90 (1 water if
//     `dieInWater`, 6 pit if `canFallInPit`, 17 lava if `dieInLava`), i.e. the class row's `dies`.
// Nothing else displaces a counted body: an enemy-hitter's shot calls `Enemy.hit` → knockback (above, solids apply);
// a pushable block carries "Enemy" in its own solids and STOPS at a body (PushableBlock.as:28,60-86;
// PushableBlockFire.as:31,54), it never shoves one; `Enemy.knockback` (Enemy.as:247-255) only adds to `v`; an opened lock / broken rock / burnt tree only REMOVES a solid,
// which the flood already assumes (see `wall` below).
//
// ONE SOURCE for walls (designer term 1): `wall(x, y)` is the caller's analyzer-grid `wall` cell — the same cells
// `pullLineClear` / rule T read (`playthroughLavaTrapPulls`). A `gated` cell (a lock, a breakable rock, a burnable tree)
// is NOT a wall: it may open, and the flood is permissive. A `sink` (pit/water/lava for the PLAYER) is not a wall
// either: whether it stops THIS body is its class's `dies`.
// The grid's walls must be a SUBSET of what the class collides with, or the flood is not an over-approximation:
// measured for the 10 kill-lock rooms (`census.mjs` → `walls-audit`): every grid wall there is a Solid tile or an
// entity typed "Solid"/"Tree"/"Rope" (DungeonSpire.as:20, Pole.as:18, Rock.as:16, RuinedPillar.as:21, Pulser.as:48,
// Tree.as:24, RopeStart.as:25, IceTurret.as:94), all in Mobile.as:17. A future room whose grid wall is something a
// class walks through (a "Player"-only solid) is the MISSING FIELD: the grid cell does not carry the AS3 collision
// `type` of what makes it a wall. The prototype refuses rather than guess (`wallTypes` hook, census-checked).
//
// Connectivity: 8-neighbour (a diagonal step between two diagonal walls is allowed). A body's box is wider than 1 px,
// so the game cannot squeeze that corner; allowing it only widens the flood. The start set is every tile the body's
// 16x16 placement box touches (its origin cell and the +8 centre cell the ruling uses), also a widening.
//
// A fatal tile the body steps onto is REACHED (it dies there) and the flood does not continue past it. A non-fatal
// sink (lava for a `dieInLava = false` LavaRunner) is walked like floor.

export const FLOOD_NEIGHBOURS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);

/**
 * @param {object} level  the level record (`width`, `height`)
 * @param {{x:number,y:number}} entity  the placed body
 * @param {{dies:number[]}} row  the body's `KILL_LOCK_BODY_CLASSES` row
 * @param {(x:number,y:number)=>boolean} wall  the analyzer grid's `wall` cells (REQUIRED; no second wall table)
 * @param {Map<string,Set<number>>} tileTypes  every non-cliffside tile type at each cell (all layers)
 * @param {number} tileSize
 * @returns {{cells:Set<string>, fatal:number[], deathCells:Object<string,string[]>, untiled:string[]}}
 */
export function fatalReach(level, entity, row, wall, tileTypes, tileSize = 16) {
    if (typeof wall !== 'function') throw new Error('fatalReach: pass `wall` (the analyzer grid\'s wall cells)');
    const W = level.width;
    const H = level.height;
    const key = (x, y) => `${x},${y}`;
    const fatalAt = (x, y) => [...(tileTypes.get(key(x, y)) ?? [])].filter((t) => row.dies.includes(t));
    const starts = new Set();
    for (const px of [entity.x, entity.x + tileSize / 2, entity.x + tileSize - 1]) {
        for (const py of [entity.y, entity.y + tileSize / 2, entity.y + tileSize - 1]) {
            starts.add(key(Math.floor(px / tileSize), Math.floor(py / tileSize)));
        }
    }
    const cells = new Set();
    const deathCells = {};
    const queue = [];
    for (const s of starts) {
        const [x, y] = s.split(',').map(Number);
        if (x < 0 || y < 0 || x >= W || y >= H || wall(x, y)) continue;
        cells.add(s);
        queue.push([x, y]);
    }
    while (queue.length) {
        const [x, y] = queue.shift();
        const f = fatalAt(x, y);
        if (f.length) {
            for (const t of f) (deathCells[t] ??= []).push(key(x, y));
            continue; // it dies here: no step past a fatal tile
        }
        for (const [dx, dy] of FLOOD_NEIGHBOURS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const k = key(nx, ny);
            if (cells.has(k) || wall(nx, ny)) continue;
            cells.add(k);
            queue.push([nx, ny]);
        }
    }
    // A reached cell with no Tile entity makes `getState`'s nearest-Tile fall to a neighbour (Enemy.as:133). Widen: the
    // fatal types of every tiled cell within one ring past the nearest tiled ring count as touched there.
    const untiled = [...cells].filter((k) => !(tileTypes.get(k)?.size));
    for (const k of untiled) {
        const [x, y] = k.split(',').map(Number);
        let r = 1;
        const tiledAt = (rr) => { const out = []; for (let yy = y - rr; yy <= y + rr; yy += 1) for (let xx = x - rr; xx <= x + rr; xx += 1) if (tileTypes.get(key(xx, yy))?.size) out.push([xx, yy]); return out; };
        while (r < Math.max(W, H) && tiledAt(r).length === 0) r += 1;
        for (const [xx, yy] of tiledAt(r + 1)) for (const t of fatalAt(xx, yy)) (deathCells[t] ??= []).push(`${key(xx, yy)}(nearest-of ${k})`);
    }
    const fatal = Object.keys(deathCells).map(Number).sort((a, b) => a - b);
    return { cells, fatal, deathCells, untiled };
}
