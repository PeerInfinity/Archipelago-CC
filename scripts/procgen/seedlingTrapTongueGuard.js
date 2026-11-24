/**
 * ⛓⛓ rules-lavatrap-neck — RULE T: A TRAP WHOSE TONGUE KILLS COSTS `Or(Dark Suit, <a weapon that kills it from outside
 * its reach>)` TO STAND IN ITS REACH. ⚖ Robert 2026-11-17 (direct): "T wired + K measured, 2 parallel" — this is the wired
 * T. Seedling's AP logic must match the game and never expects the player to take a hit (⚖ Robert). Before this rule the
 * playthrough rules let a player with no Dark Suit cross L77 (`lavatrap@96,192`) and L78 (`lavatrap@96,80`), and the game
 * kills that player (`LavaTrap.as:56-73`; witnessed GAME NO: rules-chaser-arrival-killarm t32, rules-l77-trap-chase-witness).
 * The pure halves of the disc and the stamp are rules-chaser-arrival-killarm's T (`de4b4d08db`); K is out of scope.
 *
 * ── WHICH TRAPS: the classes whose tongue KILLS without the suit (`TONGUE_KILL_CLASSES`) ───────────────────────────────
 * Read off the AS3 (`vendor/seedling/src`): the only `die()` a body calls on the PLAYER outside `Player.as` is
 * `LavaTrap.as:72` `attached.die()`, behind `if (Player.hasDarkSuit)` (`:64`). The other trap classes chomp: `SandTrap`
 * (and `DarkTrap`, which extends it) hit through `Enemy.hitPlayer` (an ordinary hit, `Player.hit`), and `IceTrap` freezes;
 * none calls `die()` and none reads `hasDarkSuit`. The table carries that reading with its cites, and the unit rows re-derive
 * it from the AS3 source wherever the submodule is checked out.
 *
 * ── THE REACH: the disc (grid cells) ───────────────────────────────────────────────────────────────────────────────────
 * The pulls' own disc (`OV.lavaTrapPulls`: every tile whose centre is within `chompRange` of the trap's, the game's
 * int-truncated `FP.distance`, and whose line to the trap is clear, `LavaTrap.as:88` `!collideLine("Solid", …)`: the
 * centre-to-centre segment crosses no wall cell). ⛓⛓ rules-lavatrap-pull-line: the line test is the DISC's own
 * (`OV.pullLineClear`, applied once by `lavaTrapPulls` with the producer's wall cells), so T reads that disc and never
 * re-cuts it: the tiles the tongue kills on are the tiles it reels from. The trap's own tile, a landing and a door are
 * never charged (the pull lands on the trap's tile, which must stay a sub-region; a landing is not a crossing; a door
 * leaves the room).
 *
 * ── THE CHARGE: every disc cell is a GATED cell (the kill-lock shape) ──────────────────────────────────────────────────
 * Its occupancy condition is `Or(hasDarkSuit, <arms>)`. The analyzer floods `open` cells only, so a route that can AVOID the
 * disc keeps its old price, and one that cannot pays the gate: "cannot avoid" is the analyzer's own flood over the gated
 * grid, never a per-route literal. Every live disc is gated (not only the ones that seal a route): a disc a route avoids
 * costs nothing, which the analyzer measures, so no seal test is needed to keep the rule exact.
 *
 * ── THE ARMS: a weapon that kills the trap from OUTSIDE its reach (`trapKillArms`) ─────────────────────────────────────
 * An arm qualifies at a trap when, holding that arm alone (no Dark Suit, nothing else), from EVERY landing whose walk can come
 * near the trap, the player reaches a CARDINAL KILL SPOT of it without ever standing in a LIVE trap's reach:
 *   - a kill spot is a standable point (the player's box free of `Solid`s) on one of the trap's 4 axes, outside its reach
 *     (`int(distance) > chompRange`), facing the trap, from which the arm's own hit test lands on the trap's hitbox:
 *       · Spear: `presses.spearHitRect` (`Player.as:960-990`; 32 x 5 from the shifted origin, NO `Solid` test) → for a
 *         10 x 10 hitbox the window is [33, 37) px: the witness's own window;
 *       · Sword (and the Ghost Sword): `combatVerbs.swingHits` (`Player.as:908-926`: the slash rect AND a point-to-box reach of
 *         `slashingSprite.width * scaleX`, 16 / 24, AND a clear line unless ghost) → ≤ 29 px from the centre, inside 33:
 *         no spot exists, so it never qualifies, from the derivation itself;
 *       · Wand: the model's own shot (`wandShot.stepWandShot`, spawn `wandVerb.wandShotSpawn`), flown against the room's
 *         `Solid`s and the trap's hitbox: the shot stops at a wall (`Mobile.as:17`), so a spot qualifies only on a clear
 *         cardinal line within the shot's life (3 tiles, `WandShot.as:23,66`);
 *       · Dark Shield: the bump (`Player.as:1695-1701`) needs the player's box ON the body: inside the reach, never a spot;
 *   - the kill needs the arm to DAMAGE the class: `enemyDamage.enemyHit` is run hit after hit, 30 ticks apart, on the trap's
 *     own `Enemy` fields (LavaTrap overrides none, `LavaTrap.as:28-46`). Fire is `t == "Fire"` against `hitByFire` false
 *     (`Enemy.as:145`): knockback only, never a kill. The plain Shield never calls `hit` (`Player.as:1703`, knockback);
 *   - a LIVE trap's reach (pixels): `int(FP.distance) <= chompRange` and `collideLine("Solid")` clear
 *     (`crusher.collideLineSolid`, the game's raycast). A trap killed from a spot stops being live (`startDeath` → its
 *     `update` returns before any tongue code, `LavaTrap.as:51-54,119-122`), so the walk may go on to the next: L78's
 *     `(9,6)` then `(6,5)`, killed in that order;
 *   - the walk is a 1 px flood of the player's position (the model's own `playerBoxAt` against the room's solids, the
 *     L99 sided kill-lock's flood), entering a tile only where the grid lets the arm alone in (its conditions resolved and
 *     evaluated with the arm's items: the Dark Suit is never held).
 * ⚠ THE WAND IS COMPUTED BUT NOT GRANTED (`ARM_TIME_UNDECIDED`): its kill is 6 shots, each after the trap's 30 i-frame
 *   ticks (`WandShot.as:29` damage 0.5 against `hitsMax` 3), so the player stands at the spot for ~150 ticks, and whether the
 *   room's other bodies allow that is a chase question (rule K's, out of scope; the witness's Wand crossings were GAME NO by
 *   runners and the bulb). The spot's geometry is reported, and the arm is left out of the gate, named.
 *
 * Inputs: the class constants (`LAVATRAP_PULL`, `ENEMY_CLASSES`, `ENEMY_DAMAGE_DEFAULTS`, the press/swing/shot models),
 * the patched map's traps and solids, the grid. No level literal, no per-level arm.
 */
import { ENEMY_CLASSES } from '../../frontend/modules/seedlingDemo/combat.js';
import { LAVATRAP_PULL, KILL_ARM_ITEMS, KILL_ARM_EXCLUDED } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { spearHitRect, pressRectTouches, SPEAR_DAMAGE } from '../../frontend/modules/seedlingDemo/presses.js';
import { swingHits, slashScaleFor, SLASH_SCALE_NORMAL, SWORD_DAMAGE } from '../../frontend/modules/seedlingDemo/combatVerbs.js';
import { ENEMY_DAMAGE_DEFAULTS, enemyHit } from '../../frontend/modules/seedlingDemo/enemyDamage.js';
import { createWandShot, wandShotRect, stepWandShot } from '../../frontend/modules/seedlingDemo/wandShot.js';
import { wandShotSpawn, wandShotVelocity } from '../../frontend/modules/seedlingDemo/wandVerb.js';
import { rectsOverlap } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { playerBoxAt } from '../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { collideLineSolid } from '../../frontend/modules/seedlingDemo/crusher.js';
import { T, BLOCKING, xy } from './seedlingHolderParking.js';

/**
 * The trap classes, read off the AS3 (header). `kills`: the tongue `die()`s a player without the suit.
 */
export const TONGUE_KILL_CLASSES = Object.freeze({
    lavatrap: Object.freeze({
        as3: 'LavaTrap', kills: true, condition: LAVATRAP_PULL.condition, chompRange: LAVATRAP_PULL.chompRange,
        cite: 'Enemies/LavaTrap.as:56-74 (`if (Player.hasDarkSuit)` … `else attached.die()`), :81-93 (launch: `d <= chompRange`, '
            + '`!wait`, clear `collideLine("Solid")`)',
    }),
    sandtrap: Object.freeze({
        as3: 'SandTrap', kills: false,
        cite: 'Enemies/SandTrap.as: chomps through `Enemy.hitPlayer` (an ordinary `Player.hit`); no `die()`, no `hasDarkSuit`',
    }),
    darktrap: Object.freeze({
        as3: 'DarkTrap', kills: false, cite: 'Enemies/DarkTrap.as: `extends SandTrap`; no `die()`, no `hasDarkSuit`',
    }),
    icetrap: Object.freeze({
        as3: 'IceTrap', kills: false, cite: 'Enemies/IceTrap.as: freezes on contact; no `die()`, no `hasDarkSuit`',
    }),
});

/** Does a class's tongue kill without the suit? A class with no row does not (no tongue). */
export const tongueKills = (tag, classes = TONGUE_KILL_CLASSES) => classes[tag]?.kills === true;

// ── the disc (grid) ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One trap's disc: its pull disc (`pull` = an `OV.lavaTrapPulls` row: `tile`, `from`, already line-cut) as player cells;
 * the trap's own tile, the blocking cells and `exempt` (landings, doors) left out. No second line test: the disc IS the
 * reach (`OV.pullLineClear` cut it once).
 */
export function trapTongueCells(pull, { grid, exempt = new Set() }) {
    const { width, cells } = grid;
    const trap = pull.tile[1] * width + pull.tile[0];
    const disc = new Set();
    for (const [x, y] of pull.from) {
        const i = y * width + x;
        if (i === trap || BLOCKING.has(cells[i]?.kind ?? 'wall') || exempt.has(i)) continue;
        disc.add(i);
    }
    return disc;
}

// ── the stamp ───────────────────────────────────────────────────────────────────────────────────────────────────────

const keyOf = (c) => JSON.stringify(c);
const disjunctsOf = (c) => (c?.any ? c.any : [c]);

/**
 * Charge `condition` to OCCUPY every cell of `cells` (indices): an `open` cell becomes `gated` with it, a gated or
 * directional cell adds it (ANDed with what it holds). A cell that already holds the condition, or one of its disjuncts,
 * is left as it is: it already implies the charge (two overlapping discs; a lava cell's Dark Suit implies
 * `Or(Dark Suit, …)`). Returns a new grid.
 */
export function stampOccupancy(grid, cells, condition) {
    if (cells.size === 0) return grid;
    const out = grid.cells.slice();
    const implied = new Set([keyOf(condition), ...disjunctsOf(condition).map(keyOf)]);
    for (const i of cells) {
        const cell = out[i];
        if (BLOCKING.has(cell.kind)) continue;
        const have = cell.conditions ?? [];
        if (have.some((c) => implied.has(keyOf(c)))) continue;
        out[i] = { ...cell, kind: cell.kind === 'open' ? 'gated' : cell.kind, conditions: [...have, condition] };
    }
    return { ...grid, cells: out };
}

/** The gate a trap's disc costs: the class's own condition (the Dark Suit), or it OR the qualifying arms. */
export function tongueCondition(base, arms) {
    if (arms.length === 0) return base;
    return { any: [base, ...arms.map((flag) => ({ flag }))] };
}

// ── the arms ────────────────────────────────────────────────────────────────────────────────────────────────────────

const DIR_UNIT = Object.freeze([[1, 0], [0, -1], [-1, 0], [0, 1]]); // FlashPunk facing: 0 right, 1 up, 2 left, 3 down
const OPPOSITE = Object.freeze([2, 3, 0, 1]);
/** How far out a spot is searched (px): past every arm's reach (the Wand's 16 px spawn + 3 tiles + a hitbox). */
export const SPOT_SEARCH_PX = 8 * T;
/** The arm whose kill time against the room's other bodies is not decided here (header). */
export const ARM_TIME_UNDECIDED = Object.freeze({
    hasWand: 'its kill is 6 shots 30 ticks apart (WandShot.as:29 damage 0.5, Enemy.hitsMax 3): whether the room\'s other bodies '
        + 'allow the stand is a chase question (rule K), not decided here; the spot geometry is reported',
});

/**
 * The candidate arms (every item arm the kill-lock census names, kept or excluded, but the Dark Suit itself, plus the Ghost
 * Sword the census's through-solid arms name), each with its hit test from a spot and the `Enemy.hit` call it makes.
 * `hit(p, facing, ctx)` → true when the arm's own test lands on the trap's hitbox from player position `p`.
 */
export const TONGUE_ARMS = Object.freeze([
    {
        flag: 'hasSpear', calls: { d: SPEAR_DAMAGE, t: 'Spear' }, cite: KILL_ARM_ITEMS.hasSpear.cite,
        hit: ([x, y], facing, { box }) => pressRectTouches(spearHitRect(x, y, facing), box),
    },
    ...[['hasSword', 'sword'], ['hasGhostSword', 'ghostsword']].map(([flag, sword]) => ({
        flag, calls: { d: SWORD_DAMAGE[sword], t: sword === 'ghostsword' ? 'Spear' : 'Sword' },
        cite: KILL_ARM_ITEMS.hasSword.cite,
        hit: ([x, y], facing, { box, centre, blockedLine }) => {
            const ghost = sword === 'ghostsword';
            const scales = [SLASH_SCALE_NORMAL, slashScaleFor('slashnarrow', { hasGhostSword: ghost })];
            const target = { id: 'trap', box, type: 'Enemy', cx: centre[0], cy: centre[1] };
            return scales.some((scale) => swingHits({ x, y }, facing, [target], { sword, scale, blockedLine }).length > 0);
        },
    })),
    {
        flag: 'hasWand', calls: { d: null, t: 'Wand' }, cite: KILL_ARM_ITEMS.hasWand.cite,
        hit: ([x, y], facing, { box, solidAt }) => {
            const spawn = wandShotSpawn(facing, x, y);
            const shot = createWandShot('t', spawn.x, spawn.y, wandShotVelocity(facing));
            const hitAt = (sx, sy, s) => {
                const r = wandShotRect({ ...s, x: sx, y: sy });
                if (rectsOverlap(r, box)) return { kind: 'enemy', id: 'trap' };
                return solidAt(r) ? { kind: 'other', id: 'solid' } : null;
            };
            for (let i = 0; i <= shot.lifeMax + 1 && !shot.removed && shot.anim !== 'die'; i += 1) {
                const r = stepWandShot(shot, { tick: i, hitAt });
                if (r.event) return r.event.arm === 'enemy';
            }
            return false;
        },
        damageOf: () => createWandShot('t', 0, 0, wandShotVelocity(0)).damage,
    },
    {
        flag: 'hasDarkShield', calls: { d: 0.5, t: 'Shield' }, cite: KILL_ARM_ITEMS.hasDarkShield.cite,
        // the bump: the player's box on the body (touching counts)
        hit: ([x, y], _facing, { box }) => pressRectTouches({ ...playerBoxAt(x, y), inclusive: true }, box),
    },
    {
        flag: 'hasFire', calls: { d: 0, t: 'Fire' }, cite: KILL_ARM_EXCLUDED.hasFire,
        // the reach is not what stops it: any spot is offered, and `Enemy.hit` refuses the damage
        hit: () => true,
    },
    {
        flag: 'hasShield', calls: null, cite: KILL_ARM_EXCLUDED.hasShield,
        hit: () => true,
    },
]);

/**
 * How many `Enemy.hit` calls (each after the i-frames run out) the arm needs to kill the class, or `Infinity`.
 * `overrides` = the class's own `Enemy` fields (LavaTrap sets none).
 */
export function hitsToKill(arm, overrides = {}) {
    if (!arm.calls) return Infinity;
    const d = arm.calls.d ?? arm.damageOf();
    const { src: _src, ...fields } = ENEMY_DAMAGE_DEFAULTS;
    const state = { as3: 'tongue-trap', ...fields, ...overrides, dying: false, destroy: false, alpha: 1, removed: false };
    for (let n = 1; n <= 64; n += 1) {
        state.hitsTimer = 0;
        const r = enemyHit(state, { d, t: arm.calls.t });
        if (r.killed) return n;
        if (!r.damaged) return Infinity;
    }
    return Infinity;
}

/**
 * Every cardinal kill spot of one trap for one arm: `[{p:[x,y], facing, k}]` (px; `k` the distance along the axis).
 * `room.free(x, y)` = the player's box clear of solids at that point.
 */
export function cardinalKillSpots(trap, arm, room, { chompRange = LAVATRAP_PULL.chompRange, searchPx = SPOT_SEARCH_PX } = {}) {
    const out = [];
    const [cx, cy] = trap.centre;
    for (let dir = 0; dir < 4; dir += 1) {
        const [ux, uy] = DIR_UNIT[dir];
        const facing = OPPOSITE[dir];
        for (let k = chompRange + 1; k <= searchPx; k += 1) {
            const p = [cx + ux * k, cy + uy * k];
            if (Math.floor(Math.hypot(p[0] - cx, p[1] - cy)) <= chompRange) continue;
            if (p[0] < 0 || p[1] < 0 || p[0] >= room.widthPx || p[1] >= room.heightPx || !room.free(p[0], p[1])) continue;
            if (arm.hit(p, facing, { box: trap.box, centre: trap.centre, blockedLine: room.blockedLine, solidAt: room.solidAt })) {
                out.push({ p, facing, k });
            }
        }
    }
    return out;
}

/**
 * The 1 px flood of the player's position from `seeds` (px points), stepping only onto free points that lie in no
 * `avoid` point and onto tiles `enterable(tx, ty)` lets in. Returns the reached points as a Uint8Array over the room.
 */
export function pixelFlood(room, seeds, enterable, avoid) {
    const W = room.widthPx;
    const H = room.heightPx;
    const seen = new Uint8Array(W * H);
    const queue = [];
    const ok = (x, y) => room.freeMask[y * W + x] === 1 && !avoid(y * W + x);
    for (const [x, y] of seeds) {
        if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x] || !ok(x, y)) continue;
        if (!enterable(Math.floor(x / T), Math.floor(y / T))) continue;
        seen[y * W + x] = 1;
        queue.push(y * W + x);
    }
    for (let head = 0; head < queue.length; head += 1) {
        const at = queue[head];
        const x = at % W;
        const y = (at - x) / W;
        for (const [dx, dy] of DIR_UNIT) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (seen[n]) continue;
            const ntx = Math.floor(nx / T);
            const nty = Math.floor(ny / T);
            if ((ntx !== Math.floor(x / T) || nty !== Math.floor(y / T)) && !enterable(ntx, nty)) continue;
            if (!ok(nx, ny)) continue;
            seen[n] = 1;
            queue.push(n);
        }
    }
    return seen;
}

/** The pixels of a trap's live reach: `int(distance) <= chompRange` and a clear `collideLine("Solid")` to the trap. */
export function reachMask(trap, room, { chompRange = LAVATRAP_PULL.chompRange } = {}) {
    const W = room.widthPx;
    const mask = new Uint8Array(W * room.heightPx);
    const [cx, cy] = trap.centre;
    for (let y = Math.max(0, cy - chompRange - 1); y <= Math.min(room.heightPx - 1, cy + chompRange + 1); y += 1) {
        for (let x = Math.max(0, cx - chompRange - 1); x <= Math.min(W - 1, cx + chompRange + 1); x += 1) {
            if (Math.floor(Math.hypot(x - cx, y - cy)) > chompRange) continue;
            if (room.blockedLine(cx, cy, x, y)) continue;
            mask[y * W + x] = 1;
        }
    }
    return mask;
}

/**
 * RULE T's arms over one room. `room`:
 *   `widthPx`, `heightPx`; `free(x, y)` (the player's box clear of solids); `solidAt(rect)`; `blockedLine(x0, y0, x1, y1)`
 *   (`collideLine("Solid")`); `enterable(tx, ty, flag)` (the grid lets a player holding only `flag` onto that tile);
 *   `traps` = `[{id, tag, centre: [cx, cy], box}]` (killing classes only); `seeds` = `[{name, points: [[x, y], …]}]`.
 * Returns, per trap, the qualifying arms and the evidence: `{id, arms, perArm: {flag: {hits, spots, approaches, killedFrom,
 * order, granted, why}}}` (`order`: per landing, the traps each round of the kill order killed).
 */
export function trapKillArms(room, { arms = TONGUE_ARMS, overridesOf = () => ({}), chompRange = LAVATRAP_PULL.chompRange } = {}) {
    const W = room.widthPx;
    room.freeMask ??= (() => {
        const m = new Uint8Array(W * room.heightPx);
        for (let y = 0; y < room.heightPx; y += 1) for (let x = 0; x < W; x += 1) m[y * W + x] = room.free(x, y) ? 1 : 0;
        return m;
    })();
    const reach = new Map(room.traps.map((t) => [t.id, reachMask(t, room, { chompRange })]));
    const result = new Map(room.traps.map((t) => [t.id, { id: t.id, arms: [], perArm: {} }]));
    for (const arm of arms) {
        const hits = new Map(room.traps.map((t) => [t.id, hitsToKill(arm, overridesOf(t))]));
        const spots = new Map(room.traps.map((t) => [t.id, Number.isFinite(hits.get(t.id)) ? cardinalKillSpots(t, arm, room, { chompRange }) : []]));
        const enterable = (tx, ty) => room.enterable(tx, ty, arm.flag);
        // Which landings come near each trap at all (the base flood, no reach avoided).
        const approaches = new Map(room.traps.map((t) => [t.id, []]));
        const killedFrom = new Map(room.traps.map((t) => [t.id, []]));
        const order = {};
        for (const seed of room.seeds) {
            const base = pixelFlood(room, seed.points, enterable, () => false);
            const near = room.traps.filter((t) => { const m = reach.get(t.id); return base.some((v, i) => v && m[i]); });
            if (near.length === 0) continue;
            for (const t of near) approaches.get(t.id).push(seed.name);
            // The kill order: flood avoiding every live reach; a trap with a reached spot dies; repeat.
            const live = new Set(room.traps.map((t) => t.id));
            for (;;) {
                const masks = [...live].map((id) => reach.get(id));
                const seen = pixelFlood(room, seed.points, enterable, (i) => masks.some((m) => m[i] === 1));
                const dead = [...live].filter((id) => spots.get(id).some(({ p: [x, y] }) => seen[y * W + x] === 1));
                if (dead.length === 0) break;
                (order[seed.name] ??= []).push(dead);
                for (const id of dead) { live.delete(id); killedFrom.get(id).push(seed.name); }
            }
        }
        for (const t of room.traps) {
            const from = approaches.get(t.id);
            const killed = from.length > 0 && from.every((s) => killedFrom.get(t.id).includes(s));
            const why = !Number.isFinite(hits.get(t.id)) ? `\`Enemy.hit\` never kills it with ${arm.calls ? `t "${arm.calls.t}"` : 'no hit call'}`
                : spots.get(t.id).length === 0 ? 'no cardinal spot outside its reach lands the arm\'s hit test'
                    : from.length === 0 ? 'no landing comes near it'
                        : !killed ? `a spot is not reached from ${from.filter((s) => !killedFrom.get(t.id).includes(s)).join(', ')} without entering a live reach`
                            : ARM_TIME_UNDECIDED[arm.flag] ?? null;
            const granted = killed && !ARM_TIME_UNDECIDED[arm.flag];
            result.get(t.id).perArm[arm.flag] = {
                hits: hits.get(t.id), spots: spots.get(t.id).length,
                windows: spotWindows(spots.get(t.id)), approaches: from, killedFrom: killedFrom.get(t.id), order, granted, why,
            };
            if (granted) result.get(t.id).arms.push(arm.flag);
        }
    }
    return [...result.values()];
}

/** The spots, grouped per facing into `[kMin, kMax]` windows (for the report). */
function spotWindows(spots) {
    const by = new Map();
    for (const s of spots) {
        const name = ['W', 'S', 'E', 'N'][s.facing]; // the side the player stands on (facing right = standing west)
        const w = by.get(name) ?? [Infinity, -Infinity];
        by.set(name, [Math.min(w[0], s.k), Math.max(w[1], s.k)]);
    }
    return Object.fromEntries([...by].map(([k, [a, b]]) => [k, `${a}..${b}`]));
}

/**
 * Do a level's live discs SEAL a route? The anchors are the room's own elements (its exits' entrance tiles, its locations'
 * tiles and its landings, `anchors` as cell indices); `passable(i)` = a cell a player WITHOUT the Dark Suit walks (every
 * other item assumed held: the question is the suit's own reach). Returns the anchor pairs connected with every disc
 * passable and disconnected with every disc cell removed (`[]` = the discs seal nothing, and a route can always avoid them).
 * The discs are taken TOGETHER, so two discs that each leave a way round but together close the room still seal.
 */
export function discsSeal({ grid, discs, anchors, passable }) {
    const { width, height } = grid;
    const blocked = new Set(discs.flatMap((d) => [...d]));
    const label = (without) => {
        const lab = new Map();
        let k = 0;
        for (const a of anchors) {
            if (lab.has(a) || !passable(a) || without.has(a)) continue;
            lab.set(a, k);
            const q = [a];
            for (let h = 0; h < q.length; h += 1) {
                const [x, y] = xy(q[h], width);
                for (const [dx, dy] of DIR_UNIT) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const n = ny * width + nx;
                    if (lab.has(n) || without.has(n) || !passable(n)) continue;
                    lab.set(n, k);
                    q.push(n);
                }
            }
            k += 1;
        }
        return lab;
    };
    const base = label(new Set());
    const cut = label(blocked);
    const uniq = [...new Set(anchors)].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < uniq.length; i += 1) {
        for (let j = i + 1; j < uniq.length; j += 1) {
            const [a, b] = [uniq[i], uniq[j]];
            if (base.get(a) === undefined || base.get(a) !== base.get(b)) continue;
            if (cut.get(a) !== undefined && cut.get(a) === cut.get(b)) continue;
            out.push([xy(a, width), xy(b, width)]);
        }
    }
    return out;
}

/**
 * RULE T over one level's grid. `room` = `{grid, exempt, pulls, traps (tag + tile per pull), arms: trapKillArms rows}`.
 * Stamps each killing trap's disc with `tongueCondition`. Returns the grid and the per-trap rows.
 */
export function stampTrapTongues({ grid, exempt = new Set(), pulls = [], killArms = new Map(), anchors = [], passable = null }) {
    const { width } = grid;
    const cellsOf = (set) => [...set].sort((a, b) => a - b).map((i) => xy(i, width));
    let out = grid;
    const traps = [];
    const live = pulls.filter((p) => tongueKills(p.tag ?? LAVATRAP_PULL.tag))
        .map((pull) => ({ pull, disc: trapTongueCells(pull, { grid, exempt }) })).filter((t) => t.disc.size > 0);
    // Only where the live discs together SEAL a route (`discsSeal`): a room whose every route can avoid them is left as
    // the analyzer had it (no gate, no sub-region split). `passable` null = every disc is gated (the unit rows' shape).
    const sealed = passable ? discsSeal({ grid, discs: live.map((t) => t.disc), anchors, passable }) : null;
    if (sealed && sealed.length === 0) return { grid, traps, sealed };
    for (const { pull, disc } of live) {
        const cls = TONGUE_KILL_CLASSES[pull.tag ?? LAVATRAP_PULL.tag];
        const arms = killArms.get(pull.tile.join(',')) ?? [];
        const condition = tongueCondition(cls.condition, arms);
        out = stampOccupancy(out, disc, condition);
        traps.push({ trap: pull.tile, arms, condition, cells: cellsOf(disc) });
    }
    return { grid: out, traps, sealed };
}

// ── one level's room, for `trapKillArms` ────────────────────────────────────────────────────────────────────────────

/** The items an AP rule grants when held as an inventory (`Has` leaves under `And`): `{item: count}`. */
export function inventoryOf(rule, inv = {}) {
    if (rule?.rule === 'Has') inv[rule.args.item_name] = Math.max(inv[rule.args.item_name] ?? 0, rule.args.count ?? 1);
    else if (rule?.rule === 'And') for (const c of rule.children ?? []) inventoryOf(c, inv);
    else throw new Error(`trap tongue: an arm must resolve to Has/And leaves, got ${JSON.stringify(rule)}`);
    return inv;
}

/** Does `inv` satisfy the AP rule? `Has`/`And`/`Or`/`True_`; anything else is NOT satisfied (the strict side). */
export function satisfies(rule, inv) {
    switch (rule?.rule) {
        case 'True_': return true;
        case 'Has': return (inv[rule.args.item_name] ?? 0) >= (rule.args.count ?? 1);
        case 'And': return (rule.children ?? []).every((c) => satisfies(c, inv));
        case 'Or': return (rule.children ?? []).some((c) => satisfies(c, inv));
        default: return false;
    }
}

/**
 * One level's room for `trapKillArms`. `world` = a `buildLevelWorld` of the level (its gated entities left out: the grid
 * prices those), `grid` = the analyzer grid BEFORE rule T, `seeds` = the landing tiles, `resolveCondition` = the analyzer's.
 * A tile is enterable holding one arm when it is floor or `manual` (the 1 px flood decides a pixel mask), or a
 * gated / directional cell whose every condition the arm's own items satisfy. Walls and sinks never are.
 */
export function tongueRoomOf({ level, grid, world, pulls, seeds, resolveCondition, classes = ENEMY_CLASSES }) {
    const solids = world.solidBoxesForMover();
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const invs = new Map();
    const invOf = (flag) => {
        if (!invs.has(flag)) invs.set(flag, inventoryOf(resolveCondition({ flag })));
        return invs.get(flag);
    };
    const traps = pulls.filter((p) => tongueKills(p.tag ?? LAVATRAP_PULL.tag)).map((p) => {
        const tag = p.tag ?? LAVATRAP_PULL.tag;
        const row = classes[tag];
        if (!row?.ctor || !row.hitbox) throw new Error(`trap tongue: L${level.level} ${tag} has no ENEMY_CLASSES ctor/hitbox row`);
        const centre = [p.tile[0] * T + row.ctor.dx, p.tile[1] * T + row.ctor.dy];
        const box = { x: centre[0] - row.hitbox.ox, y: centre[1] - row.hitbox.oy };
        Object.assign(box, { right: box.x + row.hitbox.w, bottom: box.y + row.hitbox.h });
        return { id: p.tile.join(','), tag, centre, box };
    });
    return {
        widthPx: level.width * T,
        heightPx: level.height * T,
        free: (x, y) => world.collidesSolid(playerBoxAt(x, y), {}) === null,
        solidAt: (r) => world.collidesSolid(r, {}) !== null,
        blockedLine: (x0, y0, x1, y1) => collideLineSolid(solids, x0, y0, x1, y1) !== null,
        enterable: (tx, ty, flag) => {
            const cell = grid.cells[(ty - oy) * grid.width + (tx - ox)];
            if (!cell || cell.kind === 'wall' || cell.kind === 'sink') return false;
            if (cell.kind === 'open' || cell.kind === 'manual') return true;
            const inv = invOf(flag);
            const conds = [...(cell.conditions ?? []), ...Object.values(cell.dirs ?? {}).flatMap((g) => (Array.isArray(g) ? g : g ? [g] : []))];
            return conds.every((c) => satisfies(resolveCondition(c), inv));
        },
        traps,
        seeds: seeds.map(([tx, ty]) => {
            const points = [];
            for (let y = ty * T; y < (ty + 1) * T; y += 1) for (let x = tx * T; x < (tx + 1) * T; x += 1) points.push([x, y]);
            return { name: `${tx},${ty}`, points };
        }),
    };
}

export { ENEMY_CLASSES };
