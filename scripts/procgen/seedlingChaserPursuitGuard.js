/**
 * ⛓⛓ rules-k-pursuit-speed — RULE K WITH TERM (b), WIRED: A CHASER GUARDS A CROSSING ONLY IF IT OUTRUNS THE PLAYER.
 * ⚖ Robert 2026-11-18 (direct): "Wire (b) after T". Seedling's AP logic must match the game and never expects the player
 * to take a hit (⚖ Robert). Rule K as first built (rules-chaser-arrival-killarm, `de4b4d08db`) charged a crossing a kill arm
 * wherever a chasing body's leash cut it, and over-charged 12 GAME YES rows; the report slice rules-k-chaser-narrowing
 * measured term (b), the pursuit speed, exact from the source. This file is K's pure half (K only: rule T is
 * `seedlingTrapTongueGuard.js`) with (b) as a filter that only REMOVES bodies from K's cut.
 *
 * WHERE THE CHARGE LANDS: in the derivation INPUT, the analyzer grid (the derived-rule table overwrites a composed-only fix,
 * `seedlingDerivedRuleTable.js`). A cut cell becomes a GATED cell whose occupancy condition is the arm (the kill-lock shape,
 * `maze.md` § room-clear lock): the analyzer splits the room at it and prices the crossing; a route that can avoid it keeps
 * its price. ⛔ Not an `enter` gate on an open cell (`regionAtlasAnalyzer.findComponents` floods every `open` cell).
 *
 * ── RULE K: a chaser's leash cut costs its kill arm ─────────────────────────────────────────────────────────────────
 * A body is a K candidate when (the Fire guard's terms, `seedlingFireChaserGuard.js`, reused):
 *   - it is faster than `Player.as:73` `dMS` on the terrain of its own flood (`guardClassOf.speedOn`; the nominal screen);
 *   - it homes (`HOMING_AGGRO`) with a leash (`runRange`, `Bob.as:58` `d <= runRange`);
 *   - its body HITS ON CONTACT (`chasers.CHASERS[tag].contactHits !== false`; the Flyer's `hitPlayer` is empty, `Flyer.as:83-85`).
 * Its LEASH ZONE: the player cells (not `HP.BLOCKING`) whose nearest point is within `runRange` of the body's spawn centre
 * AND within contact of its own flood (`FCG.bodyRegion`, its lethal tiles excluded; in it or 4-adjacent to it).
 * Its CUT: the zone's cells 4-adjacent to a player cell OUTSIDE the zone that the body can still follow the player to.
 * An arrival landing, a door and a LavaTrap's own tile are never charged (`exempt`).
 *
 * ── TERM (b): PURSUIT SPEED (the filter; it only removes a body) ──────────────────────────────────────────────────────
 * A K candidate is kept iff, on SOME tile type of its own flood, its pursuit speed is GREATER than the player's on that
 * tile. Both speeds are MEASURED off the repo's AS3 ports by stepping them on an open plane (`measurePlayer`,
 * `measureChaser`, `measureHopper`), never typed:
 *   - the player: `playerPhysicsV1.step` (`Player.as:73` dMS, `:1515-1555` input adds `accel` while `v < moveSpeed`,
 *     `Mobile.as:73-84` friction) → walk ≈ 1.1746 px/tick per axis (the saw-tooth averages above dMS 0.8); on a swim tile
 *     (`Player.as:544-548` `moveSpeeds[17]` + `WATER_FRICTION`) ≈ 0.45;
 *   - a chaser: `chasers.chaserStep` (`Bob.as:57-75`, `LavaRunner.as:17-18,84-93`, `Puncher.as:18,62-73`, net of friction),
 *     with the class's per-terrain speed (`speedByTerrain`) → lavarunner 1.25 walk / 0.75 swim, puncher 0.75;
 *   - a teleport-hopper (`aggro.kind === 'teleport-hop'`): `drill.stepDrill` + `stepDrillGraphic` (`Drill.as:27-28,85-110`:
 *     one tile per drill+undrill cycle at `FP_ELAPSED`) → 16 px / 15 ticks ≈ 1.0667;
 *   - a class with neither port keeps its census speed (`ENEMY_CLASSES[tag].speed`): it is never smaller than the measured
 *     one, the strict side.
 * Only the lavarunner qualifies on the delivered map (1.25 > 1.17 on floor, 0.75 > 0.45 in lava). (c) (the step-rule
 * follow) and the race are NOT wired (rules-k-chaser-narrowing § Model check: strict at the contact margin).
 *
 * ── THE ARM ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 * The kill-lock census's own (`seedlingPlaythroughOverlay.KILL_LOCK_BODY_CLASSES` + `KILL_ARM_CONDITION`, the arms the
 * producer reads off kill-lock bodies). A class no kill-lock room holds takes the same arms when `ENEMY_CLASSES[tag].kill`
 * records that `Enemy.hit` kills it (`Enemy.as:147-158`). A class that removes itself (`self`) costs nothing; a class with
 * no derivable arm (or a counted corpse) is REFUSED by name. Not widened, not narrowed (T's per-trap arms are T's).
 *
 * ── COMPOSITION WITH T ────────────────────────────────────────────────────────────────────────────────────────────────
 * K is MEASURED on the grid before T (a T-gated cell would read as solid to a body's flood, `FCG.bodyRegion`) and STAMPED
 * AFTER T, onto T's grid, with T's own `stampOccupancy`: a cell already holding the arm or one of its disjuncts is left as it
 * is; a cell holding T's `Or(Dark Suit, …)` gains the arm beside it (the AND of the two). T is computed on the grid it was
 * computed on before K existed, so its arms and seal test do not move.
 *
 * Inputs: the class constants (`ENEMY_CLASSES`, `CHASERS`, `PROFILE`, the census's arm table), the ports, the patched
 * map's bodies, the grid. No level literal, no class-name list.
 */
import { CHASERS, chaserStep } from '../../frontend/modules/seedlingDemo/chasers.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { newDrill, stepDrill, stepDrillGraphic } from '../../frontend/modules/seedlingDemo/drill.js';
import * as PP from '../../frontend/modules/seedlingDemo/playerPhysicsV1.js';
import { KILL_LOCK_BODY_CLASSES, KILL_ARM_CONDITION } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { PLAYER_GUARD_PROFILE, guardClassOf, bodyRegion } from './seedlingFireChaserGuard.js';
import { stampOccupancy } from './seedlingTrapTongueGuard.js';
import { T, BLOCKING, TERRAIN_TILE, label, xy } from './seedlingHolderParking.js';

const NO_ROCK = Object.freeze({ tiles: [] });
const DIRS4 = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

const neighbours = (i, width, height) => {
    const [x, y] = xy(i, width);
    const out = [];
    for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) out.push(ny * width + nx);
    }
    return out;
};

/** The nearest a point of cell `i` (a T px square) comes to the pixel point `[cx, cy]`. */
export function cellPointDistance(i, [cx, cy], width) {
    const [x, y] = xy(i, width);
    const px = Math.max(x * T, Math.min(cx, (x + 1) * T));
    const py = Math.max(y * T, Math.min(cy, (y + 1) * T));
    return Math.hypot(px - cx, py - cy);
}

/** Does the class's body hit on contact? `CHASERS[tag].contactHits` (the Flyer's `false`); a class with no row keeps `Enemy.hitPlayer`. */
export const contactHitsOf = (tag) => CHASERS[tag]?.contactHits !== false;

// ── term (b): the speeds, measured off the ports ──────────────────────────────────────────────────────────────────────

/** The measurement window (ticks): long enough that the warm-up and every saw-tooth period average out. */
export const MEASURE = Object.freeze({ ticks: 600, warm: 60 });
/** The tile types the player SWIMS on (`Player.as:544-548`: `moveSpeeds[t]` with `WATER_FRICTION`). */
export const SWIM_TILES = Object.freeze([TERRAIN_TILE.water, TERRAIN_TILE.lava]);

/** The player's input terms on a tile type: walk (`dMS`, default friction) or swim (`moveSpeeds[t]`, water friction). */
export function playerTerrain(tileType) {
    return SWIM_TILES.includes(tileType)
        ? { moveSpeed: PP.MOVE_SPEEDS[tileType], friction: PP.WATER_FRICTION }
        : { moveSpeed: PP.WALK_SPEED, friction: PP.DEFAULT_FRICTION };
}

/** The player's steady px/tick along one axis, holding `right` on an open plane (`playerPhysicsV1.step`). */
export function measurePlayer({ moveSpeed, friction }, { ticks = MEASURE.ticks, warm = MEASURE.warm, step = PP.step } = {}) {
    let s = { x: 5e4, y: 5e4, vx: 0, vy: 0 };
    let x0 = 0;
    for (let t = 0; t < ticks; t += 1) {
        if (t === warm) x0 = s.x;
        s = { ...s, ...step(s, new Set(['right']), { world: { width: 1e5, height: 1e5 }, moveSpeed, friction }) };
    }
    return (s.x - x0) / (ticks - warm);
}

/** A chaser's steady px/tick along one axis, homing at a far player (`chasers.chaserStep`, its leash off). */
export function measureChaser(tag, moveSpeed, { ticks = MEASURE.ticks, warm = MEASURE.warm, stepFn = chaserStep } = {}) {
    let e = { x: 0, y: 0, v: { x: 0, y: 0 }, moveSpeed, runRange: 1e9 };
    let x0 = 0;
    for (let t = 0; t < ticks; t += 1) {
        if (t === warm) x0 = e.x;
        const r = stepFn(tag, e, { x: 1e7, y: 0 }, { onScreen: true });
        e = { ...e, x: r.x, y: r.y, v: r.v };
    }
    return (e.x - x0) / (ticks - warm);
}

/** A teleport-hopper's steady px/tick along one axis (`drill.stepDrill` + `stepDrillGraphic`, the player just ahead). */
export function measureHopper({ ticks = MEASURE.ticks, warm = MEASURE.warm } = {}) {
    let d = newDrill({ id: 0, x: 0, y: 0 });
    let x0 = 0;
    for (let t = 0; t < ticks; t += 1) {
        if (t === warm) x0 = d.x;
        const r = stepDrill(d, {
            frozen: false, onScreen: () => true, playerBox: null, player: { x: d.x + 30, y: d.y },
            lineBlocked: () => false, collides: () => false, hitPlayer: (x) => x,
        });
        d = stepDrillGraphic(r.d);
    }
    return (d.x - x0) / (ticks - warm);
}

const speedMemo = new Map();
const memo = (k, f) => {
    if (!speedMemo.has(k)) speedMemo.set(k, f());
    return speedMemo.get(k);
};

/** The player's pursuit-escape speed on a tile type (measured). */
export function playerSpeedOn(tileType) {
    const swim = SWIM_TILES.includes(tileType);
    return memo(`player:${swim ? tileType : 'walk'}`, () => measurePlayer(playerTerrain(tileType)));
}

/** A body's pursuit speed on a tile type (measured off its port; the census speed for a class with no port). */
export function bodySpeedOn(tag, tileType, { classes = ENEMY_CLASSES, chasers = CHASERS } = {}) {
    const row = classes[tag];
    const byT = chasers[tag]?.speedByTerrain;
    const swim = Boolean(byT && byT.swimTiles.includes(tileType));
    return memo(`${tag}:${swim ? 'swim' : 'walk'}`, () => {
        if (row?.aggro?.kind === 'teleport-hop') return measureHopper();
        if (chasers[tag]) return measureChaser(tag, byT ? (swim ? byT.swim : byT.walk) : row?.speed);
        return row?.speed ?? 0;
    });
}

/**
 * Term (b): the tile types of the body's flood on which it OUT-RUNS the player (strictly: equality cannot close on a
 * fleeing player, `Bob.as:61-66`). Empty → the body is dropped from K. `speedOf` / `playerOf` are injectable (unit rows).
 */
export function pursuitFaster(tag, terrainTypes, { speedOf = bodySpeedOn, playerOf = playerSpeedOn } = {}) {
    return terrainTypes.filter((t) => speedOf(tag, t) > playerOf(t));
}

// ── the arm ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A body's kill arm: `{arm, src}`, `{free: true}` (it removes itself), or `{refuse}` (none derivable). */
export function killArmOf(tag, { bodyClasses = KILL_LOCK_BODY_CLASSES, armCondition = KILL_ARM_CONDITION, enemyClasses = ENEMY_CLASSES } = {}) {
    const row = bodyClasses[tag];
    if (!row) {
        if (enemyClasses[tag]?.kill?.hits > 0) return { arm: armCondition, src: `ENEMY_CLASSES.${tag}.kill (Enemy.as:147-158)` };
        return { refuse: `${tag}: neither the kill-lock census (KILL_LOCK_BODY_CLASSES) nor ENEMY_CLASSES.kill derives a kill arm` };
    }
    if (row.self) return { free: true };
    if (row.corpse) return { refuse: `${tag}: its corpse stays counted (${row.cite}); a kill arm alone does not clear it` };
    return { arm: armCondition, src: `KILL_LOCK_BODY_CLASSES.${tag} (${row.cite}) + KILL_ARM_CONDITION` };
}

// ── K's cut, with (b) ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One body's verdict on a grid: K's terms, (b), its leash zone and its cut. `centre` is its spawn centre
 * (`ENEMY_CLASSES[tag].ctor`, read by the caller); `exempt` = cell indices never charged (landings, doors, trap tiles).
 * `pursuit` = term (b)'s `pursuitFaster` (injectable for the unit rows' mutations).
 */
export function chaserGuardCells(body, {
    grid, tileTypes, centre, exempt = new Set(), profile = PLAYER_GUARD_PROFILE, classOf = guardClassOf, contactOf = contactHitsOf,
    pursuit = pursuitFaster,
}) {
    const cls = classOf(body.tag);
    const { width, height, cells } = grid;
    const candidate = cls.homing && cls.runRange > 0 && contactOf(body.tag);
    const { region } = candidate ? bodyRegion(body, cls, NO_ROCK, grid, tileTypes) : { region: new Set() };
    const terrainTypes = [...new Set([...region].map((i) => tileTypes.get(i) ?? null))];
    const nominal = region.size ? Math.max(...terrainTypes.map((t) => cls.speedOn(t))) : 0;
    const faster = candidate && region.size ? pursuit(body.tag, terrainTypes) : [];
    const terms = {
        nominal: nominal > profile.walkSpeed, c: cls.homing && cls.runRange > 0, contact: contactOf(body.tag), b: faster.length > 0,
    };
    const guards = terms.nominal && terms.c && terms.contact && terms.b;
    const zone = new Set();
    const cut = new Set();
    if (terms.nominal && terms.c && terms.contact) {
        const player = (i) => !BLOCKING.has(cells[i].kind);
        const followed = (i) => region.has(i) || neighbours(i, width, height).some((n) => region.has(n));
        for (let i = 0; i < cells.length; i += 1) {
            if (player(i) && cellPointDistance(i, centre, width) <= cls.runRange && followed(i)) zone.add(i);
        }
        for (const i of zone) {
            if (exempt.has(i)) continue;
            if (neighbours(i, width, height).some((n) => !zone.has(n) && player(n) && followed(n))) cut.add(i);
        }
    }
    return {
        body: label(body), tag: body.tag, centre, nominal, walkSpeed: profile.walkSpeed, runRange: cls.runRange,
        aggroKind: cls.aggroKind, terrainTypes, faster, terms, guards, zone, cut,
        // K's cut (unfiltered) and (b)'s: (b) only removes.
        kCut: cut, bCut: guards ? cut : new Set(),
    };
}

/**
 * K with (b) over one level's grid (T already stamped on it). `room` = `{grid, tileTypes, bodies, centreOf(body), exempt}`.
 * Returns the stamped grid, the guarding bodies (`guards`), the K candidates (b) dropped (`dropped`) and refusals.
 */
export function stampChaserGuards(room, { armOf = killArmOf, ...opts } = {}) {
    // `grid` is the grid K MEASURES (the bodies' floods, the zones, the cuts): the one before T's gates, which a body's
    // flood would read as solid (`bodyRegion`: a conditioned non-terrain cell). `onto` (default `grid`) is the grid the arm is
    // STAMPED on: T's, so a T cell gains the arm beside T's gate.
    const { grid, onto = grid, tileTypes, bodies, centreOf, exempt = new Set() } = room;
    const { width } = grid;
    const cellsOf = (set) => [...set].sort((a, b) => a - b).map((i) => xy(i, width));
    const guards = [];
    const dropped = [];
    const refused = [];
    const armCells = new Map();
    for (const body of bodies) {
        const v = chaserGuardCells(body, { grid, tileTypes, centre: centreOf(body), exempt, ...opts });
        if (v.kCut.size && !v.guards) {
            dropped.push({ body: v.body, terrainTypes: v.terrainTypes, kCut: v.kCut.size, why: 'term (b): outrun on no tile of its flood' });
        }
        if (!v.guards || v.cut.size === 0) continue;
        const arm = armOf(body.tag);
        if (arm.refuse) { refused.push(`${v.body}: ${arm.refuse}`); continue; }
        if (arm.free) continue;
        const k = JSON.stringify(arm.arm);
        if (!armCells.has(k)) armCells.set(k, { arm: arm.arm, cells: new Set() });
        for (const i of v.cut) armCells.get(k).cells.add(i);
        guards.push({
            body: v.body, faster: v.faster, runRange: v.runRange, zone: v.zone.size, cut: cellsOf(v.cut), arm: arm.arm, armSrc: arm.src,
        });
    }
    let out = onto;
    for (const { arm, cells } of armCells.values()) out = stampOccupancy(out, cells, arm);
    const charged = new Set([...armCells.values()].flatMap(({ cells }) => [...cells]));
    return { grid: out, guards, dropped, refused, charged: cellsOf(charged) };
}
