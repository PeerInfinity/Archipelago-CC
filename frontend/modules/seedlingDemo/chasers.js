/**
 * chasers — the EXACT step for the two classes R5 slice 3 fights.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 3.
 *
 * `encounters.chaseEnvelope` is an OVER-APPROXIMATION and deliberately so:
 * it grows the enemy's box by `moveSpeed` per tick and reports UNDECIDED
 * whenever the grown box meets the path. That is sound for "this crossing
 * cannot be touched" and useless for "stand HERE and swing THEN", which is
 * what a kill needs. This module is the exact arithmetic for `bob` and
 * `jellyfish` — the two classes the first live kill and R4's own route
 * actually meet — and nothing else. A third class gets transcribed when a
 * rung fights it, not speculatively.
 *
 * ── THE PLACEMENTS COME FROM `combat.js`, NEVER FROM HERE ─────────────
 * Slice 2's headline defect was a second transcription of the constructor
 * offsets that disagreed with the first by eight pixels on every enemy on
 * the map. So this module IMPORTS `ENEMY_CLASSES` for the ctor offset, the
 * hitbox, the speed and the leash, and adds only what a census has no
 * business carrying: the per-tick arithmetic, the freeze gate, and the
 * death animation's length.
 *
 * ── THE FOUR THINGS THAT ARE NOT OBVIOUS ──────────────────────────────
 *
 * 1. **The freeze gate differs BY CLASS.** `Bob.update` returns on
 *    `destroy || currentAnim == "die" || Game.freezeObjects`;
 *    `Jellyfish.update` returns on `destroy || currentAnim == "die"` and
 *    **does not test the freeze at all**. `Mobile.mobileUpdate` skips the
 *    move while frozen either way — so a frozen jellyfish still ACCUMULATES
 *    chase velocity and lurches when the freeze lifts, and a frozen bob does
 *    not. Reading one class and generalising gets this backwards for
 *    whichever one you did not read.
 *
 * 2. **The off-screen return does not stop the chase.** `Enemy.update`'s
 *    first statement is `if (!activeOffScreen && !onScreen()) return;` —
 *    but that is `super.update()`, and both subclasses run their chase
 *    block AFTER it. So an off-screen chaser ACCUMULATES velocity every
 *    tick and moves none of it, because both the friction and the move live
 *    in the part that returned. Its `hitUpdate` does not run either, so an
 *    off-screen enemy's i-frames do not tick down.
 *
 *    ⚠ It does NOT grow without bound, and this file said it did until the
 *    arithmetic was written out. The impulse is `v.x += sign(toV.x - v.x) *
 *    moveSpeed` — bang-bang TOWARD `toV`, not a constant push — so once
 *    `v.x` reaches `toV.x` the sign is 0 and the term vanishes. The
 *    accumulation converges on `moveSpeed` (oscillating within one step of
 *    it when the angle moves), so what the camera's arrival releases is one
 *    ordinary step of velocity, not a stored-up lurch. The wrong version of
 *    this note would have made the planner treat every off-screen wake as
 *    unbounded and hard-avoid rooms that are fine.
 *
 * 3. **Friction runs BEFORE the move, and the chase impulse lands AFTER
 *    it.** Order per tick: `friction()`, `moveX(v.x)`, `moveY(v.y)` (inside
 *    `super.update()`), then the subclass's chase block adds to `v`. So the
 *    velocity a tick MOVES is the one the previous tick's chase left, minus
 *    this tick's friction.
 *
 * 4. **Death is an ANIMATION, and the body is still in the world during
 *    it.** Both classes override `startDeath` to `play("die")` WITHOUT
 *    setting `destroy`; `endAnim` does that when the animation completes.
 *    `Game.totalEnemies()` counts entities, so a kill lock does not open on
 *    the killing blow — it opens ~25 ticks later for a bob and ~35 for a
 *    jellyfish. A window floor that stopped at the last press would leave
 *    the lock shut and the walk standing at it.
 */

import { ENEMY_CLASSES } from './combat.js';
import { rect, SOLIDS_BY_MOVER } from './levelWorld.js';
import { MODELLED_ENEMY_CLASSES } from './spinner.js';

export class ChaserError extends Error {
    constructor(message) { super(message); this.name = 'ChaserError'; }
}
const fail = (m) => { throw new ChaserError(m); };

/**
 * `FP.elapsed`, and it is a CONSTANT for this bot.
 *
 * `Engine.as:161-162` computes it from the wall clock and then clamps at
 * `MAX_ELAPSED` = 0.0333 — a 30 fps floor. The bot runs at ~24 fps on the
 * Windows path and ~0.4 fps on SwiftShader; both are under 30, so both
 * clamp, and every animation on every recording this arc has made stepped
 * at exactly this number (R5 slice 2, kickoff §11.4).
 *
 * ⚠ It is a fact about the REGIME, not about the engine. A browser running
 * the page ABOVE 30 fps would step animations faster and every count below
 * would be wrong.
 */
export const FP_ELAPSED = 0.0333;

/** `Mobile.DEFAULT_FRICTION`. An `Enemy` never changes `f`. */
export const FRICTION = 0.25;

/** `Mobile.friction`'s dead zone — a component under this is ZEROED. */
export const VELOCITY_EPSILON = 0.05;

/**
 * How many ticks a FlashPunk animation takes to reach its callback.
 *
 * `Spritemap.update` is `_timer += _frameRate * FP.elapsed` (FP.fixed is
 * false — `Main` constructs `Engine(160, 160, FPS)` with `fixed` defaulted)
 * and steps `_index` once per whole unit. The callback fires when `_index`
 * reaches `_frameCount`, so the tick count is `ceil(frameCount / step)`.
 *
 * ⚠ The step is 0.999 for a 30 fps animation, NOT 1. The "slash" anim's
 * five frames therefore take SIX ticks, not five — a fencepost that decides
 * how long `slashing` is up and therefore how many ticks the hit test runs.
 */
export function animTicks(frameCount, frameRate) {
    if (!Number.isInteger(frameCount) || frameCount <= 0) {
        fail(`animTicks: frameCount must be a positive integer, got ${frameCount}`);
    }
    if (!(frameRate > 0)) fail(`animTicks: frameRate must be positive, got ${frameRate}`);
    return Math.ceil(frameCount / (frameRate * FP_ELAPSED));
}

/**
 * The per-class facts a census does not carry, per the header.
 *
 * `dieAnim` is `Spritemap.add("die", frames, rate)`'s own arguments, so the
 * derived tick count is one arithmetic step from the source rather than a
 * number somebody measured once.
 */
export const CHASERS = Object.freeze({
    bob: Object.freeze({
        as3: 'Bob',
        // ⚠ `d` is measured to `player + targetOffset`, and `targetOffset`
        // is a PUBLIC field the subclasses write. Bob's own is (0,0);
        // carrying it explicitly is what keeps a subclass from inheriting a
        // silently wrong leash centre.
        targetOffset: Object.freeze({ x: 0, y: 0 }),
        freezesOnGameFreeze: true,
        dieAnim: Object.freeze({ frames: 4, rate: 5, src: 'Bob.as:36 add("die", [3,4,5,6], 5)' }),
        // ⛔ `Bob.as:39` — `solids.push("Enemy")`. See `SOLIDS_BY_MOVER.chaser`.
        solidsMover: 'chaser',
        src: 'Enemies/Bob.as:44-83',
    }),
    jellyfish: Object.freeze({
        as3: 'Jellyfish',
        targetOffset: Object.freeze({ x: 0, y: 0 }),
        // ⛔ NOT a copy-paste of the line above — see header note 1.
        freezesOnGameFreeze: false,
        dieAnim: Object.freeze({ frames: 8, rate: 7, src: 'Jellyfish.as:36 add("die", dieFrames, 7)' }),
        // ⛔ `Jellyfish.as:35` — the same push, and NOT a copy-paste: the
        // sweep swept every `Enemies/*.as` and this class really has one.
        solidsMover: 'chaser',
        src: 'Enemies/Jellyfish.as:44-75',
    }),
});

/**
 * ⛓⛓⛓ R8 SLICE 1 — WHICH CHASERS ARE BRIDGED INTO THE TICK LOOP, DERIVED.
 *
 * A class is bridged when BOTH tables say so: it has a transcription here
 * (`CHASERS`) and a row in `spinner.MODELLED_ENEMY_CLASSES` whose `module`
 * names this file. Neither table alone is the answer —
 *
 *   · a transcription with no roster row is what `chasers.js` was for three
 *     rungs: exact, tested, and called by nothing;
 *   · a roster row naming a module that does not transcribe the class would
 *     be a permission with no implementation behind it.
 *
 * ⚠ DERIVED, NEVER TYPED. A third list of bridged tags beside these two is
 * trap 89 exactly — and this is the roster `levelRun` gates its stepper on,
 * `combat.CONTACT_STEPPED_FAMILIES` is cross-asserted against, and
 * `r8Acceptance`'s exposure prediction is measured with.
 *
 * @returns {string[]} CENSUS TAGS (`bob`), sorted — not AS3 class names. The
 *   roster is keyed on the class and every consumer here holds a census row.
 */
export function bridgedChaserTags() {
    return Object.entries(CHASERS)
        .filter(([, c]) => MODELLED_ENEMY_CLASSES[c.as3]?.module === 'chasers.js')
        .map(([tag]) => tag)
        .sort();
}

/** Is this census tag one the tick loop steps? */
export function isBridgedChaser(tag) {
    const c = CHASERS[tag];
    return !!c && MODELLED_ENEMY_CLASSES[c.as3]?.module === 'chasers.js';
}

/**
 * The solids list one chaser's own `moveX`/`moveY` sweep collides against.
 *
 * ⚠ PER CLASS, and it throws for a class with no `solidsMover` rather than
 * defaulting to the base list: a default here is the exact silence R5 slice
 * 12 spent a whole shaft on, one family over.
 */
export function chaserSolids(tag) {
    const c = CHASERS[tag];
    if (!c) fail(`chaserSolids: "${tag}" is not a transcribed chaser`);
    const list = SOLIDS_BY_MOVER[c.solidsMover];
    if (!list) {
        fail(`chaserSolids: "${tag}" names solids mover "${c.solidsMover}", which `
            + `levelWorld.SOLIDS_BY_MOVER does not define (knows `
            + `[${Object.keys(SOLIDS_BY_MOVER).join(', ')}]). Solidity is a property of `
            + 'the thing MOVING and a default would answer the wrong mover\'s question.');
    }
    return list;
}

/** Ticks from the killing blow to `destroy` — see header note 4. */
export function deathTicks(tag) {
    const c = CHASERS[tag];
    if (!c) fail(`deathTicks: "${tag}" is not a transcribed chaser (know ${Object.keys(CHASERS)})`);
    return animTicks(c.dieAnim.frames, c.dieAnim.rate);
}

/**
 * ⛔ THE TILE TYPES `Enemy.update`'s TERRAIN SWITCH DESTROYS A BODY ON.
 *
 * `Enemies/Enemy.as:68-103` — `case 1: //Water` and `case 17: //Lava` each
 * set `destroy = true` outright (gated on `dieInWater`/`dieInLava`, both
 * `true` on the base class and on `Bob`); `case 6` starts the PIT fall, which
 * is a schedule rather than an instant and is not in this pair.
 *
 * ⚠ NOT TRANSCRIBED BY `chaserStep`, ON PURPOSE — see the header. The switch
 * sits ABOVE `super.update()`, runs through a freeze, and its removal is what
 * R7 slice 6e's L6 `despawn` DECLARES. This constant exists so a consumer can
 * ASSERT the gap rather than discover it: a stepped body standing here is one
 * the game has already destroyed.
 */
export const ENEMY_TERRAIN_DESTROYS = Object.freeze({ water: 1, lava: 17 });

/**
 * `Enemy.update`'s `case 6` — the PIT, which is a SCHEDULE and not an
 * instant, and is therefore refused rather than transcribed here. It lerps
 * the body a tenth of the way to its tile centre per tick, spins the graphic
 * by `fallSpinSpeed` and fades it by `fallAlphaSpeed` 0.05, and only sets
 * `destroy` when the alpha runs out.
 */
export const ENEMY_PIT_TILE = 6;

/** The class's box at a centre, from the CENSUS's hitbox. */
export function chaserBoxAt(tag, cx, cy) {
    const row = ENEMY_CLASSES[tag];
    if (!row?.hitbox) fail(`chaserBoxAt: "${tag}" has no hitbox in ENEMY_CLASSES`);
    const { w, h, ox, oy } = row.hitbox;
    return rect(cx - ox, cy - oy, w, h);
}

/** `flash.geom.Point.normalize(len)` — a no-op on the zero point. */
function normalize(v, len) {
    const m = Math.hypot(v.x, v.y);
    if (m === 0) return v;
    return { x: (v.x / m) * len, y: (v.y / m) * len };
}

/** `Mobile.friction()`. */
export function applyFriction(v, f = FRICTION) {
    const m = Math.hypot(v.x, v.y);
    let out = normalize(v, Math.max(m - f, 0));
    out = { x: Math.abs(out.x) < VELOCITY_EPSILON ? 0 : out.x,
        y: Math.abs(out.y) < VELOCITY_EPSILON ? 0 : out.y };
    return out;
}

/**
 * `FP.sign` — 0 for zero, NOT 1. `Math.sign` agrees; spelled out because
 * the chase block's `sign(toV.x - v.x) * moveSpeed` reaching exactly zero
 * is the case where an enemy at its target speed stops accelerating, and a
 * sign function that returned 1 there would make it oscillate.
 */
const sign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/**
 * The chase block, exactly (`Bob.as:57-75` / `Jellyfish.as:52-70` — the two
 * are the same eleven lines, which is why they are one function here).
 *
 * Returns the velocity the block leaves. `d > runRange` returns `v`
 * untouched: a chaser out of leash does not decelerate, it just stops being
 * pushed, and friction is what brings it down.
 */
export function chaseImpulse(tag, enemy, player) {
    const row = ENEMY_CLASSES[tag];
    const c = CHASERS[tag];
    if (!row || !c) fail(`chaseImpulse: "${tag}" is not a transcribed chaser`);
    const ms = row.speed;
    const range = row.aggro.range;
    const tx = player.x + c.targetOffset.x;
    const ty = player.y + c.targetOffset.y;
    const d = Math.hypot(tx - enemy.x, ty - enemy.y);
    if (d > range) return { ...enemy.v };
    const a = Math.atan2(ty - enemy.y, tx - enemy.x);
    const toV = { x: ms * Math.cos(a), y: ms * Math.sin(a) };
    // ⚠ `pushed` is measured BEFORE the impulse. It is what stops a
    // knocked-back enemy from having its knockback cancelled by the
    // re-normalise on the very next tick, which is why a hit reads as a
    // knockback rather than as a wall.
    const pushed = Math.hypot(enemy.v.x, enemy.v.y) > ms;
    let v = {
        x: enemy.v.x + sign(toV.x - enemy.v.x) * ms,
        y: enemy.v.y + sign(toV.y - enemy.v.y) * ms,
    };
    if (!pushed && Math.hypot(v.x, v.y) > ms) v = normalize(v, ms);
    return v;
}

/**
 * One whole tick for one chaser.
 *
 * @param {string} tag
 * @param {object} enemy  `{x, y, v: {x, y}, dying?}`
 * @param {object} player `{x, y}`
 * @param {object} opts
 * @param {boolean=} opts.onScreen  `Enemy.update`'s first gate. Default
 *   TRUE — but pass it, because false is the interesting case and a default
 *   that hid it would make the growth in note 2 invisible.
 * @param {boolean=} opts.frozen    `Game.freezeObjects`.
 * @param {function=} opts.move     `(x, y, dx, dy) => {x, y}` — the solid
 *   sweep. Default is a FREE move, which is the over-approximation the
 *   planner already uses; a caller that has the level's solids passes the
 *   real one. It is a parameter rather than an import so this module has no
 *   opinion about which world it is stepping.
 */
export function chaserStep(tag, enemy, player, {
    onScreen = true, frozen = false, move = null,
} = {}) {
    const c = CHASERS[tag];
    if (!c) fail(`chaserStep: "${tag}" is not a transcribed chaser`);
    let { x, y } = enemy;
    let v = { ...enemy.v };

    // ── super.update() ────────────────────────────────────────────────
    // The off-screen return skips the WHOLE of `Mobile.mobileUpdate`, so
    // neither friction nor the move happens — and neither does `hitUpdate`,
    // which is why an off-screen enemy's i-frames do not tick down either.
    let iframesTicked = false;
    if (onScreen) {
        if (!frozen) {
            v = applyFriction(v);
            const moved = move ? move(x, y, v.x, v.y) : { x: x + v.x, y: y + v.y };
            x = moved.x;
            y = moved.y;
        }
        iframesTicked = true;
    }

    // ── the subclass block ────────────────────────────────────────────
    // ⚠ Runs whether or not the super returned early (note 2), and its
    // freeze gate is PER CLASS (note 1).
    const blocked = enemy.dying === true || (c.freezesOnGameFreeze && frozen);
    if (!blocked) v = chaseImpulse(tag, { x, y, v }, player);

    return { x, y, v, iframesTicked };
}

/**
 * The window a kill has to HOLD, from the last landed hit.
 *
 * The `+1` is the hit test's own one-tick lag off the press
 * (`combatVerbs`, header note 1); the rest is the death animation, during
 * which the body is still an entity `Game.totalEnemies()` counts.
 */
export function killWindowTicks(tag) {
    return 1 + deathTicks(tag);
}
