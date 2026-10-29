// Headless-safe: no top-level await, no literal node: imports.
/**
 * ⛓⛓ WEAPON FOOTPRINTS (session tile-primitives-weapon-footprints, ⚖ 2026-10-28 "Tile centre", "All 4, one slice").
 *
 * The maze cells a Seedling weapon hits from a STANCE + FACING, as data the maze engine reads (`action_lib.<id>.footprint`).
 * DERIVED, never written by hand: each footprint is the set of 16 px tiles that the bot's game-measured hit test collects
 * when the player stands at the CENTRE of a tile (the rules producer's own stance convention, `poleThrustStances`: "where a
 * player standing on the tile is, as the game lands one"). The centre is a stance the game allows, so a footprint is never
 * looser than the game; a player off-centre can reach more (the spear the row beside, the Ghost Sword 12 cells) — stricter.
 *
 *   sword       `Player.slash` (`Player.as:892-929`): `getSlashRect` (:931-952; `sprSlash` 16×32, :41), then the reach gate
 *               `distanceRectPoint ≤ width·scaleX` (:915) — `combatVerbs.swingHits`. Five cells: the faced one, its two
 *               diagonals and the two SIDE cells (the 32 px swing spans the row on either side). `sprSlashDark` is the same
 *               16×32, so the Dark Sword's footprint is this one.
 *   ghostsword  the same with `sprGhostSword` (24×7, :45; `h = width·2` = 48, :934) and a 24 px reach — from the centre it
 *               collects exactly the sword's five (the ×2 width adds no cell there).
 *   spear       `Player.spear` (:954-993): the 32×5 thrust from `spearX/Y`, no reach gate, no line test —
 *               `presses.spearHitRect` + `pressRectTouches`. Two cells straight ahead (over any cell between).
 *   fire        `Player.fire` (:1014-1040): a 32×32 rect centred on the player, then `distanceRects ≤ 16` with the player's
 *               own `originY` (:1028, transcribed) — `fireVerb.fireHits`. All eight neighbours, whatever the facing.
 *
 * ⛔ THE SLASH'S LINE TEST (`!collideLine("Solid", …)`, :917) is WAIVED for the Ghost Sword and for a target of type Solid,
 * Rope or a Flyer — and every maze target is one: BreakableRock is "Solid" (`BreakableRock.as:41`), RopeStart "Rope"
 * (`RopeStart.as:25`), PushableBlock* "Solid". So no footprint carries a line test. `FOOTPRINT_TARGETS` names each target
 * class with its game type; a class the swing would line-test makes `swingHits` refuse (no `blockedLine` oracle), so a new
 * non-exempt target (an enemy, grass) is a throw here, by name — that is where a per-cell wall test would plug in.
 *
 * ⛔ THE WAND (`Player.wand`, :994-1003) fires a PROJECTILE along the facing until it meets a Solid — a RAY, not a footprint.
 * Not modelled: `WEAPON_FOOTPRINT_KINDS.wand` names it, and asking for its footprint throws.
 */
import { swingHits } from '../seedlingDemo/combatVerbs.js';
import { spearHitRect, pressRectTouches } from '../seedlingDemo/presses.js';
import { fireHits } from '../seedlingDemo/fireVerb.js';
import { PROFILE } from '../seedlingDemo/seedlingProfile.js';

const TILE = 16;

/** The maze facings and the game's `direction` for each (`PROFILE.right/up/left/down`). */
export const FOOTPRINT_FACINGS = Object.freeze({ N: PROFILE.up, E: PROFILE.right, S: PROFILE.down, W: PROFILE.left });

/**
 * Each maze target class, as the game builds its body: the `type` the slash's line test reads and the entity's origin
 * (the fire test's distance subtracts it — and the player's `originY`). Every one is 16×16 on its tile.
 */
export const FOOTPRINT_TARGETS = Object.freeze({
    rock: Object.freeze({ type: 'Solid', originX: 8, originY: 8, cite: 'BreakableRock.as:24,41-42' }),
    rope: Object.freeze({ type: 'Rope', originX: 8, originY: 8, cite: 'RopeStart.as:22-26 (each run tile)' }),
    block: Object.freeze({ type: 'Solid', originX: 0, originY: 0, cite: 'PushableBlockFire.as:27-30' }),
});

/** How each action id (`hasSword` → `sword`) hits: a footprint the derivation below computes, or a named gap. */
export const WEAPON_FOOTPRINT_KINDS = Object.freeze({
    sword: 'slash',
    ghostsword: 'slash',
    spear: 'thrust',
    fire: 'burst',
    wand: 'ray (not modelled — a projectile along the facing until a Solid; a later slice)',
});

/** Does the game's hit test of `actionId`, from the centre of tile (0,0) facing `dir`, collect a `cls` target on tile (dx,dy)? */
function hits(actionId, dir, dx, dy, cls) {
    const t = FOOTPRINT_TARGETS[cls];
    const px = TILE / 2;
    const py = TILE / 2;
    const box = { x: dx * TILE, y: dy * TILE, w: TILE, h: TILE, right: dx * TILE + TILE, bottom: dy * TILE + TILE };
    switch (WEAPON_FOOTPRINT_KINDS[actionId]) {
        case 'slash':
            return swingHits({ x: px, y: py }, dir, [{
                id: `${cls}@${dx},${dy}`, box, type: t.type, cx: box.x + t.originX, cy: box.y + t.originY,
            }], { sword: actionId }).length > 0;
        case 'thrust':
            return pressRectTouches(spearHitRect(px, py, dir), box);
        case 'burst':
            return fireHits({ x: px, y: py }, [{
                id: `${cls}@${dx},${dy}`, type: t.type, x: box.x + t.originX, y: box.y + t.originY,
                originX: t.originX, originY: t.originY, w: TILE, h: TILE,
            }]).length > 0;
        default:
            throw new Error(`weapon footprint: action "${actionId}" is ${WEAPON_FOOTPRINT_KINDS[actionId] === undefined
                ? 'no Seedling weapon' : `a ${WEAPON_FOOTPRINT_KINDS[actionId]}`} — it has no footprint`);
    }
}

/** The search box: no Seedling weapon reaches past 3 tiles (the spear's 32 px from the centre ends 8 px into the 3rd). */
const SPAN = 3;

/**
 * The footprint of `actionId` against a `cls` target: `{N, E, S, W}` → `[[dx, dy]…]`, offsets from the stance tile,
 * row-major, the stance tile itself excluded (a target never stands where the player does).
 */
export function deriveWeaponFootprint(actionId, cls) {
    if (!FOOTPRINT_TARGETS[cls]) {
        throw new Error(`weapon footprint: target class "${cls}" is not one of ${Object.keys(FOOTPRINT_TARGETS).join(', ')}`);
    }
    const out = {};
    for (const [facing, dir] of Object.entries(FOOTPRINT_FACINGS)) {
        const cells = [];
        for (let dy = -SPAN; dy <= SPAN; dy++) {
            for (let dx = -SPAN; dx <= SPAN; dx++) {
                if ((dx !== 0 || dy !== 0) && hits(actionId, dir, dx, dy, cls)) cells.push([dx, dy]);
            }
        }
        out[facing] = cells;
    }
    return out;
}

/**
 * The ONE footprint of `actionId` the maze carries: the same for every target class it can strike (`classes`), or a
 * throw naming the two that differ — a world reads one footprint per action, never one per target.
 */
export function weaponFootprint(actionId, classes = Object.keys(FOOTPRINT_TARGETS)) {
    let first = null;
    for (const cls of classes) {
        const fp = deriveWeaponFootprint(actionId, cls);
        if (first === null) first = { cls, fp, key: JSON.stringify(fp) };
        else if (JSON.stringify(fp) !== first.key) {
            throw new Error(`weapon footprint: "${actionId}" hits a ${first.cls} and a ${cls} on different cells `
                + `(${first.key} vs ${JSON.stringify(fp)}) — one footprint per action`);
        }
    }
    return first.fp;
}
