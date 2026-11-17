/**
 * ⛓⛓ rules-chaser-arrival-killarm — TWO DERIVED CHARGES ON THE GRID: A FAST CHASER'S LEASH CUT COSTS ITS KILL ARM, AND A
 * LAVA TRAP'S TONGUE COSTS THE DARK SUIT. ⚖ Robert 2026-11-16: "General rules slice (Recommended)". Seedling's AP logic
 * never expects the player to take a hit, and two report slices found granted routes the game refuses (L72 → L73: hit at
 * t35; L77 → L76: hit at t15–37 by the runners, then killed by the lavatrap's tongue at t63 with the Sword alone).
 *
 * WHERE THE CHARGE LANDS (designer amendment 1): in the derivation INPUT, the analyzer grid, never in the composition (the
 * derived-rule table overwrites a composed-only fix). Both rules are the KILL-LOCK SHAPE: a cell becomes a `gated` cell
 * whose occupancy condition is the charge ("a gated cell as floor plus that gate", the maze's room-clear-lock rule,
 * `maze.md`). ⛔ Not an `enter` gate on an open cell: `regionAtlasAnalyzer.findComponents` floods every `open` cell into
 * one component whatever its `enter` gates say, so such a gate inside a room is never priced. A gated cell is: the
 * analyzer splits the room at it and prices the crossing, the maze lays it as floor plus that gate, and the derived-rule
 * table reads the maze. Where a path avoids the cells, nothing moves: "every path" is the analyzer's own flood over the
 * gated grid, never a per-route literal.
 *
 * ── RULE K: a chaser's leash cut costs its kill arm ─────────────────────────────────────────────────────────────────
 * A body GUARDS when (the Fire guard's terms, `seedlingFireChaserGuard.js`, reused, not forked):
 *   (b) it is strictly faster than the player (`Player.as:73` `dMS`) on the terrain of its own flood (`guardClassOf`
 *       `.speedOn`, the max over the region's tile types; equality cannot close on a fleeing player, `Bob.as:61-66`);
 *   (c) it is a homer (`HOMING_AGGRO`) with a leash (`runRange`, `Bob.as:58` `d <= runRange`);
 *   and its body HITS ON CONTACT: `chasers.CHASERS[tag].contactHits !== false`. ⛔ The Flyer overrides `hitPlayer` EMPTY
 *       (`Flyer.as:83-85`): it damages only by its drop onto a player that stands still under it, so it chases nobody
 *       into a hit (L105's flyers: GAME YES item-less both ways, rules-arrival-chase-witness).
 * Its LEASH ZONE: every cell the player can stand in (not `HP.BLOCKING`) whose nearest point is within `runRange` of the
 * body's spawn centre (the body idles at its spawn until the player comes in range, `Bob.as:58`) AND within contact of
 * the body's own flood (`FCG.bodyRegion`, its lethal tiles excluded: the cell is in that region or 4-adjacent to it; a
 * body walled off from a cell never reaches it, `Mobile.as:17` solids).
 * Its CUT: the zone's cells that border (4-adjacent) a player cell OUTSIDE the zone that the body can still follow the
 * player to (in contact of its flood). The cut is where the guard splits the room: crossing it either way means the
 * chase has started and the player is leaving (or entering) the body's leash with a faster body on it — the body
 * follows, and nothing but a kill stops it. A walk that stays INSIDE the leash pays nothing: the route then lies within
 * `2 * runRange` of the body and ends before the chase closes. That is a measured bound, not a proof, and it is the one
 * the game draws: L80's arrival → r6c4 with the Dark Suit alone stays inside the runners' leashes and is GAME YES (t75,
 * 0 hits), while L72 → L73, L77 → L76 and L80's chest leave or enter a leash and are GAME NO without an arm
 * (rules-arrival-chase-witness). A cell on the cut that is an ARRIVAL LANDING or a DOOR is never charged (landing
 * there is not crossing; stepping onto the door leaves the room: L77 → L78 out at t6, L72 → L71 out at t7, 0 hits).
 *
 * The ARM is the kill-lock census's own (`seedlingPlaythroughOverlay.KILL_LOCK_BODY_CLASSES` + `KILL_ARM_CONDITION`,
 * the arms the producer already reads off kill-lock bodies): `Or(hasSword, hasSpear, hasWand, hasDarkShield)`. A class
 * no kill-lock room holds takes the same arms when `ENEMY_CLASSES[tag].kill` records that `Enemy.hit` kills it
 * (`Enemy.as:147-158`). Never Fire (`Player.as:178` `fireDamage = 0`; `Enemy.as:151`), never the Dark Suit (its
 * retaliation needs a hit first, `Player.as:1384-1387`): both are the census's `KILL_ARM_EXCLUDED`. A class with no
 * derivable arm is REFUSED by name; a class that removes itself (`self`) costs nothing.
 *
 * ── RULE T: a lava trap whose tongue covers every path costs the Dark Suit ───────────────────────────────────────────
 * The trap classes whose tongue KILLS without the suit, from the AS3: only `LavaTrap` (`LavaTrap.as:56-73`: the attached
 * player is reeled in and `die()`d unless `Player.hasDarkSuit`). `SandTrap`, `DarkTrap` and `IceTrap` chomp on contact
 * (an ordinary hit: no `die()` call and no `hasDarkSuit` test anywhere in their source), so they are not T's. The class
 * and its reach are `OV.LAVATRAP_PULL` (`tag`, `chompRange` 32, `condition` Dark Suit), the constants the pulls read.
 * The DISC is the pulls' own (`OV.lavaTrapPulls`: the trap's tile and every tile whose centre is within `chompRange` of
 * the trap's, the game's int-truncated `FP.distance`), KEPT only where the launch's line is clear (`LavaTrap.as:86`
 * `!collideLine("Solid", …)`): the centre-to-centre segment crosses no wall cell. (The pulls leave the line test out
 * because that only ADDS pulls, the permissive side; a charge without it would be the strict side, so T applies it.)
 * Every disc cell costs the Dark Suit to stand in, but a landing, a door and the trap's own tile (where the pull lands). It composes with the maze's pulls on the same
 * cells (`maze.md` § Pulls): a move into the disc already needs the pull's gate (the suit) to be reeled in; now a move
 * without the suit is refused instead of walking through the tongue. The solver's `proximity-hazard` is untouched.
 *
 * Inputs: the class constants (`ENEMY_CLASSES`, `CHASERS`, `PROFILE`, `LAVATRAP_PULL`, the census's arm table), the
 * patched map's bodies and traps, the grid. No level literal, no class-name list.
 */
import { CHASERS } from '../../frontend/modules/seedlingDemo/chasers.js';
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import {
    KILL_LOCK_BODY_CLASSES, KILL_ARM_CONDITION, LAVATRAP_PULL,
} from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { PLAYER_GUARD_PROFILE, guardClassOf, bodyRegion } from './seedlingFireChaserGuard.js';
import { T, BLOCKING, label, xy } from './seedlingHolderParking.js';

export const DIRS = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
const NO_ROCK = Object.freeze({ tiles: [] });

const neighbours = (i, width, height) => {
    const [x, y] = xy(i, width);
    const out = [];
    for (const [dx, dy] of Object.values(DIRS)) {
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

/**
 * A body's kill arm: `{arm}` (a condition), `{free: true}` (it removes itself), or `{refuse}` (none derivable).
 */
export function killArmOf(tag, { bodyClasses = KILL_LOCK_BODY_CLASSES, armCondition = KILL_ARM_CONDITION, enemyClasses = ENEMY_CLASSES } = {}) {
    const row = bodyClasses[tag];
    if (!row) {
        // A class no kill-lock room holds: the census's arms still apply where the class keeps `Enemy.hit` (`Enemy.as:147-158`:
        // `canHit`, `hitsMax`), which `ENEMY_CLASSES[tag].kill` records (`null` = it cannot be killed).
        if (enemyClasses[tag]?.kill?.hits > 0) return { arm: armCondition };
        return { refuse: `${tag}: neither the kill-lock census (KILL_LOCK_BODY_CLASSES) nor ENEMY_CLASSES.kill derives a kill arm` };
    }
    if (row.self) return { free: true };
    if (row.corpse) return { refuse: `${tag}: its corpse stays counted (${row.cite}); a kill arm alone does not clear it` };
    return { arm: armCondition };
}

/**
 * One body's K verdict on a grid: the terms, its leash zone and its cut. `centre` is its spawn centre
 * (`ENEMY_CLASSES[tag].ctor`, read by the caller); `exempt` = cell indices never charged (landings, doors).
 */
export function chaserGuardCells(body, { grid, tileTypes, centre, exempt = new Set(), profile = PLAYER_GUARD_PROFILE, classOf = guardClassOf, contactOf = contactHitsOf }) {
    const cls = classOf(body.tag);
    const { width, height, cells } = grid;
    // A body that neither homes nor hits on contact guards nothing: its flood is never asked (a static class may have no
    // contact rect at all).
    const homes = cls.homing && cls.runRange > 0 && contactOf(body.tag);
    const { region } = homes ? bodyRegion(body, cls, NO_ROCK, grid, tileTypes) : { region: new Set() };
    const terrainTypes = [...new Set([...region].map((i) => tileTypes.get(i) ?? null))];
    const speed = region.size ? Math.max(...terrainTypes.map((t) => cls.speedOn(t))) : 0;
    const terms = { b: speed > profile.walkSpeed, c: cls.homing && cls.runRange > 0, contact: contactOf(body.tag) };
    const guards = terms.b && terms.c && terms.contact;
    const zone = new Set();
    const cut = new Set();
    if (guards) {
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
        body: label(body), tag: body.tag, centre, speed, walkSpeed: profile.walkSpeed, runRange: cls.runRange,
        aggroKind: cls.aggroKind, homing: cls.homing, contact: terms.contact, regionCells: region.size, terms, guards, zone, cut,
    };
}

/** Is the centre-to-centre segment between cells `a` and `b` clear of every cell `solid(i)` names (sampled per px)? */
export function lineClear(a, b, width, solid) {
    const [ax, ay] = xy(a, width).map((v) => v * T + T / 2);
    const [bx, by] = xy(b, width).map((v) => v * T + T / 2);
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let s = 1; s < steps; s += 1) {
        const px = ax + ((bx - ax) * s) / steps;
        const py = ay + ((by - ay) * s) / steps;
        const i = Math.floor(py / T) * width + Math.floor(px / T);
        if (i !== a && i !== b && solid(i)) return false;
    }
    return true;
}

/**
 * One trap's T disc: its pull disc (`pull` = an `OV.lavaTrapPulls` row: `tile`, `from`) cut to the player cells with a
 * clear line to the trap, landings and doors (`exempt`) left out. `solid(i)` = a cell the launch's
 * `collideLine("Solid")` stops at (the grid's walls).
 */
export function trapTongueCells(pull, { grid, exempt = new Set(), solid = (i) => grid.cells[i]?.kind === 'wall' }) {
    const { width, cells } = grid;
    const trap = pull.tile[1] * width + pull.tile[0];
    const disc = new Set();
    // The trap's own tile is left as it is: the player stands on it only once reeled in (every way to it walks a disc
    // cell first, its neighbours being 16 px from it), and it is where the pulls land (`applyLavaTrapPulls`, the maze's
    // `pulls`), which must stay a sub-region.
    for (const [x, y] of pull.from) {
        const i = y * width + x;
        if (i === trap || BLOCKING.has(cells[i]?.kind ?? 'wall') || exempt.has(i)) continue;
        if (lineClear(i, trap, width, solid)) disc.add(i);
    }
    return disc;
}

const keyOf = (c) => JSON.stringify(c);

/**
 * Charge `condition` to OCCUPY every cell of `cells` (indices): an `open` cell becomes `gated` with it, a gated or
 * directional cell adds it (ANDed with what it holds; never twice). Returns a new grid.
 */
export function stampOccupancy(grid, cells, condition) {
    if (cells.size === 0) return grid;
    const out = grid.cells.slice();
    for (const i of cells) {
        const cell = out[i];
        if (BLOCKING.has(cell.kind)) continue;
        const have = cell.conditions ?? [];
        if (have.some((c) => keyOf(c) === keyOf(condition))) continue;
        out[i] = { ...cell, kind: cell.kind === 'open' ? 'gated' : cell.kind, conditions: [...have, condition] };
    }
    return { ...grid, cells: out };
}

/**
 * Both rules over one level's grid. `room` = `{grid, tileTypes, bodies, centreOf(body), exempt, pulls}`. Returns the
 * stamped grid and the verdict rows (`guards`: K per guarding body; `traps`: T per trap), cells as `[x, y]` lists.
 */
export function stampArrivalGuards(room, { profile = PLAYER_GUARD_PROFILE, classOf = guardClassOf, contactOf = contactHitsOf, armOf = killArmOf } = {}) {
    const { grid, tileTypes, bodies, centreOf, exempt = new Set(), pulls = [] } = room;
    const { width } = grid;
    const cellsOf = (set) => [...set].sort((a, b) => a - b).map((i) => xy(i, width));
    const guards = [];
    const refused = [];
    const armCells = new Map();
    for (const body of bodies) {
        const v = chaserGuardCells(body, { grid, tileTypes, centre: centreOf(body), exempt, profile, classOf, contactOf });
        if (!v.guards || v.cut.size === 0) continue;
        const arm = armOf(body.tag);
        if (arm.refuse) { refused.push(`${v.body}: ${arm.refuse}`); continue; }
        if (arm.free) continue;
        const k = keyOf(arm.arm);
        if (!armCells.has(k)) armCells.set(k, { arm: arm.arm, cells: new Set() });
        for (const i of v.cut) armCells.get(k).cells.add(i);
        guards.push({ body: v.body, speed: v.speed, runRange: v.runRange, zone: v.zone.size, cut: cellsOf(v.cut) });
    }
    let out = grid;
    for (const { arm, cells } of armCells.values()) out = stampOccupancy(out, cells, arm);
    const traps = [];
    for (const pull of pulls) {
        const disc = trapTongueCells(pull, { grid, exempt });
        if (disc.size === 0) continue;
        out = stampOccupancy(out, disc, LAVATRAP_PULL.condition);
        traps.push({ trap: pull.tile, cells: cellsOf(disc) });
    }
    return { grid: out, guards, traps, refused };
}
