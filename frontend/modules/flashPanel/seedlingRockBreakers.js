/**
 * ⛓⛓ RULES rules-fire-breaks-rocks — **WHAT BREAKS A BREAKABLE ROCK, DERIVED FROM THE GAME SOURCE, AND FROM WHICH SIDE
 * THE FLAME CAN DO IT.**
 *
 * THE SOURCE (vendor/seedling/src):
 *   - `BreakableRock.hit(_t)` breaks the rock when `rockType <= _t` (`Puzzlements/BreakableRock.as:57-67`); the
 *     ordinary rock is rockType 0, the ghost rock rockType 1 (`Game.as:2375-2376`).
 *   - `Player.genericHit` calls `(e as BreakableRock).hit(hasGhostSword ? 1 : 0)` for EVERY hit kind it is handed
 *     (`Player.as:1091-1094`): the hit power is the Ghost Sword flag, never the weapon.
 *   - Exactly THREE callers hand it a rock (`grep genericHit` over `src/`): the sword slash (`Player.as:924`, under
 *     `slash()`'s `hasSword`), the spear thrust (`Player.as:989`, `hasSpear`), and the FLAME (`Player.as:1032`,
 *     `Player.fire()`, `hasFire || hasFireWand`). All three collide with `hitables`, which holds "Solid"
 *     (`Player.as:99`), and a BreakableRock's type is "Solid" (`BreakableRock.as:41`).
 *   - Not a breaker: the Wand's shot (`Projectiles/WandShot.as:checkEntity` handles `Enemy` and `MagicalLock` only),
 *     and nothing else in `src/` names `BreakableRock` but `Game.as` (construction) and `genericHit`.
 *   So an ORDINARY rock is broken by the Sword, the Spear or Fire, and a GHOST rock only under `hasGhostSword` (the
 *   transcription's `breakablerockghost` row, unchanged here).
 *
 * THE FLAME HAS NO AIM. `Player.fire()` (`Player.as:1015-1035`) collides a 32x32 rect centred on the player and keeps
 * every hitable within `sprFire.width / 2` = 16 px of the player's box (`FP.distanceRects`), then hits ALL of them:
 * another rock, a spinner, a turret, an enemy. So a rock is a Fire-breakable obstacle only where the player can STAND
 * so that the flame reaches that rock and NOTHING ELSE that responds — the solver's own Fire stance rule
 * (`solverBot.fireBreakStances`, fidelity FIREBREAK: the flame "reaches this rock and no other `modelled` or `refused`
 * responder"), asked here of the static level (every rock standing, every responder at its placement), from every
 * walkable tile centre whose `fireRect` can reach the rock (the `burn` verb's ±2-tile window). Where no such stance
 * exists (L40's three rocks: every cell also reaches a second rock and the spinners; L41's two: every cell reaches
 * both), the rock keeps the swing's rule: Fire is not credited.
 *
 * A STANCE IS ON A SIDE. A rock between two rooms is crossed from one side; the flame breaks it only from a side that
 * holds a stance. So each ENTRY direction into the rock's tile is asked whether the free floor behind it (a 4-connected
 * flood of walkable tile centres from the neighbour the step comes from, not through any rock) reaches a stance. A
 * direction that does not keeps the swing's rule (`enter` gate); the others gain Fire. A landing INSIDE a rock (L0's
 * `in_L12_0_80` / `in_L1_64_112`) leaves through an entry with no stance behind it, so it keeps the swing's rule.
 *
 * A LANDING THE PLAYER IS ON ONLY BY ARRIVING. A door's landing tile is a teleporter cell, which a walk cannot stand on
 * (stepping on warps), but an arrival stands there latched (fidelity FIREBREAK `firebreak-l3-pocket`: L3's L11 landing
 * (96,128) is a one-cell pocket whose only way off is `breakablerock@96,112`, and the game breaks it with Fire from the
 * door). So an `arrivalTiles` tile counts as floor for a stance and for the flood exactly when no walkable tile beside it
 * (outside the rock) leads anywhere: whoever stands behind that entry stands on the landing.
 *
 * DEPENDENCY-INJECTED (`model`), like `seedlingObstacleEvents.poleKillsOf`: this file reads the physics model the
 * caller hands it and owns none of it.
 *   model = { buildLevelWorld, ROLES, auditFire, plannerObstacleAt, fireRect }
 */

import { SEEDLING_TILE_SIZE } from './seedlingSemantics.js';

const TILE = SEEDLING_TILE_SIZE;

/** The breaker arms an ORDINARY rock answers to, each with its `genericHit` call site. */
export const ROCK_BREAK_ARMS = Object.freeze([
    Object.freeze({ flag: 'hasSword', cite: 'Player.as:924 (slash -> genericHit)' }),
    Object.freeze({ flag: 'hasSpear', cite: 'Player.as:989 (thrust -> genericHit)' }),
    Object.freeze({ flag: 'hasFire', cite: 'Player.as:1032 (fire -> genericHit)', reach: 'a stance whose flame reaches this rock alone' }),
]);

/** The tag whose Fire half this module decides (the ghost rock has none: `rockType` 1 > the flame's `_t` 0). */
export const FIRE_ROCK_TAG = 'breakablerock';

const DIRS = Object.freeze([['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]);

export const rockIdOf = (e) => `${e.type}@${e.x},${e.y}`;

/**
 * Every ordinary rock of `level`, with its clean Fire stances and the entry directions that reach one.
 * @returns {Map<string, {id, x, y, tiles:[number,number][], stances:{x,y}[], crowded:number, fireDirs:string[], swingDirs:string[]}>}
 */
export function rockFireSides(level, model, { arrivalTiles = [] } = {}) {
    const out = new Map();
    const rocks = (level.entities ?? []).filter((e) => e.type === FIRE_ROCK_TAG);
    if (rocks.length === 0) return out;
    const world = model.buildLevelWorld(level, { roles: model.ROLES });
    const width = level.width;
    const height = level.height;
    const walkMemo = new Map();
    const walkable = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
        const k = ty * width + tx;
        if (!walkMemo.has(k)) walkMemo.set(k, model.plannerObstacleAt(world, tx * TILE + TILE / 2, ty * TILE + TILE / 2, null, {}) === null);
        return walkMemo.get(k);
    };
    const arrivals = new Set(arrivalTiles.map(([x, y]) => `${x},${y}`));
    for (const rock of rocks) {
        const id = rockIdOf(rock);
        const responder = world.pressResponders.find((r) => r.as3 === 'BreakableRock' && `${r.tag}@${r.x},${r.y}` === id);
        if (!responder) throw new Error(`rockFireSides: L${level.level} ${id} is not among the model's press responders`);
        const rect = responder.rect;
        const tx0 = Math.max(0, Math.floor(rect.x / TILE) - 2);
        const tx1 = Math.floor((rect.right - 1) / TILE) + 2;
        const ty0 = Math.max(0, Math.floor(rect.y / TILE) - 2);
        const ty1 = Math.floor((rect.bottom - 1) / TILE) + 2;
        const ownTiles = new Set();
        for (let ty = Math.floor(rect.y / TILE); ty <= Math.floor((rect.bottom - 1) / TILE); ty += 1) {
            for (let tx = Math.floor(rect.x / TILE); tx <= Math.floor((rect.right - 1) / TILE); tx += 1) ownTiles.add(`${tx},${ty}`);
        }
        // A landing with no floor beside it (outside this rock): its occupant arrived there.
        const isolatedLanding = (tx, ty) => arrivals.has(`${tx},${ty}`) && !ownTiles.has(`${tx},${ty}`)
            && DIRS.every(([, dx, dy]) => ownTiles.has(`${tx + dx},${ty + dy}`) || !walkable(tx + dx, ty + dy));
        const floor = (tx, ty) => walkable(tx, ty) || isolatedLanding(tx, ty);
        const stances = [];
        let crowded = 0;
        for (let ty = ty0; ty <= ty1; ty += 1) {
            for (let tx = tx0; tx <= tx1; tx += 1) {
                if (!floor(tx, ty)) continue;
                const at = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
                const audit = model.auditFire(world, at);
                if (!audit.modelled.some((r) => r.id === id)) continue;
                const others = [...audit.modelled.filter((r) => r.id !== id), ...audit.refused];
                if (others.length > 0) { crowded += 1; continue; }
                stances.push({ x: at.x, y: at.y, tx, ty, ...(walkable(tx, ty) ? {} : { landing: true }) });
            }
        }
        const tiles = [...ownTiles].map((k) => k.split(',').map(Number));
        const own = ownTiles;
        const stanceKeys = new Set(stances.map((s) => `${s.tx},${s.ty}`));
        // The free floor behind an entry: walkable tile centres, 4-connected, never through this rock's tiles (the
        // other rocks are not walkable: `plannerObstacleAt` holds them solid, as the room is before any break).
        const reachesStance = (sx, sy) => {
            if (!floor(sx, sy) || own.has(`${sx},${sy}`)) return false;
            const seen = new Set([`${sx},${sy}`]);
            const stack = [[sx, sy]];
            while (stack.length) {
                const [x, y] = stack.pop();
                if (stanceKeys.has(`${x},${y}`)) return true;
                for (const [, dx, dy] of DIRS) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const k = `${nx},${ny}`;
                    if (seen.has(k) || own.has(k) || !walkable(nx, ny)) continue;
                    seen.add(k);
                    stack.push([nx, ny]);
                }
            }
            return false;
        };
        const fireDirs = [];
        const swingDirs = [];
        if (stances.length > 0) {
            for (const [dir, dx, dy] of DIRS) {
                // A step INTO the rock moving `dir` comes from the tile behind it on the opposite side.
                const from = tiles.filter(([x, y]) => !own.has(`${x - dx},${y - dy}`)).map(([x, y]) => [x - dx, y - dy]);
                (from.some(([x, y]) => reachesStance(x, y)) ? fireDirs : swingDirs).push(dir);
            }
        }
        out.set(id, { id, x: rock.x, y: rock.y, tiles, stances, crowded, fireDirs, swingDirs });
    }
    return out;
}

/** `rockFireSides` over every level of `levels`, keyed `L<level>:<rock id>`; `arrivalTilesOf(level)` names its landings. */
export function buildRockFireSides(levels, model, { arrivalTilesOf = () => [] } = {}) {
    const out = new Map();
    for (const level of levels) {
        const opts = { arrivalTiles: arrivalTilesOf(level.level) ?? [] };
        for (const [id, row] of rockFireSides(level, model, opts)) out.set(`L${level.level}:${id}`, { level: level.level, ...row });
    }
    return out;
}
