/**
 * ⛓⛓ rules-fire-arm-chaser-guard — THE FIRE ARM DOES NOT COUNT WHERE A BODY FIRE CANNOT STOP GUARDS THE CROSSING.
 * ⚖ Robert 2026-11-16: "Build the general fix (Recommended)". The flame does no damage (`Player.as:178` `fireDamage = 0`;
 * `Enemy.as:151` `if (hitByFire || t != "Fire")` — every other Fire hit is `knockback` only), so a crossing that a Fire
 * arm opens is hit-free only if no body can reach it that Fire cannot stop. A body BLOCKS a rock's Fire arm when all of:
 *
 *   (a) the Fire-only state cannot stop it: its class takes no Fire damage (`hitByFire` with `fireDamage` > 0,
 *       `Enemy.as:38,151-157`), and no tile it dies on (`dieInWater` / `dieInLava` / `canFallInPit`, `Enemy.as:69-88`,
 *       read off `combat.ENEMY_CLASSES[tag].terrain`) borders the region it can move in — a homer walks straight at its
 *       target with no avoidance (`Bob.as:55-66`), so a lethal tile on its border is one the player can lure it onto
 *       (L73's bulb into the lava pit: the witness `rules-fire-only-witness`, gone at t154 on the game);
 *   (b) it is FASTER than the player on the terrain it holds: its speed on the region's tiles (`chasers.CHASERS[tag]
 *       .speedByTerrain` where the class re-chooses its speed by tile, else `ENEMY_CLASSES[tag].speed`) is STRICTLY
 *       greater than `Player.as:73` `dMS` (`PROFILE.walkSpeed`). Equality does NOT block: the chase normalises `v` to
 *       `moveSpeed` (`Bob.as:61-66`), so at `moveSpeed == dMS` it cannot close on a player moving away (and the game
 *       agrees: L30's bobsoldier and L92's jellyfish, both 0.8, are GAME YES with Fire only);
 *   (c) it is a HOMER (`aggro.kind` in `HOMING_AGGRO`) whose leash (`runRange`, `Bob.as:58` `d <= runRange`, inclusive)
 *       covers the corridor from the region it can move in: a flood from its spawn tiles over the cells it can cross.
 *
 * THE REGION (the body's flood): every grid cell it can stand on — not a wall/sink/manual cell (`HP.BLOCKING`), not an
 * entity-gated cell (a conditioned cell whose tile is no terrain: a rock, a lock — `Mobile.as:17` `solids` holds "Solid",
 * and `BreakableRock.as:41` is "Solid"), not a tile it dies on. The crossing's OWN rock cell is open: the crossing happens
 * with the rock broken. A class with no solids (`chasers.CHASERS[tag].solidsMover === 'none'`, the Flyer: `Flyer.as:45`
 * `solids = new Array()`) crosses every cell but the ones it dies on.
 *
 * THE CORRIDOR (deliberately conservative — a superset of every crossing's cells): the rock's tiles, its flame stances
 * (`seedlingRockBreakers.rockFireSides`), and on each side of the rock the whole player-open component its neighbours
 * reach (grid cells `open`/`directional` with no condition: the walk the side's exits and landings are reached by, without
 * any other key). The leash is measured cell-square to cell-square (the nearest points of the two 16 px tiles), a lower
 * bound on `FP.distance` between a body centre in the region and a player in the corridor.
 *
 * Inputs are the per-class constants (`ENEMY_CLASSES`, `CHASERS`, `ENEMY_DAMAGE_DEFAULTS`, `PROFILE`), the PATCHED map's
 * entities (the caller's census bodies), the tile terrain and the rocks' flame stances. No level literal, no class-name
 * list: a class is read only through its constants. Nothing here imports the rules producer, and nothing in the
 * derived-table engine closure imports this file.
 */
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { CHASERS } from '../../frontend/modules/seedlingDemo/chasers.js';
import { ENEMY_DAMAGE_DEFAULTS } from '../../frontend/modules/seedlingDemo/enemyDamage.js';
import { PROFILE } from '../../frontend/modules/seedlingDemo/seedlingProfile.js';
import { T, BLOCKING, TERRAIN_TILE, bodyTiles, label, xy } from './seedlingHolderParking.js';

/**
 * The aggro kinds whose motion tracks the player (read off `ENEMY_CLASSES[tag].aggro.kind`): Bob's chase and its
 * subclasses (`Bob.as:55-66`), the Flyer's chase with no solids (`Flyer.as:45,47-77`), and the Drill's hop at the player
 * (`Drill.as:18,37`). Every other kind is static, a wall-hug launch or a shooter: none of them follows a player.
 */
export const HOMING_AGGRO = Object.freeze({
    chase: 'Enemies/Bob.as:55-66 (FP.distance <= runRange, then v toward the player)',
    'chase-through-walls': 'Enemies/Flyer.as:45,47-77 (Bob\'s chase with solids = [])',
    'teleport-hop': 'Enemies/Drill.as:18,37 (hops toward the player inside runRange)',
});

/** The player's side of the comparison: `Player.as:73` `dMS` and `Player.as:178` `fireDamage`. */
export const PLAYER_GUARD_PROFILE = Object.freeze({ walkSpeed: PROFILE.walkSpeed, fireDamage: PROFILE.fireDamage });

const TERRAIN_IDS = new Set(Object.values(TERRAIN_TILE));
const PLAYER_OPEN = new Set(['open', 'directional']);

/**
 * One class's guard constants, from the census tables only. `overrides` replaces fields (unit rows build synthetic
 * classes with it); a real class passes none.
 */
export function guardClassOf(tag, overrides = {}) {
    const row = overrides.row ?? ENEMY_CLASSES[tag] ?? null;
    const chaser = overrides.chaser ?? CHASERS[tag] ?? null;
    const runRange = typeof row?.aggro?.range === 'number' ? row.aggro.range : 0;
    const lethalTiles = new Set(Object.entries(TERRAIN_TILE)
        .filter(([t]) => /^(dies|falls)$/.test(row?.terrain?.[t] ?? '')).map(([, id]) => id));
    const byTerrain = chaser?.speedByTerrain ?? null;
    return {
        tag,
        homing: Boolean(row && HOMING_AGGRO[row.aggro?.kind] && runRange > 0 && row.speed > 0),
        aggroKind: row?.aggro?.kind ?? null,
        runRange,
        speedOn: (tileType) => (byTerrain ? (byTerrain.swimTiles.includes(tileType) ? byTerrain.swim : byTerrain.walk) : (row?.speed ?? 0)),
        speedSrc: byTerrain ? `chasers.CHASERS.${tag}.speedByTerrain (${byTerrain.src})` : `combat.ENEMY_CLASSES.${tag}.speed (${row?.src ?? '?'})`,
        hitByFire: overrides.hitByFire ?? ENEMY_DAMAGE_DEFAULTS.hitByFire,
        lethalTiles,
        passesWalls: chaser?.solidsMover === 'none',
    };
}

const cellDistance = (a, b, width) => {
    const [ax, ay] = xy(a, width);
    const [bx, by] = xy(b, width);
    const dx = Math.max(0, Math.abs(ax - bx) - 1) * T;
    const dy = Math.max(0, Math.abs(ay - by) - 1) * T;
    return Math.hypot(dx, dy);
};

const neighbours = (i, width, height) => {
    const [x, y] = xy(i, width);
    const out = [];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) out.push(ny * width + nx);
    }
    return out;
};

function flood(starts, open, width, height) {
    const seen = new Set(starts.filter(open));
    const stack = [...seen];
    while (stack.length) {
        const i = stack.pop();
        for (const n of neighbours(i, width, height)) {
            if (seen.has(n) || !open(n)) continue;
            seen.add(n);
            stack.push(n);
        }
    }
    return seen;
}

/** The rock's corridor: its tiles, its flame stances, and the player-open component on each side. */
export function rockCorridor(rock, grid) {
    const { width, height, cells } = grid;
    const rockTiles = rock.tiles.map(([x, y]) => y * width + x);
    const stanceTiles = rock.stances.map((s) => s.ty * width + s.tx);
    const playerOpen = (i) => PLAYER_OPEN.has(cells[i].kind) && (cells[i].conditions ?? []).length === 0;
    const starts = rockTiles.flatMap((i) => neighbours(i, width, height)).filter((i) => !rockTiles.includes(i));
    const sides = flood([...starts, ...stanceTiles], playerOpen, width, height);
    return new Set([...rockTiles, ...stanceTiles, ...sides]);
}

/** The cells a body can move in for this crossing (the rock broken), and the lethal tiles bordering them. */
export function bodyRegion(body, cls, rock, grid, tileTypes) {
    const { width, height, cells } = grid;
    const rockTiles = new Set(rock.tiles.map(([x, y]) => y * width + x));
    const lethal = (i) => cls.lethalTiles.has(tileTypes.get(i));
    const open = (i) => {
        if (lethal(i)) return false;
        if (cls.passesWalls || rockTiles.has(i)) return true;
        if (BLOCKING.has(cells[i].kind)) return false;
        // a conditioned cell is open to a body only where the condition is the terrain's (a swim or a suit), never an
        // entity's (`Mobile.as:17` solids; a rock or a lock is "Solid")
        return (cells[i].conditions ?? []).length === 0 || TERRAIN_IDS.has(tileTypes.get(i));
    };
    const spawn = bodyTiles(body, width).filter((i) => i >= 0 && i < cells.length);
    // a body whose own tiles are closed to it (it stands on a wall's edge) floods from the open ones it covers
    const region = flood(spawn, open, width, height);
    const lethalBorder = new Set();
    for (const i of region) for (const n of neighbours(i, width, height)) if (!region.has(n) && lethal(n)) lethalBorder.add(n);
    return { region, lethalBorder };
}

/**
 * One body against one rock: the three terms and the verdict. `profile` is the player's side
 * (`PLAYER_GUARD_PROFILE`); `classOf` maps a tag to its constants (`guardClassOf`).
 */
export function chaserGuardVerdict(body, rock, { grid, tileTypes, corridor = rockCorridor(rock, grid), profile = PLAYER_GUARD_PROFILE, classOf = guardClassOf }) {
    const cls = classOf(body.tag);
    const { width } = grid;
    const { region, lethalBorder } = bodyRegion(body, cls, rock, grid, tileTypes);
    const takesFire = Boolean(cls.hitByFire) && profile.fireDamage > 0;
    const terrainTypes = [...new Set([...region].map((i) => tileTypes.get(i) ?? null))];
    const speed = region.size ? Math.max(...terrainTypes.map((t) => cls.speedOn(t))) : 0;
    let distance = Infinity;
    for (const r of region) {
        for (const c of corridor) {
            const d = cellDistance(r, c, width);
            if (d < distance) distance = d;
            if (distance === 0) break;
        }
        if (distance === 0) break;
    }
    const terms = {
        a: !takesFire && lethalBorder.size === 0,
        b: speed > profile.walkSpeed,
        c: cls.homing && distance <= cls.runRange,
    };
    return {
        body: label(body), tag: body.tag, spawn: { x: body.x, y: body.y },
        speed, walkSpeed: profile.walkSpeed, runRange: cls.runRange, aggroKind: cls.aggroKind, homing: cls.homing,
        takesFire, lethalBorder: [...lethalBorder].map((i) => xy(i, width)), regionCells: region.size, distance,
        terms, blocks: terms.a && terms.b && terms.c,
    };
}

/**
 * ⛓ The fold both Fire narrowings share: the rock keeps the swing on every side and loses its flame stances, and the
 * pass's reason is recorded under its own field (`narrowed`: the holder census's one record; `guarded`: this guard's
 * list). Each pass decides from the RAW map and only removes Fire, so the two commute.
 */
export function foldRockFire(entry, field, reason) {
    return {
        ...entry, stances: [], fireDirs: [], swingDirs: [...new Set([...entry.fireDirs, ...entry.swingDirs])].sort(),
        [field]: reason,
    };
}

/**
 * The guard as ONE narrowing pass over the rocks' Fire map. `sides` is the map so far (another pass may already have
 * folded a rock), `raw` the un-narrowed map the verdicts are decided from. `roomOf(level)` gives `{grid, tileTypes,
 * bodies}` for a level number. Returns the new map and the narrowings it made.
 */
export function narrowRockFireByChasers(sides, raw, { roomOf, profile = PLAYER_GUARD_PROFILE, classOf = guardClassOf }) {
    const out = new Map(sides);
    const narrowings = [];
    const rooms = new Map();
    for (const [key, rock] of raw) {
        if (rock.stances.length === 0) continue;
        if (!rooms.has(rock.level)) rooms.set(rock.level, roomOf(rock.level));
        const room = rooms.get(rock.level);
        if (!room || room.bodies.length === 0) continue;
        const corridor = rockCorridor(rock, room.grid);
        const rows = room.bodies.map((b) => chaserGuardVerdict(b, rock, { grid: room.grid, tileTypes: room.tileTypes, corridor, profile, classOf }));
        const guards = rows.filter((r) => r.blocks);
        if (guards.length === 0) continue;
        const reason = guards.map((g) => ({ body: g.body, spawn: g.spawn, speed: g.speed, runRange: g.runRange, distance: g.distance }));
        out.set(key, foldRockFire(out.get(key) ?? rock, 'guarded', reason));
        narrowings.push({ level: rock.level, rock: key, guards: reason, rows });
    }
    return { sides: out, narrowings };
}
